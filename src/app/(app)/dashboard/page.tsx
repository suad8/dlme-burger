import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import {
  ClipboardCheck,
  TriangleAlert,
  Building2,
  Trash2,
  Users,
  PackageOpen,
  FileWarning,
  Plus,
  ArrowLeft,
} from 'lucide-react'
import { requireTenant } from '@/server/tenant'
import { can } from '@/server/rbac'
import {
  getDashboardSummary,
  getBranchPerformance,
  getComplianceTrend,
  getRecentActivity,
  type PeriodDays,
} from '@/server/services/dashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SkeletonCards, EmptyState } from '@/components/ui/states'
import { formatCurrency, formatNumber, formatRelative } from '@/lib/utils'
import { ComplianceTrendChart } from '@/components/charts/compliance-trend'
import { PeriodTabs } from '@/components/app/period-tabs'

export const metadata: Metadata = {
  title: 'لوحة التحكم',
  robots: { index: false, follow: false },
}

function parsePeriod(value: string | undefined): PeriodDays {
  if (value === '7') return 7
  if (value === '90') return 90
  return 30
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const ctx = await requireTenant()
  const params = await searchParams
  const period = parsePeriod(params.period)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            لوحة التحكم
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ملخّص أداء {ctx.organizationName}
            {ctx.branchScope ? ' ضمن الفروع المصرّح لك بها' : ''}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PeriodTabs current={period} />
          {can(ctx, 'inspection:create') && (
            <Button asChild size="sm">
              <Link href="/inspections/new">
                <Plus className="size-4" aria-hidden />
                ابدأ الفحص
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Suspense fallback={<SkeletonCards count={4} />}>
        <SummaryTiles period={period} />
      </Suspense>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>اتجاه الالتزام</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-md)] bg-surface-muted" />}>
              <TrendSection period={period} />
            </Suspense>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>مقارنة الفروع</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-md)] bg-surface-muted" />}>
              <BranchSection period={period} />
            </Suspense>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>النشاطات الأخيرة</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="h-40 animate-pulse rounded-[var(--radius-md)] bg-surface-muted" />}>
            <ActivitySection />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}

/* ── بطاقات المؤشرات ──────────────────────────────────────── */

