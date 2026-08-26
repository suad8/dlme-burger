import 'server-only'
import { randomUUID } from 'node:crypto'
import { signRequest, encodePath } from './sigv4'
import {
  assertValidFile,
  safeFileName,
  InvalidFileError,
  EXTENSION,
  type PutInput,
  type StorageProvider,
  type StoredFile,
} from './files'

/**
 * تخزين على S3 (وأي خدمة متوافقة: R2 وMinIO وغيرها).
 *
 * الطلبات موقّعة بـSigV4 عبر `sigv4.ts`، بلا حزمة AWS: أربع عمليات فقط
 * (رفع، قراءة، حذف، وجود)، والتوقيع مُتحقَّق منه باختبار يقارنه بتنفيذ AWS
 * الرسمي.
 *
 * ملاحظة مهمة: لا نصدر روابط S3 موقّعة للمتصفح إطلاقًا. كل قراءة تمرّ بـ
 * `/api/files` حيث نتحقق من الجلسة ومن أن المفتاح يخص منشأة الطالب. رابط S3
 * مباشر يتجاوز هذا الفحص، ومن يحصل عليه يقرأ الملف بلا جلسة.
 */

const TIMEOUT_MS = 20_000


export interface S3Config {
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
  /** لخدمة متوافقة غير AWS. بلا قيمة نستعمل نطاق AWS القياسي. */
  endpoint?: string
  /** MinIO وبعض المتوافقين يحتاجون نمط المسار بدل النطاق الفرعي. */
  forcePathStyle?: boolean
}

export class S3StorageError extends Error {
  override readonly name = 'S3StorageError'
  constructor(
    operation: string,
    readonly status: number,
  ) {
    // الحالة فقط. جسم رد S3 قد يعيد ترويسات الطلب وفيها التوقيع.
    super(`فشلت عملية «${operation}» على مخزن الملفات (HTTP ${status}).`)
  }
}

export class S3Storage implements StorageProvider {
  readonly name = 's3'

  constructor(private readonly config: S3Config) {}

  /** يبني العنوان والمضيف حسب النمط المختار. */
  private target(storageKey: string): { url: string; host: string; path: string } {
    const { bucket, region, endpoint, forcePathStyle } = this.config

    const base = endpoint
      ? new URL(endpoint)
      : new URL(
          forcePathStyle
            ? `https://s3.${region}.amazonaws.com`
            : `https://${bucket}.s3.${region}.amazonaws.com`,
        )

    const usePathStyle = forcePathStyle || Boolean(endpoint)
    const path = usePathStyle ? `/${bucket}/${storageKey}` : `/${storageKey}`

    return {
      url: `${base.origin}${encodePath(path)}`,
      host: base.host,
      path,
    }
  }

  private async send(
    operation: string,
    method: string,
    storageKey: string,
    payload: Buffer,
    contentType?: string,
  ): Promise<Response> {
    const { url, host, path } = this.target(storageKey)

    const { headers } = signRequest({
      method,
      path,
      host,
      region: this.config.region,
      service: 's3',
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      sessionToken: this.config.sessionToken,
      payload,
      contentType,
    })

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      return await fetch(url, {
        method,
        headers,
        body: method === 'PUT' ? new Uint8Array(payload) : undefined,
        signal: controller.signal,
      })
    } catch (error) {
      // نعيد الصياغة: رسالة fetch قد تحمل العنوان كاملًا بترويساته
      const reason =
        error instanceof Error && error.name === 'AbortError'
          ? 'انتهت مهلة الاتصال بمخزن الملفات.'
          : 'تعذّر الاتصال بمخزن الملفات.'
      throw new Error(`${reason} (${operation})`)
    } finally {
      clearTimeout(timer)
    }
  }

  async put(input: PutInput): Promise<StoredFile> {
    const verified = assertValidFile(input.mimeType, input.data)
    const ext = EXTENSION[verified] ?? 'bin'
    const storageKey = `${input.organizationId}/${input.scope}/${randomUUID()}.${ext}`

    const response = await this.send('رفع', 'PUT', storageKey, input.data, verified)
    if (!response.ok) throw new S3StorageError('رفع', response.status)

    return {
      storageKey,
      fileName: safeFileName(input.fileName),
      mimeType: verified,
      sizeBytes: input.data.length,
    }
  }

  async get(storageKey: string): Promise<Buffer> {
    assertSafeKey(storageKey)

    const response = await this.send('قراءة', 'GET', storageKey, Buffer.alloc(0))
    if (!response.ok) throw new S3StorageError('قراءة', response.status)

    return Buffer.from(await response.arrayBuffer())
  }

  async remove(storageKey: string): Promise<void> {
    assertSafeKey(storageKey)

    const response = await this.send('حذف', 'DELETE', storageKey, Buffer.alloc(0))
    // الحذف عملية مُتماثلة: الملف المفقود ليس خطأ
    if (!response.ok && response.status !== 404) {
      throw new S3StorageError('حذف', response.status)
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    assertSafeKey(storageKey)

    const response = await this.send('فحص', 'HEAD', storageKey, Buffer.alloc(0))
    if (response.status === 404) return false
    if (!response.ok) throw new S3StorageError('فحص', response.status)
    return true
  }
}

/**
 * المفتاح يُولَّد عندنا، لكن لا نثق به عند القراءة: مفتاح فيه `..` أو يبدأ
 * بشرطة مائلة قد يشير إلى كائن خارج مسار المنشأة.
 */
export function assertSafeKey(storageKey: string): void {
  if (
    storageKey.length === 0 ||
    storageKey.startsWith('/') ||
    storageKey.includes('..') ||
    storageKey.includes('\\')
  ) {
    throw new InvalidFileError('مفتاح تخزين غير صالح.')
  }
}

export function createS3Storage(): S3Storage {
  const bucket = process.env.S3_BUCKET
  const region = process.env.S3_REGION
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY

  const missing: string[] = []
  if (!bucket) missing.push('S3_BUCKET')
  if (!region) missing.push('S3_REGION')
  if (!accessKeyId) missing.push('S3_ACCESS_KEY_ID')
  if (!secretAccessKey) missing.push('S3_SECRET_ACCESS_KEY')

  if (missing.length > 0) {
    // نفشل عند الإقلاع لا عند أول رفع: خزنة غير مضبوطة تعني ضياع الملفات
    throw new Error(
      `STORAGE_PROVIDER=s3 لكن المتغيّرات التالية ناقصة: ${missing.join('، ')}.`,
    )
  }

  return new S3Storage({
    bucket: bucket!,
    region: region!,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    sessionToken: process.env.S3_SESSION_TOKEN,
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  })
}
