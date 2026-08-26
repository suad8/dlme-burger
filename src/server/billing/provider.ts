import 'server-only'
import { createMoyasarProvider } from './moyasar'

/**
 * طبقة الفوترة المجرّدة.
 *
 * الهدف: ألا يعرف باقي التطبيق أي مزوّد دفع نستخدم. تبديل Moyasar بـStripe
 * يجب أن يكون تنفيذًا جديدًا لهذه الواجهة فقط، بلا تعديل في الوحدات الأخرى.
 *
 * ⚠️ لا مفاتيح في الكود. المزوّد يُختار من متغيّرات البيئة، وغيابها يعني
 * المزوّد الوهمي الذي يسجّل النية ولا يحرّك أموالًا.
 */

export interface Money {
  /** بأصغر وحدة (هللات) لتفادي أخطاء الفاصلة العائمة. */
  amountMinor: number
  currency: 'SAR'
}

export interface CheckoutRequest {
  organizationId: string
  planTier: string
  cycle: 'MONTHLY' | 'YEARLY'
  amount: Money
  /** يعود إليه المستخدم بعد إتمام الدفع أو إلغائه. */
  returnUrl: string
  /** يُمرَّر للمزوّد ويعود في الـwebhook للربط. */
  idempotencyKey: string
}

export interface CheckoutSession {
  /** معرّف الجلسة لدى المزوّد — يُخزَّن في providerRef. */
  reference: string
  /** الرابط الذي يُوجَّه إليه المستخدم. null للمزوّد الوهمي. */
  redirectUrl: string | null
  provider: string
}

export interface PaymentEvent {
  reference: string
  status: 'SUCCEEDED' | 'FAILED' | 'REFUNDED'
  amount: Money
  failureCode?: string
  occurredAt: Date
}

export interface BillingProvider {
  readonly name: string
  /** هل المزوّد جاهز فعلًا للتحصيل؟ */
  readonly isLive: boolean

  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>

  /**
   * يتحقق من توقيع الـwebhook قبل الوثوق بمحتواه.
   * webhook بلا تحقق توقيع = باب مفتوح لتزوير حالة الدفع.
   */
  verifyWebhook(payload: string, signature: string): Promise<PaymentEvent | null>
}

/**
 * مزوّد وهمي للتطوير والاختبار.
 *
 * لا يتصل بشبكة ولا يحصّل أموالًا. يجعل مسار الترقية قابلًا للتشغيل من طرفه
 * إلى طرفه محليًا دون حساب تاجر، ويرفض التظاهر بأنه حقيقي.
 */
class NoopBillingProvider implements BillingProvider {
  readonly name = 'noop'
  readonly isLive = false

  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    console.info(
      `[billing:noop] طلب اشتراك — المنشأة ${request.organizationId}، ` +
        `الباقة ${request.planTier}، المبلغ ${request.amount.amountMinor / 100} ر.س. ` +
        'لم يُحصَّل شيء: لا مزوّد دفع مضبوط.',
    )
    return {
      reference: `noop_${request.idempotencyKey}`,
      redirectUrl: null,
      provider: this.name,
    }
  }

  async verifyWebhook(): Promise<PaymentEvent | null> {
    // لا webhooks بلا مزوّد — رفض صريح بدل قبول صامت
    return null
  }
}

/**
 * يختار المزوّد من البيئة.
 *
 * إضافة Moyasar أو Stripe لاحقًا: نفّذ `BillingProvider` وأضف الفرع هنا. لا
 * شيء آخر في التطبيق يحتاج تعديلًا.
 */
export function getBillingProvider(): BillingProvider {
  const configured = process.env.BILLING_PROVIDER?.toLowerCase()

  switch (configured) {
    case 'moyasar':
      // الاستيراد كسول: لا نحمّل التكامل ولا نطالب بمفاتيحه إلا عند تفعيله
      return createMoyasarProvider()
    case 'stripe':
      throw new Error(
        'مزوّد الدفع «stripe» مُعلن في البيئة لكنه غير منفّذ. ' +
          'استخدم moyasar، أو أزل BILLING_PROVIDER للعودة إلى الوضع الوهمي.',
      )
    default:
      return new NoopBillingProvider()
  }
}

/** ضريبة القيمة المضافة السعودية. */
export const VAT_RATE = 0.15

export interface PricedTotal {
  subtotalMinor: number
  vatMinor: number
  totalMinor: number
}

/**
 * يحسب الإجمالي شاملًا الضريبة بأصغر وحدة.
 * الحساب بالأعداد الصحيحة حصريًا — لا `0.1 + 0.2` في المال.
 */
export function priceWithVat(subtotalMinor: number): PricedTotal {
  const vatMinor = Math.round(subtotalMinor * VAT_RATE)
  return {
    subtotalMinor,
    vatMinor,
    totalMinor: subtotalMinor + vatMinor,
  }
}

export function toMinor(amount: number): number {
  return Math.round(amount * 100)
}

export function fromMinor(minor: number): number {
  return minor / 100
}
