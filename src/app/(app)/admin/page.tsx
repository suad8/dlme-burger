import type { Metadata } from 'next'
import { ShieldAlert, Building2, Users, Activity, KeyRound } from 'lucide-react'
import { requireSuperAdmin } from '@/server/tenant'
import { listAllOrders } from '@/server/services/service-orders'
import { OrderDesk } from './order-desk'
import {
  getPlatformStats,
  listOrganizations,
  listRecentAudit,
  listFailedLogins,
} from '@/server/services/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TableWrap, Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'لوحة النظام',
  robots: { index: false, follow: false },
}

const ORG_STATUS_LABELS: Record<string, string> = {
  TRIAL: 'تجربة',
  ACTIVE: 'نشط',
  PAST_DUE: 'متأخر السداد',
  SUSPENDED: 'موقوف',
  CANCELLED: 'ملغي',
}

const ORG_STATUS_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  TRIAL: 'info',
  ACTIVE: 'success',
  PAST_DUE: 'warning',
  SUSPENDED: 'danger',
  CANCELLED: 'neutral',
}

export default async function AdminPage() {
  // 404 لغير مدير النظام — لا نكشف وجود المسار
  const ctx = await requireSuperAdmin()

  const [stats, orgs, audit, failedLogins, serviceOrders] = await Promise.all([
    getPlatformStats(ctx),
    listOrganizations(ctx),
    listRecentAudit(ctx, 30),
    listFailedLogins(ctx, 15),
    listAllOrders(ctx, 25),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-danger-soft text-danger">
          <ShieldAlert className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            لوحة النظام
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            عرض عابر للمنشآت — كل ما تفعله هنا يُسجَّل في سجل التدقيق.
          </p>
        </div>
      </div>

      {/* مؤشرات المنصة */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Building2, label: 'المنشآت', value: stats.organizations },
          { icon: Users, label: 'المستخدمون', value: stats.users },
          { icon: Activity, label: 'الزيارات المسجّلة', value: stats.inspections },
          {
            icon: KeyRound,
            label: 'محاولات دخول فاشلة (٢٤س)',
            value: stats.failedLogins24h,
            warn: stats.failedLogins24h > 10,
          },
        ].map((t) => (
          <Card key={t.label}>
            <CardContent className="pt-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <t.icon className="size-4" aria-hidden />
                {t.label}
              </div>
              <div
                className={
                  t.warn
                    ? 'mt-2 text-2xl font-bold tabular text-danger'
                    : 'mt-2 text-2xl font-bold tabular'
                }
              >
                {formatNumber(t.value)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'نشطة', value: stats.activeOrganizations, tone: 'success' as const },
          { label: 'تجربة', value: stats.trialOrganizations, tone: 'info' as const },
          { label: 'موقوفة', value: stats.suspendedOrganizations, tone: 'danger' as const },
          { label: 'أحداث التدقيق', value: stats.auditEvents, tone: 'neutral' as const },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-[var(--radius-md)] border border-border bg-surface p-3"
          >
            <div className="text-lg font-bold tabular">{formatNumber(s.value)}</div>
            <Badge tone={s.tone} className="mt-1.5">
              {s.label}
            </Badge>
          </div>
        ))}
      </div>

      {/* مكتب طلبات الخدمة */}
      <Card>
        <CardHeader>
          <CardTitle>طلبات الخدمة</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderDesk
            orders={serviceOrders.map((o) => ({
              ...o,
              createdAt: o.createdAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>

      {/* المنشآت */}
      <Card>
        <CardHeader>
          <CardTitle>المنشآت</CardTitle>
        </CardHeader>
        <CardContent>
          <TableWrap className="border-0">
            <Table>
              <caption className="sr-only">كل منشآت المنصة</caption>
              <THead>
                <TR>
                  <TH scope="col">المنشأة</TH>
                  <TH scope="col">المعرّف</TH>
                  <TH scope="col">الحالة</TH>
                  <TH scope="col">الباقة</TH>
                  <TH scope="col">الفروع</TH>
                  <TH scope="col">الأعضاء</TH>
                  <TH scope="col">الاشتراك الشهري</TH>
                  <TH scope="col">أُنشئت</TH>
                </TR>
              </THead>
              <TBody>
                {orgs.map((o) => (
                  <TR key={o.id}>
                    <TD className="font-medium">
                      {o.name}
                      {o.city && (
                        <div className="text-[11px] text-muted-foreground">
                          {o.city}
                        </div>
                      )}
                    </TD>
                    <TD className="latin text-xs">{o.slug}</TD>
                    <TD>
                      <Badge tone={ORG_STATUS_TONE[o.status] ?? 'neutral'}>
                        {ORG_STATUS_LABELS[o.status] ?? o.status}
                      </Badge>
                    </TD>
                    <TD className="text-sm">{o.planName ?? '—'}</TD>
                    <TD className="tabular">{formatNumber(o.branchCount)}</TD>
                    <TD className="tabular">{formatNumber(o.memberCount)}</TD>
                    <TD className="tabular">
                      {o.monthlyPrice > 0 ? formatCurrency(o.monthlyPrice) : '—'}
                    </TD>
                    <TD className="text-xs text-muted-foreground">
                      {formatDate(o.createdAt)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* سجل التدقيق */}
        <Card>
          <CardHeader>
            <CardTitle>آخر العمليات الحساسة</CardTitle>
          </CardHeader>
          <CardContent>
            {audit.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا عمليات مسجّلة بعد.</p>
            ) : (
              <ul className="divide-y divide-border">
                {audit.map((a) => (
                  <li key={a.id} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="latin text-xs font-medium">{a.action}</span>
                      <time
                        dateTime={a.createdAt.toISOString()}
                        className="shrink-0 text-[11px] text-muted-foreground"
                      >
                        {formatDateTime(a.createdAt)}
                      </time>
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {a.actorName ?? 'نظام'}
                      {a.organizationName ? ` · ${a.organizationName}` : ''}
                      {a.ipAddress ? ` · ${a.ipAddress}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* محاولات الدخول الفاشلة */}
        <Card>
          <CardHeader>
            <CardTitle>محاولات دخول فاشلة</CardTitle>
          </CardHeader>
          <CardContent>
            {failedLogins.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                لا محاولات فاشلة مسجّلة.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {failedLogins.map((l) => (
                  <li key={l.id} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="latin truncate text-xs">{l.email}</span>
                      <time
                        dateTime={l.createdAt.toISOString()}
                        className="shrink-0 text-[11px] text-muted-foreground"
                      >
                        {formatDateTime(l.createdAt)}
                      </time>
                    </div>
                    {l.ipAddress && (
                      <div className="latin mt-0.5 text-[11px] text-muted-foreground">
                        {l.ipAddress}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
