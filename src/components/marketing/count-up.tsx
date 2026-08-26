'use client'

import { useEffect, useRef, useState } from 'react'
import { formatNumber } from '@/lib/utils'

/**
 * رقم يتصاعد عند دخوله الشاشة.
 *
 * يحترم `prefers-reduced-motion`: من يطلب تقليل الحركة يرى القيمة النهائية
 * مباشرة بلا عدّ. التفضيل يُقرأ في مُهيّئ الحالة لا داخل التأثير، فلا يحدث
 * تصيير متتالٍ ولا وميض للقيمة صفر ثم قفزها.
 */

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function CountUp({
  value,
  suffix = '',
  fractionDigits = 0,
  durationMs = 1100,
  className,
}: {
  value: number
  suffix?: string
  fractionDigits?: number
  durationMs?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement | null>(null)
  // القيمة الابتدائية تحسم حالة تقليل الحركة قبل أول رسم
  const [display, setDisplay] = useState(() =>
    prefersReducedMotion() ? value : 0,
  )
  const done = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el || done.current || prefersReducedMotion()) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry?.isIntersecting || done.current) return
        done.current = true
        observer.disconnect()

        const start = performance.now()
        function tick(now: number) {
          const t = Math.min(1, (now - start) / durationMs)
          // easeOutExpo — يبطئ قرب النهاية فيبدو استقرارًا لا توقفًا مفاجئًا
          const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
          setDisplay(value * eased)
          if (t < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      },
      { threshold: 0.4 },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [value, durationMs])

  return (
    <span ref={ref} className={className}>
      {formatNumber(display, 'ar-SA', fractionDigits)}
      {suffix}
    </span>
  )
}
