import { headers } from 'next/headers'
import { prisma } from './db'

/**
 * سجل العمليات الحساسة.
 *
 * الحقول الحساسة تُستبعد قبل الكتابة — لا تصل كلمة مرور ولا رمز جلسة إلى
 * السجل حتى لو مُرّرت بالخطأ ضمن `before`/`after`.
 */

const SENSITIVE_KEYS = [
  'password',
  'passwordhash',
  'hash',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'secret',
  'apikey',
  'authorization',
  'cookie',
  'sessiontoken',
] as const

const REDACTED = '[محجوب]'

/** ينقّي كائنًا بشكل تعاودي من الحقول الحساسة. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return REDACTED
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1))
  if (typeof value !== 'object') return value
  if (value instanceof Date) return value.toISOString()

  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.toLowerCase().replace(/[_-]/g, '')
    out[key] = SENSITIVE_KEYS.some((s) => normalized.includes(s))
      ? REDACTED
      : redact(val, depth + 1)
  }
  return out
}

export interface AuditInput {
  organizationId?: string | null
  actorId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  before?: unknown
  after?: unknown
  impersonationReason?: string | null
}

/**
 * يكتب سجلًا. لا يرمي أبدًا: فشل التدقيق يجب ألا يُسقط عملية أعمال ناجحة،
 * لكنه يُسجَّل في سجل الخادم للتحقيق.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    let ipAddress: string | null = null
    let userAgent: string | null = null

    try {
      const h = await headers()
      ipAddress =
        h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        h.get('x-real-ip') ??
        null
      userAgent = h.get('user-agent')
    } catch {
      // خارج سياق الطلب (مهمة خلفية) — لا رؤوس متاحة
    }

    await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId ?? null,
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        before: (redact(input.before) ?? undefined) as never,
        after: (redact(input.after) ?? undefined) as never,
        ipAddress,
        userAgent,
        impersonationReason: input.impersonationReason ?? null,
      },
    })
  } catch (error) {
    console.error('[audit] تعذّر كتابة سجل التدقيق:', error)
  }
}
