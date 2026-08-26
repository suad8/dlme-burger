import 'server-only'
import { randomUUID } from 'node:crypto'
import type { ServiceOrderStatus, Prisma } from '@prisma/client'
import { prisma } from '../db'
import { authorize, can } from '../rbac'
import type { TenantContext } from '../tenant'
import { recordAudit } from '../audit'
import { notify } from '../notifications/dispatch'
import {
  getBillingProvider,
  priceWithVat,
  toMinor,
  fromMinor,
} from '../billing/provider'
import { toNumber } from '@/lib/utils'

/**
 * رحلة طلب الخدمة.
 *
 * الحالات تتقدّم في اتجاه واحد فقط، ولكل انتقال طرف مخوّل واحد:
 *
 *   SUBMITTED ── مزوّد المنصّة يسعّر ──▶ QUOTED
 *   QUOTED ──── المنشأة تدفع ─────────▶ APPROVED
 *   APPROVED ── مزوّد المنصّة يبدأ ───▶ IN_PROGRESS ──▶ DELIVERED
 *
 * المنشأة لا تستطيع تسعير طلبها، والمزوّد لا يستطيع الموافقة نيابة عنها.
 * السعر يأتي من سجل الطلب لا من المتصفح: لو قُبل من النموذج لدفع العميل
 * ريالًا واحدًا مقابل خدمة بعشرة آلاف.
 */

export class InvalidTransitionError extends Error {
  constructor(from: ServiceOrderStatus, to: ServiceOrderStatus) {
    super(`لا يمكن نقل الطلب من «${STATUS_LABELS[from]}» إلى «${STATUS_LABELS[to]}».`)
    this.name = 'InvalidTransitionError'
  }
}

export class OrderNotFoundError extends Error {
  constructor() {
    super('الطلب غير موجود.')
    this.name = 'OrderNotFoundError'
  }
}

export class RequirementsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RequirementsError'
  }
}

export class StaleOrderError extends Error {
  constructor() {
    super('تغيّر الطلب من جهة أخرى. حدّث الصفحة وأعد المحاولة.')
    this.name = 'StaleOrderError'
  }
}

export const STATUS_LABELS: Record<ServiceOrderStatus, string> = {
  DRAFT: 'مسودة',
  SUBMITTED: 'قيد المراجعة',
  QUOTED: 'بانتظار موافقتك',
  APPROVED: 'معتمد',
  IN_PROGRESS: 'قيد التنفيذ',
  DELIVERED: 'مُسلَّم',
  CANCELLED: 'ملغي',
}

/** حقل واحد في مخطط متطلبات الخدمة. */
export interface RequirementField {
  key: string
  label: string
  type: 'text' | 'number' | 'select'
  required: boolean
  options?: string[]
}

const MAX_ANSWER_LENGTH = 2000

export function parseRequirementsSchema(value: unknown): RequirementField[] {
  if (!Array.isArray(value)) return []

  const fields: RequirementField[] = []
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) continue
    const item = raw as Record<string, unknown>
    if (typeof item.key !== 'string' || typeof item.label !== 'string') continue

    const type =
      item.type === 'number' || item.type === 'select' ? item.type : 'text'

    fields.push({
      key: item.key,
      label: item.label,
      type,
      required: item.required === true,
      options: Array.isArray(item.options)
        ? item.options.filter((o): o is string => typeof o === 'string')
        : undefined,
    })
  }
  return fields
}

/**
 * يتحقق من الإجابات مقابل المخطط ويعيد النسخة النظيفة.
 * لا يُقبل مفتاح خارج المخطط: وإلا صار حقل JSON مساحة تخزين حرة لأي متصل.
 */
export function validateRequirements(
  schema: RequirementField[],
  answers: Record<string, unknown>,
): Record<string, string | number> {
  const clean: Record<string, string | number> = {}

  for (const field of schema) {
    const value = answers[field.key]

    if (value === undefined || value === null || value === '') {
      if (field.required) {
        throw new RequirementsError(`الحقل «${field.label}» مطلوب.`)
      }
      continue
    }

    if (field.type === 'number') {
      const num = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(num)) {
        throw new RequirementsError(`الحقل «${field.label}» يجب أن يكون رقمًا.`)
      }
      clean[field.key] = num
      continue
    }

    const text = String(value).trim()
    if (text.length > MAX_ANSWER_LENGTH) {
      throw new RequirementsError(
        `الحقل «${field.label}» أطول من ${MAX_ANSWER_LENGTH} محرفًا.`,
      )
    }

    if (field.type === 'select' && field.options && field.options.length > 0) {
      if (!field.options.includes(text)) {
        throw new RequirementsError(`قيمة «${field.label}» غير مسموحة.`)
      }
    }

    clean[field.key] = text
  }

  return clean
}

