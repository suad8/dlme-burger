import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { InvitationStatus, type RoleKey } from '@prisma/client'
import { prisma } from '../db'
import { authorize, ForbiddenError, ROLE_LABELS, DEFAULT_ROLE_PERMISSIONS } from '../rbac'
import type { TenantContext } from '../tenant'
import { recordAudit } from '../audit'
import { resolveEmailProvider } from '../email/provider'
import { invitationEmail } from '../email/templates'

/**
 * الدعوات.
 *
 * ثلاث قواعد تحكم هذا الملف:
 *
 * ١. الرمز لا يُخزَّن كما يُرسَل. ما في قاعدة البيانات بصمة SHA-256، والرمز
 *    الأصلي يوجد لحظةً واحدة في الذاكرة ثم يذهب في البريد. من يقرأ الجدول
 *    لا يستطيع قبول دعوة ليست له.
 *
 * ٢. لا ترقية للصلاحيات عبر الدعوة. الداعي لا يستطيع منح دور يملك صلاحية
 *    لا يملكها هو. بدون هذه القاعدة يصير أي من يملك `user:create` قادرًا على
 *    صناعة مالك منشأة ثم الدخول به.
 *
 * ٣. حد الباقة يُحسب على العضويات + الدعوات المعلّقة معًا، وإلا صار بالإمكان
 *    تجاوزه بإرسال دعوات تُقبل لاحقًا.
 */

const TOKEN_BYTES = 32
const EXPIRY_DAYS = 7

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export class InviteLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InviteLimitError'
  }
}

export class RoleEscalationError extends Error {
  constructor(roleKey: RoleKey) {
    super(
      `لا يمكنك دعوة عضو بدور «${ROLE_LABELS[roleKey]}» لأنه يملك صلاحيات تتجاوز صلاحياتك.`,
    )
    this.name = 'RoleEscalationError'
  }
}

export class InvalidInvitationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidInvitationError'
  }
}

