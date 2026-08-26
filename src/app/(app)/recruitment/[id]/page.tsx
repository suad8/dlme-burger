import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { requireTenant } from '@/server/tenant'
import { can } from '@/server/rbac'
import {
  getRequest,
  RecruitmentNotFoundError,
} from '@/server/services/recruitment'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { NoPermission } from '@/components/ui/states'
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils'
import { CandidateBoard } from './candidate-board'

export const metadata: Metadata = {
  title: 'طلب توظيف',
  robots: { index: false, follow: false },
}

export default async function RequestPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requireTenant()

  if (!can(ctx, 'recruitment:view')) {
    return (
      <NoPermission
        description="التوظيف متاح لأدوار الموارد البشرية والإدارة."
        backHref="/recruitment"
        backLabel="العودة إلى التوظيف"
      />
    )
  }

  const { id } = await params

  let request
  try {
    request = await getRequest(ctx, id)
  } catch (error) {
    if (error instanceof RecruitmentNotFoundError) notFound()
    throw error
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/recruitment"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-4" aria-hidden />
        التوظيف
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            {request.position}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatNumber(request.quantity)} شاغر ·{' '}
            {request.branchName ?? 'غير محدّد'} · فُتح{' '}
            {formatDate(request.createdAt)}
          </p>
        </div>
        <Badge tone="info">{request.statusLabel}</Badge>
      </div>

      {(request.description ||
        request.salaryMin !== null ||
        request.neededBy) && (
        <Card>
          <CardHeader>
            <CardTitle>تفاصيل الشاغر</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {request.description && (
              <p className="leading-relaxed">{request.description}</p>
            )}
            <dl className="grid gap-3 sm:grid-cols-2">
              {(request.salaryMin !== null || request.salaryMax !== null) && (
                <div>
                  <dt className="text-xs text-muted-foreground">نطاق الراتب</dt>
                  <dd className="mt-0.5 tabular font-medium">
                    {formatCurrency(request.salaryMin ?? 0)} –{' '}
                    {formatCurrency(request.salaryMax ?? 0)}
                  </dd>
                </div>
              )}
              {request.neededBy && (
                <div>
                  <dt className="text-xs text-muted-foreground">مطلوب بحلول</dt>
                  <dd className="mt-0.5 font-medium">
                    {formatDate(request.neededBy)}
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      )}

      <CandidateBoard
        requestId={request.id}
        candidates={request.candidates.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
        }))}
        canEdit={can(ctx, 'recruitment:update')}
        canAdd={can(ctx, 'recruitment:create')}
      />
    </div>
  )
}
