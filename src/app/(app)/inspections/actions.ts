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
import { uploadAttachment, deleteAttachment } from '@/server/services/attachments'
import { InvalidFileError, MAX_FILE_BYTES } from '@/server/storage/provider'

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

/* ── المرفقات ─────────────────────────────────────────────── */

/**
 * رفع صورة دليل.
 *
 * يستقبل FormData لا JSON: تمرير ملف ثنائي كـbase64 داخل JSON يضخّم الحمولة
 * ٣٣٪ ويستهلك ذاكرة الخادم بلا داعٍ.
 */
export async function uploadEvidenceAction(
  formData: FormData,
): Promise<ActionResult<{ id: string; url: string; fileName: string }>> {
  try {
    const ctx = await requireTenant()

    const file = formData.get('file')
    const inspectionId = formData.get('inspectionId')
    const answerId = formData.get('answerId')
    const phase = formData.get('phase')

    if (!(file instanceof File)) {
      return { ok: false, message: 'لم يُرفق ملف.' }
    }
    if (typeof inspectionId !== 'string' || !inspectionId) {
      return { ok: false, message: 'الزيارة غير محددة.' }
    }
    if (file.size > MAX_FILE_BYTES) {
      return { ok: false, message: 'حجم الملف يتجاوز ٨ ميغابايت.' }
    }

    const data = Buffer.from(await file.arrayBuffer())

    const attachment = await uploadAttachment(ctx, {
      target:
        typeof answerId === 'string' && answerId
          ? { kind: 'answer', inspectionId, answerId }
          : { kind: 'inspection', inspectionId },
      fileName: file.name,
      mimeType: file.type,
      data,
      phase: phase === 'before' || phase === 'after' ? phase : undefined,
    })

    revalidatePath(`/inspections/${inspectionId}`)
    return {
      ok: true,
      data: {
        id: attachment.id,
        url: attachment.url,
        fileName: attachment.fileName,
      },
    }
  } catch (error) {
    if (error instanceof InvalidFileError) {
      return { ok: false, message: error.message }
    }
    return toResult(error)
  }
}

export async function deleteEvidenceAction(
  attachmentId: string,
  inspectionId: string,
): Promise<ActionResult> {
  try {
    const ctx = await requireTenant()
    await deleteAttachment(ctx, attachmentId)
    revalidatePath(`/inspections/${inspectionId}`)
    return { ok: true }
  } catch (error) {
    return toResult(error)
  }
}
