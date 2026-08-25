'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatNumber, GREGORIAN } from '@/lib/utils'

export interface TrendPoint {
  date: string
  score: number
}

function shortDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  // ميلادي صراحة: التقويم الهجري يجعل نقاط الشهر الواحد متطابقة الاسم
  return new Intl.DateTimeFormat(GREGORIAN, {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Riyadh',
  }).format(d)
}

interface TooltipPayload {
  payload?: { date: string; score: number }
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: TooltipPayload[]
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null

  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 shadow-md">
      <div className="text-xs text-muted-foreground">{shortDate(point.date)}</div>
      <div className="mt-0.5 text-sm font-bold tabular">
        {formatNumber(point.score, 'ar-SA', 1)}٪
      </div>
    </div>
  )
}

export function ComplianceTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="complianceFill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="hsl(var(--primary))"
                stopOpacity={0.22}
              />
              <stop
                offset="100%"
                stopColor="hsl(var(--primary))"
                stopOpacity={0.02}
              />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            minTickGap={24}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'hsl(var(--border))' }} />
          <Area
            type="monotone"
            dataKey="score"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#complianceFill)"
            // حركة قصيرة — ضمن نطاق 150–250ms
            animationDuration={220}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
