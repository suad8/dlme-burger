import { describe, it, expect } from 'vitest'
import {
  authorize,
  can,
  allPermissions,
  DEFAULT_ROLE_PERMISSIONS,
  ForbiddenError,
  BRANCH_SCOPED_ROLES,
  type Permission,
} from '@/server/rbac'

function ctx(perms: Permission[]) {
  return { permissions: new Set<string>(perms) }
}

describe('نموذج الصلاحيات', () => {
  it('يولّد كل تركيبات المورد/الفعل دون تكرار', () => {
    const all = allPermissions()
    expect(all.length).toBe(new Set(all).size)
    expect(all).toContain('inspection:approve')
    expect(all).toContain('billing:manage')
  })

  it('كل صلاحية بصيغة resource:action', () => {
    for (const p of allPermissions()) {
      expect(p).toMatch(/^[a-z]+:[a-z]+$/)
    }
  })
})

describe('authorize()', () => {
  it('يسمح عند توفّر الصلاحية', () => {
    expect(() => authorize(ctx(['branch:view']), 'branch:view')).not.toThrow()
  })

  it('يرمي ForbiddenError عند غيابها', () => {
    expect(() => authorize(ctx(['branch:view']), 'branch:delete')).toThrow(
      ForbiddenError,
    )
  })

  it('لا يمنح صلاحية أوسع من مورد مشابه', () => {
    // امتلاك view لا يعني امتلاك update
    expect(() => authorize(ctx(['inspection:view']), 'inspection:update')).toThrow()
  })

  it('can() لا يرمي ويعيد قيمة منطقية', () => {
    expect(can(ctx(['task:view']), 'task:view')).toBe(true)
    expect(can(ctx(['task:view']), 'task:delete')).toBe(false)
  })
})

describe('أدوار النظام', () => {
  it('الأدوار العشرة معرّفة كلها', () => {
    expect(Object.keys(DEFAULT_ROLE_PERMISSIONS)).toHaveLength(10)
  })

  it('SUPER_ADMIN يملك كل الصلاحيات', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN.length).toBe(
      allPermissions().length,
    )
  })

  it('VIEWER لا يملك أي صلاحية كتابة', () => {
    for (const p of DEFAULT_ROLE_PERMISSIONS.VIEWER) {
      expect(p.endsWith(':view')).toBe(true)
    }
  })

  it('VIEWER لا يستطيع التصدير ولا الاعتماد ولا الحذف', () => {
    const viewer = ctx(DEFAULT_ROLE_PERMISSIONS.VIEWER)
    expect(can(viewer, 'report:export')).toBe(false)
    expect(can(viewer, 'inspection:approve')).toBe(false)
    expect(can(viewer, 'branch:delete')).toBe(false)
  })

  it('STAFF لا يعتمد ولا يدير مستخدمين ولا فواتير', () => {
    const staff = ctx(DEFAULT_ROLE_PERMISSIONS.STAFF)
    expect(can(staff, 'inspection:approve')).toBe(false)
    expect(can(staff, 'user:manage')).toBe(false)
    expect(can(staff, 'billing:manage')).toBe(false)
    // لكنه ينفّذ الفحص ويسجّل الهدر
    expect(can(staff, 'inspection:create')).toBe(true)
    expect(can(staff, 'waste:create')).toBe(true)
  })

  it('المحاسب يدير الفوترة ولا يعدّل التشغيل', () => {
    const acc = ctx(DEFAULT_ROLE_PERMISSIONS.ACCOUNTANT)
    expect(can(acc, 'billing:manage')).toBe(true)
    expect(can(acc, 'branch:update')).toBe(false)
    expect(can(acc, 'inspection:create')).toBe(false)
  })

  it('مراقب الجودة يعتمد الفحوصات ولا يمس الفوترة', () => {
    const q = ctx(DEFAULT_ROLE_PERMISSIONS.QUALITY_INSPECTOR)
    expect(can(q, 'inspection:approve')).toBe(true)
    expect(can(q, 'action:approve')).toBe(true)
    expect(can(q, 'billing:view')).toBe(false)
  })

  it('صلاحيات الأدوار تتصاعد: موظف ⊂ مدير فرع ⊂ مدير منطقة ⊂ مدير تشغيل', () => {
    const chain = [
      DEFAULT_ROLE_PERMISSIONS.STAFF,
      DEFAULT_ROLE_PERMISSIONS.BRANCH_MANAGER,
      DEFAULT_ROLE_PERMISSIONS.AREA_MANAGER,
      DEFAULT_ROLE_PERMISSIONS.OPERATIONS_MANAGER,
    ]
    for (let i = 0; i < chain.length - 1; i += 1) {
      const lower = new Set(chain[i]!)
      const upper = new Set(chain[i + 1]!)
      for (const p of lower) {
        expect(upper.has(p)).toBe(true)
      }
    }
  })

  it('المالك يملك كل ما يملكه المدير العام وزيادة', () => {
    const gm = new Set(DEFAULT_ROLE_PERMISSIONS.GENERAL_MANAGER)
    const owner = new Set(DEFAULT_ROLE_PERMISSIONS.OWNER)
    for (const p of gm) expect(owner.has(p)).toBe(true)
    expect(owner.size).toBeGreaterThan(gm.size)
  })

  it('الأدوار المقيّدة بفروع محددة معرّفة', () => {
    expect(BRANCH_SCOPED_ROLES.has('BRANCH_MANAGER')).toBe(true)
    expect(BRANCH_SCOPED_ROLES.has('OWNER')).toBe(false)
  })
})
