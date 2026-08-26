'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TR, TD } from '@/components/ui/table'
import { formatDate } from '@/lib/utils'
import { revokeInvitationAction } from './actions'

export interface InvitationView {
  id: string
  email: string
  roleLabel: string
  status: string
  expiresAt: string
  invitedByName: string
  isExpired: boolean
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'معلّقة',
  ACCEPTED: 'مقبولة',
  REVOKED: 'ملغاة',
  EXPIRED: 'منتهية',
}

export function InvitationRow({
  invitation,
  canRevoke,
}: {
  invitation: InvitationView
  canRevoke: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [hidden, setHidden] = useState(false)

  if (hidden) return null

  const effectiveStatus = invitation.isExpired ? 'EXPIRED' : invitation.status

  function revoke() {
    start(async () => {
      const result = await revokeInvitationAction(invitation.id)
      if (!result.ok) {
        toast.error(result.message ?? 'تعذّر إلغاء الدعوة.')
        return
      }
      toast.success('أُلغيت الدعوة.')
      setHidden(true)
      router.refresh()
    })
  }

  return (
    <TR>
      <TD className="latin text-xs">{invitation.email}</TD>
      <TD>{invitation.roleLabel}</TD>
      <TD>
        <Badge
          tone={
            effectiveStatus === 'ACCEPTED'
              ? 'success'
              : effectiveStatus === 'PENDING'
                ? 'info'
                : 'neutral'
          }
        >
          {STATUS_LABELS[effectiveStatus] ?? effectiveStatus}
        </Badge>
      </TD>
      <TD className="text-xs text-muted-foreground">
        {formatDate(new Date(invitation.expiresAt))}
      </TD>
      <TD className="text-xs text-muted-foreground">
        {invitation.invitedByName}
      </TD>
      <TD>
        {canRevoke && effectiveStatus === 'PENDING' ? (
          <Button
            size="sm"
            variant="ghost"
            loading={pending}
            onClick={revoke}
            aria-label={`إلغاء دعوة ${invitation.email}`}
          >
            <X className="size-3.5" aria-hidden />
            إلغاء
          </Button>
        ) : null}
      </TD>
    </TR>
  )
}
