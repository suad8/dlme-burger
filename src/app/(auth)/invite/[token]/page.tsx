import type { Metadata } from 'next'
import Link from 'next/link'
import { MailX } from 'lucide-react'
import { readInvitation } from '@/server/services/invitations'
import { getSession } from '@/server/tenant'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AcceptInvite } from './accept-form'

export const metadata: Metadata = {
  title: 'دعوة للانضمام',
  // الرابط سرّ — لا يُفهرَس ولا تُرسَل الإحالة
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const invitation = await readInvitation(token)

  if (!invitation) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
            <MailX className="size-5" aria-hidden />
          </div>
          <h1 className="mt-4 text-lg font-semibold">الدعوة غير صالحة</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            انتهت صلاحية هذا الرابط، أو أُلغي، أو استُخدم من قبل. اطلب من مالك
            المنشأة إرسال دعوة جديدة.
          </p>
          <Button asChild variant="secondary" className="mt-6">
            <Link href="/login">تسجيل الدخول</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const session = await getSession()
  const currentEmail = session?.user?.email ?? null
  const emailMatches =
    currentEmail !== null &&
    currentEmail.toLowerCase() === invitation.email.toLowerCase()

  return (
    <Card>
      <CardHeader>
        <CardTitle>دعوة للانضمام</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed">
          دعاك <strong>{invitation.inviterName}</strong> للانضمام إلى منشأة{' '}
          <strong>{invitation.organizationName}</strong> بصفة{' '}
          <strong>{invitation.roleLabel}</strong>.
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          الدعوة صادرة للبريد{' '}
          <span className="latin">{invitation.email}</span>
        </p>

        <div className="mt-6">
          <AcceptInvite
            token={token}
            invitedEmail={invitation.email}
            signedInEmail={currentEmail}
            emailMatches={emailMatches}
          />
        </div>
      </CardContent>
    </Card>
  )
}
