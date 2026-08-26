import 'server-only'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { mkdir, writeFile, readFile, unlink, stat } from 'node:fs/promises'
import path from 'node:path'
import {
  assertValidFile,
  safeFileName,
  InvalidFileError,
  EXTENSION,
  type PutInput,
  type StorageProvider,
  type StoredFile,
} from './files'
import { createS3Storage } from './s3'

// نعيد التصدير حتى يبقى `@/server/storage/provider` نقطة الدخول الوحيدة
export {
  ALLOWED_MIME,
  MAX_FILE_BYTES,
  InvalidFileError,
  sniffMimeType,
  assertValidFile,
  safeFileName,
} from './files'
export type { StoredFile, PutInput, StorageProvider } from './files'


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
    cached = createS3Storage()
    return cached
  }

  if (configured && configured !== 'local' && configured !== 'local-disk') {
    throw new Error(`مزوّد تخزين غير معروف: ${configured}`)
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
