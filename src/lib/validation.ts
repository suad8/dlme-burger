import { z } from 'zod'

/**
 * مخططات مشتركة بين الخادم والعميل.
 *
 * ⚠️ تحقق العميل تحسين تجربة فقط. كل Server Action يعيد تشغيل نفس المخطط
 * على الخادم — لا يُعتمد على ما يصل من المتصفح.
 */

// التنظيف يسبق التحقق: المستخدم قد ينسخ بريده بمسافات أو بأحرف كبيرة،
// وهذا لا يجعل البريد غير صالح.
export const emailSchema = z
  .string()
  .min(1, 'البريد الإلكتروني مطلوب')
  .transform((v) => v.trim().toLowerCase())
  .pipe(
    z
      .string()
      .email('صيغة البريد الإلكتروني غير صحيحة')
      .max(254, 'البريد الإلكتروني طويل جدًا'),
  )

export const passwordSchema = z
  .string()
  .min(12, 'كلمة المرور يجب ألا تقل عن ١٢ محرفًا')
  .max(128, 'كلمة المرور طويلة جدًا')
  .refine((v) => /[a-z]/.test(v), 'أضف حرفًا إنجليزيًا صغيرًا على الأقل')
  .refine((v) => /[A-Z]/.test(v), 'أضف حرفًا إنجليزيًا كبيرًا على الأقل')
  .refine((v) => /[0-9]/.test(v), 'أضف رقمًا واحدًا على الأقل')

/** رقم جوال سعودي: 05XXXXXXXX أو +9665XXXXXXXX. */
export const saudiPhoneSchema = z
  .string()
  .regex(
    /^(?:\+9665|05)\d{8}$/,
    'أدخل رقم جوال سعودي صحيح — مثال: 0512345678',
  )

/** الرقم الضريبي السعودي: ١٥ رقمًا يبدأ وينتهي بـ٣. */
export const vatNumberSchema = z
  .string()
  .regex(/^3\d{13}3$/, 'الرقم الضريبي يتكوّن من ١٥ رقمًا ويبدأ وينتهي بالرقم ٣')

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
})

export const registerSchema = z.object({
  name: z
    .string()
    .min(2, 'الاسم مطلوب')
    .max(120, 'الاسم طويل جدًا')
    .transform((v) => v.trim()),
  email: emailSchema,
  password: passwordSchema,
  organizationName: z
    .string()
    .min(2, 'اسم المنشأة مطلوب')
    .max(160, 'اسم المنشأة طويل جدًا')
    .transform((v) => v.trim()),
})

export const branchSchema = z.object({
  name: z.string().min(2, 'اسم الفرع مطلوب').max(160),
  code: z
    .string()
    .min(2, 'رمز الفرع مطلوب')
    .max(24)
    .regex(/^[A-Za-z0-9-]+$/, 'الرمز يقبل أحرفًا إنجليزية وأرقامًا وشرطة فقط')
    .transform((v) => v.toUpperCase()),
  brandId: z.string().min(1, 'اختر العلامة التجارية'),
  city: z.string().max(80).optional().or(z.literal('')),
  district: z.string().max(80).optional().or(z.literal('')),
  phone: saudiPhoneSchema.optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'TEMPORARILY_CLOSED', 'UNDER_SETUP', 'CLOSED']),
})

export const correctiveActionSchema = z.object({
  title: z.string().min(3, 'عنوان الإجراء مطلوب').max(200),
  description: z.string().max(2000).optional().or(z.literal('')),
  branchId: z.string().min(1, 'اختر الفرع'),
  assigneeId: z.string().optional().or(z.literal('')),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  dueAt: z.string().optional().or(z.literal('')),
})

/** قيود رفع الملفات — تُفرض على الخادم أيضًا. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export const uploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_IMAGE_TYPES, {
    message: 'نوع الملف غير مدعوم. المسموح: JPEG أو PNG أو WebP',
  }),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_UPLOAD_BYTES, 'حجم الملف يتجاوز ٨ ميغابايت'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type BranchInput = z.infer<typeof branchSchema>
export type CorrectiveActionInput = z.infer<typeof correctiveActionSchema>

/* ── قوالب الفحص ──────────────────────────────────────────── */

export const checklistItemSchema = z.object({
  label: z.string().min(2, 'نص البند مطلوب').max(300),
  hint: z.string().max(300).optional().or(z.literal('')),
  type: z.enum([
    'YES_NO',
    'SCORE',
    'TEXT',
    'NUMBER',
    'MULTIPLE_CHOICE',
    'PHOTO',
    'SIGNATURE',
  ]),
  required: z.boolean(),
  criticalFail: z.boolean(),
  weight: z.number().int().min(1, 'الوزن لا يقل عن ١').max(10, 'الوزن لا يتجاوز ١٠'),
  maxScore: z.number().int().min(2).max(10).nullable(),
  options: z.array(z.string().min(1).max(120)).max(10),
})

export const checklistSectionSchema = z.object({
  title: z.string().min(2, 'عنوان القسم مطلوب').max(200),
  items: z
    .array(checklistItemSchema)
    .min(1, 'كل قسم يحتاج بندًا واحدًا على الأقل')
    .max(50, 'حد أقصى ٥٠ بندًا في القسم'),
})

export const checklistTemplateSchema = z
  .object({
    name: z.string().min(3, 'اسم القالب مطلوب').max(200),
    description: z.string().max(1000).optional().or(z.literal('')),
    frequency: z.enum(['ON_DEMAND', 'DAILY', 'WEEKLY', 'MONTHLY']),
    passScore: z
      .number()
      .int()
      .min(1, 'درجة النجاح بين ١ و١٠٠')
      .max(100, 'درجة النجاح بين ١ و١٠٠'),
    isActive: z.boolean(),
    sections: z
      .array(checklistSectionSchema)
      .min(1, 'القالب يحتاج قسمًا واحدًا على الأقل')
      .max(20, 'حد أقصى ٢٠ قسمًا'),
  })
  .superRefine((data, ctx) => {
    // قالب بلا بند قابل للتسجيل لا يمكن احتساب نتيجته
    const scorable = data.sections
      .flatMap((s) => s.items)
      .filter((i) => ['YES_NO', 'SCORE', 'MULTIPLE_CHOICE'].includes(i.type))

    if (scorable.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['sections'],
        message:
          'القالب يحتاج بندًا واحدًا على الأقل قابلًا للتسجيل (نعم/لا أو درجة أو اختيار من متعدد) لتُحتسب النتيجة.',
      })
    }

    data.sections.forEach((section, si) => {
      section.items.forEach((item, ii) => {
        if (item.type === 'MULTIPLE_CHOICE' && item.options.length < 2) {
          ctx.addIssue({
            code: 'custom',
            path: ['sections', si, 'items', ii, 'options'],
            message: 'الاختيار من متعدد يحتاج خيارين على الأقل.',
          })
        }
        if (item.type === 'SCORE' && item.maxScore === null) {
          ctx.addIssue({
            code: 'custom',
            path: ['sections', si, 'items', ii, 'maxScore'],
            message: 'بند الدرجة يحتاج حدًا أقصى.',
          })
        }
      })
    })
  })

export type ChecklistTemplateInput = z.infer<typeof checklistTemplateSchema>
export type ChecklistSectionInput = z.infer<typeof checklistSectionSchema>
export type ChecklistItemInput = z.infer<typeof checklistItemSchema>
