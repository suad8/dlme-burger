# البنية المعمارية — إتقان

## 1. نظرة عامة

```
┌──────────────────────────────────────────────────────────────┐
│  المتصفح / الجوال                                             │
│  RSC payload · Server Actions · لا أسرار ولا مفاتيح           │
└───────────────────────────┬──────────────────────────────────┘
                            │ HTTPS
┌───────────────────────────▼──────────────────────────────────┐
│  Next.js App Router (Node runtime)                            │
│                                                               │
│  ① middleware.ts    — حراسة المسارات، تمرير اللغة والاتجاه     │
│  ② requireSession() — جلسة Better Auth من قاعدة البيانات       │
│  ③ TenantContext    — يُشتق من الجلسة، لا من المُدخلات         │
│  ④ authorize()      — RBAC: دور + صلاحية + نطاق الفروع         │
│  ⑤ طبقة الخدمات     — كل استعلام مقيّد بـorganizationId         │
│  ⑥ Prisma Client                                              │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│  PostgreSQL 16                                                │
│  organizationId في كل جدول مستأجر · فهارس مركّبة · معاملات      │
└──────────────────────────────────────────────────────────────┘
```

القاعدة الحاكمة: **لا يصل أي استعلام إلى Prisma إلا بعد المرور بالمرحلتين ③ و④.**

---

## 2. بنية المجلدات

```
.
├── prisma/
│   ├── schema.prisma           مصدر الحقيقة لنموذج البيانات
│   ├── migrations/             ترحيلات مطبّقة على PostgreSQL
│   └── seed.ts                 بيانات تجريبية عربية واقعية
│
├── src/
│   ├── app/
│   │   ├── (marketing)/        الموقع العام — ثابت وقابل للفهرسة
│   │   ├── (auth)/             دخول · تسجيل · دعوة
│   │   ├── (app)/              المنصة — محميّة بالكامل
│   │   │   ├── onboarding/
│   │   │   ├── dashboard/
│   │   │   ├── branches/
│   │   │   ├── checklists/
│   │   │   ├── inspections/
│   │   │   ├── actions/        الإجراءات التصحيحية
│   │   │   └── settings/
│   │   ├── design-system/      عرض حي لنظام التصميم
│   │   └── api/
│   │
│   ├── components/
│   │   ├── ui/                 مكوّنات أساسية (Radix + Tailwind)
│   │   ├── charts/             أغلفة Recharts متوافقة مع RTL
│   │   └── app/                مكوّنات مركّبة خاصة بالمنتج
│   │
│   ├── server/
│   │   ├── auth.ts             تهيئة Better Auth
│   │   ├── tenant.ts           TenantContext — قلب العزل
│   │   ├── rbac.ts             الأدوار والصلاحيات و authorize()
│   │   ├── audit.ts            سجل العمليات الحساسة
│   │   ├── billing/            BillingProvider مجرّد
│   │   ├── notifications/      قنوات الإشعارات
│   │   └── services/           منطق الأعمال لكل وحدة
│   │
│   ├── lib/                    أدوات مشتركة، تنسيق، Zod
│   ├── i18n/                   ترجمات ar/en
│   └── styles/                 Design tokens بـTailwind v4
│
├── tests/
│   ├── unit/
│   └── tenant-isolation/       اختبارات العزل الإلزامية
│
└── legacy/menu-demo/           تطبيق المنيو السابق — محفوظ كما هو
```

---

## 3. عزل المستأجرين — التفصيل

### 3.1 `TenantContext`

```ts
type TenantContext = {
  userId: string
  organizationId: string        // من الجلسة — لا من المتصفح أبدًا
  role: RoleKey
  permissions: Set<Permission>
  branchScope: string[] | null  // null = كل الفروع
}
```

**قاعدة صارمة:** لا يوجد Route Handler ولا Server Action يقبل `organizationId`
كمُدخل. أي محاولة لتمريره تُتجاهل. المصدر الوحيد هو الجلسة المخزّنة في قاعدة
البيانات.

### 3.2 منع IDOR

كل قراءة لسجل بالمعرّف تمر عبر دالة تفرض المستأجر:

```ts
// ❌ ممنوع
prisma.branch.findUnique({ where: { id } })

// ✅ الشكل الوحيد المسموح
prisma.branch.findFirst({ where: { id, organizationId: ctx.organizationId } })
```

