import 'server-only'
import type { RoleKey } from '@prisma/client'
import { prisma } from '../db'
import { authorize, can } from '../rbac'
import type { TenantContext } from '../tenant'

/**
 * إعدادات المنشأة.
 *
 * بيانات الاشتراك والفواتير لا تُجلب إطلاقًا لمن لا يملك `billing:view` —
 * الإخفاء يحدث في الاستعلام لا في التصيير، فلا تصل الأرقام إلى المتصفح أصلًا.
 */

export interface MemberRow {
  id: string
  name: string
  email: string
  role: RoleKey
  status: string
  branchNames: string[]
}

export interface OrganizationSettings {
  name: string
  slug: string
  vatNumber: string | null
  city: string | null
  brandCount: number
  branchCount: number
  memberCount: number
  auditCount: number
  members: MemberRow[]
  subscription: {
    status: string
    planName: string
    monthlyPrice: unknown
    maxBranches: number
    maxUsers: number
    currentPeriodEnd: Date
  } | null
  invoices: { id: string; number: string; total: unknown; status: string }[]
}

export async function getOrganizationSettings(
  ctx: TenantContext,
): Promise<OrganizationSettings> {
  authorize(ctx, 'org:view')

  const showBilling = can(ctx, 'billing:view')

  const [org, members, auditCount, subscription, invoices] = await Promise.all([
    prisma.organization.findFirstOrThrow({
      where: { id: ctx.organizationId },
      select: {
        name: true,
        slug: true,
        vatNumber: true,
        city: true,
        _count: { select: { brands: true, branches: true, memberships: true } },
      },
    }),
    prisma.membership.findMany({
      where: { organizationId: ctx.organizationId },
      select: {
        id: true,
        status: true,
        user: { select: { name: true, email: true } },
        role: { select: { key: true } },
        branches: { select: { branch: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.auditLog.count({ where: { organizationId: ctx.organizationId } }),
    // لا استعلام أصلًا لمن لا يملك صلاحية الفوترة
    showBilling
      ? prisma.subscription.findUnique({
          where: { organizationId: ctx.organizationId },
          select: {
            status: true,
            currentPeriodEnd: true,
            plan: {
              select: {
                name: true,
                monthlyPrice: true,
                maxBranches: true,
                maxUsers: true,
              },
            },
          },
        })
      : Promise.resolve(null),
    showBilling
      ? prisma.invoice.findMany({
          where: { organizationId: ctx.organizationId },
          select: { id: true, number: true, total: true, status: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        })
      : Promise.resolve([]),
  ])

  return {
    name: org.name,
    slug: org.slug,
    vatNumber: org.vatNumber,
    city: org.city,
    brandCount: org._count.brands,
    branchCount: org._count.branches,
    memberCount: org._count.memberships,
    auditCount,
    members: members.map((m) => ({
      id: m.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role.key,
      status: m.status,
      branchNames: m.branches.map((b) => b.branch.name),
    })),
    subscription: subscription
      ? {
          status: subscription.status,
          planName: subscription.plan.name,
          monthlyPrice: subscription.plan.monthlyPrice,
          maxBranches: subscription.plan.maxBranches,
          maxUsers: subscription.plan.maxUsers,
          currentPeriodEnd: subscription.currentPeriodEnd,
        }
      : null,
    invoices,
  }
}
