'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { addCommentAction } from '../actions'

export function CommentForm({ actionId }: { actionId: string }) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [pending, start] = useTransition()

  function submit() {
    const trimmed = body.trim()
    if (!trimmed) {
      toast.error('اكتب تعليقًا أولًا.')
      return
    }
    start(async () => {
      const result = await addCommentAction(actionId, trimmed)
      if (!result.ok) {
        toast.error(result.message ?? 'تعذّر إضافة التعليق.')
        return
      }
      setBody('')
      router.refresh()
    })
  }

  return (
    <div>
      <label htmlFor="comment-body" className="text-sm font-medium">
        أضف تعليقًا
      </label>
      <Textarea
        id="comment-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
        className="mt-1.5"
        placeholder="ما الذي تم إنجازه أو ما الذي يعيق الإجراء؟"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-[11px] text-muted-foreground tabular">
          {body.length} / 2000
        </span>
        <Button size="sm" onClick={submit} loading={pending}>
          أضف التعليق
        </Button>
      </div>
    </div>
  )
}
