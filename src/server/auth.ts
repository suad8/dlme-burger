import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { nextCookies } from 'better-auth/next-js'
import { prisma } from './db'

const secret = process.env.BETTER_AUTH_SECRET

if (!secret) {
  throw new Error('BETTER_AUTH_SECRET غير معرّف. لا يمكن تشغيل المصادقة بدونه.')
}

if (process.env.NODE_ENV === 'production' && secret.startsWith('dev-only')) {
  throw new Error('BETTER_AUTH_SECRET التطويري مستخدم في الإنتاج. أوقف التشغيل.')
}

export const auth = betterAuth({
  secret,
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',

  database: prismaAdapter(prisma, { provider: 'postgresql' }),

  emailAndPassword: {
    enabled: true,
    // الحد الأدنى 12 محرفًا — أقوى من الافتراضي
    minPasswordLength: 12,
    maxPasswordLength: 128,
    autoSignIn: true,
  },

  session: {
    // 7 أيام، تُجدَّد يوميًا عند النشاط
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    additionalFields: {
      activeOrganizationId: { type: 'string', required: false, input: false },
      impersonatedBy: { type: 'string', required: false, input: false },
    },
  },

  user: {
    additionalFields: {
      phone: { type: 'string', required: false },
      locale: { type: 'string', required: false, defaultValue: 'ar' },
      // لا يُقبل من المُدخلات إطلاقًا — يُضبط من قاعدة البيانات فقط
      isSuperAdmin: { type: 'boolean', required: false, input: false },
    },
  },

  advanced: {
    cookiePrefix: 'itqan',
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  },

  plugins: [nextCookies()],
})

export type Auth = typeof auth