export interface CatalogItem {
  id: string
  slug: string
  name: string
  summary: string
  description: string | null
  category: string
  basePrice: number | null
  priceNote: string | null
  durationDays: number | null
  requirements: RequirementField[]
}

export async function listCatalog(): Promise<CatalogItem[]> {
  const rows = await prisma.serviceCatalog.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  return rows.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    summary: s.summary,
    description: s.description,
    category: s.category,
    basePrice: s.basePrice === null ? null : toNumber(s.basePrice),
    priceNote: s.priceNote,
    durationDays: s.durationDays,
    requirements: parseRequirementsSchema(s.requirementsSchema),
  }))
}

export async function getCatalogItem(slug: string): Promise<CatalogItem | null> {
  const all = await listCatalog()
  return all.find((s) => s.slug === slug) ?? null
}

export interface OrderRow {
  id: string
  reference: string
  status: ServiceOrderStatus
  statusLabel: string
  serviceName: string
  branchName: string | null
  quotedPrice: number | null
  createdAt: Date
}

export async function listOrders(ctx: TenantContext): Promise<OrderRow[]> {
  authorize(ctx, 'service:view')

  const rows = await prisma.serviceOrder.findMany({
    where: { organizationId: ctx.organizationId },
    select: {
      id: true,
      reference: true,
      status: true,
      quotedPrice: true,
      createdAt: true,
      service: { select: { name: true } },
      branch: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return rows.map((o) => ({
    id: o.id,
    reference: o.reference,
    status: o.status,
    statusLabel: STATUS_LABELS[o.status],
    serviceName: o.service.name,
    branchName: o.branch?.name ?? null,
    quotedPrice: o.quotedPrice === null ? null : toNumber(o.quotedPrice),
    createdAt: o.createdAt,
  }))
}

export interface OrderDetail extends OrderRow {
  version: number
  quoteNote: string | null
  requirements: { label: string; value: string }[]
  events: { status: ServiceOrderStatus; label: string; note: string | null; at: Date }[]
  invoice: { id: string; number: string; status: string; total: number } | null
}

export async function getOrder(
  ctx: TenantContext,
  orderId: string,
): Promise<OrderDetail> {
  authorize(ctx, 'service:view')

  // مقيّد بالمنشأة. طلب منشأة أخرى ليس «ممنوعًا» بل «غير موجود».
  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, organizationId: ctx.organizationId },
    select: {
      id: true,
      reference: true,
      status: true,
      quotedPrice: true,
      quoteNote: true,
      requirements: true,
      createdAt: true,
      version: true,
      service: { select: { name: true, requirementsSchema: true } },
      branch: { select: { name: true } },
      events: {
        select: { status: true, note: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
      invoices: {
        select: { id: true, number: true, status: true, total: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  if (!order) throw new OrderNotFoundError()

  const schema = parseRequirementsSchema(order.service.requirementsSchema)
  const answers = (order.requirements ?? {}) as Record<string, unknown>

  const invoice = order.invoices[0]

  return {
    id: order.id,
    reference: order.reference,
    status: order.status,
    statusLabel: STATUS_LABELS[order.status],
    serviceName: order.service.name,
    branchName: order.branch?.name ?? null,
    quotedPrice: order.quotedPrice === null ? null : toNumber(order.quotedPrice),
    quoteNote: order.quoteNote,
    createdAt: order.createdAt,
    version: order.version,
    requirements: schema
      .filter((f) => answers[f.key] !== undefined)
      .map((f) => ({ label: f.label, value: String(answers[f.key]) })),
    events: order.events.map((e) => ({
      status: e.status,
      label: STATUS_LABELS[e.status],
      note: e.note,
      at: e.createdAt,
    })),
    invoice: invoice
      ? {
          id: invoice.id,
          number: invoice.number,
          status: invoice.status,
          total: toNumber(invoice.total),
        }
      : null,
  }
}

export async function createOrder(
  ctx: TenantContext,
  params: {
    serviceSlug: string
    branchId: string | null
    answers: Record<string, unknown>
  },
): Promise<{ id: string; reference: string }> {
  authorize(ctx, 'service:create')

  const service = await prisma.serviceCatalog.findFirst({
    where: { slug: params.serviceSlug, isActive: true },
    select: { id: true, name: true, requirementsSchema: true },
  })
  if (!service) throw new RequirementsError('الخدمة غير متاحة.')

  const schema = parseRequirementsSchema(service.requirementsSchema)
  const requirements = validateRequirements(schema, params.answers)

  // الفرع يجب أن يخص هذه المنشأة ونطاق المستخدم
  if (params.branchId) {
    const branch = await prisma.branch.findFirst({
      where: {
        id: params.branchId,
        organizationId: ctx.organizationId,
        deletedAt: null,
        ...(ctx.branchScope === null
          ? {}
          : { AND: [{ id: { in: [...ctx.branchScope] } }] }),
      },
      select: { id: true },
    })
    if (!branch) throw new RequirementsError('الفرع المختار غير متاح لك.')
  }

  const order = await prisma.$transaction(async (tx) => {
    const count = await tx.serviceOrder.count({
      where: { organizationId: ctx.organizationId },
    })

    const created = await tx.serviceOrder.create({
      data: {
        organizationId: ctx.organizationId,
        serviceId: service.id,
        branchId: params.branchId,
        reference: `SR-${String(count + 1).padStart(4, '0')}`,
        status: 'SUBMITTED',
        requirements: requirements as Prisma.InputJsonValue,
      },
      select: { id: true, reference: true },
    })

    await tx.serviceOrderEvent.create({
      data: {
        orderId: created.id,
        status: 'SUBMITTED',
        actorId: ctx.userId,
        note: 'أُرسل الطلب.',
      },
    })

    return created
  })

  await recordAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'service_order.create',
    entityType: 'ServiceOrder',
    entityId: order.id,
    after: { reference: order.reference, service: service.name },
  })

  return order
}

/**
 * التسعير — لمزوّد المنصّة وحده. المنشأة لا تسعّر طلبها بأي حال، ولذلك
 * الفحص هنا على isSuperAdmin لا على صلاحية داخل المنشأة.
 */
export async function quoteOrder(
  ctx: TenantContext,
  params: { orderId: string; price: number; note: string | null; version: number },
): Promise<void> {
  if (!ctx.isSuperAdmin) {
    const { notFound } = await import('next/navigation')
    notFound()
  }

  if (!Number.isFinite(params.price) || params.price <= 0) {
    throw new RequirementsError('السعر يجب أن يكون رقمًا موجبًا.')
  }

  const order = await prisma.serviceOrder.findUnique({
    where: { id: params.orderId },
    select: { id: true, status: true, version: true, organizationId: true, reference: true },
  })
  if (!order) throw new OrderNotFoundError()
  if (order.status !== 'SUBMITTED') {
    throw new InvalidTransitionError(order.status, 'QUOTED')
  }

  const updated = await prisma.serviceOrder.updateMany({
    // الشرط على النسخة يمنع الكتابة فوق تسعير متزامن
    where: { id: order.id, version: params.version },
    data: {
      status: 'QUOTED',
      quotedPrice: params.price.toFixed(2),
      quoteNote: params.note,
      version: { increment: 1 },
    },
  })
  if (updated.count === 0) throw new StaleOrderError()

  await prisma.serviceOrderEvent.create({
    data: {
      orderId: order.id,
      status: 'QUOTED',
      actorId: ctx.userId,
      note: params.note,
    },
  })

  await notifyOrderOwners(order.organizationId, {
    body: `وصل عرض سعر لطلب الخدمة ${order.reference}. راجعه واعتمده لبدء التنفيذ.`,
    linkPath: `/service-orders/${order.id}`,
  })

  await recordAudit({
    organizationId: order.organizationId,
    actorId: ctx.userId,
    action: 'service_order.quote',
    entityType: 'ServiceOrder',
    entityId: order.id,
    after: { price: params.price },
  })
}

export interface ApproveResult {
  redirectUrl: string | null
  invoiceNumber: string
  isLive: boolean
}

/**
 * اعتماد العرض والدفع.
 *
 * المبلغ يُقرأ من `quotedPrice` في قاعدة البيانات — لا يُقبل من المتصفح.
 * الطلب لا ينتقل إلى APPROVED هنا: ينتظر تأكيد الـwebhook، وإلا صار الاعتماد
 * مجانيًا لمن يضغط الزر ويغلق البوابة.
 */
export async function approveAndPay(
  ctx: TenantContext,
  params: { orderId: string; returnUrl: string },
): Promise<ApproveResult> {
  authorize(ctx, 'service:approve')

  const order = await prisma.serviceOrder.findFirst({
    where: { id: params.orderId, organizationId: ctx.organizationId },
    select: {
      id: true,
      reference: true,
      status: true,
      quotedPrice: true,
      service: { select: { name: true } },
    },
  })

  if (!order) throw new OrderNotFoundError()
  if (order.status !== 'QUOTED') {
    throw new InvalidTransitionError(order.status, 'APPROVED')
  }
  if (order.quotedPrice === null) {
    throw new RequirementsError('لا يوجد سعر معتمد لهذا الطلب.')
  }

  const priced = priceWithVat(toMinor(toNumber(order.quotedPrice)))
  const idempotencyKey = randomUUID()

  const invoice = await prisma.$transaction(async (tx) => {
    const count = await tx.invoice.count({
      where: { organizationId: ctx.organizationId },
    })
    return tx.invoice.create({
      data: {
        organizationId: ctx.organizationId,
        serviceOrderId: order.id,
        number: `INV-${String(count + 1).padStart(5, '0')}`,
        status: 'DRAFT',
        subtotal: fromMinor(priced.subtotalMinor).toFixed(2),
        vatAmount: fromMinor(priced.vatMinor).toFixed(2),
        total: fromMinor(priced.totalMinor).toFixed(2),
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      select: { id: true, number: true },
    })
  })

  const provider = getBillingProvider()
  const session = await provider.createCheckout({
    organizationId: ctx.organizationId,
    planTier: `service:${order.reference}`,
    cycle: 'MONTHLY',
    amount: { amountMinor: priced.totalMinor, currency: 'SAR' },
    returnUrl: params.returnUrl,
    idempotencyKey,
  })

  await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      amount: fromMinor(priced.totalMinor).toFixed(2),
      status: 'PENDING',
      providerRef: session.reference,
      providerName: session.provider,
    },
  })

  await recordAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'service_order.checkout_started',
    entityType: 'ServiceOrder',
    entityId: order.id,
    after: { totalMinor: priced.totalMinor, isLive: provider.isLive },
  })

  return {
    redirectUrl: session.redirectUrl,
    invoiceNumber: invoice.number,
    isLive: provider.isLive,
  }
}

/** يُستدعى من معالج الدفع بعد تأكيد التحصيل — لا من الواجهة. */
export async function markOrderPaid(
  orderId: string,
  paidAt: Date,
): Promise<void> {
  const order = await prisma.serviceOrder.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, organizationId: true, reference: true },
  })
  if (!order || order.status !== 'QUOTED') return

  await prisma.$transaction(async (tx) => {
    await tx.serviceOrder.update({
      where: { id: order.id },
      data: { status: 'APPROVED', approvedAt: paidAt, version: { increment: 1 } },
    })
    await tx.serviceOrderEvent.create({
      data: {
        orderId: order.id,
        status: 'APPROVED',
        note: 'تم تحصيل المبلغ واعتماد الطلب.',
      },
    })
  })

  await notifyOrderOwners(order.organizationId, {
    body: `اعتُمد طلب الخدمة ${order.reference} بعد تأكيد الدفع.`,
    linkPath: `/service-orders/${order.id}`,
  })
}

