'use client'

import { useState, useTransition, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, X, Camera, PenLine, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Textarea, Label } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn, formatNumber } from '@/lib/utils'
import {
  saveAnswersAction,
  submitInspectionAction,
  uploadEvidenceAction,
  deleteEvidenceAction,
} from '../actions'
import { SignaturePad } from '@/components/app/signature-pad'
import { PhotoCapture, type UploadedPhoto } from '@/components/app/photo-capture'

/**
 * منفّذ الفحص — مصمّم للجوال أولًا.
 *
 * كل هدف نقر ≥ 44px، والحفظ التلقائي يمنع فقد العمل إن أُغلق التطبيق أثناء
 * الزيارة الميدانية. الإغلاق ممنوع قبل إكمال الحقول الإلزامية — والتحقق
 * مكرَّر على الخادم لأن ما يصل من المتصفح لا يُوثق به.
 */

export interface ItemView {
  id: string
  label: string
  hint: string | null
  type: string
  required: boolean
  maxScore: number | null
  options: string[]
  criticalFail: boolean
}

export interface SectionView {
  id: string
  title: string
  items: ItemView[]
}

export interface AnswerState {
  itemId: string
  valueBool?: boolean | null
  valueText?: string | null
  valueNumber?: number | null
  valueChoice?: string | null
  scoreAwarded?: number | null
  note?: string | null
}

const AUTOSAVE_DELAY_MS = 1500

