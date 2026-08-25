'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

const OPTIONS = [
  { value: 7, label: '٧ أيام' },
  { value: 30, label: '٣٠ يومًا' },
  { value: 90, label: '٩٠ يومًا' },
] as const

/** تغيير الفترة يُكتب في الـURL — قابل للمشاركة وللرجوع بالمتصفح. */
export function PeriodTabs({ current }: { current: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function select(value: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', String(value))
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div
      role="group"
      aria-label="اختيار الفترة"
      className="inline-flex rounded-[var(--radius-md)] border border-border bg-surface p-0.5"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => select(o.value)}
          aria-pressed={current === o.value}
          className={cn(
            'rounded-[calc(var(--radius-md)-3px)] px-3 py-1.5 text-xs font-medium transition-colors duration-150',
            current === o.value
              ? 'bg-primary-soft text-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
