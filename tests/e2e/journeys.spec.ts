import { test, expect, stateFor, waitForHydration } from './fixtures'

/** PNG صالح ١×١ — نرفعه ببايتاته لا بامتداده. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

test.describe('رحلة طلب الخدمة', () => {
  test.use({ storageState: stateFor('owner') })

  test('من الإرسال إلى عرض السعر، بلا تحصيل يُدّعى', async ({ page, browser }) => {
    await page.goto('/service-orders', { waitUntil: 'domcontentloaded' })

    const orderLink = page.locator('a[href^="/service-orders/new/"]').first()
    await expect(orderLink).toBeVisible()
    await orderLink.click()
    await page.waitForURL('**/service-orders/new/**')
    await waitForHydration(page)

    // الحقل المطلوب يُفرض على الخادم لا في المتصفح فقط
    await page.evaluate(() => {
      document
        .querySelectorAll('[required]')
        .forEach((element) => element.removeAttribute('required'))
    })
    await page.click('button[type=submit]')
    await page.waitForTimeout(1500)
    expect(page.url(), 'قُبل الطلب بلا الحقل المطلوب').toContain('/new/')

    await page
      .locator('textarea, input[type=number]')
      .first()
      .fill('رفع درجة الالتزام قبل زيارة البلدية')
    await page.click('button[type=submit]')
    await page.waitForURL(/\/service-orders\/[a-z0-9]+$/)
    const orderUrl = page.url()

    // الحالة تظهر في الشارة وفي المسار معًا، فنقصد الشارة تحديدًا
    await expect(page.locator('span', { hasText: 'قيد المراجعة' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /اعتمد وادفع/ })).toHaveCount(0)

    // مزوّد المنصّة يسعّر
    const adminContext = await browser.newContext({
      storageState: stateFor('superAdmin'),
    })
    const admin = await adminContext.newPage()
    await admin.goto('/admin', { waitUntil: 'domcontentloaded' })
    await admin.locator('button:has-text("سعّر الطلب")').first().click()
    await admin.locator('input[type=number]').first().fill('4500')
    await admin.locator('textarea').first().fill('يشمل زيارتين ميدانيتين.')
    await admin.locator('button[type=submit]:has-text("أرسل العرض")').first().click()
    await admin.waitForTimeout(2500)
    await adminContext.close()

    // المنشأة ترى العرض وتعتمده
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByText('عرض السعر').first()).toBeVisible()
    await page.getByRole('button', { name: /اعتمد وادفع/ }).click()
    await page.waitForTimeout(3000)

    // بلا بوابة: لا ادّعاء بالتحصيل، والحالة لا تتقدّم
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(
      page.locator('span', { hasText: 'بانتظار موافقتك' }).first(),
    ).toBeVisible()
    expect(await page.content()).toContain('INV-')

    // منشأة أخرى لا ترى الطلب أصلًا
    const otherContext = await browser.newContext({
      storageState: stateFor('otherOwner'),
    })
    const other = await otherContext.newPage()
    const response = await other.goto(orderUrl, { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(404)
    await otherContext.close()
  })
})

test.describe('رحلة التوظيف', () => {
  test.use({ storageState: stateFor('owner') })

  test('شاغر ومرشّح وسيرة ذاتية، مع رفض الملف المزيّف', async ({ page, browser }) => {
    await page.goto('/recruitment', { waitUntil: 'domcontentloaded' })

    await page.click('button:has-text("طلب توظيف جديد")')
    await waitForHydration(page)
    await page.fill('#rec-position', 'شيف تنفيذي — اختبار آلي')
    await page.fill('#rec-quantity', '2')
    await page.fill('#rec-min', '9000')
    await page.fill('#rec-max', '14000')
    await page.click('button[type=submit]:has-text("افتح الطلب")')
    await page.waitForURL(/\/recruitment\/[a-z0-9]+$/)
    const requestUrl = page.url()

    await page.click('button:has-text("أضف مرشّحًا")')
    await waitForHydration(page)
    await page.fill('#cand-name', 'مرشّح اختبار آلي')
    await page.fill('#cand-email', 'AUTO@Example.SA')
    await page.click('button[type=submit]:has-text("أضف")')
    await page.waitForTimeout(2000)

    // البريد يُطبَّع على الخادم
    expect(await page.content()).toContain('auto@example.sa')

    await page.setInputFiles('input[type=file]', {
      name: 'cv.png',
      mimeType: 'image/png',
      buffer: PNG,
    })
    await page.waitForTimeout(2500)
    await expect(page.getByRole('button', { name: /استبدل السيرة/ })).toBeVisible()

    // نفس البايتات باسم ونوع PDF — يُرفض بفحص المحتوى
    await page.setInputFiles('input[type=file]', {
      name: 'fake.pdf',
      mimeType: 'application/pdf',
      buffer: PNG,
    })
    await page.waitForTimeout(2500)
    const toast = await page
      .locator('[data-sonner-toast]')
      .last()
      .textContent()
      .catch(() => '')
    expect(toast ?? '').toContain('لا يطابق')

    // منشأة أخرى: ٤٠٤
    const otherContext = await browser.newContext({
      storageState: stateFor('otherOwner'),
    })
    const other = await otherContext.newPage()
    const response = await other.goto(requestUrl, { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(404)
    await otherContext.close()
  })
})

test.describe('التقارير', () => {
  test.use({ storageState: stateFor('owner') })

  test('المالك يُنزّل CSV والمُطّلع يُمنع', async ({ page, browser }) => {
    await page.goto('/reports', { waitUntil: 'domcontentloaded' })

    const exportLink = page.locator('a[href^="/api/reports/"]').first()
    await expect(exportLink).toBeVisible()
    const href = await exportLink.getAttribute('href')

    // ننزّل الملف كما ينزّله المستخدم: نقرة ثم حدث تنزيل. الطلب المباشر عبر
    // سياق مستقل لا يحمل جلسة المتصفح فيُردّ 401.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportLink.click(),
    ])

    expect(download.suggestedFilename()).toMatch(/\.csv$/)

    const path = await download.path()
    expect(path).toBeTruthy()

    const { readFileSync } = await import('node:fs')
    const body = readFileSync(path!, 'utf8')

    // BOM حتى يقرأ Excel العربية
    expect(body.charCodeAt(0)).toBe(0xfeff)
    expect(body.length).toBeGreaterThan(10)

    // المُطّلع لا يملك report:export — يُردّ 403 لا صفحة فارغة
    const viewerContext = await browser.newContext({
      storageState: stateFor('viewer'),
    })
    const viewer = await viewerContext.newPage()
    const denied = await viewer.goto(href!, { waitUntil: 'domcontentloaded' })
    expect(denied?.status()).toBe(403)
    await viewerContext.close()
  })
})

test.describe('نسخة التقرير للطباعة', () => {
  test.use({ storageState: stateFor('owner') })

  test('ورقة كاملة بترويسة المنشأة، وهيكل التطبيق لا يُطبع', async ({
    page,
    browser,
  }) => {
    await page.goto('/reports', { waitUntil: 'domcontentloaded' })

    const printLink = page.locator('a[href^="/reports/print"]').first()
    await expect(printLink).toBeVisible()
    await printLink.click()
    await page.waitForURL('**/reports/print**')
    await page.waitForTimeout(600)

    await page.emulateMedia({ media: 'print' })

    // ترويسة المنشأة جزء من الورقة ويجب أن تبقى ظاهرة عند الطباعة. قاعدة
    // تخفي كل <header> كانت تبتلعها، فتخرج الورقة بلا اسم المنشأة.
    const sheetHeader = page.locator('.print-sheet header').first()
    await expect(sheetHeader).toBeVisible()

    const visibility = await page.evaluate(() => {
      const display = (element: Element | null) =>
        element ? getComputedStyle(element).display : 'missing'
      return {
        appSidebar: display(document.querySelector('aside:not(.print-sheet *)')),
        appHeader: display(document.querySelector('header:not(.print-sheet *)')),
        printButton: display(document.querySelector('.print\\:hidden')),
      }
    })

    expect(visibility.appSidebar).not.toBe('block')
    expect(visibility.appHeader).not.toBe('block')
    expect(visibility.printButton).not.toBe('block')

    // PDF حقيقي: خطوط مضمّنة ونص مرسوم، لا صورة صفحة
    const pdf = await page.pdf({ format: 'A4', printBackground: true })
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pdf.length).toBeGreaterThan(5_000)

    const latin = pdf.toString('latin1')
    expect(latin, 'الخط غير مضمّن').toMatch(/\/FontFile/)
    expect(latin, 'الصفحة صورة لا نص').not.toMatch(/\/Subtype\s*\/Image/)

    // المُطّلع لا يملك report:export فلا نسخة طباعة له
    const viewerContext = await browser.newContext({
      storageState: stateFor('viewer'),
    })
    const viewer = await viewerContext.newPage()
    await viewer.goto('/reports/print?report=branch-performance&period=30', {
      waitUntil: 'domcontentloaded',
    })
    // شاشة رفض واضحة لا صفحة خطأ ٥٠٠
    await expect(viewer.getByText('لا تملك صلاحية الوصول')).toBeVisible()
    expect(await viewer.content()).not.toContain('أُصدر في')
    await viewerContext.close()
  })
})
