import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHmac } from 'node:crypto'
import { MoyasarProvider } from '@/server/billing/moyasar'
import { priceWithVat, toMinor } from '@/server/billing/provider'

const SECRET = 'sk_test_dummy_key_for_tests'
const WEBHOOK_SECRET = 'whsec_dummy_secret_for_tests'

function sign(payload: string, secret = WEBHOOK_SECRET): string {
  return createHmac('sha256', secret).update(payload, 'utf8').digest('hex')
}

function paidPayload(id = 'inv_123', amount = 34385) {
  return JSON.stringify({
    type: 'invoice_paid',
    data: { id, status: 'paid', amount, currency: 'SAR' },
  })
}

describe('Moyasar — التحقق من توقيع الـwebhook', () => {
  const provider = new MoyasarProvider(SECRET, WEBHOOK_SECRET)

  it('يقبل حمولة موقّعة بشكل صحيح', async () => {
    const payload = paidPayload()
    const event = await provider.verifyWebhook(payload, sign(payload))

    expect(event).not.toBeNull()
    expect(event!.reference).toBe('inv_123')
    expect(event!.status).toBe('SUCCEEDED')
    expect(event!.amount.amountMinor).toBe(34385)
  })

  it('يرفض التوقيع المزوّر — لا دفعة بلا إثبات', async () => {
    const payload = paidPayload()
    const forged = 'a'.repeat(64)
    expect(await provider.verifyWebhook(payload, forged)).toBeNull()
  })

  it('يرفض التوقيع الفارغ', async () => {
    const payload = paidPayload()
    expect(await provider.verifyWebhook(payload, '')).toBeNull()
  })

  it('يرفض توقيعًا صحيحًا لحمولة أخرى — لا يمكن تبديل المبلغ', async () => {
    const original = paidPayload('inv_123', 34385)
    const signature = sign(original)

    // المهاجم يبقي التوقيع ويضاعف المبلغ
    const tampered = paidPayload('inv_123', 3438500)
    expect(await provider.verifyWebhook(tampered, signature)).toBeNull()
  })

  it('يرفض توقيعًا من سرّ مختلف', async () => {
    const payload = paidPayload()
    const wrongSecret = sign(payload, 'whsec_attacker_guess')
    expect(await provider.verifyWebhook(payload, wrongSecret)).toBeNull()
  })

  it('يرفض توقيعًا غير سداسي عشري دون أن يرمي', async () => {
    const payload = paidPayload()
    await expect(
      provider.verifyWebhook(payload, 'ليس توقيعًا'),
    ).resolves.toBeNull()
  })

  it('يرفض حمولة تالفة رغم صحة توقيعها', async () => {
    const broken = '{ not json'
    expect(await provider.verifyWebhook(broken, sign(broken))).toBeNull()
  })

  it('يترجم الفشل والاسترداد', async () => {
    const failed = JSON.stringify({
      data: {
        id: 'inv_9',
        status: 'failed',
        amount: 100,
        source: { message: 'insufficient_funds' },
      },
    })
    const event = await provider.verifyWebhook(failed, sign(failed))
    expect(event!.status).toBe('FAILED')
    expect(event!.failureCode).toBe('insufficient_funds')

    const refunded = JSON.stringify({
      data: { id: 'inv_10', status: 'refunded', amount: 100 },
    })
    const r = await provider.verifyWebhook(refunded, sign(refunded))
    expect(r!.status).toBe('REFUNDED')
  })

  it('يتجاهل الحالات غير النهائية بدل التصرّف بناءً عليها', async () => {
    const initiated = JSON.stringify({
      data: { id: 'inv_11', status: 'initiated', amount: 100 },
    })
    expect(await provider.verifyWebhook(initiated, sign(initiated))).toBeNull()
  })

  it('يرفض حمولة بلا معرّف أو حالة', async () => {
    const noId = JSON.stringify({ data: { status: 'paid', amount: 100 } })
    expect(await provider.verifyWebhook(noId, sign(noId))).toBeNull()

    const noStatus = JSON.stringify({ data: { id: 'inv_12', amount: 100 } })
    expect(await provider.verifyWebhook(noStatus, sign(noStatus))).toBeNull()
  })
})

describe('Moyasar — إنشاء عملية الدفع', () => {
  const provider = new MoyasarProvider(SECRET, WEBHOOK_SECRET)

  const request = {
    organizationId: 'org_1',
    planTier: 'GROWTH',
    cycle: 'MONTHLY' as const,
    amount: { amountMinor: 86135, currency: 'SAR' as const },
    returnUrl: 'https://app.example.sa/settings/billing',
    idempotencyKey: 'key-1',
  }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('يرسل المبلغ والبيانات الوصفية ومفتاح التماثل', async () => {
    // النوع صريح حتى تبقى mock.calls قابلة للفحص
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            id: 'inv_new',
            status: 'initiated',
            amount: 86135,
            currency: 'SAR',
            url: 'https://moyasar.test/pay/inv_new',
          }),
          { status: 200 },
        ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const session = await provider.createCheckout(request)

    expect(session.reference).toBe('inv_new')
    expect(session.redirectUrl).toBe('https://moyasar.test/pay/inv_new')
    expect(session.provider).toBe('moyasar')

    const call = fetchMock.mock.calls[0]
    expect(call).toBeDefined()

    const init = call![1]
    const headers = init.headers as Record<string, string>
    expect(headers['Idempotency-Key']).toBe('key-1')

    const body = JSON.parse(init.body as string) as {
      amount: number
      currency: string
      metadata: { organizationId: string }
    }
    expect(body.amount).toBe(86135)
    expect(body.currency).toBe('SAR')
    expect(body.metadata.organizationId).toBe('org_1')
  })

  it('لا يسرّب المفتاح السري في رسالة الخطأ عند رفض البوابة', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"message":"bad key"}', { status: 401 })),
    )

    await expect(provider.createCheckout(request)).rejects.toThrow()

    try {
      await provider.createCheckout(request)
    } catch (error) {
      expect((error as Error).message).not.toContain(SECRET)
      expect((error as Error).message).not.toContain('sk_test')
    }
  })

  it('لا يسرّب المفتاح عند انقطاع الشبكة', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error(`connect ECONNREFUSED with ${SECRET}`)
      }),
    )

    try {
      await provider.createCheckout(request)
      expect.unreachable('كان يجب أن يرمي')
    } catch (error) {
      expect((error as Error).message).not.toContain(SECRET)
    }
  })
})

describe('تسعير الاشتراك', () => {
  it('باقة النمو الشهرية: ٧٤٩ ر.س + ١٥٪ = ٨٦١٫٣٥', () => {
    const priced = priceWithVat(toMinor(749))
    expect(priced.subtotalMinor).toBe(74900)
    expect(priced.vatMinor).toBe(11235)
    expect(priced.totalMinor).toBe(86135)
  })

  it('الضريبة تُقرَّب إلى أقرب هللة لا تُبتر', () => {
    // 299 × 0.15 = 44.85 بالضبط
    expect(priceWithVat(toMinor(299)).vatMinor).toBe(4485)
    // مبلغ ينتج كسر هللة
    expect(priceWithVat(1).vatMinor).toBe(0)
    expect(priceWithVat(10).vatMinor).toBe(2)
  })

  it('المجموع دائمًا = الأساس + الضريبة بلا انحراف', () => {
    for (const amount of [1, 99, 299, 749, 1899, 18990]) {
      const p = priceWithVat(toMinor(amount))
      expect(p.totalMinor).toBe(p.subtotalMinor + p.vatMinor)
    }
  })
})
