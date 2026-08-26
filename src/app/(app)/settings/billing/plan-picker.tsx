'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Lock } from 'lucide-react'
import type { PlanTier } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'
import { startCheckoutAction } from './actions'

export interface PlanOptionView {
  id: string
  tier: PlanTier
  name: string
  monthlyPrice: number
  yearlyPrice: number
  maxBranches: number
  maxUsers: number
  maxBrands: number
  isCurrent: boolean
  blockedReason: string | null
}

export function PlanPicker({ plans }: { plans: PlanOptionView[] }) {
  const router = useRouter()
  const [cycle, setCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY')
  const [pending, start] = useTransition()
  const [target, setTarget] = useState<PlanTier | null>(null)

  function choose(tier: PlanTier) {
    setTarget(tier)
    start(async () => {
      const result = await startCheckoutAction(tier, cycle)
      setTarget(null)

      if (!result.ok) {
        toast.error(result.message ?? 'تعذّر بدء الاشتراك.')
        return
      }

      const data = result.data!

      if (data.redirectUrl) {
        // بوابة حقيقية — ننتقل إليها لإتمام الدفع
        window.location.href = data.redirectUrl
        return
      }

      // الوضع الوهمي: نقول الحقيقة بدل ادّعاء نجاح التحصيل
      toast.info(
        `أُنشئت الفاتورة ${data.invoiceNumber}، ولم يُحصَّل أي مبلغ — بوابة الدفع غير مفعّلة.`,
      )
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>تغيير الباقة</CardTitle>
          <div
            role="group"
            aria-label="دورة الفوترة"
            className="inline-flex rounded-[var(--radius-md)] border border-border bg-surface p-0.5"
          >
            {(
              [
                { value: 'MONTHLY', label: 'شهري' },
                { value: 'YEARLY', label: 'سنوي' },
              ] as const
            ).map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setCycle(o.value)}
                aria-pressed={cycle === o.value}
                className={cn(
                  'rounded-[calc(var(--radius-md)-3px)] px-3 py-1.5 text-xs font-medium [transition:background-color_var(--dur-fast)_var(--ease-smooth)]',
                  cycle === o.value
                    ? 'bg-primary-soft text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {plans.map((p) => {
            const price = cycle === 'YEARLY' ? p.yearlyPrice : p.monthlyPrice
            const isCustom = price <= 0
            const blocked = Boolean(p.blockedReason)

            return (
              <div
                key={p.id}
                className={cn(
                  'rounded-[var(--radius-md)] border p-4',
                  p.isCurrent
                    ? 'border-primary bg-primary-soft/40'
                    : 'border-border bg-surface',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{p.name}</h3>
                  {p.isCurrent && <Badge tone="primary">باقتك الحالية</Badge>}
                </div>

                <div className="mt-2">
                  {isCustom ? (
                    <span className="text-lg font-bold">حسب الطلب</span>
                  ) : (
                    <>
                      <span className="text-xl font-bold tabular">
                        {formatCurrency(price)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {cycle === 'YEARLY' ? ' / سنويًا' : ' / شهريًا'}
                      </span>
                    </>
                  )}
                </div>

                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <li className="flex items-center gap-1.5">
                    <Check className="size-3 text-success" aria-hidden />
                    {formatNumber(p.maxBranches)} فرع
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="size-3 text-success" aria-hidden />
                    {formatNumber(p.maxUsers)} مستخدم
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="size-3 text-success" aria-hidden />
                    {formatNumber(p.maxBrands)} علامة تجارية
                  </li>
                </ul>

                {blocked && (
                  <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-danger">
                    <Lock className="mt-0.5 size-3 shrink-0" aria-hidden />
                    {p.blockedReason}
                  </p>
                )}

                <Button
                  className="mt-4 w-full"
                  size="sm"
                  variant={p.isCurrent ? 'secondary' : 'primary'}
                  disabled={p.isCurrent || blocked || isCustom}
                  loading={pending && target === p.tier}
                  onClick={() => choose(p.tier)}
                >
                  {p.isCurrent
                    ? 'الباقة الحالية'
                    : isCustom
                      ? 'تواصل معنا'
                      : blocked
                        ? 'غير متاحة'
                        : 'انتقل إلى هذه الباقة'}
                </Button>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
