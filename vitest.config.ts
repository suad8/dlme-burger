import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    // اختبارات قاعدة البيانات تشترك في نفس البيانات — تشغيل متسلسل يمنع التداخل
    fileParallelism: false,
    testTimeout: 30_000,
    setupFiles: ['tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      // `server-only` حارس وقت البناء يرمي خارج بيئة الخادم. الاختبارات تعمل
      // في Node، فنستبدله بوحدة فارغة بدل تعطيل الحارس في كود المنتج.
      'server-only': path.resolve(import.meta.dirname, './tests/stubs/server-only.ts'),
    },
  },
})
