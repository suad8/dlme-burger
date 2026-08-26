import * as React from 'react'
import { AlertTriangle, ShieldAlert, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

/** هيكل تحميل — يحجز المساحة فيمنع قفز المحتوى. */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-[var(--radius-sm)] bg-surface-muted',
        className,
      )}
      aria-hidden
      {...props}
    />
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="جارٍ التحميل">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
      <span className="sr-only">جارٍ تحميل البيانات…</span>
    </div>
  )
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      role="status"
      aria-label="جارٍ التحميل"
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-[var(--radius-lg)]" />
      ))}
      <span className="sr-only">جارٍ تحميل البيانات…</span>
    </div>
  )
}

/** حالة فراغ مفيدة — دائمًا بإجراء واضح، لا رسالة معلّقة. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-14 rounded-[var(--radius-lg)] border border-dashed border-border bg-surface">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon className="size-5" aria-hidden />
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
      {actionLabel && actionHref ? (
        <Button asChild className="mt-5">
          <a href={actionHref}>{actionLabel}</a>
        </Button>
      ) : actionLabel && onAction ? (
        <Button className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}

export function ErrorState({
  title = 'تعذّر تحميل البيانات',
  description = 'حدث خطأ غير متوقع. حاول مرة أخرى، وإن تكرر تواصل مع الدعم.',
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center text-center px-6 py-14 rounded-[var(--radius-lg)] border border-danger/30 bg-danger-soft"
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-danger/12 text-danger">
        <AlertTriangle className="size-5" aria-hidden />
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
      {onRetry ? (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          إعادة المحاولة
        </Button>
      ) : null}
    </div>
  )
}

/**
 * رفض صلاحية داخل المنشأة نفسها. نقول للمستخدم الحقيقة: الصفحة موجودة لكن
 * دوره لا يخوّله رؤيتها. هذا يختلف عن محاولة الوصول إلى بيانات منشأة أخرى —
 * تلك تُعامَل كـ404 حتى لا يُستدل على وجود السجل أصلًا.
 */
export function NoPermission({
  title = 'لا تملك صلاحية الوصول',
  description = 'هذه الصفحة متاحة لأدوار أخرى في منشأتك. إن كنت تحتاجها فاطلب من مالك المنشأة تعديل دورك.',
  backHref = '/dashboard',
  backLabel = 'العودة إلى لوحة التحكم',
}: {
  title?: string
  description?: string
  backHref?: string
  backLabel?: string
}) {
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center justify-center px-6 py-16 text-center"
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning">
        <ShieldAlert className="size-5" aria-hidden />
      </div>
      <h1 className="mt-4 text-lg font-semibold">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      <Button asChild variant="secondary" className="mt-6">
        <a href={backHref}>{backLabel}</a>
      </Button>
    </div>
  )
}
