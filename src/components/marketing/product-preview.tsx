import {
  ClipboardCheck,
  TriangleAlert,
  Building2,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'

/**
 * واجهة حقيقية من المنتج داخل الـHero — لا رسم توضيحي عام.
 *
 * هذه نسخة ثابتة من تخطيط لوحة التحكم الفعلي، مبنية بنفس مكوّنات المنتج
 * وبنفس الـtokens. الأرقام موسومة صراحة كبيانات تجريبية، ولا تُقدَّم كأداء
 * حقيقي لعميل.
 */

const TILES = [
  { icon: ClipboardCheck, label: 'درجة الالتزام', value: '٩١٫٤٪', tone: 'success' as const, delta: '+٢٫١' },
  { icon: TriangleAlert, label: 'إجراءات مفتوحة', value: '٧', tone: 'warning' as const, delta: '٣ متأخرة' },
  { icon: Building2, label: 'فروع نشطة', value: '٣', tone: 'primary' as const, delta: null },
  { icon: Trash2, label: 'تكلفة الهدر', value: '١٬٢٤٠ ر.س', tone: 'danger' as const, delta: 'آخر ٣٠ يومًا' },
]

const BRANCHES = [
  { name: 'مذاق — العليا', city: 'الرياض', score: 96, actions: 1 },
  { name: 'مذاق — الملقا', city: 'الرياض', score: 89, actions: 2 },
  { name: 'ركوة — حطين', city: 'الرياض', score: 82, actions: 4 },
]

// نقاط اتجاه ثابتة للعرض التسويقي فقط
const TREND = [78, 82, 80, 85, 88, 86, 90, 89, 92, 91]

function scoreTone(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 90) return 'success'
  if (score >= 80) return 'warning'
  return 'danger'
}

export function ProductPreview() {
  const max = Math.max(...TREND)
  const min = Math.min(...TREND)
  const range = max - min || 1

  return (
    <div className="overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface shadow-lg">
      {/* شريط علوي يحاكي هيدر المنصة */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-muted/50 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex size-6 items-center justify-center rounded-[6px] bg-primary text-primary-foreground text-[11px] font-bold">
            إ
          </span>
          <span>مجموعة مذاق الرياض</span>
        </div>
        <Badge tone="neutral">بيانات تجريبية</Badge>
      </div>

      <div className="p-4 sm:p-5">
        {/* بطاقات المؤشرات */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TILES.map((t) => (
            <div
              key={t.label}
              className="rounded-[var(--radius-md)] border border-border bg-surface p-3.5"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <t.icon className="size-3.5" aria-hidden />
                {t.label}
              </div>
              <div className="mt-2 text-xl font-bold tabular">{t.value}</div>
              {t.delta ? (
                <div className="mt-1">
                  <Badge tone={t.tone}>{t.delta}</Badge>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-5">
          {/* اتجاه الالتزام */}
          <div className="lg:col-span-3 rounded-[var(--radius-md)] border border-border p-4">
            <h3 className="text-sm font-semibold">اتجاه الالتزام</h3>
            <p className="text-xs text-muted-foreground mt-0.5">آخر ١٠ أيام</p>
            <div
              className="mt-4 flex h-28 items-end gap-1.5"
              role="img"
              aria-label="رسم بياني يوضح ارتفاع درجة الالتزام خلال آخر عشرة أيام"
            >
              {TREND.map((v, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-[3px] bg-primary/75"
                  style={{ height: `${25 + ((v - min) / range) * 75}%` }}
                />
              ))}
            </div>
          </div>

          {/* مقارنة الفروع */}
          <div className="lg:col-span-2 rounded-[var(--radius-md)] border border-border p-4">
            <h3 className="text-sm font-semibold">مقارنة الفروع</h3>
            <ul className="mt-3.5 space-y-3">
              {BRANCHES.map((b) => (
                <li key={b.name}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium truncate">
                      {b.name}
                    </span>
                    <span className="text-xs font-bold tabular shrink-0">
                      {b.score}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className={
                        scoreTone(b.score) === 'success'
                          ? 'h-full rounded-full bg-success'
                          : scoreTone(b.score) === 'warning'
                            ? 'h-full rounded-full bg-warning'
                            : 'h-full rounded-full bg-danger'
                      }
                      style={{ width: `${b.score}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
