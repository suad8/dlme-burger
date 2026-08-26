import 'server-only'
import {
  ChecklistItemType,
  InspectionStatus,
  type Prisma,
} from '@prisma/client'
import { prisma } from '../db'
import { authorize } from '../rbac'
import { assertBranchInScope, branchFilter, type TenantContext } from '../tenant'
import { recordAudit } from '../audit'
import { toNumber } from '@/lib/utils'

/**
 * منطق الفحوصات والزيارات.
 *
 * قاعدة الاحتساب: كل بند له وزن. البنود القابلة للتسجيل (نعم/لا، درجة، اختيار
 * متعدد) تدخل في المقام؛ الحقول الوصفية (نص، صورة، توقيع) لا تدخل لأنها لا
 * تُقيَّم. البند الحرج الفاشل يُسقط النتيجة إلى صفر مهما كان الباقي — مخالفة
 * سلامة غذاء واحدة لا يعوّضها ترتيب مخزن ممتاز.
 */

const SCORABLE: ReadonlySet<ChecklistItemType> = new Set([
  ChecklistItemType.YES_NO,
  ChecklistItemType.SCORE,
  ChecklistItemType.MULTIPLE_CHOICE,
])

export interface AnswerInput {
  itemId: string
  valueBool?: boolean | null
  valueText?: string | null
  valueNumber?: number | null
  valueChoice?: string | null
  scoreAwarded?: number | null
  note?: string | null
}

export interface ScoreResult {
  score: number
  maxScore: number
  passed: boolean
  criticalFailures: string[]
}

interface ScorableItem {
  id: string
  label: string
  type: ChecklistItemType
  weight: number
  maxScore: number | null
  required: boolean
  criticalFail: boolean
}

/** يحتسب النتيجة. دالة نقية — مختبَرة مستقلة عن قاعدة البيانات. */
export function computeScore(
  items: ScorableItem[],
  answers: Map<string, AnswerInput>,
  passScore: number,
): ScoreResult {
  let earned = 0
  let possible = 0
  const criticalFailures: string[] = []

  for (const item of items) {
    const answer = answers.get(item.id)
    const failedCritical =
      item.criticalFail && answer !== undefined && isFailure(item, answer)

    if (failedCritical) criticalFailures.push(item.label)

    if (!SCORABLE.has(item.type)) continue

    const itemMax = item.type === ChecklistItemType.SCORE ? (item.maxScore ?? 5) : 1
    possible += itemMax * item.weight

    if (!answer) continue

    if (item.type === ChecklistItemType.SCORE) {
      earned += Math.min(answer.scoreAwarded ?? 0, itemMax) * item.weight
    } else if (item.type === ChecklistItemType.YES_NO) {
      earned += (answer.valueBool ? 1 : 0) * item.weight
    } else if (item.type === ChecklistItemType.MULTIPLE_CHOICE) {
      // الخيار الأخير يمثّل الحالة الأسوأ اصطلاحًا في قوالبنا
      earned += answer.valueChoice ? 1 * item.weight : 0
    }
  }

  const pct = possible === 0 ? 0 : (earned / possible) * 100
  const finalScore = criticalFailures.length > 0 ? 0 : Number(pct.toFixed(2))

  return {
    score: finalScore,
    maxScore: 100,
    passed: criticalFailures.length === 0 && pct >= passScore,
    criticalFailures,
  }
}

function isFailure(item: ScorableItem, answer: AnswerInput): boolean {
  switch (item.type) {
    case ChecklistItemType.YES_NO:
      return answer.valueBool === false
    case ChecklistItemType.SCORE: {
      const max = item.maxScore ?? 5
      return (answer.scoreAwarded ?? 0) < max / 2
    }
    case ChecklistItemType.NUMBER:
      // الحرارة خارج النطاق الآمن للتبريد
      return answer.valueNumber !== null && answer.valueNumber !== undefined
        ? answer.valueNumber > 8 && answer.valueNumber < 60
        : false
    default:
      return false
  }
}

/* ── القراءة ────────────────────────────────────────────────── */

export interface InspectionListItem {
  id: string
  reference: string
  status: InspectionStatus
  branchName: string
  templateName: string
  inspectorName: string | null
  score: number | null
  passed: boolean | null
  submittedAt: Date | null
  dueAt: Date | null
}

export interface InspectionFilters {
  status?: InspectionStatus | 'ALL'
  branchId?: string
  page?: number
  perPage?: number
}

