import { NextResponse } from 'next/server'
import { getTenantContext } from '@/server/tenant'
import { authorize, ForbiddenError } from '@/server/rbac'
import { buildReport, toCsv, REPORTS, type ReportKey } from '@/server/services/reports'
import { recordAudit } from '@/server/audit'

/**
 * تصدير تقرير إلى CSV.
 *
 * الصلاحية تُفرض هنا مجددًا ولا يُعتمد على إخفاء الزر في الواجهة. النطاق
 * (المنشأة والفروع) يأتي من الجلسة، فلا يمكن توسيعه عبر معاملات الرابط.
 */

const VALID_KEYS = new Set(REPORTS.map((r) => r.key))

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const ctx = await getTenantContext()
  if (!ctx) {
    return NextResponse.json({ error: 'غير مصرّح.' }, { status: 401 })
  }

  const { key } = await params
  if (!VALID_KEYS.has(key as ReportKey)) {
    return NextResponse.json({ error: 'تقرير غير معروف.' }, { status: 404 })
  }

  try {
    authorize(ctx, 'report:export')
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { error: 'ليست لديك صلاحية تصدير التقارير.' },
        { status: 403 },
      )
    }
    throw error
  }

  const url = new URL(request.url)
  const raw = url.searchParams.get('period')
  const period = raw === '7' ? 7 : raw === '90' ? 90 : 30

  const table = await buildReport(ctx, key as ReportKey, period)
  const csv = toCsv(table)

  await recordAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'report.exported',
    entityType: 'Report',
    entityId: key,
    after: { report: key, period, rows: table.rows.length },
  })

  const stamp = new Date().toISOString().slice(0, 10)
  const filename = `itqan-${key}-${stamp}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      // تقرير يخص مستأجرًا بعينه — لا يُخزَّن في أي وسيط
      'Cache-Control': 'no-store, private',
    },
  })
}
