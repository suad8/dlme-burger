import type { Metadata } from 'next'
import Link from 'next/link'
import { ClipboardCheck, Plus } from 'lucide-react'
import type { InspectionStatus } from '@prisma/client'
import { requireTenant } from '@/server/tenant'
import { can } from '@/server/rbac'
import { listInspections } from '@/server/services/inspections'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/states'
import { TableWrap, Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { Pagination } from '@/components/app/pagination'
import { FilterTabs } from '@/components/app/filter-tabs'
import { formatDate, formatNumber } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'الزيارات',
  robots: { index: false, follow: false },
}

const STATUS_LABEL: Record<InspectionStatus, string> = {
  DRAFT: 'مسودة',
  IN_PROGRESS: 'قيد التنفيذ',
  SUBMITTED: 'بانتظار الاعتماد',
  APPROVED: 'معتمد',
  OVERDUE: 'متأخر',
  CANCELLED: 'ملغي',
}

const STATUS_TONE: Record<InspectionStatus, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'neutral',
  IN_PROGRESS: 'info',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  OVERDUE: 'danger',
  CANCELLED: 'neutral',
}

const TABS = [
  { value: 'ALL', label: 'الكل' },
  { value: 'IN_PROGRESS', label: 'قيد التنفيذ' },
  { value: 'SUBMITTED', label: 'بانتظار الاعتماد' },
  { value: 'APPROVED', label: 'معتمد' },
  { value: 'OVERDUE', label: 'متأخر' },
]

function parseStatus(v: string | undefined): InspectionStatus | 'ALL' {
  const valid = ['DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'OVERDUE', 'CANCELLED']
  return v && valid.includes(v) ? (v as InspectionStatus) : 'ALL'
}

export default async function InspectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const ctx = await requireTenant()
  const params = await searchParams
  const status = parseStatus(params.status)
  const page = Math.max(1, Number(params.page) || 1)

  const { items, total, perPage } = await listInspections(ctx, { status, page })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">الزيارات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatNumber(total)} زيارة
            {ctx.branchScope ? ' ضمن فروعك' : ''}.
          </p>
        </div>
        {can(ctx, 'inspection:create') && (
          <Button asChild size="sm">
            <Link href="/inspections/new">
              <Plus className="size-4" aria-hidden />
              ابدأ الفحص
            </Link>
          </Button>
        )}
      </div>

      <FilterTabs param="status" options={TABS} current={status} />

      {items.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="لا توجد زيارات"
          description="ابدأ فحصًا جديدًا لتظهر نتائجه هنا وتُحتسب في درجة الالتزام."
          {...(can(ctx, 'inspection:create')
            ? { actionLabel: 'ابدأ الفحص', actionHref: '/inspections/new' }
            : {})}
        />
      ) : (
        <>
          <TableWrap>
            <Table>
              <caption className="sr-only">قائمة الزيارات ونتائجها</caption>
              <THead>
                <TR>
                  <TH scope="col">المرجع</TH>
                  <TH scope="col">القالب</TH>
                  <TH scope="col">الفرع</TH>
                  <TH scope="col">المفتش</TH>
                  <TH scope="col">النتيجة</TH>
                  <TH scope="col">الحالة</TH>
                  <TH scope="col">التاريخ</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((i) => (
                  <TR key={i.id}>
                    <TD>
                      <Link
                        href={`/inspections/${i.id}`}
                        className="latin text-xs font-medium hover:underline underline-offset-4"
                      >
                        {i.reference}
                      </Link>
                    </TD>
                    <TD className="text-sm">{i.templateName}</TD>
                    <TD className="text-sm">{i.branchName}</TD>
                    <TD className="text-sm">{i.inspectorName ?? '—'}</TD>
                    <TD>
                      {i.score === null ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={
                            i.passed
                              ? 'font-bold tabular text-success'
                              : 'font-bold tabular text-danger'
                          }
                        >
                          {formatNumber(i.score, 'ar-SA', 1)}٪
                        </span>
                      )}
                    </TD>
                    <TD>
                      <Badge tone={STATUS_TONE[i.status]}>
                        {STATUS_LABEL[i.status]}
                      </Badge>
                    </TD>
                    <TD className="text-xs text-muted-foreground">
                      {formatDate(i.submittedAt ?? i.dueAt)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>

          <Pagination total={total} page={page} perPage={perPage} />
        </>
      )}
    </div>
  )
}
