'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Bell, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatRelative, formatNumber, cn } from '@/lib/utils'
import {
  fetchNotificationsAction,
  markNotificationsReadAction,
  type NotificationItem,
} from '@/app/(app)/notifications-actions'

/**
 * جرس الإشعارات.
 *
 * يُحمَّل عند الفتح لا عند تركيب الصفحة: استدعاء على كل تحميل صفحة لمجرد عرض
 * رقم صغير يضاعف الحمل بلا مقابل. العدّاد يُحدَّث بعد أول فتح وعند كل فتح
 * لاحق.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[] | null>(null)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)

  /**
   * التحميل استجابةً لنقرة المستخدم لا داخل تأثير.
   * الفتح حدث، والتأثير ليس مكانًا لمزامنة حالة React مع حدث — النمط يسبب
   * تصييرًا متتاليًا ويخفي سبب التحميل الحقيقي.
   */
  const openAndLoad = useCallback(async () => {
    setOpen(true)
    if (items !== null) return
    setLoading(true)
    try {
      setItems(await fetchNotificationsAction())
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [items])

  // الإغلاق بالنقر خارج اللوحة أو بمفتاح Escape
  useEffect(() => {
    if (!open) return

    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function markAll() {
    if (!items?.length) return
    await markNotificationsReadAction(items.map((i) => i.id))
    setItems([])
  }

  const count = items?.length ?? 0

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => (open ? setOpen(false) : void openAndLoad())}
        aria-expanded={open}
        aria-label={
          count > 0 ? `الإشعارات — ${count} غير مقروء` : 'الإشعارات'
        }
      >
        <Bell className="size-5" aria-hidden />
        {count > 0 && (
          <span className="absolute -top-0.5 -end-0.5 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white tabular">
            {formatNumber(Math.min(count, 99))}
          </span>
        )}
      </Button>

      {open && (
        <div
          className={cn(
            'absolute end-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)]',
            'rounded-[var(--radius-lg)] border border-border bg-surface shadow-lg',
            'rise',
          )}
          role="dialog"
          aria-label="الإشعارات"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border p-3">
            <span className="text-sm font-semibold">الإشعارات</span>
            {count > 0 && (
              <Button variant="ghost" size="sm" onClick={markAll}>
                <Check className="size-3.5" aria-hidden />
                تعليم الكل كمقروء
              </Button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <p className="p-4 text-sm text-muted-foreground">جارٍ التحميل…</p>
            ) : count === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                لا إشعارات غير مقروءة.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {items!.map((n) => {
                  const content = (
                    <>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium">{n.title}</span>
                        <time
                          dateTime={n.createdAt}
                          className="shrink-0 text-[11px] text-muted-foreground"
                        >
                          {formatRelative(n.createdAt)}
                        </time>
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {n.body}
                      </p>
                    </>
                  )

                  return (
                    <li key={n.id}>
                      {n.linkPath ? (
                        <Link
                          href={n.linkPath}
                          onClick={() => setOpen(false)}
                          className="block p-3 transition-colors hover:bg-surface-muted"
                        >
                          {content}
                        </Link>
                      ) : (
                        <div className="p-3">{content}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
