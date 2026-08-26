import type { Metadata } from 'next'
import Link from 'next/link'
import { CircleCheck, Plus, LayoutList, Columns3 } from 'lucide-react'
import type { ActionStatus } from '@prisma/client'
import { requireTenant } from '@/server/tenant'
import { can } from '@/server/rbac'
import {
  listActions,
  getActionBoard,
  STATUS_LABELS,
  PRIORITY_LABELS,
} from '@/server/services/actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/states'
import { TableWrap, Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { Pagination } from '@/components/app/pagination'
import { FilterTabs } from '@/components/app/filter-tabs'
import { formatDate, formatNumber, cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'الإجراءات التصحيحية',
  robots: { index: false, follow: false },
}

const STATUS_TONE: Record<ActionStatus, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  NEW: 'info',
  IN_PROGRESS: 'warning',
  PENDING_REVIEW: 'accent' as 'warning',
  COMPLETED: 'success',
  OVERDUE: 'danger',
  CANCELLED: 'neutral',
}

const PRIORITY_TONE = {
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'warning',
  CRITICAL: 'danger',
} as const

const TABS = [
  { value: 'OPEN', label: 'المفتوحة' },
  { value: 'ALL', label: 'الكل' },
  { value: 'NEW', label: 'جديد' },
  { value: 'IN_PROGRESS', label: 'قيد التنفيذ' },
  { value: 'PENDING_REVIEW', label: 'بانتظار المراجعة' },
  { value: 'OVERDUE', label: 'متأخر' },
  { value: 'COMPLETED', label: 'مكتمل' },
]

const BOARD_ORDER: ActionStatus[] = ['NEW', 'IN_PROGRESS', 'PENDING_REVIEW', 'OVERDUE']

export default async function ActionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; view?: string }>
}) {
  const ctx = await requireTenant()
  const params = await searchParams
  const view = params.view === 'board' ? 'board' : 'list'
  const status = (params.status ?? 'OPEN') as ActionStatus | 'ALL' | 'OPEN'
  const page = Math.max(1, Number(params.page) || 1)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            الإجراءات التصحيحية
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            كل مخالفة لها مسؤول وموعد نهائي واعتماد بعد الإنجاز.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ViewToggle current={view} status={status} />
          {can(ctx, 'action:create') && (
            <Button asChild size="sm">
              <Link href="/actions/new">
                <Plus className="size-4" aria-hidden />
                أنشئ إجراءً
              </Link>
            </Button>
          )}
        </div>
      </div>

      {view === 'board' ? (
        <BoardView />
      ) : (
        <>
          <FilterTabs param="status" options={TABS} current={status} />
          <ListView status={status} page={page} />
        </>
      )}
    </div>
  )
}

