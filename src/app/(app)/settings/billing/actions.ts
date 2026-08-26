'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import type { PlanTier, BillingCycle } from '@prisma/client'
import { requireTenant } from '@/server/tenant'
import { ForbiddenError } from '@/server/rbac'
import { startCheckout, DowngradeBlockedError } from '@/server/services/billing'

export interface Result<T = undefined> {
  ok: boolean
  message?: string
  data?: T
}

const VALID_TIERS: PlanTier[] = [
  'TRIAL',
  'SINGLE_BRANCH',
  'GROWTH',
  'MULTI_BRANCH',
  'ENTERPRISE',
]

export async function startCheckoutAction(
  planTier: string,
  cycle: string,
): Promise<Result<{ redirectUrl: string | null; isLive: boolean; invoiceNumber: string }>> {
  // المُدخلات من المتصفح — تُتحقق قبل أي استخدام
  if (!VALID_TIERS.includes(planTier as PlanTier)) {
    return { ok: false, message: 'باقة غير معروفة.' }
  }
  if (cycle !== 'MONTHLY' && cycle !== 'YEARLY') {
    return { ok: false, message: 'دورة فوترة غير معروفة.' }
  }

  try {
    const ctx = await requireTenant()

    // رابط العودة يُبنى على الخادم من أصل الطلب — لا يُقبل من المتصفح،
    // وإلا صار بابًا لإعادة التوجيه المفتوح
    const h = await headers()
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ??
      `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`

    const result = await startCheckout(ctx, {
      planTier: planTier as PlanTier,
      cycle: cycle as BillingCycle,
      returnUrl: `${origin}/settings/billing`,
    })

    revalidatePath('/settings/billing')

    return {
      ok: true,
      data: {
        redirectUrl: result.redirectUrl,
        isLive: result.isLive,
        invoiceNumber: result.invoiceNumber,
      },
    }
  } catch (error) {
    if (error instanceof DowngradeBlockedError) {
      return { ok: false, message: error.message }
    }
    if (error instanceof ForbiddenError) {
      return { ok: false, message: 'ليست لديك صلاحية إدارة الفوترة.' }
    }
    if (error instanceof Error) return { ok: false, message: error.message }
    return { ok: false, message: 'تعذّر بدء عملية الاشتراك.' }
  }
}
