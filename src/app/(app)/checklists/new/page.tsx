import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { requireTenant } from '@/server/tenant'
import { NoPermission } from '@/components/ui/states'
import { can } from '@/server/rbac'
import { TemplateBuilder } from './builder'

export const metadata: Metadata = {
  title: 'قالب فحص جديد',
  robots: { index: false, follow: false },
}

export default async function NewChecklistPage() {
  const ctx = await requireTenant()
  if (!can(ctx, 'checklist:create')) {
    return (
      <NoPermission
        description="إنشاء قائمة تحقق يتطلب صلاحية «إنشاء قوائم التحقق». اطلب من مالك المنشأة تعديل دورك."
        backHref="/checklists"
        backLabel="العودة إلى قوائم التحقق"
      />
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/checklists"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-4" aria-hidden />
        كل القوالب
      </Link>

      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
          قالب فحص جديد
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          قسّم القالب إلى أقسام، وأضف البنود بأنواعها وأوزانها. البند الحرج
          يُسقط النتيجة ويفتح إجراءً تصحيحيًا عند فشله.
        </p>
      </div>

      <TemplateBuilder />
    </div>
  )
}
