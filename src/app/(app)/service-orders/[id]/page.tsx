import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, Receipt } from 'lucide-react'
import { requireTenant } from '@/server/tenant'
import { can } from '@/server/rbac'
import {
  getOrder,
  OrderNotFoundError,
} from '@/server/services/service-orders'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { NoPermission } from '@/components/ui/states'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { OrderActions } from './order-actions'

export const metadata: Metadata = {
  title: 'طلب خدمة',
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

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requireTenant()

  if (!can(ctx, 'service:view')) {
    return <NoPermission description="الخدمات متاحة لأدوار الإدارة في منشأتك." />
  }

  const { id } = await params

  let order
  try {
    order = await getOrder(ctx, id)
  } catch (error) {
    // طلب منشأة أخرى يبدو غير موجود — لا نكشف أنه موجود لدى غيرنا
    if (error instanceof OrderNotFoundError) notFound()
    throw error
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/service-orders"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-4" aria-hidden />
        الخدمات
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            {order.serviceName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="latin">{order.reference}</span> ·{' '}
            {order.branchName ?? 'كل الفروع'} · {formatDate(order.createdAt)}
          </p>
        </div>
        <Badge tone={STATUS_TONE[order.status] ?? 'neutral'}>
          {order.statusLabel}
        </Badge>
      </div>

      {/* عرض السعر */}
      {order.quotedPrice !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="size-4" aria-hidden />
              عرض السعر
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular">
              {formatCurrency(order.quotedPrice)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              يُضاف إليه ضريبة القيمة المضافة ١٥٪ عند الدفع.
            </p>
            {order.quoteNote && (
              <p className="mt-3 text-sm leading-relaxed">{order.quoteNote}</p>
            )}

            {order.invoice && (
              <p className="mt-3 text-xs text-muted-foreground">
                الفاتورة <span className="latin">{order.invoice.number}</span> —{' '}
                {formatCurrency(order.invoice.total)} (
                {order.invoice.status === 'PAID' ? 'مدفوعة' : 'غير مدفوعة'})
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <OrderActions
        orderId={order.id}
        status={order.status}
        canApprove={can(ctx, 'service:approve')}
        canCancel={can(ctx, 'service:delete')}
      />

      {/* تفاصيل الطلب */}
      {order.requirements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>تفاصيل الطلب</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {order.requirements.map((r) => (
                <div key={r.label}>
                  <dt className="text-xs text-muted-foreground">{r.label}</dt>
                  <dd className="mt-0.5 leading-relaxed">{r.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      {/* المسار */}
      <Card>
        <CardHeader>
          <CardTitle>مسار الطلب</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="relative space-y-5 border-s border-border ps-5">
            {order.events.map((e, i) => (
              <li key={`${e.status}-${i}`} className="relative">
                <span
                  className="absolute -start-[23px] top-1 size-2.5 rounded-full bg-primary ring-4 ring-surface"
                  aria-hidden
                />
                <div className="text-sm font-medium">{e.label}</div>
                {e.note && (
                  <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
                    {e.note}
                  </p>
                )}
                <time className="mt-0.5 block text-xs text-muted-foreground">
                  {formatDateTime(e.at)}
                </time>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
