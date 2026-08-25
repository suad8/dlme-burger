import type { Metadata } from 'next'
import { Mail, MessageSquare, Clock } from 'lucide-react'

export const metadata: Metadata = {
  title: 'تواصل معنا',
  description: 'تواصل مع فريق إتقان للاستفسارات وطلبات الباقات المخصصة.',
  alternates: { canonical: '/contact' },
}

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:py-20">
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
        تواصل معنا
      </h1>
      <p className="mt-4 text-muted-foreground leading-relaxed">
        للاستفسار عن الباقات المخصصة للمؤسسات، أو لطلب عرض توضيحي، أو لأي سؤال
        تقني.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          { icon: Mail, title: 'البريد', body: 'hello@itqan.sa' },
          { icon: MessageSquare, title: 'الدعم داخل المنصة', body: 'من أيقونة الدعم بعد تسجيل الدخول' },
          { icon: Clock, title: 'أوقات الرد', body: 'الأحد – الخميس، ٩ص – ٥م بتوقيت الرياض' },
        ].map((c) => (
          <div
            key={c.title}
            className="rounded-[var(--radius-lg)] border border-border bg-surface p-5"
          >
            <c.icon className="size-5 text-primary" aria-hidden />
            <h2 className="mt-3 font-semibold">{c.title}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
              {c.body}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-[var(--radius-lg)] border border-border bg-surface-muted/50 p-5">
        <p className="text-sm text-muted-foreground leading-relaxed">
          نموذج التواصل المباشر ونظام التذاكر متاحان من داخل الحساب بعد تسجيل
          الدخول، حيث يُربط طلبك بمنشأتك وفرعك تلقائيًا فيصل للفريق المختص أسرع.
        </p>
      </div>
    </div>
  )
}
