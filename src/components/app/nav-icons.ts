import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  ClipboardCheck,
  CircleCheck,
  Users,
  UserPlus,
  ChefHat,
  Boxes,
  ChartNoAxesColumn,
  Briefcase,
  Settings,
  type LucideIcon,
} from 'lucide-react'

/**
 * خريطة أيقونات التنقّل — مصدر واحد.
 *
 * كانت مكرّرة في ثلاثة ملفات (التخطيط، الهيكل، قائمة الأوامر)، فأي مسار جديد
 * كان يظهر بأيقونة احتياطية في اثنين منها. الملف عادي بلا 'use client' حتى
 * يستورده الخادم والعميل معًا.
 */
export const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  branches: Building2,
  checklists: ClipboardList,
  inspections: ClipboardCheck,
  actions: CircleCheck,
  employees: Users,
  recruitment: UserPlus,
  recipes: ChefHat,
  inventory: Boxes,
  reports: ChartNoAxesColumn,
  services: Briefcase,
  settings: Settings,
}

export const FALLBACK_ICON = LayoutDashboard
