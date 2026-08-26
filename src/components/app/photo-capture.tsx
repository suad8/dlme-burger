'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Camera, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { MAX_UPLOAD_BYTES, ALLOWED_IMAGE_TYPES } from '@/lib/validation'

/**
 * التقاط صورة كدليل.
 *
 * `capture="environment"` يفتح الكاميرا الخلفية مباشرة على الجوال — الاستخدام
 * الغالب أثناء الزيارة الميدانية.
 *
 * ⚠️ حدّ معروف: الصورة تُخزَّن حاليًا كـdata URL داخل حقل الإجابة. هذا يعمل،
 * لكنه لا يصلح لأحجام كبيرة أو لعدد كبير من الصور. الخطوة التالية ربط مخزن
 * ملفات (S3 أو ما يعادله) وحفظ storageKey بدل المحتوى — جدول attachments جاهز
 * لذلك بالفعل. لهذا نضغط الصورة قبل الحفظ.
 */

const MAX_DIMENSION = 1280
const JPEG_QUALITY = 0.72

async function compress(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('تعذّر تجهيز الصورة.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

export function PhotoCapture({
  value,
  onChange,
}: {
  value: string | null
  onChange: (dataUrl: string | null) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // نفس القيود المفروضة على الخادم — التحقق هنا للتجربة لا للأمان
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      toast.error('نوع الملف غير مدعوم. المسموح: JPEG أو PNG أو WebP.')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error('حجم الصورة يتجاوز ٨ ميغابايت.')
      return
    }

    setBusy(true)
    try {
      onChange(await compress(file))
    } catch {
      toast.error('تعذّر معالجة الصورة. حاول بصورة أخرى.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={handleFile}
        className="sr-only"
        aria-label="التقاط صورة"
      />

      {value ? (
        <div className="space-y-2">
          <div className="relative h-44 w-full overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface-muted">
            <Image
              src={value}
              alt="صورة الدليل المرفقة"
              fill
              unoptimized
              className="object-cover"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => inputRef.current?.click()}
              loading={busy}
            >
              <Camera className="size-4" aria-hidden />
              استبدل
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
            >
              <Trash2 className="size-4" aria-hidden />
              حذف
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-border bg-surface text-sm text-muted-foreground transition-colors hover:bg-surface-muted disabled:opacity-50"
        >
          <Camera className="size-5" aria-hidden />
          {busy ? 'جارٍ المعالجة…' : 'التقط صورة'}
        </button>
      )}
    </div>
  )
}