طلب سجل من منشأة أخرى يعيد `null` → صفحة 404، **لا** 403. عدم كشف الوجود
مقصود: 403 يؤكد أن المعرّف موجود لدى منشأة أخرى.

### 3.3 نطاق الفروع

مدير الفرع ومدير المنطقة يُقيَّدان بفروع محددة عبر `MembershipBranch`.
`ctx.branchScope` يُحقن في كل استعلام تشغيلي، فوق قيد المنشأة.

---

## 4. RBAC

نموذج ثلاثي: **دور → صلاحيات → نطاق**.

```
Permission = `${resource}:${action}`
  resource: branch | checklist | inspection | action | employee |
            recipe | inventory | report | service | billing | user | org | admin
  action:   view | create | update | delete | approve | export | manage
```

الأدوار العشرة معرّفة في `src/server/rbac.ts` كأدوار نظام افتراضية، وتُنسخ عند
إنشاء المنشأة إلى جدول `Role` لتصبح **قابلة للتخصيص** لكل منشأة.

التحقق دائمًا على الخادم:

```ts
const ctx = await requireTenant()
authorize(ctx, 'inspection:approve')   // يرمي ForbiddenError
```

إخفاء زر في الواجهة **ليس** تفويضًا — إنه تحسين تجربة فقط.

---

## 5. طبقة الخدمات

كل وحدة لها ملف خدمة يستقبل `TenantContext` كأول معامل. لا تستدعي مكوّنات
الواجهة Prisma مباشرة.

```ts
export async function listBranches(ctx: TenantContext, params: ListParams) {
  authorize(ctx, 'branch:view')
  return prisma.branch.findMany({
    where: {
      organizationId: ctx.organizationId,
      deletedAt: null,
      ...(ctx.branchScope ? { id: { in: ctx.branchScope } } : {}),
    },
    // select صريح — لا تسريب حقول غير مقصودة
  })
}
```

---

## 6. سجل التدقيق

كل عملية حساسة تُسجَّل في `AuditLog`: المنشأة، الفاعل، الفعل، نوع الكيان،
معرّفه، البيانات قبل/بعد (منقّاة من الحقول الحساسة)، IP، User-Agent.

الحقول الحساسة (`password`, `token`, `secret`, `hash`) تُستبعد قبل الكتابة —
مطبّق في `redact()` داخل `src/server/audit.ts`.

انتحال المستخدم للدعم يتطلب: صلاحية `admin:manage` + سبب مكتوب + تسجيل صريح.

---

## 7. الاتجاه واللغة

- الافتراضي **العربية RTL**. الإنجليزية LTR من نفس المكوّنات.
- خصائص منطقية حصريًا: `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`.
  لا `ml-*` ولا `pr-*` في كود المنتج.
- `dir` يُضبط على `<html>` من اللغة النشطة.
- الأرقام: خانات جدولية (`tabular-nums`) في الجداول والتقارير.

---

## 8. الأداء

- افتراضيًا Server Components. `"use client"` عند الحاجة للتفاعل فقط.
- ترقيم على الخادم دائمًا؛ لا جلب كامل ثم تقطيع.
- `select` صريح لتجنّب جلب أعمدة زائدة.
- علاج N+1 بـ`include` مدروس أو استعلام تجميعي واحد.
- الفلاتر في الـURL → قابلة للمشاركة وللرجوع بالمتصفح.

---

## 9. الأمان — ملخص التطبيق

| الضابط | مكان التطبيق |
|---|---|
| عزل المستأجر | `src/server/tenant.ts` + قيود قاعدة البيانات |
| تفويض خادمي | `src/server/rbac.ts` — قبل كل عملية |
| منع IDOR | `findFirst` مقيّد بالمنشأة، و404 بدل 403 |
| تحقق المُدخلات | مخططات Zod على الخادم — لا اعتماد على تحقق العميل |
| Rate limiting | `src/server/rate-limit.ts` على الدخول والتسجيل |
| الجلسات | Better Auth، كوكي `httpOnly` + `secure` + `sameSite=lax` |
| كلمات المرور | تجزئة عبر Better Auth (scrypt) |
| رفع الملفات | قيود نوع وحجم + تحقق من الامتداد والمحتوى |
| الأسرار | متغيرات بيئة خادمية فقط — لا `NEXT_PUBLIC_` لأي سر |
| سجل التدقيق | `src/server/audit.ts` مع تنقية |
