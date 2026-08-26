import { test, expect, stateFor } from './fixtures'

test.describe('التنقّل', () => {
  test.use({ storageState: stateFor('owner') })

  test('كل مسار في القائمة له أيقونة مميّزة', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)

    const signatures = await page
      .locator('aside a svg, nav a svg')
      .evaluateAll((elements) =>
        elements.map((element) => ({
          label: element.parentElement?.textContent?.trim().slice(0, 24) ?? '',
          shape: Array.from(
            element.querySelectorAll('path,circle,rect,line,polyline'),
          )
            .map((node) => node.getAttribute('d') ?? node.outerHTML.slice(0, 40))
            .join('|'),
        })),
      )

    // نفس التسمية تظهر في قائمة سطح المكتب وفي شريط الجوال
    const byLabel = new Map<string, string>()
    for (const item of signatures) {
      if (item.label) byLabel.set(item.label, item.shape)
    }
    expect(byLabel.size).toBeGreaterThan(8)

    const byShape = new Map<string, string>()
    for (const [label, shape] of byLabel) {
      const clash = byShape.get(shape)
      expect(clash, `«${label}» و«${clash}» بنفس الأيقونة`).toBeUndefined()
      byShape.set(shape, label)
    }
  })

  test('كل مسار في القائمة يفتح بلا خطأ', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })

    const hrefs = await page
      .locator('aside a[href^="/"]')
      .evaluateAll((elements) =>
        Array.from(
          new Set(
            elements.map((element) => element.getAttribute('href') ?? ''),
          ),
        ).filter(Boolean),
      )

    expect(hrefs.length).toBeGreaterThan(5)

    for (const href of hrefs) {
      const response = await page.goto(href, { waitUntil: 'domcontentloaded' })
      expect(response?.status(), href).toBeLessThan(400)
    }
  })

  test('الصفحة لا تتمدّد أفقيًا على الجوال', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    for (const path of ['/dashboard', '/inspections', '/reports']) {
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(500)

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      )
      // بضعة بكسلات مقبولة من تقريب المتصفح، والتمدّد الحقيقي أكبر بكثير
      expect(overflow, path).toBeLessThanOrEqual(2)
    }
  })
})
