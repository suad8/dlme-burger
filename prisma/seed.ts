/**
 * بيانات تجريبية واقعية بالعربية.
 *
 * تُنشئ منشأتين مستقلتين عمدًا: «مذاق الرياض» و«ركن الشرقية». وجود منشأة
 * ثانية ليس زينة — اختبارات العزل في tests/tenant-isolation تعتمد عليها
 * لإثبات أن مستخدم إحداهما لا يرى بيانات الأخرى.
 *
 * ⚠️ كلمات المرور هنا للتطوير المحلي فقط. لا تُستخدم في أي بيئة إنتاج.
 */

import 'dotenv/config'
import { PrismaClient, RoleKey } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { hashPassword } from '@better-auth/utils/password'
import { allPermissions, DEFAULT_ROLE_PERMISSIONS, ROLE_LABELS } from '../src/server/rbac'
import { auth } from '../src/server/auth'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const DEMO_PASSWORD = 'Itqan#Demo2026'

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function daysAhead(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}

/**
 * ينشئ مستخدمًا ببيانات اعتماد صالحة، بشكل قابل لإعادة التشغيل.
 *
 * ⚠️ لا يكفي التحقق من وجود صف المستخدم: إن فشل الزرع بعد إنشاء المستخدم
 * وقبل ربط حساب الاعتماد، يبقى المستخدم بلا كلمة مرور ويتعذّر الدخول به.
 * لذلك نتحقق من وجود حساب credential فعليًا، وننشئه إن كان مفقودًا.
 */
async function ensureUser(
  email: string,
  name: string,
  phone: string,
): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      accounts: {
        where: { providerId: 'credential' },
        select: { id: true },
        take: 1,
      },
    },
  })

  if (existing?.accounts.length) return existing.id

  // مستخدم من تشغيل سابق فاشل: موجود لكن بلا بيانات اعتماد.
  // لا نحذفه — قد تشير إليه سجلات تحفظ من أنشأها (قيود Restrict مقصودة).
  // نُكمل الناقص بدل إتلاف المرجعية.
  if (existing) {
    await prisma.account.create({
      data: {
        userId: existing.id,
        accountId: existing.id,
        providerId: 'credential',
        issuer: 'local:credential',
        password: await hashPassword(DEMO_PASSWORD),
      },
    })
    await prisma.user.update({
      where: { id: existing.id },
      data: { phone, emailVerified: true },
    })
    return existing.id
  }

  await auth.api.signUpEmail({
    body: { email, password: DEMO_PASSWORD, name },
  })

  const created = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: {
      id: true,
      accounts: {
        where: { providerId: 'credential' },
        select: { id: true },
        take: 1,
      },
    },
  })

  if (created.accounts.length === 0) {
    throw new Error(
      `فشل ربط بيانات الاعتماد للمستخدم ${email} — أوقف الزرع بدل ترك حساب لا يمكن الدخول به.`,
    )
  }

  await prisma.user.update({
    where: { id: created.id },
    data: { phone, emailVerified: true },
  })
  return created.id
}

async function seedPermissions(): Promise<void> {
  const keys = allPermissions()
  await prisma.permission.createMany({
    data: keys.map((key) => {
      const [resource, action] = key.split(':') as [string, string]
      return { key, resource, action }
    }),
    skipDuplicates: true,
  })
  console.log(`  ✓ ${keys.length} صلاحية`)
}

