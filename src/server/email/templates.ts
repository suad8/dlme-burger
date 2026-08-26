import 'server-only'
import type { EmailMessage } from './provider'

/**
 * قوالب البريد.
 *
 * كل قيمة تأتي من المستخدم (اسم منشأة، اسم داعٍ) تُهرَّب قبل الإدراج في HTML.
 * اسم منشأة مثل `<img src=x onerror=…>` سيصل إلى صندوق شخص آخر، فالتهريب هنا
 * ليس تجميلًا.
 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/**
 * عملاء البريد يتجاهلون معظم CSS الخارجي، فالتنسيق مضمّن. الجدول متعمّد:
 * Outlook لا يدعم flex ولا grid.
 */
function shell(title: string, bodyHtml: string, footerHtml = ''): string {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:24px;background:#f6f7f9;font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#1a1d21;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;">
    <tr><td style="padding:28px 28px 8px;">
      <div style="font-size:18px;font-weight:700;">إتقان</div>
      <div style="font-size:12px;color:#6b7280;">منصّة تشغيل المنشآت الغذائية</div>
    </td></tr>
    <tr><td style="padding:8px 28px 28px;font-size:14px;line-height:1.9;">${bodyHtml}</td></tr>
    <tr><td style="padding:0 28px 24px;font-size:11px;color:#9ca3af;line-height:1.8;border-top:1px solid #f0f1f3;padding-top:16px;">
      ${footerHtml || 'هذه رسالة آلية، لا حاجة للرد عليها.'}
    </td></tr>
  </table>
</body>
</html>`
}

function button(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600;font-size:14px;">${escapeHtml(label)}</a>`
}

export interface InvitationEmailInput {
  to: string
  organizationName: string
  inviterName: string
  roleLabel: string
  acceptUrl: string
  expiresAt: Date
}

export function invitationEmail(input: InvitationEmailInput): EmailMessage {
  const expires = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    dateStyle: 'long',
  }).format(input.expiresAt)

  const org = escapeHtml(input.organizationName)
  const inviter = escapeHtml(input.inviterName)
  const role = escapeHtml(input.roleLabel)

  const html = shell(
    `دعوة للانضمام إلى ${input.organizationName}`,
    `<p style="margin:0 0 14px;">دعاك <strong>${inviter}</strong> للانضمام إلى منشأة <strong>${org}</strong> على منصّة إتقان بصفة <strong>${role}</strong>.</p>
     <p style="margin:0 0 20px;">اضغط الزر لإنشاء حسابك وقبول الدعوة:</p>
     <p style="margin:0 0 20px;">${button(input.acceptUrl, 'قبول الدعوة')}</p>
     <p style="margin:0;color:#6b7280;font-size:12px;">تنتهي صلاحية الدعوة في ${escapeHtml(expires)}.</p>`,
    'إن لم تكن تتوقّع هذه الدعوة فتجاهل الرسالة — لن يُنشأ لك حساب دون فتح الرابط.',
  )

  const text = [
    `دعاك ${input.inviterName} للانضمام إلى منشأة ${input.organizationName} على منصّة إتقان بصفة ${input.roleLabel}.`,
    '',
    `لقبول الدعوة افتح: ${input.acceptUrl}`,
    '',
    `تنتهي صلاحية الدعوة في ${expires}.`,
    'إن لم تكن تتوقّع هذه الدعوة فتجاهل الرسالة.',
  ].join('\n')

  return {
    to: input.to,
    subject: `دعوة للانضمام إلى ${input.organizationName} على إتقان`,
    text,
    html,
  }
}

export interface NotificationEmailInput {
  to: string
  title: string
  body: string
  linkUrl?: string
}

export function notificationEmail(input: NotificationEmailInput): EmailMessage {
  const html = shell(
    input.title,
    `<p style="margin:0 0 8px;font-size:16px;font-weight:600;">${escapeHtml(input.title)}</p>
     <p style="margin:0 0 20px;">${escapeHtml(input.body)}</p>
     ${input.linkUrl ? `<p style="margin:0;">${button(input.linkUrl, 'فتح في المنصّة')}</p>` : ''}`,
  )

  const text = [
    input.title,
    '',
    input.body,
    input.linkUrl ? `\nفتح في المنصّة: ${input.linkUrl}` : '',
  ].join('\n')

  return { to: input.to, subject: input.title, text, html }
}