async function SummaryTiles({ period }: { period: PeriodDays }) {
  const ctx = await requireTenant()
  const s = await getDashboardSummary(ctx, period)

  const tiles = [
    {
      icon: ClipboardCheck,
      label: 'درجة الالتزام',
      value: s.complianceScore === null ? '—' : `${formatNumber(s.complianceScore, 'ar-SA', 1)}٪`,
      badge:
        s.complianceDelta === null
          ? null
          : {
              tone: s.complianceDelta >= 0 ? ('success' as const) : ('danger' as const),
              text: `${s.complianceDelta >= 0 ? '+' : ''}${formatNumber(s.complianceDelta, 'ar-SA', 1)} عن الفترة السابقة`,
            },
    },
    {
      icon: TriangleAlert,
      label: 'إجراءات مفتوحة',
      value: formatNumber(s.openActions),
      badge:
        s.overdueActions > 0
          ? { tone: 'danger' as const, text: `${formatNumber(s.overdueActions)} متأخرة` }
          : { tone: 'success' as const, text: 'لا يوجد متأخر' },
    },
    {
      icon: Building2,
      label: 'فروع نشطة',
      value: formatNumber(s.branchCount),
      badge:
        s.inspectionsOverdue > 0
          ? { tone: 'warning' as const, text: `${formatNumber(s.inspectionsOverdue)} فحص متأخر` }
          : null,
    },
    {
      icon: Trash2,
      label: 'تكلفة الهدر',
      value: formatCurrency(s.wasteCost),
      badge: { tone: 'neutral' as const, text: `آخر ${formatNumber(period)} يومًا` },
    },
  ]

  const secondary = [
    { icon: ClipboardCheck, label: 'فحوصات مكتملة', value: formatNumber(s.inspectionsCompleted) },
    { icon: Users, label: 'موظفون نشطون', value: formatNumber(s.employeeCount) },
    { icon: PackageOpen, label: 'أصناف تحت حد الطلب', value: formatNumber(s.lowStockCount) },
    { icon: FileWarning, label: 'مستندات تنتهي خلال شهر', value: formatNumber(s.expiringDocuments) },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label}>
            <CardContent className="pt-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <t.icon className="size-4" aria-hidden />
                {t.label}
              </div>
              <div className="mt-2 text-2xl font-bold tabular">{t.value}</div>
              {t.badge ? (
                <Badge tone={t.badge.tone} className="mt-2">
                  {t.badge.text}
                </Badge>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {secondary.map((t) => (
          <div
            key={t.label}
            className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3"
          >
            <t.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0">
              <div className="text-lg font-bold tabular leading-tight">
                {t.value}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {t.label}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── الاتجاه ──────────────────────────────────────────────── */

async function TrendSection({ period }: { period: PeriodDays }) {
  const ctx = await requireTenant()
  const points = await getComplianceTrend(ctx, period)

  if (points.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="لا توجد فحوصات معتمدة بعد"
        description="ابدأ أول فحص ليظهر اتجاه الالتزام هنا."
        actionLabel="ابدأ الفحص"
        actionHref="/inspections/new"
      />
    )
  }

  return <ComplianceTrendChart data={points} />
}

/* ── مقارنة الفروع ────────────────────────────────────────── */

async function BranchSection({ period }: { period: PeriodDays }) {
  const ctx = await requireTenant()
  const branches = await getBranchPerformance(ctx, period)

  if (branches.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="لا توجد فروع بعد"
        description="أضف أول فرع لتبدأ متابعة أدائه ومقارنته بغيره."
        actionLabel="أضف فرعًا"
        actionHref="/branches/new"
      />
    )
  }

  return (
    <ul className="space-y-4">
      {branches.map((b) => {
        const tone =
          b.score === null
            ? 'bg-muted'
            : b.score >= 90
              ? 'bg-success'
              : b.score >= 80
                ? 'bg-warning'
                : 'bg-danger'
        return (
          <li key={b.branchId}>
            <div className="flex items-baseline justify-between gap-2">
              <Link
                href={`/branches/${b.branchId}`}
                className="truncate text-sm font-medium hover:underline underline-offset-4"
              >
                {b.branchName}
              </Link>
              <span className="shrink-0 text-sm font-bold tabular">
                {b.score === null ? '—' : `${formatNumber(b.score, 'ar-SA', 1)}٪`}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
              <div
                className={`h-full rounded-full ${tone}`}
                style={{ width: `${b.score ?? 0}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>{formatNumber(b.inspectionCount)} فحص</span>
              {b.openActions > 0 && (
                <span className="text-danger">
                  {formatNumber(b.openActions)} إجراء مفتوح
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/* ── النشاطات ─────────────────────────────────────────────── */

async function ActivitySection() {
  const ctx = await requireTenant()
  const items = await getRecentActivity(ctx, 8)

  if (items.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="لا نشاط بعد"
        description="ستظهر هنا آخر الفحوصات والإجراءات التصحيحية فور تسجيلها."
      />
    )
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <li
          key={`${item.kind}-${item.id}`}
          className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
        >
          <span
            className={
              item.tone === 'success'
                ? 'size-2 shrink-0 rounded-full bg-success'
                : item.tone === 'danger'
                  ? 'size-2 shrink-0 rounded-full bg-danger'
                  : item.tone === 'warning'
                    ? 'size-2 shrink-0 rounded-full bg-warning'
                    : 'size-2 shrink-0 rounded-full bg-muted-foreground'
            }
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{item.title}</div>
            <div className="truncate text-xs text-muted-foreground">
              {item.branchName}
            </div>
          </div>
          <time
            dateTime={item.at.toISOString()}
            className="shrink-0 text-xs text-muted-foreground"
          >
            {formatRelative(item.at)}
          </time>
          <Link
            href={item.kind === 'inspection' ? `/inspections/${item.id}` : `/actions/${item.id}`}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="عرض التفاصيل"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  )
}
