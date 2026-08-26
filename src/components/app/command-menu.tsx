'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  ClipboardCheck,
  CircleCheck,
  Users,
  ChefHat,
  Boxes,
  ChartNoAxesColumn,
  Settings,
  Plus,
  Search,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NavItem } from './app-shell'

/**
 * قائمة الأوامر — تنقّل سريع بلوحة المفاتيح.
 *
 * تعرض ما يستطيع المستخدم الوصول إليه فقط: البنود تأتي من نفس التصفية
 * المبنية على الصلاحيات في الغلاف. هذا تحسين تجربة لا ضابط أمني — كل صفحة
 * تفرض صلاحيتها على الخادم بمعزل عن هذه القائمة.
 */

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  branches: Building2,
  checklists: ClipboardList,
  inspections: ClipboardCheck,
  actions: CircleCheck,
  employees: Users,
  recipes: ChefHat,
  inventory: Boxes,
  reports: ChartNoAxesColumn,
  settings: Settings,
}

interface QuickAction {
  href: string
  label: string
  /** يظهر فقط إن كان المسار الأصل متاحًا للمستخدم. */
  requires: string
}

const QUICK_ACTIONS: QuickAction[] = [
  { href: '/inspections/new', label: 'ابدأ فحصًا جديدًا', requires: 'inspections' },
  { href: '/actions/new', label: 'أنشئ إجراءً تصحيحيًا', requires: 'actions' },
  { href: '/branches/new', label: 'أضف فرعًا', requires: 'branches' },
  { href: '/checklists/new', label: 'أنشئ قالب فحص', requires: 'checklists' },
]

export function CommandMenu({ items }: { items: NavItem[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ctrl/⌘ + K — الاصطلاح المتوقّع
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function go(href: string) {
    setOpen(false)
    router.push(href)
  }

  const available = new Set(items.map((i) => i.icon))
  const quick = QUICK_ACTIONS.filter((a) => available.has(a.requires))

  return (
    <>
      {/* الزر المرئي — القائمة لا تُكتشف بالاختصار وحده */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground [transition:background-color_var(--dur-fast)_var(--ease-smooth)] hover:bg-surface-muted sm:flex"
        aria-label="بحث وتنقل سريع"
      >
        <Search className="size-3.5" aria-hidden />
        <span>بحث…</span>
        <kbd className="latin rounded border border-border bg-surface-muted px-1.5 py-0.5 text-[10px]">
          ⌘K
        </kbd>
      </button>

      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="قائمة الأوامر"
        dir="rtl"
        className="fixed inset-0 z-[60]"
      >
        <div
          className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden
        />

        <div className="rise absolute inset-x-4 top-[12vh] mx-auto max-w-lg overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <Command.Input
              placeholder="اكتب للبحث عن صفحة أو إجراء…"
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
              لا نتائج مطابقة.
            </Command.Empty>

            {quick.length > 0 && (
              <Command.Group
                heading="إجراءات سريعة"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {quick.map((a) => (
                  <Command.Item
                    key={a.href}
                    value={a.label}
                    onSelect={() => go(a.href)}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] px-2 py-2.5 text-sm',
                      'data-[selected=true]:bg-primary-soft data-[selected=true]:text-primary',
                    )}
                  >
                    <Plus className="size-4 shrink-0" aria-hidden />
                    {a.label}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            <Command.Group
              heading="التنقل"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {items.map((item) => {
                const Icon = ICONS[item.icon] ?? LayoutDashboard
                return (
                  <Command.Item
                    key={item.href}
                    value={item.label}
                    onSelect={() => go(item.href)}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] px-2 py-2.5 text-sm',
                      'data-[selected=true]:bg-primary-soft data-[selected=true]:text-primary',
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {item.label}
                  </Command.Item>
                )
              })}
            </Command.Group>
          </Command.List>
        </div>
      </Command.Dialog>
    </>
  )
}
