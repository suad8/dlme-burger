'use server'

import { revalidatePath } from 'next/cache'
import type { CandidateStage, RecruitmentStatus } from '@prisma/client'
import { requireTenant } from '@/server/tenant'
import { ForbiddenError } from '@/server/rbac'
import {
  createRequest,
  setRequestStatus,
  addCandidate,
  moveCandidate,
  deleteCandidate,
  RecruitmentInputError,
  RecruitmentNotFoundError,
} from '@/server/services/recruitment'
import { uploadAttachment } from '@/server/services/attachments'
import { InvalidFileError, MAX_FILE_BYTES } from '@/server/storage/provider'

export interface Result<T = undefined> {
  ok: boolean
  message?: string
  data?: T
}

function toMessage<T>(error: unknown, fallback: string): Result<T> {
  if (
    error instanceof RecruitmentInputError ||
    error instanceof RecruitmentNotFoundError ||
    error instanceof InvalidFileError
  ) {
    return { ok: false, message: error.message }
  }
  if (error instanceof ForbiddenError) {
    return { ok: false, message: 'ليست لديك صلاحية لهذا الإجراء.' }
  }
  return { ok: false, message: fallback }
}

const REQUEST_STATUSES: RecruitmentStatus[] = [
  'DRAFT',
  'OPEN',
  'SCREENING',
  'INTERVIEWING',
  'OFFER',
  'CLOSED',
  'CANCELLED',
]

const STAGES: CandidateStage[] = [
  'APPLIED',
  'SCREENING',
  'INTERVIEW',
  'OFFER',
  'HIRED',
  'REJECTED',
]

/** يحوّل نصًا من نموذج إلى رقم، ويرفض ما ليس رقمًا بدل تمرير NaN. */
function optionalNumber(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

export async function createRequestAction(input: {
  position: string
  quantity: string
  branchId: string
  description: string
  salaryMin: string
  salaryMax: string
  neededBy: string
}): Promise<Result<{ id: string }>> {
  try {
    const ctx = await requireTenant()

    const quantity = Number(input.quantity)
    const neededBy = input.neededBy.trim() === '' ? null : new Date(input.neededBy)
    if (neededBy !== null && Number.isNaN(neededBy.getTime())) {
      return { ok: false, message: 'تاريخ غير صحيح.' }
    }

    const created = await createRequest(ctx, {
      position: input.position,
      quantity: Number.isFinite(quantity) ? quantity : 0,
      branchId: input.branchId === '' ? null : input.branchId,
      description: input.description === '' ? null : input.description,
      salaryMin: optionalNumber(input.salaryMin),
      salaryMax: optionalNumber(input.salaryMax),
      neededBy,
    })

    revalidatePath('/recruitment')
    return { ok: true, data: created }
  } catch (error) {
    return toMessage(error, 'تعذّر إنشاء الطلب.')
  }
}

export async function setRequestStatusAction(
  requestId: string,
  status: string,
): Promise<Result> {
  if (!REQUEST_STATUSES.includes(status as RecruitmentStatus)) {
    return { ok: false, message: 'حالة غير معروفة.' }
  }

  try {
    const ctx = await requireTenant()
    await setRequestStatus(ctx, requestId, status as RecruitmentStatus)
    revalidatePath('/recruitment')
    revalidatePath(`/recruitment/${requestId}`)
    return { ok: true }
  } catch (error) {
    return toMessage(error, 'تعذّر تحديث الحالة.')
  }
}

export async function addCandidateAction(input: {
  requestId: string
  fullName: string
  phone: string
  email: string
  notes: string
}): Promise<Result<{ id: string }>> {
  try {
    const ctx = await requireTenant()
    const created = await addCandidate(ctx, {
      requestId: input.requestId,
      fullName: input.fullName,
      phone: input.phone === '' ? null : input.phone,
      email: input.email === '' ? null : input.email,
      notes: input.notes === '' ? null : input.notes,
    })
    revalidatePath(`/recruitment/${input.requestId}`)
    return { ok: true, data: created }
  } catch (error) {
    return toMessage(error, 'تعذّر إضافة المرشّح.')
  }
}

export async function moveCandidateAction(
  candidateId: string,
  stage: string,
  rating: number | null,
): Promise<Result> {
  if (!STAGES.includes(stage as CandidateStage)) {
    return { ok: false, message: 'مرحلة غير معروفة.' }
  }

  try {
    const ctx = await requireTenant()
    await moveCandidate(ctx, candidateId, stage as CandidateStage, rating)
    revalidatePath('/recruitment')
    return { ok: true }
  } catch (error) {
    return toMessage(error, 'تعذّر نقل المرشّح.')
  }
}

export async function deleteCandidateAction(
  candidateId: string,
): Promise<Result> {
  try {
    const ctx = await requireTenant()
    await deleteCandidate(ctx, candidateId)
    revalidatePath('/recruitment')
    return { ok: true }
  } catch (error) {
    return toMessage(error, 'تعذّر حذف المرشّح.')
  }
}

/**
 * رفع السيرة الذاتية. FormData لا JSON: الملف يصل كبايتات، والنوع المُعلَن
 * لا يُصدَّق — `uploadAttachment` يفحص المحتوى نفسه.
 */
export async function uploadResumeAction(
  formData: FormData,
): Promise<Result<{ id: string }>> {
  const candidateId = formData.get('candidateId')
  const file = formData.get('file')

  if (typeof candidateId !== 'string' || candidateId === '') {
    return { ok: false, message: 'مرشّح غير معروف.' }
  }
  if (!(file instanceof File)) {
    return { ok: false, message: 'اختر ملفًا.' }
  }
  if (file.size === 0) {
    return { ok: false, message: 'الملف فارغ.' }
  }
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      message: `الحد الأعلى ${Math.floor(MAX_FILE_BYTES / (1024 * 1024))} ميغابايت.`,
    }
  }

  try {
    const ctx = await requireTenant()
    const buffer = Buffer.from(await file.arrayBuffer())

    const attachment = await uploadAttachment(ctx, {
      target: { kind: 'candidate', candidateId },
      fileName: file.name,
      mimeType: file.type,
      data: buffer,
    })

    revalidatePath('/recruitment')
    return { ok: true, data: { id: attachment.id } }
  } catch (error) {
    return toMessage(error, 'تعذّر رفع الملف.')
  }
}
