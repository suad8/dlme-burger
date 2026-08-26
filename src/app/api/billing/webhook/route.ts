import { NextResponse } from 'next/server'
import { getBillingProvider } from '@/server/billing/provider'
import { applyPaymentEvent } from '@/server/services/billing'

/**
 * webhook بوابة الدفع.
 *
 * ⚠️ هذا المسار **عام بالضرورة** — البوابة تناديه بلا جلسة. لذلك التوقيع هو
 * الضابط الوحيد، ولا يُقرأ أي حقل من الحمولة قبل التحقق منه.
 *
 * نقرأ الجسم كنص خام لا كـJSON: التوقيع محسوب على البايتات الأصلية، وأي
 * إعادة ترتيب أثناء التحليل تكسر المطابقة.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let provider
  try {
    provider = getBillingProvider()
  } catch (error) {
    console.error('[billing:webhook] مزوّد غير مهيّأ:', error)
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }

  if (!provider.isLive) {
    // الوضع الوهمي لا يستقبل webhooks — رفض صريح بدل قبول صامت
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }

  const signature =
    request.headers.get('x-moyasar-signature') ??
    request.headers.get('x-signature') ??
    ''

  const payload = await request.text()

  const event = await provider.verifyWebhook(payload, signature)
  if (!event) {
    // توقيع فاشل أو حدث غير نهائي — لا نفرّق في الرد حتى لا نكشف السبب
    return NextResponse.json({ error: 'rejected' }, { status: 400 })
  }

  try {
    const result = await applyPaymentEvent(event)

    // 200 دائمًا بعد قبول التوقيع: الحدث المكرر ليس فشلًا، وإعادة المحاولة
    // من البوابة على شيء عالجناه فعلًا تضخّم السجلات بلا فائدة.
    return NextResponse.json({
      received: true,
      applied: result.applied,
    })
  } catch (error) {
    console.error('[billing:webhook] فشل تطبيق الحدث:', error)
    // 500 يجعل البوابة تعيد المحاولة — وهو المطلوب عند خطأ عابر عندنا
    return NextResponse.json({ error: 'processing failed' }, { status: 500 })
  }
}
