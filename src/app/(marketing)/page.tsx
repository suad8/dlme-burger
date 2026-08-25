import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowLeft,
  ClipboardCheck,
  Building2,
  TrendingDown,
  ShieldCheck,
  Boxes,
  Users,
  ChartNoAxesColumn,
  CircleCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ProductPreview } from '@/components/marketing/product-preview'

export const metadata: Metadata = {
  // absolute حتى لا يُلحق القالب اسم المنصة مرتين
  title: { absolute: 'إتقان — منصة تشغيل المطاعم والمقاهي' },
  description:
    'أدِر الفحوصات والزيارات والإجراءات التصحيحية وتكلفة المنتجات ومقارنة أداء فروعك من منصة واحدة مبنية للسوق السعودي.',
}

const CAPABILITIES = [
  {
    icon: ClipboardCheck,
    title: 'قوائم فحص تُنفَّذ من الجوال',
    body: 'قوالب بأقسام وأسئلة متعددة الأنواع، مع صور وتوقيع، ومنع الإغلاق قبل إكمال الحقول الإلزامية.',
  },
  {
    icon: ShieldCheck,
    title: 'زيارات موثّقة لا تُعدَّل بصمت',
    body: 'سجل زمني لكل زيارة، صور قبل وبعد، وتوقيع المفتش ومدير الفرع.',
  },
  {
    icon: CircleCheck,
    title: 'إجراءات تصحيحية بمسؤول وموعد',
    body: 'كل مخالفة تتحول إلى إجراء له مالك وأولوية وموعد نهائي واعتماد بعد الإنجاز.',
  },
  {
    icon: Building2,
    title: 'إدارة فروع وعلامات متعددة',
    body: 'إعدادات تُورَّث من العلامة للفرع مع إمكانية التخصيص، ومقارنة أداء مباشرة.',
  },
  {
    icon: TrendingDown,
    title: 'تكلفة المنتجات وهندسة المنيو',
    body: 'تكلفة كل صنف من مكوناته، نسبة Food Cost، وتصنيف الأصناف حسب الشعبية والربحية.',
  },
  {
    icon: Boxes,
    title: 'مخزون وهدر بأسباب واضحة',
    body: 'حركة مخزون كسجل غير قابل للتعديل، حد إعادة طلب، وتحليل الهدر بأسبابه.',
  },
]

const AUDIENCES = [
  { title: 'المطاعم والمقاهي', body: 'ضبط الجودة اليومية وتوحيد المعايير بين المناوبات.' },
  { title: 'الفود ترك', body: 'فحوصات خفيفة تُنفَّذ من الجوال في الموقع مباشرة.' },
  { title: 'المطابخ السحابية', body: 'متابعة السلامة والتكاليف دون صالة أو خدمة مباشرة.' },
  { title: 'العلامات متعددة الفروع', body: 'مقارنة الفروع وتوحيد الإعدادات من مكان واحد.' },
  { title: 'شركات التشغيل', body: 'إدارة منشآت العملاء بصلاحيات ونطاق فروع منفصل لكل فريق.' },
  { title: 'المستشارون', body: 'زيارات تقييم موثّقة وتقارير قابلة للتصدير للعميل.' },
]

