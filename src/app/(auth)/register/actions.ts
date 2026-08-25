'use server'

import { headers } from 'next/headers'
import { auth } from '@/server/auth'
import { createOrganizationForUser } from '@/server/services/onboarding'
import { findUserIdByEmail } from '@/server/services/catalog'
import { checkRateLimit, SIGNUP_LIMIT } from '@/server/rate-limit'
import { registerSchema } from '@/lib/validation'

export interface RegisterResult {
  ok: boolean
  message?: string
}

/**
 * التسجيل: إنشاء مستخدم + منشأة + عضوية مالك + اشتراك تجريبي.
 *
 * التحقق يُعاد تشغيله هنا بالكامل — ما يصل من المتصفح لا يُوثق به مهما تحقّق
 * منه العميل.
 */
export async function registerAction(input: unknown): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'البيانات المُدخلة غير صحيحة.',
    }
  }

  const h = await headers()
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    h.get('x-real-ip') ??
    'unknown'

  const limit = checkRateLimit(`signup:${ip}`, SIGNUP_LIMIT)
  if (!limit.allowed) {
    return {
      ok: false,
      message: `محاولات كثيرة. أعد المحاولة بعد ${Math.ceil(limit.retryAfterSeconds / 60)} دقيقة.`,
    }
  }

  const { name, email, password, organizationName } = parsed.data

  try {
    await auth.api.signUpEmail({
      body: { email, password, name },
      headers: h,
    })
  } catch {
    // رسالة موحّدة: لا نكشف ما إذا كان البريد مسجّلًا مسبقًا
    return {
      ok: false,
      message: 'تعذّر إنشاء الحساب. تحقّق من البيانات أو سجّل الدخول.',
    }
  }

  const userId = await findUserIdByEmail(email)

  if (!userId) {
    return { ok: false, message: 'تعذّر إنشاء الحساب. حاول مرة أخرى.' }
  }

  await createOrganizationForUser({ userId, organizationName })

  return { ok: true }
}
