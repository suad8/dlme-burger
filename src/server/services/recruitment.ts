import 'server-only'
import type { CandidateStage, RecruitmentStatus } from '@prisma/client'
import { prisma } from '../db'
import { authorize } from '../rbac'
import type { TenantContext } from '../tenant'
import { branchFilter } from '../tenant'
import { recordAudit } from '../audit'
import { toNumber } from '@/lib/utils'

/**
 * التوظيف.
 *
 * المرشّح يحمل بيانات شخصية (اسم، جوال، بريد، سيرة ذاتية). لذلك:
 * — كل استعلام مقيّد بـ organizationId مباشرةً، لا وراثةً عبر الطلب.
 * — السيرة الذاتية مرفق يمرّ بمسار الرابط الموقّع، ولا يُخزَّن رابطها الدائم.
 * — الحذف يزيل المرشّح ومرفقاته: حق شخص في ألا تبقى سيرته بعد رفضه.
 */

export class RecruitmentNotFoundError extends Error {
  constructor() {
    super('العنصر غير موجود.')
    this.name = 'RecruitmentNotFoundError'
  }
}

export class RecruitmentInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecruitmentInputError'
  }
}

export const REQUEST_STATUS_LABELS: Record<RecruitmentStatus, string> = {
  DRAFT: 'مسودة',
  OPEN: 'مفتوح',
  SCREENING: 'فرز',
  INTERVIEWING: 'مقابلات',
  OFFER: 'عرض وظيفي',
  CLOSED: 'مغلق',
  CANCELLED: 'ملغي',
}

export const STAGE_LABELS: Record<CandidateStage, string> = {
  APPLIED: 'تقدّم',
  SCREENING: 'فرز',
  INTERVIEW: 'مقابلة',
  OFFER: 'عرض',
  HIRED: 'تم التعيين',
  REJECTED: 'مرفوض',
}

/** ترتيب مسار المرشّح. التراجع مسموح: قرار بشري قد يُراجَع. */
export const STAGE_ORDER: CandidateStage[] = [
  'APPLIED',
  'SCREENING',
  'INTERVIEW',
  'OFFER',
  'HIRED',
]

export interface RequestRow {
  id: string
  position: string
  quantity: number
  status: RecruitmentStatus
  statusLabel: string
  branchName: string | null
  salaryMin: number | null
  salaryMax: number | null
  neededBy: Date | null
  createdAt: Date
  candidateCount: number
  hiredCount: number
}

