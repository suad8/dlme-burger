import { describe, it, expect, afterAll, beforeEach } from 'vitest'
import { prisma, contextFor, contextWithRole, DEMO } from '../helpers/db'
import {
  listRequests,
  getRequest,
  createRequest,
  addCandidate,
  moveCandidate,
  deleteCandidate,
  setRequestStatus,
  RecruitmentInputError,
  RecruitmentNotFoundError,
} from '@/server/services/recruitment'
import { uploadAttachment, listAttachments } from '@/server/services/attachments'
import { ForbiddenError } from '@/server/rbac'

/** PNG صالح ١×١ — لاختبار مسار المرفقات بمحتوى حقيقي لا بامتداد. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

async function clean() {
  await prisma.candidate.deleteMany({
    where: { fullName: { startsWith: 'مرشّح اختبار' } },
  })
  await prisma.recruitmentRequest.deleteMany({
    where: { position: { startsWith: 'وظيفة اختبار' } },
  })
}

beforeEach(clean)

afterAll(async () => {
  await clean()
  await prisma.$disconnect()
})

async function makeRequest(ctx: Awaited<ReturnType<typeof contextFor>>, suffix = '') {
  return createRequest(ctx, {
    position: `وظيفة اختبار${suffix}`,
    quantity: 2,
    branchId: null,
    description: null,
    salaryMin: 4000,
    salaryMax: 6000,
    neededBy: null,
  })
}

describe('التوظيف — التحقق من المُدخلات', () => {
  it('يرفض المسمّى الفارغ والعدد خارج المدى', async () => {
    const owner = await contextFor(DEMO.ownerA)

    await expect(
      createRequest(owner, {
        position: ' ',
        quantity: 1,
        branchId: null,
        description: null,
        salaryMin: null,
        salaryMax: null,
        neededBy: null,
      }),
    ).rejects.toBeInstanceOf(RecruitmentInputError)

    await expect(
      createRequest(owner, {
        position: 'وظيفة اختبار العدد',
        quantity: 0,
        branchId: null,
        description: null,
        salaryMin: null,
        salaryMax: null,
        neededBy: null,
      }),
    ).rejects.toBeInstanceOf(RecruitmentInputError)
  })

  it('يرفض نطاق راتب مقلوبًا', async () => {
    const owner = await contextFor(DEMO.ownerA)
    await expect(
      createRequest(owner, {
        position: 'وظيفة اختبار الراتب',
        quantity: 1,
        branchId: null,
        description: null,
        salaryMin: 9000,
        salaryMax: 3000,
        neededBy: null,
      }),
    ).rejects.toBeInstanceOf(RecruitmentInputError)
  })

  it('يرفض فرعًا من منشأة أخرى', async () => {
    const a = await contextFor(DEMO.ownerA)
    const b = await contextFor(DEMO.ownerB)

    const branchOfB = await prisma.branch.findFirstOrThrow({
      where: { organizationId: b.organizationId },
      select: { id: true },
    })

    await expect(
      createRequest(a, {
        position: 'وظيفة اختبار الفرع',
        quantity: 1,
        branchId: branchOfB.id,
        description: null,
        salaryMin: null,
        salaryMax: null,
        neededBy: null,
      }),
    ).rejects.toBeInstanceOf(RecruitmentInputError)
  })

  it('يرفض تقييمًا خارج ١..٥', async () => {
    const owner = await contextFor(DEMO.ownerA)
    const request = await makeRequest(owner)
    const candidate = await addCandidate(owner, {
      requestId: request.id,
      fullName: 'مرشّح اختبار التقييم',
      phone: null,
      email: null,
      notes: null,
    })

    await expect(
      moveCandidate(owner, candidate.id, 'SCREENING', 9),
    ).rejects.toBeInstanceOf(RecruitmentInputError)
  })

  it('لا يقبل مرشّحين على طلب مغلق', async () => {
    const owner = await contextFor(DEMO.ownerA)
    const request = await makeRequest(owner, ' المغلق')
    await setRequestStatus(owner, request.id, 'CLOSED')

    await expect(
      addCandidate(owner, {
        requestId: request.id,
        fullName: 'مرشّح اختبار المتأخر',
        phone: null,
        email: null,
        notes: null,
      }),
    ).rejects.toBeInstanceOf(RecruitmentInputError)
  })
})

describe('التوظيف — عزل البيانات الشخصية', () => {
  it('المرشّح يحمل معرّف المنشأة صراحةً لا وراثةً', async () => {
    const owner = await contextFor(DEMO.ownerA)
    const request = await makeRequest(owner)
    const candidate = await addCandidate(owner, {
      requestId: request.id,
      fullName: 'مرشّح اختبار العمود',
      phone: '0500000000',
      email: 'Cand@Example.SA',
      notes: null,
    })

    const row = await prisma.candidate.findUniqueOrThrow({
      where: { id: candidate.id },
      select: { organizationId: true, email: true },
    })

    expect(row.organizationId).toBe(owner.organizationId)
    // البريد يُطبَّع فلا يتكرّر المرشّح بحالات أحرف مختلفة
    expect(row.email).toBe('cand@example.sa')
  })

  it('منشأة أخرى لا ترى الطلب ولا تحرّك مرشّحيه', async () => {
    const a = await contextFor(DEMO.ownerA)
    const b = await contextFor(DEMO.ownerB)

    const request = await makeRequest(a, ' العزل')
    const candidate = await addCandidate(a, {
      requestId: request.id,
      fullName: 'مرشّح اختبار العزل',
      phone: '0511111111',
      email: null,
      notes: 'ملاحظة خاصة بالمنشأة الأولى',
    })

    await expect(getRequest(b, request.id)).rejects.toBeInstanceOf(
      RecruitmentNotFoundError,
    )
    await expect(
      moveCandidate(b, candidate.id, 'HIRED', null),
    ).rejects.toBeInstanceOf(RecruitmentNotFoundError)
    await expect(deleteCandidate(b, candidate.id)).rejects.toBeInstanceOf(
      RecruitmentNotFoundError,
    )

    const listB = await listRequests(b)
    expect(listB.some((r) => r.id === request.id)).toBe(false)

    // ما زال في مرحلته الأولى
    const after = await prisma.candidate.findUniqueOrThrow({
      where: { id: candidate.id },
      select: { stage: true },
    })
    expect(after.stage).toBe('APPLIED')
  })

  it('المُطّلع لا ينشئ طلبًا ولا يضيف مرشّحًا', async () => {
    const base = await contextFor(DEMO.ownerA)
    const viewer = contextWithRole(base, 'VIEWER')
    const request = await makeRequest(base, ' صلاحيات')

    await expect(
      createRequest(viewer, {
        position: 'وظيفة اختبار المُطّلع',
        quantity: 1,
        branchId: null,
        description: null,
        salaryMin: null,
        salaryMax: null,
        neededBy: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError)

    await expect(
      addCandidate(viewer, {
        requestId: request.id,
        fullName: 'مرشّح اختبار المُطّلع',
        phone: null,
        email: null,
        notes: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })
})

describe('التوظيف — السيرة الذاتية', () => {
  it('تُرفع وتُقرأ ضمن المنشأة، ولا تُقرأ من منشأة أخرى', async () => {
    const a = await contextFor(DEMO.ownerA)
    const b = await contextFor(DEMO.ownerB)

    const request = await makeRequest(a, ' السيرة')
    const candidate = await addCandidate(a, {
      requestId: request.id,
      fullName: 'مرشّح اختبار السيرة',
      phone: null,
      email: null,
      notes: null,
    })

    const uploaded = await uploadAttachment(a, {
      target: { kind: 'candidate', candidateId: candidate.id },
      fileName: 'cv.png',
      mimeType: 'image/png',
      data: PNG,
    })

    expect(uploaded.id).toBeTruthy()
    // الرابط موقّع ومؤقّت، لا مسار مباشر للملف
    expect(uploaded.url).toContain('expires=')
    expect(uploaded.url).toContain('sig=')

    const listed = await listAttachments(a, {
      kind: 'candidate',
      candidateId: candidate.id,
    })
    expect(listed).toHaveLength(1)

    // منشأة أخرى: المرشّح غير موجود من منظورها فلا رفع ولا قراءة
    await expect(
      uploadAttachment(b, {
        target: { kind: 'candidate', candidateId: candidate.id },
        fileName: 'cv.png',
        mimeType: 'image/png',
        data: PNG,
      }),
    ).rejects.toThrow()

    const listedByB = await listAttachments(b, {
      kind: 'candidate',
      candidateId: candidate.id,
    })
    expect(listedByB).toHaveLength(0)
  })

  it('حذف المرشّح يزيل سجل المرفق أيضًا', async () => {
    const owner = await contextFor(DEMO.ownerA)
    const request = await makeRequest(owner, ' الحذف')
    const candidate = await addCandidate(owner, {
      requestId: request.id,
      fullName: 'مرشّح اختبار الحذف',
      phone: null,
      email: null,
      notes: null,
    })

    await uploadAttachment(owner, {
      target: { kind: 'candidate', candidateId: candidate.id },
      fileName: 'cv.png',
      mimeType: 'image/png',
      data: PNG,
    })

    await deleteCandidate(owner, candidate.id)

    const remaining = await prisma.attachment.count({
      where: { candidateId: candidate.id },
    })
    expect(remaining).toBe(0)
    expect(
      await prisma.candidate.findUnique({ where: { id: candidate.id } }),
    ).toBeNull()
  })

  it('ملف يدّعي نوعًا لا يطابق محتواه يُرفض', async () => {
    const owner = await contextFor(DEMO.ownerA)
    const request = await makeRequest(owner, ' النوع')
    const candidate = await addCandidate(owner, {
      requestId: request.id,
      fullName: 'مرشّح اختبار النوع',
      phone: null,
      email: null,
      notes: null,
    })

    await expect(
      uploadAttachment(owner, {
        target: { kind: 'candidate', candidateId: candidate.id },
        fileName: 'cv.pdf',
        mimeType: 'application/pdf',
        // محتوى PNG تحت اسم ونوع PDF
        data: PNG,
      }),
    ).rejects.toThrow()
  })
})
