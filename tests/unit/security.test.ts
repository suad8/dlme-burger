import { describe, it, expect, beforeEach } from 'vitest'
import { redact } from '@/server/audit'
import {
  checkRateLimit,
  resetRateLimits,
  LOGIN_LIMIT,
} from '@/server/rate-limit'
import {
  passwordSchema,
  emailSchema,
  saudiPhoneSchema,
  vatNumberSchema,
  uploadSchema,
  MAX_UPLOAD_BYTES,
} from '@/lib/validation'

describe('تنقية سجل التدقيق', () => {
  it('يحجب كلمة المرور والرموز', () => {
    const out = redact({
      email: 'a@b.com',
      password: 'plain-secret',
      accessToken: 'tok_123',
      refreshToken: 'ref_456',
    }) as Record<string, unknown>

    expect(out.email).toBe('a@b.com')
    expect(out.password).toBe('[محجوب]')
    expect(out.accessToken).toBe('[محجوب]')
    expect(out.refreshToken).toBe('[محجوب]')
  })

  it('يحجب داخل الكائنات المتداخلة', () => {
    const out = redact({
      user: { name: 'سعود', credentials: { passwordHash: 'x' } },
    }) as { user: { name: string; credentials: Record<string, unknown> } }

    expect(out.user.name).toBe('سعود')
    expect(out.user.credentials.passwordHash).toBe('[محجوب]')
  })

  it('يحجب رغم اختلاف الشكل الكتابي للمفتاح', () => {
    const out = redact({
      API_KEY: 'k',
      'session-token': 't',
      Secret: 's',
    }) as Record<string, unknown>

    expect(out.API_KEY).toBe('[محجوب]')
    expect(out['session-token']).toBe('[محجوب]')
    expect(out.Secret).toBe('[محجوب]')
  })

  it('يحجب داخل المصفوفات', () => {
    const out = redact([{ password: 'a' }, { password: 'b' }]) as Record<
      string,
      unknown
    >[]
    expect(out[0]!.password).toBe('[محجوب]')
    expect(out[1]!.password).toBe('[محجوب]')
  })

  it('يوقف التعاود عند عمق مفرط فلا يعلّق', () => {
    type Deep = { next?: Deep }
    const deep: Deep = {}
    let node = deep
    for (let i = 0; i < 40; i += 1) {
      node.next = {}
      node = node.next
    }
    expect(() => redact(deep)).not.toThrow()
  })
})

describe('تحديد المعدّل', () => {
  beforeEach(() => {
    resetRateLimits()
  })

  it('يسمح حتى الحد ثم يمنع', () => {
    for (let i = 0; i < LOGIN_LIMIT.limit; i += 1) {
      expect(checkRateLimit('ip:1.1.1.1', LOGIN_LIMIT).allowed).toBe(true)
    }
    const blocked = checkRateLimit('ip:1.1.1.1', LOGIN_LIMIT)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('يعزل المفاتيح عن بعضها', () => {
    for (let i = 0; i < LOGIN_LIMIT.limit; i += 1) {
      checkRateLimit('ip:1.1.1.1', LOGIN_LIMIT)
    }
    expect(checkRateLimit('ip:2.2.2.2', LOGIN_LIMIT).allowed).toBe(true)
  })

  it('يتيح المحاولات مجددًا بعد انتهاء النافذة', () => {
    const tiny = { limit: 1, windowMs: 1 }
    expect(checkRateLimit('k', tiny).allowed).toBe(true)
    // النافذة بمللي ثانية واحدة — انتهت فعليًا
    const later = Date.now() + 5
    while (Date.now() < later) {
      /* انتظار قصير مقصود */
    }
    expect(checkRateLimit('k', tiny).allowed).toBe(true)
  })
})

describe('تحقق المُدخلات', () => {
  it('يرفض كلمات المرور الضعيفة', () => {
    expect(passwordSchema.safeParse('short').success).toBe(false)
    expect(passwordSchema.safeParse('alllowercase123').success).toBe(false)
    expect(passwordSchema.safeParse('ALLUPPERCASE123').success).toBe(false)
    expect(passwordSchema.safeParse('NoDigitsHereAtAll').success).toBe(false)
  })

  it('يقبل كلمة مرور مستوفية', () => {
    expect(passwordSchema.safeParse('Itqan#Demo2026').success).toBe(true)
  })

  it('يوحّد البريد الإلكتروني إلى أحرف صغيرة', () => {
    const parsed = emailSchema.parse('  User@Example.COM ')
    expect(parsed).toBe('user@example.com')
  })

  it('يتحقق من رقم الجوال السعودي', () => {
    expect(saudiPhoneSchema.safeParse('0512345678').success).toBe(true)
    expect(saudiPhoneSchema.safeParse('+966512345678').success).toBe(true)
    expect(saudiPhoneSchema.safeParse('12345').success).toBe(false)
    expect(saudiPhoneSchema.safeParse('0412345678').success).toBe(false)
  })

  it('يتحقق من صيغة الرقم الضريبي السعودي', () => {
    expect(vatNumberSchema.safeParse('310123456789003').success).toBe(true)
    expect(vatNumberSchema.safeParse('123456789012345').success).toBe(false)
    expect(vatNumberSchema.safeParse('31012345678900').success).toBe(false)
  })

  it('يرفض الملفات الكبيرة وغير المدعومة', () => {
    expect(
      uploadSchema.safeParse({
        fileName: 'a.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1000,
      }).success,
    ).toBe(true)

    expect(
      uploadSchema.safeParse({
        fileName: 'a.exe',
        mimeType: 'application/x-msdownload',
        sizeBytes: 1000,
      }).success,
    ).toBe(false)

    expect(
      uploadSchema.safeParse({
        fileName: 'big.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: MAX_UPLOAD_BYTES + 1,
      }).success,
    ).toBe(false)
  })
})
