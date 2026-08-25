import 'server-only'
import type { BranchStatus, Prisma } from '@prisma/client'
import { prisma } from '../db'
import { authorize } from '../rbac'
import { assertBranchInScope, type TenantContext } from '../tenant'
import { recordAudit } from '../audit'
import type { BranchInput } from '@/lib/validation'

export class PlanLimitError extends Error {
  override readonly name = 'PlanLimitError'
}

export class DuplicateCodeError extends Error {
  override readonly name = 'DuplicateCodeError'
}

export interface BranchListItem {
  id: string
  name: string
  code: string
  status: BranchStatus
  city: string | null
  district: string | null
  phone: string | null
  brandName: string
  managerName: string | null
  openActions: number
}

export async function listBranches(
  ctx: TenantContext,
): Promise<BranchListItem[]> {
  authorize(ctx, 'branch:view')

  const branches = await prisma.branch.findMany({
    where: {
      organizationId: ctx.organizationId,
      deletedAt: null,
      ...(ctx.branchScope ? { id: { in: [...ctx.branchScope] } } : {}),
    },
    // select صريح — لا نجلب أعمدة لا تُعرض
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      city: true,
      district: true,
      phone: true,
      brand: { select: { name: true } },
      manager: { select: { fullName: true } },
    },
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
  })

  if (branches.length === 0) return []

  // تجميعة واحدة بدل استعلام لكل فرع
  const counts = await prisma.correctiveAction.groupBy({
    by: ['branchId'],
    where: {
      organizationId: ctx.organizationId,
      branchId: { in: branches.map((b) => b.id) },
      status: { in: ['NEW', 'IN_PROGRESS', 'PENDING_REVIEW', 'OVERDUE'] },
    },
    _count: { _all: true },
  })
  const countMap = new Map(counts.map((c) => [c.branchId, c._count._all]))

  return branches.map((b) => ({
    id: b.id,
    name: b.name,
    code: b.code,
    status: b.status,
    city: b.city,
    district: b.district,
    phone: b.phone,
    brandName: b.brand.name,
    managerName: b.manager?.fullName ?? null,
    openActions: countMap.get(b.id) ?? 0,
  }))
}

/** يقرأ فرعًا واحدًا. يعيد null لأي معرّف خارج المنشأة — لا يكشف الوجود. */
export async function getBranch(ctx: TenantContext, branchId: string) {
  authorize(ctx, 'branch:view')

  const branch = await prisma.branch.findFirst({
    where: {
      id: branchId,
      organizationId: ctx.organizationId,
      deletedAt: null,
      ...(ctx.branchScope ? { id: { in: [...ctx.branchScope] } } : {}),
    },
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      city: true,
      district: true,
      address: true,
      phone: true,
      email: true,
      openingHours: true,
      settings: true,
      version: true,
      brand: { select: { id: true, name: true, settings: true } },
    },
  })

  return branch
}

/** حدود الباقة تُفحص على الخادم، لا في الواجهة. */
async function assertBranchQuota(ctx: TenantContext): Promise<void> {
  const [subscription, current] = await Promise.all([
    prisma.subscription.findUnique({
      where: { organizationId: ctx.organizationId },
      select: { plan: { select: { maxBranches: true, name: true } } },
    }),
    prisma.branch.count({
      where: { organizationId: ctx.organizationId, deletedAt: null },
    }),
  ])

  if (!subscription) return

  if (current >= subscription.plan.maxBranches) {
    throw new PlanLimitError(
      `باقة «${subscription.plan.name}» تسمح بـ${subscription.plan.maxBranches} فرعًا. رقِّ الباقة لإضافة المزيد.`,
    )
  }
}

export async function createBranch(
  ctx: TenantContext,
  input: BranchInput,
): Promise<string> {
  authorize(ctx, 'branch:create')
  await assertBranchQuota(ctx)

  // العلامة التجارية يجب أن تخص نفس المنشأة — منع الربط عبر المستأجرين
  const brand = await prisma.brand.findFirst({
    where: {
      id: input.brandId,
      organizationId: ctx.organizationId,
      deletedAt: null,
    },
    select: { id: true },
  })
  if (!brand) {
    throw new Error('العلامة التجارية غير موجودة ضمن منشأتك.')
  }

  try {
    const branch = await prisma.branch.create({
      data: {
        organizationId: ctx.organizationId,
        brandId: brand.id,
        name: input.name,
        code: input.code,
        status: input.status,
        city: input.city || null,
        district: input.district || null,
        phone: input.phone || null,
      },
      select: { id: true, name: true, code: true },
    })

    await recordAudit({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'branch.created',
      entityType: 'Branch',
      entityId: branch.id,
      after: branch,
    })

    return branch.id
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      throw new DuplicateCodeError(`رمز الفرع «${input.code}» مستخدم بالفعل.`)
    }
    throw error
  }
}

export async function updateBranch(
  ctx: TenantContext,
  branchId: string,
  input: BranchInput,
  expectedVersion: number,
): Promise<void> {
  authorize(ctx, 'branch:update')
  assertBranchInScope(ctx, branchId)

  const before = await prisma.branch.findFirst({
    where: { id: branchId, organizationId: ctx.organizationId, deletedAt: null },
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      city: true,
      district: true,
      phone: true,
      version: true,
    },
  })
  if (!before) throw new Error('الفرع غير موجود.')

  // تزامن متفائل: تعديل بُني على نسخة قديمة يُرفض بدل أن يدهس تغيير غيرك
  const result = await prisma.branch.updateMany({
    where: {
      id: branchId,
      organizationId: ctx.organizationId,
      version: expectedVersion,
    },
    data: {
      name: input.name,
      code: input.code,
      status: input.status,
      city: input.city || null,
      district: input.district || null,
      phone: input.phone || null,
      version: { increment: 1 },
    },
  })

  if (result.count === 0) {
    throw new Error(
      'تم تعديل هذا الفرع من جهة أخرى. حدّث الصفحة وأعد المحاولة.',
    )
  }

  await recordAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'branch.updated',
    entityType: 'Branch',
    entityId: branchId,
    before,
    after: input,
  })
}

/** حذف ناعم — البيانات التاريخية (الزيارات، الإجراءات) تبقى مرتبطة. */
export async function softDeleteBranch(
  ctx: TenantContext,
  branchId: string,
): Promise<void> {
  authorize(ctx, 'branch:delete')

  const result = await prisma.branch.updateMany({
    where: {
      id: branchId,
      organizationId: ctx.organizationId,
      deletedAt: null,
    },
    data: { deletedAt: new Date(), status: 'CLOSED' },
  })

  if (result.count === 0) throw new Error('الفرع غير موجود.')

  await recordAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'branch.deleted',
    entityType: 'Branch',
    entityId: branchId,
  })
}

export async function listBrands(ctx: TenantContext) {
  authorize(ctx, 'branch:view')
  return prisma.brand.findMany({
    where: { organizationId: ctx.organizationId, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
}

/** الإعدادات الفعلية للفرع: ما تخصّصه العلامة يُورَّث ما لم يتجاوزه الفرع. */
export function resolveBranchSettings(
  brandSettings: Prisma.JsonValue,
  branchSettings: Prisma.JsonValue,
): Record<string, unknown> {
  const brand =
    brandSettings && typeof brandSettings === 'object' && !Array.isArray(brandSettings)
      ? (brandSettings as Record<string, unknown>)
      : {}
  const branch =
    branchSettings && typeof branchSettings === 'object' && !Array.isArray(branchSettings)
      ? (branchSettings as Record<string, unknown>)
      : {}
  return { ...brand, ...branch }
}
