import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { getSession } from '@/server/tenant'
import { LoginForm } from './login-form'

export const metadata: Metadata = {
  title: 'تسجيل الدخول',
  robots: { index: false, follow: false },
}

export default async function LoginPage() {
  // من لديه جلسة سارية لا يرى شاشة الدخول
  const session = await getSession()
  if (session?.user) redirect('/dashboard')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">تسجيل الدخول</CardTitle>
        <CardDescription>
          أدخل بريدك الإلكتروني وكلمة المرور للوصول إلى منصتك.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          ليس لديك حساب؟{' '}
          <Link
            href="/register"
            className="font-medium text-primary hover:underline underline-offset-4"
          >
            أنشئ حسابًا جديدًا
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