async function seedPlans(): Promise<void> {
  const plans = [
    {
      tier: 'TRIAL' as const,
      name: 'التجربة المجانية',
      nameEn: 'Free Trial',
      description: '١٤ يومًا لتجربة المنصة بالكامل على فرع واحد.',
      monthlyPrice: 0,
      yearlyPrice: 0,
      maxBranches: 1,
      maxUsers: 3,
      maxBrands: 1,
      isPublic: false,
      sortOrder: 0,
    },
    {
      tier: 'SINGLE_BRANCH' as const,
      name: 'فرع واحد',
      nameEn: 'Single Branch',
      description: 'للمقاهي والمطاعم المستقلة التي تدير فرعًا واحدًا.',
      monthlyPrice: 299,
      yearlyPrice: 2990,
      maxBranches: 1,
      maxUsers: 8,
      maxBrands: 1,
      isPublic: true,
      sortOrder: 1,
    },
    {
      tier: 'GROWTH' as const,
      name: 'النمو',
      nameEn: 'Growth',
      description: 'لمن بدأ التوسّع ويحتاج مقارنة أداء الفروع.',
      monthlyPrice: 749,
      yearlyPrice: 7490,
      maxBranches: 5,
      maxUsers: 25,
      maxBrands: 2,
      isPublic: true,
      sortOrder: 2,
    },
    {
      tier: 'MULTI_BRANCH' as const,
      name: 'متعدد الفروع',
      nameEn: 'Multi-Branch',
      description: 'للعلامات التجارية التي تدير شبكة فروع بفرق تشغيل.',
      monthlyPrice: 1899,
      yearlyPrice: 18990,
      maxBranches: 25,
      maxUsers: 120,
      maxBrands: 6,
      isPublic: true,
      sortOrder: 3,
    },
    {
      tier: 'ENTERPRISE' as const,
      name: 'المؤسسات',
      nameEn: 'Enterprise',
      description: 'لشركات التشغيل والإدارة — حدود مخصّصة واتفاقية مستوى خدمة.',
      monthlyPrice: 0,
      yearlyPrice: 0,
      maxBranches: 999,
      maxUsers: 999,
      maxBrands: 99,
      isPublic: true,
      sortOrder: 4,
    },
  ]

  const featureMatrix: Record<string, string[]> = {
    TRIAL: ['checklists', 'inspections', 'actions'],
    SINGLE_BRANCH: ['checklists', 'inspections', 'actions', 'employees', 'reports'],
    GROWTH: [
      'checklists', 'inspections', 'actions', 'employees', 'reports',
      'recipes', 'inventory', 'branch_comparison',
    ],
    MULTI_BRANCH: [
      'checklists', 'inspections', 'actions', 'employees', 'reports',
      'recipes', 'inventory', 'branch_comparison', 'services', 'api_access',
    ],
    ENTERPRISE: [
      'checklists', 'inspections', 'actions', 'employees', 'reports',
      'recipes', 'inventory', 'branch_comparison', 'services', 'api_access',
      'sso', 'dedicated_support',
    ],
  }

  const featureNames: Record<string, string> = {
    checklists: 'قوائم الفحص',
    inspections: 'الزيارات والتدقيق',
    actions: 'الإجراءات التصحيحية',
    employees: 'ملفات الموظفين',
    reports: 'التقارير والتصدير',
    recipes: 'الوصفات وتكلفة المنتجات',
    inventory: 'المخزون والهدر',
    branch_comparison: 'مقارنة أداء الفروع',
    services: 'سوق الخدمات التشغيلية',
    api_access: 'الوصول البرمجي',
    sso: 'الدخول الموحّد',
    dedicated_support: 'دعم مخصّص',
  }

  for (const plan of plans) {
    const saved = await prisma.plan.upsert({
      where: { tier: plan.tier },
      create: plan,
      update: plan,
    })
    for (const key of featureMatrix[plan.tier] ?? []) {
      await prisma.planFeature.upsert({
        where: { planId_key: { planId: saved.id, key } },
        create: { planId: saved.id, key, name: featureNames[key] ?? key },
        update: { name: featureNames[key] ?? key },
      })
    }
  }
  console.log(`  ✓ ${plans.length} باقات مع مزاياها`)
}

async function seedServiceCatalog(): Promise<void> {
  const services = [
    { slug: 'operations-manager', name: 'مدير تشغيل', category: 'التشغيل', summary: 'مدير تشغيل متفرّغ أو جزئي يتابع فروعك ويرفع تقارير دورية.', basePrice: 12000, durationDays: 30 },
    { slug: 'chef-service', name: 'خدمة شيف', category: 'المطبخ', summary: 'شيف متخصّص لتطوير الأصناف وضبط جودة التحضير.', basePrice: 9500, durationDays: 21 },
    { slug: 'operations-audit', name: 'تقييم أداء التشغيل', category: 'الجودة', summary: 'تقييم شامل لعمليات الفرع مع تقرير مفصّل وخطة تحسين.', basePrice: 4500, durationDays: 10 },
    { slug: 'menu-engineering', name: 'هندسة المنيو', category: 'الربحية', summary: 'تحليل الشعبية والربحية وإعادة تصميم المنيو لرفع هامش الربح.', basePrice: 6800, durationDays: 14 },
    { slug: 'recipe-documentation', name: 'توثيق الوصفات', category: 'المطبخ', summary: 'توثيق كل وصفة بالكميات والخطوات لضمان ثبات الطعم بين الفروع.', basePrice: 5200, durationDays: 14 },
    { slug: 'product-costing', name: 'حساب تكلفة المنتجات', category: 'الربحية', summary: 'احتساب تكلفة كل صنف ونسبة Food Cost وتحديد التسعير المناسب.', basePrice: 3900, durationDays: 7 },
    { slug: 'staff-training', name: 'تدريب الموظفين', category: 'الموارد البشرية', summary: 'برنامج تدريب ميداني على الخدمة والسلامة ومعايير التشغيل.', basePrice: 7400, durationDays: 12 },
    { slug: 'mystery-shopper', name: 'تجربة العميل الخفي', category: 'الجودة', summary: 'زيارات غير معلنة لقياس تجربة العميل الفعلية بتقرير موثّق.', basePrice: 1800, durationDays: 5 },
    { slug: 'quality-visit', name: 'زيارة جودة', category: 'الجودة', summary: 'زيارة ميدانية مجدولة بقائمة فحص معتمدة وصور موثّقة.', basePrice: 1200, durationDays: 3 },
    { slug: 'staffing-request', name: 'طلب موظفين', category: 'الموارد البشرية', summary: 'ترشيح وفرز مرشحين للوظائف التشغيلية حتى مرحلة التعيين.', basePrice: null, priceNote: 'يُسعَّر حسب عدد الشواغر', durationDays: 20 },
  ]

  for (const [i, s] of services.entries()) {
    await prisma.serviceCatalog.upsert({
      where: { slug: s.slug },
      create: {
        ...s,
        sortOrder: i,
        requirementsSchema: [
          { key: 'goal', label: 'الهدف من الخدمة', type: 'text', required: true },
          { key: 'timeline', label: 'الإطار الزمني المفضّل', type: 'text', required: false },
        ],
      },
      update: { name: s.name, summary: s.summary, sortOrder: i },
    })
  }
  console.log(`  ✓ ${services.length} خدمة تشغيلية`)
}

