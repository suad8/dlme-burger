import 'server-only'
import { prisma } from '../db'
import type { TenantContext } from '../tenant'
import { recordAudit } from '../audit'
import { toNumber } from '@/lib/utils'

/**
 * لوحة مدير النظام.
 *
 * ⚠️ كل دالة هنا تتجاوز عزل المستأجر عمدًا — وهذا هو الخطر. لذلك:
 *  1. لا تُستدعى إلا بعد `requireSuperAdmin()` الذي يعيد 404 لغير المخوّلين.
 *  2. كل دالة تتحقق من `isSuperAdmin` مجددًا كخط دفاع ثانٍ، فلا يكفي أن ينسى
 *     مطوّر لاحقًا استدعاء الحارس في الصفحة.
 *  3. لا تُعيد أي بيانات تشغيلية تفصيلية — إحصاءات وحالة فقط.
 */

function assertSuperAdmin(ctx: TenantContext): void {
  if (!ctx.isSuperAdmin) {
    throw new Error('هذه العملية مقصورة على مدير النظام.')
  }
}

export interface PlatformStats {
  organizations: number
  activeOrganizations: number
  trialOrganizations: number
  suspendedOrganizations: number
  users: number
  branches: number
  inspections: number
  auditEvents: number
  failedLogins24h: number
}

export async function getPlatformStats(
  ctx: TenantContext,
): Promise<PlatformStats> {
  assertSuperAdmin(ctx)

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [
    organizations,
    activeOrganizations,
    trialOrganizations,
    suspendedOrganizations,
    users,
    branches,
    inspections,
    auditEvents,
    failedLogins24h,
  ] = await Promise.all([
    prisma.organization.count({ where: { deletedAt: null } }),
    prisma.organization.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
    prisma.organization.count({ where: { deletedAt: null, status: 'TRIAL' } }),
    prisma.organization.count({ where: { deletedAt: null, status: 'SUSPENDED' } }),
    prisma.user.count(),
    prisma.branch.count({ where: { deletedAt: null } }),
    prisma.inspection.count(),
    prisma.auditLog.count(),
    prisma.loginAttempt.count({
      where: { success: false, createdAt: { gte: dayAgo } },
    }),
  ])

  return {
    organizations,
    activeOrganizations,
    trialOrganizations,
    suspendedOrganizations,
    users,
    branches,
    inspections,
    auditEvents,
    failedLogins24h,
  }
}

export interface OrgRow {
  id: string
  name: string
  slug: string
  status: string
  city: string | null
  createdAt: Date
  branchCount: number
  memberCount: number
  planName: string | null
  subscriptionStatus: string | null
  monthlyPrice: number
}

export async function listOrganizations(
  ctx: TenantContext,
): Promise<OrgRow[]> {
  assertSuperAdmin(ctx)

  const orgs = await prisma.organization.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      city: true,
      createdAt: true,
      _count: { select: { branches: true, memberships: true } },
      subscription: {
        select: {
          status: true,
          plan: { select: { name: true, monthlyPrice: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return orgs.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    status: o.status,
    city: o.city,
    createdAt: o.createdAt,
    branchCount: o._count.branches,
    memberCount: o._count.memberships,
    planName: o.subscription?.plan.name ?? null,
    subscriptionStatus: o.subscription?.status ?? null,
    monthlyPrice: toNumber(o.subscription?.plan.monthlyPrice ?? 0),
  }))
}

/**
 * إيقاف منشأة — يمنع الوصول ولا يحذف أي بيانات.
 * الاستعادة بنفس الدالة بالحالة السابقة.
 */
export async function setOrganizationStatus(
  ctx: TenantContext,
  organizationId: string,
  status: 'ACTIVE' | 'SUSPENDED',
  reason: string,
): Promise<void> {
  assertSuperAdmin(ctx)

  if (!reason.trim()) {
    throw new Error('السبب مطلوب — كل إيقاف يجب أن يكون مبرَّرًا وموثّقًا.')
  }

  const before = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { status: true, name: true },
  })

  await prisma.organization.update({
    where: { id: organizationId },
    data: { status, version: { increment: 1 } },
  })

  await recordAudit({
    organizationId,
    actorId: ctx.userId,
    action: status === 'SUSPENDED' ? 'org.suspended' : 'org.reactivated',
    entityType: 'Organization',
    entityId: organizationId,
    before: { status: before.status },
    after: { status, reason },
    impersonationReason: reason,
  })
}

export interface AuditRow {
  id: string
  action: string
  entityType: string
  entityId: string | null
  actorName: string | null
  organizationName: string | null
  ipAddress: string | null
  createdAt: Date
}

export async function listRecentAudit(
  ctx: TenantContext,
  limit = 50,
): Promise<AuditRow[]> {
  assertSuperAdmin(ctx)

  const rows = await prisma.auditLog.findMany({
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      ipAddress: true,
      createdAt: true,
      actor: { select: { name: true } },
      organization: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    actorName: r.actor?.name ?? null,
    organizationName: r.organization?.name ?? null,
    ipAddress: r.ipAddress,
    createdAt: r.createdAt,
  }))
}

export async function listFailedLogins(ctx: TenantContext, limit = 30) {
  assertSuperAdmin(ctx)

  return prisma.loginAttempt.findMany({
    where: { success: false },
    select: {
      id: true,
      email: true,
      ipAddress: true,
      reason: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}
