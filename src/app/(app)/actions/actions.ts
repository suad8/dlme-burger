'use server'

import { revalidatePath } from 'next/cache'
import type { ActionStatus } from '@prisma/client'
import { requireTenant } from '@/server/tenant'
import { ForbiddenError } from '@/server/rbac'
import {
  createAction,
  transitionAction,
  addComment,
  InvalidTransitionError,
} from '@/server/services/actions'
import { correctiveActionSchema } from '@/lib/validation'

export interface Result<T = undefined> {
  ok: boolean
  message?: string
  data?: T
}

/** عام في T ليصلح لأي حمولة نجاح — الفشل لا يحمل data أصلًا. */
function toResult<T>(error: unknown): Result<T> {
  if (error instanceof InvalidTransitionError) {
    return { ok: false, message: error.message }
  }
  if (error instanceof ForbiddenError) {
    return { ok: false, message: 'ليست لديك صلاحية لهذه العملية.' }
  }
  if (error instanceof Error) return { ok: false, message: error.message }
  return { ok: false, message: 'حدث خطأ غير متوقع.' }
}

export async function createActionAction(
  input: unknown,
): Promise<Result<{ id: string }>> {
  // التحقق يُعاد على الخادم — ما يصل من المتصفح لا يُوثق به
  const parsed = correctiveActionSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'البيانات غير صحيحة.',
    }
  }

  try {
    const ctx = await requireTenant()
    const id = await createAction(ctx, parsed.data)
    revalidatePath('/actions')
    revalidatePath('/dashboard')
    return { ok: true, data: { id } }
  } catch (error) {
    return toResult(error)
  }
}

export async function transitionActionAction(
  actionId: string,
  to: ActionStatus,
): Promise<Result> {
  try {
    const ctx = await requireTenant()
    await transitionAction(ctx, actionId, to)
    revalidatePath('/actions')
    revalidatePath(`/actions/${actionId}`)
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (error) {
    return toResult(error)
  }
}

export async function addCommentAction(
  actionId: string,
  body: string,
): Promise<Result> {
  try {
    const ctx = await requireTenant()
    await addComment(ctx, actionId, body)
    revalidatePath(`/actions/${actionId}`)
    return { ok: true }
  } catch (error) {
    return toResult(error)
  }
}
