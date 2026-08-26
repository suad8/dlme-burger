import 'server-only'
import { randomUUID } from 'node:crypto'
import { PlanTier, type BillingCycle, type Prisma } from '@prisma/client'
import { prisma } from '../db'
import { authorize } from '../rbac'
import type { TenantContext } from '../tenant'
import { recordAudit } from '../audit'
import { notify } from '../notifications/dispatch'
import {
  getBillingProvider,
  priceWithVat,
  toMinor,
  fromMinor,
  type PaymentEvent,
} from '../billing/provider'
import { toNumber } from '@/lib/utils'

/**
 * الاشتراكات والفوترة.
 *
 * القاعدة الحاكمة: **لا تُرقّى الباقة إلا بعد تأكيد الدفع من المزوّد عبر
 * webhook موقّع.** العودة من صفحة الدفع ليست دليلًا — المستخدم يستطيع فتح
 * رابط العودة يدويًا دون أن يدفع.
 */

export class DowngradeBlockedError extends Error {
  override readonly name = 'DowngradeBlockedError'
}

export interface PlanOption {
  id: string
  tier: PlanTier
  name: string
  monthlyPrice: number
  yearlyPrice: number
  maxBranches: number
  maxUsers: number
  maxBrands: number
  isCurrent: boolean
  /** سبب منع الاختيار، أو null إن كان متاحًا. */
  blockedReason: string | null
}

/**
 * الباقات المتاحة للمنشأة مع سبب المنع إن وُجد.
 *
 * التخفيض إلى باقة لا تتّسع لما هو قائم يُمنع مسبقًا بدل أن يُقبل ثم يترك
 * المنشأة فوق حدّها بلا حل.
 */
