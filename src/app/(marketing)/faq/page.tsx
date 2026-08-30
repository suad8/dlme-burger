import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'الأسئلة الشائعة',
  description:
    'إجابات عن الاشتراك والفروع والصلاحيات وخصوصية البيانات في منصة إتقان.',
  alternates: { canonical: '/faq' },
}

const FAQS = [
  {
    q: 'هل أحتاج بطاقة ائتمانية لبدء التجربة؟',
    a: 'لا. التجربة ١٤ يومًا تبدأ فور إنشاء الحساب دون أي بيانات دفع. عند انتهائها تختار الباقة المناسبة، وتبقى بياناتك محفوظة.',
  },
  {
    q: 'هل يمكن لمدير الفرع رؤية بيانات فرع آخر؟',
    a: 'لا. نطاق الفروع يُفرض على الخادم وقاعدة البيانات، لا في الواجهة فقط. مدير الفرع لا يستطيع قراءة بيانات فرع خارج نطاقه حتى لو عرف معرّفه.',
  },
  {
    q: 'كيف تُحسب درجة الالتزام؟',
    a: 'من نتائج الفحوصات المعتمدة خلال الفترة المختارة: مجموع الدرجات المكتسبة نسبةً إلى الدرجة القصوى، مع وزن لكل بند وقسم. البنود الحرجة تُسقط النتيجة وتفتح إجراءً تصحيحيًا.',
  },
  {
    q: 'ماذا يحدث إذا فشل الدفع؟',
    a: 'يدخل الاشتراك فترة سماح تبقى فيها البيانات كاملة والوصول متاحًا للقراءة. بعدها تُقيَّد الإضافة والتعديل حتى تسوية الدفع — ولا تُحذف بيانات في أي مرحلة.',
  },
  {
    q: 'هل يمكن تخصيص الصلاحيات؟',
    a: 'نعم. الأدوار العشرة تأتي بصلاحيات افتراضية معقولة، ثم تُخصَّص لكل منشأة على حدة: عرض، إنشاء، تعديل، حذف، اعتماد، تصدير، إدارة مستخدمين، إدارة فواتير، وتقييد بفروع محددة.',
  },
  {
    q: 'هل بيانات منشأتي معزولة عن غيرها؟',
    a: 'نعم، والعزل مفروض على ثلاث طبقات: قيود في قاعدة البيانات، تقييد كل استعلام بمعرّف المنشأة المشتق من الجلسة، واختبارات آلية تفشل عملية البناء إن تسرّب أي سجل بين منشأتين.',
  },
  {
    q: 'هل تعمل الفحوصات من الجوال؟',
    a: 'نعم، وهي مصمَّمة للجوال أولًا لا كتصغير لواجهة سطح المكتب: رفع الصور، التوقيع، تسجيل المخالفة، وتغيير حالة المهمة كلها بأهداف نقر مريحة أثناء الزيارة الميدانية.',
  },
  {
    q: 'هل يمكن تصدير التقارير؟',
    a: 'نعم، إلى CSV مع احترام صلاحيات المستخدم: لا يُصدَّر إلا ما يحق له الاطلاع عليه. وللطباعة أو الحفظ PDF توجد نسخة ورقية من كل تقرير بترويسة المنشأة.',
  },
]

export default function FaqPage() {
  // Schema.org — يُحسّن ظهور الأسئلة في نتائج البحث
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
        الأسئلة الشائعة
      </h1>

      <div className="mt-10 divide-y divide-border">
        {FAQS.map((f) => (
          <details key={f.q} className="group py-5">
            <summary className="tap-target flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
              {f.q}
              <span
                className="shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-45"
                aria-hidden
              >
                +
              </span>
            </summary>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              {f.a}
            </p>
          </details>
        ))}
      </div>
    </div>
  )
}
