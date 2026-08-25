import type { Metadata } from 'next'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { listPublicPlans } from '@/server/services/catalog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, toNumber } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'الأسعار والباقات',
  description:
    'باقات إتقان بالريال السعودي شاملة ضريبة القيمة المضافة — من فرع واحد إلى شبكة فروع كاملة.',
  alternates: { canonical: '/pricing' },
}

// الأسعار تتغيّر نادرًا — إعادة توليد كل ساعة تكفي
export const revalidate = 3600

export default async function PricingPage() {
  const plans = await listPublicPlans()

  return (
    <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
      <div className="max-w-2xl">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          باقات تنمو مع فروعك
        </h1>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          كل الأسعار بالريال السعودي وشاملة ضريبة القيمة المضافة ١٥٪. تبدأ
          بتجربة مجانية ١٤ يومًا، وتغيّر باقتك متى شئت.
        </p>
      </div>

      <div className="mt-12 grid gap-5 lg:grid-cols-4">
        {plans.map((plan) => {
          const monthly = toNumber(plan.monthlyPrice)
          const isCustom = monthly === 0
          const highlighted = plan.tier === 'GROWTH'

          return (
            <div
              key={plan.id}
              className={
                highlighted
                  ? 'relative flex flex-col rounded-[var(--radius-lg)] border-2 border-primary bg-surface p-6 shadow-md'
                  : 'relative flex flex-col rounded-[var(--radius-lg)] border border-border bg-surface p-6'
              }
            >
              {highlighted && (
                <Badge tone="primary" className="absolute -top-3 start-6">
                  الأكثر ملاءمة
                </Badge>
              )}

              <h2 className="text-lg font-bold">{plan.name}</h2>
              <p className="mt-2 min-h-[3rem] text-sm text-muted-foreground leading-relaxed">
                {plan.description}
              </p>

              <div className="mt-4">
                {isCustom ? (
                  <div className="text-2xl font-bold">حسب الطلب</div>
                ) : (
                  <>
                    <span className="text-3xl font-bold tabular">
                      {formatCurrency(monthly)}
                    </span>
                    <span className="text-sm text-muted-foreground"> / شهريًا</span>
                  </>
                )}
              </div>

              <dl className="mt-5 space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <dt>الفروع</dt>
                  <dd className="font-medium tabular">
                    {plan.maxBranches >= 999 ? 'غير محدود' : plan.maxBranches}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>المستخدمون</dt>
                  <dd className="font-medium tabular">
                    {plan.maxUsers >= 999 ? 'غير محدود' : plan.maxUsers}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>العلامات التجارية</dt>
                  <dd className="font-medium tabular">
                    {plan.maxBrands >= 99 ? 'غير محدود' : plan.maxBrands}
                  </dd>
                </div>
              </dl>

              <ul className="mt-5 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f.id} className="flex items-start gap-2 text-sm">
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-success"
                      aria-hidden
                    />
                    <span>{f.name}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                variant={highlighted ? 'primary' : 'secondary'}
                className="mt-6 w-full"
              >
                <Link href={isCustom ? '/contact' : '/register'}>
                  {isCustom ? 'تواصل معنا' : 'ابدأ التجربة'}
                </Link>
              </Button>
            </div>
          )
        })}
      </div>

      <p className="mt-10 text-sm text-muted-foreground">
        حدود الاستخدام تُفرض على الخادم فعليًا: تجاوز عدد الفروع أو المستخدمين
        يمنع الإضافة حتى ترقية الباقة، ولا يحذف أي بيانات قائمة.
      </p>
    </div>
  )
}
