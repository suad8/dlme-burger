import 'server-only'
import { prisma } from '../db'
import { authorize } from '../rbac'
import { branchFilter, type TenantContext } from '../tenant'
import { toNumber } from '@/lib/utils'

/**
 * كل رقم في لوحة التحكم يأتي من قاعدة البيانات. لا قيم ثابتة ولا تقديرات.
 * كل استعلام مقيّد بـorganizationId، وبنطاق الفروع إن كان المستخدم مقيّدًا.
 */

export interface DashboardSummary {
  complianceScore: number | null
  complianceDelta: number | null
  inspectionsCompleted: number
  inspectionsOverdue: number
  openActions: number
  overdueActions: number
  wasteCost: number
  branchCount: number
  employeeCount: number
  lowStockCount: number
  expiringDocuments: number
}

export interface BranchPerformance {
  branchId: string
  branchName: string
  city: string | null
  score: number | null
  inspectionCount: number
  openActions: number
}

export interface TrendPoint {
  date: string
  score: number
}

export interface ActivityItem {
  id: string
  kind: 'inspection' | 'action'
  title: string
  branchName: string
  at: Date
  tone: 'success' | 'warning' | 'danger' | 'neutral'
}

/** الفترات المسموحة للتقارير — أي قيمة أخرى تُردّ إلى ٣٠ يومًا. */
export type PeriodDays = 7 | 30 | 90

function periodStart(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d
}

/** عدد أصناف المخزون التي بلغت حد إعادة الطلب، مقيّدة بالمنشأة والنطاق. */
async function countLowStock(ctx: TenantContext): Promise<number> {
  const rows = ctx.branchScope
    ? await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM inventory_items
        WHERE "organizationId" = ${ctx.organizationId}
          AND "quantityOnHand" <= "reorderLevel"
          AND "branchId" = ANY(${[...ctx.branchScope]})
      `
    : await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM inventory_items
        WHERE "organizationId" = ${ctx.organizationId}
          AND "quantityOnHand" <= "reorderLevel"
      `
  return Number(rows[0]?.count ?? 0)
}

