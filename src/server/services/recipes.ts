import 'server-only'
import { MenuClass } from '@prisma/client'
import { prisma } from '../db'
import { authorize } from '../rbac'
import type { TenantContext } from '../tenant'
import { toNumber } from '@/lib/utils'

/**
 * الوصفات وتكلفة المنتجات وهندسة المنيو.
 *
 * التصنيف يقارن كل صنف بمتوسط المنيو نفسه لا بعتبات ثابتة — عتبة مطلقة تصلح
 * لمقهى ولا تصلح لمطعم. النتيجة قابلة للتفسير: نعرض المتوسطين اللذين بُني
 * عليهما القرار.
 */

export interface MenuItemAnalysis {
  productId: string
  name: string
  sku: string | null
  categoryName: string | null
  sellPrice: number
  cost: number
  /** هامش المساهمة بالريال: سعر البيع − التكلفة. */
  margin: number
  /** نسبة تكلفة الطعام: التكلفة ÷ سعر البيع. */
  foodCostPct: number
  unitsSold: number
  /** إيراد الصنف الكلي خلال فترة التحليل. */
  revenue: number
  menuClass: MenuClass | null
  hasRecipe: boolean
}

export interface MenuEngineering {
  items: MenuItemAnalysis[]
  avgPopularity: number
  avgMargin: number
  totalRevenue: number
  avgFoodCostPct: number
}

export const MENU_CLASS_LABELS: Record<MenuClass, string> = {
  STAR: 'نجوم',
  PUZZLE: 'ألغاز',
  PLOW_HORSE: 'خيول عمل',
  DOG: 'ضعيفة',
}

export const MENU_CLASS_ADVICE: Record<MenuClass, string> = {
  STAR: 'شعبية وربحية معًا. حافظ على الجودة والسعر، وأبرزه في المنيو.',
  PUZZLE: 'ربحية عالية لكن مبيعاته قليلة. جرّب إبرازه أو إعادة تسميته قبل حذفه.',
  PLOW_HORSE: 'يبيع كثيرًا بربح قليل. راجع التكلفة أو ارفع السعر تدريجيًا.',
  DOG: 'لا يبيع ولا يربح. مرشّح للحذف أو لإعادة تصميم كاملة.',
}

/** يصنّف صنفًا مقارنةً بمتوسطات المنيو. دالة نقية — مختبَرة مستقلة. */
export function classifyMenuItem(
  unitsSold: number,
  margin: number,
  avgPopularity: number,
  avgMargin: number,
): MenuClass {
  const popular = unitsSold >= avgPopularity
  const profitable = margin >= avgMargin

  if (popular && profitable) return MenuClass.STAR
  if (!popular && profitable) return MenuClass.PUZZLE
  if (popular && !profitable) return MenuClass.PLOW_HORSE
  return MenuClass.DOG
}

