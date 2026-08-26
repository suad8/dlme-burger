import { describe, it, expect } from 'vitest'
import {
  sniffMimeType,
  assertValidFile,
  safeFileName,
  signStorageKey,
  verifySignedKey,
  buildSignedUrl,
  organizationFromKey,
  InvalidFileError,
  MAX_FILE_BYTES,
} from '@/server/storage/provider'

/** بايتات رأس حقيقية لكل نوع مدعوم. */
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
])
const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from('WEBP', 'ascii'),
])
const PDF = Buffer.from('%PDF-1.7 rest of file', 'ascii')

describe('التعرّف على نوع الملف من محتواه', () => {
  it('يتعرّف على الأنواع المدعومة', () => {
    expect(sniffMimeType(JPEG)).toBe('image/jpeg')
    expect(sniffMimeType(PNG)).toBe('image/png')
    expect(sniffMimeType(WEBP)).toBe('image/webp')
    expect(sniffMimeType(PDF)).toBe('application/pdf')
  })

  it('يعيد null لمحتوى غير معروف', () => {
    expect(sniffMimeType(Buffer.from('hello world!!', 'ascii'))).toBeNull()
  })

  it('يعيد null لملف أقصر من رأس معروف', () => {
    expect(sniffMimeType(Buffer.from([0xff, 0xd8]))).toBeNull()
  })
})

describe('التحقق من الملف قبل التخزين', () => {
  it('يقبل ملفًا نوعه يطابق محتواه', () => {
    expect(assertValidFile('image/jpeg', JPEG)).toBe('image/jpeg')
    expect(assertValidFile('application/pdf', PDF)).toBe('application/pdf')
  })

  it('يرفض ملفًا يكذب على نوعه — تنفيذي يتنكّر كصورة', () => {
    const executable = Buffer.from('MZ\x90\x00executable!', 'binary')
    expect(() => assertValidFile('image/jpeg', executable)).toThrow(
      InvalidFileError,
    )
  })

  it('يرفض عدم التطابق بين نوعين مدعومين', () => {
    // PNG حقيقي مُعلَن كـJPEG
    expect(() => assertValidFile('image/jpeg', PNG)).toThrow(InvalidFileError)
  })

  it('يرفض الأنواع غير المسموحة حتى لو كان المحتوى سليمًا', () => {
    expect(() => assertValidFile('image/svg+xml', PNG)).toThrow(InvalidFileError)
    expect(() => assertValidFile('text/html', PNG)).toThrow(InvalidFileError)
  })

  it('يرفض الملف الفارغ', () => {
    expect(() => assertValidFile('image/jpeg', Buffer.alloc(0))).toThrow(
      InvalidFileError,
    )
  })

  it('يرفض ما يتجاوز الحد الأقصى', () => {
    const huge = Buffer.concat([JPEG, Buffer.alloc(MAX_FILE_BYTES)])
    expect(() => assertValidFile('image/jpeg', huge)).toThrow(InvalidFileError)
  })
})

describe('تنظيف اسم الملف', () => {
  it('يمنع اجتياز المسار', () => {
    expect(safeFileName('../../etc/passwd')).not.toContain('..')
    expect(safeFileName('../../etc/passwd')).not.toContain('/')
  })

  it('يحافظ على الأسماء العربية', () => {
    expect(safeFileName('صورة الفرع.jpg')).toBe('صورة_الفرع.jpg')
  })

  it('يقصّ الأسماء الطويلة جدًا', () => {
    expect(safeFileName('a'.repeat(500)).length).toBeLessThanOrEqual(120)
  })

  it('يزيل المحارف الخطرة', () => {
    expect(safeFileName('file<>:"|?*.png')).not.toMatch(/[<>:"|?*]/)
  })
})

describe('الروابط الموقّعة', () => {
  const key = 'org_abc/inspections/file-1.jpg'

  it('التوقيع الصحيح يُقبل', () => {
    const ref = signStorageKey(key, 300)
    expect(verifySignedKey(ref.key, ref.expires, ref.signature)).toBe(true)
  })

  it('توقيع مزوّر يُرفض', () => {
    const ref = signStorageKey(key, 300)
    expect(verifySignedKey(ref.key, ref.expires, 'deadbeef'.repeat(8))).toBe(
      false,
    )
  })

  it('تعديل المفتاح يُبطل التوقيع', () => {
    const ref = signStorageKey(key, 300)
    const otherKey = 'org_xyz/inspections/file-1.jpg'
    expect(verifySignedKey(otherKey, ref.expires, ref.signature)).toBe(false)
  })

  it('إطالة الصلاحية يدويًا تُبطل التوقيع', () => {
    const ref = signStorageKey(key, 300)
    // المهاجم يمدّ expires أملًا في إطالة العمر
    expect(verifySignedKey(ref.key, ref.expires + 100000, ref.signature)).toBe(
      false,
    )
  })

  it('الرابط المنتهي يُرفض حتى بتوقيع صحيح', () => {
    // TTL سالب ⇒ منتهٍ قبل إنشائه
    const ref = signStorageKey(key, -10)
    expect(verifySignedKey(ref.key, ref.expires, ref.signature)).toBe(false)
  })

  it('يرفض expires غير رقمي', () => {
    const ref = signStorageKey(key, 300)
    expect(verifySignedKey(ref.key, Number.NaN, ref.signature)).toBe(false)
  })

  it('الرابط يحمل المفتاح والصلاحية والتوقيع', () => {
    const url = buildSignedUrl(key)
    const params = new URL(url, 'http://x').searchParams
    expect(params.get('key')).toBe(key)
    expect(params.get('sig')).toMatch(/^[0-9a-f]{64}$/)
    expect(Number(params.get('expires'))).toBeGreaterThan(Date.now() / 1000)
  })
})

describe('استخراج المنشأة من المفتاح', () => {
  it('يقرأ الجزء الأول', () => {
    expect(organizationFromKey('org_abc/inspections/f.jpg')).toBe('org_abc')
  })

  it('يعيد null لمفتاح فارغ', () => {
    expect(organizationFromKey('')).toBeNull()
  })

  it('مفتاحان لمنشأتين مختلفتين لا يتطابقان', () => {
    expect(organizationFromKey('org_a/x/f.jpg')).not.toBe(
      organizationFromKey('org_b/x/f.jpg'),
    )
  })
})
