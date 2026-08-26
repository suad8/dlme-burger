'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * حدّ الأخطاء داخل التطبيق. Next لا يمرّر رسالة الخطأ الأصلية إلى المتصفح في
 * الإنتاج — يمرّر digest فقط. هذا مقصود: رسائل الخادم قد تحمل أسماء جداول أو
 * قيمًا، فلا نعرضها. نعرض digest ليربط المستخدم بلاغه بسجل الخادم.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // التسجيل في المتصفح للتشخيص فقط؛ السجل الرسمي على الخادم
    console.error('app error', error.digest ?? error.message)
  }, [error])

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center justify-center px-6 py-16 text-center"
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle className="size-5" aria-hidden />
      </div>
      <h1 className="mt-4 text-lg font-semibold">تعذّر عرض هذه الصفحة</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        حدث خطأ غير متوقع. حاول مرة أخرى، وإن تكرر فأرسل الرمز أدناه للدعم.
      </p>
      {error.digest && (
        <code className="latin mt-3 rounded-[var(--radius-sm)] bg-surface-muted px-2 py-1 text-xs">
          {error.digest}
        </code>
      )}
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>إعادة المحاولة</Button>
      </div>
    </div>
  )
}
