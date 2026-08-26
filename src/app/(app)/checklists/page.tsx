import type { Metadata } from 'next'
import Link from 'next/link'
import { ClipboardList, Plus } from 'lucide-react'
import type { ChecklistFrequency } from '@prisma/client'
import { requireTenant } from '@/server/tenant'
import { can } from '@/server/rbac'
import { listTemplatesWithCounts } from '@/server/services/inspections'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/states'
import { formatNumber } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'قوائم الفحص',
  robots: { index: false, follow: false },
}

const FREQ_LABELS: Record<ChecklistFrequency, string> = {
  ON_DEMAND: 'عند الطلب',
  DAILY: 'يومي',
  WEEKLY: 'أسبوعي',
  MONTHLY: 'شهري',
}

export default async function ChecklistsPage() {
  const ctx = await requireTenant()
  const templates = await listTemplatesWithCounts(ctx)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            قوائم الفحص
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            القوالب المعتمدة وجدولتها على الفروع.
          </p>
        </div>
        {can(ctx, 'checklist:create') && (
          <Button asChild size="sm">
            <Link href="/checklists/new">
              <Plus className="size-4" aria-hidden />
              أنشئ قالبًا
            </Link>
          </Button>
        )}
      </div>

      {templates.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="لا توجد قوالب فحص"
          description="أنشئ قالبًا بأقسامه وبنوده لتبدأ جدولة الفحوصات على فروعك."
          {...(can(ctx, 'checklist:create')
            ? { actionLabel: 'أنشئ قالبًا', actionHref: '/checklists/new' }
            : {})}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col pt-5">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold leading-tight">{t.name}</h2>
                  <Badge tone={t.isActive ? 'success' : 'neutral'}>
                    {t.isActive ? 'مفعّل' : 'موقوف'}
                  </Badge>
                </div>

                {t.description && (
                  <p className="mt-2 flex-1 text-sm text-muted-foreground leading-relaxed">
                    {t.description}
                  </p>
                )}

                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-muted-foreground">التكرار</dt>
                    <dd className="mt-0.5 font-medium">
                      {FREQ_LABELS[t.frequency]}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">درجة النجاح</dt>
                    <dd className="mt-0.5 font-medium tabular">{t.passScore}٪</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">البنود</dt>
                    <dd className="mt-0.5 font-medium tabular">
                      {formatNumber(t.itemCount)} في {formatNumber(t.sectionCount)} قسم
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">الفروع المجدولة</dt>
                    <dd className="mt-0.5 font-medium tabular">
                      {formatNumber(t.scheduleCount)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                  <span className="text-xs text-muted-foreground tabular">
                    {formatNumber(t.inspectionCount)} زيارة منفّذة
                  </span>
                  {can(ctx, 'inspection:create') && t.isActive && (
                    <Button asChild variant="subtle" size="sm">
                      <Link href="/inspections/new">ابدأ الفحص</Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
