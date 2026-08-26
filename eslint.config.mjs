import coreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const config = [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.next/**',
      'legacy/**',
      'prisma/migrations/**',
      'next-env.d.ts',
    ],
  },
  ...coreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // الأمان: استيراد Prisma خارج طبقة الخادم يلتف على فرض عزل المستأجر
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/server/db'],
              importNames: ['prisma'],
              message:
                'لا تستورد prisma مباشرة في مكوّنات الواجهة. استخدم دالة خدمة تستقبل TenantContext.',
            },
          ],
        },
      ],
    },
  },
  {
    // طبقة الخادم والاختبارات والزرع تستورد prisma بحكم عملها
    files: ['src/server/**', 'prisma/**', 'tests/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // اختبارات Playwright ليست React. تركيبة الـfixtures تسمّي معاملها `use`،
    // فتظنّه قاعدة الخطّافات استدعاءً لخطّاف React خارج مكوّن.
    files: ['tests/e2e/**', 'playwright.config.ts'],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },
]

export default config
