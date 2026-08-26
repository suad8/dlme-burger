'use client'

import { useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { Camera, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { MAX_UPLOAD_BYTES, ALLOWED_IMAGE_TYPES } from '@/lib/validation'

/**
 * التقاط صورة كدليل ورفعها إلى المخزن.
 *
 * `capture="environment"` يفتح الكاميرا الخلفية مباشرة على الجوال — الاستخدام
 * الغالب أثناء الزيارة الميدانية.
 *
 * الصورة تُضغط في المتصفح قبل الرفع: الزيارات تُنفَّذ غالبًا على شبكة ميدانية
 * بطيئة، ورفع صورة ١٢ ميغابايت من كاميرا حديثة يعطّل الفحص عمليًا.
 *
 * ما يُحفظ في الإجابة هو **معرّف المرفق** لا الصورة نفسها؛ العرض يتم عبر رابط
 * موقّع محدود المدة يعيده الخادم.
 */

const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.78

async function compress(file: File): Promise<Blob> {
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

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  )
  if (!blob) throw new Error('تعذّر ضغط الصورة.')
  return blob
}

export interface UploadedPhoto {
  id: string
  url: string
  fileName: string
}

export function PhotoCapture({
  value,
  onUpload,
  onRemove,
  disabled,
}: {
  /** المرفق المرفوع، أو null إن لم يُرفع بعد. */
  value: UploadedPhoto | null
  /** يرفع الملف ويعيد المرفق — الرفع يتم في الأب لأنه يملك سياق الزيارة. */
  onUpload: (file: File) => Promise<UploadedPhoto | null>
  onRemove: () => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [busy, startUpload] = useTransition()
  const [preparing, setPreparing] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // نفس القيود المفروضة على الخادم — هنا لتحسين التجربة لا للأمان
    if (
      !ALLOWED_IMAGE_TYPES.includes(
        file.type as (typeof ALLOWED_IMAGE_TYPES)[number],
      )
    ) {
      toast.error('نوع الملف غير مدعوم. المسموح: JPEG أو PNG أو WebP.')
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error('حجم الصورة يتجاوز ٨ ميغابايت.')
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    setPreparing(true)
    let prepared: File
    try {
      const blob = await compress(file)
      prepared = new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {
        type: 'image/jpeg',
      })
    } catch {
      toast.error('تعذّر معالجة الصورة. حاول بصورة أخرى.')
      setPreparing(false)
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    setPreparing(false)

    startUpload(async () => {
      const uploaded = await onUpload(prepared)
      if (uploaded) toast.success('رُفعت الصورة.')
      if (inputRef.current) inputRef.current.value = ''
    })
  }

  const working = busy || preparing

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
        disabled={disabled}
      />

      {value ? (
        <div className="space-y-2">
          <div className="relative h-44 w-full overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface-muted">
            <Image
              src={value.url}
              alt={`صورة الدليل: ${value.fileName}`}
              fill
              // الرابط موقّع ومحدود المدة — لا يمر عبر مُحسّن الصور
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
              loading={working}
              disabled={disabled}
            >
              <Camera className="size-4" aria-hidden />
              استبدل
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              disabled={disabled || working}
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
          disabled={disabled || working}
          className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-border bg-surface text-sm text-muted-foreground transition-colors hover:bg-surface-muted disabled:opacity-50"
        >
          <Camera className="size-5" aria-hidden />
          {preparing
            ? 'جارٍ تجهيز الصورة…'
            : busy
              ? 'جارٍ الرفع…'
              : 'التقط صورة'}
        </button>
      )}
    </div>
  )
}