/** ينشئ أدوار المنشأة ويربطها بالصلاحيات الافتراضية. */
async function seedRoles(organizationId: string): Promise<Map<RoleKey, string>> {
  const map = new Map<RoleKey, string>()
  const permissionRows = await prisma.permission.findMany({
    select: { id: true, key: true },
  })
  const permByKey = new Map(permissionRows.map((p) => [p.key, p.id]))

  for (const key of Object.keys(DEFAULT_ROLE_PERMISSIONS) as RoleKey[]) {
    const role = await prisma.role.upsert({
      where: { organizationId_key: { organizationId, key } },
      create: { organizationId, key, name: ROLE_LABELS[key], isSystem: true },
      update: { name: ROLE_LABELS[key] },
    })
    map.set(key, role.id)

    const wanted = DEFAULT_ROLE_PERMISSIONS[key]
    await prisma.rolePermission.createMany({
      data: wanted
        .map((pk) => permByKey.get(pk))
        .filter((id): id is string => Boolean(id))
        .map((permissionId) => ({ roleId: role.id, permissionId, granted: true })),
      skipDuplicates: true,
    })
  }
  return map
}

interface OrgSeedResult {
  organizationId: string
  branchIds: string[]
  ownerId: string
}

async function seedOrganization(opts: {
  name: string
  slug: string
  city: string
  brands: { name: string; slug: string }[]
  branches: { name: string; code: string; city: string; district: string; brandIndex: number }[]
  people: { email: string; name: string; phone: string; role: RoleKey; branchIndexes?: number[] }[]
  planTier: 'SINGLE_BRANCH' | 'GROWTH' | 'MULTI_BRANCH'
}): Promise<OrgSeedResult> {
  const org = await prisma.organization.upsert({
    where: { slug: opts.slug },
    create: {
      name: opts.name,
      slug: opts.slug,
      businessType: opts.brands.length > 1 ? 'MULTI_BRAND' : 'RESTAURANT',
      city: opts.city,
      vatNumber: `3${Math.floor(10 ** 13 + Math.random() * 9 * 10 ** 13)}`,
      status: 'ACTIVE',
      onboardingStep: 8,
      onboardingCompleted: true,
    },
    update: {},
  })

  const roleIds = await seedRoles(org.id)

  const brandIds: string[] = []
  for (const b of opts.brands) {
    const brand = await prisma.brand.upsert({
      where: { organizationId_slug: { organizationId: org.id, slug: b.slug } },
      create: { organizationId: org.id, name: b.name, slug: b.slug },
      update: { name: b.name },
    })
    brandIds.push(brand.id)
  }

  const branchIds: string[] = []
  for (const br of opts.branches) {
    const branch = await prisma.branch.upsert({
      where: { organizationId_code: { organizationId: org.id, code: br.code } },
      create: {
        organizationId: org.id,
        brandId: brandIds[br.brandIndex]!,
        name: br.name,
        code: br.code,
        city: br.city,
        district: br.district,
        status: 'ACTIVE',
        phone: '+96611' + Math.floor(1000000 + Math.random() * 8999999),
        openedAt: daysAgo(400),
        openingHours: {
          sun: { open: '07:00', close: '23:30', closed: false },
          mon: { open: '07:00', close: '23:30', closed: false },
          tue: { open: '07:00', close: '23:30', closed: false },
          wed: { open: '07:00', close: '23:30', closed: false },
          thu: { open: '07:00', close: '01:00', closed: false },
          fri: { open: '13:00', close: '01:00', closed: false },
          sat: { open: '07:00', close: '23:30', closed: false },
        },
      },
      update: { name: br.name },
    })
    branchIds.push(branch.id)
  }

  let ownerId = ''
  for (const p of opts.people) {
    const userId = await ensureUser(p.email, p.name, p.phone)
    if (p.role === RoleKey.OWNER) ownerId = userId

    const membership = await prisma.membership.upsert({
      where: { userId_organizationId: { userId, organizationId: org.id } },
      create: {
        userId,
        organizationId: org.id,
        roleId: roleIds.get(p.role)!,
        status: 'ACTIVE',
        title: ROLE_LABELS[p.role],
      },
      update: { roleId: roleIds.get(p.role)! },
    })

    if (p.branchIndexes?.length) {
      await prisma.membershipBranch.createMany({
        data: p.branchIndexes.map((i) => ({
          membershipId: membership.id,
          branchId: branchIds[i]!,
        })),
        skipDuplicates: true,
      })
    }
  }

  const plan = await prisma.plan.findUniqueOrThrow({
    where: { tier: opts.planTier },
  })
  await prisma.subscription.upsert({
    where: { organizationId: org.id },
    create: {
      organizationId: org.id,
      planId: plan.id,
      status: 'ACTIVE',
      cycle: 'MONTHLY',
      currentPeriodStart: daysAgo(12),
      currentPeriodEnd: daysAhead(18),
    },
    update: {},
  })

  return { organizationId: org.id, branchIds, ownerId }
}

