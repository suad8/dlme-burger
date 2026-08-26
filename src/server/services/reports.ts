import 'server-only'
import { prisma } from '../db'
import { authorize } from '../rbac'
import { branchFilter, type TenantContext } from '../tenant'
import { toNumber } from '@/lib/utils'
import { WASTE_REASON_LABELS } from './inventory'
import { STATUS_LABELS, PRIORITY_LABELS } from './actions'

/**
 * التقارير والتصدير.
 *
 * كل تقرير يمر بـ`authorize` و`branchFilter` مثل أي قراءة أخرى — التصدير ليس
 * بابًا خلفيًا يتجاوز الصلاحيات. من لا يرى الفرع في الواجهة لا يجده في الملف.
 */

export type ReportKey =
  | 'branch-performance'
  | 'inspections'
  | 'corrective-actions'
  | 'waste'
  | 'product-costs'
  | 'employees'

export interface ReportMeta {
  key: ReportKey
  title: string
  description: string
  permission: 'report:view'
}

export const REPORTS: ReportMeta[] = [
  {
    key: 'branch-performance',
    title: 'أداء الفروع',
    description: 'درجة الالتزام وعدد الفحوصات والإجراءات المفتوحة لكل فرع.',
    permission: 'report:view',
  },
  {
    key: 'inspections',
    title: 'الفحوصات والزيارات',
    description: 'كل زيارة بنتيجتها وحالتها والمفتش المسؤول.',
    permission: 'report:view',
  },
  {
    key: 'corrective-actions',
    title: 'الإجراءات التصحيحية',
    description: 'الإجراءات بحالاتها وأولوياتها ومواعيد استحقاقها.',
    permission: 'report:view',
  },
  {
    key: 'waste',
    title: 'الهدر',
    description: 'سجلات الهدر بأسبابها وتكلفتها لكل فرع.',
    permission: 'report:view',
  },
  {
    key: 'product-costs',
    title: 'تكلفة المنتجات',
    description: 'تكلفة كل صنف وهامشه ونسبة Food Cost.',
    permission: 'report:view',
  },
  {
    key: 'employees',
    title: 'الموظفون',
    description: 'الفريق وحالته وحالة التدريب وتواريخ التعيين.',
    permission: 'report:view',
  },
]

export interface ReportTable {
  title: string
  headers: string[]
  rows: (string | number)[][]
}

function dateOnly(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : ''
}

