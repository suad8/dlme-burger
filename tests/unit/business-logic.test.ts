import { describe, it, expect } from 'vitest'
import { ChecklistItemType, MenuClass } from '@prisma/client'
import { computeScore, type AnswerInput } from '@/server/services/inspections'
import { classifyMenuItem } from '@/server/services/recipes'
import { allowedNextStates } from '@/server/services/actions'
import { toCsv, type ReportTable } from '@/server/services/reports'
import { priceWithVat, toMinor, fromMinor, VAT_RATE } from '@/server/billing/provider'

/** مساعد لبناء بند فحص بأقل ضجيج. */
function item(
  id: string,
  type: ChecklistItemType,
  extra: Partial<{
    weight: number
    maxScore: number | null
    required: boolean
    criticalFail: boolean
  }> = {},
) {
  return {
    id,
    label: `بند ${id}`,
    type,
    weight: extra.weight ?? 1,
    maxScore: extra.maxScore ?? null,
    required: extra.required ?? false,
    criticalFail: extra.criticalFail ?? false,
  }
}

function answers(list: AnswerInput[]): Map<string, AnswerInput> {
  return new Map(list.map((a) => [a.itemId, a]))
}

describe('احتساب نتيجة الفحص', () => {
  it('كل الإجابات صحيحة → ١٠٠٪ ومطابق', () => {
    const items = [
      item('a', ChecklistItemType.YES_NO),
      item('b', ChecklistItemType.YES_NO),
    ]
    const result = computeScore(
      items,
      answers([
        { itemId: 'a', valueBool: true },
        { itemId: 'b', valueBool: true },
      ]),
      80,
    )
    expect(result.score).toBe(100)
    expect(result.passed).toBe(true)
  })

  it('نصف الإجابات صحيحة → ٥٠٪ وغير مطابق عند عتبة ٨٠', () => {
    const items = [
      item('a', ChecklistItemType.YES_NO),
      item('b', ChecklistItemType.YES_NO),
    ]
    const result = computeScore(
      items,
      answers([
        { itemId: 'a', valueBool: true },
        { itemId: 'b', valueBool: false },
      ]),
      80,
    )
    expect(result.score).toBe(50)
    expect(result.passed).toBe(false)
  })

  it('البند الحرج الفاشل يُسقط النتيجة إلى صفر مهما كان الباقي', () => {
    const items = [
      item('ok1', ChecklistItemType.YES_NO),
      item('ok2', ChecklistItemType.YES_NO),
      item('ok3', ChecklistItemType.YES_NO),
      item('crit', ChecklistItemType.YES_NO, { criticalFail: true }),
    ]
    const result = computeScore(
      items,
      answers([
        { itemId: 'ok1', valueBool: true },
        { itemId: 'ok2', valueBool: true },
        { itemId: 'ok3', valueBool: true },
        { itemId: 'crit', valueBool: false },
      ]),
      80,
    )
    // ٣ من ٤ = ٧٥٪ لولا البند الحرج
    expect(result.score).toBe(0)
    expect(result.passed).toBe(false)
    expect(result.criticalFailures).toHaveLength(1)
  })

  it('الوزن يؤثر في النتيجة', () => {
    const items = [
      item('heavy', ChecklistItemType.YES_NO, { weight: 3 }),
      item('light', ChecklistItemType.YES_NO, { weight: 1 }),
    ]
    // الثقيل صح والخفيف خطأ → ٣ من ٤
    const good = computeScore(
      items,
      answers([
        { itemId: 'heavy', valueBool: true },
        { itemId: 'light', valueBool: false },
      ]),
      80,
    )
    expect(good.score).toBe(75)

    // العكس → ١ من ٤
    const bad = computeScore(
      items,
      answers([
        { itemId: 'heavy', valueBool: false },
        { itemId: 'light', valueBool: true },
      ]),
      80,
    )
    expect(bad.score).toBe(25)
  })

  it('بنود الدرجة تُحتسب نسبةً إلى حدّها الأقصى', () => {
    const items = [item('s', ChecklistItemType.SCORE, { maxScore: 5 })]
    const result = computeScore(
      items,
      answers([{ itemId: 's', scoreAwarded: 4 }]),
      80,
    )
    expect(result.score).toBe(80)
  })

  it('الدرجة الممنوحة لا تتجاوز الحدّ الأقصى حتى لو أُرسلت أكبر', () => {
    const items = [item('s', ChecklistItemType.SCORE, { maxScore: 5 })]
    const result = computeScore(
      items,
      answers([{ itemId: 's', scoreAwarded: 99 }]),
      80,
    )
    expect(result.score).toBe(100)
  })

  it('الحقول الوصفية لا تدخل في الاحتساب', () => {
    const items = [
      item('yn', ChecklistItemType.YES_NO),
      item('txt', ChecklistItemType.TEXT),
      item('photo', ChecklistItemType.PHOTO),
      item('sig', ChecklistItemType.SIGNATURE),
    ]
    const result = computeScore(
      items,
      answers([{ itemId: 'yn', valueBool: true }]),
      80,
    )
    // البند القابل للتسجيل الوحيد صحيح → ١٠٠٪
    expect(result.score).toBe(100)
  })

  it('بلا بنود قابلة للتسجيل لا قسمة على صفر', () => {
    const items = [item('txt', ChecklistItemType.TEXT)]
    const result = computeScore(items, answers([]), 80)
    expect(result.score).toBe(0)
    expect(Number.isFinite(result.score)).toBe(true)
  })

  it('البند غير المجاب لا يمنح درجة لكنه يبقى في المقام', () => {
    const items = [
      item('a', ChecklistItemType.YES_NO),
      item('b', ChecklistItemType.YES_NO),
    ]
    const result = computeScore(
      items,
      answers([{ itemId: 'a', valueBool: true }]),
      80,
    )
    expect(result.score).toBe(50)
  })
})