export async function listRequests(ctx: TenantContext): Promise<RequestRow[]> {
  authorize(ctx, 'recruitment:view')

  const rows = await prisma.recruitmentRequest.findMany({
    where: {
      organizationId: ctx.organizationId,
      // مدير الفرع يرى طلبات فرعه فقط، والطلبات غير المرتبطة بفرع
      ...(ctx.branchScope === null
        ? {}
        : { OR: [{ branchId: null }, { branchId: { in: [...ctx.branchScope] } }] }),
    },
    select: {
      id: true,
      position: true,
      quantity: true,
      status: true,
      salaryMin: true,
      salaryMax: true,
      neededBy: true,
      createdAt: true,
      branch: { select: { name: true } },
      candidates: { select: { stage: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return rows.map((r) => ({
    id: r.id,
    position: r.position,
    quantity: r.quantity,
    status: r.status,
    statusLabel: REQUEST_STATUS_LABELS[r.status],
    branchName: r.branch?.name ?? null,
    salaryMin: r.salaryMin === null ? null : toNumber(r.salaryMin),
    salaryMax: r.salaryMax === null ? null : toNumber(r.salaryMax),
    neededBy: r.neededBy,
    createdAt: r.createdAt,
    candidateCount: r.candidates.length,
    hiredCount: r.candidates.filter((c) => c.stage === 'HIRED').length,
  }))
}

export interface CandidateRow {
  id: string
  fullName: string
  phone: string | null
  email: string | null
  stage: CandidateStage
  stageLabel: string
  rating: number | null
  notes: string | null
  createdAt: Date
  hasResume: boolean
}

export interface RequestDetail extends RequestRow {
  description: string | null
  candidates: CandidateRow[]
}

export async function getRequest(
  ctx: TenantContext,
  requestId: string,
): Promise<RequestDetail> {
  authorize(ctx, 'recruitment:view')

  const request = await prisma.recruitmentRequest.findFirst({
    where: {
      id: requestId,
      organizationId: ctx.organizationId,
      ...(ctx.branchScope === null
        ? {}
        : { OR: [{ branchId: null }, { branchId: { in: [...ctx.branchScope] } }] }),
    },
    select: {
      id: true,
      position: true,
      quantity: true,
      status: true,
      description: true,
      salaryMin: true,
      salaryMax: true,
      neededBy: true,
      createdAt: true,
      branch: { select: { name: true } },
      candidates: {
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          stage: true,
          rating: true,
          notes: true,
          createdAt: true,
          attachments: { select: { id: true }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!request) throw new RecruitmentNotFoundError()

  return {
    id: request.id,
    position: request.position,
    quantity: request.quantity,
    status: request.status,
    statusLabel: REQUEST_STATUS_LABELS[request.status],
    description: request.description,
    branchName: request.branch?.name ?? null,
    salaryMin: request.salaryMin === null ? null : toNumber(request.salaryMin),
    salaryMax: request.salaryMax === null ? null : toNumber(request.salaryMax),
    neededBy: request.neededBy,
    createdAt: request.createdAt,
    candidateCount: request.candidates.length,
    hiredCount: request.candidates.filter((c) => c.stage === 'HIRED').length,
    candidates: request.candidates.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      phone: c.phone,
      email: c.email,
      stage: c.stage,
      stageLabel: STAGE_LABELS[c.stage],
      rating: c.rating,
      notes: c.notes,
      createdAt: c.createdAt,
      hasResume: c.attachments.length > 0,
    })),
  }
}

export async function createRequest(
  ctx: TenantContext,
  input: {
    position: string
    quantity: number
    branchId: string | null
    description: string | null
    salaryMin: number | null
    salaryMax: number | null
    neededBy: Date | null
  },
): Promise<{ id: string }> {
  authorize(ctx, 'recruitment:create')

  const position = input.position.trim()
  if (position.length < 2) {
    throw new RecruitmentInputError('أدخل المسمّى الوظيفي.')
  }
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 500) {
    throw new RecruitmentInputError('العدد المطلوب بين ١ و٥٠٠.')
  }
  if (
    input.salaryMin !== null &&
    input.salaryMax !== null &&
    input.salaryMin > input.salaryMax
  ) {
    throw new RecruitmentInputError('الحد الأدنى للراتب أعلى من الحد الأعلى.')
  }

  if (input.branchId) {
    const branch = await prisma.branch.findFirst({
      where: {
        id: input.branchId,
        organizationId: ctx.organizationId,
        deletedAt: null,
        ...(ctx.branchScope === null
          ? {}
          : { AND: [{ id: { in: [...ctx.branchScope] } }] }),
      },
      select: { id: true },
    })
    if (!branch) throw new RecruitmentInputError('الفرع المختار غير متاح لك.')
  }

  const created = await prisma.recruitmentRequest.create({
    data: {
      organizationId: ctx.organizationId,
      position,
      quantity: input.quantity,
      status: 'OPEN',
      branchId: input.branchId,
      description: input.description?.trim().slice(0, 4000) || null,
      salaryMin: input.salaryMin === null ? null : input.salaryMin.toFixed(2),
      salaryMax: input.salaryMax === null ? null : input.salaryMax.toFixed(2),
      neededBy: input.neededBy,
    },
    select: { id: true },
  })

  await recordAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'recruitment.request_created',
    entityType: 'RecruitmentRequest',
    entityId: created.id,
    after: { position, quantity: input.quantity },
  })

  return created
}

export async function setRequestStatus(
  ctx: TenantContext,
  requestId: string,
  status: RecruitmentStatus,
): Promise<void> {
  authorize(ctx, 'recruitment:update')

  const request = await prisma.recruitmentRequest.findFirst({
    where: { id: requestId, organizationId: ctx.organizationId },
    select: { id: true, status: true },
  })
  if (!request) throw new RecruitmentNotFoundError()

  await prisma.recruitmentRequest.update({
    where: { id: request.id },
    data: { status },
  })

  await recordAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'recruitment.request_status',
    entityType: 'RecruitmentRequest',
    entityId: request.id,
    before: { status: request.status },
    after: { status },
  })
}

export async function addCandidate(
  ctx: TenantContext,
  input: {
    requestId: string
    fullName: string
    phone: string | null
    email: string | null
    notes: string | null
  },
): Promise<{ id: string }> {
  authorize(ctx, 'recruitment:create')

  const fullName = input.fullName.trim()
  if (fullName.length < 2) {
    throw new RecruitmentInputError('أدخل اسم المرشّح.')
  }

  const request = await prisma.recruitmentRequest.findFirst({
    where: { id: input.requestId, organizationId: ctx.organizationId },
    select: { id: true, status: true },
  })
  if (!request) throw new RecruitmentNotFoundError()
  if (request.status === 'CLOSED' || request.status === 'CANCELLED') {
    throw new RecruitmentInputError('الطلب مغلق — لا يقبل مرشّحين جددًا.')
  }

  const created = await prisma.candidate.create({
    data: {
      // العمود صريح: لا نعتمد على الطلب في العزل
      organizationId: ctx.organizationId,
      requestId: request.id,
      fullName,
      phone: input.phone?.trim() || null,
      email: input.email?.trim().toLowerCase() || null,
      notes: input.notes?.trim().slice(0, 4000) || null,
    },
    select: { id: true },
  })

  await recordAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'recruitment.candidate_added',
    entityType: 'Candidate',
    entityId: created.id,
    // الاسم فقط. الجوال والبريد بيانات شخصية لا تُكرَّر في سجل التدقيق.
    after: { requestId: request.id },
  })

  return created
}

