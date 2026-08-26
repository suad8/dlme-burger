'use server'

import { revalidatePath } from 'next/cache'
import { requireTenant } from '@/server/tenant'
import {
  startInspection,
  saveAnswers,
  submitInspection,
  approveInspection,
  MissingRequiredError,
  type AnswerInput,
} from '@/server/services/inspections'
import { ForbiddenError } from '@/server/rbac'

export interface ActionResult<T = undefined> {
  ok: boolean
  message?: string
  data?: T
}

/**
 * يحوّل أخطاء الخادم إلى رسائل عربية دون تسريب تفاصيل داخلية.
 * عام في T حتى يصلح لأي دالة مهما كانت حمولة نجاحها — نتيجة الفشل بلا data.
 */
function toResult<T>(error: unknown): ActionResult<T> {
  if (error instanceof MissingRequiredError) {
    return { ok: false, message: error.message }
  }
  if (error instanceof ForbiddenError) {
    return { ok: false, message: 'ليست لديك صلاحية لهذه العملية.' }
  }
  if (error instanceof Error) {
    return { ok: false, message: error.message }
  }
  return { ok: false, message: 'حدث خطأ غير متوقع.' }
}

export async function startInspectionAction(
  branchId: string,
  templateId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireTenant()
    const id = await startInspection(ctx, { branchId, templateId })
    revalidatePath('/inspections')
    return { ok: true, data: { id } }
  } catch (error) {
    return toResult(error)
  }
}

export async function saveAnswersAction(
  inspectionId: string,
  answers: AnswerInput[],
): Promise<ActionResult> {
  try {
    const ctx = await requireTenant()
    await saveAnswers(ctx, inspectionId, answers)
    return { ok: true }
  } catch (error) {
    return toResult(error)
  }
}

export async function submitInspectionAction(
  inspectionId: string,
  answers: AnswerInput[],
): Promise<ActionResult<{ score: number; passed: boolean; criticalFailures: string[] }>> {
  try {
    const ctx = await requireTenant()
    const result = await submitInspection(ctx, inspectionId, answers)
    revalidatePath('/inspections')
    revalidatePath('/dashboard')
    revalidatePath('/actions')
    return {
      ok: true,
      data: {
        score: result.score,
        passed: result.passed,
        criticalFailures: result.criticalFailures,
      },
    }
  } catch (error) {
    return toResult(error)
  }
}

export async function approveInspectionAction(
  inspectionId: string,
): Promise<ActionResult> {
  try {
    const ctx = await requireTenant()
    await approveInspection(ctx, inspectionId)
    revalidatePath('/inspections')
    revalidatePath(`/inspections/${inspectionId}`)
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (error) {
    return toResult(error)
  }
}
