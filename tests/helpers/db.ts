import { PrismaClient, type RoleKey } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { DEFAULT_ROLE_PERMISSIONS } from '@/server/rbac'
import type { TenantContext } from '@/server/tenant'
import type { Permission } from '@/server/rbac'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
export const prisma = new PrismaClient({ adapter })

/**
 * يبني TenantContext حقيقيًا من بيانات قاعدة البيانات لمستخدم مزروع.
 *
 * لا يزيّف الصلاحيات: يقرأها من جدول role_permissions كما يفعل الكود الحي،
 * فما يثبته الاختبار ينطبق على السلوك الفعلي.
 */
export async function contextFor(email: string): Promise<TenantContext> {
  const membership = await prisma.membership.findFirstOrThrow({
    where: { user: { email }, status: 'ACTIVE' },
    select: {
      id: true,
      organizationId: true,
      user: { select: { id: true, name: true, email: true, isSuperAdmin: true } },
      organization: {
        select: { name: true, slug: true, onboardingCompleted: true },
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
  })

  const scoped = membership.branches.map((b) => b.branchId)

  return {
    userId: membership.user.id,
    userName: membership.user.name,
    userEmail: membership.user.email,
    isSuperAdmin: membership.user.isSuperAdmin,
    organizationId: membership.organizationId,
    organizationName: membership.organization.name,
    organizationSlug: membership.organization.slug,
    membershipId: membership.id,
    role: membership.role.key,
    permissions: new Set<Permission>(
      membership.role.permissions.map((p) => p.permission.key as Permission),
    ),
    branchScope: scoped.length > 0 ? scoped : null,
    onboardingCompleted: membership.organization.onboardingCompleted,
  }
}

/** سياق اصطناعي بدور محدد — لاختبار RBAC دون الاعتماد على الزرع. */
export function contextWithRole(
  base: TenantContext,
  role: RoleKey,
): TenantContext {
  return {
    ...base,
    role,
    permissions: new Set<Permission>(DEFAULT_ROLE_PERMISSIONS[role]),
  }
}

export const DEMO = {
  orgA: 'mathaq-riyadh',
  orgB: 'rukn-sharqiya',
  ownerA: 'owner@demo.itqan.sa',
  ownerB: 'owner@rukn.itqan.sa',
  branchManagerA: 'branch@demo.itqan.sa',
  viewerA: 'viewer@demo.itqan.sa',
  accountantA: 'accountant@demo.itqan.sa',
} as const
