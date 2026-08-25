import type { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // المسارات المحميّة لا تُفهرس
      disallow: [
        '/api/',
        '/dashboard',
        '/onboarding',
        '/branches',
        '/checklists',
        '/inspections',
        '/actions',
        '/employees',
        '/recipes',
        '/inventory',
        '/reports',
        '/settings',
        '/admin',
        '/login',
        '/register',
      ],
    },
    sitemap: `${BASE}/sitemap.xml`,
  }
}
