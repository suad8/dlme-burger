'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CircleCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { approveInspectionAction } from '../actions'

export function ApproveButton({ inspectionId }: { inspectionId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <Button
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const result = await approveInspectionAction(inspectionId)
          if (!result.ok) {
            toast.error(result.message ?? 'تعذّر اعتماد الزيارة.')
            return
          }
          toast.success('اعتُمدت الزيارة.')
          router.refresh()
        })
      }
    >
      <CircleCheck className="size-4" aria-hidden />
      اعتمد الزيارة
    </Button>
  )
}
