'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { approveOrderAction, cancelOrderAction } from '../actions'

export function OrderActions({
  orderId,
  status,
  canApprove,
  canCancel,
}: {
  orderId: string
  status: string
  canApprove: boolean
  canCancel: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  const showApprove = status === 'QUOTED' && canApprove
  const showCancel =
    (status === 'SUBMITTED' || status === 'QUOTED') && canCancel

  if (!showApprove && !showCancel) return null

  function approve() {
    start(async () => {
      const result = await approveOrderAction(orderId)
      if (!result.ok) {
        toast.error(result.message ?? 'تعذّر اعتماد الطلب.')
        return
      }

      const data = result.data!
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl
        return
      }

      // الوضع الوهمي: نقول الحقيقة — أُنشئت فاتورة ولم يُحصَّل شيء،
      // والطلب يبقى بانتظار تأكيد الدفع لا معتمدًا
      toast.info(
        `أُنشئت الفاتورة ${data.invoiceNumber}. لم يُحصَّل أي مبلغ — بوابة الدفع غير مفعّلة، والطلب يبقى بانتظار الدفع.`,
      )
      router.refresh()
    })
  }

  function cancel() {
    start(async () => {
      const result = await cancelOrderAction(orderId)
      if (!result.ok) {
        toast.error(result.message ?? 'تعذّر إلغاء الطلب.')
        return
      }
      toast.success('أُلغي الطلب.')
      router.refresh()
    })
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-2 py-4">
        {showApprove && (
          <Button loading={pending} onClick={approve}>
            <Check className="size-4" aria-hidden />
            اعتمد وادفع
          </Button>
        )}
        {showCancel && (
          <Button variant="secondary" loading={pending} onClick={cancel}>
            <X className="size-4" aria-hidden />
            إلغاء الطلب
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