export async function listInspections(
  ctx: TenantContext,
  filters: InspectionFilters = {},
): Promise<{ items: InspectionListItem[]; total: number; page: number; perPage: number }> {
  authorize(ctx, 'inspection:view')

  const page = Math.max(1, filters.page ?? 1)
  const perPage = Math.min(100, Math.max(5, filters.perPage ?? 20))

  const where: Prisma.InspectionWhereInput = {
    organizationId: ctx.organizationId,
    ...branchFilter(ctx),
    ...(filters.status && filters.status !== 'ALL'
      ? { status: filters.status }
      : {}),
    ...(filters.branchId ? { branchId: filters.branchId } : {}),
  }

  // الترقيم على الخادم — لا نجلب الكل ثم نقطّع
  const [rows, total] = await Promise.all([
    prisma.inspection.findMany({
      where,
      select: {
        id: true,
        reference: true,
        status: true,
        score: true,
        passed: true,
        submittedAt: true,
        dueAt: true,
        branch: { select: { name: true } },
        template: { select: { name: true } },
        inspector: { select: { name: true } },
      },
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.inspection.count({ where }),
  ])

  return {
    items: rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      status: r.status,
      branchName: r.branch.name,
      templateName: r.template.name,
      inspectorName: r.inspector?.name ?? null,
      score: r.score === null ? null : toNumber(r.score),
      passed: r.passed,
      submittedAt: r.submittedAt,
      dueAt: r.dueAt,
    })),
    total,
    page,
    perPage,
  }
}

