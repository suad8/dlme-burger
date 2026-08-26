'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, ChevronUp, ChevronDown, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Textarea, Label, FieldHint } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn, formatNumber } from '@/lib/utils'
import {
  checklistTemplateSchema,
  type ChecklistItemInput,
  type ChecklistSectionInput,
} from '@/lib/validation'
import { createTemplateAction } from '../actions'

/**
 * بنّاء قوالب الفحص.
 *
 * الحالة كلها محلية حتى الحفظ: القالب نصف المبني لا معنى له في قاعدة
 * البيانات، وحفظه تدريجيًا يترك قوالب مشوّهة يمكن أن تُجدول بالخطأ.
 */

const ITEM_TYPES = [
  { value: 'YES_NO', label: 'نعم / لا', scorable: true },
  { value: 'SCORE', label: 'درجة', scorable: true },
  { value: 'MULTIPLE_CHOICE', label: 'اختيار من متعدد', scorable: true },
  { value: 'NUMBER', label: 'رقم', scorable: false },
  { value: 'TEXT', label: 'نص', scorable: false },
  { value: 'PHOTO', label: 'صورة', scorable: false },
  { value: 'SIGNATURE', label: 'توقيع', scorable: false },
] as const

const FREQUENCIES = [
  { value: 'ON_DEMAND', label: 'عند الطلب' },
  { value: 'DAILY', label: 'يومي' },
  { value: 'WEEKLY', label: 'أسبوعي' },
  { value: 'MONTHLY', label: 'شهري' },
] as const

function emptyItem(): ChecklistItemInput {
  return {
    label: '',
    hint: '',
    type: 'YES_NO',
    required: true,
    criticalFail: false,
    weight: 1,
    maxScore: null,
    options: [],
  }
}

function emptySection(): ChecklistSectionInput {
  return { title: '', items: [emptyItem()] }
}

