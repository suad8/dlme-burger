import type { Metadata } from 'next'
import { Building2, Plus, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input, Label, Textarea, FieldError, FieldHint } from '@/components/ui/input'
import { TableWrap, Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { Skeleton, SkeletonTable, EmptyState, ErrorState } from '@/components/ui/states'
import { ComplianceTrendChart } from '@/components/charts/compliance-trend'

export const metadata: Metadata = {
  title: 'نظام التصميم',
  robots: { index: false, follow: false },
}

const COLORS = [
  ['background', 'الخلفية'],
  ['surface', 'السطح'],
  ['surface-muted', 'سطح هادئ'],
  ['primary', 'الأساسي'],
  ['primary-soft', 'أساسي فاتح'],
  ['accent', 'التمييز'],
  ['success', 'نجاح'],
  ['warning', 'تحذير'],
  ['danger', 'خطر'],
  ['info', 'معلومة'],
  ['border', 'الحدود'],
  ['muted-foreground', 'نص هادئ'],
] as const

const TREND = Array.from({ length: 14 }, (_, i) => ({
  date: new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10),
  score: 74 + Math.round(Math.sin(i / 2) * 8) + i,
}))

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="scroll-mt-20">
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  )
}

export default function DesignSystemPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-12 space-y-14">
      <header>
        <Badge tone="primary">مرجع داخلي</Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          نظام تصميم إتقان
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground leading-relaxed">
          الطابع: الضيافة التشغيلية الحديثة. هادئ، تقني، فاخر دون مبالغة. كل
          لون ونصف قطر وظل معرّف كـtoken واحد يُستهلك من كل المنتج.
        </p>
      </header>

      <Section title="الألوان" description="كلها CSS Variables بصيغة HSL، تتبدّل مع الوضع الداكن.">
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {COLORS.map(([token, label]) => (
            <div
              key={token}
              className="rounded-[var(--radius-md)] border border-border overflow-hidden"
            >
              <div
                className="h-16 w-full"
                style={{ backgroundColor: `hsl(var(--${token}))` }}
              />
              <div className="p-2.5">
                <div className="text-xs font-medium">{label}</div>
                <code className="latin text-[10px] text-muted-foreground">
                  --{token}
                </code>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="الخطوط" description="عائلتان فقط: IBM Plex Sans Arabic للعربية، Manrope للاتينية والأرقام.">
        <div className="space-y-3 rounded-[var(--radius-lg)] border border-border bg-surface p-6">
          <p className="text-3xl font-bold">تشغيل المطاعم والمقاهي</p>
          <p className="text-xl font-semibold">درجة الالتزام التشغيلي</p>
          <p className="text-base">
            نص أساسي بحجم قياسي يُستخدم في الفقرات والوصف داخل البطاقات.
          </p>
          <p className="text-sm text-muted-foreground">
            نص ثانوي هادئ للتوضيحات والتلميحات.
          </p>
          <p className="latin text-lg font-semibold tabular">
            1,234.56 SAR · 92.4% · 2026-08-25
          </p>
        </div>
      </Section>

      <Section title="الأزرار" description="كل الحالات: عادي، تحويم، تركيز، ضغط، معطّل، تحميل.">
        <div className="space-y-4 rounded-[var(--radius-lg)] border border-border bg-surface p-6">
          <div className="flex flex-wrap gap-3">
            <Button>أساسي</Button>
            <Button variant="secondary">ثانوي</Button>
            <Button variant="subtle">خفيف</Button>
            <Button variant="ghost">شبح</Button>
            <Button variant="danger">حذف</Button>
            <Button variant="link">رابط</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">صغير</Button>
            <Button size="md">متوسط</Button>
            <Button size="lg">كبير</Button>
            <Button size="icon" aria-label="إضافة">
              <Plus className="size-4" aria-hidden />
            </Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button disabled>معطّل</Button>
            <Button loading>جارٍ الحفظ</Button>
            <Button variant="secondary">
              <Download className="size-4" aria-hidden />
              صدّر التقرير
            </Button>
          </div>
        </div>
      </Section>

      <Section title="الشارات">
        <div className="flex flex-wrap gap-2 rounded-[var(--radius-lg)] border border-border bg-surface p-6">
          <Badge tone="neutral">محايد</Badge>
          <Badge tone="primary">أساسي</Badge>
          <Badge tone="success">مكتمل</Badge>
          <Badge tone="warning">قيد التنفيذ</Badge>
          <Badge tone="danger">متأخر</Badge>
          <Badge tone="info">معلومة</Badge>
          <Badge tone="accent">مميّز</Badge>
        </div>
      </Section>

      <Section title="الحقول" description="مع تسمية وتلميح ورسالة خطأ مرتبطة بـaria.">
        <div className="grid gap-5 rounded-[var(--radius-lg)] border border-border bg-surface p-6 sm:grid-cols-2">
          <div>
            <Label htmlFor="ds-1" required>حقل مطلوب</Label>
            <Input id="ds-1" className="mt-1.5" placeholder="اسم الفرع" />
            <FieldHint>يظهر في التقارير ومقارنة الفروع.</FieldHint>
          </div>
          <div>
            <Label htmlFor="ds-2">حقل بخطأ</Label>
            <Input id="ds-2" className="mt-1.5" aria-invalid defaultValue="RUH 01" />
            <FieldError>الرمز يقبل أحرفًا إنجليزية وأرقامًا وشرطة فقط.</FieldError>
          </div>
          <div>
            <Label htmlFor="ds-3">حقل معطّل</Label>
            <Input id="ds-3" className="mt-1.5" disabled defaultValue="غير قابل للتعديل" />
          </div>
          <div>
            <Label htmlFor="ds-4">نص طويل</Label>
            <Textarea id="ds-4" className="mt-1.5" placeholder="ملاحظات المناوبة…" />
          </div>
        </div>
      </Section>

      <Section title="البطاقات">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>درجة الالتزام</CardTitle>
              <CardDescription>متوسط الفحوصات المعتمدة خلال الفترة.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tabular">٩٢٫٤٪</div>
              <Badge tone="success" className="mt-2">+٢٫١ عن الفترة السابقة</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>إجراءات مفتوحة</CardTitle>
              <CardDescription>تشمل المتأخرة وقيد المراجعة.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tabular">٧</div>
              <Badge tone="danger" className="mt-2">٣ متأخرة</Badge>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title="الجداول" description="تمرير أفقي داخل حاوية الجدول — جسم الصفحة لا يتمدد.">
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH scope="col">الفرع</TH>
                <TH scope="col">الرمز</TH>
                <TH scope="col">الدرجة</TH>
                <TH scope="col">الحالة</TH>
              </TR>
            </THead>
            <TBody>
              {[
                ['مذاق — العليا', 'RUH-01', '٩٦٫٠٪', 'success', 'نشط'],
                ['مذاق — الملقا', 'RUH-02', '٨٩٫٢٪', 'warning', 'نشط'],
                ['ركوة — حطين', 'RUH-03', '٨٢٫٥٪', 'danger', 'قيد التجهيز'],
              ].map((row) => (
                <TR key={row[1]}>
                  <TD className="font-medium">{row[0]}</TD>
                  <TD className="latin text-xs">{row[1]}</TD>
                  <TD className="tabular">{row[2]}</TD>
                  <TD>
                    <Badge tone={row[3] as 'success' | 'warning' | 'danger'}>
                      {row[4]}
                    </Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      </Section>

      <Section title="الرسوم البيانية" description="متوافقة مع RTL عبر عزل اتجاه الرسم إلى LTR.">
        <Card>
          <CardContent className="pt-5">
            <ComplianceTrendChart data={TREND} />
          </CardContent>
        </Card>
      </Section>

      <Section title="حالات التحميل" description="هياكل تحجز المساحة فيمنع قفز المحتوى.">
        <div className="space-y-4">
          <div className="flex gap-3">
            <Skeleton className="size-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <SkeletonTable rows={3} />
        </div>
      </Section>

      <Section title="حالة الفراغ" description="دائمًا بإجراء واضح، لا رسالة معلّقة.">
        <EmptyState
          icon={Building2}
          title="لا توجد فروع بعد"
          description="أضف أول فرع لتبدأ جدولة الفحوصات ومتابعة الالتزام."
          actionLabel="أضف فرعًا"
          actionHref="/branches/new"
        />
      </Section>

      <Section title="حالة الخطأ">
        <ErrorState />
      </Section>
    </div>
  )
}
