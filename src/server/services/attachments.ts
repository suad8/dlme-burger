import 'server-only'
import { prisma } from '../db'
import { authorize, type Permission } from '../rbac'
import { branchFilter, type TenantContext } from '../tenant'
import { recordAudit } from '../audit'
import {
  getStorageProvider,
  buildSignedUrl,
  InvalidFileError,
  organizationFromKey,
} from '../storage/provider'

/**
 * المرفقات — الجسر بين قاعدة البيانات والمخزن.
 *
 * لا يُحفظ محتوى الملف في قاعدة البيانات إطلاقًا، بل `storageKey` فقط. وكل
 * قراءة تتحقق أن المفتاح يخص منشأة الطالب قبل أي وصول للقرص.
 */

export type AttachmentTarget =
  | { kind: 'inspection'; inspectionId: string }
  | { kind: 'answer'; inspectionId: string; answerId: string }
  | { kind: 'action'; correctiveActionId: string }
  | { kind: 'candidate'; candidateId: string }

export interface UploadInput {
  target: AttachmentTarget
  fileName: string
  mimeType: string
  data: Buffer
  /** «before» أو «after» للزيارات الميدانية. */
  phase?: 'before' | 'after'
}

export interface AttachmentView {
  id: string
  fileName: string
  mimeType: string
  sizeBytes: number
  phase: string | null
  createdAt: Date
  /** رابط موقّع قصير الأجل — لا يُخزَّن ولا يُشارك. */
  url: string
}

const PERMISSION_BY_KIND: Record<AttachmentTarget['kind'], Permission> = {
  inspection: 'inspection:update',
  answer: 'inspection:update',
  action: 'action:update',
  // السيرة الذاتية مستند شخصي: يقف عند من يدير التوظيف لا عند كل من يرى الزيارات
  candidate: 'recruitment:update',
}

/** يتأكد أن الهدف يخص منشأة الطالب ونطاق فروعه. */
async function assertTargetOwned(
  ctx: TenantContext,
  target: AttachmentTarget,
): Promise<void> {
  if (target.kind === 'candidate') {
    const found = await prisma.candidate.findFirst({
      where: { id: target.candidateId, organizationId: ctx.organizationId },
      select: { id: true },
    })
    if (!found) throw new Error('المرشّح غير موجود ضمن منشأتك.')
    return
  }

  if (target.kind === 'action') {
    const found = await prisma.correctiveAction.findFirst({
      where: {
        id: target.correctiveActionId,
        organizationId: ctx.organizationId,
        ...branchFilter(ctx),
      },
      select: { id: true },
    })
    if (!found) throw new Error('الإجراء غير موجود ضمن منشأتك.')
    return
  }

  const found = await prisma.inspection.findFirst({
    where: {
      id: target.inspectionId,
      organizationId: ctx.organizationId,
      ...branchFilter(ctx),
    },
    select: { id: true },
  })
  if (!found) throw new Error('الزيارة غير موجودة ضمن منشأتك.')

  if (target.kind === 'answer') {
    // الإجابة يجب أن تخص نفس الزيارة — لا ربط عابر
    const answer = await prisma.inspectionAnswer.findFirst({
      where: { id: target.answerId, inspectionId: target.inspectionId },
      select: { id: true },
    })
    if (!answer) throw new Error('البند غير موجود ضمن هذه الزيارة.')
  }
}

export async function uploadAttachment(
  ctx: TenantContext,
  input: UploadInput,
): Promise<AttachmentView> {
  authorize(ctx, PERMISSION_BY_KIND[input.target.kind])
  await assertTargetOwned(ctx, input.target)

  const storage = getStorageProvider()

  // assertValidFile داخل put يفحص المحتوى الفعلي لا النوع المُعلَن
  const stored = await storage.put({
    organizationId: ctx.organizationId,
    scope:
      input.target.kind === 'action'
        ? 'actions'
        : input.target.kind === 'candidate'
          ? 'candidates'
          : 'inspections',
    fileName: input.fileName,
    mimeType: input.mimeType,
    data: input.data,
  })

  const attachment = await prisma.attachment.create({
    data: {
      organizationId: ctx.organizationId,
      fileName: stored.fileName,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      storageKey: stored.storageKey,
      phase: input.phase ?? null,
      uploadedById: ctx.userId,
      inspectionId:
        input.target.kind === 'inspection' || input.target.kind === 'answer'
          ? input.target.inspectionId
          : null,
      answerId: input.target.kind === 'answer' ? input.target.answerId : null,
      correctiveActionId:
        input.target.kind === 'action' ? input.target.correctiveActionId : null,
      candidateId:
        input.target.kind === 'candidate' ? input.target.candidateId : null,
      kind: input.target.kind === 'candidate' ? 'resume' : 'evidence',
    },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      phase: true,
      createdAt: true,
      storageKey: true,
    },
  })

  await recordAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'attachment.uploaded',
    entityType: 'Attachment',
    entityId: attachment.id,
    // لا نسجّل المحتوى — الاسم والنوع والحجم تكفي للتتبّع
    after: {
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
    },
  })

  return {
    id: attachment.id,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    phase: attachment.phase,
    createdAt: attachment.createdAt,
    url: buildSignedUrl(attachment.storageKey),
  }
}