export function TemplateBuilder() {
  const router = useRouter()
  const [pending, start] = useTransition()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [frequency, setFrequency] =
    useState<(typeof FREQUENCIES)[number]['value']>('DAILY')
  const [passScore, setPassScore] = useState(80)
  const [sections, setSections] = useState<ChecklistSectionInput[]>([
    emptySection(),
  ])

  const totalItems = sections.reduce((n, s) => n + s.items.length, 0)
  const scorableCount = sections
    .flatMap((s) => s.items)
    .filter((i) =>
      ITEM_TYPES.find((t) => t.value === i.type)?.scorable,
    ).length
  const criticalCount = sections
    .flatMap((s) => s.items)
    .filter((i) => i.criticalFail).length

  function updateSection(index: number, patch: Partial<ChecklistSectionInput>) {
    setSections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    )
  }

  function updateItem(
    si: number,
    ii: number,
    patch: Partial<ChecklistItemInput>,
  ) {
    setSections((prev) =>
      prev.map((s, i) =>
        i !== si
          ? s
          : {
              ...s,
              items: s.items.map((item, j) =>
                j !== ii ? item : { ...item, ...patch },
              ),
            },
      ),
    )
  }

  function changeItemType(
    si: number,
    ii: number,
    type: ChecklistItemInput['type'],
  ) {
    // تغيير النوع يُصفّر ما لا يخصّه، فلا تبقى خيارات على بند نصّي مثلًا
    updateItem(si, ii, {
      type,
      maxScore: type === 'SCORE' ? 5 : null,
      options: type === 'MULTIPLE_CHOICE' ? ['ممتازة', 'جيدة', 'تحتاج معالجة'] : [],
      // الصورة والتوقيع والنص لا تُقيَّم فلا معنى لوسمها حرجة
      criticalFail:
        type === 'PHOTO' || type === 'SIGNATURE' || type === 'TEXT'
          ? false
          : undefined,
    })
  }

  function moveSection(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= sections.length) return
    setSections((prev) => {
      const next = [...prev]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved!)
      return next
    })
  }

  function handleSave() {
    const payload = {
      name,
      description,
      frequency,
      passScore,
      isActive: true,
      sections,
    }

    // التحقق محليًا أولًا لعرض الخطأ فورًا — والخادم يعيده على أي حال
    const parsed = checklistTemplateSchema.safeParse(payload)
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'راجع بيانات القالب.')
      return
    }

    start(async () => {
      const result = await createTemplateAction(payload)
      if (!result.ok) {
        toast.error(result.message ?? 'تعذّر حفظ القالب.')
        return
      }
      toast.success('حُفظ القالب وفُعّل.')
      router.push('/checklists')
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* بيانات القالب */}
      <Card>
        <CardHeader>
          <CardTitle>بيانات القالب</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="tpl-name" required>
              اسم القالب
            </Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5"
              placeholder="فحص الافتتاح اليومي"
            />
          </div>

          <div>
            <Label htmlFor="tpl-desc">الوصف</Label>
            <Textarea
              id="tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5"
              placeholder="ما الذي يقيسه هذا القالب ومتى يُنفَّذ؟"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="tpl-freq">التكرار</Label>
              <select
                id="tpl-freq"
                value={frequency}
                onChange={(e) =>
                  setFrequency(
                    e.target.value as (typeof FREQUENCIES)[number]['value'],
                  )
                }
                className="mt-1.5 h-11 w-full rounded-[var(--radius-md)] border border-input bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-[hsl(var(--ring))]"
              >
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="tpl-pass" required>
                درجة النجاح (٪)
              </Label>
              <Input
                id="tpl-pass"
                type="number"
                min={1}
                max={100}
                dir="ltr"
                className="mt-1.5 text-start"
                value={passScore}
                onChange={(e) => setPassScore(Number(e.target.value) || 0)}
              />
              <FieldHint>
                الزيارة دون هذه النسبة تُعتبر غير مطابقة.
              </FieldHint>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* الأقسام */}
      {sections.map((section, si) => (
        <Card key={si}>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>القسم {formatNumber(si + 1)}</CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => moveSection(si, -1)}
                  disabled={si === 0}
                  aria-label="نقل القسم لأعلى"
                >
                  <ChevronUp className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => moveSection(si, 1)}
                  disabled={si === sections.length - 1}
                  aria-label="نقل القسم لأسفل"
                >
                  <ChevronDown className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setSections((prev) => prev.filter((_, i) => i !== si))
                  }
                  disabled={sections.length === 1}
                  aria-label="حذف القسم"
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            <div>
              <Label htmlFor={`sec-${si}`} required>
                عنوان القسم
              </Label>
              <Input
                id={`sec-${si}`}
                value={section.title}
                onChange={(e) => updateSection(si, { title: e.target.value })}
                className="mt-1.5"
                placeholder="النظافة العامة"
              />
            </div>

            <div className="space-y-4">
              {section.items.map((item, ii) => {
                const typeMeta = ITEM_TYPES.find((t) => t.value === item.type)!
                return (
                  <div
                    key={ii}
                    className="rounded-[var(--radius-md)] border border-border p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-xs font-medium text-muted-foreground">
                        البند {formatNumber(ii + 1)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          updateSection(si, {
                            items: section.items.filter((_, j) => j !== ii),
                          })
                        }
                        disabled={section.items.length === 1}
                        aria-label="حذف البند"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>

                    <div className="mt-2">
                      <Label htmlFor={`item-${si}-${ii}`} required>
                        نص البند
                      </Label>
                      <Input
                        id={`item-${si}-${ii}`}
                        value={item.label}
                        onChange={(e) =>
                          updateItem(si, ii, { label: e.target.value })
                        }
                        className="mt-1.5"
                        placeholder="الأرضيات نظيفة وجافة"
                      />
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div>
                        <Label htmlFor={`type-${si}-${ii}`}>النوع</Label>
                        <select
                          id={`type-${si}-${ii}`}
                          value={item.type}
                          onChange={(e) =>
                            changeItemType(
                              si,
                              ii,
                              e.target.value as ChecklistItemInput['type'],
                            )
                          }
                          className="mt-1.5 h-11 w-full rounded-[var(--radius-md)] border border-input bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-[hsl(var(--ring))]"
                        >
                          {ITEM_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <Label htmlFor={`weight-${si}-${ii}`}>الوزن</Label>
                        <Input
                          id={`weight-${si}-${ii}`}
                          type="number"
                          min={1}
                          max={10}
                          dir="ltr"
                          className="mt-1.5 text-start"
                          value={item.weight}
                          onChange={(e) =>
                            updateItem(si, ii, {
                              weight: Number(e.target.value) || 1,
                            })
                          }
                          disabled={!typeMeta.scorable}
                        />
                      </div>

                      {item.type === 'SCORE' && (
                        <div>
                          <Label htmlFor={`max-${si}-${ii}`}>أقصى درجة</Label>
                          <Input
                            id={`max-${si}-${ii}`}
                            type="number"
                            min={2}
                            max={10}
                            dir="ltr"
                            className="mt-1.5 text-start"
                            value={item.maxScore ?? 5}
                            onChange={(e) =>
                              updateItem(si, ii, {
                                maxScore: Number(e.target.value) || 5,
                              })
                            }
                          />
                        </div>
                      )}
                    </div>

                    {item.type === 'MULTIPLE_CHOICE' && (
                      <div className="mt-3">
                        <Label htmlFor={`opts-${si}-${ii}`}>
                          الخيارات (سطر لكل خيار)
                        </Label>
                        <Textarea
                          id={`opts-${si}-${ii}`}
                          className="mt-1.5"
                          value={item.options.join('\n')}
                          onChange={(e) =>
                            updateItem(si, ii, {
                              options: e.target.value
                                .split('\n')
                                .map((o) => o.trim())
                                .filter(Boolean),
                            })
                          }
                        />
                        <FieldHint>خياران على الأقل.</FieldHint>
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={item.required}
                          onChange={(e) =>
                            updateItem(si, ii, { required: e.target.checked })
                          }
                          className="size-4 accent-[hsl(var(--primary))]"
                        />
                        إلزامي
                      </label>

                      <label
                        className={cn(
                          'flex items-center gap-2 text-sm',
                          !typeMeta.scorable && 'opacity-50',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={item.criticalFail}
                          disabled={!typeMeta.scorable && item.type !== 'NUMBER'}
                          onChange={(e) =>
                            updateItem(si, ii, {
                              criticalFail: e.target.checked,
                            })
                          }
                          className="size-4 accent-[hsl(var(--danger))]"
                        />
                        بند حرج
                      </label>

                      {item.criticalFail && (
                        <Badge tone="danger">
                          فشله يُسقط النتيجة ويفتح إجراءً
                        </Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                updateSection(si, { items: [...section.items, emptyItem()] })
              }
            >
              <Plus className="size-4" aria-hidden />
              أضف بندًا
            </Button>
          </CardContent>
        </Card>
      ))}

      <Button
        variant="secondary"
        onClick={() => setSections((prev) => [...prev, emptySection()])}
      >
        <Plus className="size-4" aria-hidden />
        أضف قسمًا
      </Button>

      {/* الملخّص والحفظ */}
      <Card>
        <CardContent className="pt-5">
          <div className="grid gap-3 grid-cols-3">
            {[
              { label: 'الأقسام', value: sections.length },
              { label: 'البنود', value: totalItems },
              { label: 'بنود تُحتسب', value: scorableCount },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-lg font-bold tabular">
                  {formatNumber(s.value)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {scorableCount === 0 && (
            <div
              role="status"
              className="mt-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-warning/30 bg-warning-soft p-3"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p className="text-xs leading-relaxed">
                لا يوجد بند قابل للتسجيل. القالب يحتاج بندًا واحدًا على الأقل من
                نوع نعم/لا أو درجة أو اختيار من متعدد لتُحتسب نتيجته.
              </p>
            </div>
          )}

          {criticalCount > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              {formatNumber(criticalCount)} بند حرج — فشل أيٍّ منها يُسقط نتيجة
              الزيارة إلى صفر ويفتح إجراءً تصحيحيًا تلقائيًا.
            </p>
          )}

          <Button
            className="mt-5 w-full"
            size="lg"
            onClick={handleSave}
            loading={pending}
          >
            احفظ القالب وفعّله
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
