/**
 * فحص البيئة عند إقلاع الخادم.
 *
 * Next ينادي `register()` مرة واحدة عند بدء التشغيل. نستغلّها للتأكد من أن
 * كل مزوّد مُعلَن في البيئة قابل للبناء فعلًا — قبل أن يصل أول طلب.
 *
 * السبب: المزوّدات تُبنى كسولًا عند أول استعمال. إعداد ناقص لمخزن الملفات
 * كان يعني خادمًا يقلع بنجاح ثم يفشل أول رفع بعد ساعات، وقد يكون ذلك مستندًا
 * لا نسخة ثانية له. الفشل عند الإقلاع أرحم بكثير.
 */
export async function register(): Promise<void> {
  // مسار Node فقط — لا يعمل هذا الفحص على حافة الشبكة (edge)
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const live: string[] = []

  const { getStorageProvider } = await import('./server/storage/provider')
  live.push(`التخزين: ${getStorageProvider().name}`)

  const { resolveEmailProvider } = await import('./server/email/provider')
  const email = resolveEmailProvider()
  live.push(`البريد: ${email.name}${email.isLive ? '' : ' (غير مفعّل)'}`)

  const { getBillingProvider } = await import('./server/billing/provider')
  const billing = getBillingProvider()
  live.push(`الفوترة: ${billing.name}${billing.isLive ? '' : ' (غير مفعّلة)'}`)

  console.info(`[boot] ${live.join(' · ')}`)
}
