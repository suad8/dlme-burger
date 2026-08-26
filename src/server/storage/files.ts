import 'server-only'
import path from 'node:path'

/**
 * قواعد الملفات المشتركة بين كل مزوّدي التخزين.
 *
 * فُصلت عن `provider.ts` لكسر دورة استيراد: المزوّد يختار التنفيذ (قرص أو
 * S3)، والتنفيذات تحتاج هذه القواعد. لو بقيت في نفس الملف لاستوردا بعضهما.
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

/** امتداد الملف يُشتق من النوع المُتحقَّق منه لا من اسم الملف المُرسَل. */
export const EXTENSION: Record<string, string> = {
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

