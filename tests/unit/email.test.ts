import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  NoopEmailProvider,
  maskEmail,
  resolveEmailProvider,
  resetEmailProviderCache,
} from '@/server/email/provider'
import { ResendProvider } from '@/server/email/resend'
import { escapeHtml, invitationEmail, notificationEmail } from '@/server/email/templates'

const KEY = 're_test_key_do_not_use'

describe('طبقة البريد — اختيار المزوّد', () => {
  beforeEach(() => {
    resetEmailProviderCache()
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    resetEmailProviderCache()
    vi.unstubAllEnvs()
  })

  it('بلا إعداد: مزوّد وهمي لا يزعم إرسالًا', async () => {
    const provider = resolveEmailProvider()
    expect(provider.isLive).toBe(false)

    const result = await provider.send({
      to: 'a@b.sa',
      subject: 's',
      text: 't',
      html: '<p>t</p>',
    })
    expect(result.delivered).toBe(false)
  })

  it('EMAIL_PROVIDER=resend بلا مفاتيح يفشل بصوت مسموع لا بصمت', () => {
    vi.stubEnv('EMAIL_PROVIDER', 'resend')
    vi.stubEnv('RESEND_API_KEY', '')
    expect(() => resolveEmailProvider()).toThrow(/RESEND_API_KEY/)
  })

  it('مزوّد غير معروف يُرفض بدل الرجوع الصامت', () => {
    vi.stubEnv('EMAIL_PROVIDER', 'sendgrid')
    expect(() => resolveEmailProvider()).toThrow(/غير معروف/)
  })

  it('يُخفي العنوان في السجلات', () => {
    expect(maskEmail('someone@example.sa')).toBe('so*****@example.sa')
    expect(maskEmail('not-an-email')).toBe('***')
  })

  it('المزوّد الوهمي لا يطبع جسم الرسالة — قد يحمل رابط دعوة', async () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    await new NoopEmailProvider().send({
      to: 'x@y.sa',
      subject: 'دعوة',
      text: 'https://app.sa/invite/SECRET-TOKEN',
      html: '<a href="https://app.sa/invite/SECRET-TOKEN">قبول</a>',
    })

    const logged = spy.mock.calls.flat().join(' ')
    expect(logged).not.toContain('SECRET-TOKEN')
    spy.mockRestore()
  })
})

describe('Resend — لا تسريب للمفتاح', () => {
  const provider = new ResendProvider(KEY, 'إتقان <no-reply@test.sa>')
  const message = {
    to: 'x@y.sa',
    subject: 's',
    text: 't',
    html: '<p>t</p>',
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('يرسل المفتاح في الترويسة لا في الجسم', async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
      async () => new Response(JSON.stringify({ id: 'msg_1' }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await provider.send(message)
    expect(result.delivered).toBe(true)
    expect(result.reference).toBe('msg_1')

    const init = fetchMock.mock.calls[0]![1]
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer ${KEY}`)
    expect(init.body as string).not.toContain(KEY)
  })

  it('رفض المزوّد لا يكشف المفتاح', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"message":"invalid key ' + KEY + '"}', { status: 401 })),
    )
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(provider.send(message)).rejects.toThrow()

    try {
      await provider.send(message)
    } catch (error) {
      expect((error as Error).message).not.toContain(KEY)
    }

    expect(errorSpy.mock.calls.flat().join(' ')).not.toContain(KEY)
    errorSpy.mockRestore()
  })

  it('انقطاع الشبكة لا يكشف المفتاح', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error(`ECONNREFUSED bearer ${KEY}`)
      }),
    )
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      await provider.send(message)
      expect.unreachable('كان يجب أن يرمي')
    } catch (error) {
      expect((error as Error).message).not.toContain(KEY)
    }
    errorSpy.mockRestore()
  })
})

describe('قوالب البريد — تهريب HTML', () => {
  it('يهرّب المحارف الخطرة', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    )
    expect(escapeHtml('a & b')).toBe('a &amp; b')
    expect(escapeHtml('"x"')).toBe('&quot;x&quot;')
  })

  it('اسم منشأة خبيث لا يصل إلى صندوق المدعو كعنصر حيّ', () => {
    const message = invitationEmail({
      to: 'x@y.sa',
      organizationName: '<img src=x onerror=alert(1)>',
      inviterName: 'مالك',
      roleLabel: 'مُطّلع',
      acceptUrl: 'https://app.sa/invite/tok',
      expiresAt: new Date('2026-01-01T00:00:00Z'),
    })

    expect(message.html).not.toContain('<img src=x')
    expect(message.html).toContain('&lt;img src=x')
    // النص العادي ليس HTML فيبقى كما هو — لا يُصيَّر
    expect(message.text).toContain('<img src=x')
  })

  it('كل رسالة تحمل نصًا عاديًا وHTML معًا', () => {
    const message = notificationEmail({
      to: 'x@y.sa',
      title: 'مهمة متأخرة',
      body: 'تجاوزت المهمة موعدها.',
      linkUrl: 'https://app.sa/actions',
    })

    expect(message.text.length).toBeGreaterThan(0)
    expect(message.html).toContain('<!doctype html>')
    expect(message.html).toContain('dir="rtl"')
    expect(message.html).toContain('https://app.sa/actions')
  })
})
