import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Check, Circle, ArrowLeft } from 'lucide-react'
import { getSession, getTenantContext } from '@/server/tenant'
import { ONBOARDING_STEPS, onboardingProgress } from '@/server/services/onboarding'
import { getOnboardingSnapshot } from '@/server/services/catalog'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'إعداد الحساب',
  robots: { index: false, follow: false },
}

/**
 * التقدّم يُقرأ من قاعدة البيانات لا من الجلسة، فيستأنف المستخدم من حيث توقّف
 * حتى لو خرج أو بدّل الجهاز.
 */
export default async function OnboardingPage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')

  const ctx = await getTenantContext()
  if (!ctx) {
    // مستخدم بلا منشأة — حالة نادرة تعني فشل التسجيل جزئيًا
    return (
      <div className="mx-auto max-w-lg p-6">
        <Card>
          <CardHeader>
            <CardTitle>لم تكتمل تهيئة حسابك</CardTitle>
            <CardDescription>
              حسابك موجود لكن لم تُنشأ منشأة مرتبطة به. تواصل مع الدعم لإكمال
              التهيئة.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary">
              <Link href="/contact">تواصل مع الدعم</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (ctx.onboardingCompleted) redirect('/dashboard')

  const org = await getOnboardingSnapshot(ctx.organizationId)

  const step = org.onboardingStep
  const progress = onboardingProgress(step)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
          أكمل إعداد {ctx.organizationName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          تقدّمك محفوظ. يمكنك المغادرة والعودة في أي وقت.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>نسبة اكتمال الإعداد</CardTitle>
            <Badge tone={progress >= 100 ? 'success' : 'primary'}>
              {progress}٪
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="نسبة اكتمال إعداد الحساب"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>

          <ol className="mt-6 space-y-1">
            {ONBOARDING_STEPS.map((s, i) => {
              const done = i < step
              const current = i === step
              return (
                <li
                  key={s.key}
                  className={cn(
                    'flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5',
                    current && 'bg-primary-soft',
                  )}
                >
                  {done ? (
                    <Check className="size-4 shrink-0 text-success" aria-hidden />
                  ) : (
                    <Circle
                      className={cn(
                        'size-4 shrink-0',
                        current ? 'text-primary' : 'text-muted-foreground/40',
                      )}
                      aria-hidden
                    />
                  )}
                  <span
                    className={cn(
                      'text-sm',
                      done && 'text-muted-foreground line-through',
                      current && 'font-semibold text-primary',
                    )}
                  >
                    {s.label}
                  </span>
                  {current && (
                    <Badge tone="primary" className="ms-auto">
                      الخطوة الحالية
                    </Badge>
                  )}
                </li>
              )
            })}
          </ol>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'العلامات التجارية', value: org._count.brands, href: '/settings/brands' },
          { label: 'الفروع', value: org._count.branches, href: '/branches' },
          { label: 'أعضاء الفريق', value: org._count.memberships, href: '/settings/team' },
        ].map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-[var(--radius-lg)] border border-border bg-surface p-4 transition-colors hover:bg-surface-muted"
          >
            <div className="text-2xl font-bold tabular">{c.value}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{c.label}</div>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/branches/new">
            أضف أول فرع
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/dashboard">تخطَّ إلى لوحة التحكم</Link>
        </Button>
      </div>
    </div>
  )
}
