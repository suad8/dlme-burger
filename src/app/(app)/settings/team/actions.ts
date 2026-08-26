'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import type { RoleKey } from '@prisma/client'
import { requireTenant } from '@/server/tenant'
import { ForbiddenError, ROLE_LABELS } from '@/server/rbac'
import {
  createInvitation,
  revokeInvitation,
  InviteLimitError,
  RoleEscalationError,
  InvalidInvitationError,
} from '@/server/services/invitations'
import { checkRateLimit, type RateLimitOptions } from '@/server/rate-limit'
import { emailSchema } from '@/lib/validation'

export interface Result<T = undefined> {
  ok: boolean
  message?: string
  data?: T
}

/**
 * حد على الدعوات لكل منشأة. بدونه يصير النموذج أداة إرسال بريد مجّانية:
 * المهاجم يملك حسابًا صالحًا ويكتب أي عنوان في الحقل.
 */
const INVITE_LIMIT: RateLimitOptions = { limit: 10, windowMs: 60 * 60 * 1000 }

/** حارس نوع مشتق من مصدر واحد: لو أُضيف دور إلى المخطط ظهر هنا تلقائيًا. */
function toRoleKey(value: string): RoleKey | null {
  return value in ROLE_LABELS ? (value as RoleKey) : null
}

export async function inviteMemberAction(
  email: string,
  roleKey: string,
  branchIds: string[],
): Promise<Result<{ emailDelivered: boolean; manualLink: string | null }>> {
  const parsedEmail = emailSchema.safeParse(email)
  if (!parsedEmail.success) {
    return { ok: false, message: 'البريد الإلكتروني غير صحيح.' }
  }

  const role = toRoleKey(roleKey)
  if (!role) return { ok: false, message: 'دور غير معروف.' }

  if (!Array.isArray(branchIds) || branchIds.some((b) => typeof b !== 'string')) {
    return { ok: false, message: 'قائمة الفروع غير صحيحة.' }
  }

  try {
    const ctx = await requireTenant()

    const limit = checkRateLimit(`invite:${ctx.organizationId}`, INVITE_LIMIT)
    if (!limit.allowed) {
      return {
        ok: false,
        message: `دعوات كثيرة خلال ساعة. أعد المحاولة بعد ${Math.ceil(limit.retryAfterSeconds / 60)} دقيقة.`,
      }
    }

    // الأصل يُبنى على الخادم — رابط الدعوة سرّ، ولا يُسمح للمتصفح بتوجيهه
    const h = await headers()
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ??
      `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`

    const result = await createInvitation(ctx, {
      email: parsedEmail.data,
      roleKey: role,
      branchIds,
      origin,
    })

    revalidatePath('/settings/team')

    return {
      ok: true,
      data: {
        emailDelivered: result.emailDelivered,
        manualLink: result.manualLink,
      },
    }
  } catch (error) {
    if (
      error instanceof InviteLimitError ||
      error instanceof RoleEscalationError ||
      error instanceof InvalidInvitationError
    ) {
      return { ok: false, message: error.message }
    }
    if (error instanceof ForbiddenError) {
      return { ok: false, message: 'ليست لديك صلاحية دعوة الأعضاء.' }
    }
    return { ok: false, message: 'تعذّر إرسال الدعوة.' }
  }
}

export async function revokeInvitationAction(id: string): Promise<Result> {
  if (typeof id !== 'string' || id.length === 0) {
    return { ok: false, message: 'معرّف غير صحيح.' }
  }

  try {
    const ctx = await requireTenant()
    await revokeInvitation(ctx, id)
    revalidatePath('/settings/team')
    return { ok: true }
  } catch (error) {
    if (error instanceof InvalidInvitationError) {
      return { ok: false, message: error.message }
    }
    if (error instanceof ForbiddenError) {
      return { ok: false, message: 'ليست لديك صلاحية إلغاء الدعوات.' }
    }
    return { ok: false, message: 'تعذّر إلغاء الدعوة.' }
  }
}
