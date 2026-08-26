import type { Metadata } from 'next'
import { Boxes, TriangleAlert, Trash2 } from 'lucide-react'
import { requireTenant } from '@/server/tenant'
import { listInventory, getWasteSummary } from '@/server/services/inventory'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/states'
import { TableWrap, Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { FilterTabs } from '@/components/app/filter-tabs'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'المخزون والهدر',
  robots: { index: false, follow: false },
}

const TABS = [
  { value: 'ALL', label: 'كل الأصناف' },
  { value: 'low', label: 'تحت حد الطلب' },
]

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const ctx = await requireTenant()
  const params = await searchParams
  const lowOnly = params.filter === 'low'

  const [rows, waste] = await Promise.all([
    listInventory(ctx, { lowOnly }),
    getWasteSummary(ctx, 30),
  ])

  const totalValue = rows.reduce((s, r) => s + r.value, 0)
  const lowCount = rows.filter((r) => r.belowReorder).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
          المخزون والهدر
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          الأرصدة الحالية وحد إعادة الطلب، وتحليل الهدر بأسبابه خلال ٣٠ يومًا.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Boxes className="size-4" aria-hidden />
              قيمة المخزون
            </div>
            <div className="mt-2 text-2xl font-bold tabular">
              {formatCurrency(totalValue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TriangleAlert className="size-4" aria-hidden />
              تحت حد الطلب
            </div>
            <div
              className={cn(
                'mt-2 text-2xl font-bold tabular',
                lowCount > 0 && 'text-danger',
              )}
            >
              {formatNumber(lowCount)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Trash2 className="size-4" aria-hidden />
              تكلفة الهدر
            </div>
            <div className="mt-2 text-2xl font-bold tabular">
              {formatCurrency(waste.totalCost)}
            </div>
            <Badge tone="neutral" className="mt-2">
              {formatNumber(waste.totalRecords)} سجل
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="text-xs text-muted-foreground">أكبر سبب للهدر</div>
            <div className="mt-2 text-lg font-bold">
              {waste.byReason[0]?.label ?? '—'}
            </div>
            {waste.byReason[0] && (
              <div className="mt-1 text-xs text-muted-foreground tabular">
                {formatCurrency(waste.byReason[0].cost)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* توزيع الهدر بالأسباب */}
      {waste.byReason.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>الهدر حسب السبب</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {waste.byReason.map((r) => {
                const pct =
                  waste.totalCost > 0 ? (r.cost / waste.totalCost) * 100 : 0
                return (
                  <li key={r.reason}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span>{r.label}</span>
                      <span className="tabular font-medium">
                        {formatCurrency(r.cost)}
                        <span className="ms-2 text-xs text-muted-foreground">
                          {formatNumber(pct, 'ar-SA', 0)}٪
                        </span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className="h-full rounded-full bg-danger"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <FilterTabs param="filter" options={TABS} current={lowOnly ? 'low' : 'ALL'} />

      {rows.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title={lowOnly ? 'لا أصناف تحت حد الطلب' : 'لا يوجد مخزون بعد'}
          description={
            lowOnly
              ? 'كل الأصناف فوق حد إعادة الطلب.'
              : 'أضف الأصناف والمكوّنات لتبدأ متابعة الأرصدة والهدر.'
          }
        />
      ) : (
        <TableWrap>
          <Table>
            <caption className="sr-only">أرصدة المخزون حسب الفرع والصنف</caption>
            <THead>
              <TR>
                <TH scope="col">الصنف</TH>
                <TH scope="col">الفرع</TH>
                <TH scope="col">الرصيد</TH>
                <TH scope="col">حد الطلب</TH>
                <TH scope="col">تكلفة الوحدة</TH>
                <TH scope="col">القيمة</TH>
                <TH scope="col">الحالة</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="font-medium">{r.ingredientName}</TD>
                  <TD className="text-sm">{r.branchName}</TD>
                  <TD className="tabular">
                    {formatNumber(r.quantityOnHand, 'ar-SA', 2)}
                    <span className="ms-1 text-xs text-muted-foreground">
                      {r.unit}
                    </span>
                  </TD>
                  <TD className="tabular text-muted-foreground">
                    {formatNumber(r.reorderLevel, 'ar-SA', 2)}
                  </TD>
                  <TD className="tabular">{formatCurrency(r.unitCost)}</TD>
                  <TD className="tabular font-medium">{formatCurrency(r.value)}</TD>
                  <TD>
                    {r.belowReorder ? (
                      <Badge tone="danger">أعد الطلب</Badge>
                    ) : (
                      <Badge tone="success">كافٍ</Badge>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </div>
  )
}