function ViewToggle({
  current,
  status,
}: {
  current: string
  status: string
}) {
  const qs = status && status !== 'OPEN' ? `&status=${status}` : ''
  return (
    <div
      role="group"
      aria-label="طريقة العرض"
      className="inline-flex rounded-[var(--radius-md)] border border-border bg-surface p-0.5"
    >
      <Link
        href={`/actions?view=list${qs}`}
        aria-current={current === 'list' ? 'page' : undefined}
        className={cn(
          'flex items-center gap-1.5 rounded-[calc(var(--radius-md)-3px)] px-3 py-1.5 text-xs font-medium transition-colors',
          current === 'list'
            ? 'bg-primary-soft text-primary'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <LayoutList className="size-3.5" aria-hidden />
        قائمة
      </Link>
      <Link
        href="/actions?view=board"
        aria-current={current === 'board' ? 'page' : undefined}
        className={cn(
          'flex items-center gap-1.5 rounded-[calc(var(--radius-md)-3px)] px-3 py-1.5 text-xs font-medium transition-colors',
          current === 'board'
            ? 'bg-primary-soft text-primary'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Columns3 className="size-3.5" aria-hidden />
        لوحة
      </Link>
    </div>
  )
}

async function ListView({
  status,
  page,
}: {
  status: ActionStatus | 'ALL' | 'OPEN'
  page: number
}) {
  const ctx = await requireTenant()
  const { items, total, perPage } = await listActions(ctx, { status, page })

  if (items.length === 0) {
    return (
      <EmptyState
        icon={CircleCheck}
        title="لا توجد إجراءات"
        description="الإجراءات تُفتح تلقائيًا عند تسجيل مخالفة حرجة، أو يدويًا عند الحاجة."
        {...(can(ctx, 'action:create')
          ? { actionLabel: 'أنشئ إجراءً', actionHref: '/actions/new' }
          : {})}
      />
    )
  }

  return (
    <>
      <TableWrap>
        <Table>
          <caption className="sr-only">قائمة الإجراءات التصحيحية</caption>
          <THead>
            <TR>
              <TH scope="col">المرجع</TH>
              <TH scope="col">العنوان</TH>
              <TH scope="col">الفرع</TH>
              <TH scope="col">المسؤول</TH>
              <TH scope="col">الأولوية</TH>
              <TH scope="col">الحالة</TH>
              <TH scope="col">الاستحقاق</TH>
            </TR>
          </THead>
          <TBody>
            {items.map((a) => (
              <TR key={a.id}>
                <TD>
                  <Link
                    href={`/actions/${a.id}`}
                    className="latin text-xs font-medium hover:underline underline-offset-4"
                  >
                    {a.reference}
                  </Link>
                </TD>
                <TD className="text-sm font-medium">{a.title}</TD>
                <TD className="text-sm">{a.branchName}</TD>
                <TD className="text-sm">{a.assigneeName ?? '—'}</TD>
                <TD>
                  <Badge tone={PRIORITY_TONE[a.priority]}>
                    {PRIORITY_LABELS[a.priority]}
                  </Badge>
                </TD>
                <TD>
                  <Badge tone={STATUS_TONE[a.status]}>
                    {STATUS_LABELS[a.status]}
                  </Badge>
                </TD>
                <TD
                  className={cn(
                    'text-xs',
                    a.isOverdue ? 'font-semibold text-danger' : 'text-muted-foreground',
                  )}
                >
                  {formatDate(a.dueAt)}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </TableWrap>
      <Pagination total={total} page={page} perPage={perPage} />
    </>
  )
}

async function BoardView() {
  const ctx = await requireTenant()
  const columns = await getActionBoard(ctx)
  const totalOpen = BOARD_ORDER.reduce(
    (sum, s) => sum + (columns[s]?.length ?? 0),
    0,
  )

  if (totalOpen === 0) {
    return (
      <EmptyState
        icon={CircleCheck}
        title="لا إجراءات مفتوحة"
        description="كل الإجراءات مكتملة. ستظهر هنا فور فتح إجراء جديد."
      />
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {BOARD_ORDER.map((status) => {
        const items = columns[status] ?? []
        return (
          <section
            key={status}
            className="rounded-[var(--radius-lg)] border border-border bg-surface-muted/40 p-3"
            aria-label={STATUS_LABELS[status]}
          >
            <div className="flex items-center justify-between gap-2 px-1">
              <h2 className="text-sm font-semibold">{STATUS_LABELS[status]}</h2>
              <span className="text-xs text-muted-foreground tabular">
                {formatNumber(items.length)}
              </span>
            </div>

            <ul className="mt-3 space-y-2">
              {items.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/actions/${a.id}`}
                    className="block rounded-[var(--radius-md)] border border-border bg-surface p-3 transition-shadow hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="latin text-[10px] text-muted-foreground">
                        {a.reference}
                      </span>
                      <Badge tone={PRIORITY_TONE[a.priority]}>
                        {PRIORITY_LABELS[a.priority]}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-sm font-medium leading-snug">
                      {a.title}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span className="truncate">{a.branch.name}</span>
                      <span className="shrink-0">{formatDate(a.dueAt)}</span>
                    </div>
                  </Link>
                </li>
              ))}
              {items.length === 0 && (
                <li className="rounded-[var(--radius-md)] border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                  لا يوجد
                </li>
              )}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
