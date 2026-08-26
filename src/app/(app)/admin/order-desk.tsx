'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Label } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { quoteOrderAction, advanceOrderAction } from './service-actions'

export interface AdminOrderView {
  id: string
  reference: string
  status: string
  statusLabel: string
  serviceName: string
  organizationName: string
  quotedPrice: number | null
  version: number
  createdAt: string
  requirements: { label: string; value: string }[]
}

export function OrderDesk({ orders }: { orders: AdminOrderView[] }) {
  if (orders.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">لا طلبات خدمة نشطة.</p>
    )
  }

  return (
    <ul className="divide-y divide-border">
      {orders.map((order) => (
        <li key={order.id} className="py-4 first:pt-0 last:pb-0">
          <OrderCard order={order} />
        </li>
      ))}
    </ul>
  )
}

function OrderCard({ order }: { order: AdminOrderView }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [price, setPrice] = useState('')
  const [note, setNote] = useState('')
  const [open, setOpen] = useState(false)

  function quote(event: React.FormEvent) {
    event.preventDefault()
    const value = Number(price)

    start(async () => {
      const result = await quoteOrderAction(order.id, value, note, order.version)
      if (!result.ok) {
        toast.error(result.message ?? 'تعذّر تسجيل عرض السعر.')
        return
      }
      toast.success('سُجّل عرض السعر وأُبلغت المنشأة.')
      setOpen(false)
      router.refresh()
    })
  }

  function advance(to: 'IN_PROGRESS' | 'DELIVERED') {
    start(async () => {
      const result = await advanceOrderAction(order.id, to, '')
      if (!result.ok) {
        toast.error(result.message ?? 'تعذّر تحديث الحالة.')
        return
      }
      toast.success(to === 'DELIVERED' ? 'سُجّل التسليم.' : 'بدأ التنفيذ.')
      router.refresh()
    })
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium">{order.serviceName}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            <span className="latin">{order.reference}</span> ·{' '}
            {order.organizationName} · {formatDate(new Date(order.createdAt))}
          </div>
        </div>
        <Badge tone={order.status === 'SUBMITTED' ? 'info' : 'neutral'}>
          {order.statusLabel}
        </Badge>
      </div>

      {order.requirements.length > 0 && (
        <dl className="mt-2 space-y-1 text-xs">
          {order.requirements.map((r) => (
            <div key={r.label} className="flex gap-2">
              <dt className="shrink-0 text-muted-foreground">{r.label}:</dt>
              <dd className="line-clamp-2">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {order.quotedPrice !== null && (
        <div className="mt-2 text-sm tabular">
          السعر المعروض: <strong>{formatCurrency(order.quotedPrice)}</strong>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {order.status === 'SUBMITTED' && !open && (
          <Button size="sm" onClick={() => setOpen(true)}>
            سعّر الطلب
          </Button>
        )}
        {order.status === 'APPROVED' && (
          <Button size="sm" loading={pending} onClick={() => advance('IN_PROGRESS')}>
            ابدأ التنفيذ
          </Button>
        )}
        {order.status === 'IN_PROGRESS' && (
          <Button size="sm" loading={pending} onClick={() => advance('DELIVERED')}>
            سجّل التسليم
          </Button>
        )}
      </div>

      {open && (
        <form
          method="post"
          onSubmit={quote}
          noValidate
          className="mt-3 space-y-3 rounded-[var(--radius-md)] border border-border bg-surface-muted p-3"
        >
          <div>
            <Label htmlFor={`price-${order.id}`} required>
              السعر قبل الضريبة (ر.س)
            </Label>
            <Input
              id={`price-${order.id}`}
              type="number"
              min="1"
              step="0.01"
              dir="ltr"
              className="mt-1.5 text-start"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor={`note-${order.id}`}>ملاحظة للعميل</Label>
            <Textarea
              id={`note-${order.id}`}
              rows={2}
              className="mt-1.5"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" type="submit" loading={pending}>
              أرسل العرض
            </Button>
            <Button
              size="sm"
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              إلغاء
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
