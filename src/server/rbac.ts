import { RoleKey } from '@prisma/client'

/**
 * نموذج الصلاحيات: `${resource}:${action}`
 *
 * التحقق يحدث على الخادم حصريًا. إخفاء زر في الواجهة تحسين تجربة، وليس
 * تفويضًا — أي عملية تمر عبر authorize() قبل لمس قاعدة البيانات.
 */

export const RESOURCES = [
  'org',
  'branch',
  'user',
  'checklist',
  'inspection',
  'action',
  'task',
  'employee',
  'recruitment',
  'recipe',
  'inventory',
  'waste',
  'service',
  'report',
  'billing',
  'admin',
] as const

export const ACTIONS = [
  'view',
  'create',
  'update',
  'delete',
  'approve',
  'export',
  'manage',
] as const

export type Resource = (typeof RESOURCES)[number]
export type Action = (typeof ACTIONS)[number]
export type Permission = `${Resource}:${Action}`

export function permission(resource: Resource, action: Action): Permission {
  return `${resource}:${action}`
}

/** كل التركيبات الممكنة — تُزرع في جدول Permission. */
export function allPermissions(): Permission[] {
  const out: Permission[] = []
  for (const r of RESOURCES) {
    for (const a of ACTIONS) {
      out.push(`${r}:${a}`)
    }
  }
  return out
}

const VIEW_ONLY: Permission[] = [
  'branch:view',
  'checklist:view',
  'inspection:view',
  'action:view',
  'task:view',
  'report:view',
]

const STAFF_PERMISSIONS: Permission[] = [
  ...VIEW_ONLY,
  'inspection:create',
  'inspection:update',
  'action:create',
  'action:update',
  'task:update',
  'waste:create',
]

const BRANCH_MANAGER_PERMISSIONS: Permission[] = [
  ...STAFF_PERMISSIONS,
  'branch:update',
  'employee:view',
  'employee:create',
  'employee:update',
  'inventory:view',
  'inventory:create',
  'inventory:update',
  'waste:view',
  'recipe:view',
  'task:create',
  'action:approve',
  'report:export',
  'service:view',
  'service:create',
]

const AREA_MANAGER_PERMISSIONS: Permission[] = [
  ...BRANCH_MANAGER_PERMISSIONS,
  'checklist:create',
  'checklist:update',
  'inspection:approve',
  'recruitment:view',
  'recruitment:create',
]

const OPERATIONS_MANAGER_PERMISSIONS: Permission[] = [
  ...AREA_MANAGER_PERMISSIONS,
  'branch:create',
  'checklist:delete',
  'recipe:create',
  'recipe:update',
  'recipe:delete',
  'inventory:delete',
  'employee:delete',
  'recruitment:update',
  'service:update',
  'user:view',
]

const GENERAL_MANAGER_PERMISSIONS: Permission[] = [
  ...OPERATIONS_MANAGER_PERMISSIONS,
  'branch:delete',
  'user:create',
  'user:update',
  'org:view',
  'org:update',
  'billing:view',
]

const ACCOUNTANT_PERMISSIONS: Permission[] = [
  ...VIEW_ONLY,
  'billing:view',
  'billing:manage',
  'recipe:view',
  'inventory:view',
  'waste:view',
  'report:export',
  'org:view',
]

const QUALITY_INSPECTOR_PERMISSIONS: Permission[] = [
  ...VIEW_ONLY,
  'inspection:create',
  'inspection:update',
  'inspection:approve',
  'action:create',
  'action:update',
  'action:approve',
  'checklist:view',
  'report:export',
]

const OWNER_PERMISSIONS: Permission[] = [
  ...GENERAL_MANAGER_PERMISSIONS,
  'user:delete',
  'user:manage',
  'billing:manage',
  'org:delete',
  'service:delete',
]

/**
 * الصلاحيات الافتراضية لكل دور. تُنسخ إلى جدول Role عند إنشاء المنشأة،
 * فتصبح قابلة للتخصيص لكل منشأة على حدة دون تعديل الكود.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, Permission[]> = {
  SUPER_ADMIN: [...allPermissions()],
  OWNER: dedupe(OWNER_PERMISSIONS),
  GENERAL_MANAGER: dedupe(GENERAL_MANAGER_PERMISSIONS),
  OPERATIONS_MANAGER: dedupe(OPERATIONS_MANAGER_PERMISSIONS),
  AREA_MANAGER: dedupe(AREA_MANAGER_PERMISSIONS),
  BRANCH_MANAGER: dedupe(BRANCH_MANAGER_PERMISSIONS),
  QUALITY_INSPECTOR: dedupe(QUALITY_INSPECTOR_PERMISSIONS),
  ACCOUNTANT: dedupe(ACCOUNTANT_PERMISSIONS),
  STAFF: dedupe(STAFF_PERMISSIONS),
  VIEWER: dedupe(VIEW_ONLY),
}

export const ROLE_LABELS: Record<RoleKey, string> = {
  SUPER_ADMIN: 'مدير النظام',
  OWNER: 'مالك المنشأة',
  GENERAL_MANAGER: 'مدير عام',
  OPERATIONS_MANAGER: 'مدير تشغيل',
  AREA_MANAGER: 'مدير منطقة',
  BRANCH_MANAGER: 'مدير فرع',
  QUALITY_INSPECTOR: 'مراقب جودة',
  ACCOUNTANT: 'محاسب',
  STAFF: 'موظف',
  VIEWER: 'اطّلاع فقط',
}

/** الأدوار المقيّدة بفروع محددة افتراضيًا. */
export const BRANCH_SCOPED_ROLES: ReadonlySet<RoleKey> = new Set<RoleKey>([
  RoleKey.BRANCH_MANAGER,
  RoleKey.AREA_MANAGER,
  RoleKey.STAFF,
])

function dedupe(list: Permission[]): Permission[] {
  return [...new Set(list)].sort()
}

export class ForbiddenError extends Error {
  override readonly name = 'ForbiddenError'
  constructor(public readonly permission: Permission) {
    super(`صلاحية مفقودة: ${permission}`)
  }
}

export interface AuthorizableContext {
  permissions: ReadonlySet<string>
}

/** يرمي ForbiddenError إن لم تتوفر الصلاحية. استخدمها قبل أي عملية. */
export function authorize(
  ctx: AuthorizableContext,
  required: Permission,
): void {
  if (!ctx.permissions.has(required)) {
    throw new ForbiddenError(required)
  }
}

/** فحص صامت — للواجهة فقط، لا يُعتمد عليه كضابط أمني. */
export function can(
  ctx: AuthorizableContext,
  required: Permission,
): boolean {
  return ctx.permissions.has(required)
}
