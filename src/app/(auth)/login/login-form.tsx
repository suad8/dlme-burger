'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Label, FieldError } from '@/components/ui/input'
import { loginSchema, type LoginInput } from '@/lib/validation'
import { signIn } from '@/lib/auth-client'

export function LoginForm() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: LoginInput) {
    setSubmitting(true)
    try {
      const { error } = await signIn.email({
        email: values.email,
        password: values.password,
      })

      if (error) {
        // رسالة موحّدة عمدًا: لا نكشف ما إذا كان البريد مسجّلًا
        toast.error('بيانات الدخول غير صحيحة. تحقّق من البريد وكلمة المرور.')
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      toast.error('تعذّر الاتصال بالخادم. حاول مرة أخرى.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
          aria-describedby={errors.email ? 'email-error' : undefined}
          {...register('email')}
        />
        <span id="email-error">
          <FieldError>{errors.email?.message}</FieldError>
        </span>
      </div>

      <div>
        <Label htmlFor="password" required>
          كلمة المرور
        </Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          dir="ltr"
          className="mt-1.5 text-start"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'password-error' : undefined}
          {...register('password')}
        />
        <span id="password-error">
          <FieldError>{errors.password?.message}</FieldError>
        </span>
      </div>

      <Button type="submit" className="w-full" loading={submitting}>
        دخول
      </Button>
    </form>
  )
}
