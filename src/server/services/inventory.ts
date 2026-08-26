import 'server-only'
import { StockMovementType, WasteReason, type Prisma } from '@prisma/client'
import { prisma } from '../db'
import { authorize } from '../rbac'
import { assertBranchInScope, branchFilter, type TenantContext } from '../tenant'
import { recordAudit } from '../audit'
import { toNumber } from '@/lib/utils'

/**
 * المخزون والهدر.
 *
 * كل تغيير في الرصيد يمرّ عبر حركة مخزون تُسجَّل مع الرصيد الناتج — فالسجل
 * يفسّر نفسه دون إعادة حساب تاريخي. المخزون السالب ممنوع افتراضيًا، والسماح
 * به قرار صريح لكل صنف لا افتراض عام.
 */

export const WASTE_REASON_LABELS: Record<WasteReason, string> = {
  EXPIRED: 'انتهاء صلاحية',
  DAMAGED: 'تلف',
  OVER_PRODUCTION: 'إنتاج زائد',
  CUSTOMER_RETURN: 'إرجاع عميل',
  PREPARATION_ERROR: 'خطأ تحضير',
  SPILLAGE: 'انسكاب',
  OTHER: 'أخرى',
}

export const MOVEMENT_LABELS: Record<StockMovementType, string> = {
  PURCHASE: 'شراء',
  RECEIVE: 'استلام',
  CONSUMPTION: 'استهلاك',
  TRANSFER_IN: 'تحويل وارد',
  TRANSFER_OUT: 'تحويل صادر',
  WASTE: 'هدر',
  COUNT_ADJUSTMENT: 'تسوية جرد',
}

export const UNIT_LABELS: Record<string, string> = {
  GRAM: 'غرام',
  KILOGRAM: 'كيلوغرام',
  MILLILITER: 'مليلتر',
  LITER: 'لتر',
  PIECE: 'قطعة',
  PORTION: 'حصة',
}

export class NegativeStockError extends Error {
  override readonly name = 'NegativeStockError'
  constructor(itemName: string, available: number, requested: number) {
    super(
      `الكمية المطلوبة من «${itemName}» (${requested}) تتجاوز المتاح (${available}). ` +
        'فعّل السماح بالسالب لهذا الصنف إن كان ذلك مقصودًا.',
    )
  }
}

export interface InventoryRow {
  id: string
  ingredientName: string
  branchName: string
  unit: string
  quantityOnHand: number
  reorderLevel: number
  belowReorder: boolean
  unitCost: number
  value: number
}

export async function listInventory(
  ctx: TenantContext,
  filters: { branchId?: string; lowOnly?: boolean } = {},
): Promise<InventoryRow[]> {
  authorize(ctx, 'inventory:view')

  const items = await prisma.inventoryItem.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...branchFilter(ctx),
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
    },
    select: {
      id: true,
      unit: true,
      quantityOnHand: true,
      reorderLevel: true,
      branch: { select: { name: true } },
      ingredient: { select: { name: true, unitCost: true } },
    },
    orderBy: [{ branch: { name: 'asc' } }, { ingredient: { name: 'asc' } }],
  })

  const rows = items.map((i) => {
    const qty = toNumber(i.quantityOnHand)
    const unitCost = toNumber(i.ingredient.unitCost)
    const reorder = toNumber(i.reorderLevel)
    return {
      id: i.id,
      ingredientName: i.ingredient.name,
      branchName: i.branch.name,
      unit: UNIT_LABELS[i.unit] ?? i.unit,
      quantityOnHand: qty,
      reorderLevel: reorder,
      belowReorder: qty <= reorder,
      unitCost,
      value: qty * unitCost,
    }
  })

  return filters.lowOnly ? rows.filter((r) => r.belowReorder) : rows
}

/**
 * يسجّل حركة مخزون ويحدّث الرصيد داخل معاملة واحدة.
 * الكمية موجبة للوارد وسالبة للصادر.
 */
