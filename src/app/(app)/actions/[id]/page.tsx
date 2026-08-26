import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, MessageSquare } from 'lucide-react'
import { requireTenant } from '@/server/tenant'
import { can } from '@/server/rbac'
import {
  getAction,
  allowedNextStates,
  STATUS_LABELS,
  PRIORITY_LABELS,
} from '@/server/services/actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatDateTime, formatRelative } from '@/lib/utils'
import { TransitionControls } from './transition-controls'
import { CommentForm } from './comment-form'

export const metadata: Metadata = {
  title: 'تفاصيل الإجراء',
  robots: { index: false, follow: false },
}

const PRIORITY_TONE = {
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'warning',
  CRITICAL: 'danger',
} as const

export default async function ActionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requireTenant()
  const { id } = await params

  const action = await getAction(ctx, id)
  if (!action) notFound()

  const next = allowedNextStates(action.status)
  const overdue =
    action.dueAt !== null &&
    action.dueAt < new Date() &&
    !['COMPLETED', 'CANCELLED'].includes(action.status)

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/actions"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-4" aria-hidden />
        كل الإجراءات
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="latin text-xs text-muted-foreground">
            {action.reference}
          </span>
          <Badge tone={PRIORITY_TONE[action.priority]}>
            {PRIORITY_LABELS[action.priority]}
          </Badge>
          <Badge tone={overdue ? 'danger' : 'neutral'}>
            {STATUS_LABELS[action.status]}
          </Badge>
        </div>
        <h1 className="mt-2 text-xl sm:text-2xl font-bold tracking-tight">
          {action.title}
        </h1>
      </div>

      <Card>
        <CardContent className="pt-5">
          {action.description && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {action.description}
            </p>
          )}

          <dl className="mt-4 grid gap-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">الفرع</dt>
              <dd className="mt-0.5 font-medium">{action.branch.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">المسؤول</dt>
              <dd className="mt-0.5 font-medium">
                {action.assignee?.name ?? 'غير محدد'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">الاستحقاق</dt>
              <dd
                className={
                  overdue ? 'mt-0.5 font-semibold text-danger' : 'mt-0.5 font-medium'
                }
              >
                {formatDate(action.dueAt)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">أنشأه</dt>
              <dd className="mt-0.5 font-medium">{action.createdBy.name}</dd>
            </div>
          </dl>

          {action.inspection && (
            <p className="mt-4 text-xs text-muted-foreground">
              نشأ عن الزيارة{' '}
              <Link
                href={`/inspections/${action.inspection.id}`}
                className="latin font-medium text-primary hover:underline underline-offset-4"
              >
                {action.inspection.reference}
              </Link>
            </p>
          )}

          {action.completedAt && (
            <p className="mt-2 text-xs text-success">
              اكتمل واعتُمد في {formatDateTime(action.approvedAt ?? action.completedAt)}
            </p>
          )}
        </CardContent>
      </Card>

      {next.length > 0 && can(ctx, 'action:update') && (
        <TransitionControls
          actionId={action.id}
          current={action.status}
          next={next}
          canApprove={can(ctx, 'action:approve')}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="size-4" aria-hidden />
            التعليقات
          </CardTitle>
        </CardHeader>
        <CardContent>
          {action.comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              لا تعليقات بعد. أضف تحديثًا ليطّلع عليه بقية الفريق.
            </p>
          ) : (
            <ul className="space-y-4">
              {action.comments.map((c) => (
                <li key={c.id} className="flex gap-3">
                  <div
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary"
                    aria-hidden
                  >
                    {c.author.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-medium">{c.author.name}</span>
                      <time
                        dateTime={c.createdAt.toISOString()}
                        className="text-[11px] text-muted-foreground"
                      >
                        {formatRelative(c.createdAt)}
                      </time>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {c.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {can(ctx, 'action:update') && (
            <div className="mt-5 border-t border-border pt-5">
              <CommentForm actionId={action.id} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