export async function cancelOrder(
  ctx: TenantContext,
  orderId: string,
): Promise<void> {
  authorize(ctx, 'service:delete')

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, organizationId: ctx.organizationId },
    select: { id: true, status: true },
  })
  if (!order) throw new OrderNotFoundError()

  // بعد الدفع لا يُلغى من الواجهة — الاسترداد مسار مالي منفصل
  if (order.status !== 'SUBMITTED' && order.status !== 'QUOTED') {
    throw new InvalidTransitionError(order.status, 'CANCELLED')
  }

  await prisma.$transaction(async (tx) => {
    await tx.serviceOrder.update({
      where: { id: order.id },
      data: { status: 'CANCELLED', version: { increment: 1 } },
    })
    await tx.serviceOrderEvent.create({
      data: {
        orderId: order.id,
        status: 'CANCELLED',
        actorId: ctx.userId,
        note: 'ألغت المنشأة الطلب.',
      },
    })
  })

  await recordAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'service_order.cancel',
    entityType: 'ServiceOrder',
    entityId: order.id,
  })
}

/** تقدّم التنفيذ — لمزوّد المنصّة. */
export async function advanceOrder(
  ctx: TenantContext,
  params: { orderId: string; to: 'IN_PROGRESS' | 'DELIVERED'; note: string | null },
): Promise<void> {
  if (!ctx.isSuperAdmin) {
    const { notFound } = await import('next/navigation')
    notFound()
  }

  const order = await prisma.serviceOrder.findUnique({
    where: { id: params.orderId },
    select: { id: true, status: true, organizationId: true, reference: true },
  })
  if (!order) throw new OrderNotFoundError()

  const allowed: Record<string, ServiceOrderStatus[]> = {
    IN_PROGRESS: ['APPROVED'],
    DELIVERED: ['IN_PROGRESS'],
  }
  if (!allowed[params.to]?.includes(order.status)) {
    throw new InvalidTransitionError(order.status, params.to)
  }

  await prisma.$transaction(async (tx) => {
    await tx.serviceOrder.update({
      where: { id: order.id },
      data: {
        status: params.to,
        version: { increment: 1 },
        ...(params.to === 'IN_PROGRESS'
          ? { startedAt: new Date() }
          : { deliveredAt: new Date() }),
      },
    })
    await tx.serviceOrderEvent.create({
      data: {
        orderId: order.id,
        status: params.to,
        actorId: ctx.userId,
        note: params.note,
      },
    })
  })

  await notifyOrderOwners(order.organizationId, {
    body:
      params.to === 'DELIVERED'
        ? `سُلِّم طلب الخدمة ${order.reference}.`
        : `بدأ تنفيذ طلب الخدمة ${order.reference}.`,
    linkPath: `/service-orders/${order.id}`,
  })
}