/** يزرع بيانات التشغيل: قوائم فحص، زيارات، إجراءات، وصفات، مخزون، هدر. */
async function seedOperations(org: OrgSeedResult, prefix: string): Promise<void> {
  const { organizationId, branchIds, ownerId } = org

  // ── قوالب الفحص ────────────────────────────────────────────────
  const templateSpec = [
    {
      name: 'فحص الافتتاح اليومي',
      frequency: 'DAILY' as const,
      passScore: 85,
      sections: [
        {
          title: 'النظافة العامة',
          items: [
            { label: 'الأرضيات نظيفة وجافة', type: 'YES_NO' as const, required: true, criticalFail: false },
            { label: 'الطاولات معقّمة وجاهزة', type: 'YES_NO' as const, required: true, criticalFail: false },
            { label: 'دورات المياه نظيفة ومجهّزة', type: 'YES_NO' as const, required: true, criticalFail: true },
            { label: 'صورة توثّق حالة الصالة', type: 'PHOTO' as const, required: false, criticalFail: false },
          ],
        },
        {
          title: 'سلامة الغذاء',
          items: [
            { label: 'درجة حرارة الثلاجة (مئوية)', type: 'NUMBER' as const, required: true, criticalFail: true },
            { label: 'درجة حرارة الفريزر (مئوية)', type: 'NUMBER' as const, required: true, criticalFail: true },
            { label: 'لا توجد أصناف منتهية الصلاحية', type: 'YES_NO' as const, required: true, criticalFail: true },
            { label: 'تقييم ترتيب المخزن', type: 'SCORE' as const, required: true, maxScore: 5, criticalFail: false },
          ],
        },
        {
          title: 'جاهزية الفريق',
          items: [
            { label: 'الزي النظامي مكتمل ونظيف', type: 'YES_NO' as const, required: true, criticalFail: false },
            { label: 'عدد الموظفين الحاضرين', type: 'NUMBER' as const, required: true, criticalFail: false },
            { label: 'ملاحظات المناوبة', type: 'TEXT' as const, required: false, criticalFail: false },
            { label: 'توقيع مدير المناوبة', type: 'SIGNATURE' as const, required: true, criticalFail: false },
          ],
        },
      ],
    },
    {
      name: 'تدقيق الجودة الأسبوعي',
      frequency: 'WEEKLY' as const,
      passScore: 80,
      sections: [
        {
          title: 'معايير التقديم',
          items: [
            { label: 'مطابقة الطبق للصورة المعتمدة', type: 'SCORE' as const, required: true, maxScore: 5, criticalFail: false },
            { label: 'زمن التحضير ضمن المستهدف', type: 'YES_NO' as const, required: true, criticalFail: false },
            { label: 'حالة أدوات التقديم', type: 'MULTIPLE_CHOICE' as const, required: true, options: ['ممتازة', 'جيدة', 'تحتاج استبدال'], criticalFail: false },
          ],
        },
        {
          title: 'تجربة العميل',
          items: [
            { label: 'زمن استقبال العميل أقل من دقيقتين', type: 'YES_NO' as const, required: true, criticalFail: false },
            { label: 'تقييم نظافة منطقة الانتظار', type: 'SCORE' as const, required: true, maxScore: 5, criticalFail: false },
            { label: 'ملاحظات المفتش', type: 'TEXT' as const, required: false, criticalFail: false },
          ],
        },
      ],
    },
  ]

  const templateIds: string[] = []
  for (const spec of templateSpec) {
    const existing = await prisma.checklistTemplate.findFirst({
      where: { organizationId, name: spec.name },
    })
    if (existing) {
      templateIds.push(existing.id)
      continue
    }

    const template = await prisma.checklistTemplate.create({
      data: {
        organizationId,
        name: spec.name,
        frequency: spec.frequency,
        passScore: spec.passScore,
        description: `قالب معتمد — ${spec.name}`,
        sections: {
          create: spec.sections.map((section, si) => ({
            title: section.title,
            sortOrder: si,
            items: {
              create: section.items.map((item, ii) => ({
                label: item.label,
                type: item.type,
                required: item.required,
                sortOrder: ii,
                maxScore: 'maxScore' in item ? item.maxScore : null,
                options: 'options' in item ? item.options : [],
                criticalFail: item.criticalFail,
              })),
            },
          })),
        },
      },
    })
    templateIds.push(template.id)

    // جدولة القالب على كل فرع
    for (const branchId of branchIds) {
      await prisma.checklistSchedule.upsert({
        where: { templateId_branchId: { templateId: template.id, branchId } },
        create: {
          templateId: template.id,
          branchId,
          frequency: spec.frequency,
          dayOfWeek: spec.frequency === 'WEEKLY' ? 0 : null,
          timeOfDay: '08:00',
        },
        update: {},
      })
    }
  }

  // ── الزيارات: مكتملة، متأخرة، وقيد التنفيذ ─────────────────────
  const dailyTemplate = await prisma.checklistTemplate.findUniqueOrThrow({
    where: { id: templateIds[0]! },
    include: { sections: { include: { items: true }, orderBy: { sortOrder: 'asc' } } },
  })
  const allItems = dailyTemplate.sections.flatMap((s) => s.items)

  const existingInspections = await prisma.inspection.count({ where: { organizationId } })
  if (existingInspections === 0) {
    let counter = 1
    for (const [bi, branchId] of branchIds.entries()) {
      // زيارات مكتملة على مدى ١٢ يومًا
      for (let d = 12; d >= 1; d -= 1) {
        // تنويع الأداء بين الفروع ليكون للمقارنة معنى
        const base = 96 - bi * 7
        const score = Math.max(58, Math.min(100, base - (d % 5) * 3 + (d % 3) * 2))
        const passed = score >= dailyTemplate.passScore

        const inspection = await prisma.inspection.create({
          data: {
            organizationId,
            branchId,
            templateId: dailyTemplate.id,
            inspectorId: ownerId,
            reference: `${prefix}-INS-${String(counter).padStart(4, '0')}`,
            status: 'APPROVED',
            startedAt: daysAgo(d),
            submittedAt: daysAgo(d),
            approvedAt: daysAgo(d),
            score,
            maxScore: 100,
            passed,
            notes: passed ? null : 'انخفاض في معايير سلامة الغذاء يستدعي متابعة.',
          },
        })
        counter += 1

        // إجابات واقعية لكل بند
        for (const item of allItems) {
          const isViolation = !passed && item.criticalFail
          await prisma.inspectionAnswer.create({
            data: {
              inspectionId: inspection.id,
              itemId: item.id,
              valueBool: item.type === 'YES_NO' ? !isViolation : null,
              valueNumber:
                item.type === 'NUMBER'
                  ? item.label.includes('الفريزر')
                    ? -18
                    : item.label.includes('الثلاجة')
                      ? 4
                      : 6
                  : null,
              valueChoice: item.type === 'MULTIPLE_CHOICE' ? 'جيدة' : null,
              valueText: item.type === 'TEXT' ? 'المناوبة سارت دون ملاحظات جوهرية.' : null,
              scoreAwarded: item.type === 'SCORE' ? (passed ? 5 : 3) : null,
              isViolation,
            },
          })
        }

        // مخالفة → إجراء تصحيحي
        if (!passed) {
          await prisma.correctiveAction.create({
            data: {
              organizationId,
              branchId,
              inspectionId: inspection.id,
              createdById: ownerId,
              assigneeId: ownerId,
              reference: `${prefix}-CA-${String(counter).padStart(4, '0')}`,
              title: 'معالجة ملاحظات سلامة الغذاء',
              description: 'ضبط درجات حرارة التبريد وإعادة تدريب الفريق على سجل الحرارة.',
              priority: 'HIGH',
              status: d > 6 ? 'COMPLETED' : d > 3 ? 'IN_PROGRESS' : 'OVERDUE',
              dueAt: daysAgo(d - 3),
              completedAt: d > 6 ? daysAgo(d - 2) : null,
            },
          })
        }
      }

      // زيارة متأخرة مفتوحة على كل فرع
      await prisma.inspection.create({
        data: {
          organizationId,
          branchId,
          templateId: templateIds[1]!,
          reference: `${prefix}-INS-${String(counter).padStart(4, '0')}`,
          status: 'OVERDUE',
          dueAt: daysAgo(2),
        },
      })
      counter += 1
    }
  }

  // ── الموظفون ───────────────────────────────────────────────────
  const staffNames = [
    ['خالد بن سعيد الغامدي', 'مدير فرع'],
    ['نورة بنت عبدالله القحطاني', 'مشرفة خدمة'],
    ['ماجد بن فهد العتيبي', 'شيف أول'],
    ['ريم بنت سلطان الدوسري', 'كاشير'],
    ['عبدالرحمن بن ناصر الشهري', 'باريستا'],
    ['هيا بنت تركي المطيري', 'مشرفة جودة'],
  ]
  const existingEmployees = await prisma.employee.count({ where: { organizationId } })
  if (existingEmployees === 0) {
    for (const [i, [fullName, position]] of staffNames.entries()) {
      const employee = await prisma.employee.create({
        data: {
          organizationId,
          branchId: branchIds[i % branchIds.length]!,
          fullName: fullName!,
          position: position!,
          employeeNo: `${prefix}-EMP-${String(i + 1).padStart(3, '0')}`,
          nationality: i % 3 === 0 ? 'سعودي' : i % 3 === 1 ? 'مصري' : 'فلبيني',
          phone: '+9665' + Math.floor(10000000 + Math.random() * 89999999),
          status: 'ACTIVE',
          hiredAt: daysAgo(300 - i * 20),
          trainingDone: i % 2 === 0,
          lastRating: 3 + (i % 3),
        },
      })

      // مستند قارب على الانتهاء — يغذّي تنبيه انتهاء المستندات
      await prisma.employeeDocument.create({
        data: {
          employeeId: employee.id,
          type: i % 2 === 0 ? 'HEALTH_CERTIFICATE' : 'IQAMA',
          number: `${1000000000 + i}`,
          issuedAt: daysAgo(330),
          expiresAt: i < 2 ? daysAhead(12) : daysAhead(200),
        },
      })
    }
  }

  // ── الوصفات والمكوّنات ──────────────────────────────────────────
  const existingIngredients = await prisma.ingredient.count({ where: { organizationId } })
  if (existingIngredients === 0) {
    const supplier = await prisma.supplier.create({
      data: {
        organizationId,
        name: 'مؤسسة الإمداد الغذائي',
        contactName: 'أبو محمد',
        phone: '+966512345678',
      },
    })

    const ingredientSpec = [
      { name: 'بن مختص محمّص', unit: 'GRAM' as const, unitCost: 0.085 },
      { name: 'حليب طازج', unit: 'MILLILITER' as const, unitCost: 0.0065 },
      { name: 'شراب الفانيلا', unit: 'MILLILITER' as const, unitCost: 0.042 },
      { name: 'دقيق فاخر', unit: 'GRAM' as const, unitCost: 0.006 },
      { name: 'زبدة طبيعية', unit: 'GRAM' as const, unitCost: 0.038 },
      { name: 'عسل سدر', unit: 'GRAM' as const, unitCost: 0.19 },
      { name: 'لحم بقري مفروم', unit: 'GRAM' as const, unitCost: 0.058 },
      { name: 'خبز برجر', unit: 'PIECE' as const, unitCost: 1.4 },
      { name: 'جبن شيدر', unit: 'GRAM' as const, unitCost: 0.047 },
    ]

    const ingredientIds = new Map<string, string>()
    for (const spec of ingredientSpec) {
      const ing = await prisma.ingredient.create({
        data: { organizationId, supplierId: supplier.id, ...spec, wastePct: 3 },
      })
      ingredientIds.set(spec.name, ing.id)
    }

    const category = await prisma.productCategory.create({
      data: { organizationId, name: 'الأصناف الرئيسية' },
    })

    const productSpec = [
      {
        name: 'لاتيه مختص', sku: `${prefix}-P-001`, sellPrice: 18, unitsSold: 1240,
        recipe: [['بن مختص محمّص', 18, 'GRAM'], ['حليب طازج', 220, 'MILLILITER']] as const,
      },
      {
        name: 'برجر لحم كلاسيك', sku: `${prefix}-P-002`, sellPrice: 39, unitsSold: 860,
        recipe: [['لحم بقري مفروم', 150, 'GRAM'], ['خبز برجر', 1, 'PIECE'], ['جبن شيدر', 30, 'GRAM']] as const,
      },
      {
        name: 'كيكة العسل', sku: `${prefix}-P-003`, sellPrice: 26, unitsSold: 310,
        recipe: [['دقيق فاخر', 90, 'GRAM'], ['زبدة طبيعية', 45, 'GRAM'], ['عسل سدر', 40, 'GRAM']] as const,
      },
      {
        name: 'فانيلا لاتيه بارد', sku: `${prefix}-P-004`, sellPrice: 23, unitsSold: 205,
        recipe: [['بن مختص محمّص', 18, 'GRAM'], ['حليب طازج', 200, 'MILLILITER'], ['شراب الفانيلا', 25, 'MILLILITER']] as const,
      },
    ]

    for (const p of productSpec) {
      const product = await prisma.product.create({
        data: {
          organizationId,
          categoryId: category.id,
          name: p.name,
          sku: p.sku,
          sellPrice: p.sellPrice,
          unitsSold: p.unitsSold,
          isActive: true,
        },
      })

      let totalCost = 0
      const recipe = await prisma.recipe.create({
        data: {
          organizationId,
          productId: product.id,
          name: `وصفة ${p.name}`,
          yieldQty: 1,
          yieldUnit: 'portion',
        },
      })

      for (const [ingName, qty, unit] of p.recipe) {
        const ingId = ingredientIds.get(ingName)!
        const ing = ingredientSpec.find((s) => s.name === ingName)!
        totalCost += ing.unitCost * qty
        await prisma.recipeIngredient.create({
          data: { recipeId: recipe.id, ingredientId: ingId, quantity: qty, unit },
        })
      }

      await prisma.recipe.update({
        where: { id: recipe.id },
        data: { totalCost: totalCost.toFixed(4), costUpdatedAt: new Date() },
      })
    }

    // ── المخزون والهدر ───────────────────────────────────────────
    for (const branchId of branchIds) {
      for (const [name, ingId] of ingredientIds) {
        const spec = ingredientSpec.find((s) => s.name === name)!
        const onHand = Math.round((500 + Math.random() * 4500) * 100) / 100
        const item = await prisma.inventoryItem.create({
          data: {
            organizationId,
            branchId,
            ingredientId: ingId,
            unit: spec.unit,
            quantityOnHand: onHand,
            // بعض الأصناف تحت حد إعادة الطلب عمدًا لتغذية التنبيهات
            reorderLevel: name === 'حليب طازج' ? onHand + 400 : Math.round(onHand * 0.2),
          },
        })

        await prisma.stockMovement.create({
          data: {
            organizationId,
            branchId,
            itemId: item.id,
            type: 'RECEIVE',
            quantity: onHand,
            unitCost: spec.unitCost,
            balanceAfter: onHand,
            reference: 'استلام افتتاحي',
          },
        })
      }

      // سجلات هدر بأسباب متنوّعة
      const items = await prisma.inventoryItem.findMany({
        where: { branchId },
        take: 4,
        include: { ingredient: true },
      })
      const reasons = ['EXPIRED', 'DAMAGED', 'OVER_PRODUCTION', 'PREPARATION_ERROR'] as const
      for (const [i, item] of items.entries()) {
        const qty = Math.round((5 + Math.random() * 40) * 100) / 100
        await prisma.wasteRecord.create({
          data: {
            organizationId,
            branchId,
            itemId: item.id,
            quantity: qty,
            reason: reasons[i % reasons.length]!,
            costValue: (qty * Number(item.ingredient.unitCost)).toFixed(4),
            recordedAt: daysAgo(i + 1),
          },
        })
      }
    }
  }

  // ── إشعارات داخل النظام ────────────────────────────────────────
  const existingNotifications = await prisma.notification.count({
    where: { organizationId },
  })
  if (existingNotifications === 0 && ownerId) {
    const overdueCount = await prisma.correctiveAction.count({
      where: { organizationId, status: 'OVERDUE' },
    })
    const expiringDocs = await prisma.employeeDocument.count({
      where: {
        employee: { organizationId },
        expiresAt: { gte: new Date(), lte: daysAhead(30) },
      },
    })

    const notices: {
      type: 'TASK_OVERDUE' | 'DOCUMENT_EXPIRING' | 'COMPLIANCE_DROP' | 'INSPECTION_COMPLETED'
      title: string
      body: string
      linkPath: string
    }[] = []

    if (overdueCount > 0) {
      notices.push({
        type: 'TASK_OVERDUE',
        title: 'إجراءات تصحيحية متأخرة',
        body: `${overdueCount} إجراء تجاوز موعده النهائي ويحتاج متابعة.`,
        linkPath: '/actions?status=OVERDUE',
      })
    }
    if (expiringDocs > 0) {
      notices.push({
        type: 'DOCUMENT_EXPIRING',
        title: 'مستندات قاربت على الانتهاء',
        body: `${expiringDocs} مستند لموظفين ينتهي خلال ٣٠ يومًا.`,
        linkPath: '/employees',
      })
    }
    notices.push({
      type: 'INSPECTION_COMPLETED',
      title: 'اكتملت زيارة',
      body: 'اعتُمدت زيارة جديدة وأُضيفت نتيجتها إلى درجة الالتزام.',
      linkPath: '/inspections?status=APPROVED',
    })

    for (const n of notices) {
      await prisma.notification.create({
        data: {
          organizationId,
          userId: ownerId,
          type: n.type,
          channel: 'IN_APP',
          title: n.title,
          body: n.body,
          linkPath: n.linkPath,
          sentAt: new Date(),
          createdAt: daysAgo(1),
        },
      })
    }
  }

  // ── طلب خدمة تشغيلية ───────────────────────────────────────────
  const existingOrders = await prisma.serviceOrder.count({ where: { organizationId } })
  if (existingOrders === 0) {
    const service = await prisma.serviceCatalog.findUniqueOrThrow({
      where: { slug: 'menu-engineering' },
    })
    const order = await prisma.serviceOrder.create({
      data: {
        organizationId,
        branchId: branchIds[0]!,
        serviceId: service.id,
        reference: `${prefix}-SVC-0001`,
        status: 'IN_PROGRESS',
        requirements: {
          goal: 'رفع هامش الربح على أصناف القهوة الباردة',
          timeline: 'خلال شهر',
        },
        quotedPrice: 6800,
        approvedAt: daysAgo(9),
        startedAt: daysAgo(7),
      },
    })
    for (const [i, status] of (['SUBMITTED', 'QUOTED', 'APPROVED', 'IN_PROGRESS'] as const).entries()) {
      await prisma.serviceOrderEvent.create({
        data: { orderId: order.id, status, createdAt: daysAgo(12 - i * 2) },
      })
    }
  }
}