/** الأدوار التي يجوز لهذا السياق منحها — أي دور صلاحياته جزء من صلاحياته. */
export function assignableRoles(ctx: TenantContext): RoleKey[] {
  const out: RoleKey[] = []

  for (const [key, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const roleKey = key as RoleKey
    if (permissions.every((p) => ctx.permissions.has(p))) out.push(roleKey)
  }

  return out
}

export interface InvitationRow {
  id: string
  email: string
  roleKey: RoleKey
  roleLabel: string
  status: InvitationStatus
  expiresAt: Date
  createdAt: Date
  invitedByName: string
  isExpired: boolean
}

export async function listInvitations(
  ctx: TenantContext,
): Promise<InvitationRow[]> {
  authorize(ctx, 'user:view')

  const rows = await prisma.invitation.findMany({
    where: { organizationId: ctx.organizationId },
    select: {
      id: true,
      email: true,
      roleKey: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      invitedBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const now = new Date()

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    roleKey: r.roleKey,
    roleLabel: ROLE_LABELS[r.roleKey],
    status: r.status,
    expiresAt: r.expiresAt,
    createdAt: r.createdAt,
    invitedByName: r.invitedBy.name,
    isExpired: r.status === InvitationStatus.PENDING && r.expiresAt < now,
  }))
}

export interface CreateInvitationInput {
  email: string
  roleKey: RoleKey
  branchIds?: string[]
  /** أصل التطبيق — يُبنى على الخادم، لا يُقبل من المتصفح. */
  origin: string
}

export interface CreateInvitationResult {
  id: string
  emailDelivered: boolean
  /** يُعاد فقط حين لا يوجد مزوّد بريد، ليُنسخ يدويًا. */
  manualLink: string | null
}

export async function createInvitation(
  ctx: TenantContext,
  input: CreateInvitationInput,
): Promise<CreateInvitationResult> {
  authorize(ctx, 'user:create')

  const email = input.email.trim().toLowerCase()

  if (!assignableRoles(ctx).includes(input.roleKey)) {
    throw new RoleEscalationError(input.roleKey)
  }

  // الفروع المطلوبة يجب أن تكون فروع هذه المنشأة، وداخل نطاق الداعي إن كان مقيّدًا
  const branchIds = input.branchIds ?? []
  if (branchIds.length > 0) {
    const allowed = await prisma.branch.findMany({
      where: {
        id: { in: branchIds },
        organizationId: ctx.organizationId,
        deletedAt: null,
        // مدير الفرع لا يمنح وصولًا إلى فرع لا يملكه هو. شرط مستقل عن الأول
        // عمدًا: دمجهما في مفتاح `id` واحد يجعل الثاني يمحو الأول.
        ...(ctx.branchScope === null
          ? {}
          : { AND: [{ id: { in: [...ctx.branchScope] } }] }),
      },
      select: { id: true },
    })
    if (allowed.length !== branchIds.length) {
      throw new InvalidInvitationError('أحد الفروع المختارة غير متاح لك.')
    }
  }

  const existingMember = await prisma.membership.findFirst({
    where: { organizationId: ctx.organizationId, user: { email } },
    select: { id: true },
  })
  if (existingMember) {
    throw new InvalidInvitationError('هذا البريد عضو في المنشأة بالفعل.')
  }

  const [memberCount, pendingCount, subscription] = await Promise.all([
    prisma.membership.count({ where: { organizationId: ctx.organizationId } }),
    prisma.invitation.count({
      where: {
        organizationId: ctx.organizationId,
        status: InvitationStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
    }),
    prisma.subscription.findUnique({
      where: { organizationId: ctx.organizationId },
      select: { plan: { select: { maxUsers: true } } },
    }),
  ])

  const maxUsers = subscription?.plan.maxUsers ?? 0
  if (maxUsers > 0 && memberCount + pendingCount >= maxUsers) {
    throw new InviteLimitError(
      `باقتك تسمح بـ${maxUsers} مستخدمًا، ولديك ${memberCount} عضوًا و${pendingCount} دعوة معلّقة. ارفع الباقة أو ألغِ دعوة.`,
    )
  }

  // دعوة معلّقة سابقة لنفس البريد تُلغى: رمز واحد صالح فقط لكل عنوان
  await prisma.invitation.updateMany({
    where: {
      organizationId: ctx.organizationId,
      email,
      status: InvitationStatus.PENDING,
    },
    data: { status: InvitationStatus.REVOKED },
  })

  const rawToken = randomBytes(TOKEN_BYTES).toString('base64url')
  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000)

  const invitation = await prisma.invitation.create({
    data: {
      organizationId: ctx.organizationId,
      email,
      token: hashToken(rawToken),
      roleKey: input.roleKey,
      branchIds,
      expiresAt,
      invitedById: ctx.userId,
    },
    select: { id: true },
  })

  await recordAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'invitation.create',
    entityType: 'Invitation',
    entityId: invitation.id,
    // البريد والدور فقط. الرمز لا يدخل سجل التدقيق أبدًا.
    after: { email, roleKey: input.roleKey },
  })

  const acceptUrl = `${input.origin}/invite/${rawToken}`
  const provider = resolveEmailProvider()

  let emailDelivered = false
  if (provider.isLive) {
    try {
      const result = await provider.send(
        invitationEmail({
          to: email,
          organizationName: ctx.organizationName,
          inviterName: ctx.userName,
          roleLabel: ROLE_LABELS[input.roleKey],
          acceptUrl,
          expiresAt,
        }),
      )
      emailDelivered = result.delivered
    } catch {
      emailDelivered = false
    }
  }

  return {
    id: invitation.id,
    emailDelivered,
    // بلا بريد فعلي نعيد الرابط للداعي — أفضل من دعوة لا تصل أحدًا.
    // ومع بريد فعلي لا نعيده: الرابط سرّ لا يخص الداعي.
    manualLink: emailDelivered ? null : acceptUrl,
  }
}

export async function revokeInvitation(
  ctx: TenantContext,
  invitationId: string,
): Promise<void> {
  authorize(ctx, 'user:delete')

  // مقيّد بالمنشأة: دعوة منشأة أخرى ببساطة غير موجودة من منظور هذا السياق
  const invitation = await prisma.invitation.findFirst({
    where: {
      id: invitationId,
      organizationId: ctx.organizationId,
      status: InvitationStatus.PENDING,
    },
    select: { id: true, email: true },
  })

  if (!invitation) {
    throw new InvalidInvitationError('الدعوة غير موجودة أو لم تعد معلّقة.')
  }

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status: InvitationStatus.REVOKED },
  })

  await recordAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'invitation.revoke',
    entityType: 'Invitation',
    entityId: invitation.id,
    before: { email: invitation.email },
  })
}

