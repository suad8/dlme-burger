'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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
  Menu,
  X,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { signOut } from '@/lib/auth-client'
import { ThemeToggle } from '@/components/app/theme-toggle'

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

/** التنقل السفلي للجوال — أهم خمسة مسارات ميدانية. */
const MOBILE_PRIORITY = ['dashboard', 'inspections', 'actions', 'branches', 'reports']

export interface NavItem {
  href: string
  label: string
  icon: string
}

export function AppShell({
  items,
  organizationName,
  userName,
  roleLabel,
  scopedBranchCount,
  children,
}: {
  items: NavItem[]
  organizationName: string
  userName: string
  roleLabel: string
  scopedBranchCount: number | null
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const mobileItems = MOBILE_PRIORITY.map((icon) =>
    items.find((i) => i.icon === icon),
  ).filter((i): i is NavItem => Boolean(i))

  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  async function handleSignOut() {
    await signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex min-h-dvh bg-background">
      {/* ── الشريط الجانبي — سطح المكتب ──────────────────────── */}
      <aside
        className={cn(
          'hidden lg:flex flex-col border-e border-border bg-surface transition-[width] duration-200',
          collapsed ? 'w-[68px]' : 'w-64',
        )}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-border px-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-primary text-primary-foreground text-sm font-bold">
            إ
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">إتقان</div>
              <div className="truncate text-[11px] text-muted-foreground">
                {organizationName}
              </div>
            </div>
          )}
        </div>

        <nav aria-label="التنقل الرئيسي" className="flex-1 overflow-y-auto p-2">
          <ul className="space-y-0.5">
            {items.map((item) => {
              const Icon = ICONS[item.icon] ?? LayoutDashboard
              const active = isActive(item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'tap-target flex items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm',
                      '[transition:background-color_var(--dur-fast)_var(--ease-smooth),color_var(--dur-fast)_var(--ease-smooth)]',
                      collapsed && 'justify-center px-0',
                      active
                        ? 'bg-primary-soft text-primary font-semibold'
                        : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
                    )}
                  >
                    <Icon className="size-[18px] shrink-0" aria-hidden />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="tap-target flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
            aria-label={collapsed ? 'توسيع القائمة' : 'طيّ القائمة'}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[18px]" aria-hidden />
            ) : (
              <>
                <PanelLeftClose className="size-[18px]" aria-hidden />
                <span>طيّ القائمة</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* ── الدرج — الجوال ──────────────────────────────────── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setMobileOpen(false)}
            aria-label="إغلاق القائمة"
          />
          <div className="absolute inset-y-0 start-0 w-72 bg-surface shadow-lg flex flex-col">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] bg-primary text-primary-foreground text-sm font-bold">
                  إ
                </span>
                <span className="font-bold">إتقان</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                aria-label="إغلاق"
              >
                <X className="size-5" aria-hidden />
              </Button>
            </div>
            <nav aria-label="التنقل" className="flex-1 overflow-y-auto p-2">
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const Icon = ICONS[item.icon] ?? LayoutDashboard
                  const active = isActive(item.href)
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'tap-target flex items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm',
                          active
                            ? 'bg-primary-soft text-primary font-semibold'
                            : 'text-muted-foreground hover:bg-surface-muted',
                        )}
                      >
                        <Icon className="size-[18px]" aria-hidden />
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>
          </div>
        </div>
      )}

      {/* ── المحتوى ─────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-sm">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="فتح القائمة"
          >
            <Menu className="size-5" aria-hidden />
          </Button>

          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">
              {organizationName}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="truncate">{userName}</span>
              <span aria-hidden>·</span>
              <span className="truncate">{roleLabel}</span>
            </div>
          </div>

          {scopedBranchCount !== null && (
            <Badge tone="info" className="hidden sm:inline-flex">
              نطاقك: {scopedBranchCount} فرع
            </Badge>
          )}

          <ThemeToggle />

          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            aria-label="تسجيل الخروج"
          >
            <LogOut className="size-5" aria-hidden />
          </Button>
        </header>

        <main id="main" className="flex-1 p-4 pb-24 sm:p-6 lg:pb-6">
          {children}
        </main>

        {/* التنقل السفلي — نمط مخصّص للجوال لا تصغير لسطح المكتب */}
        <nav
          aria-label="التنقل السريع"
          className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-surface"
        >
          <ul className="grid grid-cols-5">
            {mobileItems.map((item) => {
              const Icon = ICONS[item.icon] ?? LayoutDashboard
              const active = isActive(item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 text-[10px]',
                      active ? 'text-primary font-semibold' : 'text-muted-foreground',
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                    <span className="truncate max-w-full">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </div>
  )
}
