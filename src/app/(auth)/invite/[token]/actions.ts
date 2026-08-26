'use server'

import { headers } from 'next/headers'
import { auth } from '@/server/auth'
import { getSession } from '@/server/tenant'
import { findUserIdByEmail } from '@/server/services/catalog'
import {
  acceptInvitation,
  readInvitation,
  InvalidInvitationError,
} from '@/server/services/invitations'
import { checkRateLimit, SIGNUP_LIMIT } from '@/server/rate-limit'
import { recordAudit } from '@/server/audit'
import { passwordSchema } from '@/lib/validation'

export interface AcceptResult {
  ok: boolean
  message?: string
}

/**
 * قبول الدعوة.
 *
 * الرمز هو الإثبات الوحيد هنا لأن الصفحة عامة. لذلك:
 * — يُحدّ معدّل المحاولات بعنوان الشبكة، فلا يُخمَّن رمز بالتكرار.
 * — البريد يُؤخذ من الدعوة نفسها لا من النموذج، فلا يُنشأ حساب لبريد آخر.
 * — الدور والفروع من الدعوة أيضًا، فلا يرفع المدعو نفسه.
 */
export async function acceptInviteAction(
  token: string,
  newAccount?: { name: string; password: string },
): Promise<AcceptResult> {
  if (typeof token !== 'string' || token.length < 20) {
    return { ok: false, message: 'رابط الدعوة غير صالح.' }
  }

  const h = await headers()
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    h.get('x-real-ip') ??
    'unknown'

  const limit = checkRateLimit(`invite-accept:${ip}`, SIGNUP_LIMIT)
  if (!limit.allowed) {
    return {
      ok: false,
      message: `محاولات كثيرة. أعد المحاولة بعد ${Math.ceil(limit.retryAfterSeconds / 60)} دقيقة.`,
    }
  }

  const invitation = await readInvitation(token)
  if (!invitation) {
    return { ok: false, message: 'الدعوة غير صالحة أو انتهت صلاحيتها.' }
  }

  const session = await getSession()
  let userId = session?.user?.id ?? null

  if (!userId) {
    if (!newAccount) {
      return { ok: false, message: 'سجّل الدخول أولًا أو أنشئ حسابًا.' }
    }

    const name = newAccount.name.trim()
    if (name.length < 2) {
      return { ok: false, message: 'أدخل اسمك الكامل.' }
    }

    const password = passwordSchema.safeParse(newAccount.password)
    if (!password.success) {
      return {
        ok: false,
        message: password.error.issues[0]?.message ?? 'كلمة المرور ضعيفة.',
      }
    }

    try {
      await auth.api.signUpEmail({
        // البريد من الدعوة لا من النموذج
        body: { email: invitation.email, password: password.data, name },
        headers: h,
      })
    } catch {
      return {
        ok: false,
        message: 'تعذّر إنشاء الحساب. إن كان لديك حساب بهذا البريد فسجّل الدخول.',
      }
    }

    const created = await findUserIdByEmail(invitation.email)
    if (!created) {
      return { ok: false, message: 'تعذّر إنشاء الحساب. حاول مرة أخرى.' }
    }
    userId = created
  }

  try {
    // الجلسة تُقرأ بعد التسجيل لأن حساب المدعو الجديد أنشأ جلسة للتو
    const fresh = await getSession()
    const sessionId = (fresh?.session as { id?: string } | undefined)?.id

    const { organizationId } = await acceptInvitation(token, userId, sessionId)

    await recordAudit({
      organizationId,
      actorId: userId,
      action: 'invitation.accept',
      entityType: 'Invitation',
      after: { email: invitation.email },
    })

    return { ok: true }
  } catch (error) {
    if (error instanceof InvalidInvitationError) {
      return { ok: false, message: error.message }
    }
    return { ok: false, message: 'تعذّر قبول الدعوة.' }
  }
}
