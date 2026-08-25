import 'server-only'
import { RoleKey, type Prisma } from '@prisma/client'
import { prisma } from '../db'
import { DEFAULT_ROLE_PERMISSIONS, ROLE_LABELS, type Permission } from '../rbac'
import { recordAudit } from '../audit'

/**
 * إنشاء منشأة جديدة لمستخدم مسجَّل حديثًا.
 *
 * العملية كلها داخل معاملة واحدة: إما أن تُنشأ المنشأة بأدوارها وعضويتها
 * واشتراكها التجريبي كاملة، أو لا يُكتب شيء. منشأة بلا أدوار تعني مستخدمًا
 * محبوسًا خارج بياناته.
 */

function slugify(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return base || 'org'
}

async function uniqueSlug(desired: string): Promise<string> {
  const base = slugify(desired)
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`
    const taken = await prisma.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
    if (!taken) return candidate
  }
  // احتياط نهائي — لاحق زمني يضمن التفرّد
  return `${base}-${Date.now().toString(36)}`
}

export interface CreateOrganizationResult {
  organizationId: string
  slug: string
}

export async function createOrganizationForUser(params: {
  userId: string
  organizationName: string
}): Promise<CreateOrganizationResult> {
  const { userId, organizationName } = params

  // مستخدم له عضوية فعّالة أصلًا لا يُنشئ منشأة ثانية من هذا المسار
  const existing = await prisma.membership.findFirst({
    where: { userId, status: 'ACTIVE' },
    select: { organizationId: true, organization: { select: { slug: true } } },
  })
  if (existing) {
    return {
      organizationId: existing.organizationId,
      slug: existing.organization.slug,
    }
  }

  const slug = await uniqueSlug(organizationName)

  const [permissions, trialPlan] = await Promise.all([
    prisma.permission.findMany({ select: { id: true, key: true } }),
    prisma.plan.findUnique({ where: { tier: 'TRIAL' }, select: { id: true } }),
  ])

  if (permissions.length === 0) {
    throw new Error(
      'جدول الصلاحيات فارغ. شغّل `npm run db:seed` قبل إنشاء منشآت.',
    )
  }

  const permByKey = new Map(permissions.map((p) => [p.key, p.id]))

  const trialEnds = new Date()
  trialEnds.setDate(trialEnds.getDate() + 14)

  const organizationId = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const org = await tx.organization.create({
        data: {
          name: organizationName,
          slug,
          status: 'TRIAL',
          onboardingStep: 1,
        },
        select: { id: true },
      })

      // نسخ أدوار النظام إلى المنشأة لتصبح قابلة للتخصيص لاحقًا
      let ownerRoleId = ''
      for (const key of Object.keys(DEFAULT_ROLE_PERMISSIONS) as RoleKey[]) {
        const role = await tx.role.create({
          data: {
            organizationId: org.id,
            key,
            name: ROLE_LABELS[key],
            isSystem: true,
          },
          select: { id: true },
        })
        if (key === RoleKey.OWNER) ownerRoleId = role.id

        const permissionIds = DEFAULT_ROLE_PERMISSIONS[key]
          .map((pk: Permission) => permByKey.get(pk))
          .filter((id): id is string => Boolean(id))

        if (permissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({
              roleId: role.id,
              permissionId,
              granted: true,
            })),
            skipDuplicates: true,
          })
        }
      }

      await tx.membership.create({
        data: {
          userId,
          organizationId: org.id,
          roleId: ownerRoleId,
          status: 'ACTIVE',
          title: ROLE_LABELS[RoleKey.OWNER],
        },
      })

      if (trialPlan) {
        await tx.subscription.create({
          data: {
            organizationId: org.id,
            planId: trialPlan.id,
            status: 'TRIALING',
            trialEndsAt: trialEnds,
            currentPeriodEnd: trialEnds,
          },
        })
      }

      return org.id
    },
    { timeout: 20_000 },
  )

  await recordAudit({
    organizationId,
    actorId: userId,
    action: 'organization.created',
    entityType: 'Organization',
    entityId: organizationId,
    after: { name: organizationName, slug },
  })

  return { organizationId, slug }
}

/** خطوات التهيئة — التقدّم يُحفظ فيستأنف المستخدم من حيث توقّف. */
export const ONBOARDING_STEPS = [
  { key: 'account', label: 'إنشاء الحساب' },
  { key: 'organization', label: 'بيانات المنشأة' },
  { key: 'business_type', label: 'نوع النشاط' },
  { key: 'brand', label: 'العلامة التجارية' },
  { key: 'branch', label: 'أول فرع' },
  { key: 'plan', label: 'اختيار الباقة' },
  { key: 'team', label: 'دعوة الفريق' },
  { key: 'templates', label: 'قوالب التشغيل' },
] as const

export function onboardingProgress(step: number): number {
  const total = ONBOARDING_STEPS.length
  return Math.round((Math.min(Math.max(step, 0), total) / total) * 100)
}
