import { describe, it, expect, afterAll, beforeEach } from 'vitest'
import { prisma, contextFor, contextWithRole, DEMO } from '../helpers/db'
import {
  listCatalog,
  createOrder,
  getOrder,
  listOrders,
  quoteOrder,
  approveAndPay,
  cancelOrder,
  markOrderPaid,
  advanceOrder,
  validateRequirements,
  parseRequirementsSchema,
  OrderNotFoundError,
  RequirementsError,
  InvalidTransitionError,
  StaleOrderError,
  type RequirementField,
} from '@/server/services/service-orders'
import { ForbiddenError } from '@/server/rbac'
import type { TenantContext } from '@/server/tenant'

const RETURN_URL = 'https://app.test.sa/services'

async function clean() {
  const orders = await prisma.serviceOrder.findMany({
    where: { reference: { startsWith: 'SR-' } },
    select: { id: true },
  })
  const ids = orders.map((o) => o.id)
  if (ids.length === 0) return

  await prisma.payment.deleteMany({
    where: { invoice: { serviceOrderId: { in: ids } } },
  })
  await prisma.invoice.deleteMany({ where: { serviceOrderId: { in: ids } } })
  await prisma.serviceOrderEvent.deleteMany({ where: { orderId: { in: ids } } })
  await prisma.notification.deleteMany({ where: { type: 'SERVICE_ORDER_UPDATE' } })
  await prisma.serviceOrder.deleteMany({ where: { id: { in: ids } } })
}

beforeEach(clean)

afterAll(async () => {
  await clean()
  await prisma.$disconnect()
})

/** مزوّد المنصّة: نفس السياق مع رفع isSuperAdmin. */
function asPlatform(ctx: TenantContext): TenantContext {
  return { ...ctx, isSuperAdmin: true }
}

async function firstSlug(): Promise<string> {
  const catalog = await listCatalog()
  expect(catalog.length).toBeGreaterThan(0)
  return catalog[0]!.slug
}

describe('التحقق من المتطلبات', () => {
  const schema: RequirementField[] = [
    { key: 'goal', label: 'الهدف', type: 'text', required: true },
    { key: 'count', label: 'العدد', type: 'number', required: false },
    {
      key: 'size',
      label: 'الحجم',
      type: 'select',
      required: false,
      options: ['صغير', 'كبير'],
    },
  ]

  it('يرفض غياب حقل مطلوب', () => {
    expect(() => validateRequirements(schema, {})).toThrow(RequirementsError)
  })

  it('يتجاهل المفاتيح خارج المخطط — لا تخزين حر', () => {
    const clean = validateRequirements(schema, {
      goal: 'رفع الالتزام',
      injected: 'قيمة لا يجب أن تُحفظ',
    })
    expect(clean).toEqual({ goal: 'رفع الالتزام' })
    expect('injected' in clean).toBe(false)
  })

  it('يرفض القيم خارج الخيارات', () => {
    expect(() =>
      validateRequirements(schema, { goal: 'x', size: 'ضخم' }),
    ).toThrow(RequirementsError)
  })

  it('يرفض النص غير الرقمي في حقل رقمي', () => {
    expect(() =>
      validateRequirements(schema, { goal: 'x', count: 'كثير' }),
    ).toThrow(RequirementsError)
  })

  it('يرفض النص الطويل جدًا', () => {
    expect(() =>
      validateRequirements(schema, { goal: 'ا'.repeat(2001) }),
    ).toThrow(RequirementsError)
  })

  it('يتجاهل المخطط التالف بدل أن يرمي', () => {
    expect(parseRequirementsSchema(null)).toEqual([])
    expect(parseRequirementsSchema([{ nope: 1 }, 'x'])).toEqual([])
  })
})

