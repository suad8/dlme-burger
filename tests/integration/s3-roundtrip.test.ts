import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer, type Server } from 'node:http'
import { createHash, createHmac } from 'node:crypto'
import { AddressInfo } from 'node:net'
import { SignatureV4 } from '@smithy/signature-v4'
import { S3Storage } from '@/server/storage/s3'

/**
 * دورة كاملة عبر HTTP حقيقي.
 *
 * الخادم هنا ليس محاكيًا لـS3 فحسب: قبل تنفيذ أي عملية يُعيد حساب التوقيع
 * بتنفيذ AWS الرسمي ويقارنه بما أرسلناه. أي طلب يمرّ هنا هو طلب كان S3
 * ليقبله. هذا يغطّي ما لا يغطّيه اختبار الوحدة: بناء العنوان والطريقة والجسم
 * والترويسات كما تخرج فعلًا على الشبكة.
 */

const BUCKET = 'itqan-test'
const REGION = 'me-south-1'
const ACCESS_KEY = 'AKIAEXAMPLE'
const SECRET_KEY = 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY'

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

class NodeSha256 {
  private readonly hash: ReturnType<typeof createHash> | ReturnType<typeof createHmac>
  constructor(secret?: Uint8Array | string) {
    this.hash =
      secret === undefined
        ? createHash('sha256')
        : createHmac('sha256', Buffer.from(secret as Uint8Array))
  }
  update(data: Uint8Array | string): void {
    this.hash.update(data)
  }
  async digest(): Promise<Uint8Array> {
    return new Uint8Array(this.hash.digest())
  }
}

const objects = new Map<string, Buffer>()
const rejected: string[] = []

let server: Server
let baseUrl: string

async function verifySignature(
  method: string,
  path: string,
  headers: Record<string, string>,
  body: Buffer,
  host: string,
): Promise<boolean> {
  const signer = new SignatureV4({
    credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
    region: REGION,
    service: 's3',
    sha256: NodeSha256 as never,
    uriEscapePath: false,
  })

  // نوقّع بنفس الترويسات المُوقَّعة التي أعلنها الطلب
  const signedNames = (headers.authorization ?? '')
    .split('SignedHeaders=')[1]
    ?.split(',')[0]
    ?.split(';') ?? []

  const toSign: Record<string, string> = {}
  for (const name of signedNames) {
    const value = headers[name]
    if (value !== undefined) toSign[name] = value
  }
  toSign.host = host

  const reference = await signer.sign(
    { method, protocol: 'http:', hostname: host, path, query: {}, headers: toSign, body },
    { signingDate: parseAmzDate(headers['x-amz-date']!) },
  )

  return reference.headers.authorization === headers.authorization
}

function parseAmzDate(value: string): Date {
  // 20260115T102030Z
  const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`
  return new Date(iso)
}

beforeAll(async () => {
  server = createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      void (async () => {
        const body = Buffer.concat(chunks)
        const headers = request.headers as Record<string, string>
        const path = decodeURI(request.url ?? '/')

        const ok = await verifySignature(
          request.method ?? 'GET',
          request.url ?? '/',
          headers,
          body,
          headers.host!,
        )

        if (!ok) {
          rejected.push(`${request.method} ${path}`)
          response.writeHead(403).end('SignatureDoesNotMatch')
          return
        }

        const key = path.replace(`/${BUCKET}/`, '')

        if (request.method === 'PUT') {
          objects.set(key, body)
          response.writeHead(200).end()
          return
        }
        if (request.method === 'GET' || request.method === 'HEAD') {
          const stored = objects.get(key)
          if (!stored) {
            response.writeHead(404).end()
            return
          }
          response.writeHead(200, { 'content-length': String(stored.length) })
          response.end(request.method === 'HEAD' ? undefined : stored)
          return
        }
        if (request.method === 'DELETE') {
          objects.delete(key)
          response.writeHead(204).end()
          return
        }
        response.writeHead(405).end()
      })()
    })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

function storage() {
  return new S3Storage({
    bucket: BUCKET,
    region: REGION,
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
    endpoint: baseUrl,
  })
}

describe('S3 — دورة كاملة مقابل توقيع مُتحقَّق منه', () => {
  it('رفع ثم قراءة ثم فحص ثم حذف', async () => {
    const s3 = storage()

    const stored = await s3.put({
      organizationId: 'org-1',
      scope: 'inspections',
      fileName: 'دليل الزيارة.png',
      mimeType: 'image/png',
      data: PNG,
    })

    expect(stored.storageKey).toMatch(/^org-1\/inspections\/[0-9a-f-]+\.png$/)
    expect(stored.sizeBytes).toBe(PNG.length)

    const fetched = await s3.get(stored.storageKey)
    expect(Buffer.compare(fetched, PNG)).toBe(0)

    expect(await s3.exists(stored.storageKey)).toBe(true)

    await s3.remove(stored.storageKey)
    expect(await s3.exists(stored.storageKey)).toBe(false)

    // حذف ما حُذف: لا يرمي
    await expect(s3.remove(stored.storageKey)).resolves.toBeUndefined()

    expect(rejected, 'رُفض توقيع في الدورة').toEqual([])
  })

  it('اسم ملف عربي فيه فراغات ومحارف خاصة يمرّ بلا كسر التوقيع', async () => {
    const s3 = storage()

    const stored = await s3.put({
      organizationId: 'org-2',
      scope: 'candidates',
      fileName: 'سيرة ذاتية (نسخة نهائية) 2026.png',
      mimeType: 'image/png',
      data: PNG,
    })

    // المفتاح نفسه UUID، لكن الاسم المعروض يُنظَّف ويبقى مقروءًا
    expect(stored.fileName).toContain('سيرة')
    expect(Buffer.compare(await s3.get(stored.storageKey), PNG)).toBe(0)
    expect(rejected).toEqual([])
  })

  it('حمولة كبيرة تصل كاملة', async () => {
    const s3 = storage()
    // PNG صالح متبوع بحشو: التحقق يقرأ البايتات الأولى
    const big = Buffer.concat([PNG, Buffer.alloc(1024 * 256, 3)])

    const stored = await s3.put({
      organizationId: 'org-3',
      scope: 'inspections',
      fileName: 'big.png',
      mimeType: 'image/png',
      data: big,
    })

    const fetched = await s3.get(stored.storageKey)
    expect(fetched.length).toBe(big.length)
    expect(Buffer.compare(fetched, big)).toBe(0)
    expect(rejected).toEqual([])
  })

  it('الخادم يرفض توقيعًا بمفتاح خاطئ — الفحص ليس صوريًا', async () => {
    const before = rejected.length

    const wrong = new S3Storage({
      bucket: BUCKET,
      region: REGION,
      accessKeyId: ACCESS_KEY,
      secretAccessKey: 'not-the-real-secret',
      endpoint: baseUrl,
    })

    await expect(
      wrong.put({
        organizationId: 'org-4',
        scope: 'inspections',
        fileName: 'a.png',
        mimeType: 'image/png',
        data: PNG,
      }),
    ).rejects.toThrow(/403/)

    expect(rejected.length).toBe(before + 1)
    rejected.length = 0
  })

  it('قراءة مفتاح غير موجود ترمي بحالة 404', async () => {
    await expect(storage().get('org-1/inspections/missing.png')).rejects.toThrow(
      /404/,
    )
  })
})
