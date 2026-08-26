'use client'

import { useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'

/**
 * بطاقة بحدّ متوهّج يتتبّع المؤشر.
 *
 * التتبّع يكتب متغيّرَي CSS فقط ولا يُعيد تصيير React — لذا لا حالة هنا. بلا
 * JS تبقى البطاقة بطاقة عادية، والتوهّج زينة تُفقد بلا ضرر.
 */
export function SpotlightCard({
  className,
  children,
  as: Tag = 'div',
}: {
  className?: string
  children: React.ReactNode
  as?: 'div' | 'article' | 'li'
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const frame = useRef<number | null>(null)

  const onMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = ref.current
    if (!el) return
    // rAF يمنع كتابة المتغيّرات عشرات المرات في الإطار الواحد
    if (frame.current !== null) return
    const { clientX, clientY } = e
    frame.current = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${clientX - rect.left}px`)
      el.style.setProperty('--my', `${clientY - rect.top}px`)
      frame.current = null
    })
  }, [])

  return (
    <Tag
      ref={ref as never}
      onMouseMove={onMove}
      className={cn(
        'glow-border lift rounded-[var(--radius-lg)] border border-border bg-surface',
        className,
      )}
    >
      {children}
    </Tag>
  )
}
