import { defineConfig, devices } from '@playwright/test'

/**
 * اختبارات الطرف إلى الطرف.
 *
 * تعمل على بناء إنتاج لا خادم تطوير: ما نريد إثباته هو سلوك ما يُنشر فعلًا،
 * وبعض الحُرّاس (رؤوس الأمان، تتبّع الملفات) لا يظهر إلا في الإنتاج.
 *
 * المتصفح مثبّت في الصورة، ولا يُنزَّل: PLAYWRIGHT_BROWSERS_PATH يشير إليه.
 * الوكيل يُعطَّل صراحةً — الطلبات إلى localhost يجب ألا تمرّ عبره.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100)
const BASE_URL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/*.spec.ts', '**/auth.setup.ts', '**/cleanup.teardown.ts'],
  // الاختبارات تتشارك قاعدة بيانات واحدة، فالتوازي يخلق تداخلًا في البيانات
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: BASE_URL,
    locale: 'ar-SA',
    timezoneId: 'Asia/Riyadh',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'setup',
      testMatch: '**/auth.setup.ts',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath:
            process.env.E2E_CHROMIUM ?? '/opt/pw-browsers/chromium',
          args: ['--no-proxy-server', '--proxy-bypass-list=<-loopback>'],
          proxy: { server: 'direct://' },
        },
      },
    },
    {
      name: 'teardown',
      testMatch: '**/cleanup.teardown.ts',
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      teardown: 'teardown',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath:
            process.env.E2E_CHROMIUM ?? '/opt/pw-browsers/chromium',
          // ثلاثتها ضرورية: البيئة هنا تضبط وكيلًا صادرًا، وطلبات localhost
          // يجب ألا تمرّ به وإلا رجعت ERR_PROXY_CONNECTION_FAILED
          args: ['--no-proxy-server', '--proxy-bypass-list=<-loopback>'],
          proxy: { server: 'direct://' },
        },
      },
    },
  ],

  webServer: {
    command: `npx next start --port ${PORT}`,
    // Better Auth يتحقق من الأصل، فلو بقي BETTER_AUTH_URL على منفذ آخر رُفض
    // الدخول بصمت وظهر كمهلة انتظار. المنفذ هنا هو مصدر الحقيقة.
    env: {
      BETTER_AUTH_URL: BASE_URL,
      NEXT_PUBLIC_APP_URL: BASE_URL,
    },
    url: BASE_URL + '/login',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