export async function getMenuEngineering(
  ctx: TenantContext,
): Promise<MenuEngineering> {
  authorize(ctx, 'recipe:view')

  const products = await prisma.product.findMany({
    where: {
      organizationId: ctx.organizationId,
      deletedAt: null,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      sku: true,
      sellPrice: true,
      unitsSold: true,
      category: { select: { name: true } },
      recipe: { select: { totalCost: true } },
    },
    orderBy: { name: 'asc' },
  })

  if (products.length === 0) {
    return {
      items: [],
      avgPopularity: 0,
      avgMargin: 0,
      totalRevenue: 0,
      avgFoodCostPct: 0,
    }
  }

  const base = products.map((p) => {
    const sellPrice = toNumber(p.sellPrice)
    const cost = toNumber(p.recipe?.totalCost ?? 0)
    return {
      productId: p.id,
      name: p.name,
      sku: p.sku,
      categoryName: p.category?.name ?? null,
      sellPrice,
      cost,
      margin: sellPrice - cost,
      // قسمة آمنة: سعر بيع صفر لا يُسقط الصفحة
      foodCostPct: sellPrice > 0 ? (cost / sellPrice) * 100 : 0,
      unitsSold: p.unitsSold,
      revenue: sellPrice * p.unitsSold,
      hasRecipe: p.recipe !== null,
    }
  })

  const avgPopularity =
    base.reduce((s, p) => s + p.unitsSold, 0) / base.length
  const avgMargin = base.reduce((s, p) => s + p.margin, 0) / base.length
  const totalRevenue = base.reduce((s, p) => s + p.revenue, 0)
  const costed = base.filter((p) => p.hasRecipe && p.sellPrice > 0)
  const avgFoodCostPct =
    costed.length > 0
      ? costed.reduce((s, p) => s + p.foodCostPct, 0) / costed.length
      : 0

  const items: MenuItemAnalysis[] = base.map((p) => ({
    ...p,
    // بلا وصفة لا تكلفة، فلا تصنيف — لا نخمّن
    menuClass: p.hasRecipe
      ? classifyMenuItem(p.unitsSold, p.margin, avgPopularity, avgMargin)
      : null,
  }))

  return {
    items,
    avgPopularity: Number(avgPopularity.toFixed(1)),
    avgMargin: Number(avgMargin.toFixed(2)),
    totalRevenue,
    avgFoodCostPct: Number(avgFoodCostPct.toFixed(1)),
  }
}

export async function getRecipeDetail(ctx: TenantContext, productId: string) {
  authorize(ctx, 'recipe:view')

  return prisma.product.findFirst({
    where: {
      id: productId,
      organizationId: ctx.organizationId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      sku: true,
      sellPrice: true,
      vatRate: true,
      unitsSold: true,
      category: { select: { name: true } },
      recipe: {
        select: {
          id: true,
          name: true,
          yieldQty: true,
          yieldUnit: true,
          totalCost: true,
          costUpdatedAt: true,
          ingredients: {
            select: {
              id: true,
              quantity: true,
              unit: true,
              ingredient: {
                select: {
                  id: true,
                  name: true,
                  unitCost: true,
                  unit: true,
                  supplier: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  })
}

/**
 * يعيد احتساب تكلفة كل وصفة تستخدم مكوّنًا معيّنًا.
 * يُستدعى عند تغيّر سعر المكوّن — وهو مصدر تنبيه «تغيّر تكلفة مكوّن».
 */
export async function recomputeRecipeCosts(
  ctx: TenantContext,
  ingredientId: string,
): Promise<number> {
  authorize(ctx, 'recipe:update')

  const affected = await prisma.recipe.findMany({
    where: {
      organizationId: ctx.organizationId,
      ingredients: { some: { ingredientId } },
    },
    select: {
      id: true,
      ingredients: {
        select: {
          quantity: true,
          ingredient: { select: { unitCost: true, wastePct: true } },
        },
      },
    },
  })

  for (const recipe of affected) {
    const total = recipe.ingredients.reduce((sum, ri) => {
      const qty = toNumber(ri.quantity)
      const unitCost = toNumber(ri.ingredient.unitCost)
      const waste = toNumber(ri.ingredient.wastePct) / 100
      // الهدر يرفع الكمية الفعلية المستهلكة عن الكمية في الوصفة
      return sum + qty * unitCost * (1 + waste)
    }, 0)

    await prisma.recipe.update({
      where: { id: recipe.id },
      data: { totalCost: total.toFixed(4), costUpdatedAt: new Date() },
    })
  }

  return affected.length
}

export async function listIngredients(ctx: TenantContext) {
  authorize(ctx, 'recipe:view')
  return prisma.ingredient.findMany({
    where: { organizationId: ctx.organizationId, deletedAt: null },
    select: {
      id: true,
      name: true,
      unit: true,
      unitCost: true,
      wastePct: true,
      supplier: { select: { name: true } },
      _count: { select: { recipeIngredients: true } },
    },
    orderBy: { name: 'asc' },
  })
}
