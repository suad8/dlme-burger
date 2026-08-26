'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Label, FieldHint } from '@/components/ui/input'
import { createOrderAction } from '../../actions'

export interface FieldSpec {
  key: string
  label: string
  type: 'text' | 'number' | 'select'
  required: boolean
  options?: string[]
}

export function OrderForm({
  slug,
  fields,
  branches,
}: {
  slug: string
  fields: FieldSpec[]
  branches: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [branchId, setBranchId] = useState('')

  function set(key: string, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()

    start(async () => {
      const result = await createOrderAction(
        slug,
        branchId === '' ? null : branchId,
        answers,
      )

      if (!result.ok) {
        toast.error(result.message ?? 'تعذّر إرسال الطلب.')
        return
      }

      toast.success('أُرسل طلبك. يصلك عرض سعر قريبًا.')
      router.push(`/service-orders/${result.data!.id}`)
      router.refresh()
    })
  }

  return (
    <form method="post" onSubmit={submit} className="space-y-4" noValidate>
      {branches.length > 0 && (
        <div>
          <Label htmlFor="order-branch">الفرع المعني</Label>
          <select
            id="order-branch"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="mt-1.5 h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm"
          >
            <option value="">كل الفروع</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {fields.map((field) => {
        const id = `req-${field.key}`
        const value = answers[field.key] ?? ''

        return (
          <div key={field.key}>
            <Label htmlFor={id} required={field.required}>
              {field.label}
            </Label>

            {field.type === 'select' && field.options ? (
              <select
                id={id}
                value={value}
                onChange={(e) => set(field.key, e.target.value)}
                required={field.required}
                className="mt-1.5 h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm"
              >
                <option value="">اختر…</option>
                {field.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : field.type === 'number' ? (
              <Input
                id={id}
                type="number"
                inputMode="decimal"
                className="mt-1.5"
                value={value}
                onChange={(e) => set(field.key, e.target.value)}
                required={field.required}
              />
            ) : (
              <Textarea
                id={id}
                rows={3}
                className="mt-1.5"
                value={value}
                onChange={(e) => set(field.key, e.target.value)}
                required={field.required}
                maxLength={2000}
              />
            )}
          </div>
        )
      })}

      {fields.length === 0 && (
        <FieldHint>لا تحتاج هذه الخدمة معلومات إضافية.</FieldHint>
      )}

      <Button type="submit" loading={pending}>
        أرسل الطلب
      </Button>
    </form>
  )
}
