'use server'

import { revalidatePath } from 'next/cache'
import { requireTenant } from '@/server/tenant'
import { listUnread, markRead } from '@/server/notifications/dispatch'

export interface NotificationItem {
  id: string
  title: string
  body: string
  linkPath: string | null
  createdAt: string
}

/** إشعارات المستخدم الحالي وحده — لا معرّف يُقبل من المتصفح. */
export async function fetchNotificationsAction(): Promise<NotificationItem[]> {
  const ctx = await requireTenant()
  const rows = await listUnread(ctx.userId, 20)
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    linkPath: r.linkPath,
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function markNotificationsReadAction(
  ids: string[],
): Promise<{ ok: boolean }> {
  const ctx = await requireTenant()
  // markRead مقيّد بالمستخدم داخليًا — لا يمكن تعليم إشعارات غيرك
  await markRead(ctx.userId, ids)
  revalidatePath('/dashboard')
  return { ok: true }
}
