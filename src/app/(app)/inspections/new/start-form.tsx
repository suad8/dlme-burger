'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { startInspectionAction } from '../actions'

export function StartInspectionForm({
  branches,
  templates,
}: {
  branches: { id: string; name: string }[]
  templates: { id: string; name: string; passScore: number }[]
}) {
  const router = useRouter()
  const [branchId, setBranchId] = useState(branches[0]?.id ?? '')
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '')
  const [pending, start] = useTransition()

  function handleStart() {
    if (!branchId || !templateId) {
      toast.error('اختر الفرع والقالب.')
      return
    }
    start(async () => {
      const result = await startInspectionAction(branchId, templateId)
      if (!result.ok) {
        toast.error(result.message ?? 'تعذّر بدء الفحص.')
        return
      }
      router.push(`/inspections/${result.data!.id}`)
    })
  }

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="text-sm font-medium">الفرع</legend>
        <div className="mt-2 space-y-2">
          {branches.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBranchId(b.id)}
              aria-pressed={branchId === b.id}
              className={cn(
                'tap-target flex w-full items-center justify-between rounded-[var(--radius-md)] border px-4 text-sm transition-colors',
                branchId === b.id
                  ? 'border-primary bg-primary-soft font-semibold text-primary'
                  : 'border-border bg-surface hover:bg-surface-muted',
              )}
            >
              {b.name}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">قالب الفحص</legend>
        <div className="mt-2 space-y-2">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplateId(t.id)}
              aria-pressed={templateId === t.id}
              className={cn(
                'tap-target flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border px-4 text-sm transition-colors',
                templateId === t.id
                  ? 'border-primary bg-primary-soft font-semibold text-primary'
                  : 'border-border bg-surface hover:bg-surface-muted',
              )}
            >
              <span className="truncate">{t.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground tabular">
                نجاح {t.passScore}٪
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <Button className="w-full" size="lg" onClick={handleStart} loading={pending}>
        ابدأ الفحص
      </Button>

      <Label className="sr-only" htmlFor="noop">
        بدء الفحص
      </Label>
    </div>
  )
}
