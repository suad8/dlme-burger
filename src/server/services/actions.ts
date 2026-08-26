import 'server-only'
import { ActionStatus, ActionPriority, type Prisma } from '@prisma/client'
import { prisma } from '../db'
import { authorize } from '../rbac'
import { assertBranchInScope, branchFilter, type TenantContext } from '../tenant'
import { recordAudit } from '../audit'
import type { CorrectiveActionInput } from '@/lib/validation'

/**
 * الإجراءات التصحيحية.
 *
 * سير الحالات صريح ومقيَّد: لا يُسمح بأي انتقال غير معرّف هنا. هذا يمنع
 * "إكمال" إجراء لم يبدأ، أو إعادة فتح إجراء معتمد من الواجهة.
 */

const ALLOWED_TRANSITIONS: Record<ActionStatus, ActionStatus[]> = {
  NEW: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['PENDING_REVIEW', 'CANCELLED'],
  PENDING_REVIEW: ['COMPLETED', 'IN_PROGRESS'],
  OVERDUE: ['IN_PROGRESS', 'PENDING_REVIEW', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
}

export class InvalidTransitionError extends Error {
  override readonly name = 'InvalidTransitionError'
  constructor(from: ActionStatus, to: ActionStatus) {
    super(`انتقال غير مسموح: من ${STATUS_LABELS[from]} إلى ${STATUS_LABELS[to]}.`)
  }
}

export const STATUS_LABELS: Record<ActionStatus, string> = {
  NEW: 'جديد',
  IN_PROGRESS: 'قيد التنفيذ',
  PENDING_REVIEW: 'بانتظار المراجعة',
  COMPLETED: 'مكتمل',
  OVERDUE: 'متأخر',
  CANCELLED: 'ملغي',
}

export const PRIORITY_LABELS: Record<ActionPriority, string> = {
  LOW: 'منخفضة',
  MEDIUM: 'متوسطة',
  HIGH: 'عالية',
  CRITICAL: 'حرجة',
}

export function allowedNextStates(from: ActionStatus): ActionStatus[] {
  return ALLOWED_TRANSITIONS[from]
}

export interface ActionListItem {
  id: string
  reference: string
  title: string
  status: ActionStatus
  priority: ActionPriority
  branchName: string
  assigneeName: string | null
  dueAt: Date | null
  isOverdue: boolean
  commentCount: number
}

export interface ActionFilters {
  status?: ActionStatus | 'ALL' | 'OPEN'
  priority?: ActionPriority | 'ALL'
  branchId?: string
  assignedToMe?: boolean
  page?: number
  perPage?: number
}

const OPEN_STATES: ActionStatus[] = ['NEW', 'IN_PROGRESS', 'PENDING_REVIEW', 'OVERDUE']

export async function listActions(
  ctx: TenantContext,
  filters: ActionFilters = {},
): Promise<{ items: ActionListItem[]; total: number; page: number; perPage: number }> {
  authorize(ctx, 'action:view')

  const page = Math.max(1, filters.page ?? 1)
  const perPage = Math.min(100, Math.max(5, filters.perPage ?? 20))

  const statusFilter: Prisma.CorrectiveActionWhereInput =
    filters.status === 'OPEN'
      ? { status: { in: OPEN_STATES } }
      : filters.status && filters.status !== 'ALL'
        ? { status: filters.status }
        : {}

  const where: Prisma.CorrectiveActionWhereInput = {
    organizationId: ctx.organizationId,
    ...branchFilter(ctx),
    ...statusFilter,
    ...(filters.priority && filters.priority !== 'ALL'
      ? { priority: filters.priority }
      : {}),
    ...(filters.branchId ? { branchId: filters.branchId } : {}),
    ...(filters.assignedToMe ? { assigneeId: ctx.userId } : {}),
  }

  const now = new Date()

  const [rows, total] = await Promise.all([
    prisma.correctiveAction.findMany({
      where,
      select: {
        id: true,
        reference: true,
        title: true,
        status: true,
        priority: true,
        dueAt: true,
        branch: { select: { name: true } },
        assignee: { select: { name: true } },
        _count: { select: { comments: true } },
      },
      orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.correctiveAction.count({ where }),
  ])

  return {
    items: rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      title: r.title,
      status: r.status,
      priority: r.priority,
      branchName: r.branch.name,
      assigneeName: r.assignee?.name ?? null,
      dueAt: r.dueAt,
      isOverdue:
        r.dueAt !== null &&
        r.dueAt < now &&
        !['COMPLETED', 'CANCELLED'].includes(r.status),
      commentCount: r._count.comments,
    })),
    total,
    page,
    perPage,
  }
}

/** توزيع الإجراءات على الحالات — يغذّي عرض Kanban. */
export async function getActionBoard(ctx: TenantContext) {
  authorize(ctx, 'action:view')

  const rows = await prisma.correctiveAction.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...branchFilter(ctx),
      status: { in: OPEN_STATES },
    },
    select: {
      id: true,
      reference: true,
      title: true,
      status: true,
      priority: true,
      dueAt: true,
      branch: { select: { name: true } },
      assignee: { select: { name: true } },
    },
    orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }],
    take: 200,
  })

  const columns: Record<string, typeof rows> = {
    NEW: [],
    IN_PROGRESS: [],
    PENDING_REVIEW: [],
    OVERDUE: [],
  }
  for (const r of rows) {
    columns[r.status]?.push(r)
  }
  return columns
}