export default function HomePage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          className="absolute inset-0 -z-10 opacity-[0.35]"
          style={{
            backgroundImage:
              'radial-gradient(hsl(var(--primary) / 0.10) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
          aria-hidden
        />
        <div className="mx-auto max-w-6xl px-5 pt-16 pb-14 sm:pt-24 sm:pb-20">
          <div className="max-w-2xl">
            <Badge tone="primary">
              منصة سعودية لتشغيل المنشآت الغذائية
            </Badge>
            <h1 className="mt-5 text-3xl sm:text-5xl font-bold leading-[1.25] tracking-tight">
              شغّل فروعك بمعيار واحد،
              <br />
              وقِس الالتزام بالأرقام لا بالانطباع.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed">
              إتقان يجمع قوائم الفحص والزيارات الميدانية والإجراءات التصحيحية
              وتكلفة المنتجات ومقارنة أداء الفروع في منصة واحدة — مبنية للعمل
              اليومي، لا للعرض.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/register">
                  ابدأ تجربة مجانية
                  <ArrowLeft className="size-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/pricing">اطّلع على الباقات</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              ١٤ يومًا بلا بطاقة ائتمانية · الأسعار بالريال السعودي شاملة ضريبة
              القيمة المضافة ١٥٪
            </p>
          </div>

          {/* واجهة حقيقية من المنتج — لا رسم توضيحي عام */}
          <div className="mt-14">
            <ProductPreview />
            <p className="mt-3 text-center text-xs text-muted-foreground">
              لقطة من لوحة التحكم — البيانات المعروضة بيانات تجريبية.
            </p>
          </div>
        </div>
      </section>

      {/* ── القدرات ──────────────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
          ما الذي تديره من إتقان
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground leading-relaxed">
          كل وحدة مبنية حول سؤال تشغيلي حقيقي: هل التزم الفرع؟ ومن المسؤول؟
          ومتى؟ وكم كلّفنا التقصير؟
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c) => (
            <Card key={c.title} className="h-full">
              <CardContent className="pt-5">
                <div className="flex size-10 items-center justify-center rounded-[var(--radius-md)] bg-primary-soft text-primary">
                  <c.icon className="size-5" aria-hidden />
                </div>
                <h3 className="mt-4 font-semibold">{c.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {c.body}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── الحلول حسب نوع العميل ────────────────────────────── */}
      <section
        id="solutions"
        className="border-y border-border bg-surface-muted/40"
      >
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            مبني لأكثر من شكل تشغيلي
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {AUDIENCES.map((a) => (
              <div
                key={a.title}
                className="rounded-[var(--radius-lg)] border border-border bg-surface p-5"
              >
                <h3 className="font-semibold">{a.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {a.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── الخدمات التشغيلية ────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <Badge tone="accent">إلى جانب البرنامج</Badge>
            <h2 className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight">
              خدمات تشغيلية تُطلب من داخل المنصة
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              حين تحتاج يدًا إضافية: مدير تشغيل، شيف، هندسة منيو، توثيق وصفات،
              تدريب، أو عميل خفي. تطلب الخدمة، تحدّد الفرع، وتتابع مراحل التنفيذ
              حتى التسليم والتقييم — في نفس المكان الذي تدير منه فروعك.
            </p>
            <Button asChild variant="secondary" className="mt-6">
              <Link href="/services">استعرض الخدمات</Link>
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: Users, label: 'مدير تشغيل' },
              { icon: ChartNoAxesColumn, label: 'هندسة المنيو' },
              { icon: ClipboardCheck, label: 'زيارة جودة' },
              { icon: ShieldCheck, label: 'عميل خفي' },
            ].map((s) => (
              <div
                key={s.label}
                className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-4"
              >
                <div className="flex size-9 items-center justify-center rounded-[var(--radius-sm)] bg-accent-soft text-[hsl(35_80%_32%)]">
                  <s.icon className="size-4" aria-hidden />
                </div>
                <span className="text-sm font-medium">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── دعوة ختامية ──────────────────────────────────────── */}
      <section className="border-t border-border bg-primary text-primary-foreground">
        <div className="mx-auto max-w-4xl px-5 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            ابدأ بفرع واحد، وتوسّع حين تحتاج
          </h2>
          <p className="mt-4 text-primary-foreground/80 leading-relaxed">
            جرّب المنصة كاملة ١٤ يومًا. لا بطاقة ائتمانية، ولا التزام.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-7 bg-surface text-primary hover:bg-surface-muted"
          >
            <Link href="/register">
              أنشئ حسابك الآن
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </section>
    </>
  )
}
