# مخطط قاعدة البيانات — إتقان

PostgreSQL 16 · Prisma 7.10 · **43 نموذجًا / 52 جدولًا** (شاملة جداول الربط)

مصدر الحقيقة هو `prisma/schema.prisma`. هذه الوثيقة تشرح التصميم لا تستبدله.

---

## القواعد الحاكمة

1. **`organizationId` في كل جدول مستأجر.** بلا استثناء. أي جدول جديد بلا هذا
   العمود يُرفض في المراجعة.
2. **فهرس مركّب يبدأ بـ`organizationId`** على كل جدول مستأجر، لأن كل استعلام
   يبدأ بهذا القيد.
3. **`onDelete: Cascade` من `Organization`** — حذف منشأة لا يترك بيانات يتيمة.
4. **`onDelete: Restrict`** على المراجع التي تحمل معنى تاريخيًا (من أنشأ
   الإجراء، أي فرع خضع للزيارة) — لا نفقد أثر المسؤولية.
5. **`deletedAt`** للحذف الناعم حيث للبيانات قيمة تاريخية.
6. **`version`** للتزامن المتفائل على السجلات التي يعدّلها أكثر من شخص.

---

## المجموعات

### ١. المصادقة (٥ جداول)

| الجدول | الدور | ملاحظات |
|---|---|---|
| `users` | المستخدمون | `isSuperAdmin` لا يُقبل من المُدخلات إطلاقًا |
| `sessions` | الجلسات | `activeOrganizationId` — **المصدر الوحيد** لعزل المستأجر |
| `accounts` | بيانات الاعتماد | `password` مجزّأة بـscrypt، `issuer` تطلبه Better Auth 1.7+ |
| `verifications` | رموز التحقق | — |
| `login_attempts` | محاولات الدخول | ناجحة وفاشلة — لرصد الهجمات |

`sessions.impersonatedBy` يوثّق انتحال الدعم للمستخدم.

### ٢. المستأجر (٤ جداول)

```
organizations ──< brands ──< branches
      │                          │
      └──< memberships >── membership_branches ──┘
```

- `organizations.onboardingStep` — التقدّم محفوظ في قاعدة البيانات لا في الجلسة.
- `brands.settings` (JSON) تُورَّث للفروع؛ `branches.settings` تتجاوزها.
- `branches` فريد بـ`(organizationId, code)` — الرمز فريد داخل المنشأة فقط.

### ٣. الأدوار والصلاحيات (٥ جداول)

```
roles ──< role_permissions >── permissions
  │
  └──< memberships ──< membership_branches
```

- `permissions` عالمي: ١١٢ صفًا (١٦ موردًا × ٧ أفعال).
- `roles` **لكل منشأة**: تُنسخ أدوار النظام العشرة عند الإنشاء، فتصبح قابلة
  للتخصيص دون تعديل الكود.
- `membership_branches` فارغ = وصول لكل الفروع. غير فارغ = مقيّد بها.

### ٤. الاشتراكات والفوترة (٦ جداول)

```
plans ──< plan_features
  │
  └──< subscriptions ──< invoices ──< payments
coupons (مستقل)
```

- `plan_features.key` يُفحص على الخادم كـentitlement حقيقي.
- المبالغ `Decimal(10,2)` — **لا `Float` للمال أبدًا**.
- `subscriptions.providerRef` معرّف لدى البوابة؛ لا يُخزَّن أي مفتاح سري.

### ٥. الموظفون والتوظيف (٤ جداول)

`employees` → `employee_documents` (بتاريخ انتهاء يغذّي التنبيهات)
`recruitment_requests` → `candidates` (بمراحل من التقديم إلى التعيين)

المستندات الحساسة تُخزَّن كـ`storageKey` يشير إلى مخزن محمي — لا ملفات عامة.

### ٦. الفحص والزيارات (٦ جداول)

```
checklist_templates ──< checklist_sections ──< checklist_items
        │                                            │
        ├──< checklist_schedules (لكل فرع)           │
        └──< inspections ──< inspection_answers >────┘
                   │
                   └──< attachments
```

