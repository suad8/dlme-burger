import type { Metadata } from 'next'
import Link from 'next/link'
import { UserPlus } from 'lucide-react'
import { requireTenant } from '@/server/tenant'
import { can } from '@/server/rbac'
import { listRequests } from '@/server/services/recruitment'
import { listBranches } from '@/server/services/branches'
import { Badge } from '@/components/ui/badge'
import { NoPermission, EmptyState } from '@/components/ui/states'
import { TableWrap, Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils'
import { NewRequestForm } from './new-request-form'

export const metadata: Metadata = {
  title: 'التوظيف',
  robots: { index: false, follow: false },
}

const STATUS_TONE: Record<
  string,
  'success' | 'info' | 'warning' | 'danger' | 'neutral' | 'primary'
> = {
  DRAFT: 'neutral',
  OPEN: 'info',
  SCREENING: 'primary',
  INTERVIEWING: 'primary',
  OFFER: 'warning',
  CLOSED: 'success',
  CANCELLED: 'neutral',
}

export default async function RecruitmentPage() {
  const ctx = await requireTenant()

  if (!can(ctx, 'recruitment:view')) {
    return (
      <NoPermission description="التوظيف متاح لأدوار الموارد البشرية والإدارة." />
    )
  }

  const canCreate = can(ctx, 'recruitment:create')

  const [requests, branches] = await Promise.all([
    listRequests(ctx),
    canCreate ? listBranches(ctx) : Promise.resolve([]),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">التوظيف</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          طلبات التوظيف ومسار المرشّحين حتى التعيين.
        </p>
      </div>

      {canCreate && (
        <NewRequestForm
          branches={branches.map((b) => ({ id: b.id, name: b.name }))}
        />
      )}

      {requests.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="لا طلبات توظيف"
          description="افتح طلبًا بالمسمّى والعدد المطلوب، ثم أضف المرشّحين وتابع مراحلهم."
        />
      ) : (
        <TableWrap>
          <Table>
            <caption className="sr-only">طلبات التوظيف</caption>
            <THead>
              <TR>
                <TH scope="col">الوظيفة</TH>
                <TH scope="col">الفرع</TH>
                <TH scope="col">المطلوب</TH>
                <TH scope="col">المرشّحون</TH>
                <TH scope="col">النطاق</TH>
                <TH scope="col">الحالة</TH>
                <TH scope="col">التاريخ</TH>
              </TR>
            </THead>
            <TBody>
              {requests.map((r) => (
                <TR key={r.id}>
                  <TD className="font-medium">
                    <Link
                      href={`/recruitment/${r.id}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {r.position}
                    </Link>
                  </TD>
                  <TD className="text-sm text-muted-foreground">
                    {r.branchName ?? 'غير محدّد'}
                  </TD>
                  <TD className="tabular">{formatNumber(r.quantity)}</TD>
                  <TD className="tabular">
                    {formatNumber(r.candidateCount)}
                    {r.hiredCount > 0 && (
                      <span className="text-success">
                        {' '}
                        ({formatNumber(r.hiredCount)} معيَّن)
                      </span>
                    )}
                  </TD>
                  <TD className="text-xs text-muted-foreground tabular">
                    {r.salaryMin === null && r.salaryMax === null
                      ? '—'
                      : `${formatCurrency(r.salaryMin ?? 0)} – ${formatCurrency(r.salaryMax ?? 0)}`}
                  </TD>
                  <TD>
                    <Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>
                      {r.statusLabel}
                    </Badge>
                  </TD>
                  <TD className="text-xs text-muted-foreground">
                    {formatDate(r.createdAt)}
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
