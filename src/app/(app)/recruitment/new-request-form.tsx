'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Label } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createRequestAction } from './actions'

const EMPTY = {
  position: '',
  quantity: '1',
  branchId: '',
  description: '',
  salaryMin: '',
  salaryMax: '',
  neededBy: '',
}

export function NewRequestForm({
  branches,
}: {
  branches: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)

  function set(key: keyof typeof EMPTY, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()

    start(async () => {
      const result = await createRequestAction(form)
      if (!result.ok) {
        toast.error(result.message ?? 'تعذّر إنشاء الطلب.')
        return
      }
      toast.success('فُتح طلب التوظيف.')
      setForm(EMPTY)
      setOpen(false)
      router.push(`/recruitment/${result.data!.id}`)
      router.refresh()
    })
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        طلب توظيف جديد
      </Button>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>طلب توظيف جديد</CardTitle>
      </CardHeader>
      <CardContent>
        <form method="post" onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="rec-position" required>
                المسمّى الوظيفي
              </Label>
              <Input
                id="rec-position"
                className="mt-1.5"
                value={form.position}
                onChange={(e) => set('position', e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="rec-quantity" required>
                العدد المطلوب
              </Label>
              <Input
                id="rec-quantity"
                type="number"
                min="1"
                max="500"
                dir="ltr"
                className="mt-1.5 text-start"
                value={form.quantity}
                onChange={(e) => set('quantity', e.target.value)}
                required
              />
            </div>

            {branches.length > 0 && (
              <div>
                <Label htmlFor="rec-branch">الفرع</Label>
                <select
                  id="rec-branch"
                  value={form.branchId}
                  onChange={(e) => set('branchId', e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm"
                >
                  <option value="">غير محدّد</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <Label htmlFor="rec-needed">مطلوب بحلول</Label>
              <Input
                id="rec-needed"
                type="date"
                dir="ltr"
                className="mt-1.5 text-start"
                value={form.neededBy}
                onChange={(e) => set('neededBy', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="rec-min">أقل راتب (ر.س)</Label>
              <Input
                id="rec-min"
                type="number"
                min="0"
                step="100"
                dir="ltr"
                className="mt-1.5 text-start"
                value={form.salaryMin}
                onChange={(e) => set('salaryMin', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="rec-max">أعلى راتب (ر.س)</Label>
              <Input
                id="rec-max"
                type="number"
                min="0"
                step="100"
                dir="ltr"
                className="mt-1.5 text-start"
                value={form.salaryMax}
                onChange={(e) => set('salaryMax', e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="rec-desc">وصف الوظيفة</Label>
            <Textarea
              id="rec-desc"
              rows={3}
              className="mt-1.5"
              maxLength={4000}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" loading={pending}>
              افتح الطلب
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
