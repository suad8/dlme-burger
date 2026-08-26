'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Copy, Send } from 'lucide-react'
import type { RoleKey } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input, Label, FieldHint } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { inviteMemberAction } from './actions'

export interface RoleOption {
  key: RoleKey
  label: string
}

export interface BranchOption {
  id: string
  name: string
}

export function InviteForm({
  roles,
  branches,
  emailIsLive,
}: {
  roles: RoleOption[]
  branches: BranchOption[]
  emailIsLive: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [email, setEmail] = useState('')
  const [roleKey, setRoleKey] = useState<string>(roles[0]?.key ?? '')
  const [selectedBranches, setSelectedBranches] = useState<string[]>([])
  const [manualLink, setManualLink] = useState<string | null>(null)

  function toggleBranch(id: string) {
    setSelectedBranches((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id],
    )
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setManualLink(null)

    start(async () => {
      const result = await inviteMemberAction(email, roleKey, selectedBranches)

      if (!result.ok) {
        toast.error(result.message ?? 'تعذّر إرسال الدعوة.')
        return
      }

      setEmail('')
      setSelectedBranches([])

      if (result.data?.emailDelivered) {
        toast.success('أُرسلت الدعوة إلى البريد.')
      } else {
        // لا ندّعي إرسالًا لم يحدث — نعطي الرابط ليُنقل يدويًا
        toast.info('أُنشئت الدعوة، ولم تُرسل بالبريد. انسخ الرابط وأرسله.')
        setManualLink(result.data?.manualLink ?? null)
      }

      router.refresh()
    })
  }

  async function copyLink() {
    if (!manualLink) return
    try {
      await navigator.clipboard.writeText(manualLink)
      toast.success('نُسخ الرابط.')
    } catch {
      toast.error('تعذّر النسخ. حدّد الرابط وانسخه يدويًا.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>دعوة عضو</CardTitle>
      </CardHeader>
      <CardContent>
        <form method="post" onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="invite-email" required>
                البريد الإلكتروني
              </Label>
              <Input
                id="invite-email"
                type="email"
                dir="ltr"
                className="mt-1.5 text-start"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="invite-role" required>
                الدور
              </Label>
              <select
                id="invite-role"
                value={roleKey}
                onChange={(e) => setRoleKey(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm"
              >
                {roles.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
              <FieldHint>
                تظهر الأدوار التي تملك صلاحياتها فقط — لا يمكنك منح ما لا تملك.
              </FieldHint>
            </div>
          </div>

          {branches.length > 0 && (
            <fieldset>
              <legend className="text-sm font-medium">
                نطاق الفروع{' '}
                <span className="font-normal text-muted-foreground">
                  (بلا اختيار = كل الفروع)
                </span>
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {branches.map((b) => {
                  const active = selectedBranches.includes(b.id)
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => toggleBranch(b.id)}
                      aria-pressed={active}
                      className={
                        active
                          ? 'rounded-full border border-primary bg-primary-soft px-3 py-1 text-xs font-medium text-primary'
                          : 'rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground hover:text-foreground'
                      }
                    >
                      {b.name}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          )}

          {!emailIsLive && (
            <p className="rounded-[var(--radius-md)] border border-warning/30 bg-warning-soft p-3 text-xs leading-relaxed">
              مزوّد البريد غير مضبوط، فالدعوة لن تُرسَل تلقائيًا. ستحصل على
              رابط تنسخه وترسله بنفسك.
            </p>
          )}

          <Button type="submit" loading={pending} disabled={roles.length === 0}>
            <Send className="size-4" aria-hidden />
            إرسال الدعوة
          </Button>
        </form>

        {manualLink && (
          <div className="mt-4 rounded-[var(--radius-md)] border border-border bg-surface-muted p-3">
            <p className="text-xs text-muted-foreground">
              رابط الدعوة — صالح سبعة أيام ولمرة واحدة. أرسله للمدعو عبر قناة
              موثوقة؛ من يملكه يستطيع الانضمام.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="latin flex-1 overflow-x-auto rounded-[var(--radius-sm)] bg-surface px-2 py-1.5 text-[11px]">
                {manualLink}
              </code>
              <Button size="sm" variant="secondary" onClick={copyLink}>
                <Copy className="size-3.5" aria-hidden />
                نسخ
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
