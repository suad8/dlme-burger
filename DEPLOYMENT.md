# النشر — إتقان

## ⚠️ أولًا: GitHub Pages لا يصلح لهذه المنصة

المستودع كان يستضيف تطبيق منيو ثابتًا على GitHub Pages. **المنصة لا يمكن نشرها
هناك.** Pages يخدم ملفات ثابتة فقط، والمنصة تحتاج:

- Node.js runtime لتشغيل Server Components وServer Actions
- اتصالًا بقاعدة PostgreSQL
- أسرارًا خادمية (مفتاح المصادقة، رابط قاعدة البيانات)

ما تم فعليًا في هذا الفرع:

- تطبيق المنيو **محفوظ** في `legacy/menu-demo/` بتاريخه كاملًا
- سير عمل GitHub Pages **معدّل** ليبني من `legacy/menu-demo/` — فيبقى
  <https://suad8.github.io/dlme-burger/> يعمل كما هو
- المنصة في جذر المستودع، وتحتاج استضافة حقيقية

---

## متغيرات البيئة

| المتغير | إلزامي | الوصف |
|---|---|---|
| `DATABASE_URL` | ✅ | `postgresql://user:pass@host:5432/db?schema=public` |
| `BETTER_AUTH_SECRET` | ✅ | ٣٢ بايت عشوائية. **لا تعيد استخدام مفتاح التطوير** |
| `BETTER_AUTH_URL` | ✅ | العنوان العام الكامل، مثل `https://app.itqan.sa` |
| `NEXT_PUBLIC_APP_URL` | ✅ | نفس العنوان — الوحيد المسموح كشفه للمتصفح |

توليد مفتاح:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

> حارس مطبّق في `src/server/auth.ts`: أي مفتاح يبدأ بـ`dev-only` يوقف الإقلاع
> في الإنتاج. هذا مقصود — لا تعطّله.

**لا تضع أي سر في متغير يبدأ بـ`NEXT_PUBLIC_`** — كل ما يحمل هذه البادئة
يُرسل إلى المتصفح.

---

## الخيار ١: Vercel (الأسرع)

1. اربط المستودع، واختر فرع المنصة.
2. أضف متغيرات البيئة أعلاه في إعدادات المشروع.
3. قاعدة البيانات: Neon أو Supabase أو أي PostgreSQL مُدار.
4. أمر البناء: `npm run build` (يشغّل `prisma generate` تلقائيًا).
5. بعد أول نشر، طبّق الترحيلات:

```bash
DATABASE_URL="<الإنتاج>" npx prisma migrate deploy
```

⚠️ **لا تُشغّل `db:seed` على الإنتاج.** البيانات التجريبية تُنشئ حسابات بكلمة
مرور معروفة.

---

## الخيار ٢: Docker

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG DATABASE_URL
ARG BETTER_AUTH_SECRET
ARG BETTER_AUTH_URL
ARG NEXT_PUBLIC_APP_URL
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /app/.next ./.next
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/package.json ./
COPY --from=builder --chown=app:app /app/prisma ./prisma
USER app
EXPOSE 3000
CMD ["npm", "start"]
```

---

## قائمة ما قبل الإطلاق

- [ ] `BETTER_AUTH_SECRET` جديد وعشوائي — لا نسخة من التطوير
- [ ] `DATABASE_URL` يشير إلى قاعدة إنتاج مع نسخ احتياطي مجدول
- [ ] `npx prisma migrate deploy` طُبّق
- [ ] **لم** يُشغَّل `db:seed`
- [ ] HTTPS مفعّل (الكوكيز `secure` لا تعمل بدونه)
- [ ] `NEXT_PUBLIC_APP_URL` = العنوان العام الحقيقي
- [ ] `npm run verify` يمر كاملًا (lint + types + tests + build)
- [ ] مراجعة قانونية لصفحتَي `/privacy` و`/terms` — الحاليتان مسوّدتان
- [ ] استبدال `checkRateLimit` بمخزن Redis إن كان النشر بأكثر من نسخة
      (الحالي داخل الذاكرة — الحد لكل نسخة لا عالميًا)
- [ ] تحديد مزوّد الدفع وربطه بطبقة `BillingProvider`

---

## التشغيل محليًا

```bash
# ١. PostgreSQL
createdb mansha   # أو أي قاعدة متاحة

# ٢. البيئة
cp .env.example .env    # ثم عبّئ القيم

# ٣. الاعتماديات والقاعدة
npm install
npm run db:migrate
npm run db:seed

# ٤. التشغيل
npm run dev             # http://localhost:3000
```

حسابات التجربة في `README.md`.

---

## سجل الترحيلات

`prisma migrate deploy` يطبّق الترحيلات بالترتيب ولا يحذف بيانات. راجع
`prisma/migrations/*/migration.sql` قبل أي نشر إنتاجي يتضمن تغييرًا في المخطط.

## بعد ترقية تضيف صلاحية افتراضية جديدة

الأدوار تُنسخ إلى كل منشأة عند إنشائها لتبقى قابلة للتخصيص، فإضافة صلاحية إلى
`DEFAULT_ROLE_PERMISSIONS` لا تصل إلى المنشآت القائمة تلقائيًا. بعد النشر شغّل:

```bash
npm run db:seed
```

الزرع يستعمل `createMany({ skipDuplicates: true })`، فيضيف الناقص ولا يحذف أي
تخصيص أجرته المنشأة على أدوارها.

## اختبارات الطرف إلى الطرف

```bash
npm run build   # الاختبارات تعمل على بناء إنتاج لا خادم تطوير
npm run e2e
```

المتصفح يُقرأ من `E2E_CHROMIUM` (افتراضيًا `/opt/pw-browsers/chromium`)،
والمنفذ من `E2E_PORT` (افتراضيًا 3100). لا حاجة إلى `playwright install` إن
كان المتصفح مثبّتًا في الصورة.

قاعدة البيانات يجب أن تكون مزروعة (`npm run db:seed`) لأن الاختبارات تستعمل
الحسابات التجريبية. لا تُشغَّل على قاعدة إنتاج.
