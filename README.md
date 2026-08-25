# إتقان — منصة تشغيل المطاعم والمقاهي

منصة SaaS سعودية متعددة المستأجرين لإدارة وتشغيل المطاعم والمقاهي والفود ترك
والمطابخ السحابية والعلامات متعددة الفروع.

> **الحالة:** أساس تقني عامل — المرحلتان ٠ و١ مكتملتان، والمرحلتان ٢ و٣ جزئيًا.
> التفصيل الصريح لما اكتمل وما تأجّل في [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md).

---

## التشغيل السريع

```bash
npm install

cp .env.example .env
# ولّد مفتاحًا وضعه في BETTER_AUTH_SECRET:
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"

npm run db:migrate
npm run db:seed

npm run dev      # http://localhost:3000
```

يتطلب: Node.js ≥ 20.9 و PostgreSQL ≥ 14.

---

## حسابات التجربة المحلية

كلمة المرور موحّدة: **`Itqan#Demo2026`**

| البريد | الدور | ملاحظة |
|---|---|---|
| `owner@demo.itqan.sa` | مالك المنشأة | وصول كامل |
| `gm@demo.itqan.sa` | مدير عام | — |
| `ops@demo.itqan.sa` | مدير تشغيل | — |
| `branch@demo.itqan.sa` | مدير فرع | **مقيّد بفرع العليا فقط** |
| `quality@demo.itqan.sa` | مراقب جودة | يعتمد الفحوصات |
| `accountant@demo.itqan.sa` | محاسب | فوترة بلا تعديل تشغيلي |
| `viewer@demo.itqan.sa` | اطّلاع فقط | لا صلاحيات كتابة |
| `owner@rukn.itqan.sa` | مالك منشأة أخرى | **لاختبار العزل** |
| `admin@itqan.sa` | مدير النظام | — |

> ⚠️ **للتطوير المحلي فقط.** لا تُشغّل `db:seed` على أي بيئة إنتاج.

جرّب العزل بنفسك: سجّل الدخول بـ`branch@demo.itqan.sa` ولاحظ أنه يرى فرعًا
واحدًا فقط، ثم بـ`owner@rukn.itqan.sa` ولاحظ أنه لا يرى أي بيانات من المنشأة
الأولى.

---

## الأوامر

| الأمر | الوظيفة |
|---|---|
| `npm run dev` | خادم التطوير |
| `npm run build` | بناء الإنتاج (يشغّل `prisma generate`) |
| `npm run start` | تشغيل نسخة الإنتاج |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript بلا إخراج |
| `npm run test` | Vitest — وحدات + عزل مستأجرين |
| `npm run verify` | **الكل**: lint + types + tests + build |
| `npm run db:migrate` | ترحيل تطويري |
| `npm run db:deploy` | ترحيل إنتاجي |
| `npm run db:seed` | بيانات تجريبية |
| `npm run db:reset` | ⚠️ مسح كامل وإعادة بناء |

---

## البنية

```
├── prisma/              المخطط (٤٣ نموذجًا) + الترحيلات + الزرع
├── src/
│   ├── app/
│   │   ├── (marketing)/ الموقع العام — ١٣ صفحة
│   │   ├── (auth)/      دخول · تسجيل
│   │   ├── (app)/       المنصة (محميّة)
│   │   └── design-system/
│   ├── components/ui/   نظام التصميم
│   ├── server/          auth · tenant · rbac · audit · services
│   └── lib/             أدوات + مخططات Zod
├── tests/
│   ├── unit/
│   └── tenant-isolation/   ← اختبارات العزل الإلزامية
└── legacy/menu-demo/    تطبيق المنيو السابق — محفوظ ويُنشر على GitHub Pages
```

الوثائق: [`PROJECT_PLAN.md`](./PROJECT_PLAN.md) ·
[`ARCHITECTURE.md`](./ARCHITECTURE.md) ·
[`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md) ·
[`DEPLOYMENT.md`](./DEPLOYMENT.md) ·
[`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md)

---

## الأمان — ما هو مطبّق فعليًا

- **عزل ثلاثي الطبقات**: قيود قاعدة بيانات + تقييد كل استعلام بمعرّف المنشأة
  المشتق من الجلسة + اختبارات آلية تفشل البناء عند التسرّب.
- **`organizationId` لا يُقبل من المتصفح إطلاقًا** — لا مسار يقرأه من المُدخلات.
- **منع IDOR**: `findFirst` مقيّد بالمنشأة، و404 بدل 403 حتى لا نكشف الوجود.
- **RBAC خادمي**: `authorize()` قبل كل عملية. إخفاء زر في الواجهة ليس تفويضًا.
- **قاعدة لينت** ترفض استيراد Prisma خارج طبقة الخادم.
- **تنقية سجل التدقيق**: كلمات المرور والرموز تُحجب قبل الكتابة.
- **تحديد معدّل** على الدخول والتسجيل.
- **حارس إقلاع** يمنع تشغيل الإنتاج بمفتاح مصادقة تطويري.

---

## ملاحظة عن GitHub Pages

الموقع الثابت على <https://suad8.github.io/dlme-burger/> **لا يزال يعمل** —
تطبيق المنيو نُقل إلى `legacy/menu-demo/` وسير عمل النشر يبني منه.

المنصة نفسها لا يمكن استضافتها على Pages (تحتاج Node وقاعدة بيانات). البدائل
في [`DEPLOYMENT.md`](./DEPLOYMENT.md).
