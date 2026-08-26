import { test as setup } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { login, stateFor, AUTH_DIR, SESSION_USERS } from './fixtures'

/**
 * يسجّل دخول الحسابات التي تحتاجها الاختبارات مرة واحدة ويحفظ جلساتها.
 *
 * السبب ليس السرعة: Better Auth يحدّ محاولات `/sign-in/email` في نافذة قصيرة،
 * وهو سلوك مقصود لا نعطّله من أجل الاختبار. لذلك ندخل مرة لكل حساب، ونتراجع
 * وننتظر عند الاصطدام بالحدّ بدل رفعه.
 */
setup('تهيئة جلسات الحسابات التجريبية', async ({ browser }) => {
  setup.setTimeout(300_000)
  mkdirSync(AUTH_DIR, { recursive: true })

  for (const user of SESSION_USERS) {
    let lastError: unknown = null

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const context = await browser.newContext()
      const page = await context.newPage()

      try {
        await login(page, user)
        await context.storageState({ path: stateFor(user) })
        await context.close()
        lastError = null
        break
      } catch (error) {
        lastError = error
        await context.close()
        // نافذة الحدّ قصيرة: انتظار متدرّج يكفي، ولا حاجة لتعطيل الحماية
        await new Promise((resolve) => setTimeout(resolve, attempt * 15_000))
      }
    }

    if (lastError) {
      throw new Error(
        `تعذّر تسجيل دخول ${user} بعد أربع محاولات: ${String(lastError)}`,
      )
    }

    await new Promise((resolve) => setTimeout(resolve, 5_000))
  }
})