/** يُشعِر من يملك متابعة الخدمات في المنشأة، لا كل الأعضاء. */
async function notifyOrderOwners(
  organizationId: string,
  message: { body: string; linkPath: string },
): Promise<void> {
  const members = await prisma.membership.findMany({
    where: {
      organizationId,
      status: 'ACTIVE',
      role: {
        permissions: {
          some: { granted: true, permission: { key: 'service:view' } },
        },
      },
    },
    select: { userId: true },
    take: 20,
  })

  for (const member of members) {
    await notify({
      organizationId,
      userId: member.userId,
      type: 'SERVICE_ORDER_UPDATE',
      body: message.body,
      linkPath: message.linkPath,
    })
  }
}

export { can }

export interface AdminOrderRow {
  id: string
  reference: string
  status: ServiceOrderStatus
  statusLabel: string
  serviceName: string
  organizationName: string
  quotedPrice: number | null
  version: number
  createdAt: Date
  requirements: { label: string; value: string }[]
}

/**
 * قائمة الطلبات عبر كل المنشآت — لمزوّد المنصّة وحده.
 *
 * هذه الدالة تتجاوز عزل المستأجرين عمدًا، ولهذا يقف عندها فحص isSuperAdmin
 * قبل أي استعلام. أي مسار آخر يقرأ الطلبات يبقى مقيّدًا بالمنشأة.
 */
