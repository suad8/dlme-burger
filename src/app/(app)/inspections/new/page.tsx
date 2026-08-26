import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { requireTenant } from '@/server/tenant'
import { can } from '@/server/rbac'
import { listActiveTemplates } from '@/server/services/inspections'
import { listBranches } from '@/server/services/branches'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { EmptyState, NoPermission } from '@/components/ui/states'
import { ClipboardList } from 'lucide-react'
import { StartInspectionForm } from './start-form'

export const metadata: Metadata = {
  title: 'بدء فحص',
  robots: { index: false, follow: false },
}

export default async function NewInspectionPage() {
  const ctx = await requireTenant()
  if (!can(ctx, 'inspection:create')) {
    return (
      <NoPermission
        description="بدء جولة تفتيش يتطلب صلاحية «إنشاء التفتيش». اطلب من مالك المنشأة تعديل دورك."
        backHref="/inspections"
        backLabel="العودة إلى التفتيش"
      />
    )
  }

  const [templates, branches] = await Promise.all([
    listActiveTemplates(ctx),
    listBranches(ctx),
  ])

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <Link
        href="/inspections"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-4" aria-hidden />
        كل الزيارات
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">ابدأ فحصًا جديدًا</CardTitle>
          <CardDescription>
            اختر الفرع والقالب. يمكنك الحفظ والمتابعة لاحقًا دون فقد ما أدخلته.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {templates.length === 0 || branches.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={
                branches.length === 0 ? 'لا توجد فروع' : 'لا توجد قوالب فحص مفعّلة'
              }
              description={
                branches.length === 0
                  ? 'أضف فرعًا أولًا لتتمكن من بدء الفحوصات.'
                  : 'أنشئ قالب فحص وفعّله لتتمكن من بدء زيارة.'
              }
              actionLabel={branches.length === 0 ? 'أضف فرعًا' : 'إلى القوالب'}
              actionHref={branches.length === 0 ? '/branches/new' : '/checklists'}
            />
          ) : (
            <StartInspectionForm
              branches={branches.map((b) => ({ id: b.id, name: b.name }))}
              templates={templates.map((t) => ({
                id: t.id,
                name: t.name,
                passScore: t.passScore,
              }))}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