export async function getPlanOptions(
  ctx: TenantContext,
): Promise<PlanOption[]> {
  authorize(ctx, 'billing:view')

  const [plans, subscription, counts] = await Promise.all([
    prisma.plan.findMany({
      where: { isPublic: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.subscription.findUnique({
      where: { organizationId: ctx.organizationId },
      select: { plan: { select: { tier: true } } },
    }),
    prisma.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: {
        _count: { select: { branches: true, memberships: true, brands: true } },
      },
    }),
  ])

  const current = subscription?.plan.tier ?? null

  return plans.map((p) => {
    const reasons: string[] = []
    if (counts._count.branches > p.maxBranches) {
      reasons.push(`لديك ${counts._count.branches} فرعًا والباقة تسمح بـ${p.maxBranches}`)
    }
    if (counts._count.memberships > p.maxUsers) {
      reasons.push(`لديك ${counts._count.memberships} مستخدمًا والباقة تسمح بـ${p.maxUsers}`)
    }
    if (counts._count.brands > p.maxBrands) {
      reasons.push(`لديك ${counts._count.brands} علامة والباقة تسمح بـ${p.maxBrands}`)
    }

    return {
      id: p.id,
      tier: p.tier,
      name: p.name,
      monthlyPrice: toNumber(p.monthlyPrice),
      yearlyPrice: toNumber(p.yearlyPrice),
      maxBranches: p.maxBranches,
      maxUsers: p.maxUsers,
      maxBrands: p.maxBrands,
      isCurrent: p.tier === current,
      blockedReason: reasons.length > 0 ? reasons.join('، ') : null,
    }
  })
}

export interface CheckoutResult {
  /** رابط بوابة الدفع، أو null في الوضع الوهمي. */
  redirectUrl: string | null
  invoiceNumber: string
  totalMinor: number
  /** هل المزوّد يحصّل فعلًا؟ */
  isLive: boolean
}

/**
 * يبدأ ترقية: ينشئ فاتورة مسوّدة ويطلب جلسة دفع.
 * الفاتورة تبقى DRAFT حتى يؤكّد الـwebhook — فلا سجل دفع بلا دفع.
 */
export async function startCheckout(
  ctx: TenantContext,
  params: { planTier: PlanTier; cycle: BillingCycle; returnUrl: string },
): Promise<CheckoutResult> {
  authorize(ctx, 'billing:manage')

  const plan = await prisma.plan.findUniqueOrThrow({
    where: { tier: params.planTier },
  })

  // إعادة فحص المنع على الخادم — الواجهة قد تُتجاوز
  const options = await getPlanOptions(ctx)
  const option = options.find((o) => o.tier === params.planTier)
  if (option?.blockedReason) {
    throw new DowngradeBlockedError(
      `لا يمكن الانتقال إلى «${plan.name}»: ${option.blockedReason}.`,
    )
  }

  const base =
    params.cycle === 'YEARLY'
      ? toNumber(plan.yearlyPrice)
      : toNumber(plan.monthlyPrice)

  if (base <= 0) {
    throw new Error(
      'هذه الباقة تُسعَّر حسب الطلب. تواصل معنا لتفعيلها على حسابك.',
    )
  }

  const priced = priceWithVat(toMinor(base))
  const idempotencyKey = randomUUID()

  const invoice = await prisma.$transaction(async (tx) => {
    const count = await tx.invoice.count({
      where: { organizationId: ctx.organizationId },
    })
    return tx.invoice.create({
      data: {
        organizationId: ctx.organizationId,
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
    planTier: params.planTier,
    cycle: params.cycle,
    amount: { amountMinor: priced.totalMinor, currency: 'SAR' },
    returnUrl: params.returnUrl,
    idempotencyKey,
  })

  // نربط الفاتورة بمرجع المزوّد لنجدها عند وصول الـwebhook
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
    action: 'billing.checkout_started',
    entityType: 'Invoice',
    entityId: invoice.id,
    after: {
      planTier: params.planTier,
      cycle: params.cycle,
      totalMinor: priced.totalMinor,
      provider: session.provider,
      isLive: provider.isLive,
    },
  })

  return {
    redirectUrl: session.redirectUrl,
    invoiceNumber: invoice.number,
    totalMinor: priced.totalMinor,
    isLive: provider.isLive,
  }
}

/**
 * يطبّق نتيجة دفع مؤكَّدة من المزوّد.
 *
 * مُتماثل (idempotent): إعادة إرسال نفس الحدث — وهو أمر شائع من البوابات —
 * لا تُنشئ فاتورة ثانية ولا تُمدّد الاشتراك مرتين.
 */
export async function applyPaymentEvent(
  event: PaymentEvent,
): Promise<{ applied: boolean; reason?: string }> {
  const payment = await prisma.payment.findFirst({
    where: { providerRef: event.reference },
    select: {
      id: true,
      status: true,
      invoice: {
        select: {
          id: true,
          organizationId: true,
          number: true,
          total: true,
          serviceOrderId: true,
        },
      },
    },
  })

  if (!payment) {
    return { applied: false, reason: 'لا توجد دفعة بهذا المرجع.' }
  }

  // الحدث المكرر يُتجاهل بهدوء — ليس خطأ
  if (payment.status !== 'PENDING') {
    return { applied: false, reason: 'الدفعة محسومة سابقًا.' }
  }

  const organizationId = payment.invoice.organizationId

  if (event.status !== 'SUCCEEDED') {
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: event.status === 'REFUNDED' ? 'REFUNDED' : 'FAILED',
          failureCode: event.failureCode ?? null,
          processedAt: event.occurredAt,
        },
      }),
      prisma.invoice.update({
        where: { id: payment.invoice.id },
        data: { status: event.status === 'REFUNDED' ? 'REFUNDED' : 'OVERDUE' },
      }),
    ])

    await notifyBillingOwners(organizationId, {
      type: 'PAYMENT_FAILED',
      body: `تعذّر تحصيل الفاتورة ${payment.invoice.number}. حدّث وسيلة الدفع لتفادي تقييد الحساب.`,
      linkPath: '/settings/billing',
    })

    await recordAudit({
      organizationId,
      action: 'billing.payment_failed',
      entityType: 'Payment',
      entityId: payment.id,
      after: { status: event.status, failureCode: event.failureCode },
    })

    return { applied: true }
  }

  // نجاح. فاتورة طلب خدمة تُعتمد الطلب ولا تمسّ الاشتراك: خلط الاثنين يعني
  // أن شراء خدمة استشارية يمدّد الاشتراك شهرًا مجانًا.
  const isServiceOrder = payment.invoice.serviceOrderId !== null

  const periodEnd = new Date()
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'SUCCEEDED', processedAt: event.occurredAt },
    })
    await tx.invoice.update({
      where: { id: payment.invoice.id },
      data: { status: 'PAID', paidAt: event.occurredAt, issuedAt: event.occurredAt },
    })

    if (!isServiceOrder) {
      await tx.subscription.updateMany({
        where: { organizationId },
        data: {
          status: 'ACTIVE',
          currentPeriodStart: event.occurredAt,
          currentPeriodEnd: periodEnd,
          graceEndsAt: null,
          version: { increment: 1 },
        },
      })
      await tx.organization.update({
        where: { id: organizationId },
        data: { status: 'ACTIVE' },
      })
    }
  })

  if (isServiceOrder && payment.invoice.serviceOrderId) {
    const { markOrderPaid } = await import('./service-orders')
    await markOrderPaid(payment.invoice.serviceOrderId, event.occurredAt)
  }

  await recordAudit({
    organizationId,
    action: 'billing.payment_succeeded',
    entityType: 'Payment',
    entityId: payment.id,
    after: {
      invoice: payment.invoice.number,
      amountMinor: event.amount.amountMinor,
    },
  })

  return { applied: true }
}

