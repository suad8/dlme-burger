import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'من نحن',
  description:
    'إتقان — منصة سعودية لتشغيل المطاعم والمقاهي، مبنية حول الالتزام التشغيلي القابل للقياس.',
  alternates: { canonical: '/about' },
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:py-20">
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">من نحن</h1>

      <div className="mt-8 space-y-6 text-muted-foreground leading-relaxed">
        <p>
          إتقان منصة سعودية لتشغيل المنشآت الغذائية. بُنيت حول ملاحظة واحدة:
          معظم مشاكل المطاعم والمقاهي ليست في الأفكار، بل في التنفيذ اليومي —
          معيار يُطبَّق في فرع ويُهمَل في آخر، ومخالفة تُذكر شفويًا ثم تُنسى،
          وتكلفة صنف تتغيّر دون أن ينتبه أحد.
        </p>
        <p>
          لذلك لا نبيع لوحات مؤشرات جميلة. نبني أدوات تُستخدم في المناوبة: قائمة
          فحص تُنفَّذ من الجوال في الصالة، مخالفة تتحوّل إلى إجراء له مالك وموعد،
          ورقم تكلفة يتحدّث فور تغيّر سعر المكوّن.
        </p>

        <h2 className="pt-4 text-xl font-bold text-foreground">مبادئ نلتزم بها</h2>
        <ul className="space-y-3">
          <li>
            <strong className="text-foreground">الرقم قبل الانطباع.</strong>{' '}
            كل ما تعرضه المنصة محسوب من بيانات فعلية، ولا نعرض رقمًا لا نستطيع
            تفسير مصدره.
          </li>
          <li>
            <strong className="text-foreground">العزل ليس وعدًا.</strong>{' '}
            بيانات كل منشأة معزولة بقيود في قاعدة البيانات وباختبارات آلية تفشل
            عملية البناء إن انكسر العزل.
          </li>
          <li>
            <strong className="text-foreground">التوصية تُفسَّر.</strong>{' '}
            حين نصنّف صنفًا في المنيو أو ننبّه إلى انخفاض التزام، نعرض على أي
            أساس — لا قرارات آلية غامضة.
          </li>
          <li>
            <strong className="text-foreground">العربية أولًا.</strong>{' '}
            المنصة مبنية بالعربية اتجاهًا ومحتوًى ومصطلحًا، لا مترجمة عن واجهة
            إنجليزية.
          </li>
        </ul>

        <div className="rounded-[var(--radius-lg)] border border-border bg-surface-muted/50 p-5">
          <p className="text-sm">
            <strong className="text-foreground">ملاحظة صريحة:</strong> المنصة في
            مرحلة مبكرة. لا نعرض أرقام نجاح أو شهادات عملاء لأننا لم نجمعها بعد.
            حين تتوفر بيانات حقيقية موثّقة سننشرها منسوبة لأصحابها.
          </p>
        </div>
      </div>

      <Button asChild className="mt-10">
        <Link href="/register">جرّب المنصة</Link>
      </Button>
    </div>
  )
}