export async function moveCandidate(
  ctx: TenantContext,
  candidateId: string,
  stage: CandidateStage,
  rating: number | null,
): Promise<void> {
  authorize(ctx, 'recruitment:update')

  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    throw new RecruitmentInputError('التقييم من ١ إلى ٥.')
  }

  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, organizationId: ctx.organizationId },
    select: { id: true, stage: true },
  })
  if (!candidate) throw new RecruitmentNotFoundError()

  await prisma.candidate.update({
    where: { id: candidate.id },
    data: { stage, ...(rating === null ? {} : { rating }) },
  })

  await recordAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'recruitment.candidate_stage',
    entityType: 'Candidate',
    entityId: candidate.id,
    before: { stage: candidate.stage },
    after: { stage },
  })
}

/**
 * حذف المرشّح. المرفقات تسقط مع السجل بقيد CASCADE، لكن ملفات المخزن لا
 * تعرف شيئًا عن قاعدة البيانات — فنحذفها صراحةً أولًا.
 */
export async function deleteCandidate(
  ctx: TenantContext,
  candidateId: string,
): Promise<void> {
  authorize(ctx, 'recruitment:update')

  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, organizationId: ctx.organizationId },
    select: {
      id: true,
      attachments: { select: { id: true, storageKey: true } },
    },
  })
  if (!candidate) throw new RecruitmentNotFoundError()

  const { getStorageProvider } = await import('../storage/provider')
  const storage = getStorageProvider()

  for (const attachment of candidate.attachments) {
    await storage.remove(attachment.storageKey)
  }

  await prisma.candidate.delete({ where: { id: candidate.id } })

  await recordAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'recruitment.candidate_deleted',
    entityType: 'Candidate',
    entityId: candidateId,
    before: { attachments: candidate.attachments.length },
  })
}

export { branchFilter }
