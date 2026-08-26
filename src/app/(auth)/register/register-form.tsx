'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Label, FieldError, FieldHint } from '@/components/ui/input'
import { registerSchema, type RegisterInput } from '@/lib/validation'
import { registerAction } from './actions'

export function RegisterForm() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', organizationName: '' },
  })

  async function onSubmit(values: RegisterInput) {
    setSubmitting(true)
    try {
      const result = await registerAction(values)
      if (!result.ok) {
        toast.error(result.message ?? 'تعذّر إنشاء الحساب.')
        return
      }
      toast.success('تم إنشاء حسابك. أهلًا بك في إتقان.')
      router.push('/onboarding')
      router.refresh()
    } catch {
      toast.error('تعذّر الاتصال بالخادم. حاول مرة أخرى.')
    } finally {
      setSubmitting(false)
    }
  }

  // method="post" ضروري رغم أن الإرسال يُعالَج في JavaScript.
  // إن ضغط المستخدم زر الإرسال قبل اكتمال ترطيب React — وهو وارد على شبكة أو
  // جهاز بطيء — يُرسل المتصفح النموذج أصلًا. الافتراضي GET، فتذهب كلمة المرور
  // إلى شريط العنوان ومنه إلى سجل المتصفح وسجلات الخادم وترويسة الإحالة.
  // POST يُبقيها في جسم الطلب فلا تُسرَّب.
  return (
    <form
      method="post"
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4"
      noValidate
    >
      <div>
        <Label htmlFor="name" required>
          الاسم الكامل
        </Label>
        <Input
          id="name"
          autoComplete="name"
          className="mt-1.5"
          aria-invalid={Boolean(errors.name)}
          {...register('name')}
        />
        <FieldError>{errors.name?.message}</FieldError>
      </div>

      <div>
        <Label htmlFor="organizationName" required>
          اسم المنشأة
        </Label>
        <Input
          id="organizationName"
          autoComplete="organization"
          className="mt-1.5"
          aria-invalid={Boolean(errors.organizationName)}
          {...register('organizationName')}
        />
        <FieldError>{errors.organizationName?.message}</FieldError>
        <FieldHint>
          {errors.organizationName ? undefined : 'يمكنك تعديله لاحقًا من الإعدادات.'}
        </FieldHint>
      </div>

      <div>
        <Label htmlFor="email" required>
          البريد الإلكتروني
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          dir="ltr"
          className="mt-1.5 text-start"
          aria-invalid={Boolean(errors.email)}
          {...register('email')}
        />
        <FieldError>{errors.email?.message}</FieldError>
      </div>

      <div>
        <Label htmlFor="password" required>
          كلمة المرور
        </Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          dir="ltr"
          className="mt-1.5 text-start"
          aria-invalid={Boolean(errors.password)}
          {...register('password')}
        />
        <FieldError>{errors.password?.message}</FieldError>
        <FieldHint>
          {errors.password
            ? undefined
            : '١٢ محرفًا على الأقل، مع حرف كبير وصغير ورقم.'}
        </FieldHint>
      </div>

      <Button type="submit" className="w-full" loading={submitting}>
        أنشئ الحساب
      </Button>

      <p className="text-xs text-muted-foreground text-center leading-relaxed">
        بإنشائك الحساب فإنك توافق على{' '}
        <a href="/terms" className="underline underline-offset-4">
          الشروط والأحكام
        </a>{' '}
        و
        <a href="/privacy" className="underline underline-offset-4">
          سياسة الخصوصية
        </a>
        .
      </p>
    </form>
  )
}
