import { NextResponse } from 'next/server'
import { getTenantContext } from '@/server/tenant'
import { ForbiddenError } from '@/server/rbac'
import { verifySignedKey, InvalidFileError } from '@/server/storage/provider'
import { readFileForServing } from '@/server/services/attachments'

/**
 * تقديم ملف مرفق.
 *
 * ثلاث بوابات متتالية، وكلها إلزامية:
 *  1. جلسة سارية.
 *  2. توقيع صالح غير منتهٍ (يمنع تخمين المفاتيح).
 *  3. المفتاح يخص منشأة الطالب (يمنع استخدام رابط مسرَّب من منشأة أخرى).
 *  4. الدور يملك صلاحية نوع المرفق (يمنع رابطًا مسرَّبًا داخل المنشأة نفسها).
 *
 * أي فشل يعيد 404 لا 403 — لا نكشف وجود الملف.
 */
export async function GET(request: Request) {
  const ctx = await getTenantContext()
  if (!ctx) {
    return NextResponse.json({ error: 'غير مصرّح.' }, { status: 401 })
  }

  const url = new URL(request.url)
  const key = url.searchParams.get('key')
  const expiresRaw = url.searchParams.get('expires')
  const sig = url.searchParams.get('sig')

  if (!key || !expiresRaw || !sig) {
    return NextResponse.json({ error: 'رابط غير مكتمل.' }, { status: 400 })
  }

  const expires = Number(expiresRaw)
  if (!verifySignedKey(key, expires, sig)) {
    // منتهٍ أو مزوّر — لا نفرّق في الرد
    return NextResponse.json(
      { error: 'الرابط منتهٍ أو غير صالح.' },
      { status: 403 },
    )
  }

  try {
    const file = await readFileForServing(ctx, key)

    return new NextResponse(new Uint8Array(file.data), {
      headers: {
        'Content-Type': file.mimeType,
        // inline للصور، والـPDF يُعرض في المتصفح — لا تنزيل قسري
        'Content-Disposition': `inline; filename="${encodeURIComponent(file.fileName)}"`,
        'Content-Length': String(file.data.length),
        // ملف يخص مستأجرًا: تخزين خاص فقط، ولمدة التوقيع لا أكثر
        'Cache-Control': 'private, max-age=300, no-transform',
        'X-Content-Type-Options': 'nosniff',
        /*
         * ملف PDF قد يحمل جافاسكربت، ويُعرض من أصل التطبيق نفسه. العزل هنا
         * يمنع أي تنفيذ أو طلب صادر من داخل الملف: لا مصادر ولا صندوق رملي
         * مفتوح. الصور لا تتأثر.
         */
        'Content-Security-Policy': "default-src 'none'; sandbox; frame-ancestors 'none'",
      },
    })
  } catch (error) {
    // رفض الصلاحية يُعامَل كعدم وجود: لا نؤكّد للمستخدم أن الملف موجود لكنه
    // ممنوع منه — ذلك بحد ذاته معلومة عن سجلات لا يحق له الاطلاع عليها.
    if (error instanceof InvalidFileError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'الملف غير موجود.' }, { status: 404 })
    }
    console.error('[files] تعذّر تقديم الملف:', error)
    return NextResponse.json({ error: 'تعذّر قراءة الملف.' }, { status: 500 })
  }
}