/** يُشعر من يملك صلاحية الفوترة وحدهم. */
async function notifyBillingOwners(
  organizationId: string,
  notice: { type: 'PAYMENT_FAILED'; body: string; linkPath: string },
): Promise<void> {
  const members = await prisma.membership.findMany({
    where: {
      organizationId,
      status: 'ACTIVE',
      role: {
        permissions: {
          some: { granted: true, permission: { key: 'billing:manage' } },
        },
      },
    },
    select: { userId: true },
  })

  for (const m of members) {
    await notify({
      organizationId,
      userId: m.userId,
      type: notice.type,
      body: notice.body,
      linkPath: notice.linkPath,
    })
  }
}

export interface BillingOverview {
  planName: string | null
  planTier: PlanTier | null
  status: string | null
  currentPeriodEnd: Date | null
  trialEndsAt: Date | null
  monthlyPrice: number
  usage: { branches: number; users: number; brands: number }
  limits: { branches: number; users: number; brands: number }
  invoices: {
    id: string
    number: string
    total: number
    status: string
    issuedAt: Date | null
  }[]
  providerIsLive: boolean
}

export async function getBillingOverview(
  ctx: TenantContext,
): Promise<BillingOverview> {
  authorize(ctx, 'billing:view')

  const [subscription, org, invoices] = await Promise.all([
    prisma.subscription.findUnique({
      where: { organizationId: ctx.organizationId },
      select: {
        status: true,
        currentPeriodEnd: true,
        trialEndsAt: true,
        plan: {
          select: {
            tier: true,
            name: true,
            monthlyPrice: true,
            maxBranches: true,
            maxUsers: true,
            maxBrands: true,
          },
        },
      },
    }),
    prisma.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: {
        _count: { select: { branches: true, memberships: true, brands: true } },
      },
    }),
    prisma.invoice.findMany({
      where: { organizationId: ctx.organizationId },
      select: {
        id: true,
        number: true,
        total: true,
        status: true,
        issuedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 12,
    }),
  ])

  let providerIsLive = false
  try {
    providerIsLive = getBillingProvider().isLive
  } catch {
    // مزوّد مُعلن بمفاتيح ناقصة — نعرضه كغير فعّال بدل إسقاط الصفحة
    providerIsLive = false
  }

  return {
    planName: subscription?.plan.name ?? null,
    planTier: subscription?.plan.tier ?? null,
    status: subscription?.status ?? null,
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    trialEndsAt: subscription?.trialEndsAt ?? null,
    monthlyPrice: toNumber(subscription?.plan.monthlyPrice ?? 0),
    usage: {
      branches: org._count.branches,
      users: org._count.memberships,
      brands: org._count.brands,
    },
    limits: {
      branches: subscription?.plan.maxBranches ?? 0,
      users: subscription?.plan.maxUsers ?? 0,
      brands: subscription?.plan.maxBrands ?? 0,
    },
    invoices: invoices.map((i) => ({
      id: i.id,
      number: i.number,
      total: toNumber(i.total),
      status: i.status,
      issuedAt: i.issuedAt,
    })),
    providerIsLive,
  }
}

/** أنواع مستخدَمة في الاختبارات للتحقق من صحة المخطط. */
export type { Prisma }
