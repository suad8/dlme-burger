import 'server-only'
import type { EmailMessage, EmailProvider, SendResult } from './provider'
import { maskEmail } from './provider'

/**
 * تنفيذ Resend عبر واجهته المباشرة — بلا حزمة إضافية. الاعتماد الوحيد fetch.
 *
 * البيئة:
 *   EMAIL_PROVIDER=resend
 *   RESEND_API_KEY=re_...      سرّ خادم بحت
 *   EMAIL_FROM="إتقان <no-reply@example.sa>"
 *   EMAIL_REPLY_TO=support@example.sa   اختياري
 */

const ENDPOINT = 'https://api.resend.com/emails'
const TIMEOUT_MS = 10_000

export class ResendProvider implements EmailProvider {
  readonly name = 'resend'
  readonly isLive = true

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly defaultReplyTo?: string,
  ) {}

  async send(message: EmailMessage): Promise<SendResult> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
          reply_to: message.replyTo ?? this.defaultReplyTo,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        // الحالة فقط. جسم الرد قد يعيد ترويسة الطلب وفيها المفتاح.
        throw new Error(`رفض مزوّد البريد الطلب (HTTP ${response.status}).`)
      }

      const data = (await response.json()) as { id?: string }
      return { delivered: true, reference: data.id ?? null }
    } catch (error) {
      // نعيد صياغة الخطأ: رسالة fetch الأصلية قد تحمل الترويسات أو الرابط كاملًا
      const reason =
        error instanceof Error && error.name === 'AbortError'
          ? 'انتهت مهلة الاتصال بمزوّد البريد.'
          : error instanceof Error &&
              error.message.startsWith('رفض مزوّد البريد')
            ? error.message
            : 'تعذّر الاتصال بمزوّد البريد.'

      console.error(`[email:resend] ${reason} إلى ${maskEmail(message.to)}`)
      throw new Error(reason)
    } finally {
      clearTimeout(timer)
    }
  }
}

export function createResendProvider(): ResendProvider | null {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!apiKey || !from) return null

  return new ResendProvider(apiKey, from, process.env.EMAIL_REPLY_TO)
}
