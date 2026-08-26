'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { ActionStatus } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { transitionActionAction } from '../actions'

const LABELS: Record<ActionStatus, string> = {
  NEW: 'جديد',
  IN_PROGRESS: 'ابدأ التنفيذ',
  PENDING_REVIEW: 'أرسل للمراجعة',
  COMPLETED: 'اعتمد الإنجاز',
  OVERDUE: 'متأخر',
  CANCELLED: 'ألغِ الإجراء',
}

export function TransitionControls({
  actionId,
  current,
  next,
  canApprove,
}: {
  actionId: string
  current: ActionStatus
  next: ActionStatus[]
  canApprove: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  // الاعتماد صلاحية منفصلة — نخفيه لمن لا يملكها بدل إظهار زر يفشل
  const available = next.filter((s) => s !== 'COMPLETED' || canApprove)
  if (available.length === 0) return null

  function go(to: ActionStatus) {
    start(async () => {
      const result = await transitionActionAction(actionId, to)
      if (!result.ok) {
        toast.error(result.message ?? 'تعذّر تغيير الحالة.')
        return
      }
      toast.success('تم تحديث حالة الإجراء.')
      router.refresh()
    })
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs text-muted-foreground">
          الحالة الحالية: <span className="font-medium">{LABELS[current]}</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {available.map((s) => (
            <Button
              key={s}
              variant={
                s === 'COMPLETED' ? 'primary' : s === 'CANCELLED' ? 'ghost' : 'secondary'
              }
              size="sm"
              loading={pending}
              onClick={() => go(s)}
            >
              {LABELS[s]}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
