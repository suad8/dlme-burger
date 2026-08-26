import type { Metadata } from 'next'
import { Users, FileWarning } from 'lucide-react'
import type { EmployeeStatus } from '@prisma/client'
import { requireTenant } from '@/server/tenant'
import {
  listEmployees,
  getEmployeeStats,
  EMPLOYEE_STATUS_LABELS,
} from '@/server/services/employees'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/states'
import { TableWrap, Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { FilterTabs } from '@/components/app/filter-tabs'
import { formatDate, formatNumber } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'الموظفون',
  robots: { index: false, follow: false },
}

const STATUS_TONE: Record<EmployeeStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ACTIVE: 'success',
  ON_LEAVE: 'warning',
  SUSPENDED: 'danger',
  TERMINATED: 'neutral',
}

const TABS = [
  { value: 'ALL', label: 'الكل' },
  { value: 'ACTIVE', label: 'على رأس العمل' },
  { value: 'ON_LEAVE', label: 'إجازة' },
  { value: 'TERMINATED', label: 'منتهية خدمته' },
]

function parseStatus(v: string | undefined): EmployeeStatus | 'ALL' {
  const valid = ['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED']
  return v && valid.includes(v) ? (v as EmployeeStatus) : 'ALL'
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const ctx = await requireTenant()
  const params = await searchParams
  const status = parseStatus(params.status)

  const [employees, stats] = await Promise.all([
    listEmployees(ctx, { status }),
    getEmployeeStats(ctx),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">الموظفون</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ملفات الفريق وحالة التدريب وتنبيهات انتهاء المستندات.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'إجمالي الموظفين', value: formatNumber(stats.total) },
          { label: 'على رأس العمل', value: formatNumber(stats.active) },
          {
            label: 'أكملوا التدريب',
            value: `${formatNumber(stats.trainedPct, 'ar-SA', 1)}٪`,
          },
          {
            label: 'مستندات تنتهي خلال شهر',
            value: formatNumber(stats.expiringDocuments),
            warn: stats.expiringDocuments > 0,
          },
        ].map((t) => (
          <Card key={t.label}>
            <CardContent className="pt-5">
              <div className="text-xs text-muted-foreground">{t.label}</div>
              <div
                className={
                  t.warn
                    ? 'mt-1.5 text-2xl font-bold tabular text-danger'
                    : 'mt-1.5 text-2xl font-bold tabular'
                }
              >
                {t.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <FilterTabs param="status" options={TABS} current={status} />

      {employees.length === 0 ? (
        <EmptyState
          icon={Users}
          title="لا يوجد موظفون"
          description="أضف ملفات فريقك لمتابعة التدريب وصلاحية المستندات وتقييم الأداء."
        />
      ) : (
        <TableWrap>
          <Table>
            <caption className="sr-only">قائمة الموظفين وحالتهم</caption>
            <THead>
              <TR>
                <TH scope="col">الاسم</TH>
                <TH scope="col">الرقم</TH>
                <TH scope="col">المنصب</TH>
                <TH scope="col">الفرع</TH>
                <TH scope="col">التدريب</TH>
                <TH scope="col">التقييم</TH>
                <TH scope="col">الحالة</TH>
                <TH scope="col">تنبيهات</TH>
              </TR>
            </THead>
            <TBody>
              {employees.map((e) => (
                <TR key={e.id}>
                  <TD>
                    <div className="font-medium">{e.fullName}</div>
                    {e.hiredAt && (
                      <div className="text-[11px] text-muted-foreground">
                        منذ {formatDate(e.hiredAt)}
                      </div>
                    )}
                  </TD>
                  <TD className="latin text-xs">{e.employeeNo ?? '—'}</TD>
                  <TD className="text-sm">{e.position}</TD>
                  <TD className="text-sm">{e.branchName ?? '—'}</TD>
                  <TD>
                    {e.trainingDone ? (
                      <Badge tone="success">مكتمل</Badge>
                    ) : (
                      <Badge tone="warning">غير مكتمل</Badge>
                    )}
                  </TD>
                  <TD className="tabular">
                    {e.lastRating === null ? '—' : `${formatNumber(e.lastRating)} / ٥`}
                  </TD>
                  <TD>
                    <Badge tone={STATUS_TONE[e.status]}>
                      {EMPLOYEE_STATUS_LABELS[e.status]}
                    </Badge>
                  </TD>
                  <TD>
                    {e.expiringDocuments.length === 0 ? (
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {e.expiringDocuments.map((d) => (
                          <span
                            key={`${e.id}-${d.type}`}
                            className="inline-flex items-center gap-1 text-[11px] text-danger"
                          >
                            <FileWarning className="size-3" aria-hidden />
                            {d.label} — {formatDate(d.expiresAt)}
                          </span>
                        ))}
                      </div>
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
