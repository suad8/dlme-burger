import 'server-only'
import { EmployeeStatus, DocumentType } from '@prisma/client'
import { prisma } from '../db'
import { authorize } from '../rbac'
import { branchFilter, type TenantContext } from '../tenant'

/**
 * ملفات الموظفين ومستنداتهم.
 *
 * ⚠️ المستندات حساسة. لا تُعاد محتوياتها هنا إطلاقًا — فقط النوع وتاريخ
 * الانتهاء وحالة القرب من الانتهاء. الوصول إلى الملف نفسه يتم عبر رابط موقّع
 * منفصل لمن يملك `employee:view`، ولم يُفعّل بعد لعدم وجود مخزن ملفات.
 */

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  ACTIVE: 'على رأس العمل',
  ON_LEAVE: 'إجازة',
  SUSPENDED: 'موقوف',
  TERMINATED: 'منتهية خدمته',
}

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  IQAMA: 'إقامة',
  PASSPORT: 'جواز سفر',
  HEALTH_CERTIFICATE: 'شهادة صحية',
  CONTRACT: 'عقد عمل',
  TRAINING_CERTIFICATE: 'شهادة تدريب',
  OTHER: 'أخرى',
}

/** المهلة التي يُعتبر المستند بعدها «قارب على الانتهاء». */
const EXPIRY_WARNING_DAYS = 30

export interface EmployeeRow {
  id: string
  fullName: string
  employeeNo: string | null
  position: string
  branchName: string | null
  status: EmployeeStatus
  nationality: string | null
  trainingDone: boolean
  lastRating: number | null
  hiredAt: Date | null
  expiringDocuments: { type: DocumentType; label: string; expiresAt: Date }[]
}

export async function listEmployees(
  ctx: TenantContext,
  filters: { status?: EmployeeStatus | 'ALL'; branchId?: string } = {},
): Promise<EmployeeRow[]> {
  authorize(ctx, 'employee:view')

  const warnBefore = new Date()
  warnBefore.setDate(warnBefore.getDate() + EXPIRY_WARNING_DAYS)

  const employees = await prisma.employee.findMany({
    where: {
      organizationId: ctx.organizationId,
      deletedAt: null,
      ...branchFilter(ctx),
      ...(filters.status && filters.status !== 'ALL'
        ? { status: filters.status }
        : {}),
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
    },
    select: {
      id: true,
      fullName: true,
      employeeNo: true,
      position: true,
      status: true,
      nationality: true,
      trainingDone: true,
      lastRating: true,
      hiredAt: true,
      branch: { select: { name: true } },
      documents: {
        // لا storageKey ولا رقم المستند — لا داعي لهما في القائمة
        where: { expiresAt: { not: null, lte: warnBefore } },
        select: { type: true, expiresAt: true },
        orderBy: { expiresAt: 'asc' },
      },
    },
    orderBy: [{ status: 'asc' }, { fullName: 'asc' }],
  })

  return employees.map((e) => ({
    id: e.id,
    fullName: e.fullName,
    employeeNo: e.employeeNo,
    position: e.position,
    branchName: e.branch?.name ?? null,
    status: e.status,
    nationality: e.nationality,
    trainingDone: e.trainingDone,
    lastRating: e.lastRating,
    hiredAt: e.hiredAt,
    expiringDocuments: e.documents
      .filter((d): d is { type: DocumentType; expiresAt: Date } => d.expiresAt !== null)
      .map((d) => ({
        type: d.type,
        label: DOCUMENT_LABELS[d.type],
        expiresAt: d.expiresAt,
      })),
  }))
}

export interface EmployeeStats {
  total: number
  active: number
  trainedPct: number
  expiringDocuments: number
}

export async function getEmployeeStats(
  ctx: TenantContext,
): Promise<EmployeeStats> {
  authorize(ctx, 'employee:view')

  const warnBefore = new Date()
  warnBefore.setDate(warnBefore.getDate() + EXPIRY_WARNING_DAYS)

  const scope = {
    organizationId: ctx.organizationId,
    deletedAt: null,
    ...branchFilter(ctx),
  }

  const [total, active, trained, expiring] = await Promise.all([
    prisma.employee.count({ where: scope }),
    prisma.employee.count({ where: { ...scope, status: 'ACTIVE' } }),
    prisma.employee.count({ where: { ...scope, trainingDone: true } }),
    prisma.employeeDocument.count({
      where: {
        employee: scope,
        expiresAt: { not: null, gte: new Date(), lte: warnBefore },
      },
    }),
  ])

  return {
    total,
    active,
    trainedPct: total > 0 ? Number(((trained / total) * 100).toFixed(1)) : 0,
    expiringDocuments: expiring,
  }
}
