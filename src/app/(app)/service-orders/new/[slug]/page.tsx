import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { requireTenant } from '@/server/tenant'
import { can } from '@/server/rbac'
import { getCatalogItem } from '@/server/services/service-orders'
import { listBranches } from '@/server/services/branches'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { NoPermission } from '@/components/ui/states'
import { OrderForm } from './order-form'

export const metadata: Metadata = {
  title: 'طلب خدمة',
  robots: { index: false, follow: false },
}

export default async function NewOrderPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const ctx = await requireTenant()

  if (!can(ctx, 'service:create')) {
    return (
      <NoPermission
        description="طلب الخدمات يتطلب صلاحية «إنشاء الخدمات»."
        backHref="/service-orders"
        backLabel="العودة إلى الخدمات"
      />
    )
  }

  const { slug } = await params
  const service = await getCatalogItem(slug)
  if (!service) notFound()

  const branches = await listBranches(ctx)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/service-orders"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-4" aria-hidden />
        الخدمات
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>{service.name}</CardTitle>
          <CardDescription>{service.description ?? service.summary}</CardDescription>
        </CardHeader>
        <CardContent>
          <OrderForm
            slug={service.slug}
            fields={service.requirements}
            branches={branches.map((b) => ({ id: b.id, name: b.name }))}
          />
        </CardContent>
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground">
        إرسال الطلب لا يترتب عليه أي التزام مالي. يصلك عرض سعر أولًا، ولا
        يُحصَّل شيء قبل اعتمادك له.
      </p>
    </div>
  )
}
