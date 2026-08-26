import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // الحزم التي يجب أن تبقى خارج حزمة الخادم
  serverExternalPackages: ['@prisma/client', 'pg'],

  /**
   * مسار تقديم الملفات يقرأ من مجلد تخزين يُحدَّد وقت التشغيل، لا وقت البناء.
   * تحليل Next الساكن لا يستطيع معرفة ما سيُقرأ، فيتتبّع المشروع كله ويحزم
   * كل المصدر داخل حزمة الخادم. نستثنيه صراحة: المجلد بيانات لا كود.
   */
  outputFileTracingExcludes: {
    '/api/files': [
      './src/**/*',
      './public/**/*',
      './.storage/**/*',
      './prisma/**/*',
      './legacy/**/*',
    ],
  },

  typescript: {
    // لا نتجاوز أخطاء الأنواع أبدًا — البناء يفشل إن وُجدت
    ignoreBuildErrors: false,
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(self)',
          },
        ],
      },
    ]
  },
}

export default nextConfig
