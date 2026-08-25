/**
 * تحديد المعدّل — نافذة ثابتة في الذاكرة.
 *
 * ⚠️ حدّ معروف: الحالة داخل العملية. مع أكثر من نسخة (instance) يصبح الحد
 * فعّالًا لكل نسخة لا عالميًا. للإنتاج متعدد النسخ استبدل المخزن بـRedis عبر
 * نفس الواجهة أدناه — التوقيع لن يتغيّر.
 */

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

// تنظيف دوري لمنع نمو الذاكرة بلا حد
let lastSweep = Date.now()
const SWEEP_INTERVAL_MS = 60_000

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfterSeconds: number
}

export interface RateLimitOptions {
  /** عدد المحاولات المسموحة داخل النافذة. */
  limit: number
  /** طول النافذة بالمللي ثانية. */
  windowMs: number
}

export function checkRateLimit(
  key: string,
  options: RateLimitOptions,
): RateLimitResult {
  const now = Date.now()
  sweep(now)

  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + options.windowMs
    buckets.set(key, { count: 1, resetAt })
    return {
      allowed: true,
      remaining: options.limit - 1,
      resetAt,
      retryAfterSeconds: 0,
    }
  }

  existing.count += 1
  const allowed = existing.count <= options.limit

  return {
    allowed,
    remaining: Math.max(0, options.limit - existing.count),
    resetAt: existing.resetAt,
    retryAfterSeconds: allowed
      ? 0
      : Math.ceil((existing.resetAt - now) / 1000),
  }
}

/** يُستخدم في الاختبارات لعزل الحالات عن بعضها. */
export function resetRateLimits(): void {
  buckets.clear()
}

export const LOGIN_LIMIT: RateLimitOptions = {
  limit: 5,
  windowMs: 15 * 60 * 1000,
}

export const SIGNUP_LIMIT: RateLimitOptions = {
  limit: 3,
  windowMs: 60 * 60 * 1000,
}

export const MUTATION_LIMIT: RateLimitOptions = {
  limit: 60,
  windowMs: 60 * 1000,
}
