import Link from 'next/link'
import { FileQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * 404 موحّد. نستعمله أيضًا للسجلات التي تخص منشأة أخرى: الرد بـ403 هناك
 * يكشف أن السجل موجود، فنقول «غير موجود» ولا نفرّق بين الحالتين.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
        <FileQuestion className="size-5" aria-hidden />
      </div>
      <h1 className="mt-4 text-lg font-semibold">الصفحة غير موجودة</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        الرابط الذي فتحته غير صحيح، أو أن العنصر حُذف، أو أنه لا يخص منشأتك.
      </p>
      <Button asChild variant="secondary" className="mt-6">
        <Link href="/dashboard">العودة إلى لوحة التحكم</Link>
      </Button>
    </div>
  )
}