describe('رحلة الطلب — من الإرسال إلى التسليم', () => {
  it('تمرّ بكل الحالات بالترتيب ولا تقفز', async () => {
    const owner = await contextFor(DEMO.ownerA)
    const platform = asPlatform(owner)
    const slug = await firstSlug()

    const created = await createOrder(owner, {
      serviceSlug: slug,
      branchId: null,
      answers: { goal: 'رفع درجة الالتزام قبل زيارة البلدية' },
    })

    let order = await getOrder(owner, created.id)
    expect(order.status).toBe('SUBMITTED')

    // المنشأة لا تعتمد قبل التسعير
    await expect(
      approveAndPay(owner, { orderId: created.id, returnUrl: RETURN_URL }),
    ).rejects.toBeInstanceOf(InvalidTransitionError)

    // مزوّد المنصّة يسعّر
    await quoteOrder(platform, {
      orderId: created.id,
      price: 4500,
      note: 'يشمل زيارتين ميدانيتين.',
      version: order.version,
    })

    order = await getOrder(owner, created.id)
    expect(order.status).toBe('QUOTED')
    expect(order.quotedPrice).toBe(4500)

    // الاعتماد ينشئ فاتورة ولا ينقل الحالة قبل تأكيد الدفع
    const checkout = await approveAndPay(owner, {
      orderId: created.id,
      returnUrl: RETURN_URL,
    })
    expect(checkout.invoiceNumber).toMatch(/^INV-/)

    order = await getOrder(owner, created.id)
    expect(order.status).toBe('QUOTED')
    expect(order.invoice).not.toBeNull()
    // ٤٥٠٠ + ١٥٪ = ٥١٧٥
    expect(order.invoice!.total).toBe(5175)

    // تأكيد الدفع ينقلها إلى APPROVED
    await markOrderPaid(created.id, new Date())
    order = await getOrder(owner, created.id)
    expect(order.status).toBe('APPROVED')

    // لا يمكن القفز إلى التسليم
    await expect(
      advanceOrder(platform, { orderId: created.id, to: 'DELIVERED', note: null }),
    ).rejects.toBeInstanceOf(InvalidTransitionError)

    await advanceOrder(platform, {
      orderId: created.id,
      to: 'IN_PROGRESS',
      note: null,
    })
    await advanceOrder(platform, {
      orderId: created.id,
      to: 'DELIVERED',
      note: 'سُلّم التقرير.',
    })

    order = await getOrder(owner, created.id)
    expect(order.status).toBe('DELIVERED')
    expect(order.events.map((e) => e.status)).toEqual([
      'SUBMITTED',
      'QUOTED',
      'APPROVED',
      'IN_PROGRESS',
      'DELIVERED',
    ])
  })

  it('دفع طلب خدمة لا يمدّد الاشتراك', async () => {
    const owner = await contextFor(DEMO.ownerA)
    const platform = asPlatform(owner)
    const slug = await firstSlug()

    const before = await prisma.subscription.findUniqueOrThrow({
      where: { organizationId: owner.organizationId },
      select: { currentPeriodEnd: true, version: true },
    })

    const created = await createOrder(owner, {
      serviceSlug: slug,
      branchId: null,
      answers: { goal: 'اختبار عدم تمديد الاشتراك' },
    })
    const fresh = await getOrder(owner, created.id)
    await quoteOrder(platform, {
      orderId: created.id,
      price: 1000,
      note: null,
      version: fresh.version,
    })
    await approveAndPay(owner, { orderId: created.id, returnUrl: RETURN_URL })
    await markOrderPaid(created.id, new Date())

    const after = await prisma.subscription.findUniqueOrThrow({
      where: { organizationId: owner.organizationId },
      select: { currentPeriodEnd: true, version: true },
    })

    expect(after.currentPeriodEnd.getTime()).toBe(before.currentPeriodEnd.getTime())
    expect(after.version).toBe(before.version)
  })

  it('الإلغاء ممكن قبل الدفع فقط', async () => {
    const owner = await contextFor(DEMO.ownerA)
    const platform = asPlatform(owner)
    const slug = await firstSlug()

    const created = await createOrder(owner, {
      serviceSlug: slug,
      branchId: null,
      answers: { goal: 'اختبار الإلغاء' },
    })
    await cancelOrder(owner, created.id)
    expect((await getOrder(owner, created.id)).status).toBe('CANCELLED')

    const second = await createOrder(owner, {
      serviceSlug: slug,
      branchId: null,
      answers: { goal: 'اختبار الإلغاء بعد الدفع' },
    })
    const v = (await getOrder(owner, second.id)).version
    await quoteOrder(platform, {
      orderId: second.id,
      price: 500,
      note: null,
      version: v,
    })
    await approveAndPay(owner, { orderId: second.id, returnUrl: RETURN_URL })
    await markOrderPaid(second.id, new Date())

    await expect(cancelOrder(owner, second.id)).rejects.toBeInstanceOf(
      InvalidTransitionError,
    )
  })

  it('التسعير المتزامن يفشل بدل أن يدهس الأول', async () => {
    const owner = await contextFor(DEMO.ownerA)
    const platform = asPlatform(owner)
    const slug = await firstSlug()

    const created = await createOrder(owner, {
      serviceSlug: slug,
      branchId: null,
      answers: { goal: 'اختبار التزامن' },
    })
    const stale = (await getOrder(owner, created.id)).version

    await quoteOrder(platform, {
      orderId: created.id,
      price: 3000,
      note: null,
      version: stale,
    })

    // محاولة ثانية بنفس النسخة القديمة
    await expect(
      quoteOrder(platform, {
        orderId: created.id,
        price: 1,
        note: null,
        version: stale,
      }),
    ).rejects.toThrow()

    expect((await getOrder(owner, created.id)).quotedPrice).toBe(3000)
  })
})

