import { describe, it, expect, vi, afterEach } from 'vitest'
import { S3Storage, S3StorageError, assertSafeKey } from '@/server/storage/s3'
import { InvalidFileError } from '@/server/storage/files'

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const SECRET = 'super-secret-key-that-must-never-leak'

function storage(overrides: Partial<ConstructorParameters<typeof S3Storage>[0]> = {}) {
  return new S3Storage({
    bucket: 'itqan-files',
    region: 'me-south-1',
    accessKeyId: 'AKIAEXAMPLE',
    secretAccessKey: SECRET,
    ...overrides,
  })
}

interface Captured {
  url: string
  init: RequestInit
}

function stubFetch(
  respond: (captured: Captured) => Response,
): { calls: Captured[] } {
  const calls: Captured[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      const captured = { url, init }
      calls.push(captured)
      return respond(captured)
    }),
  )
  return { calls }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('S3 — بناء العنوان', () => {
  it('نمط النطاق الفرعي هو الافتراضي على AWS', async () => {
    const { calls } = stubFetch(() => new Response(null, { status: 200 }))

    await storage().put({
      organizationId: 'org-1',
      scope: 'inspections',
      fileName: 'a.png',
      mimeType: 'image/png',
      data: PNG,
    })

    expect(calls[0]!.url).toMatch(
      /^https:\/\/itqan-files\.s3\.me-south-1\.amazonaws\.com\/org-1\/inspections\/[0-9a-f-]+\.png$/,
    )
  })

  it('نمط المسار حين يُطلب صراحةً', async () => {
    const { calls } = stubFetch(() => new Response(null, { status: 200 }))

    await storage({ forcePathStyle: true }).put({
      organizationId: 'org-1',
      scope: 'inspections',
      fileName: 'a.png',
      mimeType: 'image/png',
      data: PNG,
    })

    expect(calls[0]!.url).toContain('https://s3.me-south-1.amazonaws.com/itqan-files/org-1/')
  })

  it('خدمة متوافقة بعنوان مخصّص تستعمل نمط المسار', async () => {
    const { calls } = stubFetch(() => new Response(null, { status: 200 }))

    await storage({ endpoint: 'https://files.example.sa' }).put({
      organizationId: 'org-9',
      scope: 'candidates',
      fileName: 'cv.png',
      mimeType: 'image/png',
      data: PNG,
    })

    expect(calls[0]!.url).toContain('https://files.example.sa/itqan-files/org-9/candidates/')
  })
})

describe('S3 — التوقيع والترويسات', () => {
  it('كل طلب موقّع، والمفتاح السري لا يظهر في أي ترويسة', async () => {
    const { calls } = stubFetch(() => new Response(null, { status: 200 }))

    await storage().put({
      organizationId: 'org-1',
      scope: 'inspections',
      fileName: 'a.png',
      mimeType: 'image/png',
      data: PNG,
    })

    const headers = calls[0]!.init.headers as Record<string, string>
    expect(headers.authorization).toContain('AWS4-HMAC-SHA256')
    expect(headers.authorization).toContain('AKIAEXAMPLE')
    expect(headers['x-amz-content-sha256']).toMatch(/^[0-9a-f]{64}$/)
    expect(headers['x-amz-date']).toMatch(/^\d{8}T\d{6}Z$/)

    expect(JSON.stringify(headers)).not.toContain(SECRET)
  })

  it('رمز الجلسة المؤقّتة يُرسَل حين يوجد', async () => {
    const { calls } = stubFetch(() => new Response(null, { status: 200 }))

    await storage({ sessionToken: 'temp-token' }).get('org-1/inspections/a.png')

    const headers = calls[0]!.init.headers as Record<string, string>
    expect(headers['x-amz-security-token']).toBe('temp-token')
  })
})

describe('S3 — العمليات', () => {
  it('يعيد بايتات الملف عند القراءة', async () => {
    stubFetch(() => new Response(new Uint8Array(PNG), { status: 200 }))

    const data = await storage().get('org-1/inspections/a.png')
    expect(Buffer.compare(data, PNG)).toBe(0)
  })

  it('الحذف عملية مُتماثلة — الملف المفقود ليس خطأ', async () => {
    stubFetch(() => new Response(null, { status: 404 }))
    await expect(
      storage().remove('org-1/inspections/gone.png'),
    ).resolves.toBeUndefined()
  })

  it('exists يفرّق بين موجود ومفقود بلا رمي', async () => {
    stubFetch(() => new Response(null, { status: 200 }))
    expect(await storage().exists('org-1/a.png')).toBe(true)

    vi.unstubAllGlobals()
    stubFetch(() => new Response(null, { status: 404 }))
    expect(await storage().exists('org-1/a.png')).toBe(false)
  })

  it('خطأ من المخزن يحمل الحالة فقط بلا جسم الرد', async () => {
    stubFetch(
      () =>
        new Response(`<Error><Message>secret ${SECRET}</Message></Error>`, {
          status: 403,
        }),
    )

    try {
      await storage().get('org-1/a.png')
      expect.unreachable('كان يجب أن يرمي')
    } catch (error) {
      expect(error).toBeInstanceOf(S3StorageError)
      expect((error as Error).message).toContain('403')
      expect((error as Error).message).not.toContain(SECRET)
    }
  })

  it('انقطاع الشبكة لا يكشف العنوان ولا الترويسات', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error(`connect ECONNREFUSED authorization=${SECRET}`)
      }),
    )

    try {
      await storage().get('org-1/a.png')
      expect.unreachable('كان يجب أن يرمي')
    } catch (error) {
      expect((error as Error).message).not.toContain(SECRET)
      expect((error as Error).message).toContain('تعذّر الاتصال')
    }
  })
})

describe('S3 — حراسة المفاتيح والمحتوى', () => {
  it('يرفض المفاتيح الخطرة قبل أي طلب شبكة', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    for (const key of ['', '/absolute', 'org-1/../org-2/a.png', 'org-1\\a.png']) {
      await expect(storage().get(key)).rejects.toBeInstanceOf(InvalidFileError)
    }
    expect(assertSafeKey).toBeDefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('يرفض الملف الذي لا يطابق نوعه محتواه قبل الرفع', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      storage().put({
        organizationId: 'org-1',
        scope: 'candidates',
        fileName: 'cv.pdf',
        mimeType: 'application/pdf',
        data: PNG,
      }),
    ).rejects.toBeInstanceOf(InvalidFileError)

    // لا نرفع ثم نتحقق: الفحص يسبق الشبكة
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('المفتاح يبدأ دائمًا بمعرّف المنشأة — أساس فحص العزل عند التقديم', async () => {
    stubFetch(() => new Response(null, { status: 200 }))

    const stored = await storage().put({
      organizationId: 'org-42',
      scope: 'inspections',
      fileName: '../../evil.png',
      mimeType: 'image/png',
      data: PNG,
    })

    expect(stored.storageKey.startsWith('org-42/')).toBe(true)
    // اسم الملف المُعروض يُنظَّف ولا يدخل المفتاح أصلًا
    expect(stored.fileName).not.toContain('/')
    expect(stored.storageKey).not.toContain('..')
  })
})
