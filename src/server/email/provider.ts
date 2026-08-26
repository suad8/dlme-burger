import 'server-only'
import { createResendProvider } from './resend'

/**
 * طبقة البريد المجرّدة — نفس مبدأ طبقة الفوترة.
 *
 * باقي التطبيق يطلب «أرسل هذه الرسالة» ولا يعرف المزوّد. تبديل Resend بـSES
 * أو بخادم SMTP يجب أن يكون تنفيذًا جديدًا لهذه الواجهة، بلا تعديل في مكان آخر.
 *
 * ⚠️ لا مفاتيح في الكود. غياب متغيّرات البيئة يعني المزوّد الوهمي: يسجّل ولا
 * يرسل، ولا يزعم في أي مكان أن الرسالة وصلت.
 */

export interface EmailMessage {
  to: string
  subject: string
  /** نص عادي — بديل ضروري لعملاء البريد التي لا تعرض HTML. */
  text: string
  html: string
  /** يظهر في «رد على» بدل عنوان الإرسال الآلي. */
  replyTo?: string
}

export interface SendResult {
  /** هل غادرت الرسالة فعلًا إلى مزوّد حقيقي؟ */
  delivered: boolean
  /** معرّف الرسالة لدى المزوّد، للتتبّع. */
  reference: string | null
}

export interface EmailProvider {
  readonly name: string
  readonly isLive: boolean
  send(message: EmailMessage): Promise<SendResult>
}

/**
 * المزوّد الوهمي. يطبع ملخّصًا في السجل ولا يطبع جسم الرسالة: قد يحمل رابط
 * دعوة، والرابط سرّ يمنح وصولًا.
 */
export class NoopEmailProvider implements EmailProvider {
  readonly name = 'noop'
  readonly isLive = false

  async send(message: EmailMessage): Promise<SendResult> {
    console.info(
      `[email:noop] لم تُرسل — لا مزوّد مضبوط. إلى ${maskEmail(message.to)}: ${message.subject}`,
    )
    return { delivered: false, reference: null }
  }
}

/** يُخفي معظم البريد في السجلات: التشخيص لا يحتاج العنوان كاملًا. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@')
  if (at <= 0) return '***'
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  const head = local.slice(0, 2)
  return `${head}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`
}

let cached: EmailProvider | null = null

export function resolveEmailProvider(): EmailProvider {
  if (cached) return cached

  const choice = (process.env.EMAIL_PROVIDER ?? '').trim().toLowerCase()

  if (choice === 'resend') {
    const provider = createResendProvider()
    if (!provider) {
      // نفشل بصوت مسموع بدل الرجوع الصامت إلى الوضع الوهمي: من ضبط
      // EMAIL_PROVIDER يتوقّع إرسالًا حقيقيًا، والصمت هنا يعني دعوات ضائعة.
      throw new Error(
        'EMAIL_PROVIDER=resend لكن RESEND_API_KEY أو EMAIL_FROM ناقص.',
      )
    }
    cached = provider
    return cached
  }

  if (choice && choice !== 'noop') {
    throw new Error(`مزوّد بريد غير معروف: ${choice}`)
  }

  cached = new NoopEmailProvider()
  return cached
}

/** للاختبارات فقط — يُبطل الذاكرة المؤقتة بعد تغيير البيئة. */
export function resetEmailProviderCache(): void {
  cached = null
}
