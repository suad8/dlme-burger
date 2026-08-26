'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Label, FieldHint } from '@/components/ui/input'
import { acceptInviteAction } from './actions'

export function AcceptInvite({
  token,
  invitedEmail,
  signedInEmail,
  emailMatches,
}: {
  token: string
  invitedEmail: string
  signedInEmail: string | null
  emailMatches: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')

  function accept(newAccount?: { name: string; password: string }) {
    start(async () => {
      const result = await acceptInviteAction(token, newAccount)
      if (!result.ok) {
        toast.error(result.message ?? 'تعذّر قبول الدعوة.')
        return
      }
      toast.success('انضممت إلى المنشأة.')
      router.push('/dashboard')
      router.refresh()
    })
  }

  // مسجّل دخول ببريد آخر: لا نقبل نيابة عنه، وإلا انضم الحساب الخطأ
  if (signedInEmail && !emailMatches) {
    return (
      <div className="rounded-[var(--radius-md)] border border-warning/30 bg-warning-soft p-4 text-sm leading-relaxed">
        أنت مسجّل الدخول بحساب <span className="latin">{signedInEmail}</span>،
        والدعوة صادرة لـ<span className="latin"> {invitedEmail}</span>. سجّل
        الخروج ثم افتح الرابط مرة أخرى.
      </div>
    )
  }

  if (emailMatches) {
    return (
      <Button className="w-full" loading={pending} onClick={() => accept()}>
        قبول الدعوة والانضمام
      </Button>
    )
  }

  return (
    <form
      method="post"
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        accept({ name, password })
      }}
    >
      <div>
        <Label htmlFor="invite-name" required>
          الاسم الكامل
        </Label>
        <Input
          id="invite-name"
          autoComplete="name"
          className="mt-1.5"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div>
        <Label htmlFor="invite-password" required>
          كلمة المرور
        </Label>
        <Input
          id="invite-password"
          type="password"
          autoComplete="new-password"
          dir="ltr"
          className="mt-1.5 text-start"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <FieldHint>١٢ محرفًا على الأقل، مع حرف كبير وصغير ورقم.</FieldHint>
      </div>

      <Button type="submit" className="w-full" loading={pending}>
        أنشئ الحساب وانضم
      </Button>
    </form>
  )
}
