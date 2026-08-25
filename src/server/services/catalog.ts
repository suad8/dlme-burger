import 'server-only'
import { prisma } from '../db'

/**
 * بيانات عامة غير مرتبطة بمستأجر: الباقات وكتالوج الخدمات.
 *
 * هذه الدوال لا تستقبل TenantContext لأن ما تقرأه ليس ملكًا لأي منشأة. تعيش
 * هنا لا في الصفحات، حتى يبقى الوصول إلى Prisma محصورًا في طبقة الخادم.
 */

export async function listPublicPlans() {
  return prisma.plan.findMany({
    where: { isPublic: true },
    select: {
      id: true,
      tier: true,
      name: true,
      description: true,
      monthlyPrice: true,
      yearlyPrice: true,
      maxBranches: true,
      maxUsers: true,
      maxBrands: true,
      features: {
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { sortOrder: 'asc' },
  })
}

export async function listActiveServices() {
  return prisma.serviceCatalog.findMany({
    where: { isActive: true },
    select: {
      id: true,
      slug: true,
      name: true,
      summary: true,
      category: true,
      basePrice: true,
      priceNote: true,
      durationDays: true,
    },
    orderBy: { sortOrder: 'asc' },
  })
}

/** ملخّص تقدّم التهيئة لمنشأة. يُستدعى بمعرّف مشتق من الجلسة فقط. */
export async function getOnboardingSnapshot(organizationId: string) {
  return prisma.organization.findFirstOrThrow({
    where: { id: organizationId },
    select: {
      onboardingStep: true,
      _count: { select: { brands: true, branches: true, memberships: true } },
    },
  })
}

/** يبحث عن مستخدم بالبريد. يُستخدم في مسار التسجيل قبل وجود جلسة. */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })
  return user?.id ?? null
}
