import 'server-only'
import { createHash, createHmac } from 'node:crypto'

/**
 * توقيع AWS Signature Version 4.
 *
 * منفّذ يدويًا بـ`node:crypto` بدل حزمة AWS: الحزمة الرسمية تجرّ عشرات
 * الاعتماديات لأجل أربع عمليات فقط (رفع، قراءة، حذف، وجود)، وهذا يزيد سطح
 * الهجوم وحجم حزمة الخادم بلا مقابل. نفس النهج المتّبع مع بوابة الدفع والبريد.
 *
 * ⚠️ المفتاح السري لا يُسجَّل ولا يظهر في أي رسالة خطأ.
 */

const ALGORITHM = 'AWS4-HMAC-SHA256'

export interface SigningInput {
  method: string
  /** مسار الطلب مبدوءًا بـ`/` وغير مُرمَّز. */
  path: string
  /** استعلام مُرتَّب مسبقًا أو فارغ. */
  query?: string
  host: string
  region: string
  service: string
  accessKeyId: string
  secretAccessKey: string
  /** رمز جلسة مؤقّتة إن وُجد. */
  sessionToken?: string
  payload: Buffer
  contentType?: string
  /** ترويسات إضافية تدخل التوقيع (مثل Range). أسماؤها تُصغَّر تلقائيًا. */
  extraHeaders?: Record<string, string>
  /** يُمرَّر في الاختبارات لتثبيت الوقت. */
  now?: Date
}

export interface SignedRequest {
  headers: Record<string, string>
  /** يُعاد للاختبار والتشخيص، وليس فيه أي سرّ. */
  canonicalRequest: string
  stringToSign: string
}

export function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex')
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest()
}

/**
 * اشتقاق مفتاح التوقيع: سلسلة HMAC على التاريخ ثم المنطقة ثم الخدمة.
 * كل خطوة تقيّد المفتاح أكثر، فتسريب توقيع ليوم لا يفيد ليوم آخر.
 */
export function deriveSigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Buffer {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp)
  const kRegion = hmac(kDate, region)
  const kService = hmac(kRegion, service)
  return hmac(kService, 'aws4_request')
}

/**
 * ترميز مقاطع المسار كما يتوقّعه S3: كل مقطع يُرمَّز، والشرطة المائلة تبقى.
 * `encodeURIComponent` لا يُرمّز `!'()*` وS3 يتوقّع ترميزها.
 */
export function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) =>
      encodeURIComponent(segment).replace(
        /[!'()*]/g,
        (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
      ),
    )
    .join('/')
}

export function signRequest(input: SigningInput): SignedRequest {
  const now = input.now ?? new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)

  const payloadHash = sha256Hex(input.payload)

  // الترويسات المُوقَّعة مرتّبة أبجديًا بأسماء صغيرة — شرط في المواصفة
  const headers: Record<string, string> = {
    host: input.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  }
  if (input.contentType) headers['content-type'] = input.contentType
  if (input.sessionToken) headers['x-amz-security-token'] = input.sessionToken
  for (const [name, value] of Object.entries(input.extraHeaders ?? {})) {
    headers[name.toLowerCase()] = value
  }

  const sortedNames = Object.keys(headers).sort()
  const canonicalHeaders = sortedNames
    .map((name) => `${name}:${headers[name]!.trim()}\n`)
    .join('')
  const signedHeaders = sortedNames.join(';')

  const canonicalRequest = [
    input.method.toUpperCase(),
    encodePath(input.path),
    input.query ?? '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const scope = `${dateStamp}/${input.region}/${input.service}/aws4_request`
  const stringToSign = [
    ALGORITHM,
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n')

  const signingKey = deriveSigningKey(
    input.secretAccessKey,
    dateStamp,
    input.region,
    input.service,
  )
  const signature = createHmac('sha256', signingKey)
    .update(stringToSign, 'utf8')
    .digest('hex')

  headers.authorization =
    `${ALGORITHM} Credential=${input.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`

  return { headers, canonicalRequest, stringToSign }
}
