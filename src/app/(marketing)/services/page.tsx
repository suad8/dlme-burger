import type { Metadata } from 'next'
import Link from 'next/link'
import { listActiveServices } from '@/server/services/catalog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, toNumber } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'الخدمات التشغيلية',
  description:
    'خدمات تشغيل المطاعم والمقاهي: مدير تشغيل، شيف، هندسة منيو، توثيق وصفات، تدريب، عميل خفي وزيارات جودة — تُطلب وتُتابع من داخل المنصة.',
  alternates: { canonical: '/services' },
}

export const revalidate = 3600

export default async function ServicesPage() {
  const services = await listActiveServices()

  const byCategory = new Map<string, typeof services>()
  for (const s of services) {
    const list = byCategory.get(s.category) ?? []
    list.push(s)
    byCategory.set(s.category, list)
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
      <div className="max-w-2xl">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          خدمات تشغيلية إلى جانب المنصة
        </h1>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          تطلب الخدمة، تحدّد الفرع، ترفع متطلباتك، وتستلم عرض سعر. بعد موافقتك
          تتابع مراحل التنفيذ حتى التسليم والتقييم — كل ذلك من نفس المكان الذي
          تدير منه فروعك.
        </p>
      </div>

      <div className="mt-12 space-y-10">
        {[...byCategory.entries()].map(([category, items]) => (
          <section key={category}>
            <h2 className="text-lg font-bold">{category}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((s) => {
                const price = toNumber(s.basePrice)
                return (
                  <div
                    key={s.id}
                    className="flex flex-col rounded-[var(--radius-lg)] border border-border bg-surface p-5"
                  >
                    <h3 className="font-semibold">{s.name}</h3>
                    <p className="mt-2 flex-1 text-sm text-muted-foreground leading-relaxed">
                      {s.summary}
                    </p>
                    <div className="mt-4 flex items-center justify-between gap-2">
                      <span className="text-sm font-bold tabular">
                        {price > 0 ? formatCurrency(price) : s.priceNote ?? 'حسب الطلب'}
                      </span>
                      {s.durationDays ? (
                        <Badge tone="neutral">{s.durationDays} يومًا</Badge>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-14 rounded-[var(--radius-lg)] border border-border bg-surface-muted/50 p-6 text-center">
        <h2 className="font-semibold">الطلب يبدأ من داخل حسابك</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground leading-relaxed">
          بعد إنشاء حسابك تختار الخدمة والفرع، وتتابع كل مرحلة بسجل زمني واضح.
        </p>
        <Button asChild className="mt-5">
          <Link href="/register">أنشئ حسابك</Link>
        </Button>
      </div>
    </div>
  )
}
