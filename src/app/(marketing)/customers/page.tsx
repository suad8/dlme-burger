import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = {
  title: 'قصص النجاح',
  description: 'قصص عملاء إتقان — تُنشر عند توفر نتائج موثّقة ومنسوبة لأصحابها.',
  alternates: { canonical: '/customers' },
}

export default function CustomersPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:py-20">
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
        قصص النجاح
      </h1>

      <div className="mt-8 rounded-[var(--radius-lg)] border border-dashed border-border bg-surface p-8">
        <Badge tone="neutral">لم تُنشر بعد</Badge>
        <h2 className="mt-4 text-lg font-semibold">
          لا نعرض قصصًا لم تحدث
        </h2>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          المنصة في مرحلة مبكرة، ولم نجمع بعد نتائج موثّقة من عملاء حقيقيين.
          بدل ملء هذه الصفحة بشهادات مصنوعة أو أرقام تقديرية، نتركها فارغة حتى
          يكون لدينا ما يستحق النشر.
        </p>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          حين تُنشر قصة هنا، ستكون منسوبة لمنشأة باسمها، وبأرقام قابلة للتحقق،
          وبموافقة مكتوبة من صاحبها.
        </p>
      </div>

      <div className="mt-8">
        <p className="text-sm text-muted-foreground">
          تستخدم إتقان وتود مشاركة تجربتك؟
        </p>
        <Button asChild variant="secondary" className="mt-3">
          <Link href="/contact">تواصل معنا</Link>
        </Button>
      </div>
    </div>
  )
}
