import { test as base, expect, type Page } from '@playwright/test'
import { join } from 'node:path'

/** مجلد جلسات الاختبار — يُنشأ في التهيئة ويُتجاهل في git. */
export const AUTH_DIR = join(process.cwd(), 'tests', '.auth')

export function stateFor(user: DemoUser): string {
  return join(AUTH_DIR, `${user}.json`)
}

/**
 * بيانات الحسابات التجريبية المزروعة. كلمة المرور موحّدة للتطوير المحلي فقط،
 * وهذا مذكور صراحةً في الزرع.
 */
export const DEMO_PASSWORD = 'Itqan#Demo2026'

export const USERS = {
  owner: 'owner@demo.itqan.sa',
  generalManager: 'gm@demo.itqan.sa',
  branchManager: 'branch@demo.itqan.sa',
  quality: 'quality@demo.itqan.sa',
  accountant: 'accountant@demo.itqan.sa',
  viewer: 'viewer@demo.itqan.sa',
  otherOwner: 'owner@rukn.itqan.sa',
  superAdmin: 'admin@itqan.sa',
} as const

export type DemoUser = keyof typeof USERS

/**
 * الحسابات التي تُحفَظ جلساتها في التهيئة. نقتصر على ما تستعمله الاختبارات
 * فعلًا: كل حساب إضافي يعني محاولة دخول أخرى تصطدم بحدّ المعدّل بلا فائدة.
 */
export const SESSION_USERS: DemoUser[] = [
  'owner',
  'viewer',
  'superAdmin',
  'otherOwner',
]

/**
 * ينتظر ترطيب React قبل أي ضغط.
 *
 * بدون هذا الانتظار كان الضغط المبكر يُرسل النموذج إرسالًا أصليًا، وهو ما
 * كشف تسريب كلمة المرور إلى الـURL. نبقيه صريحًا هنا لأن السباق حقيقي.
 */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const form = document.querySelector('form')
      return form
        ? Object.keys(form).some((key) => key.startsWith('__reactFiber'))
        : false
    },
    { timeout: 30_000 },
  )
}

export async function login(page: Page, user: DemoUser): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await waitForHydration(page)
  await page.fill('#email', USERS[user])
  await page.fill('#password', DEMO_PASSWORD)
  await page.click('button[type=submit]')
  await page.waitForURL('**/dashboard', { timeout: 30_000 })
}

/** يفشل الاختبار عند أي خطأ JavaScript في الصفحة، لا يمرّ بصمت. */
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: async ({ page }, use) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await use(errors)
    expect(errors, 'أخطاء JavaScript في الصفحة').toEqual([])
  },
})

export { expect }
