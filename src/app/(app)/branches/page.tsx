import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2, Plus } from 'lucide-react'
import { requireTenant } from '@/server/tenant'
import { can } from '@/server/rbac'
import { listBranches } from '@/server/services/branches'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/states'
import { TableWrap, Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { formatNumber } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'الفروع',
  robots: { index: false, follow: false },
}

const STATUS_LABEL = {
  ACTIVE: 'نشط',
  TEMPORARILY_CLOSED: 'مغلق مؤقتًا',
  UNDER_SETUP: 'قيد التجهيز',
  CLOSED: 'مغلق',
} as const

const STATUS_TONE = {
  ACTIVE: 'success',
  TEMPORARILY_CLOSED: 'warning',
  UNDER_SETUP: 'info',
  CLOSED: 'neutral',
} as const

export default async function BranchesPage() {
  const ctx = await requireTenant()
  const branches = await listBranches(ctx)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">الفروع</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ctx.branchScope
              ? 'الفروع المصرّح لك بالاطلاع عليها.'
              : 'كل فروع المنشأة.'}
          </p>
        </div>
        {can(ctx, 'branch:create') && (
          <Button asChild size="sm">
            <Link href="/branches/new">
              <Plus className="size-4" aria-hidden />
              أضف فرعًا
            </Link>
          </Button>
        )}
      </div>

      {branches.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="لا توجد فروع بعد"
          description="أضف أول فرع لتبدأ جدولة الفحوصات ومتابعة الالتزام."
          {...(can(ctx, 'branch:create')
            ? { actionLabel: 'أضف فرعًا', actionHref: '/branches/new' }
            : {})}
        />
      ) : (
        <TableWrap>
          <Table>
            <caption className="sr-only">
              قائمة فروع المنشأة مع حالتها وعدد الإجراءات المفتوحة
            </caption>
            <THead>
              <TR>
                <TH scope="col">الفرع</TH>
                <TH scope="col">الرمز</TH>
                <TH scope="col">العلامة</TH>
                <TH scope="col">المدينة</TH>
                <TH scope="col">المدير</TH>
                <TH scope="col">الحالة</TH>
                <TH scope="col">إجراءات مفتوحة</TH>
              </TR>
            </THead>
            <TBody>
              {branches.map((b) => (
                <TR key={b.id}>
                  <TD>
                    <Link
                      href={`/branches/${b.id}`}
                      className="font-medium hover:underline underline-offset-4"
                    >
                      {b.name}
                    </Link>
                    {b.district ? (
                      <div className="text-xs text-muted-foreground">
                        {b.district}
                      </div>
                    ) : null}
                  </TD>
                  <TD className="latin text-xs">{b.code}</TD>
                  <TD className="text-sm">{b.brandName}</TD>
                  <TD className="text-sm">{b.city ?? '—'}</TD>
                  <TD className="text-sm">{b.managerName ?? '—'}</TD>
                  <TD>
                    <Badge tone={STATUS_TONE[b.status]}>
                      {STATUS_LABEL[b.status]}
                    </Badge>
                  </TD>
                  <TD>
                    {b.openActions > 0 ? (
                      <Badge tone="danger">{formatNumber(b.openActions)}</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
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