export async function recordMovement(
  ctx: TenantContext,
  params: {
    itemId: string
    type: StockMovementType
    quantity: number
    unitCost?: number
    note?: string
    reference?: string
  },
): Promise<number> {
  authorize(ctx, 'inventory:update')

  return prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findFirst({
      where: { id: params.itemId, organizationId: ctx.organizationId },
      select: {
        id: true,
        branchId: true,
        quantityOnHand: true,
        allowNegative: true,
        version: true,
        ingredient: { select: { name: true } },
      },
    })
    if (!item) throw new Error('صنف المخزون غير موجود ضمن منشأتك.')

    assertBranchInScope(ctx, item.branchId)

    const current = toNumber(item.quantityOnHand)
    const next = current + params.quantity

    if (next < 0 && !item.allowNegative) {
      throw new NegativeStockError(
        item.ingredient.name,
        current,
        Math.abs(params.quantity),
      )
    }

    // التزامن المتفائل: حركتان متزامنتان لا تدهس إحداهما الأخرى
    const updated = await tx.inventoryItem.updateMany({
      where: { id: item.id, version: item.version },
      data: { quantityOnHand: next.toFixed(4), version: { increment: 1 } },
    })
    if (updated.count === 0) {
      throw new Error('تم تعديل رصيد هذا الصنف للتو. أعد المحاولة.')
    }

    await tx.stockMovement.create({
      data: {
        organizationId: ctx.organizationId,
        branchId: item.branchId,
        itemId: item.id,
        type: params.type,
        quantity: params.quantity.toFixed(4),
        unitCost: params.unitCost?.toFixed(4),
        balanceAfter: next.toFixed(4),
        note: params.note ?? null,
        reference: params.reference ?? null,
        createdById: ctx.userId,
      },
    })

    return next
  })
}

export async function recordWaste(
  ctx: TenantContext,
  params: {
    itemId: string
    quantity: number
    reason: WasteReason
    note?: string
  },
): Promise<void> {
  authorize(ctx, 'waste:create')

  if (params.quantity <= 0) {
    throw new Error('كمية الهدر يجب أن تكون أكبر من صفر.')
  }

  const item = await prisma.inventoryItem.findFirst({
    where: { id: params.itemId, organizationId: ctx.organizationId },
    select: {
      id: true,
      branchId: true,
      ingredient: { select: { unitCost: true, name: true } },
    },
  })
  if (!item) throw new Error('صنف المخزون غير موجود ضمن منشأتك.')

  const costValue = params.quantity * toNumber(item.ingredient.unitCost)

  // الهدر ينقص المخزون فعليًا — الحركة والسجل معًا
  await recordMovement(ctx, {
    itemId: params.itemId,
    type: StockMovementType.WASTE,
    quantity: -params.quantity,
    note: params.note,
    reference: `هدر: ${WASTE_REASON_LABELS[params.reason]}`,
  })

  await prisma.wasteRecord.create({
    data: {
      organizationId: ctx.organizationId,
      branchId: item.branchId,
      itemId: item.id,
      quantity: params.quantity.toFixed(4),
      reason: params.reason,
      costValue: costValue.toFixed(4),
      note: params.note ?? null,
      recordedById: ctx.userId,
    },
  })

  await recordAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'waste.recorded',
    entityType: 'WasteRecord',
    entityId: item.id,
    after: {
      ingredient: item.ingredient.name,
      quantity: params.quantity,
      reason: params.reason,
      costValue,
    },
  })
}

export interface WasteSummary {
  totalCost: number
  totalRecords: number
  byReason: { reason: WasteReason; label: string; cost: number; count: number }[]
  byBranch: { branchName: string; cost: number }[]
}

export async function getWasteSummary(
  ctx: TenantContext,
  days = 30,
): Promise<WasteSummary> {
  authorize(ctx, 'waste:view')

  const since = new Date()
  since.setDate(since.getDate() - days)

  const where: Prisma.WasteRecordWhereInput = {
    organizationId: ctx.organizationId,
    ...branchFilter(ctx),
    recordedAt: { gte: since },
  }

  const [byReason, records, total] = await Promise.all([
    prisma.wasteRecord.groupBy({
      by: ['reason'],
      where,
      _sum: { costValue: true },
      _count: { _all: true },
    }),
    prisma.wasteRecord.findMany({
      where,
      select: { costValue: true, branch: { select: { name: true } } },
    }),
    prisma.wasteRecord.aggregate({ where, _sum: { costValue: true }, _count: { _all: true } }),
  ])

  const branchMap = new Map<string, number>()
  for (const r of records) {
    branchMap.set(
      r.branch.name,
      (branchMap.get(r.branch.name) ?? 0) + toNumber(r.costValue),
    )
  }

  return {
    totalCost: toNumber(total._sum.costValue),
    totalRecords: total._count._all,
    byReason: byReason
      .map((r) => ({
        reason: r.reason,
        label: WASTE_REASON_LABELS[r.reason],
        cost: toNumber(r._sum.costValue),
        count: r._count._all,
      }))
      .sort((a, b) => b.cost - a.cost),
    byBranch: [...branchMap.entries()]
      .map(([branchName, cost]) => ({ branchName, cost }))
      .sort((a, b) => b.cost - a.cost),
  }
}

export async function listMovements(
  ctx: TenantContext,
  itemId: string,
  limit = 50,
) {
  authorize(ctx, 'inventory:view')

  return prisma.stockMovement.findMany({
    where: {
      organizationId: ctx.organizationId,
      itemId,
      ...branchFilter(ctx),
    },
    select: {
      id: true,
      type: true,
      quantity: true,
      balanceAfter: true,
      note: true,
      reference: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}
