import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { getSession } from '@/server/tenant'
import { RegisterForm } from './register-form'

export const metadata: Metadata = {
  title: 'إنشاء حساب',
  robots: { index: false, follow: false },
}

export default async function RegisterPage() {
  const session = await getSession()
  if (session?.user) redirect('/dashboard')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">ابدأ تجربتك المجانية</CardTitle>
        <CardDescription>
          ١٤ يومًا بالمنصة كاملة. لا نطلب بطاقة ائتمانية.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          لديك حساب؟{' '}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline underline-offset-4"
          >
            سجّل الدخول
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