/** يقرأ زيارة كاملة بأقسامها وبنودها وإجاباتها. null خارج المنشأة. */
export async function getInspectionDetail(
  ctx: TenantContext,
  inspectionId: string,
) {
  authorize(ctx, 'inspection:view')

  const inspection = await prisma.inspection.findFirst({
    where: {
      id: inspectionId,
      organizationId: ctx.organizationId,
      ...branchFilter(ctx),
    },
    select: {
      id: true,
      reference: true,
      status: true,
      score: true,
      passed: true,
      notes: true,
      startedAt: true,
      submittedAt: true,
      approvedAt: true,
      dueAt: true,
      version: true,
      branch: { select: { id: true, name: true } },
      inspector: { select: { name: true } },
      template: {
        select: {
          id: true,
          name: true,
          passScore: true,
          sections: {
            select: {
              id: true,
              title: true,
              items: {
                select: {
                  id: true,
                  label: true,
                  hint: true,
                  type: true,
                  required: true,
                  weight: true,
                  maxScore: true,
                  options: true,
                  criticalFail: true,
                },
                orderBy: { sortOrder: 'asc' },
              },
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
      answers: {
        select: {
          itemId: true,
          valueBool: true,
          valueText: true,
          valueNumber: true,
          valueChoice: true,
          scoreAwarded: true,
          note: true,
          isViolation: true,
        },
      },
    },
  })

  return inspection
}

/* ── الكتابة ────────────────────────────────────────────────── */

async function nextReference(
  tx: Prisma.TransactionClient,
  organizationId: string,
  prefix: string,
  model: 'inspection' | 'correctiveAction',
): Promise<string> {
  const count =
    model === 'inspection'
      ? await tx.inspection.count({ where: { organizationId } })
      : await tx.correctiveAction.count({ where: { organizationId } })
  return `${prefix}-${String(count + 1).padStart(4, '0')}`
}

export async function startInspection(
  ctx: TenantContext,
  params: { branchId: string; templateId: string },
): Promise<string> {
  authorize(ctx, 'inspection:create')
  assertBranchInScope(ctx, params.branchId)

  // الفرع والقالب يجب أن يخصّا المنشأة — منع الربط عبر المستأجرين
  const [branch, template] = await Promise.all([
    prisma.branch.findFirst({
      where: {
        id: params.branchId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
      select: { id: true },
    }),
    prisma.checklistTemplate.findFirst({
      where: {
        id: params.templateId,
        organizationId: ctx.organizationId,
        deletedAt: null,
        isActive: true,
      },
      select: { id: true },
    }),
  ])

  if (!branch) throw new Error('الفرع غير موجود ضمن منشأتك.')
  if (!template) throw new Error('قالب الفحص غير موجود أو غير مفعّل.')

  const inspectionId = await prisma.$transaction(async (tx) => {
    const reference = await nextReference(tx, ctx.organizationId, 'INS', 'inspection')
    const created = await tx.inspection.create({
      data: {
        organizationId: ctx.organizationId,
        branchId: branch.id,
        templateId: template.id,
        inspectorId: ctx.userId,
        reference,
        status: InspectionStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
      select: { id: true },
    })
    return created.id
  })

  await recordAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'inspection.started',
    entityType: 'Inspection',
    entityId: inspectionId,
    after: { branchId: params.branchId, templateId: params.templateId },
  })

  return inspectionId
}

/** حفظ جزئي — يتيح للمفتش المتابعة لاحقًا دون فقد ما أدخله. */
export async function saveAnswers(
  ctx: TenantContext,
  inspectionId: string,
  answers: AnswerInput[],
): Promise<void> {
  authorize(ctx, 'inspection:update')

  const inspection = await prisma.inspection.findFirst({
    where: {
      id: inspectionId,
      organizationId: ctx.organizationId,
      ...branchFilter(ctx),
      status: { in: [InspectionStatus.DRAFT, InspectionStatus.IN_PROGRESS] },
    },
    select: {
      id: true,
      template: {
        select: {
          sections: { select: { items: { select: { id: true } } } },
        },
      },
    },
  })
  if (!inspection) throw new Error('الزيارة غير موجودة أو لم تعد قابلة للتعديل.')

  // البنود المسموح حفظها هي بنود قالب هذه الزيارة فقط
  const validItemIds = new Set(
    inspection.template.sections.flatMap((s) => s.items.map((i) => i.id)),
  )

  const accepted = answers.filter((a) => validItemIds.has(a.itemId))

  await prisma.$transaction(
    accepted.map((a) =>
      prisma.inspectionAnswer.upsert({
        where: {
          inspectionId_itemId: { inspectionId, itemId: a.itemId },
        },
        create: {
          inspectionId,
          itemId: a.itemId,
          valueBool: a.valueBool ?? null,
          valueText: a.valueText ?? null,
          valueNumber: a.valueNumber ?? null,
          valueChoice: a.valueChoice ?? null,
          scoreAwarded: a.scoreAwarded ?? null,
          note: a.note ?? null,
        },
        update: {
          valueBool: a.valueBool ?? null,
          valueText: a.valueText ?? null,
          valueNumber: a.valueNumber ?? null,
          valueChoice: a.valueChoice ?? null,
          scoreAwarded: a.scoreAwarded ?? null,
          note: a.note ?? null,
        },
      }),
    ),
  )
}

export class MissingRequiredError extends Error {
  override readonly name = 'MissingRequiredError'
  constructor(public readonly missing: string[]) {
    super(`حقول إلزامية غير مكتملة: ${missing.join('، ')}`)
  }
}

/**
 * الإغلاق: يتحقق من الحقول الإلزامية، يحتسب النتيجة، ويفتح إجراءً تصحيحيًا
 * لكل بند حرج فاشل — كل ذلك في معاملة واحدة.
 */
export async function submitInspection(
  ctx: TenantContext,
  inspectionId: string,
  answers: AnswerInput[],
): Promise<ScoreResult> {
  authorize(ctx, 'inspection:update')

  await saveAnswers(ctx, inspectionId, answers)

  const inspection = await prisma.inspection.findFirst({
    where: {
      id: inspectionId,
      organizationId: ctx.organizationId,
      ...branchFilter(ctx),
    },
    select: {
      id: true,
      branchId: true,
      template: {
        select: {
          passScore: true,
          sections: {
            select: {
              items: {
                select: {
                  id: true,
                  label: true,
                  type: true,
                  weight: true,
                  maxScore: true,
                  required: true,
                  criticalFail: true,
                },
              },
            },
          },
        },
      },
      answers: {
        select: {
          itemId: true,
          valueBool: true,
          valueText: true,
          valueNumber: true,
          valueChoice: true,
          scoreAwarded: true,
          note: true,
        },
      },
    },
  })
  if (!inspection) throw new Error('الزيارة غير موجودة.')

  const items = inspection.template.sections.flatMap((s) => s.items)
  const answerMap = new Map<string, AnswerInput>(
    inspection.answers.map((a) => [
      a.itemId,
      {
        itemId: a.itemId,
        valueBool: a.valueBool,
        valueText: a.valueText,
        valueNumber: a.valueNumber === null ? null : toNumber(a.valueNumber),
        valueChoice: a.valueChoice,
        scoreAwarded: a.scoreAwarded,
        note: a.note,
      },
    ]),
  )

  // منع الإغلاق قبل إكمال الحقول الإلزامية — شرط صريح في المتطلبات
  const missing = items
    .filter((i) => i.required && !hasValue(answerMap.get(i.id)))
    .map((i) => i.label)

  if (missing.length > 0) throw new MissingRequiredError(missing)

  const result = computeScore(items, answerMap, inspection.template.passScore)

  await prisma.$transaction(async (tx) => {
    await tx.inspection.update({
      where: { id: inspectionId },
      data: {
        status: InspectionStatus.SUBMITTED,
        submittedAt: new Date(),
        score: result.score,
        maxScore: result.maxScore,
        passed: result.passed,
        version: { increment: 1 },
      },
    })

    // وسم المخالفات على مستوى الإجابة
    for (const item of items) {
      const answer = answerMap.get(item.id)
      if (!answer) continue
      const violation = isFailure(
        { ...item, maxScore: item.maxScore },
        answer,
      )
      if (violation) {
        await tx.inspectionAnswer.update({
          where: { inspectionId_itemId: { inspectionId, itemId: item.id } },
          data: { isViolation: true },
        })
      }
    }

    // كل بند حرج فاشل يفتح إجراءً تصحيحيًا بمسؤول وموعد
    for (const label of result.criticalFailures) {
      const reference = await nextReference(
        tx,
        ctx.organizationId,
        'CA',
        'correctiveAction',
      )
      const due = new Date()
      due.setDate(due.getDate() + 3)

      await tx.correctiveAction.create({
        data: {
          organizationId: ctx.organizationId,
          branchId: inspection.branchId,
          inspectionId,
          createdById: ctx.userId,
          assigneeId: ctx.userId,
          reference,
          title: `معالجة مخالفة: ${label}`,
          description:
            'فتح تلقائيًا لأن البند مصنّف حرجًا وسُجّل فاشلًا في الزيارة.',
          priority: 'CRITICAL',
          status: 'NEW',
          dueAt: due,
        },
      })
    }
  })

  await recordAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'inspection.submitted',
    entityType: 'Inspection',
    entityId: inspectionId,
    after: {
      score: result.score,
      passed: result.passed,
      criticalFailures: result.criticalFailures.length,
    },
  })

  return result
}

function hasValue(answer: AnswerInput | undefined): boolean {
  if (!answer) return false
  return (
    answer.valueBool !== null && answer.valueBool !== undefined
      ? true
      : answer.valueNumber !== null && answer.valueNumber !== undefined
        ? true
        : Boolean(answer.valueText?.trim()) ||
          Boolean(answer.valueChoice) ||
          (answer.scoreAwarded !== null && answer.scoreAwarded !== undefined)
  )
}

export async function approveInspection(
  ctx: TenantContext,
  inspectionId: string,
): Promise<void> {
  authorize(ctx, 'inspection:approve')

  const result = await prisma.inspection.updateMany({
    where: {
      id: inspectionId,
      organizationId: ctx.organizationId,
      status: InspectionStatus.SUBMITTED,
    },
    data: {
      status: InspectionStatus.APPROVED,
      approvedAt: new Date(),
      version: { increment: 1 },
    },
  })

  if (result.count === 0) {
    throw new Error('الزيارة غير موجودة أو ليست بانتظار الاعتماد.')
  }

  await recordAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'inspection.approved',
    entityType: 'Inspection',
    entityId: inspectionId,
  })
}

export async function listActiveTemplates(ctx: TenantContext) {
  authorize(ctx, 'checklist:view')
  return prisma.checklistTemplate.findMany({
    where: {
      organizationId: ctx.organizationId,
      deletedAt: null,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      frequency: true,
      passScore: true,
      _count: { select: { sections: true } },
    },
    orderBy: { name: 'asc' },
  })
}

export async function listTemplatesWithCounts(ctx: TenantContext) {
  authorize(ctx, 'checklist:view')
  const templates = await prisma.checklistTemplate.findMany({
    where: { organizationId: ctx.organizationId, deletedAt: null },
    select: {
      id: true,
      name: true,
      description: true,
      frequency: true,
      passScore: true,
      isActive: true,
      sections: { select: { _count: { select: { items: true } } } },
      _count: { select: { inspections: true, schedules: true } },
    },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  })

  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    frequency: t.frequency,
    passScore: t.passScore,
    isActive: t.isActive,
    sectionCount: t.sections.length,
    itemCount: t.sections.reduce((sum, s) => sum + s._count.items, 0),
    inspectionCount: t._count.inspections,
    scheduleCount: t._count.schedules,
  }))
}
