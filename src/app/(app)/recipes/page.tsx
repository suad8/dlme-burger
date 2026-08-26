import type { Metadata } from 'next'
import Link from 'next/link'
import { ChefHat, Info } from 'lucide-react'
import type { MenuClass } from '@prisma/client'
import { requireTenant } from '@/server/tenant'
import {
  getMenuEngineering,
  MENU_CLASS_LABELS,
  MENU_CLASS_ADVICE,
} from '@/server/services/recipes'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/states'
import { TableWrap, Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'الوصفات والتكاليف',
  robots: { index: false, follow: false },
}

const CLASS_TONE: Record<MenuClass, 'success' | 'info' | 'warning' | 'danger'> = {
  STAR: 'success',
  PUZZLE: 'info',
  PLOW_HORSE: 'warning',
  DOG: 'danger',
}

/** عتبة إرشادية شائعة في تشغيل المطاعم — تُعرض كتنبيه لا كحكم. */
const FOOD_COST_WARN = 35

export default async function RecipesPage() {
  const ctx = await requireTenant()
  const analysis = await getMenuEngineering(ctx)

  if (analysis.items.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
          الوصفات والتكاليف
        </h1>
        <EmptyState
          icon={ChefHat}
          title="لا توجد منتجات بعد"
          description="أضف منتجاتك ووصفاتها لتحتسب التكلفة ونسبة Food Cost وتصنيف هندسة المنيو."
        />
      </div>
    )
  }

  const classCounts = analysis.items.reduce<Record<string, number>>((acc, i) => {
    if (i.menuClass) acc[i.menuClass] = (acc[i.menuClass] ?? 0) + 1
    return acc
  }, {})

  const uncosted = analysis.items.filter((i) => !i.hasRecipe).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
          الوصفات والتكاليف
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          تكلفة كل صنف من مكوّناته، ونسبة Food Cost، وتصنيف هندسة المنيو.
        </p>
      </div>

      {/* المؤشرات */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'إجمالي الإيراد', value: formatCurrency(analysis.totalRevenue) },
          {
            label: 'متوسط Food Cost',
            value: `${formatNumber(analysis.avgFoodCostPct, 'ar-SA', 1)}٪`,
            warn: analysis.avgFoodCostPct > FOOD_COST_WARN,
          },
          {
            label: 'متوسط هامش المساهمة',
            value: formatCurrency(analysis.avgMargin),
          },
          {
            label: 'متوسط الشعبية',
            value: `${formatNumber(analysis.avgPopularity, 'ar-SA', 1)} وحدة`,
          },
        ].map((t) => (
          <Card key={t.label}>
            <CardContent className="pt-5">
              <div className="text-xs text-muted-foreground">{t.label}</div>
              <div
                className={cn(
                  'mt-1.5 text-2xl font-bold tabular',
                  t.warn && 'text-danger',
                )}
              >
                {t.value}
              </div>
              {t.warn && (
                <Badge tone="danger" className="mt-2">
                  أعلى من {FOOD_COST_WARN}٪
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* شرح التصنيف — التوصية تُفسَّر لا تُملى */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
            <div>
              <p className="text-sm font-medium">كيف صُنّفت الأصناف</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                كل صنف قُورن بمتوسط منيوك نفسه — لا بعتبة ثابتة. الصنف «شعبي» إذا
                تجاوزت مبيعاته{' '}
                <strong className="tabular">
                  {formatNumber(analysis.avgPopularity, 'ar-SA', 1)}
                </strong>{' '}
                وحدة، و«رابح» إذا تجاوز هامشه{' '}
                <strong className="tabular">
                  {formatCurrency(analysis.avgMargin)}
                </strong>
                .
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(MENU_CLASS_LABELS) as MenuClass[]).map((c) => (
              <div
                key={c}
                className="rounded-[var(--radius-md)] border border-border p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={CLASS_TONE[c]}>{MENU_CLASS_LABELS[c]}</Badge>
                  <span className="text-sm font-bold tabular">
                    {formatNumber(classCounts[c] ?? 0)}
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  {MENU_CLASS_ADVICE[c]}
                </p>
              </div>
            ))}
          </div>

          {uncosted > 0 && (
            <p className="mt-4 text-xs text-warning">
              {formatNumber(uncosted)} صنف بلا وصفة — لم يُصنَّف لأن تكلفته غير
              معروفة. لا نخمّن.
            </p>
          )}
        </CardContent>
      </Card>

      <TableWrap>
        <Table>
          <caption className="sr-only">تحليل تكلفة وربحية أصناف المنيو</caption>
          <THead>
            <TR>
              <TH scope="col">الصنف</TH>
              <TH scope="col">التصنيف</TH>
              <TH scope="col">سعر البيع</TH>
              <TH scope="col">التكلفة</TH>
              <TH scope="col">الهامش</TH>
              <TH scope="col">Food Cost</TH>
              <TH scope="col">المبيعات</TH>
              <TH scope="col">الإيراد</TH>
            </TR>
          </THead>
          <TBody>
            {analysis.items.map((i) => (
              <TR key={i.productId}>
                <TD>
                  <Link
                    href={`/recipes/${i.productId}`}
                    className="font-medium hover:underline underline-offset-4"
                  >
                    {i.name}
                  </Link>
                  {i.categoryName && (
                    <div className="text-[11px] text-muted-foreground">
                      {i.categoryName}
                    </div>
                  )}
                </TD>
                <TD>
                  {i.menuClass ? (
                    <Badge tone={CLASS_TONE[i.menuClass]}>
                      {MENU_CLASS_LABELS[i.menuClass]}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">بلا وصفة</Badge>
                  )}
                </TD>
                <TD className="tabular">{formatCurrency(i.sellPrice)}</TD>
                <TD className="tabular">
                  {i.hasRecipe ? formatCurrency(i.cost) : '—'}
                </TD>
                <TD className="tabular font-medium">
                  {i.hasRecipe ? formatCurrency(i.margin) : '—'}
                </TD>
                <TD>
                  {i.hasRecipe ? (
                    <span
                      className={cn(
                        'tabular font-medium',
                        i.foodCostPct > FOOD_COST_WARN && 'text-danger',
                      )}
                    >
                      {formatNumber(i.foodCostPct, 'ar-SA', 1)}٪
                    </span>
                  ) : (
                    '—'
                  )}
                </TD>
                <TD className="tabular">{formatNumber(i.unitsSold)}</TD>
                <TD className="tabular">{formatCurrency(i.revenue)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </TableWrap>
    </div>
  )
}