- `checklist_items.type`: نعم/لا · درجة · نص · رقم · اختيار متعدد · صورة · توقيع.
- `criticalFail` — فشل البند يفتح إجراءً تصحيحيًا تلقائيًا.
- `inspection_answers` فريد بـ`(inspectionId, itemId)` — إجابة واحدة لكل بند.
- `inspections` فريد بـ`(organizationId, reference)`.

### ٧. الإجراءات والمهام (٣ جداول)

`corrective_actions` (٦ حالات) · `tasks` · `comments` (متعدد الارتباط)

فهرس `(organizationId, assigneeId, status)` يخدم شاشة «مهامي» مباشرة.

### ٨. المنتجات والوصفات (٥ جداول)

```
product_categories ──< products ──1:1── recipes ──< recipe_ingredients >── ingredients ──> suppliers
```

- `recipes.totalCost` محسوبة ومخزّنة، مع `costUpdatedAt` لرصد التقادم.
- `products.menuClass`: نجوم · ألغاز · خيول عمل · منتجات ضعيفة.
- التكاليف `Decimal(10,4)` — الدقة مهمة عند الضرب في كميات صغيرة.

### ٩. المخزون والهدر (٥ جداول)

```
inventory_items ──< stock_movements
       │       └──< inventory_count_lines >── inventory_counts
       └──< waste_records
```

- `stock_movements.balanceAfter` — سجل غير قابل للتعديل الصامت.
- `inventory_items.allowNegative` — المخزون السالب ممنوع افتراضيًا، والسماح
  به قرار صريح لكل صنف.
- `inventory_items` فريد بـ`(branchId, ingredientId)`.

### ١٠. الخدمات (٣ جداول)

`service_catalog` (عام) → `service_orders` (لكل منشأة) → `service_order_events`

`requirementsSchema` (JSON) يعرّف حقول الطلب ديناميكيًا لكل خدمة.

### ١١. الإشعارات والتدقيق (٣ جداول)

`notifications` (٤ قنوات: داخل النظام، بريد، SMS، واتساب) · `support_tickets` ·
`audit_logs`

`audit_logs.before/after` تُنقّى من الحقول الحساسة قبل الكتابة عبر `redact()`.

---

## الفهارس المهمة

| الفهرس | يخدم |
|---|---|
| `inspections(organizationId, branchId, submittedAt)` | اتجاه الالتزام ومقارنة الفروع |
| `inspections(organizationId, dueAt)` | الفحوصات المتأخرة |
| `corrective_actions(organizationId, assigneeId, status)` | «مهامي المفتوحة» |
| `corrective_actions(organizationId, dueAt)` | الإجراءات المتأخرة |
| `stock_movements(organizationId, branchId, createdAt)` | سجل حركة المخزون |
| `waste_records(organizationId, branchId, recordedAt)` | تقرير الهدر |
| `employee_documents(expiresAt)` | تنبيه انتهاء المستندات |
| `audit_logs(organizationId, createdAt)` | استعراض السجل زمنيًا |

---

## القيود التي تحمي العزل

اختبارات `tests/tenant-isolation/` تتحقق فعليًا من:

```sql
-- كل زيارة تخص فرعًا من نفس منشأتها
SELECT COUNT(*) FROM inspections i
JOIN branches b ON b.id = i."branchId"
WHERE b."organizationId" <> i."organizationId";   -- يجب أن يكون 0
```

نفس التحقق مطبّق على `corrective_actions` و`inventory_items`، ويفشل البناء
إن رجع أي صف.

---

## الترحيلات

```
prisma/migrations/
  20260825224720_init/               ٥٠ جدولًا
  20260825225334_add_account_issuer/ حقل تطلبه Better Auth 1.7+
```

الأوامر:

```bash
npm run db:migrate   # تطوير: ينشئ ترحيلًا ويطبّقه
npm run db:deploy    # إنتاج: يطبّق الترحيلات فقط
npm run db:seed      # بيانات تجريبية
npm run db:reset     # ⚠️ يمسح كل شيء ويعيد البناء والزرع
```
