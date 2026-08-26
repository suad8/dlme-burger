import type { Metadata } from 'next'
import Link from 'next/link'
import { Briefcase, ArrowLeft, Clock } from 'lucide-react'
import { requireTenant } from '@/server/tenant'
import { can } from '@/server/rbac'
import { listCatalog, listOrders } from '@/server/services/service-orders'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { NoPermission, EmptyState } from '@/components/ui/states'
import { TableWrap, Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'الخدمات',
  robots: { index: false, follow: false },
}

const STATUS_TONE: Record<
  string,
  'success' | 'info' | 'warning' | 'danger' | 'neutral' | 'primary'
> = {
  SUBMITTED: 'info',
  QUOTED: 'warning',
  APPROVED: 'primary',
  IN_PROGRESS: 'primary',
  DELIVERED: 'success',
  CANCELLED: 'neutral',
  DRAFT: 'neutral',
}

export default async function ServicesPage() {
  const ctx = await requireTenant()

  if (!can(ctx, 'service:view')) {
    return (
      <NoPermission description="الخدمات متاحة لأدوار الإدارة في منشأتك." />
    )
  }

  const [catalog, orders] = await Promise.all([listCatalog(), listOrders(ctx)])
  const canOrder = can(ctx, 'service:create')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">الخدمات</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          خدمات تشغيلية ينفّذها فريق إتقان لمنشأتك — تطلبها هنا وتتابع تنفيذها.
        </p>
      </div>

      {/* طلباتي */}
      <section>
        <h2 className="text-base font-semibold">طلباتي</h2>
        <div className="mt-3">
          {orders.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="لا طلبات بعد"
              description="اختر خدمة من القائمة أدناه وأرسل طلبك؛ يصلك عرض سعر قبل أي التزام."
            />
          ) : (
            <TableWrap>
              <Table>
                <caption className="sr-only">طلبات الخدمات</caption>
                <THead>
                  <TR>
                    <TH scope="col">الرقم</TH>
                    <TH scope="col">الخدمة</TH>
                    <TH scope="col">الفرع</TH>
                    <TH scope="col">الحالة</TH>
                    <TH scope="col">السعر</TH>
                    <TH scope="col">التاريخ</TH>
                  </TR>
                </THead>
                <TBody>
                  {orders.map((o) => (
                    <TR key={o.id}>
                      <TD>
                        <Link
                          href={`/service-orders/${o.id}`}
                          className="latin text-xs font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {o.reference}
                        </Link>
                      </TD>
                      <TD className="font-medium">{o.serviceName}</TD>
                      <TD className="text-sm text-muted-foreground">
                        {o.branchName ?? 'كل الفروع'}
                      </TD>
                      <TD>
                        <Badge tone={STATUS_TONE[o.status] ?? 'neutral'}>
                          {o.statusLabel}
                        </Badge>
                      </TD>
                      <TD className="tabular">
                        {o.quotedPrice === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          formatCurrency(o.quotedPrice)
                        )}
                      </TD>
                      <TD className="text-xs text-muted-foreground">
                        {formatDate(o.createdAt)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          )}
        </div>
      </section>

      {/* الكتالوج */}
      <section>
        <h2 className="text-base font-semibold">الخدمات المتاحة</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.map((s) => (
            <Card key={s.id} className="flex flex-col">
              <CardHeader>
                <Badge tone="neutral" className="w-fit">
                  {s.category}
                </Badge>
                <CardTitle className="mt-2 text-base">{s.name}</CardTitle>
                <CardDescription>{s.summary}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    {s.basePrice === null ? (
                      <span className="text-sm font-semibold">حسب الطلب</span>
                    ) : (
                      <>
                        <span className="text-lg font-bold tabular">
                          {formatCurrency(s.basePrice)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {' '}
                          تبدأ من
                        </span>
                      </>
                    )}
                  </div>
                  {s.durationDays !== null && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" aria-hidden />
                      {formatNumber(s.durationDays)} يوم
                    </span>
                  )}
                </div>

                {canOrder ? (
                  <Link
                    href={`/service-orders/new/${s.slug}`}
                    className="mt-4 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-primary px-4 text-sm font-medium text-primary-foreground [transition:background-color_var(--dur-fast)_var(--ease-smooth)] hover:bg-primary-hover"
                  >
                    اطلب الخدمة
                    <ArrowLeft className="size-4" aria-hidden />
                  </Link>
                ) : (
                  <p className="mt-4 text-xs text-muted-foreground">
                    طلب الخدمات يتطلب صلاحية إضافية.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
