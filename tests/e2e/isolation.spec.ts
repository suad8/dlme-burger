import { test, expect, stateFor } from './fixtures'

/**
 * العزل والصلاحيات في المتصفح.
 *
 * الاختبارات في tests/tenant-isolation تثبت العزل على مستوى الخدمات. هذه
 * تثبته على مستوى الطلب HTTP: ما يصل فعلًا إلى المتصفح، بالجلسة والرؤوس
 * وإعادة التوجيه، لا باستدعاء دالة مباشرة.
 */

test.describe('حدود الصلاحيات — المُطّلع', () => {
  test.use({ storageState: stateFor('viewer') })

  test('يُمنع من الصفحات التي لا يملكها', async ({ page }) => {
    for (const path of ['/settings/billing', '/inspections/new', '/checklists/new']) {
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      await expect(
        page.getByText('لا تملك صلاحية الوصول'),
        path,
      ).toBeVisible()
    }
  })

  test('لا تصله بيانات الفوترة في مصدر الصفحة', async ({ page }) => {
    await page.goto('/settings/billing', { waitUntil: 'domcontentloaded' })

    // الإخفاء في الخادم لا في CSS: النصوص غير موجودة في HTML أصلًا
    const html = await page.content()
    for (const leak of ['الفواتير', 'الاستهلاك مقابل حدود الباقة', 'تغيير الباقة']) {
      expect(html, leak).not.toContain(leak)
    }
  })

})

test.describe('حدود الصلاحيات — المالك', () => {
  test.use({ storageState: stateFor('owner') })

  test('يصل إلى الفوترة', async ({ page }) => {
    await page.goto('/settings/billing', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('الاشتراك الحالي')).toBeVisible()
  })

  test('لوحة النظام تعطيه 404 لا 403', async ({ page }) => {
    const response = await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(404)
  })
})

test.describe('حدود الصلاحيات — مدير النظام', () => {
  test.use({ storageState: stateFor('superAdmin') })

  test('يصل إلى لوحة النظام', async ({ page }) => {
    const response = await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(200)
  })
})

test.describe('عزل المستأجرين عبر HTTP', () => {
  test.use({ storageState: stateFor('owner') })

  test('معرّف من منشأة أخرى يعطي 404 لا 403', async ({ page, browser }) => {
    // نلتقط معرّف زيارة من المنشأة الأولى
    await page.goto('/inspections', { waitUntil: 'domcontentloaded' })
    // نستبعد /inspections/new: مسار إنشاء لا سجل، ويردّ 200 لأي منشأة
    const link = page
      .locator('a[href^="/inspections/"]:not([href$="/new"])')
      .first()
    await expect(link).toBeVisible()
    const href = await link.getAttribute('href')
    expect(href).toBeTruthy()

    // ثم نفتحه بحساب المنشأة الأخرى
    const context = await browser.newContext({
      storageState: stateFor('otherOwner'),
    })
    const other = await context.newPage()
    const response = await other.goto(href!, { waitUntil: 'domcontentloaded' })

    // 404 لا 403: الرد بالمنع يكشف أن السجل موجود لدى غيرنا
    expect(response?.status()).toBe(404)
    await context.close()
  })

  test('مسار غير موجود يعرض صفحة 404 المخصّصة', async ({ page }) => {
    const response = await page.goto('/inspections/does-not-exist-abc123', {
      waitUntil: 'domcontentloaded',
    })
    expect(response?.status()).toBe(404)
    await expect(page.getByText('الصفحة غير موجودة')).toBeVisible()
  })
})

test.describe('حُرّاس مسارات الـAPI', () => {
  test('تقديم الملفات يرفض بلا جلسة', async ({ request }) => {
    const response = await request.get('/api/files?key=x&expires=1&sig=y')
    expect(response.status()).toBe(401)
  })

  test('webhook الدفع يرفض بلا مزوّد مضبوط', async ({ request }) => {
    const response = await request.post('/api/billing/webhook', {
      data: '{"type":"invoice_paid"}',
      headers: { 'content-type': 'application/json' },
    })
    // 503 بلا مزوّد، أو 400 لو ضُبط ورُفض التوقيع. أبدًا 200.
    expect([400, 503]).toContain(response.status())
  })
})
