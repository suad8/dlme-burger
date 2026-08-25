import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { RoleKey } from '@prisma/client'
import { auth } from './auth'
import { prisma } from './db'
import type { Permission } from './rbac'

/**
 * قلب عزل المستأجرين.
 *
 * ⚠️ قاعدة لا تُكسر: organizationId يُشتق من الجلسة المخزّنة في قاعدة
 * البيانات فقط. لا يوجد مسار في هذا التطبيق يقبل organizationId كمُدخل من
 * المتصفح. أي دالة خدمة تستقبل TenantContext كأول معامل وتقيّد استعلاماتها به.
 */

export interface TenantContext {
  userId: string
  userName: string
  userEmail: string
  isSuperAdmin: boolean
  organizationId: string
  organizationName: string
  organizationSlug: string
  membershipId: string
  role: RoleKey
  permissions: ReadonlySet<Permission>
  /** null = وصول لكل فروع المنشأة. مصفوفة = مقيّد بهذه الفروع فقط. */
  branchScope: readonly string[] | null
  onboardingCompleted: boolean
}

export class UnauthenticatedError extends Error {
  override readonly name = 'UnauthenticatedError'
}

export class NoOrganizationError extends Error {
  override readonly name = 'NoOrganizationError'
}

/** الجلسة الخام. `cache` يمنع تكرار الاستعلام داخل نفس الطلب. */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() })
})

/**
 * يبني سياق المستأجر من الجلسة. يعيد null إن لم يكن هناك جلسة أو عضوية.
 * لا يعيد التوجيه — استخدم requireTenant() في الصفحات.
 */
export const getTenantContext = cache(
  async (): Promise<TenantContext | null> => {
    const session = await getSession()
    if (!session?.user) return null

    const userId = session.user.id
    const activeOrgId = (session.session as { activeOrganizationId?: string | null })
      .activeOrganizationId

    // العضوية النشطة: المنشأة المحددة في الجلسة، وإلا أول عضوية فعّالة.
    const membership = await prisma.membership.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        organization: { deletedAt: null },
        ...(activeOrgId ? { organizationId: activeOrgId } : {}),
      },
      select: {
        id: true,
        organizationId: true,
        organization: {
          select: {
            name: true,
            slug: true,
            onboardingCompleted: true,
          },
        },
        role: {
          select: {
            key: true,
            permissions: {
              where: { granted: true },
              select: { permission: { select: { key: true } } },
            },
          },
        },
        branches: { select: { branchId: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    if (!membership) return null

    const permissions = new Set<Permission>(
      membership.role.permissions.map(
        (rp) => rp.permission.key as Permission,
      ),
    )

    const scoped = membership.branches.map((b) => b.branchId)

    return {
      userId,
      userName: session.user.name,
      userEmail: session.user.email,
      isSuperAdmin:
        (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true,
      organizationId: membership.organizationId,
      organizationName: membership.organization.name,
      organizationSlug: membership.organization.slug,
      membershipId: membership.id,
      role: membership.role.key,
      permissions,
      branchScope: scoped.length > 0 ? scoped : null,
      onboardingCompleted: membership.organization.onboardingCompleted,
    }
  },
)

/** يفرض وجود جلسة وعضوية. يعيد التوجيه إن لم توجد. */
export async function requireTenant(): Promise<TenantContext> {
  const ctx = await getTenantContext()
  if (!ctx) {
    const session = await getSession()
    redirect(session?.user ? '/onboarding' : '/login')
  }
  return ctx
}

/** يفرض صلاحية super admin — لمسارات لوحة النظام. */
export async function requireSuperAdmin(): Promise<TenantContext> {
  const ctx = await requireTenant()
  if (!ctx.isSuperAdmin) {
    // 404 لا 403: عدم كشف وجود المسار لغير المخوّلين
    const { notFound } = await import('next/navigation')
    notFound()
  }
  return ctx
}

/**
 * قيد الفرع المطبّق على كل استعلام تشغيلي، فوق قيد المنشأة.
 * يعيد `{}` لمن له وصول كامل، أو `{ branchId: { in: [...] } }` للمقيَّدين.
 */
export function branchFilter(
  ctx: TenantContext,
): Record<string, unknown> {
  if (ctx.branchScope === null) return {}
  return { branchId: { in: [...ctx.branchScope] } }
}

/** يتحقق أن فرعًا بعينه ضمن نطاق المستخدم. */
export function assertBranchInScope(
  ctx: TenantContext,
  branchId: string,
): void {
  if (ctx.branchScope !== null && !ctx.branchScope.includes(branchId)) {
    throw new Error('الفرع خارج نطاق صلاحياتك.')
  }
}
