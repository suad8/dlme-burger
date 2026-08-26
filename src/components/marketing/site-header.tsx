'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/app/theme-toggle'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/#features', label: 'المميزات' },
  { href: '/#solutions', label: 'الحلول' },
  { href: '/services', label: 'الخدمات' },
  { href: '/pricing', label: 'الأسعار' },
  { href: '/faq', label: 'الأسئلة الشائعة' },
  { href: '/about', label: 'من نحن' },
]

/**
 * الهيدر يصبح أكثف عند التمرير: حدّ وظل يظهران تدريجيًا فيفصل الشريط عن
 * المحتوى دون أن يكون ثقيلًا أعلى الصفحة.
 */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let frame: number | null = null
    function onScroll() {
      if (frame !== null) return
      frame = requestAnimationFrame(() => {
        setScrolled(window.scrollY > 12)
        frame = null
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-40 bg-background/80 backdrop-blur-md',
        '[transition:border-color_var(--dur-base)_var(--ease-smooth),box-shadow_var(--dur-base)_var(--ease-smooth),background-color_var(--dur-base)_var(--ease-smooth)]',
        scrolled
          ? 'border-b border-border shadow-sm'
          : 'border-b border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <Link
          href="/"
          className="group flex items-center gap-2.5 text-lg font-bold"
          aria-label="إتقان — الصفحة الرئيسية"
        >
          <span className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] bg-primary text-sm text-primary-foreground [transition:transform_var(--dur-base)_var(--ease-spring)] group-hover:scale-110">
            إ
          </span>
          إتقان
        </Link>

        <nav aria-label="التنقل الرئيسي" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="underline-grow rounded-[var(--radius-sm)] px-3 py-2 text-sm text-muted-foreground [transition:color_var(--dur-fast)_var(--ease-smooth)] hover:text-foreground"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/login">تسجيل الدخول</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/register">تجربة مجانية</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
          >
            {open ? (
              <X className="size-5" aria-hidden />
            ) : (
              <Menu className="size-5" aria-hidden />
            )}
          </Button>
        </div>
      </div>

      {open && (
        <nav
          aria-label="التنقل — الجوال"
          className="lg:hidden border-t border-border bg-surface px-5 py-3"
        >
          <ul className="space-y-0.5">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="tap-target flex items-center rounded-[var(--radius-md)] px-3 text-sm text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="sm:hidden">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="tap-target flex items-center rounded-[var(--radius-md)] px-3 text-sm font-medium text-primary"
              >
                تسجيل الدخول
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  )
}
