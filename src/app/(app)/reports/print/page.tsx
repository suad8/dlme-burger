import type { Metadata } from 'next'
import { requireTenant } from '@/server/tenant'
import { can } from '@/server/rbac'
import { REPORTS, buildReport, type ReportKey } from '@/server/services/reports'
import { getOrganizationSettings } from '@/server/services/settings'
import { formatDateTime, formatNumber, GREGORIAN } from '@/lib/utils'
import { NoPermission } from '@/components/ui/states'
import { PrintButton } from './print-button'

export const metadata: Metadata = {
  title: 'نسخة للطباعة',
  robots: { index: false, follow: false },
}

const KEYS = REPORTS.map((report) => report.key)

function parseKey(value: string | undefined): ReportKey {
  return value && (KEYS as string[]).includes(value)
    ? (value as ReportKey)
    : 'branch-performance'
}

function parsePeriod(value: string | undefined): 7 | 30 | 90 {
  if (value === '7') return 7
  if (value === '90') return 90
  return 30
}

/**
 * نسخة التقرير للطباعة أو الحفظ PDF.
 *
 * التصيير يتم في المتصفح لا على الخادم عمدًا. توليد PDF من كود Node يتطلّب
 * تشكيل الحروف العربية ووصلها واتجاه النص ثنائي الاتجاه، وهو ما لا تفعله
 * مكتبات PDF في جافاسكربت بلا محرّك تشكيل. المتصفح يفعله أصلًا وبإتقان،
 * فالنتيجة نص عربي موصول وقابل للتحديد والبحث بدل صورة أو حروف مقطّعة.
 *
 * الصلاحية هنا `report:export` لا `report:view`: هذه نسخة قابلة للمشاركة
 * خارج المنصّة، فتُعامَل معاملة التصدير.
 */
export default async function ReportPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string; period?: string }>
}) {
  const ctx = await requireTenant()

  if (!can(ctx, 'report:export')) {
    return (
      <NoPermission
        description="النسخة القابلة للمشاركة تتطلّب صلاحية تصدير التقارير."
        backHref="/reports"
        backLabel="العودة إلى التقارير"
      />
    )
  }

  const params = await searchParams
  const key = parseKey(params.report)
  const period = parsePeriod(params.period)

  const [table, settings] = await Promise.all([
    buildReport(ctx, key, period),
    getOrganizationSettings(ctx),
  ])

  const meta = REPORTS.find((report) => report.key === key)!
  const generatedAt = new Date()

  return (
    <div className="print-sheet mx-auto max-w-4xl">
      <PrintButton />

      <header className="border-b-2 border-foreground pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">{settings.name}</h1>
            {settings.vatNumber && (
              <p className="mt-0.5 text-xs">
                الرقم الضريبي:{' '}
                <span className="latin">{settings.vatNumber}</span>
              </p>
            )}
            {settings.city && <p className="text-xs">{settings.city}</p>}
          </div>
          <div className="text-start">
            <div className="text-sm font-semibold">إتقان</div>
            <div className="text-[10px]">منصّة تشغيل المنشآت الغذائية</div>
          </div>
        </div>
      </header>

      <div className="mt-5">
        <h2 className="text-lg font-bold">{meta.title}</h2>
        <p className="mt-1 text-xs">{meta.description}</p>

        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <div className="flex gap-1">
            <dt className="font-medium">الفترة:</dt>
            <dd>آخر {formatNumber(period)} يومًا</dd>
          </div>
          <div className="flex gap-1">
            <dt className="font-medium">النطاق:</dt>
            <dd>
              {ctx.branchScope
                ? `${formatNumber(ctx.branchScope.length)} فرع مصرّح به`
                : 'كل الفروع'}
            </dd>
          </div>
          <div className="flex gap-1">
            <dt className="font-medium">عدد السجلات:</dt>
            <dd className="tabular">{formatNumber(table.rows.length)}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="font-medium">أُصدر في:</dt>
            <dd>{formatDateTime(generatedAt)}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="font-medium">بواسطة:</dt>
            <dd>{ctx.userName}</dd>
          </div>
        </dl>
      </div>

      {table.rows.length === 0 ? (
        <p className="mt-8 text-sm">لا بيانات في هذه الفترة.</p>
      ) : (
        <table className="print-table mt-5 w-full border-collapse text-xs">
          <caption className="sr-only">{table.title}</caption>
          <thead>
            <tr>
              {table.headers.map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="border border-foreground/30 bg-foreground/5 px-2 py-1.5 text-start font-semibold"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="border border-foreground/20 px-2 py-1 align-top"
                  >
                    {typeof cell === 'number' ? formatNumber(cell) : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <footer className="mt-8 border-t pt-3 text-[10px] leading-relaxed">
        <p>
          تقرير داخلي يخص {settings.name}. النطاق محدود بصلاحيات من أصدره، وقد
          لا يمثّل كامل بيانات المنشأة.
        </p>
        <p className="latin mt-0.5" dir="ltr">
          {new Intl.DateTimeFormat(GREGORIAN, {
            dateStyle: 'short',
            timeStyle: 'short',
          }).format(generatedAt)}
        </p>
      </footer>
    </div>
  )
}
