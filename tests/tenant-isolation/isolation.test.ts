import { describe, it, expect, afterAll } from 'vitest'
import { prisma, contextFor, DEMO } from '../helpers/db'
import {
  getDashboardSummary,
  getBranchPerformance,
  getComplianceTrend,
  getRecentActivity,
} from '@/server/services/dashboard'

/**
 * اختبارات العزل الإلزامية.
 *
 * تفشل هذه الاختبارات إن تسرّب أي سجل من منشأة إلى أخرى. هي خط الدفاع الذي
 * يمنع انحدار العزل عند إضافة أي وحدة جديدة.
 */

afterAll(async () => {
  await prisma.$disconnect()
})

describe('عزل المستأجرين — بين منشأتين مستقلتين', () => {
  it('كل منشأة ترى فروعها فقط', async () => {
    const a = await contextFor(DEMO.ownerA)
    const b = await contextFor(DEMO.ownerB)

    expect(a.organizationId).not.toBe(b.organizationId)

    const [branchesA, branchesB] = await Promise.all([
      getBranchPerformance(a),
      getBranchPerformance(b),
    ])

    expect(branchesA.length).toBeGreaterThan(0)
    expect(branchesB.length).toBeGreaterThan(0)

    const idsA = new Set(branchesA.map((x) => x.branchId))
    const idsB = new Set(branchesB.map((x) => x.branchId))

    for (const id of idsB) {
      expect(idsA.has(id)).toBe(false)
    }
  })

  it('استعلام سجل بمعرّف من منشأة أخرى يعيد null — لا يُسرّب الوجود', async () => {
    const a = await contextFor(DEMO.ownerA)
    const b = await contextFor(DEMO.ownerB)

    const branchOfB = await prisma.branch.findFirstOrThrow({
      where: { organizationId: b.organizationId },
      select: { id: true },
    })

    // هذا هو النمط الوحيد المسموح في طبقة الخدمات
    const leaked = await prisma.branch.findFirst({
      where: { id: branchOfB.id, organizationId: a.organizationId },
    })

    expect(leaked).toBeNull()
  })

  it('ملخّص لوحة التحكم لا يخلط أرقام المنشأتين', async () => {
    const a = await contextFor(DEMO.ownerA)
    const b = await contextFor(DEMO.ownerB)

    const [sa, sb] = await Promise.all([
      getDashboardSummary(a),
      getDashboardSummary(b),
    ])

    const totalBranches = await prisma.branch.count({ where: { deletedAt: null } })

    // مجموع ما تراه المنشأتان يجب ألا يتجاوز الإجمالي الفعلي
    expect(sa.branchCount + sb.branchCount).toBeLessThanOrEqual(totalBranches)
    expect(sa.branchCount).toBeGreaterThan(0)
    expect(sb.branchCount).toBeGreaterThan(0)
  })

  it('النشاطات الأخيرة تقتصر على فروع المنشأة نفسها', async () => {
    const a = await contextFor(DEMO.ownerA)

    const [activity, ownBranches] = await Promise.all([
      getRecentActivity(a, 20),
      prisma.branch.findMany({
        where: { organizationId: a.organizationId },
        select: { name: true },
      }),
    ])

    const ownNames = new Set(ownBranches.map((b) => b.name))
    for (const item of activity) {
      expect(ownNames.has(item.branchName)).toBe(true)
    }
  })

  it('اتجاه الالتزام يُحسب من فحوصات المنشأة فقط', async () => {
    const a = await contextFor(DEMO.ownerA)
    const b = await contextFor(DEMO.ownerB)

    const [trendA, trendB] = await Promise.all([
      getComplianceTrend(a, 90),
      getComplianceTrend(b, 90),
    ])

    const inspectionsA = await prisma.inspection.count({
      where: { organizationId: a.organizationId, status: 'APPROVED' },
    })
    const inspectionsB = await prisma.inspection.count({
      where: { organizationId: b.organizationId, status: 'APPROVED' },
    })

    expect(inspectionsA).toBeGreaterThan(0)
    expect(inspectionsB).toBeGreaterThan(0)
    // منشأتان بأحجام مختلفة يجب ألا تعطيا نفس السلسلة
    expect(trendA).not.toEqual(trendB)
  })
})

describe('نطاق الفروع داخل المنشأة نفسها', () => {
  it('مدير الفرع مقيّد بفروعه، والمالك يرى الكل', async () => {
    const owner = await contextFor(DEMO.ownerA)
    const branchManager = await contextFor(DEMO.branchManagerA)

    expect(owner.organizationId).toBe(branchManager.organizationId)
    expect(owner.branchScope).toBeNull()
    expect(branchManager.branchScope).not.toBeNull()

    const [ownerBranches, managerBranches] = await Promise.all([
      getBranchPerformance(owner),
      getBranchPerformance(branchManager),
    ])

    expect(managerBranches.length).toBeLessThan(ownerBranches.length)

    const allowed = new Set(branchManager.branchScope!)
    for (const b of managerBranches) {
      expect(allowed.has(b.branchId)).toBe(true)
    }
  })

  it('ملخّص مدير الفرع لا يشمل فروعًا خارج نطاقه', async () => {
    const branchManager = await contextFor(DEMO.branchManagerA)
    const summary = await getDashboardSummary(branchManager)

    expect(summary.branchCount).toBe(branchManager.branchScope!.length)
  })
})

describe('سلامة البيانات في قاعدة البيانات', () => {
  it('لا يوجد فرع بلا منشأة', async () => {
    const orphans = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM branches b
      LEFT JOIN organizations o ON o.id = b."organizationId"
      WHERE o.id IS NULL
    `
    expect(Number(orphans[0]?.count ?? 0)).toBe(0)
  })

  it('كل زيارة تخص فرعًا من نفس منشأتها', async () => {
    const mismatched = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM inspections i
      JOIN branches b ON b.id = i."branchId"
      WHERE b."organizationId" <> i."organizationId"
    `
    expect(Number(mismatched[0]?.count ?? 0)).toBe(0)
  })

  it('كل إجراء تصحيحي يخص فرعًا من نفس منشأته', async () => {
    const mismatched = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM corrective_actions a
      JOIN branches b ON b.id = a."branchId"
      WHERE b."organizationId" <> a."organizationId"
    `
    expect(Number(mismatched[0]?.count ?? 0)).toBe(0)
  })

  it('كل صنف مخزون يخص فرعًا من نفس منشأته', async () => {
    const mismatched = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM inventory_items ii
      JOIN branches b ON b.id = ii."branchId"
      WHERE b."organizationId" <> ii."organizationId"
    `
    expect(Number(mismatched[0]?.count ?? 0)).toBe(0)
  })
})
