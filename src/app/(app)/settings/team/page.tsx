import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Users, MailPlus } from 'lucide-react'
import { requireTenant } from '@/server/tenant'
import { can, ROLE_LABELS } from '@/server/rbac'
import {
  listInvitations,
  assignableRoles,
} from '@/server/services/invitations'
import { listBranches } from '@/server/services/branches'
import { getOrganizationSettings } from '@/server/services/settings'
import { resolveEmailProvider } from '@/server/email/provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { NoPermission } from '@/components/ui/states'
import { TableWrap, Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { InviteForm } from './invite-form'
import { InvitationRow } from './invitation-rows'

export const metadata: Metadata = {
  title: 'الفريق والدعوات',
  robots: { index: false, follow: false },
}

export default async function TeamPage() {
  const ctx = await requireTenant()

  if (!can(ctx, 'user:view')) {
    return (
      <NoPermission
        description="إدارة الفريق متاحة لأدوار الإشراف. اطلب من مالك المنشأة تعديل دورك."
        backHref="/settings"
        backLabel="العودة إلى الإعدادات"
      />
    )
  }

  const canInvite = can(ctx, 'user:create')
  const canRevoke = can(ctx, 'user:delete')

  const [invitations, branches, settings] = await Promise.all([
    listInvitations(ctx),
    canInvite ? listBranches(ctx) : Promise.resolve([]),
    getOrganizationSettings(ctx),
  ])

  // الدور لا يُرسَل إلى المتصفح إن لم يكن قابلًا للمنح — الإخفاء في الخادم
  const roles = assignableRoles(ctx)
    .filter((key) => key !== 'SUPER_ADMIN')
    .map((key) => ({ key, label: ROLE_LABELS[key] }))

  const emailIsLive = resolveEmailProvider().isLive

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-4" aria-hidden />
        الإعدادات
      </Link>

      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
          الفريق والدعوات
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          الأعضاء الحاليون والدعوات المعلّقة.
        </p>
      </div>

      {canInvite && (
        <InviteForm
          roles={roles}
          branches={branches.map((b) => ({ id: b.id, name: b.name }))}
          emailIsLive={emailIsLive}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4" aria-hidden />
            الأعضاء ({settings.members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TableWrap className="border-0">
            <Table>
              <caption className="sr-only">أعضاء المنشأة وأدوارهم</caption>
              <THead>
                <TR>
                  <TH scope="col">الاسم</TH>
                  <TH scope="col">البريد</TH>
                  <TH scope="col">الدور</TH>
                  <TH scope="col">نطاق الفروع</TH>
                </TR>
              </THead>
              <TBody>
                {settings.members.map((m) => (
                  <TR key={m.id}>
                    <TD className="font-medium">{m.name}</TD>
                    <TD className="latin text-xs">{m.email}</TD>
                    <TD>
                      <Badge tone="primary">{ROLE_LABELS[m.role]}</Badge>
                    </TD>
                    <TD className="text-sm">
                      {m.branchNames.length === 0 ? (
                        <span className="text-muted-foreground">كل الفروع</span>
                      ) : (
                        m.branchNames.join('، ')
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailPlus className="size-4" aria-hidden />
            الدعوات
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              لا دعوات بعد.
            </p>
          ) : (
            <TableWrap className="border-0">
              <Table>
                <caption className="sr-only">دعوات الانضمام</caption>
                <THead>
                  <TR>
                    <TH scope="col">البريد</TH>
                    <TH scope="col">الدور</TH>
                    <TH scope="col">الحالة</TH>
                    <TH scope="col">تنتهي في</TH>
                    <TH scope="col">دعاه</TH>
                    <TH scope="col">
                      <span className="sr-only">إجراءات</span>
                    </TH>
                  </TR>
                </THead>
                <TBody>
                  {invitations.map((i) => (
                    <InvitationRow
                      key={i.id}
                      canRevoke={canRevoke}
                      invitation={{
                        id: i.id,
                        email: i.email,
                        roleLabel: i.roleLabel,
                        status: i.status,
                        expiresAt: i.expiresAt.toISOString(),
                        invitedByName: i.invitedByName,
                        isExpired: i.isExpired,
                      }}
                    />
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
