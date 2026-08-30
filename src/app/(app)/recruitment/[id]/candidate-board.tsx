'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Paperclip, Trash2, Star, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Label } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import {
  addCandidateAction,
  moveCandidateAction,
  deleteCandidateAction,
  uploadResumeAction,
} from '../actions'

export interface CandidateView {
  id: string
  fullName: string
  phone: string | null
  email: string | null
  stage: string
  stageLabel: string
  rating: number | null
  notes: string | null
  createdAt: string
  hasResume: boolean
  resumeUrl: string | null
  resumeName: string | null
}

const STAGES = [
  { value: 'APPLIED', label: 'تقدّم' },
  { value: 'SCREENING', label: 'فرز' },
  { value: 'INTERVIEW', label: 'مقابلة' },
  { value: 'OFFER', label: 'عرض' },
  { value: 'HIRED', label: 'تم التعيين' },
  { value: 'REJECTED', label: 'مرفوض' },
] as const

const STAGE_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral' | 'primary'> = {
  APPLIED: 'neutral',
  SCREENING: 'info',
  INTERVIEW: 'primary',
  OFFER: 'warning',
  HIRED: 'success',
  REJECTED: 'danger',
}

export function CandidateBoard({
  requestId,
  candidates,
  canEdit,
  canAdd,
}: {
  requestId: string
  candidates: CandidateView[]
  canEdit: boolean
  canAdd: boolean
}) {
  const [adding, setAdding] = useState(false)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>المرشّحون ({candidates.length})</CardTitle>
          {canAdd && !adding && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="size-4" aria-hidden />
              أضف مرشّحًا
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {adding && (
          <AddCandidate
            requestId={requestId}
            onDone={() => setAdding(false)}
          />
        )}

        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            لا مرشّحين بعد على هذا الشاغر.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {candidates.map((c) => (
              <li key={c.id} className="py-4 first:pt-0 last:pb-0">
                <CandidateItem candidate={c} canEdit={canEdit} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function AddCandidate({
  requestId,
  onDone,
}: {
  requestId: string
  onDone: () => void
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    notes: '',
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    start(async () => {
      const result = await addCandidateAction({ requestId, ...form })
      if (!result.ok) {
        toast.error(result.message ?? 'تعذّر إضافة المرشّح.')
        return
      }
      toast.success('أُضيف المرشّح.')
      setForm({ fullName: '', phone: '', email: '', notes: '' })
      onDone()
      router.refresh()
    })
  }

  return (
    <form
      method="post"
      onSubmit={submit}
      noValidate
      className="mb-5 space-y-3 rounded-[var(--radius-md)] border border-border bg-surface-muted p-4"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="cand-name" required>
            الاسم
          </Label>
          <Input
            id="cand-name"
            className="mt-1.5"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="cand-phone">الجوال</Label>
          <Input
            id="cand-phone"
            type="tel"
            dir="ltr"
            className="mt-1.5 text-start"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="cand-email">البريد</Label>
          <Input
            id="cand-email"
            type="email"
            dir="ltr"
            className="mt-1.5 text-start"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="cand-notes">ملاحظات</Label>
        <Textarea
          id="cand-notes"
          rows={2}
          className="mt-1.5"
          maxLength={4000}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" type="submit" loading={pending}>
          أضف
        </Button>
        <Button size="sm" type="button" variant="ghost" onClick={onDone}>
          إلغاء
        </Button>
      </div>
    </form>
  )
}

function CandidateItem({
  candidate,
  canEdit,
}: {
  candidate: CandidateView
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  function move(stage: string) {
    start(async () => {
      const result = await moveCandidateAction(candidate.id, stage, null)
      if (!result.ok) {
        toast.error(result.message ?? 'تعذّر نقل المرشّح.')
        return
      }
      router.refresh()
    })
  }

  function rate(value: number) {
    start(async () => {
      const result = await moveCandidateAction(
        candidate.id,
        candidate.stage,
        value,
      )
      if (!result.ok) {
        toast.error(result.message ?? 'تعذّر حفظ التقييم.')
        return
      }
      router.refresh()
    })
  }

  function remove() {
    start(async () => {
      const result = await deleteCandidateAction(candidate.id)
      if (!result.ok) {
        toast.error(result.message ?? 'تعذّر الحذف.')
        return
      }
      toast.success('حُذف المرشّح وسيرته الذاتية.')
      router.refresh()
    })
  }

  function upload(file: File) {
    start(async () => {
      const data = new FormData()
      data.set('candidateId', candidate.id)
      data.set('file', file)

      const result = await uploadResumeAction(data)
      if (!result.ok) {
        toast.error(result.message ?? 'تعذّر رفع الملف.')
        return
      }
      toast.success('رُفعت السيرة الذاتية.')
      router.refresh()
    })
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium">{candidate.fullName}</div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            {candidate.phone && <span className="latin">{candidate.phone}</span>}
            {candidate.email && <span className="latin">{candidate.email}</span>}
            <span>{formatDate(new Date(candidate.createdAt))}</span>
          </div>
        </div>
        <Badge tone={STAGE_TONE[candidate.stage] ?? 'neutral'}>
          {candidate.stageLabel}
        </Badge>
      </div>

      {candidate.notes && (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {candidate.notes}
        </p>
      )}

      {candidate.resumeUrl && (
        <a
          href={candidate.resumeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary underline-offset-4 hover:underline"
        >
          <FileText className="size-3.5" aria-hidden />
          {candidate.resumeName ?? 'السيرة الذاتية'}
        </a>
      )}

      {canEdit && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor={`stage-${candidate.id}`} className="sr-only">
            مرحلة {candidate.fullName}
          </label>
          <select
            id={`stage-${candidate.id}`}
            value={candidate.stage}
            disabled={pending}
            onChange={(e) => move(e.target.value)}
            className="h-9 rounded-[var(--radius-md)] border border-border bg-surface px-2 text-xs"
          >
            {STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <div
            className="flex items-center gap-0.5"
            role="group"
            aria-label={`تقييم ${candidate.fullName}`}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                disabled={pending}
                onClick={() => rate(n)}
                aria-label={`${n} من ٥`}
                aria-pressed={candidate.rating === n}
                className="p-0.5"
              >
                <Star
                  className={
                    candidate.rating !== null && n <= candidate.rating
                      ? 'size-4 fill-warning text-warning'
                      : 'size-4 text-muted-foreground'
                  }
                  aria-hidden
                />
              </button>
            ))}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) upload(file)
              e.target.value = ''
            }}
          />
          <Button
            size="sm"
            variant="secondary"
            loading={pending}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="size-3.5" aria-hidden />
            {candidate.hasResume ? 'استبدل السيرة' : 'أرفق السيرة'}
          </Button>

          <Button size="sm" variant="ghost" loading={pending} onClick={remove}>
            <Trash2 className="size-3.5" aria-hidden />
            حذف
          </Button>
        </div>
      )}
    </div>
  )
}
