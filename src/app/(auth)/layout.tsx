import Link from 'next/link'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-muted/40 px-5 py-12">
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
      <main id="main" className="mt-8 w-full max-w-md">
        {children}
      </main>
    </div>
  )
}