export async function listAttachments(
  ctx: TenantContext,
  target: AttachmentTarget,
): Promise<AttachmentView[]> {
  authorize(
    ctx,
    target.kind === 'action'
      ? 'action:view'
      : target.kind === 'candidate'
        ? 'recruitment:view'
        : 'inspection:view',
  )

  const rows = await prisma.attachment.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(target.kind === 'action'
        ? { correctiveActionId: target.correctiveActionId }
        : target.kind === 'candidate'
          ? { candidateId: target.candidateId }
          : target.kind === 'answer'
            ? { answerId: target.answerId }
            : { inspectionId: target.inspectionId }),
    },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      phase: true,
      createdAt: true,
      storageKey: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  return rows.map((r) => ({
    id: r.id,
    fileName: r.fileName,
    mimeType: r.mimeType,
    sizeBytes: r.sizeBytes,
    phase: r.phase,
    createdAt: r.createdAt,
    url: buildSignedUrl(r.storageKey),
  }))
}

export async function deleteAttachment(
  ctx: TenantContext,
  attachmentId: string,
): Promise<void> {
  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, organizationId: ctx.organizationId },
    select: {
      id: true,
      storageKey: true,
      fileName: true,
      candidateId: true,
      correctiveActionId: true,
    },
  })
  if (!attachment) throw new Error('المرفق غير موجود.')

  // الصلاحية تُشتق من نوع المرفق لا من افتراض واحد: من يعدّل الزيارات يجب
  // ألا يملك حذف سيرة ذاتية لمرشّح.
  authorize(
    ctx,
    attachment.candidateId
      ? 'recruitment:update'
      : attachment.correctiveActionId
        ? 'action:update'
        : 'inspection:update',
  )

  // السجل أولًا ثم الملف: مرفق بلا ملف أهون من ملف بلا سجل يشير إليه
  await prisma.attachment.delete({ where: { id: attachment.id } })
  await getStorageProvider().remove(attachment.storageKey)

  await recordAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'attachment.deleted',
    entityType: 'Attachment',
    entityId: attachmentId,
    before: { fileName: attachment.fileName },
  })
}

/**
 * يقرأ ملفًا لتقديمه بعد التحقق من التوقيع.
 *
 * ⚠️ التوقيع وحده لا يكفي: رابط مسرَّب من منشأة أخرى يبقى صالح التوقيع. لذلك
 * نتحقق أيضًا أن المفتاح يخص منشأة الطالب.
 */
export async function readFileForServing(
  ctx: TenantContext,
  storageKey: string,
): Promise<{ data: Buffer; mimeType: string; fileName: string }> {
  const owner = organizationFromKey(storageKey)
  if (owner !== ctx.organizationId) {
    throw new InvalidFileError('الملف خارج نطاق منشأتك.')
  }

  const record = await prisma.attachment.findFirst({
    where: { storageKey, organizationId: ctx.organizationId },
    select: {
      mimeType: true,
      fileName: true,
      candidateId: true,
      correctiveActionId: true,
    },
  })
  if (!record) throw new InvalidFileError('الملف غير موجود.')

  /*
   * الصلاحية تُفحص هنا أيضًا، لا عند إصدار الرابط فقط.
   *
   * الرابط الموقّع يُصدَر لمن يرى السجل، لكنه نصّ يمكن تمريره: زميل في نفس
   * المنشأة لا يملك صلاحية التوظيف كان يستطيع فتح سيرة ذاتية بمجرد أن يصله
   * الرابط خلال مدة صلاحيته. الصلاحية تُشتق من نوع المرفق كما في الحذف.
   */
  authorize(
    ctx,
    record.candidateId
      ? 'recruitment:view'
      : record.correctiveActionId
        ? 'action:view'
        : 'inspection:view',
  )

  const data = await getStorageProvider().get(storageKey)
  return { data, mimeType: record.mimeType, fileName: record.fileName }
}