export interface InvitationPreview {
  organizationName: string
  roleLabel: string
  email: string
  inviterName: string
  expiresAt: Date
}

/**
 * قراءة دعوة برمزها الخام. تُستدعى من صفحة عامة، فلا سياق منشأة هنا — الرمز
 * نفسه هو الإثبات، ولهذا يجب أن يكون طويلًا وعشوائيًا ومحدود الأجل.
 */
export async function readInvitation(
  rawToken: string,
): Promise<InvitationPreview | null> {
  const invitation = await prisma.invitation.findUnique({
    where: { token: hashToken(rawToken) },
    select: {
      email: true,
      roleKey: true,
      status: true,
      expiresAt: true,
      organization: { select: { name: true } },
      invitedBy: { select: { name: true } },
    },
  })

  if (!invitation) return null
  if (invitation.status !== InvitationStatus.PENDING) return null
  if (invitation.expiresAt < new Date()) return null

  return {
    organizationName: invitation.organization.name,
    roleLabel: ROLE_LABELS[invitation.roleKey],
    email: invitation.email,
    inviterName: invitation.invitedBy.name,
    expiresAt: invitation.expiresAt,
  }
}

/**
 * قبول الدعوة لمستخدم موجود. كل شيء داخل معاملة واحدة: إما أن يصير عضوًا
 * وتُغلق الدعوة معًا، أو لا يحدث شيء. دعوة مقبولة بلا عضوية تعني رمزًا محروقًا
 * ومستخدمًا خارج المنشأة.
 */
export async function acceptInvitation(
  rawToken: string,
  userId: string,
  /** جلسة المستخدم — تُضبط عليها المنشأة الجديدة كنشطة داخل المعاملة نفسها. */
  sessionId?: string,
): Promise<{ organizationId: string }> {
  const tokenHash = hashToken(rawToken)

  // تعليم الدعوة المنتهية يحدث خارج المعاملة عمدًا. لو كتبناه داخلها ثم رمينا،
  // لتراجعت الكتابة مع المعاملة وبقيت الدعوة PENDING إلى الأبد.
  await prisma.invitation.updateMany({
    where: {
      token: tokenHash,
      status: InvitationStatus.PENDING,
      expiresAt: { lt: new Date() },
    },
    data: { status: InvitationStatus.EXPIRED },
  })

  return prisma.$transaction(async (tx) => {
    const invitation = await tx.invitation.findUnique({
      where: { token: tokenHash },
      select: {
        id: true,
        email: true,
        roleKey: true,
        branchIds: true,
        status: true,
        expiresAt: true,
        organizationId: true,
      },
    })

    if (!invitation) throw new InvalidInvitationError('الدعوة غير صالحة.')
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new InvalidInvitationError('استُخدمت هذه الدعوة أو أُلغيت.')
    }
    // فحص ثانٍ داخل المعاملة يحمي من سباق: قد تنتهي الصلاحية بين الخطوتين
    if (invitation.expiresAt < new Date()) {
      throw new InvalidInvitationError('انتهت صلاحية الدعوة. اطلب دعوة جديدة.')
    }

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })

    // البريد يجب أن يطابق: وإلا صار الرمز المسرّب تذكرة دخول لأي حساب
    if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new InvalidInvitationError(
        'هذه الدعوة صادرة لبريد آخر. سجّل الدخول بالبريد المدعو.',
      )
    }

    const role = await tx.role.findFirstOrThrow({
      where: {
        organizationId: invitation.organizationId,
        key: invitation.roleKey,
      },
      select: { id: true },
    })

    const membership = await tx.membership.create({
      data: {
        userId,
        organizationId: invitation.organizationId,
        roleId: role.id,
      },
      select: { id: true },
    })

    if (invitation.branchIds.length > 0) {
      await tx.membershipBranch.createMany({
        data: invitation.branchIds.map((branchId) => ({
          membershipId: membership.id,
          branchId,
        })),
      })
    }

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() },
    })

    // من له عضوية سابقة سيبقى داخل منشأته القديمة بعد القبول ما لم نحوّل
    // الجلسة. مقيّد بمالك الجلسة: لا يُحوَّل أحد إلى منشأة عبر معرّف جلسة غيره.
    if (sessionId) {
      await tx.session.updateMany({
        where: { id: sessionId, userId },
        data: { activeOrganizationId: invitation.organizationId },
      })
    }

    return { organizationId: invitation.organizationId }
  })
}

export { ForbiddenError }