describe('الطلبات — الصلاحيات والعزل', () => {
  it('المنشأة لا تستطيع تسعير طلبها', async () => {
    const owner = await contextFor(DEMO.ownerA)
    const slug = await firstSlug()

    const created = await createOrder(owner, {
      serviceSlug: slug,
      branchId: null,
      answers: { goal: 'محاولة تسعير ذاتي' },
    })
    const v = (await getOrder(owner, created.id)).version

    // مالك المنشأة ليس مزوّد المنصّة — quoteOrder تستدعي notFound()
    await expect(
      quoteOrder(owner, { orderId: created.id, price: 1, note: null, version: v }),
    ).rejects.toThrow()

    expect((await getOrder(owner, created.id)).status).toBe('SUBMITTED')
  })

  it('المُطّلع لا ينشئ طلبًا', async () => {
    const base = await contextFor(DEMO.ownerA)
    const viewer = contextWithRole(base, 'VIEWER')
    const slug = await firstSlug()

    await expect(
      createOrder(viewer, { serviceSlug: slug, branchId: null, answers: { goal: 'x' } }),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('طلب منشأة أخرى غير موجود — لا 403 يكشف الوجود', async () => {
    const a = await contextFor(DEMO.ownerA)
    const b = await contextFor(DEMO.ownerB)
    const slug = await firstSlug()

    const madeByB = await createOrder(b, {
      serviceSlug: slug,
      branchId: null,
      answers: { goal: 'طلب المنشأة الأخرى' },
    })

    await expect(getOrder(a, madeByB.id)).rejects.toBeInstanceOf(
      OrderNotFoundError,
    )
    await expect(cancelOrder(a, madeByB.id)).rejects.toBeInstanceOf(
      OrderNotFoundError,
    )

    const listA = await listOrders(a)
    expect(listA.some((o) => o.id === madeByB.id)).toBe(false)
  })

  it('لا يُقبل فرع من منشأة أخرى', async () => {
    const a = await contextFor(DEMO.ownerA)
    const b = await contextFor(DEMO.ownerB)
    const slug = await firstSlug()

    const branchOfB = await prisma.branch.findFirstOrThrow({
      where: { organizationId: b.organizationId },
      select: { id: true },
    })

    await expect(
      createOrder(a, {
        serviceSlug: slug,
        branchId: branchOfB.id,
        answers: { goal: 'محاولة ربط فرع غريب' },
      }),
    ).rejects.toBeInstanceOf(RequirementsError)
  })

  it('السعر يأتي من قاعدة البيانات لا من المتصل', async () => {
    const owner = await contextFor(DEMO.ownerA)
    const platform = asPlatform(owner)
    const slug = await firstSlug()

    const created = await createOrder(owner, {
      serviceSlug: slug,
      branchId: null,
      answers: { goal: 'اختبار مصدر السعر' },
    })
    const v = (await getOrder(owner, created.id)).version
    await quoteOrder(platform, {
      orderId: created.id,
      price: 8000,
      note: null,
      version: v,
    })

    // لا تقبل approveAndPay أي مبلغ — توقيعها لا يحتوي سعرًا أصلًا
    await approveAndPay(owner, { orderId: created.id, returnUrl: RETURN_URL })

    const invoice = await prisma.invoice.findFirstOrThrow({
      where: { serviceOrderId: created.id },
      select: { subtotal: true, total: true },
    })
    expect(Number(invoice.subtotal)).toBe(8000)
    expect(Number(invoice.total)).toBe(9200)
  })
})

describe('StaleOrderError موجود ومُصدَّر', () => {
  it('نوع خطأ مستقل يمكن التقاطه', () => {
    expect(new StaleOrderError().name).toBe('StaleOrderError')
  })
})
