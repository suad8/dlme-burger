import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

const RIYADH = 'Asia/Riyadh'

/**
 * تنبيه: `ar-SA` يستخدم التقويم الهجري افتراضيًا. هذا صحيح للعرض العام، لكنه
 * يجعل محاور الرسوم والتقارير اليومية غير مقروءة (كل نقاط الشهر تحمل نفس اسم
 * الشهر). لذلك نثبّت التقويم الميلادي في كل ما يُقرأ كبيانات.
 */
export const GREGORIAN = 'ar-SA-u-ca-gregory'

/** تنسيق مبلغ بالريال السعودي. */
export function formatCurrency(
  value: number | string,
  locale = 'ar-SA',
): string {
  const n = typeof value === 'string' ? Number(value) : value
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'SAR',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0)
}

export function formatNumber(
  value: number | string,
  locale = 'ar-SA',
  fractionDigits = 0,
): string {
  const n = typeof value === 'string' ? Number(value) : value
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(Number.isFinite(n) ? n : 0)
}

export function formatPercent(
  value: number | string,
  locale = 'ar-SA',
  fractionDigits = 1,
): string {
  const n = typeof value === 'string' ? Number(value) : value
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: fractionDigits,
  }).format((Number.isFinite(n) ? n : 0) / 100)
}

export function formatDate(
  value: Date | string | null | undefined,
  locale = GREGORIAN,
): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: RIYADH,
  }).format(d)
}

export function formatDateTime(
  value: Date | string | null | undefined,
  locale = GREGORIAN,
): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: RIYADH,
  }).format(d)
}

/** «قبل ٣ أيام» — للنشاطات الأخيرة. */
export function formatRelative(
  value: Date | string | null | undefined,
  locale = 'ar',
): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'

  const diffMs = d.getTime() - Date.now()
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 1000 * 60 * 60 * 24 * 365],
    ['month', 1000 * 60 * 60 * 24 * 30],
    ['day', 1000 * 60 * 60 * 24],
    ['hour', 1000 * 60 * 60],
    ['minute', 1000 * 60],
  ]

  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms) {
      return rtf.format(Math.round(diffMs / ms), unit)
    }
  }
  return rtf.format(0, 'minute')
}

/** يحوّل Decimal من Prisma إلى رقم آمن للواجهة. */
export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}
