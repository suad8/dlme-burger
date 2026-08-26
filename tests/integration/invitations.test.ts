import { describe, it, expect, afterAll, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'
import { prisma, contextFor, contextWithRole, DEMO } from '../helpers/db'
import {
  createInvitation,
  acceptInvitation,
  readInvitation,
  revokeInvitation,
  listInvitations,
  assignableRoles,
  RoleEscalationError,
  InvalidInvitationError,
} from '@/server/services/invitations'
import { ForbiddenError } from '@/server/rbac'

const ORIGIN = 'https://app.test.sa'

function tokenFromLink(link: string): string {
  const parts = link.split('/')
  return parts[parts.length - 1]!
}

/** يبقي القاعدة نظيفة بين الاختبارات دون لمس بيانات الزرع الأخرى. */
async function clearInvitations() {
  await prisma.invitation.deleteMany({
    where: { email: { endsWith: '@invite-test.sa' } },
  })
}

beforeEach(clearInvitations)

afterAll(async () => {
  await clearInvitations()
  await prisma.$disconnect()
})

describe('الدعوات — منع ترقية الصلاحيات', () => {
  it('المالك يستطيع منح أي دور صلاحياته جزء من صلاحياته', async () => {
    const owner = await contextFor(DEMO.ownerA)
    const roles = assignableRoles(owner)

    expect(roles).toContain('VIEWER')
    expect(roles).toContain('BRANCH_MANAGER')
  })

  it('المُطّلع لا يستطيع منح أي دور أقوى منه', async () => {
    const base = await contextFor(DEMO.ownerA)
    const viewer = contextWithRole(base, 'VIEWER')

    const roles = assignableRoles(viewer)
    expect(roles).not.toContain('OWNER')
    expect(roles).not.toContain('OPS_MANAGER')
  })

  it('محاولة دعوة بدور أقوى تُرفض حتى لو ملك الداعي user:create', async () => {
    const base = await contextFor(DEMO.ownerA)
    // دور مركّب: يملك إنشاء المستخدمين لكن ليس صلاحيات المالك
    const limited = {
      ...contextWithRole(base, 'BRANCH_MANAGER'),
      permissions: new Set([
        ...contextWithRole(base, 'BRANCH_MANAGER').permissions,
        'user:create' as const,
      ]),
    }

    await expect(
      createInvitation(limited, {
        email: 'escalate@invite-test.sa',
        roleKey: 'OWNER',
        origin: ORIGIN,
      }),
    ).rejects.toBeInstanceOf(RoleEscalationError)

    const created = await prisma.invitation.count({
      where: { email: 'escalate@invite-test.sa' },
    })
    expect(created).toBe(0)
  })

  it('المُطّلع لا يستطيع الدعوة أصلًا', async () => {
    const base = await contextFor(DEMO.ownerA)
    const viewer = contextWithRole(base, 'VIEWER')

    await expect(
      createInvitation(viewer, {
        email: 'nope@invite-test.sa',
        roleKey: 'VIEWER',
        origin: ORIGIN,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })
})

describe('الدعوات — الرمز', () => {
  it('يُخزَّن مبصومًا لا خامًا', async () => {
    const owner = await contextFor(DEMO.ownerA)

    const result = await createInvitation(owner, {
      email: 'hash@invite-test.sa',
      roleKey: 'VIEWER',
      origin: ORIGIN,
    })

    expect(result.manualLink).not.toBeNull()
    const raw = tokenFromLink(result.manualLink!)

    const row = await prisma.invitation.findFirstOrThrow({
      where: { email: 'hash@invite-test.sa' },
      select: { token: true },
    })

    expect(row.token).not.toBe(raw)
    expect(row.token).toBe(createHash('sha256').update(raw).digest('hex'))
  })

  it('قراءة الدعوة برمزها الصحيح تعمل، وبرمز مزوّر لا', async () => {
    const owner = await contextFor(DEMO.ownerA)
    const result = await createInvitation(owner, {
      email: 'read@invite-test.sa',
      roleKey: 'VIEWER',
      origin: ORIGIN,
    })

    const raw = tokenFromLink(result.manualLink!)
    const preview = await readInvitation(raw)

    expect(preview).not.toBeNull()
    expect(preview!.email).toBe('read@invite-test.sa')
    expect(preview!.organizationName).toBe(owner.organizationName)

    expect(await readInvitation('x'.repeat(43))).toBeNull()
  })

  it('الدعوة الملغاة لا تُقرأ ولا تُقبل', async () => {
    const owner = await contextFor(DEMO.ownerA)
    const result = await createInvitation(owner, {
      email: 'revoked@invite-test.sa',
      roleKey: 'VIEWER',
      origin: ORIGIN,
    })
    const raw = tokenFromLink(result.manualLink!)

    await revokeInvitation(owner, result.id)

    expect(await readInvitation(raw)).toBeNull()
    await expect(
      acceptInvitation(raw, owner.userId),
    ).rejects.toBeInstanceOf(InvalidInvitationError)
  })

  it('الدعوة المنتهية تُرفض وتُعلَّم منتهية', async () => {
    const owner = await contextFor(DEMO.ownerA)
    const result = await createInvitation(owner, {
      email: 'expired@invite-test.sa',
      roleKey: 'VIEWER',
      origin: ORIGIN,
    })
    const raw = tokenFromLink(result.manualLink!)

    await prisma.invitation.update({
      where: { id: result.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })

    expect(await readInvitation(raw)).toBeNull()
    await expect(
      acceptInvitation(raw, owner.userId),
    ).rejects.toBeInstanceOf(InvalidInvitationError)

    const after = await prisma.invitation.findUniqueOrThrow({
      where: { id: result.id },
      select: { status: true },
    })
    expect(after.status).toBe('EXPIRED')
  })

  it('رمز مسرّب لا ينفع لحساب ببريد مختلف', async () => {
    const owner = await contextFor(DEMO.ownerA)
    const result = await createInvitation(owner, {
      email: 'target@invite-test.sa',
      roleKey: 'VIEWER',
      origin: ORIGIN,
    })
    const raw = tokenFromLink(result.manualLink!)

    // مالك المنشأة الأخرى يحاول استعمال الرمز لنفسه
    const attacker = await contextFor(DEMO.ownerB)

    await expect(
      acceptInvitation(raw, attacker.userId),
    ).rejects.toBeInstanceOf(InvalidInvitationError)

    const membership = await prisma.membership.findFirst({
      where: { userId: attacker.userId, organizationId: owner.organizationId },
    })
    expect(membership).toBeNull()
  })
})

describe('الدعوات — العزل بين المنشآت', () => {
  it('دعوة منشأة أخرى لا تظهر في القائمة ولا تُلغى', async () => {
    const a = await contextFor(DEMO.ownerA)
    const b = await contextFor(DEMO.ownerB)

    const madeByB = await createInvitation(b, {
      email: 'cross@invite-test.sa',
      roleKey: 'VIEWER',
      origin: ORIGIN,
    })

    const listOfA = await listInvitations(a)
    expect(listOfA.some((i) => i.id === madeByB.id)).toBe(false)

    await expect(
      revokeInvitation(a, madeByB.id),
    ).rejects.toBeInstanceOf(InvalidInvitationError)

    const still = await prisma.invitation.findUniqueOrThrow({
      where: { id: madeByB.id },
      select: { status: true },
    })
    expect(still.status).toBe('PENDING')
  })

  it('دعوة جديدة لنفس البريد تُلغي السابقة — رمز صالح واحد فقط', async () => {
    const owner = await contextFor(DEMO.ownerA)

    const first = await createInvitation(owner, {
      email: 'reissue@invite-test.sa',
      roleKey: 'VIEWER',
      origin: ORIGIN,
    })
    const firstToken = tokenFromLink(first.manualLink!)

    const second = await createInvitation(owner, {
      email: 'reissue@invite-test.sa',
      roleKey: 'VIEWER',
      origin: ORIGIN,
    })

    expect(await readInvitation(firstToken)).toBeNull()
    expect(await readInvitation(tokenFromLink(second.manualLink!))).not.toBeNull()
  })

  it('لا يمكن دعوة عضو موجود مسبقًا', async () => {
    const owner = await contextFor(DEMO.ownerA)

    await expect(
      createInvitation(owner, {
        email: DEMO.viewerA,
        roleKey: 'VIEWER',
        origin: ORIGIN,
      }),
    ).rejects.toBeInstanceOf(InvalidInvitationError)
  })
})
