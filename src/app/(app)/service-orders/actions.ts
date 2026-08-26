'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { requireTenant } from '@/server/tenant'
import { ForbiddenError } from '@/server/rbac'
import {
  createOrder,
  approveAndPay,
  cancelOrder,
  OrderNotFoundError,
  RequirementsError,
  InvalidTransitionError,
} from '@/server/services/service-orders'

export interface Result<T = undefined> {
  ok: boolean
  message?: string
  data?: T
}

function toMessage<T>(error: unknown, fallback: string): Result<T> {
  if (
    error instanceof RequirementsError ||
    error instanceof InvalidTransitionError ||
    error instanceof OrderNotFoundError
  ) {
    return { ok: false, message: error.message }
  }
  if (error instanceof ForbiddenError) {
    return { ok: false, message: 'ليست لديك صلاحية لهذا الإجراء.' }
  }
  return { ok: false, message: fallback }
}

export async function createOrderAction(
  serviceSlug: string,
  branchId: string | null,
  answers: Record<string, unknown>,
): Promise<Result<{ id: string }>> {
  if (typeof serviceSlug !== 'string' || serviceSlug.length === 0) {
    return { ok: false, message: 'خدمة غير معروفة.' }
  }
  if (branchId !== null && typeof branchId !== 'string') {
    return { ok: false, message: 'فرع غير صحيح.' }
  }
  if (typeof answers !== 'object' || answers === null || Array.isArray(answers)) {
    return { ok: false, message: 'بيانات الطلب غير صحيحة.' }
  }

  try {
    const ctx = await requireTenant()
    const order = await createOrder(ctx, { serviceSlug, branchId, answers })
    revalidatePath('/service-orders')
    return { ok: true, data: { id: order.id } }
  } catch (error) {
    return toMessage(error, 'تعذّر إرسال الطلب.')
  }
}

export async function approveOrderAction(
  orderId: string,
): Promise<Result<{ redirectUrl: string | null; invoiceNumber: string; isLive: boolean }>> {
  if (typeof orderId !== 'string' || orderId.length === 0) {
    return { ok: false, message: 'طلب غير معروف.' }
  }

  try {
    const ctx = await requireTenant()

    // رابط العودة يُبنى على الخادم — لا يُقبل من المتصفح
    const h = await headers()
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ??
      `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`

    const result = await approveAndPay(ctx, {
      orderId,
      returnUrl: `${origin}/services/${orderId}`,
    })

    revalidatePath(`/service-orders/${orderId}`)
    return { ok: true, data: result }
  } catch (error) {
    return toMessage(error, 'تعذّر اعتماد الطلب.')
  }
}

export async function cancelOrderAction(orderId: string): Promise<Result> {
  if (typeof orderId !== 'string' || orderId.length === 0) {
    return { ok: false, message: 'طلب غير معروف.' }
  }

  try {
    const ctx = await requireTenant()
    await cancelOrder(ctx, orderId)
    revalidatePath('/service-orders')
    revalidatePath(`/service-orders/${orderId}`)
    return { ok: true }
  } catch (error) {
    return toMessage(error, 'تعذّر إلغاء الطلب.')
  }
}
