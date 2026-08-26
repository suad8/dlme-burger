'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

export interface FilterOption {
  value: string
  label: string
}

/**
 * فلاتر محفوظة في الـURL. تغيير الفلتر يعيد الترقيم إلى الصفحة الأولى، وإلا
 * ظهرت نتائج فارغة لأن الصفحة ٣ من فلتر سابق قد لا توجد في الفلتر الجديد.
 */
export function FilterTabs({
  param,
  options,
  current,
}: {
  param: string
  options: FilterOption[]
  current: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function select(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'ALL') params.delete(param)
    else params.set(param, value)
    params.delete('page')
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <div
      role="group"
      aria-label="تصفية النتائج"
      className="flex flex-wrap gap-1.5 overflow-x-auto"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => select(o.value)}
          aria-pressed={current === o.value}
          className={cn(
            'whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors duration-150',
            current === o.value
              ? 'border-primary bg-primary-soft text-primary'
              : 'border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-surface-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