export async function getDashboardSummary(
  ctx: TenantContext,
  days: PeriodDays = 30,
): Promise<DashboardSummary> {
  authorize(ctx, 'report:view')

  const since = periodStart(days)
  const prevSince = periodStart(days * 2)
  const scope = branchFilter(ctx)
  const base = { organizationId: ctx.organizationId, ...scope }

  const [
    currentAgg,
    previousAgg,
    inspectionsCompleted,
    inspectionsOverdue,
    openActions,
    overdueActions,
    wasteAgg,
    branchCount,
    employeeCount,
    lowStockCount,
    expiringDocuments,
  ] = await Promise.all([
    prisma.inspection.aggregate({
      where: { ...base, status: 'APPROVED', submittedAt: { gte: since } },
      _avg: { score: true },
    }),
    prisma.inspection.aggregate({
      where: {
        ...base,
        status: 'APPROVED',
        submittedAt: { gte: prevSince, lt: since },
      },
      _avg: { score: true },
    }),
    prisma.inspection.count({
      where: { ...base, status: 'APPROVED', submittedAt: { gte: since } },
    }),
    prisma.inspection.count({ where: { ...base, status: 'OVERDUE' } }),
    prisma.correctiveAction.count({
      where: {
        ...base,
        status: { in: ['NEW', 'IN_PROGRESS', 'PENDING_REVIEW'] },
      },
    }),
    prisma.correctiveAction.count({ where: { ...base, status: 'OVERDUE' } }),
    prisma.wasteRecord.aggregate({
      where: { ...base, recordedAt: { gte: since } },
      _sum: { costValue: true },
    }),
    prisma.branch.count({
      where: {
        organizationId: ctx.organizationId,
        deletedAt: null,
        ...(ctx.branchScope ? { id: { in: [...ctx.branchScope] } } : {}),
      },
    }),
    prisma.employee.count({
      where: { ...base, deletedAt: null, status: 'ACTIVE' },
    }),
    // أصناف بلغت أو تجاوزت حد إعادة الطلب.
    // مقارنة عمود بعمود لا يعبّر عنها Prisma، فنستخدم SQL معاملًا (parameterized)
    // — لا دمج نصي، فلا مجال لحقن SQL.
    countLowStock(ctx),
    prisma.employeeDocument.count({
      where: {
        employee: { organizationId: ctx.organizationId, deletedAt: null },
        expiresAt: {
          gte: new Date(),
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ])

  const current = currentAgg._avg.score
  const previous = previousAgg._avg.score

  return {
    complianceScore: current === null ? null : Number(toNumber(current).toFixed(1)),
    complianceDelta:
      current === null || previous === null
        ? null
        : Number((toNumber(current) - toNumber(previous)).toFixed(1)),
    inspectionsCompleted,
    inspectionsOverdue,
    openActions,
    overdueActions,
    wasteCost: toNumber(wasteAgg._sum.costValue),
    branchCount,
    employeeCount,
    lowStockCount,
    expiringDocuments,
  }
}

export async function getBranchPerformance(
  ctx: TenantContext,
  days: PeriodDays = 30,
): Promise<BranchPerformance[]> {
  authorize(ctx, 'report:view')

  const since = periodStart(days)
  const branches = await prisma.branch.findMany({
    where: {
      organizationId: ctx.organizationId,
      deletedAt: null,
      ...(ctx.branchScope ? { id: { in: [...ctx.branchScope] } } : {}),
    },
    select: { id: true, name: true, city: true },
    orderBy: { name: 'asc' },
  })

  if (branches.length === 0) return []

  const branchIds = branches.map((b) => b.id)

  // استعلامان تجميعيان بدل استعلام لكل فرع — تفاديًا لـN+1
  const [scores, actions] = await Promise.all([
    prisma.inspection.groupBy({
      by: ['branchId'],
      where: {
        organizationId: ctx.organizationId,
        branchId: { in: branchIds },
        status: 'APPROVED',
        submittedAt: { gte: since },
      },
      _avg: { score: true },
      _count: { _all: true },
    }),
    prisma.correctiveAction.groupBy({
      by: ['branchId'],
      where: {
        organizationId: ctx.organizationId,
        branchId: { in: branchIds },
        status: { in: ['NEW', 'IN_PROGRESS', 'PENDING_REVIEW', 'OVERDUE'] },
      },
      _count: { _all: true },
    }),
  ])

  const scoreMap = new Map(scores.map((s) => [s.branchId, s]))
  const actionMap = new Map(actions.map((a) => [a.branchId, a._count._all]))

  return branches.map((b) => {
    const s = scoreMap.get(b.id)
    return {
      branchId: b.id,
      branchName: b.name,
      city: b.city,
      score:
        s?._avg.score == null ? null : Number(toNumber(s._avg.score).toFixed(1)),
      inspectionCount: s?._count._all ?? 0,
      openActions: actionMap.get(b.id) ?? 0,
    }
  })
}

export async function getComplianceTrend(
  ctx: TenantContext,
  days: PeriodDays = 30,
): Promise<TrendPoint[]> {
  authorize(ctx, 'report:view')

  const since = periodStart(days)
  const scopeIds = ctx.branchScope ? [...ctx.branchScope] : null

  // تجميع يومي على الخادم — لا نجلب كل السجلات ثم نجمّع في الذاكرة
  const rows = scopeIds
    ? await prisma.$queryRaw<{ day: Date; avg: number }[]>`
        SELECT date_trunc('day', "submittedAt") AS day,
               AVG("score")::float8 AS avg
        FROM inspections
        WHERE "organizationId" = ${ctx.organizationId}
          AND "status" = 'APPROVED'
          AND "submittedAt" >= ${since}
          AND "branchId" = ANY(${scopeIds})
        GROUP BY 1 ORDER BY 1
      `
    : await prisma.$queryRaw<{ day: Date; avg: number }[]>`
        SELECT date_trunc('day', "submittedAt") AS day,
               AVG("score")::float8 AS avg
        FROM inspections
        WHERE "organizationId" = ${ctx.organizationId}
          AND "status" = 'APPROVED'
          AND "submittedAt" >= ${since}
        GROUP BY 1 ORDER BY 1
      `

  return rows.map((r) => ({
    date: r.day.toISOString().slice(0, 10),
    score: Number(toNumber(r.avg).toFixed(1)),
  }))
}

export async function getRecentActivity(
  ctx: TenantContext,
  limit = 8,
): Promise<ActivityItem[]> {
  authorize(ctx, 'report:view')

  const scope = branchFilter(ctx)
  const base = { organizationId: ctx.organizationId, ...scope }

  const [inspections, actions] = await Promise.all([
    prisma.inspection.findMany({
      where: { ...base, submittedAt: { not: null } },
      select: {
        id: true,
        reference: true,
        score: true,
        passed: true,
        submittedAt: true,
        branch: { select: { name: true } },
        template: { select: { name: true } },
      },
      orderBy: { submittedAt: 'desc' },
      take: limit,
    }),
    prisma.correctiveAction.findMany({
      where: base,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
  ])

  const items: ActivityItem[] = [
    ...inspections.map((i): ActivityItem => ({
      id: i.id,
      kind: 'inspection',
      title: `${i.template.name} — ${toNumber(i.score).toFixed(0)}%`,
      branchName: i.branch.name,
      at: i.submittedAt!,
      tone: i.passed === false ? 'danger' : 'success',
    })),
    ...actions.map((a): ActivityItem => ({
      id: a.id,
      kind: 'action',
      title: a.title,
      branchName: a.branch.name,
      at: a.createdAt,
      tone:
        a.status === 'OVERDUE'
          ? 'danger'
          : a.status === 'COMPLETED'
            ? 'success'
            : 'warning',
    })),
  ]

  return items
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit)
}
