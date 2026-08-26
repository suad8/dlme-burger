import 'server-only'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { mkdir, writeFile, readFile, unlink, stat } from 'node:fs/promises'
import path from 'node:path'

/**
 * مخزن الملفات.
 *
 * الوصول إلى أي ملف يتم عبر **رابط موقّع محدود المدة** فقط. لا يُخدم أي مسار
 * ثابت للملفات: صور الزيارات ومستندات الموظفين تخص مستأجرًا بعينه، ورابط
 * قابل للتخمين يعني تسريبًا صامتًا.
 *
 * التنفيذ الافتراضي على القرص المحلي — يعمل فورًا في التطوير وفي نشر بنسخة
 * واحدة بقرص دائم. لنشر متعدد النسخ نفّذ `StorageProvider` على S3؛ التوقيع
 * والتحقق يبقيان كما هما لأنهما مستقلان عن مكان التخزين.
 */

export interface StoredFile {
  storageKey: string
  fileName: string
  mimeType: string
  sizeBytes: number
}

export interface PutInput {
  organizationId: string
  /** يفصل الملفات منطقيًا: inspections / employees / services … */
  scope: string
  fileName: string
  mimeType: string
  data: Buffer
}

export interface StorageProvider {
  readonly name: string
  put(input: PutInput): Promise<StoredFile>
  get(storageKey: string): Promise<Buffer>
  remove(storageKey: string): Promise<void>
  exists(storageKey: string): Promise<boolean>
}

/** الأنواع المسموحة — تُفرض هنا لا في المتصفح فقط. */
export const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

export const MAX_FILE_BYTES = 8 * 1024 * 1024

const EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

export class InvalidFileError extends Error {
  override readonly name = 'InvalidFileError'
}

/**
 * التحقق من محتوى الملف لا من امتداده ولا من النوع المُعلَن.
 *
 * المتصفح يرسل `mimeType` يختاره هو — ملف تنفيذي يمكن أن يُعلن نفسه صورة.
 * لذلك نقرأ البايتات الأولى (magic bytes) ونطابقها بالنوع المُعلَن.
 */
export function sniffMimeType(data: Buffer): string | null {
  if (data.length < 12) return null

  // JPEG: FF D8 FF
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return 'image/jpeg'
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47 &&
    data[4] === 0x0d && data[5] === 0x0a && data[6] === 0x1a && data[7] === 0x0a
  ) {
    return 'image/png'
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    data.toString('ascii', 0, 4) === 'RIFF' &&
    data.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp'
  }
  // PDF: "%PDF-"
  if (data.toString('ascii', 0, 5) === '%PDF-') {
    return 'application/pdf'
  }
  return null
}

/** يفحص الملف قبل التخزين. يرمي InvalidFileError عند أي مخالفة. */
export function assertValidFile(mimeType: string, data: Buffer): string {
  if (data.length === 0) {
    throw new InvalidFileError('الملف فارغ.')
  }
  if (data.length > MAX_FILE_BYTES) {
    throw new InvalidFileError('حجم الملف يتجاوز ٨ ميغابايت.')
  }
  if (!ALLOWED_MIME.has(mimeType)) {
    throw new InvalidFileError(
      'نوع الملف غير مدعوم. المسموح: JPEG أو PNG أو WebP أو PDF.',
    )
  }

  const sniffed = sniffMimeType(data)
  if (sniffed === null) {
    throw new InvalidFileError('تعذّر التعرّف على محتوى الملف.')
  }
  if (sniffed !== mimeType) {
    // النوع المُعلَن يخالف المحتوى الفعلي — رفض صريح
    throw new InvalidFileError('محتوى الملف لا يطابق نوعه المُعلَن.')
  }

  return sniffed
}

/** ينظّف اسم الملف من أي محاولة للخروج من المجلد. */
export function safeFileName(name: string): string {
  return path
    .basename(name)
    .replace(/[^\p{L}\p{N}._-]+/gu, '_')
    .slice(0, 120)
}

class LocalDiskStorage implements StorageProvider {
  readonly name = 'local-disk'

  constructor(private readonly root: string) {}

