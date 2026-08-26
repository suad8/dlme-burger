import type { Metadata } from 'next'
import { Building2, CreditCard, Users, ShieldCheck } from 'lucide-react'
import { requireTenant } from '@/server/tenant'
import { authorize, can, ROLE_LABELS } from '@/server/rbac'
import { getOrganizationSettings } from '@/server/services/settings'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TableWrap, Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { formatCurrency, formatDate, formatNumber, toNumber } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'الإعدادات',
  robots: { index: false, follow: false },
}

const SUB_STATUS_LABELS: Record<string, string> = {
  TRIALING: 'تجربة مجانية',
  ACTIVE: 'نشط',
  PAST_DUE: 'متأخر السداد',
  GRACE: 'فترة سماح',
  CANCELLED: 'ملغي',
  EXPIRED: 'منتهٍ',
}

const SUB_STATUS_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  TRIALING: 'info',
  ACTIVE: 'success',
  PAST_DUE: 'danger',
  GRACE: 'warning',
  CANCELLED: 'neutral',
  EXPIRED: 'neutral',
}

export default async function SettingsPage() {
  const ctx = await requireTenant()
  authorize(ctx, 'org:view')

  const data = await getOrganizationSettings(ctx)
  const showBilling = can(ctx, 'billing:view')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">الإعدادات</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          بيانات المنشأة والفريق والاشتراك.
        </p>
      </div>

      {/* بيانات المنشأة */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-4" aria-hidden />
            المنشأة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">الاسم</dt>
              <dd className="mt-0.5 font-medium">{data.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">المعرّف</dt>
              <dd className="latin mt-0.5 text-xs font-medium">{data.slug}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">الرقم الضريبي</dt>
              <dd className="latin mt-0.5 text-xs font-medium">
                {data.vatNumber ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">المدينة</dt>
              <dd className="mt-0.5 font-medium">{data.city ?? '—'}</dd>
            </div>
          </dl>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { label: 'العلامات التجارية', value: data.brandCount },
              { label: 'الفروع', value: data.branchCount },
              { label: 'أعضاء الفريق', value: data.memberCount },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-[var(--radius-md)] border border-border p-3"
              >
                <div className="text-lg font-bold tabular">
                  {formatNumber(s.value)}
                </div>
                <div className="text-[11px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* الاشتراك — يُخفى عمّن لا يملك billing:view */}
      {showBilling && data.subscription && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-4" aria-hidden />
              الاشتراك
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-bold">
                  {data.subscription.planName}
                </div>
                <div className="mt-0.5 text-sm text-muted-foreground tabular">
                  {formatCurrency(toNumber(data.subscription.monthlyPrice))} / شهريًا
                </div>
              </div>
              <Badge tone={SUB_STATUS_TONE[data.subscription.status] ?? 'neutral'}>
                {SUB_STATUS_LABELS[data.subscription.status] ?? data.subscription.status}
              </Badge>
            </div>

            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">نهاية الدورة</dt>
                <dd className="mt-0.5 font-medium">
                  {formatDate(data.subscription.currentPeriodEnd)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">حد الفروع</dt>
                <dd className="mt-0.5 font-medium tabular">
                  {formatNumber(data.branchCount)} /{' '}
                  {formatNumber(data.subscription.maxBranches)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">حد المستخدمين</dt>
                <dd className="mt-0.5 font-medium tabular">
                  {formatNumber(data.memberCount)} /{' '}
                  {formatNumber(data.subscription.maxUsers)}
                </dd>
              </div>
            </dl>

            {data.invoices.length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-semibold">آخر الفواتير</h3>
                <ul className="mt-2 divide-y divide-border">
                  {data.invoices.map((inv) => (
                    <li
                      key={inv.id}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <span className="latin text-xs">{inv.number}</span>
                      <span className="tabular">
                        {formatCurrency(toNumber(inv.total))}
                      </span>
                      <Badge tone={inv.status === 'PAID' ? 'success' : 'warning'}>
                        {inv.status === 'PAID' ? 'مدفوعة' : 'مستحقة'}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* الفريق */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4" aria-hidden />
            الفريق
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TableWrap className="border-0">
            <Table>
              <caption className="sr-only">أعضاء المنشأة وأدوارهم</caption>
              <THead>
                <TR>
                  <TH scope="col">الاسم</TH>
                  <TH scope="col">البريد</TH>
                  <TH scope="col">الدور</TH>
                  <TH scope="col">نطاق الفروع</TH>
                  <TH scope="col">الحالة</TH>
                </TR>
              </THead>
              <TBody>
                {data.members.map((m) => (
                  <TR key={m.id}>
                    <TD className="font-medium">{m.name}</TD>
                    <TD className="latin text-xs">{m.email}</TD>
                    <TD>
                      <Badge tone="primary">{ROLE_LABELS[m.role]}</Badge>
                    </TD>
                    <TD className="text-sm">
                      {m.branchNames.length === 0 ? (
                        <span className="text-muted-foreground">كل الفروع</span>
                      ) : (
                        m.branchNames.join('، ')
                      )}
                    </TD>
                    <TD>
                      <Badge tone={m.status === 'ACTIVE' ? 'success' : 'warning'}>
                        {m.status === 'ACTIVE' ? 'نشط' : 'مدعو'}
                      </Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </CardContent>
      </Card>

      {/* الأمان */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4" aria-hidden />
            الأمان
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li>• بيانات منشأتك معزولة بقيود في قاعدة البيانات لا في الواجهة فقط.</li>
            <li>• كل عملية حساسة تُسجَّل في سجل تدقيق مع الفاعل والوقت وعنوان IP.</li>
            <li>• كلمات المرور مخزَّنة بتجزئة أحادية الاتجاه ولا يمكن استرجاعها.</li>
            <li>
              • {formatNumber(data.auditCount)} عملية مسجّلة في سجل التدقيق حتى الآن.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
