import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Sans_Arabic, Manrope } from 'next/font/google'
import { Toaster } from 'sonner'
import { THEME_INIT_SCRIPT } from '@/components/app/theme-toggle'
import './globals.css'

// عائلتان فقط — لا ثالثة.
const arabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-arabic',
  display: 'swap',
})

const latin = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-latin',
  display: 'swap',
})

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'إتقان — منصة تشغيل المطاعم والمقاهي',
    template: '%s · إتقان',
  },
  description:
    'منصة سعودية لإدارة تشغيل المطاعم والمقاهي: قوائم فحص، زيارات ميدانية، إجراءات تصحيحية، تكلفة المنتجات، ومقارنة أداء الفروع من مكان واحد.',
  applicationName: 'إتقان',
  openGraph: {
    type: 'website',
    locale: 'ar_SA',
    siteName: 'إتقان',
    title: 'إتقان — منصة تشغيل المطاعم والمقاهي',
    description:
      'أدِر فروعك وفحوصاتك وتكاليفك من منصة واحدة مبنية للسوق السعودي.',
    url: APP_URL,
  },
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F9FAF7' },
    { media: '(prefers-color-scheme: dark)', color: '#0F1714' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl" className={`${arabic.variable} ${latin.variable}`}>
      <head>
        {/* يعمل قبل أول رسم فيمنع وميض الوضع الفاتح لمن اختار الداكن */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        {/* تخطي إلى المحتوى — شرط تنقل بلوحة المفاتيح */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:start-3 focus:z-50 focus:rounded-[var(--radius-md)] focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          تخطَّ إلى المحتوى
        </a>
        {children}
        <Toaster
          position="top-center"
          dir="rtl"
          toastOptions={{
            classNames: {
              toast:
                'bg-surface text-foreground border border-border shadow-md rounded-[var(--radius-md)]',
            },
          }}
        />
      </body>
    </html>
  )
}