export async function buildReport(
  ctx: TenantContext,
  key: ReportKey,
  days = 30,
): Promise<ReportTable> {
  authorize(ctx, 'report:view')

  const since = new Date()
  since.setDate(since.getDate() - days)
  const scope = { organizationId: ctx.organizationId, ...branchFilter(ctx) }

  switch (key) {
    case 'branch-performance': {
      const branches = await prisma.branch.findMany({
        where: {
          organizationId: ctx.organizationId,
          deletedAt: null,
          ...(ctx.branchScope ? { id: { in: [...ctx.branchScope] } } : {}),
        },
        select: { id: true, name: true, code: true, city: true, status: true },
        orderBy: { name: 'asc' },
      })

      const ids = branches.map((b) => b.id)
      const [scores, actions] = await Promise.all([
        prisma.inspection.groupBy({
          by: ['branchId'],
          where: {
            organizationId: ctx.organizationId,
            branchId: { in: ids },
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
            branchId: { in: ids },
            status: { in: ['NEW', 'IN_PROGRESS', 'PENDING_REVIEW', 'OVERDUE'] },
          },
          _count: { _all: true },
        }),
      ])

      const scoreMap = new Map(scores.map((s) => [s.branchId, s]))
      const actionMap = new Map(actions.map((a) => [a.branchId, a._count._all]))

      return {
        title: 'أداء الفروع',
        headers: ['الفرع', 'الرمز', 'المدينة', 'درجة الالتزام', 'عدد الفحوصات', 'إجراءات مفتوحة'],
        rows: branches.map((b) => {
          const s = scoreMap.get(b.id)
          return [
            b.name,
            b.code,
            b.city ?? '',
            s?._avg.score == null ? '' : toNumber(s._avg.score).toFixed(1),
            s?._count._all ?? 0,
            actionMap.get(b.id) ?? 0,
          ]
        }),
      }
    }

    case 'inspections': {
      const rows = await prisma.inspection.findMany({
        where: { ...scope, createdAt: { gte: since } },
        select: {
          reference: true,
          status: true,
          score: true,
          passed: true,
          submittedAt: true,
          dueAt: true,
          branch: { select: { name: true } },
          template: { select: { name: true } },
          inspector: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5000,
      })

      return {
        title: 'الفحوصات والزيارات',
        headers: ['المرجع', 'القالب', 'الفرع', 'المفتش', 'الحالة', 'النتيجة', 'مطابق', 'تاريخ الإغلاق'],
        rows: rows.map((r) => [
          r.reference,
          r.template.name,
          r.branch.name,
          r.inspector?.name ?? '',
          r.status,
          r.score === null ? '' : toNumber(r.score).toFixed(1),
          r.passed === null ? '' : r.passed ? 'نعم' : 'لا',
          dateOnly(r.submittedAt),
        ]),
      }
    }

    case 'corrective-actions': {
      const rows = await prisma.correctiveAction.findMany({
        where: { ...scope, createdAt: { gte: since } },
        select: {
          reference: true,
          title: true,
          status: true,
          priority: true,
          dueAt: true,
          completedAt: true,
          branch: { select: { name: true } },
          assignee: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5000,
      })

      return {
        title: 'الإجراءات التصحيحية',
        headers: ['المرجع', 'العنوان', 'الفرع', 'المسؤول', 'الأولوية', 'الحالة', 'الاستحقاق', 'الإنجاز'],
        rows: rows.map((r) => [
          r.reference,
          r.title,
          r.branch.name,
          r.assignee?.name ?? '',
          PRIORITY_LABELS[r.priority],
          STATUS_LABELS[r.status],
          dateOnly(r.dueAt),
          dateOnly(r.completedAt),
        ]),
      }
    }

    case 'waste': {
      const rows = await prisma.wasteRecord.findMany({
        where: { ...scope, recordedAt: { gte: since } },
        select: {
          quantity: true,
          reason: true,
          costValue: true,
          recordedAt: true,
          note: true,
          branch: { select: { name: true } },
          item: { select: { ingredient: { select: { name: true } } } },
        },
        orderBy: { recordedAt: 'desc' },
        take: 5000,
      })

      return {
        title: 'الهدر',
        headers: ['التاريخ', 'الفرع', 'الصنف', 'الكمية', 'السبب', 'التكلفة', 'ملاحظة'],
        rows: rows.map((r) => [
          dateOnly(r.recordedAt),
          r.branch.name,
          r.item.ingredient.name,
          toNumber(r.quantity).toFixed(2),
          WASTE_REASON_LABELS[r.reason],
          toNumber(r.costValue).toFixed(2),
          r.note ?? '',
        ]),
      }
    }

    case 'product-costs': {
      const products = await prisma.product.findMany({
        where: {
          organizationId: ctx.organizationId,
          deletedAt: null,
          isActive: true,
        },
        select: {
          name: true,
          sku: true,
          sellPrice: true,
          unitsSold: true,
          category: { select: { name: true } },
          recipe: { select: { totalCost: true } },
        },
        orderBy: { name: 'asc' },
      })

      return {
        title: 'تكلفة المنتجات',
        headers: ['الصنف', 'الرمز', 'التصنيف', 'سعر البيع', 'التكلفة', 'الهامش', 'Food Cost %', 'المبيعات'],
        rows: products.map((p) => {
          const price = toNumber(p.sellPrice)
          const cost = toNumber(p.recipe?.totalCost ?? 0)
          const hasRecipe = p.recipe !== null
          return [
            p.name,
            p.sku ?? '',
            p.category?.name ?? '',
            price.toFixed(2),
            hasRecipe ? cost.toFixed(2) : '',
            hasRecipe ? (price - cost).toFixed(2) : '',
            hasRecipe && price > 0 ? ((cost / price) * 100).toFixed(1) : '',
            p.unitsSold,
          ]
        }),
      }
    }

    case 'employees': {
      const rows = await prisma.employee.findMany({
        where: {
          organizationId: ctx.organizationId,
          deletedAt: null,
          ...branchFilter(ctx),
        },
        select: {
          fullName: true,
          employeeNo: true,
          position: true,
          status: true,
          nationality: true,
          trainingDone: true,
          lastRating: true,
          hiredAt: true,
          branch: { select: { name: true } },
        },
        orderBy: { fullName: 'asc' },
      })

      return {
        title: 'الموظفون',
        headers: ['الاسم', 'الرقم', 'المنصب', 'الفرع', 'الجنسية', 'الحالة', 'التدريب', 'التقييم', 'تاريخ التعيين'],
        rows: rows.map((e) => [
          e.fullName,
          e.employeeNo ?? '',
          e.position,
          e.branch?.name ?? '',
          e.nationality ?? '',
          e.status,
          e.trainingDone ? 'مكتمل' : 'غير مكتمل',
          e.lastRating ?? '',
          dateOnly(e.hiredAt),
        ]),
      }
    }
  }
}

/**
 * يحوّل جدولًا إلى CSV.
 *
 * BOM في المقدمة ضروري: بدونه يفتح Excel على ويندوز الملف بترميز خاطئ فتظهر
 * العربية كرموز. والفواصل والاقتباسات وأسطر جديدة تُهرَّب بشكل صحيح.
 */
export function toCsv(table: ReportTable): string {
  const escape = (v: string | number): string => {
    const s = String(v ?? '')
    // منع حقن الصيغ: قيمة تبدأ بـ = أو + أو - أو @ تُنفَّذ في Excel
    const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
    return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded
  }

  const lines = [
    table.headers.map(escape).join(','),
    ...table.rows.map((r) => r.map(escape).join(',')),
  ]

  return '﻿' + lines.join('\r\n')
}
