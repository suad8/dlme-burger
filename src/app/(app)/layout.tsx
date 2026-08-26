import Link from 'next/link'
import { requireTenant } from '@/server/tenant'
import { can, ROLE_LABELS, type Permission } from '@/server/rbac'
import { AppShell, type NavItem } from '@/components/app/app-shell'

const NAV: { href: string; label: string; icon: string; permission: Permission }[] = [
  { href: '/dashboard', label: 'لوحة التحكم', icon: 'dashboard', permission: 'report:view' },
  { href: '/branches', label: 'الفروع', icon: 'branches', permission: 'branch:view' },
  { href: '/checklists', label: 'قوائم الفحص', icon: 'checklists', permission: 'checklist:view' },
  { href: '/inspections', label: 'الزيارات', icon: 'inspections', permission: 'inspection:view' },
  { href: '/actions', label: 'الإجراءات التصحيحية', icon: 'actions', permission: 'action:view' },
  { href: '/employees', label: 'الموظفون', icon: 'employees', permission: 'employee:view' },
  { href: '/recruitment', label: 'التوظيف', icon: 'recruitment', permission: 'recruitment:view' },
  { href: '/recipes', label: 'الوصفات والتكاليف', icon: 'recipes', permission: 'recipe:view' },
  { href: '/inventory', label: 'المخزون والهدر', icon: 'inventory', permission: 'inventory:view' },
  { href: '/reports', label: 'التقارير', icon: 'reports', permission: 'report:view' },
  { href: '/service-orders', label: 'الخدمات', icon: 'services', permission: 'service:view' },
  { href: '/settings', label: 'الإعدادات', icon: 'settings', permission: 'org:view' },
]

export { NAV_ICONS as ICONS } from '@/components/app/nav-icons'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const ctx = await requireTenant()

  // التصفية هنا تحسين تجربة فقط — كل صفحة تفرض صلاحيتها على الخادم مستقلة
  const items: NavItem[] = NAV.filter((n) => can(ctx, n.permission)).map(
    ({ href, label, icon }) => ({ href, label, icon }),
  )

  return (
    <AppShell
      items={items}
      organizationName={ctx.organizationName}
      userName={ctx.userName}
      roleLabel={ROLE_LABELS[ctx.role]}
      scopedBranchCount={ctx.branchScope?.length ?? null}
    >
      {children}
    </AppShell>
  )
}

export { Link }
