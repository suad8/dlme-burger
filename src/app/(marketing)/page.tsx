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
  Smartphone,
  Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ProductPreview } from '@/components/marketing/product-preview'
import { SpotlightCard } from '@/components/marketing/spotlight-card'
import { CountUp } from '@/components/marketing/count-up'

export const metadata: Metadata = {
  title: { absolute: 'إتقان — منصة تشغيل المطاعم والمقاهي' },
  description:
    'أدِر الفحوصات والزيارات والإجراءات التصحيحية وتكلفة المنتجات ومقارنة أداء فروعك من منصة واحدة مبنية للسوق السعودي.',
  alternates: { canonical: '/' },
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
    title: 'إجراءات بمسؤول وموعد',
    body: 'كل مخالفة تتحول إلى إجراء له مالك وأولوية وموعد نهائي واعتماد بعد الإنجاز.',
  },
  {
    icon: Building2,
    title: 'فروع وعلامات متعددة',
    body: 'إعدادات تُورَّث من العلامة للفرع مع إمكانية التخصيص، ومقارنة أداء مباشرة.',
  },
  {
    icon: TrendingDown,
    title: 'تكلفة المنتجات وهندسة المنيو',
    body: 'تكلفة كل صنف من مكوّناته، نسبة Food Cost، وتصنيف الأصناف حسب الشعبية والربحية.',
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

const MARQUEE_TAGS = [
  'قوائم فحص', 'زيارات ميدانية', 'إجراءات تصحيحية', 'مقارنة الفروع',
  'تكلفة المنتجات', 'هندسة المنيو', 'المخزون', 'الهدر',
  'ملفات الموظفين', 'صلاحيات دقيقة', 'سجل تدقيق', 'تقارير قابلة للتصدير',
]

export default function HomePage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="aurora" aria-hidden />
        <div
          className="absolute inset-0 -z-10 opacity-[0.30]"
          style={{
            backgroundImage:
              'radial-gradient(hsl(var(--primary) / 0.11) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
            maskImage:
              'radial-gradient(ellipse 90% 60% at 50% 0%, #000 40%, transparent 100%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 90% 60% at 50% 0%, #000 40%, transparent 100%)',
          }}
          aria-hidden
        />

        <div className="mx-auto max-w-6xl px-5 pt-16 pb-14 sm:pt-24 sm:pb-20">
          <div className="max-w-2xl">
            <div className="rise rise-1">
              <Badge tone="primary" className="relative">
                <span className="relative flex size-1.5">
                  <span className="pulse-dot absolute inset-0 rounded-full text-primary" />
                  <span className="relative size-1.5 rounded-full bg-primary" />
                </span>
                منصة سعودية لتشغيل المنشآت الغذائية
              </Badge>
            </div>

            <h1 className="rise rise-2 mt-5 text-3xl sm:text-5xl font-bold leading-[1.25] tracking-tight">
              شغّل فروعك بمعيار واحد،
              <br />
              <span className="text-gradient">وقِس الالتزام بالأرقام</span> لا
              بالانطباع.
            </h1>

            <p className="rise rise-3 mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed">
              إتقان يجمع قوائم الفحص والزيارات الميدانية والإجراءات التصحيحية
              وتكلفة المنتجات ومقارنة أداء الفروع في منصة واحدة — مبنية للعمل
              اليومي، لا للعرض.
            </p>

            <div className="rise rise-4 mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="group">
                <Link href="/register">
                  ابدأ تجربة مجانية
                  <ArrowLeft
                    className="size-4 transition-transform duration-200 group-hover:-translate-x-1"
                    aria-hidden
                  />
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/pricing">اطّلع على الباقات</Link>
              </Button>
            </div>

            <p className="rise rise-4 mt-4 text-xs text-muted-foreground">
              ١٤ يومًا بلا بطاقة ائتمانية · الأسعار بالريال السعودي شاملة ضريبة
              القيمة المضافة ١٥٪
            </p>
          </div>

          {/* واجهة حقيقية من المنتج — لا رسم توضيحي عام */}
          <div className="reveal mt-14">
            <ProductPreview />
            <p className="mt-3 text-center text-xs text-muted-foreground">
              لقطة من لوحة التحكم — البيانات المعروضة بيانات تجريبية.
            </p>
          </div>
        </div>

        {/* شريط متحرّك للقدرات */}
        <div className="marquee-wrap relative overflow-hidden border-t border-border bg-surface-muted/40 py-3">
          <div
            className="pointer-events-none absolute inset-y-0 start-0 z-10 w-24 bg-gradient-to-l from-transparent to-[hsl(var(--background))]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-y-0 end-0 z-10 w-24 bg-gradient-to-r from-transparent to-[hsl(var(--background))]"
            aria-hidden
          />
          <div className="marquee" aria-hidden>
            {[...MARQUEE_TAGS, ...MARQUEE_TAGS].map((tag, i) => (
              <span
                key={i}
                className="whitespace-nowrap rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
          <span className="sr-only">
            القدرات: {MARQUEE_TAGS.join('، ')}
          </span>
        </div>
      </section>

      {/* ── القدرات — Bento ──────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <div className="reveal">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            ما الذي تديره من إتقان
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground leading-relaxed">
            كل وحدة مبنية حول سؤال تشغيلي حقيقي: هل التزم الفرع؟ ومن المسؤول؟
            ومتى؟ وكم كلّفنا التقصير؟
          </p>
        </div>

        {/* Bento: أول بطاقتين أعرض — تسلسل بصري بدل شبكة متساوية رتيبة */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {CAPABILITIES.map((c, i) => (
            <SpotlightCard
              key={c.title}
              className={
                i < 2
                  ? 'reveal p-6 lg:col-span-3'
                  : 'reveal p-6 lg:col-span-2'
              }
            >
              <div className="flex size-10 items-center justify-center rounded-[var(--radius-md)] bg-primary-soft text-primary">
                <c.icon className="size-5" aria-hidden />
              </div>
              <h3 className="mt-4 font-semibold">{c.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {c.body}
              </p>
            </SpotlightCard>
          ))}
        </div>
      </section>

      {/* ── ما يميّز البناء ──────────────────────────────────── */}
      <section className="border-y border-border bg-surface-muted/40">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <div className="grid gap-8 lg:grid-cols-3">
            {[
              {
                icon: Lock,
                stat: 3,
                suffix: ' طبقات',
                title: 'عزل مفروض لا موعود',
                body: 'قيود في قاعدة البيانات، وتقييد كل استعلام بمعرّف المنشأة، واختبارات آلية تفشل عملية البناء إن تسرّب سجل بين منشأتين.',
              },
              {
                icon: Users,
                stat: 10,
                suffix: ' أدوار',
                title: 'صلاحيات دقيقة قابلة للتخصيص',
                body: 'من المالك إلى الاطّلاع فقط، مع تقييد كل مستخدم بفروع محددة. التحقق على الخادم قبل كل عملية، لا في الواجهة.',
              },
              {
                icon: Smartphone,
                stat: 44,
                suffix: 'px',
                title: 'مبني للجوال في الميدان',
                body: 'أهداف نقر مريحة، حفظ تلقائي أثناء الفحص، وأنماط تنقّل مخصّصة للجوال — لا تصغير لواجهة سطح المكتب.',
              },
            ].map((f) => (
              <div key={f.title} className="reveal">
                <div className="flex size-10 items-center justify-center rounded-[var(--radius-md)] bg-surface text-primary shadow-xs">
                  <f.icon className="size-5" aria-hidden />
                </div>
                <div className="mt-4 text-3xl font-bold tabular text-primary">
                  <CountUp value={f.stat} suffix={f.suffix} />
                </div>
                <h3 className="mt-2 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── الحلول ───────────────────────────────────────────── */}
      <section id="solutions" className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <h2 className="reveal text-2xl sm:text-3xl font-bold tracking-tight">
          مبني لأكثر من شكل تشغيلي
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AUDIENCES.map((a) => (
            <SpotlightCard key={a.title} className="reveal p-5">
              <h3 className="font-semibold">{a.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {a.body}
              </p>
            </SpotlightCard>
          ))}
        </div>
      </section>

      {/* ── الخدمات التشغيلية ────────────────────────────────── */}
      <section className="border-t border-border bg-surface-muted/40">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div className="reveal">
              <Badge tone="accent">إلى جانب البرنامج</Badge>
              <h2 className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight">
                خدمات تشغيلية تُطلب من داخل المنصة
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                حين تحتاج يدًا إضافية: مدير تشغيل، شيف، هندسة منيو، توثيق وصفات،
                تدريب، أو عميل خفي. تطلب الخدمة، تحدّد الفرع، وتتابع مراحل
                التنفيذ حتى التسليم والتقييم — في نفس المكان الذي تدير منه فروعك.
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
                <SpotlightCard
                  key={s.label}
                  className="reveal flex items-center gap-3 p-4"
                >
                  <div className="flex size-9 items-center justify-center rounded-[var(--radius-sm)] bg-accent-soft text-[hsl(35_80%_32%)]">
                    <s.icon className="size-4" aria-hidden />
                  </div>
                  <span className="text-sm font-medium">{s.label}</span>
                </SpotlightCard>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── دعوة ختامية ──────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-border bg-primary text-primary-foreground">
        <div
          className="absolute inset-0 opacity-[0.10]"
          style={{
            backgroundImage:
              'radial-gradient(hsl(0 0% 100%) 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-4xl px-5 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            ابدأ بفرع واحد، وتوسّع حين تحتاج
          </h2>
          <p className="mt-4 text-primary-foreground/80 leading-relaxed">
            جرّب المنصة كاملة ١٤ يومًا. لا بطاقة ائتمانية، ولا التزام.
          </p>
          <Button
            asChild
            size="lg"
            className="group mt-7 bg-surface text-primary hover:bg-surface-muted"
          >
            <Link href="/register">
              أنشئ حسابك الآن
              <ArrowLeft
                className="size-4 transition-transform duration-200 group-hover:-translate-x-1"
                aria-hidden
              />
            </Link>
          </Button>
        </div>
      </section>
    </>
  )
}
