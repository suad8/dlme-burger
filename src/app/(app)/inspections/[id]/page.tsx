import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, CircleCheck, TriangleAlert } from 'lucide-react'
import { requireTenant } from '@/server/tenant'
import { can } from '@/server/rbac'
import { getInspectionDetail } from '@/server/services/inspections'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime, formatNumber, toNumber } from '@/lib/utils'
import { InspectionRunner } from './runner'
import { ApproveButton } from './approve-button'

export const metadata: Metadata = {
  title: 'تفاصيل الزيارة',
  robots: { index: false, follow: false },
}

export default async function InspectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requireTenant()
  const { id } = await params

  const inspection = await getInspectionDetail(ctx, id)
  // 404 لا 403 — لا نكشف أن السجل موجود لدى منشأة أخرى
  if (!inspection) notFound()

  const editable =
    (inspection.status === 'DRAFT' || inspection.status === 'IN_PROGRESS') &&
    can(ctx, 'inspection:update')

  const answers = Object.fromEntries(
    inspection.answers.map((a) => [
      a.itemId,
      {
        itemId: a.itemId,
        valueBool: a.valueBool,
        valueText: a.valueText,
        valueNumber: a.valueNumber === null ? null : toNumber(a.valueNumber),
        valueChoice: a.valueChoice,
        scoreAwarded: a.scoreAwarded,
        note: a.note,
      },
    ]),
  )

  const violations = inspection.answers.filter((a) => a.isViolation)

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/inspections"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-4" aria-hidden />
        كل الزيارات
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            {inspection.template.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="latin">{inspection.reference}</span> ·{' '}
            {inspection.branch.name}
            {inspection.inspector ? ` · ${inspection.inspector.name}` : ''}
          </p>
        </div>

        {inspection.status === 'SUBMITTED' && can(ctx, 'inspection:approve') && (
          <ApproveButton inspectionId={inspection.id} />
        )}
      </div>

      {/* النتيجة تظهر فقط بعد الإغلاق */}
      {inspection.score !== null && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs text-muted-foreground">النتيجة</div>
                <div
                  className={
                    inspection.passed
                      ? 'text-3xl font-bold tabular text-success'
                      : 'text-3xl font-bold tabular text-danger'
                  }
                >
                  {formatNumber(toNumber(inspection.score), 'ar-SA', 1)}٪
                </div>
              </div>
              <div className="text-end">
                <Badge tone={inspection.passed ? 'success' : 'danger'}>
                  {inspection.passed ? 'مطابق' : 'غير مطابق'}
                </Badge>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  درجة النجاح: {inspection.template.passScore}٪
                </p>
              </div>
            </div>

            {violations.length > 0 && (
              <div className="mt-4 rounded-[var(--radius-md)] border border-danger/30 bg-danger-soft p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-danger">
                  <TriangleAlert className="size-4" aria-hidden />
                  {formatNumber(violations.length)} مخالفة مسجّلة
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  المخالفات الحرجة فتحت إجراءات تصحيحية تلقائيًا.
                </p>
              </div>
            )}

            <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">بدأت</dt>
                <dd className="mt-0.5 font-medium">
                  {formatDateTime(inspection.startedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">أُغلقت</dt>
                <dd className="mt-0.5 font-medium">
                  {formatDateTime(inspection.submittedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">اعتُمدت</dt>
                <dd className="mt-0.5 font-medium">
                  {inspection.approvedAt ? (
                    <span className="inline-flex items-center gap-1 text-success">
                      <CircleCheck className="size-3.5" aria-hidden />
                      {formatDateTime(inspection.approvedAt)}
                    </span>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      {editable ? (
        <InspectionRunner
          inspectionId={inspection.id}
          sections={inspection.template.sections}
          initialAnswers={answers}
          passScore={inspection.template.passScore}
        />
      ) : (
        <ReadOnlyAnswers
          sections={inspection.template.sections}
          answers={answers}
        />
      )}
    </div>
  )
}

type AnswerView = {
  valueBool: boolean | null
  valueText: string | null
  valueNumber: number | null
  valueChoice: string | null
  scoreAwarded: number | null
  note: string | null
}

function ReadOnlyAnswers({
  sections,
  answers,
}: {
  sections: {
    id: string
    title: string
    items: { id: string; label: string; type: string; maxScore: number | null }[]
  }[]
  answers: Record<string, AnswerView>
}) {
  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <Card key={section.id}>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border">
              {section.items.map((item) => {
                const a = answers[item.id]
                return (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <dt className="text-sm">{item.label}</dt>
                    <dd className="shrink-0 text-sm font-medium tabular">
                      {renderValue(item, a)}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function renderValue(
  item: { type: string; maxScore: number | null },
  a: AnswerView | undefined,
): React.ReactNode {
  if (!a) return <span className="text-muted-foreground">—</span>

  switch (item.type) {
    case 'YES_NO':
      return a.valueBool === null ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <Badge tone={a.valueBool ? 'success' : 'danger'}>
          {a.valueBool ? 'نعم' : 'لا'}
        </Badge>
      )
    case 'SCORE':
      return a.scoreAwarded === null ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <span>
          {formatNumber(a.scoreAwarded)} / {formatNumber(item.maxScore ?? 5)}
        </span>
      )
    case 'NUMBER':
      return a.valueNumber === null ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        formatNumber(a.valueNumber, 'ar-SA', 1)
      )
    case 'MULTIPLE_CHOICE':
      return a.valueChoice ?? <span className="text-muted-foreground">—</span>
    case 'TEXT':
      return (
        <span className="max-w-xs text-end font-normal text-muted-foreground">
          {a.valueText || '—'}
        </span>
      )
    case 'PHOTO':
    case 'SIGNATURE':
      return a.valueText ? (
        <Badge tone="success">مرفق</Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    default:
      return <span className="text-muted-foreground">—</span>
  }
}
