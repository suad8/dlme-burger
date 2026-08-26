import {
  test,
  expect,
  login,
  stateFor,
  waitForHydration,
  USERS,
  DEMO_PASSWORD,
} from './fixtures'

test.describe('الدخول والتسجيل', () => {
  test('كلمة المرور لا تصل إلى الـURL حتى قبل ترطيب React', async ({ browser }) => {
    // نحجب سكربتات Next كليًا: هكذا نحاكي ضغط المستخدم على شبكة بطيئة.
    // بلا method="post" يُرسل المتصفح GET فتظهر كلمة المرور في شريط العنوان.
    for (const path of ['/login', '/register']) {
      const context = await browser.newContext()
      await context.route('**/_next/static/**', (route) => route.abort())
      const page = await context.newPage()

      await page.goto(path, { waitUntil: 'domcontentloaded' })
      await page.fill('#email', USERS.viewer)
      await page.fill('#password', DEMO_PASSWORD)
      await page.evaluate(() => document.querySelector('form')!.submit())
      await page.waitForTimeout(2000)

      const url = page.url()
      expect(url, `${path} سرّب بيانات الدخول`).not.toContain('password')
      expect(url).not.toContain(encodeURIComponent(DEMO_PASSWORD))

      await context.close()
    }
  })

  test('كل نموذج فيه كلمة مرور يفتح بـ method=post', async ({ page }) => {
    for (const path of ['/login', '/register']) {
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      const method = await page.locator('form').first().getAttribute('method')
      expect(method?.toLowerCase(), path).toBe('post')
    }
  })

  test('بيانات خاطئة لا تكشف إن كان البريد مسجّلًا', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await waitForHydration(page)

    await page.fill('#email', 'ghost@nowhere.invalid')
    await page.fill('#password', 'WrongPassword#12345')
    await page.click('button[type=submit]')
    await page.waitForTimeout(2500)

    const body = await page.textContent('body')
    expect(body).not.toContain('غير مسجّل')
    expect(body).not.toContain('لا يوجد حساب')
    expect(page.url()).toContain('/login')
  })

  test('الصفحات المحمية تعيد التوجيه إلى الدخول', async ({ page }) => {
    for (const path of ['/dashboard', '/settings/billing', '/recruitment']) {
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      expect(page.url(), path).toContain('/login')
    }
  })

  test('الدخول ينجح ويصل إلى لوحة التحكم', async ({ page }) => {
    await login(page, 'owner')
    await expect(page.locator('h1').first()).toBeVisible()
  })
})

test.describe('رؤوس الأمان', () => {
  test.use({ storageState: stateFor('owner') })

  test('الرؤوس الواقية موجودة على كل رد', async ({ request }) => {
    const response = await request.get('/login')
    const headers = response.headers()

    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['x-powered-by']).toBeUndefined()
  })

  test('صفحات التطبيق لا تُفهرَس', async ({ page }) => {
    await page.goto('/settings/billing', { waitUntil: 'domcontentloaded' })
    const robots = await page.locator('meta[name=robots]').getAttribute('content')
    expect(robots).toContain('noindex')
  })
})