describe('هندسة المنيو', () => {
  const avgPopularity = 100
  const avgMargin = 10

  it('شعبي ورابح → نجم', () => {
    expect(classifyMenuItem(150, 20, avgPopularity, avgMargin)).toBe(MenuClass.STAR)
  })

  it('غير شعبي ورابح → لغز', () => {
    expect(classifyMenuItem(50, 20, avgPopularity, avgMargin)).toBe(MenuClass.PUZZLE)
  })

  it('شعبي وغير رابح → حصان عمل', () => {
    expect(classifyMenuItem(150, 5, avgPopularity, avgMargin)).toBe(
      MenuClass.PLOW_HORSE,
    )
  })

  it('غير شعبي وغير رابح → ضعيف', () => {
    expect(classifyMenuItem(50, 5, avgPopularity, avgMargin)).toBe(MenuClass.DOG)
  })

  it('المساوي للمتوسط يُعامل معاملة المتجاوز', () => {
    expect(classifyMenuItem(100, 10, avgPopularity, avgMargin)).toBe(MenuClass.STAR)
  })
})

describe('سير حالات الإجراء التصحيحي', () => {
  it('الحالات النهائية لا تسمح بأي انتقال', () => {
    expect(allowedNextStates('COMPLETED')).toEqual([])
    expect(allowedNextStates('CANCELLED')).toEqual([])
  })

  it('الجديد لا يقفز مباشرة إلى مكتمل', () => {
    expect(allowedNextStates('NEW')).not.toContain('COMPLETED')
  })

  it('الاكتمال لا يأتي إلا من بانتظار المراجعة', () => {
    expect(allowedNextStates('PENDING_REVIEW')).toContain('COMPLETED')
    expect(allowedNextStates('IN_PROGRESS')).not.toContain('COMPLETED')
  })

  it('المتأخر يمكن استئنافه', () => {
    expect(allowedNextStates('OVERDUE')).toContain('IN_PROGRESS')
  })
})

describe('تصدير CSV', () => {
  const table: ReportTable = {
    title: 'اختبار',
    headers: ['الاسم', 'القيمة'],
    rows: [['فرع العليا', 100]],
  }

  it('يبدأ بـBOM ليفتح Excel العربية بترميز صحيح', () => {
    expect(toCsv(table).charCodeAt(0)).toBe(0xfeff)
  })

  it('يهرّب فاصلة CSV داخل القيم', () => {
    // الفاصلة اللاتينية هي فاصل الحقول — العربية «،» ليست كذلك ولا تحتاج تهريبًا
    const csv = toCsv({ ...table, rows: [['مذاق, العليا', 1]] })
    expect(csv).toContain('"مذاق, العليا"')
  })

  it('لا يهرّب الفاصلة العربية لأنها ليست فاصل حقول', () => {
    const csv = toCsv({ ...table, rows: [['مذاق، العليا', 1]] })
    expect(csv).toContain('مذاق، العليا')
    expect(csv).not.toContain('"مذاق، العليا"')
  })

  it('يهرّب الاقتباسات بمضاعفتها', () => {
    const csv = toCsv({ ...table, rows: [['قال "مرحبًا"', 1]] })
    expect(csv).toContain('""مرحبًا""')
  })

  it('يحمي من حقن الصيغ في Excel', () => {
    const csv = toCsv({ ...table, rows: [['=1+1', '@SUM(A1)']] })
    // القيم الخطرة تُسبق بعلامة اقتباس فلا تُنفَّذ كصيغة
    expect(csv).toContain("'=1+1")
    expect(csv).toContain("'@SUM(A1)")
  })

  it('يستخدم CRLF كفاصل أسطر', () => {
    expect(toCsv(table)).toContain('\r\n')
  })
})

describe('حساب الضريبة', () => {
  it('يضيف ١٥٪ بالأعداد الصحيحة', () => {
    const result = priceWithVat(29900)
    expect(result.vatMinor).toBe(4485)
    expect(result.totalMinor).toBe(34385)
  })

  it('النسبة ١٥٪ كما يقتضي النظام السعودي', () => {
    expect(VAT_RATE).toBe(0.15)
  })

  it('التحويل بين الوحدات دقيق ولا يتأثر بالفاصلة العائمة', () => {
    expect(toMinor(0.1 + 0.2)).toBe(30)
    expect(fromMinor(toMinor(299.99))).toBe(299.99)
  })

  it('صفر يبقى صفرًا', () => {
    const result = priceWithVat(0)
    expect(result.totalMinor).toBe(0)
  })
})