  /**
   * المفتاح يتضمّن معرّف المنشأة، فأي محاولة قراءة لمفتاح منشأة أخرى
   * تُكشف بالمقارنة في طبقة الخدمة قبل الوصول للقرص.
   */
  private resolve(storageKey: string): string {
    // حارس اجتياز المسار: المفتاح يُولَّد عندنا، لكن لا نثق به عند القراءة
    const normalized = path.normalize(storageKey)
    if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
      throw new InvalidFileError('مفتاح تخزين غير صالح.')
    }
    const full = path.join(this.root, normalized)
    if (!full.startsWith(this.root + path.sep)) {
      throw new InvalidFileError('مفتاح تخزين غير صالح.')
    }
    return full
  }

  async put(input: PutInput): Promise<StoredFile> {
    const verified = assertValidFile(input.mimeType, input.data)
    const ext = EXTENSION[verified] ?? 'bin'
    const storageKey = `${input.organizationId}/${input.scope}/${randomUUID()}.${ext}`
    const full = this.resolve(storageKey)

    await mkdir(path.dirname(full), { recursive: true })
    await writeFile(full, input.data)

    return {
      storageKey,
      fileName: safeFileName(input.fileName),
      mimeType: verified,
      sizeBytes: input.data.length,
    }
  }

  async get(storageKey: string): Promise<Buffer> {
    return readFile(this.resolve(storageKey))
  }

  async remove(storageKey: string): Promise<void> {
    try {
      await unlink(this.resolve(storageKey))
    } catch (error) {
      // الملف المفقود ليس خطأ — الحذف عملية مُتماثلة (idempotent)
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      await stat(this.resolve(storageKey))
      return true
    } catch {
      return false
    }
  }
}

let cached: StorageProvider | null = null

export function getStorageProvider(): StorageProvider {
  if (cached) return cached

  const configured = process.env.STORAGE_PROVIDER?.toLowerCase()
  if (configured === 's3') {
    throw new Error(
      'مزوّد التخزين «s3» مُعلن في البيئة لكنه غير منفّذ بعد. ' +
        'أزل STORAGE_PROVIDER للعودة إلى القرص المحلي، أو نفّذ StorageProvider.',
    )
  }

  const root = path.resolve(process.env.STORAGE_ROOT ?? '.storage')
  cached = new LocalDiskStorage(root)
  return cached
}

/* ── الروابط الموقّعة ────────────────────────────────────────── */

const SIGNING_SECRET = process.env.BETTER_AUTH_SECRET ?? ''
const DEFAULT_TTL_SECONDS = 300

export interface SignedRef {
  key: string
  expires: number
  signature: string
}

/**
 * يوقّع مفتاح تخزين لمدة محدودة.
 *
 * التوقيع يشمل المفتاح ووقت الانتهاء معًا، فلا يمكن إطالة الصلاحية بتعديل
 * `expires` وحده — أي تلاعب يُبطل التوقيع.
 */
export function signStorageKey(
  storageKey: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): SignedRef {
  if (!SIGNING_SECRET) {
    throw new Error('BETTER_AUTH_SECRET مطلوب لتوقيع روابط الملفات.')
  }
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds
  const signature = createHmac('sha256', SIGNING_SECRET)
    .update(`${storageKey}:${expires}`)
    .digest('hex')
  return { key: storageKey, expires, signature }
}

export function buildSignedUrl(
  storageKey: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): string {
  const ref = signStorageKey(storageKey, ttlSeconds)
  const params = new URLSearchParams({
    key: ref.key,
    expires: String(ref.expires),
    sig: ref.signature,
  })
  return `/api/files?${params.toString()}`
}

/** يتحقق من التوقيع والصلاحية. مقارنة ثابتة الزمن لمنع هجمات التوقيت. */
export function verifySignedKey(
  storageKey: string,
  expires: number,
  signature: string,
): boolean {
  if (!SIGNING_SECRET) return false
  if (!Number.isFinite(expires)) return false
  if (Math.floor(Date.now() / 1000) > expires) return false

  const expected = createHmac('sha256', SIGNING_SECRET)
    .update(`${storageKey}:${expires}`)
    .digest('hex')

  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(signature, 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** يستخرج معرّف المنشأة من المفتاح — أساس فحص العزل عند التقديم. */
export function organizationFromKey(storageKey: string): string | null {
  const first = storageKey.split('/')[0]
  return first && first.length > 0 ? first : null
}