async function main(): Promise<void> {
  console.log('🌱 بدء زرع البيانات التجريبية…\n')

  console.log('البيانات المرجعية:')
  await seedPermissions()
  await seedPlans()
  await seedServiceCatalog()

  console.log('\nالمنشأة الأولى — مذاق الرياض:')
  const org1 = await seedOrganization({
    name: 'مجموعة مذاق الرياض',
    slug: 'mathaq-riyadh',
    city: 'الرياض',
    brands: [
      { name: 'مذاق', slug: 'mathaq' },
      { name: 'ركوة', slug: 'rakwa' },
    ],
    branches: [
      { name: 'مذاق — العليا', code: 'RUH-01', city: 'الرياض', district: 'العليا', brandIndex: 0 },
      { name: 'مذاق — الملقا', code: 'RUH-02', city: 'الرياض', district: 'الملقا', brandIndex: 0 },
      { name: 'ركوة — حطين', code: 'RUH-03', city: 'الرياض', district: 'حطين', brandIndex: 1 },
    ],
    people: [
      { email: 'owner@demo.itqan.sa', name: 'سعود بن عبدالعزيز', phone: '+966501112233', role: RoleKey.OWNER },
      { email: 'gm@demo.itqan.sa', name: 'فيصل بن محمد الحربي', phone: '+966502223344', role: RoleKey.GENERAL_MANAGER },
      { email: 'ops@demo.itqan.sa', name: 'لمياء بنت خالد السبيعي', phone: '+966503334455', role: RoleKey.OPERATIONS_MANAGER },
      { email: 'branch@demo.itqan.sa', name: 'تركي بن راشد المالكي', phone: '+966504445566', role: RoleKey.BRANCH_MANAGER, branchIndexes: [0] },
      { email: 'quality@demo.itqan.sa', name: 'سارة بنت أحمد الزهراني', phone: '+966505556677', role: RoleKey.QUALITY_INSPECTOR },
      { email: 'accountant@demo.itqan.sa', name: 'بدر بن سليمان العنزي', phone: '+966506667788', role: RoleKey.ACCOUNTANT },
      { email: 'viewer@demo.itqan.sa', name: 'منى بنت عمر البلوي', phone: '+966507778899', role: RoleKey.VIEWER },
    ],
    planTier: 'GROWTH',
  })
  await seedOperations(org1, 'MTQ')
  console.log('  ✓ فروع وموظفون وفحوصات وزيارات وإجراءات ووصفات ومخزون')

  console.log('\nالمنشأة الثانية — ركن الشرقية (لإثبات العزل):')
  const org2 = await seedOrganization({
    name: 'ركن الشرقية للمطاعم',
    slug: 'rukn-sharqiya',
    city: 'الخبر',
    brands: [{ name: 'ركن', slug: 'rukn' }],
    branches: [
      { name: 'ركن — الخبر الشمالية', code: 'KHB-01', city: 'الخبر', district: 'الخبر الشمالية', brandIndex: 0 },
    ],
    people: [
      { email: 'owner@rukn.itqan.sa', name: 'عبدالله بن يوسف الدوسري', phone: '+966508889900', role: RoleKey.OWNER },
    ],
    planTier: 'SINGLE_BRANCH',
  })
  await seedOperations(org2, 'RKN')
  console.log('  ✓ منشأة مستقلة تمامًا')

  // ── حساب مدير النظام ────────────────────────────────────────────
  const superId = await ensureUser('admin@itqan.sa', 'مدير النظام', '+966500000000')
  await prisma.user.update({
    where: { id: superId },
    data: { isSuperAdmin: true },
  })
  const org1Roles = await prisma.role.findFirstOrThrow({
    where: { organizationId: org1.organizationId, key: RoleKey.SUPER_ADMIN },
  })
  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: superId,
        organizationId: org1.organizationId,
      },
    },
    create: {
      userId: superId,
      organizationId: org1.organizationId,
      roleId: org1Roles.id,
      status: 'ACTIVE',
    },
    update: {},
  })

  console.log('\n✅ اكتمل الزرع.\n')
  console.log('حسابات التجربة المحلية (كلمة المرور موحّدة):')
  console.log(`  كلمة المرور: ${DEMO_PASSWORD}\n`)
  console.log('  owner@demo.itqan.sa        مالك المنشأة')
  console.log('  gm@demo.itqan.sa           مدير عام')
  console.log('  ops@demo.itqan.sa          مدير تشغيل')
  console.log('  branch@demo.itqan.sa       مدير فرع (فرع العليا فقط)')
  console.log('  quality@demo.itqan.sa      مراقب جودة')
  console.log('  accountant@demo.itqan.sa   محاسب')
  console.log('  viewer@demo.itqan.sa       اطّلاع فقط')
  console.log('  owner@rukn.itqan.sa        مالك منشأة أخرى (لاختبار العزل)')
  console.log('  admin@itqan.sa             مدير النظام')
  console.log('\n⚠️  للتطوير المحلي فقط — لا تُستخدم في الإنتاج.')
}

main()
  .catch((error: unknown) => {
    console.error('❌ فشل الزرع:', error)
    process.exitCode = 1
  })
  .finally(() => {
    void prisma.$disconnect()
  })
