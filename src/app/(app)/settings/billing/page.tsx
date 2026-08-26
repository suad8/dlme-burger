import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CreditCard, TriangleAlert } from 'lucide-react'
import { requireTenant } from '@/server/tenant'
import { NoPermission } from '@/components/ui/states'
import { can } from '@/server/rbac'
import { getBillingOverview, getPlanOptions } from '@/server/services/billing'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TableWrap, Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { formatCurrency, formatDate, formatNumber, cn } from '@/lib/utils'
import { PlanPicker } from './plan-picker'

export const metadata: Metadata = {
  title: 'الاشتراك والفوترة',
  robots: { index: false, follow: false },
}

const STATUS_LABELS: Record<string, string> = {
  TRIALING: 'تجربة مجانية',
  ACTIVE: 'نشط',
  PAST_DUE: 'متأخر السداد',
  GRACE: 'فترة سماح',
  CANCELLED: 'ملغي',
  EXPIRED: 'منتهٍ',
}

const STATUS_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  TRIALING: 'info',
  ACTIVE: 'success',
  PAST_DUE: 'danger',
  GRACE: 'warning',
  CANCELLED: 'neutral',
  EXPIRED: 'neutral',
}

const INVOICE_LABELS: Record<string, string> = {
  DRAFT: 'مسودة',
  ISSUED: 'صادرة',
  PAID: 'مدفوعة',
  OVERDUE: 'متأخرة',
  VOID: 'ملغاة',
  REFUNDED: 'مستردة',
}

function UsageBar({
  label,
  used,
  limit,
}: {
  label: string
  used: number
  limit: number
}) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const atLimit = limit > 0 && used >= limit

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className={cn('tabular font-medium', atLimit && 'text-danger')}>
          {formatNumber(used)} / {formatNumber(limit)}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className={cn(
            'h-full rounded-full',
            atLimit ? 'bg-danger' : pct > 80 ? 'bg-warning' : 'bg-primary',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default async function BillingPage() {
  const ctx = await requireTenant()
  if (!can(ctx, 'billing:view')) {
    return (
      <NoPermission
        description="الاشتراك والفوترة متاحان لمالك المنشأة والمحاسب. اطلب من مالك المنشأة تعديل دورك إن كنت تحتاج الاطلاع."
        backHref="/settings"
        backLabel="العودة إلى الإعدادات"
      />
    )
  }

  const [overview, plans] = await Promise.all([
    getBillingOverview(ctx),
    getPlanOptions(ctx),
  ])

  const canManage = can(ctx, 'billing:manage')

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-4" aria-hidden />
        الإعدادات
      </Link>

      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
          الاشتراك والفوترة
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          باقتك الحالية واستهلاكك وفواتيرك.
        </p>
      </div>

      {/* الاشتراك الحالي */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-4" aria-hidden />
            الاشتراك الحالي
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xl font-bold">
                {overview.planName ?? 'بلا اشتراك'}
              </div>
              {overview.monthlyPrice > 0 && (
                <div className="mt-0.5 text-sm text-muted-foreground tabular">
                  {formatCurrency(overview.monthlyPrice)} / شهريًا — شاملة ضريبة
                  القيمة المضافة ١٥٪
                </div>
              )}
            </div>
            {overview.status && (
              <Badge tone={STATUS_TONE[overview.status] ?? 'neutral'}>
                {STATUS_LABELS[overview.status] ?? overview.status}
              </Badge>
            )}
          </div>

          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">نهاية الدورة</dt>
              <dd className="mt-0.5 font-medium">
                {formatDate(overview.currentPeriodEnd)}
              </dd>
            </div>
            {overview.trialEndsAt && (
              <div>
                <dt className="text-xs text-muted-foreground">
                  نهاية التجربة المجانية
                </dt>
                <dd className="mt-0.5 font-medium">
                  {formatDate(overview.trialEndsAt)}
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-6 space-y-4">
            <h3 className="text-sm font-semibold">الاستهلاك مقابل حدود الباقة</h3>
            <UsageBar
              label="الفروع"
              used={overview.usage.branches}
              limit={overview.limits.branches}
            />
            <UsageBar
              label="المستخدمون"
              used={overview.usage.users}
              limit={overview.limits.users}
            />
            <UsageBar
              label="العلامات التجارية"
              used={overview.usage.brands}
              limit={overview.limits.brands}
            />
          </div>
        </CardContent>
      </Card>

      {/* تنويه صريح عن حالة المزوّد */}
      {!overview.providerIsLive && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-[var(--radius-md)] border border-warning/30 bg-warning-soft p-4"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="text-sm leading-relaxed">
            <strong>بوابة الدفع غير مفعّلة.</strong> تغيير الباقة يسجّل النية
            ولا يُحصّل أي مبلغ. لتفعيل التحصيل اضبط{' '}
            <code className="latin text-xs">BILLING_PROVIDER=moyasar</code>{' '}
            ومفاتيحه في البيئة.
          </div>
        </div>
      )}

      {/* اختيار الباقة */}
      {canManage ? (
        <PlanPicker plans={plans} />
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            تغيير الباقة يتطلب صلاحية إدارة الفوترة.
          </CardContent>
        </Card>
      )}

      {/* الفواتير */}
      <Card>
        <CardHeader>
          <CardTitle>الفواتير</CardTitle>
        </CardHeader>
        <CardContent>
          {overview.invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              لا فواتير بعد. ستظهر هنا فور أول عملية اشتراك.
            </p>
          ) : (
            <TableWrap className="border-0">
              <Table>
                <caption className="sr-only">فواتير الاشتراك</caption>
                <THead>
                  <TR>
                    <TH scope="col">الرقم</TH>
                    <TH scope="col">المبلغ</TH>
                    <TH scope="col">الحالة</TH>
                    <TH scope="col">تاريخ الإصدار</TH>
                  </TR>
                </THead>
                <TBody>
                  {overview.invoices.map((i) => (
                    <TR key={i.id}>
                      <TD className="latin text-xs font-medium">{i.number}</TD>
                      <TD className="tabular">{formatCurrency(i.total)}</TD>
                      <TD>
                        <Badge
                          tone={
                            i.status === 'PAID'
                              ? 'success'
                              : i.status === 'OVERDUE'
                                ? 'danger'
                                : 'neutral'
                          }
                        >
                          {INVOICE_LABELS[i.status] ?? i.status}
                        </Badge>
                      </TD>
                      <TD className="text-xs text-muted-foreground">
                        {formatDate(i.issuedAt)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
