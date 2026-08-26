'use server'

import { revalidatePath } from 'next/cache'
import { requireTenant } from '@/server/tenant'
import { ForbiddenError } from '@/server/rbac'
import {
  createTemplate,
  setTemplateActive,
  softDeleteTemplate,
} from '@/server/services/inspections'
import { checklistTemplateSchema } from '@/lib/validation'

export interface Result<T = undefined> {
  ok: boolean
  message?: string
  data?: T
}

function toResult<T>(error: unknown): Result<T> {
  if (error instanceof ForbiddenError) {
    return { ok: false, message: 'ليست لديك صلاحية لهذه العملية.' }
  }
  if (error instanceof Error) return { ok: false, message: error.message }
  return { ok: false, message: 'حدث خطأ غير متوقع.' }
}

export async function createTemplateAction(
  input: unknown,
): Promise<Result<{ id: string }>> {
  // نفس المخطط الذي يستخدمه العميل — يُعاد تشغيله هنا بالكامل
  const parsed = checklistTemplateSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'بيانات القالب غير صحيحة.',
    }
  }

  try {
    const ctx = await requireTenant()
    const id = await createTemplate(ctx, parsed.data)
    revalidatePath('/checklists')
    return { ok: true, data: { id } }
  } catch (error) {
    return toResult(error)
  }
}

export async function setTemplateActiveAction(
  templateId: string,
  isActive: boolean,
): Promise<Result> {
  try {
    const ctx = await requireTenant()
    await setTemplateActive(ctx, templateId, isActive)
    revalidatePath('/checklists')
    return { ok: true }
  } catch (error) {
    return toResult(error)
  }
}

export async function deleteTemplateAction(
  templateId: string,
): Promise<Result> {
  try {
    const ctx = await requireTenant()
    await softDeleteTemplate(ctx, templateId)
    revalidatePath('/checklists')
    return { ok: true }
  } catch (error) {
    return toResult(error)
  }
}