export function InspectionRunner({
  inspectionId,
  sections,
  initialAnswers,
  passScore,
}: {
  inspectionId: string
  sections: SectionView[]
  initialAnswers: Record<string, AnswerState>
  passScore: number
}) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, AnswerState>>(initialAnswers)
  const [submitting, startSubmit] = useTransition()
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef(false)

  const allItems = sections.flatMap((s) => s.items)
  const requiredItems = allItems.filter((i) => i.required)
  const completedRequired = requiredItems.filter((i) => hasValue(answers[i.id]))
  const missing = requiredItems.filter((i) => !hasValue(answers[i.id]))
  const progress =
    requiredItems.length === 0
      ? 100
      : Math.round((completedRequired.length / requiredItems.length) * 100)

  // حفظ تلقائي مؤجّل — لا نُرهق الخادم بطلب لكل ضغطة
  const scheduleSave = useCallback(
    (next: Record<string, AnswerState>) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      pendingRef.current = true
      timerRef.current = setTimeout(async () => {
        setSaveState('saving')
        const result = await saveAnswersAction(inspectionId, Object.values(next))
        pendingRef.current = false
        setSaveState(result.ok ? 'saved' : 'idle')
        if (!result.ok) toast.error(result.message ?? 'تعذّر الحفظ التلقائي.')
      }, AUTOSAVE_DELAY_MS)
    },
    [inspectionId],
  )

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // تحذير عند مغادرة الصفحة وهناك تغييرات لم تُحفظ بعد
  useEffect(() => {
    function warn(e: BeforeUnloadEvent) {
      if (pendingRef.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  function update(itemId: string, patch: Partial<AnswerState>) {
    setAnswers((prev) => {
      const next = {
        ...prev,
        [itemId]: { itemId, ...prev[itemId], ...patch },
      }
      scheduleSave(next)
      return next
    })
  }

  function handleSubmit() {
    if (missing.length > 0) {
      toast.error(
        `أكمل ${formatNumber(missing.length)} حقلًا إلزاميًا قبل الإغلاق.`,
      )
      const first = document.getElementById(`item-${missing[0]!.id}`)
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    startSubmit(async () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      const result = await submitInspectionAction(
        inspectionId,
        Object.values(answers),
      )

      if (!result.ok) {
        toast.error(result.message ?? 'تعذّر إغلاق الفحص.')
        return
      }

      const data = result.data!
      if (data.criticalFailures.length > 0) {
        toast.warning(
          `أُغلق الفحص. ${formatNumber(data.criticalFailures.length)} مخالفة حرجة فتحت إجراءات تصحيحية.`,
        )
      } else {
        toast.success(
          `أُغلق الفحص بنتيجة ${formatNumber(data.score, 'ar-SA', 1)}٪ — ${data.passed ? 'مطابق' : 'غير مطابق'}.`,
        )
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* شريط التقدّم — ثابت أعلى الشاشة أثناء التمرير */}
      <div className="sticky top-16 z-20 rounded-[var(--radius-md)] border border-border bg-surface/95 p-3 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-medium">
            {formatNumber(completedRequired.length)} / {formatNumber(requiredItems.length)} حقل إلزامي
          </span>
          <span className="text-muted-foreground">
            {saveState === 'saving'
              ? 'جارٍ الحفظ…'
              : saveState === 'saved'
                ? 'محفوظ'
                : `درجة النجاح ${passScore}٪`}
          </span>
        </div>
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="تقدّم إكمال الفحص"
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-200',
              progress === 100 ? 'bg-success' : 'bg-primary',
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {sections.map((section) => (
        <Card key={section.id}>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {section.items.map((item) => (
              <ItemField
                key={item.id}
                item={item}
                inspectionId={inspectionId}
                answer={answers[item.id]}
                onChange={(patch) => update(item.id, patch)}
              />
            ))}
          </CardContent>
        </Card>
      ))}

      {missing.length > 0 && (
        <div
          role="status"
          className="rounded-[var(--radius-md)] border border-warning/30 bg-warning-soft p-4"
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <TriangleAlert className="size-4" aria-hidden />
            {formatNumber(missing.length)} حقل إلزامي غير مكتمل
          </div>
          <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
            {missing.slice(0, 5).map((m) => (
              <li key={m.id}>• {m.label}</li>
            ))}
            {missing.length > 5 && <li>• وغيرها…</li>}
          </ul>
        </div>
      )}

      {/* شريط الإجراء ثابت أسفل الشاشة على الجوال */}
      <div className="sticky bottom-20 lg:bottom-0 z-20 rounded-[var(--radius-md)] border border-border bg-surface/95 p-3 backdrop-blur-sm">
        <Button
          className="w-full"
          size="lg"
          onClick={handleSubmit}
          loading={submitting}
          disabled={missing.length > 0}
        >
          أغلق الفحص واحتسب النتيجة
        </Button>
      </div>
    </div>
  )
}

function ItemField({
  item,
  inspectionId,
  answer,
  onChange,
}: {
  item: ItemView
  inspectionId: string
  answer: AnswerState | undefined
  onChange: (patch: Partial<AnswerState>) => void
}) {
  const answered = hasValue(answer)

  /**
   * الصورة تُرفع إلى المخزن، ويُحفظ في الإجابة مرجع المرفق لا محتواه.
   * `valueText` يحمل JSON مضغوطًا: { id, url, fileName }.
   */
  const photo = parsePhoto(answer?.valueText)

  async function handleUpload(file: File): Promise<UploadedPhoto | null> {
    const form = new FormData()
    form.set('file', file)
    form.set('inspectionId', inspectionId)

    const result = await uploadEvidenceAction(form)
    if (!result.ok || !result.data) {
      toast.error(result.message ?? 'تعذّر رفع الصورة.')
      return null
    }

    // الصورة السابقة تُحذف بعد نجاح الجديدة، لا قبله
    if (photo) void deleteEvidenceAction(photo.id, inspectionId)

    onChange({ valueText: JSON.stringify(result.data) })
    return result.data
  }

  function handleRemove() {
    if (photo) void deleteEvidenceAction(photo.id, inspectionId)
    onChange({ valueText: null })
  }

  return (
    <div id={`item-${item.id}`} className="scroll-mt-32">
      <div className="flex items-start justify-between gap-3">
        <Label htmlFor={`f-${item.id}`} required={item.required}>
          {item.label}
        </Label>
        {item.criticalFail && (
          <Badge tone="danger" className="shrink-0">
            بند حرج
          </Badge>
        )}
      </div>
      {item.hint && (
        <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
      )}

      <div className="mt-2.5">
        {item.type === 'YES_NO' && (
          <div className="flex gap-2" role="group" aria-label={item.label}>
            <button
              type="button"
              onClick={() => onChange({ valueBool: true })}
              aria-pressed={answer?.valueBool === true}
              className={cn(
                'tap-target flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] border text-sm font-medium transition-colors',
                answer?.valueBool === true
                  ? 'border-success bg-success-soft text-success'
                  : 'border-border bg-surface hover:bg-surface-muted',
              )}
            >
              <Check className="size-4" aria-hidden />
              نعم
            </button>
            <button
              type="button"
              onClick={() => onChange({ valueBool: false })}
              aria-pressed={answer?.valueBool === false}
              className={cn(
                'tap-target flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] border text-sm font-medium transition-colors',
                answer?.valueBool === false
                  ? 'border-danger bg-danger-soft text-danger'
                  : 'border-border bg-surface hover:bg-surface-muted',
              )}
            >
              <X className="size-4" aria-hidden />
              لا
            </button>
          </div>
        )}

        {item.type === 'SCORE' && (
          <div className="flex flex-wrap gap-2" role="group" aria-label={item.label}>
            {Array.from({ length: item.maxScore ?? 5 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange({ scoreAwarded: n })}
                aria-pressed={answer?.scoreAwarded === n}
                className={cn(
                  'tap-target min-w-11 rounded-[var(--radius-md)] border text-sm font-bold tabular transition-colors',
                  answer?.scoreAwarded === n
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-surface hover:bg-surface-muted',
                )}
              >
                {formatNumber(n)}
              </button>
            ))}
          </div>
        )}

        {item.type === 'NUMBER' && (
          <Input
            id={`f-${item.id}`}
            type="number"
            inputMode="decimal"
            step="0.1"
            dir="ltr"
            className="text-start"
            value={answer?.valueNumber ?? ''}
            onChange={(e) =>
              onChange({
                valueNumber: e.target.value === '' ? null : Number(e.target.value),
              })
            }
          />
        )}

        {item.type === 'TEXT' && (
          <Textarea
            id={`f-${item.id}`}
            value={answer?.valueText ?? ''}
            onChange={(e) => onChange({ valueText: e.target.value })}
            placeholder="اكتب ملاحظتك…"
          />
        )}

        {item.type === 'MULTIPLE_CHOICE' && (
          <div className="flex flex-wrap gap-2" role="group" aria-label={item.label}>
            {item.options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onChange({ valueChoice: opt })}
                aria-pressed={answer?.valueChoice === opt}
                className={cn(
                  'tap-target rounded-[var(--radius-md)] border px-4 text-sm font-medium transition-colors',
                  answer?.valueChoice === opt
                    ? 'border-primary bg-primary-soft text-primary'
                    : 'border-border bg-surface hover:bg-surface-muted',
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {item.type === 'PHOTO' && (
          <PhotoCapture
            value={photo}
            onUpload={handleUpload}
            onRemove={handleRemove}
          />
        )}

        {item.type === 'SIGNATURE' && (
          <SignaturePad
            value={answer?.valueText ?? null}
            onChange={(dataUrl) => onChange({ valueText: dataUrl })}
          />
        )}
      </div>

      {/* ملاحظة اختيارية على أي بند */}
      {(item.type === 'YES_NO' || item.type === 'SCORE') && (
        <input
          type="text"
          value={answer?.note ?? ''}
          onChange={(e) => onChange({ note: e.target.value })}
          placeholder="ملاحظة (اختياري)"
          aria-label={`ملاحظة على: ${item.label}`}
          className="mt-2 w-full rounded-[var(--radius-sm)] border border-input bg-surface px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-[hsl(var(--ring))]"
        />
      )}

      {item.required && !answered && (
        <p className="mt-1.5 text-[11px] text-warning">هذا الحقل إلزامي.</p>
      )}
    </div>
  )
}

/** يقرأ مرجع الصورة المخزّن نصًا. قيمة تالفة تُعامل كغياب لا كخطأ. */
function parsePhoto(raw: string | null | undefined): UploadedPhoto | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'id' in parsed &&
      'url' in parsed
    ) {
      return parsed as UploadedPhoto
    }
  } catch {
    // إجابة قديمة كانت تحفظ data URL — تُتجاهل بدل أن تكسر الشاشة
  }
  return null
}

function hasValue(a: AnswerState | undefined): boolean {
  if (!a) return false
  if (a.valueBool !== null && a.valueBool !== undefined) return true
  if (a.valueNumber !== null && a.valueNumber !== undefined) return true
  if (a.scoreAwarded !== null && a.scoreAwarded !== undefined) return true
  if (a.valueChoice) return true
  if (a.valueText && a.valueText.trim() !== '') return true
  return false
}

export { Camera, PenLine }
