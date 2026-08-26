import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type {
  BillingProvider,
  CheckoutRequest,
  CheckoutSession,
  PaymentEvent,
} from './provider'

/**
 * تكامل Moyasar — بوابة الدفع السعودية.
 *
 * اختيرت على Stripe لأنها تدعم مدى وApple Pay محليًا وتصدر فواتير بالريال
 * مباشرة، وهو ما يحتاجه عملاء المنصة فعليًا.
 *
 * ⚠️ المفاتيح من البيئة حصريًا. المفتاح السري لا يُرسل للمتصفح ولا يُسجَّل ولا
 * يظهر في أي رسالة خطأ — حتى عند فشل الطلب.
 *
 * التفعيل:
 *   BILLING_PROVIDER=moyasar
 *   MOYASAR_SECRET_KEY=sk_...
 *   MOYASAR_WEBHOOK_SECRET=...
 */

const API_BASE = 'https://api.moyasar.com/v1'

/** الحقول التي نقرأها من رد Moyasar. ما عداها يُتجاهل. */
interface MoyasarInvoice {
  id: string
  status: string
  amount: number
  currency: string
  url?: string
}

interface MoyasarWebhookPayload {
  type?: string
  data?: {
    id?: string
    status?: string
    amount?: number
    currency?: string
    source?: { message?: string }
  }
}

/** حالات Moyasar المقابلة لحالاتنا. أي حالة أخرى تعني «لم يُحسم بعد». */
const STATUS_MAP: Record<string, PaymentEvent['status']> = {
  paid: 'SUCCEEDED',
  failed: 'FAILED',
  refunded: 'REFUNDED',
  voided: 'FAILED',
}

export class MoyasarProvider implements BillingProvider {
  readonly name = 'moyasar'
  readonly isLive = true

  constructor(
    private readonly secretKey: string,
    private readonly webhookSecret: string,
  ) {}

  private authHeader(): string {
    // Moyasar يستخدم Basic بالمفتاح السري كاسم مستخدم وكلمة مرور فارغة
    return 'Basic ' + Buffer.from(`${this.secretKey}:`).toString('base64')
  }

  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    const body = {
      amount: request.amount.amountMinor,
      currency: request.amount.currency,
      description: `اشتراك إتقان — ${request.planTier} (${
        request.cycle === 'YEARLY' ? 'سنوي' : 'شهري'
      })`,
      callback_url: request.returnUrl,
      // يعود إلينا في الـwebhook فنربط الدفعة بالمنشأة الصحيحة
      metadata: {
        organizationId: request.organizationId,
        planTier: request.planTier,
        cycle: request.cycle,
        idempotencyKey: request.idempotencyKey,
      },
    }

    let response: Response
    try {
      response = await fetch(`${API_BASE}/invoices`, {
        method: 'POST',
        headers: {
          Authorization: this.authHeader(),
          'Content-Type': 'application/json',
          // يمنع ازدواج الفاتورة إن أُعيد الطلب بعد انقطاع الشبكة
          'Idempotency-Key': request.idempotencyKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      })
    } catch (error) {
      // لا نُمرّر تفاصيل الشبكة للمستخدم — قد تحمل ترويسات أو مسارات
      console.error('[moyasar] فشل الاتصال بالبوابة:', error)
      throw new Error('تعذّر الاتصال ببوابة الدفع. حاول بعد قليل.')
    }

    if (!response.ok) {
      // نسجّل رمز الحالة فقط — جسم الرد قد يعكس المفتاح في بعض الأخطاء
      console.error(`[moyasar] رفضت البوابة الطلب — HTTP ${response.status}`)
      throw new Error('تعذّر إنشاء عملية الدفع. راجع بيانات الاشتراك.')
    }

    const invoice = (await response.json()) as MoyasarInvoice

    return {
      reference: invoice.id,
      redirectUrl: invoice.url ?? null,
      provider: this.name,
    }
  }

  /**
   * يتحقق من توقيع الـwebhook ثم يترجم الحمولة.
   *
   * ⚠️ webhook بلا تحقق توقيع = باب مفتوح: أي جهة تعرف العنوان تستطيع إعلان
   * دفعة ناجحة. التحقق يسبق أي قراءة للمحتوى.
   */
  async verifyWebhook(
    payload: string,
    signature: string,
  ): Promise<PaymentEvent | null> {
    if (!this.verifySignature(payload, signature)) return null

    let parsed: MoyasarWebhookPayload
    try {
      parsed = JSON.parse(payload) as MoyasarWebhookPayload
    } catch {
      return null
    }

    const data = parsed.data
    if (!data?.id || !data.status) return null

    const status = STATUS_MAP[data.status]
    // حالة غير نهائية (initiated مثلًا) — لا نتصرّف بناءً عليها
    if (!status) return null

    return {
      reference: data.id,
      status,
      amount: {
        amountMinor: data.amount ?? 0,
        currency: 'SAR',
      },
      failureCode: status === 'FAILED' ? data.source?.message : undefined,
      occurredAt: new Date(),
    }
  }

  /** مقارنة ثابتة الزمن — المقارنة العادية تسرّب التوقيع عبر التوقيت. */
  private verifySignature(payload: string, signature: string): boolean {
    if (!signature) return false

    const expected = createHmac('sha256', this.webhookSecret)
      .update(payload, 'utf8')
      .digest('hex')

    const a = Buffer.from(expected, 'hex')
    let b: Buffer
    try {
      b = Buffer.from(signature, 'hex')
    } catch {
      return false
    }

    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  }
}

/**
 * ينشئ المزوّد من البيئة، أو يرمي برسالة تشرح الناقص.
 * الرمي أفضل من العودة صامتًا إلى الوضع الوهمي: منشأة تظن أنها تحصّل ولا
 * تحصّل مشكلة أسوأ من إيقاف الإقلاع.
 */
export function createMoyasarProvider(): MoyasarProvider {
  const secretKey = process.env.MOYASAR_SECRET_KEY
  const webhookSecret = process.env.MOYASAR_WEBHOOK_SECRET

  const missing: string[] = []
  if (!secretKey) missing.push('MOYASAR_SECRET_KEY')
  if (!webhookSecret) missing.push('MOYASAR_WEBHOOK_SECRET')

  if (missing.length > 0) {
    throw new Error(
      `BILLING_PROVIDER=moyasar لكن المتغيّرات التالية مفقودة: ${missing.join('، ')}.`,
    )
  }

  if (
    process.env.NODE_ENV === 'production' &&
    secretKey!.startsWith('sk_test')
  ) {
    throw new Error(
      'مفتاح Moyasar التجريبي مستخدم في الإنتاج. استبدله بمفتاح الإنتاج.',
    )
  }

  return new MoyasarProvider(secretKey!, webhookSecret!)
}
