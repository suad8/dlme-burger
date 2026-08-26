import type { Metadata } from 'next'
import { Download, ChartNoAxesColumn } from 'lucide-react'
import { requireTenant } from '@/server/tenant'
import { can } from '@/server/rbac'
import { REPORTS, buildReport, type ReportKey } from '@/server/services/reports'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TableWrap, Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { FilterTabs } from '@/components/app/filter-tabs'
import { PeriodTabs } from '@/components/app/period-tabs'
import { formatNumber } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'التقارير',
  robots: { index: false, follow: false },
}

const KEYS = REPORTS.map((r) => r.key)

function parseKey(v: string | undefined): ReportKey {
  return v && (KEYS as string[]).includes(v)
    ? (v as ReportKey)
    : 'branch-performance'
}

function parsePeriod(v: string | undefined): 7 | 30 | 90 {
  if (v === '7') return 7
  if (v === '90') return 90
  return 30
}

const PREVIEW_ROWS = 25

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string; period?: string }>
}) {
  const ctx = await requireTenant()
  const params = await searchParams
  const key = parseKey(params.report)
  const period = parsePeriod(params.period)

  const table = await buildReport(ctx, key, period)
  const meta = REPORTS.find((r) => r.key === key)!
  const exportable = can(ctx, 'report:export')

  const exportHref = `/api/reports/${key}?period=${period}`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            التقارير
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ctx.branchScope
              ? 'التقارير مقيّدة بالفروع المصرّح لك بها.'
              : 'تقارير كل فروع المنشأة.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodTabs current={period} />
          {exportable ? (
            <Button asChild size="sm">
              {/* التصدير عبر مسار خادمي يعيد فرض الصلاحية — لا يُبنى في المتصفح */}
              <a href={exportHref} download>
                <Download className="size-4" aria-hidden />
                صدّر CSV
              </a>
            </Button>
          ) : (
            <Badge tone="neutral">التصدير غير متاح لدورك</Badge>
          )}
        </div>
      </div>

      <FilterTabs
        param="report"
        options={REPORTS.map((r) => ({ value: r.key, label: r.title }))}
        current={key}
      />

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start gap-2">
            <ChartNoAxesColumn
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden
            />
            <div>
              <p className="text-sm font-medium">{meta.title}</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {meta.description}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground tabular">
            {formatNumber(table.rows.length)} صف
            {table.rows.length > PREVIEW_ROWS && (
              <>
                {' '}
                — يُعرض أول {formatNumber(PREVIEW_ROWS)}، والتصدير يشمل الكل
              </>
            )}
          </p>
        </CardContent>
      </Card>

      {table.rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              لا توجد بيانات في هذه الفترة. جرّب فترة أطول.
            </p>
          </CardContent>
        </Card>
      ) : (
        <TableWrap>
          <Table>
            <caption className="sr-only">{table.title}</caption>
            <THead>
              <TR>
                {table.headers.map((h) => (
                  <TH key={h} scope="col">
                    {h}
                  </TH>
                ))}
              </TR>
            </THead>
            <TBody>
              {table.rows.slice(0, PREVIEW_ROWS).map((row, i) => (
                <TR key={i}>
                  {row.map((cell, j) => (
                    <TD key={j} className={j === 0 ? 'font-medium' : ''}>
                      {typeof cell === 'number' ? formatNumber(cell) : cell || '—'}
                    </TD>
                  ))}
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </div>
  )
}
