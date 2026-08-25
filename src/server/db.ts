import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

/**
 * عميل Prisma وحيد لكل عملية.
 *
 * في التطوير يعيد Next.js تحميل الوحدات عند كل تعديل، ما ينشئ عملاء جددًا
 * ويستنزف تجمّع الاتصالات. نحتفظ بالعميل على globalThis لتفادي ذلك.
 */

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    'DATABASE_URL غير معرّف. انسخ .env.example إلى .env وعبّئ القيم.',
  )
}

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
