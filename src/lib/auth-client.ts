'use client'

import { createAuthClient } from 'better-auth/react'

/**
 * لا نمرّر baseURL.
 *
 * مسار المصادقة يُقدَّم من نفس تطبيق Next، فأصل الصفحة هو العنوان الصحيح
 * دائمًا. تمرير `NEXT_PUBLIC_APP_URL` كان يُثبِّت العنوان وقت البناء، فأي نشر
 * على نطاق أو منفذ مختلف عمّا بُني عليه يجعل المتصفح يرسل طلب الدخول إلى
 * مضيف آخر — وهو ما ظهر فعلًا حين شُغِّلت اختبارات الطرف إلى الطرف على منفذ
 * غير منفذ البناء.
 */
export const authClient = createAuthClient()

export const { signIn, signUp, signOut, useSession } = authClient
