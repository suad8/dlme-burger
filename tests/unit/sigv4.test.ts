import { describe, it, expect } from 'vitest'
import { createHash, createHmac } from 'node:crypto'
import { SignatureV4 } from '@smithy/signature-v4'
import {
  signRequest,
  deriveSigningKey,
  encodePath,
  sha256Hex,
} from '@/server/storage/sigv4'

/**
 * توقيعنا مقابل توقيع AWS نفسه.
 *
 * SigV4 دقيق ولا يسامح: فاصل واحد في الطلب المعياري يُبطل التوقيع كله. بدل
 * الوثوق بقراءتنا للمواصفة، نشغّل تنفيذ AWS الرسمي (@smithy/signature-v4)
 * كمرجع في الاختبار فقط — لا يدخل حزمة الإنتاج — ونطالب بتطابق التوقيعين.
 */

const ACCESS_KEY = 'AKIAIOSFODNN7EXAMPLE'
const SECRET_KEY = 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY'

/**
 * تجزئة SHA-256 بواجهة يتوقّعها @smithy.
 *
 * ملاحظة مهمة: @smithy يستدعي `new sha256(key)` أيضًا لعمليات HMAC. تجاهل
 * وسيط المُنشئ يحوّل كل HMAC إلى تجزئة عادية فيخرج توقيع مرجعي خاطئ — وهو
 * ما أوقعنا في مطاردة خطأ وهمي في تنفيذنا. المفتاح يُمرَّر إلى createHmac.
 */
class NodeSha256 {
  private readonly hash: import('node:crypto').Hash | import('node:crypto').Hmac

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

function awsSigner(region: string) {
  return new SignatureV4({
    credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
    region,
    service: 's3',
    // النوع في @smithy أوسع مما نحتاج هنا
    sha256: NodeSha256 as never,
    // S3 لا يُرمّز المسار مرتين
    uriEscapePath: false,
  })
}

function signatureOf(authorization: string): string {
  return authorization.split('Signature=')[1] ?? ''
}

interface Case {
  name: string
  method: string
  path: string
  region: string
  payload: Buffer
  contentType?: string
  at: Date
}

const CASES: Case[] = [
  {
    name: 'رفع صورة',
    method: 'PUT',
    path: '/org-1/inspections/abc.png',
    region: 'us-east-1',
    payload: Buffer.from('محتوى اختباري للتوقيع'),
    contentType: 'image/png',
    at: new Date('2026-01-15T10:20:30Z'),
  },
  {
    name: 'قراءة ملف',
    method: 'GET',
    path: '/org-2/candidates/cv.pdf',
    region: 'me-south-1',
    payload: Buffer.alloc(0),
    at: new Date('2026-06-01T00:00:00Z'),
  },
  {
    name: 'حذف ملف',
    method: 'DELETE',
    path: '/org-3/actions/x.webp',
    region: 'eu-central-1',
    payload: Buffer.alloc(0),
    at: new Date('2026-12-31T23:59:59Z'),
  },
  {
    name: 'مسار فيه محارف تحتاج ترميزًا',
    method: 'PUT',
    path: "/org-4/inspections/تقرير (نسخة) 2026.pdf",
    region: 'us-west-2',
    payload: Buffer.from('%PDF-1.4 test'),
    contentType: 'application/pdf',
    at: new Date('2026-03-03T03:03:03Z'),
  },
  {
    name: 'حمولة كبيرة',
    method: 'PUT',
    path: '/org-5/inspections/big.bin',
    region: 'ap-south-1',
    payload: Buffer.alloc(1024 * 512, 7),
    contentType: 'application/octet-stream',
    at: new Date('2026-02-02T12:00:00Z'),
  },
]

describe('SigV4 — تطابق مع تنفيذ AWS الرسمي', () => {
  it.each(CASES)('$name', async (testCase) => {
    const host = 'examplebucket.s3.amazonaws.com'
    const payloadHash = createHash('sha256').update(testCase.payload).digest('hex')

    const headers: Record<string, string> = {
      host,
      'x-amz-content-sha256': payloadHash,
    }
    if (testCase.contentType) headers['content-type'] = testCase.contentType

    const reference = await awsSigner(testCase.region).sign(
      {
        method: testCase.method,
        protocol: 'https:',
        hostname: host,
        // AWS SDK يمرّر مسارًا مُرمَّزًا مسبقًا مع uriEscapePath: false، بينما
        // واجهتنا تستقبل المسار خامًا وترمّزه بنفسها. نوحّدهما هنا.
        path: encodePath(testCase.path),
        query: {},
        headers,
        body: testCase.payload,
      },
      { signingDate: testCase.at },
    )

    const mine = signRequest({
      method: testCase.method,
      path: testCase.path,
      host,
      region: testCase.region,
      service: 's3',
      accessKeyId: ACCESS_KEY,
      secretAccessKey: SECRET_KEY,
      payload: testCase.payload,
      contentType: testCase.contentType,
      now: testCase.at,
    })

    expect(mine.headers['x-amz-date']).toBe(reference.headers['x-amz-date'])
    expect(signatureOf(mine.headers.authorization!)).toBe(
      signatureOf(reference.headers.authorization!),
    )
    expect(mine.headers.authorization).toBe(reference.headers.authorization)
  })
})

describe('SigV4 — الأساسيات', () => {
  it('اشتقاق مفتاح التوقيع يطابق المثال الموثّق من AWS', () => {
    const key = deriveSigningKey(SECRET_KEY, '20150830', 'us-east-1', 'iam')
    expect(key.toString('hex')).toBe(
      'c4afb1cc5771d871763a393e44b703571b55cc28424d1a5e86da6ed3c154a4b9',
    )
  })

  it('يرمّز مقاطع المسار ويبقي الشرطة المائلة', () => {
    expect(encodePath('/a/b c/d')).toBe('/a/b%20c/d')
    expect(encodePath("/a/(b)'c*")).toBe('/a/%28b%29%27c%2A')
    expect(encodePath('/عربي/ملف.pdf')).toContain('%D8')
  })

  it('أي تغيير في الحمولة يغيّر التوقيع', () => {
    const base = {
      method: 'PUT',
      path: '/k',
      host: 'h.example.com',
      region: 'us-east-1',
      service: 's3',
      accessKeyId: ACCESS_KEY,
      secretAccessKey: SECRET_KEY,
      now: new Date('2026-01-01T00:00:00Z'),
    }

    const a = signRequest({ ...base, payload: Buffer.from('one') })
    const b = signRequest({ ...base, payload: Buffer.from('two') })
    expect(a.headers.authorization).not.toBe(b.headers.authorization)
  })

  it('المفتاح السري لا يظهر في أي مخرَج', () => {
    const signed = signRequest({
      method: 'GET',
      path: '/k',
      host: 'h.example.com',
      region: 'us-east-1',
      service: 's3',
      accessKeyId: ACCESS_KEY,
      secretAccessKey: SECRET_KEY,
      payload: Buffer.alloc(0),
    })

    const everything = JSON.stringify(signed)
    expect(everything).not.toContain(SECRET_KEY)
    // معرّف المفتاح ليس سرًّا ويظهر في الترويسة كما تتطلّب المواصفة
    expect(signed.headers.authorization).toContain(ACCESS_KEY)
  })

  it('sha256Hex يطابق التجزئة المعروفة للسلسلة الفارغة', () => {
    expect(sha256Hex(Buffer.alloc(0))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })
})