export async function getAction(ctx: TenantContext, actionId: string) {
  authorize(ctx, 'action:view')

  return prisma.correctiveAction.findFirst({
    where: {
      id: actionId,
      organizationId: ctx.organizationId,
      ...branchFilter(ctx),
    },
    select: {
      id: true,
      reference: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueAt: true,
      completedAt: true,
      approvedAt: true,
      createdAt: true,
      version: true,
      branch: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      inspection: { select: { id: true, reference: true } },
      comments: {
        where: { deletedAt: null },
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
}

export async function createAction(
  ctx: TenantContext,
  input: CorrectiveActionInput,
): Promise<string> {
  authorize(ctx, 'action:create')
  assertBranchInScope(ctx, input.branchId)

  const branch = await prisma.branch.findFirst({
    where: {
      id: input.branchId,
      organizationId: ctx.organizationId,
      deletedAt: null,
    },
    select: { id: true },
  })
  if (!branch) throw new Error('الفرع غير موجود ضمن منشأتك.')

  // المسؤول يجب أن يكون عضوًا فعّالًا في نفس المنشأة
  if (input.assigneeId) {
    const member = await prisma.membership.findFirst({
      where: {
        userId: input.assigneeId,
        organizationId: ctx.organizationId,
        status: 'ACTIVE',
      },
      select: { id: true },
    })
    if (!member) throw new Error('المسؤول المحدد ليس عضوًا في منشأتك.')
  }

  const id = await prisma.$transaction(async (tx) => {
    const count = await tx.correctiveAction.count({
      where: { organizationId: ctx.organizationId },
    })
    const created = await tx.correctiveAction.create({
      data: {
        organizationId: ctx.organizationId,
        branchId: branch.id,
        createdById: ctx.userId,
        assigneeId: input.assigneeId || null,
        reference: `CA-${String(count + 1).padStart(4, '0')}`,
        title: input.title,
        description: input.description || null,
        priority: input.priority,
        status: ActionStatus.NEW,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
      },
      select: { id: true },
    })
    return created.id
  })

  await recordAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'action.created',
    entityType: 'CorrectiveAction',
    entityId: id,
    after: input,
  })

  return id
}

export async function transitionAction(
  ctx: TenantContext,
  actionId: string,
  to: ActionStatus,
): Promise<void> {
  // الاعتماد صلاحية منفصلة عن التعديل
  authorize(ctx, to === ActionStatus.COMPLETED ? 'action:approve' : 'action:update')

  const current = await prisma.correctiveAction.findFirst({
    where: {
      id: actionId,
      organizationId: ctx.organizationId,
      ...branchFilter(ctx),
    },
    select: { id: true, status: true, version: true },
  })
  if (!current) throw new Error('الإجراء غير موجود.')

  if (!ALLOWED_TRANSITIONS[current.status].includes(to)) {
    throw new InvalidTransitionError(current.status, to)
  }

  const result = await prisma.correctiveAction.updateMany({
    where: {
      id: actionId,
      organizationId: ctx.organizationId,
      version: current.version,
    },
    data: {
      status: to,
      completedAt: to === ActionStatus.COMPLETED ? new Date() : null,
      approvedAt: to === ActionStatus.COMPLETED ? new Date() : null,
      approvedById: to === ActionStatus.COMPLETED ? ctx.userId : null,
      version: { increment: 1 },
    },
  })

  if (result.count === 0) {
    throw new Error('تم تعديل هذا الإجراء من جهة أخرى. حدّث الصفحة وأعد المحاولة.')
  }

  await recordAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'action.transitioned',
    entityType: 'CorrectiveAction',
    entityId: actionId,
    before: { status: current.status },
    after: { status: to },
  })
}

export async function addComment(
  ctx: TenantContext,
  actionId: string,
  body: string,
): Promise<void> {
  authorize(ctx, 'action:update')

  const trimmed = body.trim()
  if (!trimmed) throw new Error('التعليق فارغ.')
  if (trimmed.length > 2000) throw new Error('التعليق طويل جدًا.')

  const action = await prisma.correctiveAction.findFirst({
    where: {
      id: actionId,
      organizationId: ctx.organizationId,
      ...branchFilter(ctx),
    },
    select: { id: true },
  })
  if (!action) throw new Error('الإجراء غير موجود.')

  await prisma.comment.create({
    data: {
      organizationId: ctx.organizationId,
      authorId: ctx.userId,
      correctiveActionId: actionId,
      body: trimmed,
    },
  })
}

/** يضع علامة "متأخر" على ما تجاوز موعده — يُستدعى من مهمة مجدولة. */
export async function markOverdueActions(organizationId: string): Promise<number> {
  const result = await prisma.correctiveAction.updateMany({
    where: {
      organizationId,
      status: { in: ['NEW', 'IN_PROGRESS'] },
      dueAt: { lt: new Date() },
    },
    data: { status: ActionStatus.OVERDUE },
  })
  return result.count
}

export async function listAssignableMembers(ctx: TenantContext) {
  authorize(ctx, 'action:view')
  const members = await prisma.membership.findMany({
    where: { organizationId: ctx.organizationId, status: 'ACTIVE' },
    select: { user: { select: { id: true, name: true } } },
    orderBy: { user: { name: 'asc' } },
  })
  return members.map((m) => m.user)
}
