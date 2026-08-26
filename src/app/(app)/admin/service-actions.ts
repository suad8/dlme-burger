'use server'

import { revalidatePath } from 'next/cache'
import { requireSuperAdmin } from '@/server/tenant'
import {
  quoteOrder,
  advanceOrder,
  OrderNotFoundError,
  RequirementsError,
  InvalidTransitionError,
  StaleOrderError,
} from '@/server/services/service-orders'

export interface Result {
  ok: boolean
  message?: string
}

function toMessage(error: unknown, fallback: string): Result {
  if (
    error instanceof RequirementsError ||
    error instanceof InvalidTransitionError ||
    error instanceof StaleOrderError ||
    error instanceof OrderNotFoundError
  ) {
    return { ok: false, message: error.message }
  }
  return { ok: false, message: fallback }
}

export async function quoteOrderAction(
  orderId: string,
  price: number,
  note: string,
  version: number,
): Promise<Result> {
  if (typeof orderId !== 'string' || orderId.length === 0) {
    return { ok: false, message: 'طلب غير معروف.' }
  }
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    return { ok: false, message: 'أدخل سعرًا موجبًا.' }
  }
  if (!Number.isInteger(version) || version < 0) {
    return { ok: false, message: 'نسخة غير صحيحة.' }
  }

  try {
    // requireSuperAdmin يعيد 404 لغير المخوّل — لا نكشف وجود المسار
    const ctx = await requireSuperAdmin()
    await quoteOrder(ctx, {
      orderId,
      price,
      note: note.trim() === '' ? null : note.trim().slice(0, 2000),
      version,
    })
    revalidatePath('/admin')
    return { ok: true }
  } catch (error) {
    return toMessage(error, 'تعذّر تسجيل عرض السعر.')
  }
}

export async function advanceOrderAction(
  orderId: string,
  to: string,
  note: string,
): Promise<Result> {
  if (to !== 'IN_PROGRESS' && to !== 'DELIVERED') {
    return { ok: false, message: 'حالة غير مسموحة.' }
  }

  try {
    const ctx = await requireSuperAdmin()
    await advanceOrder(ctx, {
      orderId,
      to,
      note: note.trim() === '' ? null : note.trim().slice(0, 2000),
    })
    revalidatePath('/admin')
    return { ok: true }
  } catch (error) {
    return toMessage(error, 'تعذّر تحديث حالة الطلب.')
  }
}
