import 'dotenv/config'
import { test as teardown } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

/**
 * تنظيف ما أنشأته الاختبارات.
 *
 * كل تشغيل يفتح طلب خدمة وشاغرًا ومرشّحًا. بلا تنظيف تتراكم عبر التشغيلات
 * فتضخّم القوائم وتُبطئ الاختبارات وتُخفي البيانات التجريبية الأصلية.
 * المطابقة على النصوص التي تكتبها الاختبارات وحدها، فلا تمسّ بيانات الزرع.
 */
teardown('تنظيف بيانات الاختبارات', async () => {
  teardown.setTimeout(60_000)

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) return

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  })

  try {
    const orders = await prisma.serviceOrder.findMany({
      where: { requirements: { path: ['goal'], string_contains: 'زيارة البلدية' } },
      select: { id: true },
    })
    const orderIds = orders.map((order) => order.id)

    if (orderIds.length > 0) {
      await prisma.payment.deleteMany({
        where: { invoice: { serviceOrderId: { in: orderIds } } },
      })
      await prisma.invoice.deleteMany({
        where: { serviceOrderId: { in: orderIds } },
      })
      await prisma.serviceOrderEvent.deleteMany({
        where: { orderId: { in: orderIds } },
      })
      await prisma.serviceOrder.deleteMany({ where: { id: { in: orderIds } } })
    }

    const candidates = await prisma.candidate.findMany({
      where: { fullName: { contains: 'اختبار آلي' } },
      select: { id: true },
    })
    const candidateIds = candidates.map((candidate) => candidate.id)

    if (candidateIds.length > 0) {
      await prisma.attachment.deleteMany({
        where: { candidateId: { in: candidateIds } },
      })
      await prisma.candidate.deleteMany({ where: { id: { in: candidateIds } } })
    }

    await prisma.recruitmentRequest.deleteMany({
      where: { position: { contains: 'اختبار آلي' } },
    })

    await prisma.notification.deleteMany({
      where: { type: 'SERVICE_ORDER_UPDATE' },
    })
  } finally {
    await prisma.$disconnect()
  }
})