export async function listAllOrders(
  ctx: TenantContext,
  limit = 50,
): Promise<AdminOrderRow[]> {
  if (!ctx.isSuperAdmin) {
    const { notFound } = await import('next/navigation')
    notFound()
  }

  const rows = await prisma.serviceOrder.findMany({
    where: { status: { notIn: ['DRAFT', 'CANCELLED'] } },
    select: {
      id: true,
      reference: true,
      status: true,
      quotedPrice: true,
      requirements: true,
      version: true,
      createdAt: true,
      service: { select: { name: true, requirementsSchema: true } },
      organization: { select: { name: true } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: limit,
  })

  return rows.map((o) => {
    const schema = parseRequirementsSchema(o.service.requirementsSchema)
    const answers = (o.requirements ?? {}) as Record<string, unknown>

    return {
      id: o.id,
      reference: o.reference,
      status: o.status,
      statusLabel: STATUS_LABELS[o.status],
      serviceName: o.service.name,
      organizationName: o.organization.name,
      quotedPrice: o.quotedPrice === null ? null : toNumber(o.quotedPrice),
      version: o.version,
      createdAt: o.createdAt,
      requirements: schema
        .filter((f) => answers[f.key] !== undefined)
        .map((f) => ({ label: f.label, value: String(answers[f.key]) })),
    }
  })
}
