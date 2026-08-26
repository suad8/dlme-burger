'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/utils'

/** الترقيم يُكتب في الـURL — الصفحة قابلة للمشاركة وللرجوع بالمتصفح. */
export function Pagination({
  total,
  page,
  perPage,
}: {
  total: number
  page: number
  perPage: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const lastPage = Math.max(1, Math.ceil(total / perPage))
  if (lastPage <= 1) return null

  const from = (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)

  function go(next: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(next))
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <nav
      aria-label="ترقيم الصفحات"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-xs text-muted-foreground tabular">
        {formatNumber(from)}–{formatNumber(to)} من {formatNumber(total)}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => go(page - 1)}
          disabled={page <= 1}
        >
          {/* في RTL السابق يشير يمينًا */}
          <ChevronRight className="size-4" aria-hidden />
          السابق
        </Button>
        <span className="text-xs text-muted-foreground tabular px-1">
          {formatNumber(page)} / {formatNumber(lastPage)}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => go(page + 1)}
          disabled={page >= lastPage}
        >
          التالي
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
      </div>
    </nav>
  )
}
