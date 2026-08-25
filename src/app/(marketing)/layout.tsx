import Link from 'next/link'
import { Button } from '@/components/ui/button'

const NAV = [
  { href: '/#features', label: 'المميزات' },
  { href: '/#solutions', label: 'الحلول' },
  { href: '/services', label: 'الخدمات' },
  { href: '/pricing', label: 'الأسعار' },
  { href: '/faq', label: 'الأسئلة الشائعة' },
  { href: '/about', label: 'من نحن' },
]

const FOOTER_GROUPS = [
  {
    title: 'المنتج',
    links: [
      { href: '/#features', label: 'المميزات' },
      { href: '/#solutions', label: 'الحلول' },
      { href: '/services', label: 'الخدمات التشغيلية' },
      { href: '/pricing', label: 'الأسعار والباقات' },
    ],
  },
  {
    title: 'الشركة',
    links: [
      { href: '/about', label: 'من نحن' },
      { href: '/customers', label: 'قصص النجاح' },
      { href: '/contact', label: 'تواصل معنا' },
      { href: '/faq', label: 'الأسئلة الشائعة' },
    ],
  },
  {
    title: 'قانوني',
    links: [
      { href: '/privacy', label: 'سياسة الخصوصية' },
      { href: '/terms', label: 'الشروط والأحكام' },
    ],
  },
]

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-bold text-lg"
            aria-label="إتقان — الصفحة الرئيسية"
          >
            <span className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] bg-primary text-primary-foreground text-sm">
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
                    className="rounded-[var(--radius-sm)] px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-surface-muted"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">تسجيل الدخول</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">تجربة مجانية</Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-border bg-surface-muted/30">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2.5 font-bold">
                <span className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] bg-primary text-primary-foreground text-sm">
                  إ
                </span>
                إتقان
              </div>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                منصة تشغيل المطاعم والمقاهي — مبنية للسوق السعودي.
              </p>
            </div>

            {FOOTER_GROUPS.map((group) => (
              <nav key={group.title} aria-label={group.title}>
                <h2 className="text-sm font-semibold">{group.title}</h2>
                <ul className="mt-3 space-y-2">
                  {group.links.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          <div className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
            © {new Date().getFullYear()} إتقان. جميع الحقوق محفوظة.
          </div>
        </div>
      </footer>
    </div>
  )
}
