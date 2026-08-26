import 'server-only'
import { NotificationChannel, NotificationType } from '@prisma/client'
import { prisma } from '../db'
import { resolveEmailProvider } from '../email/provider'
import { notificationEmail } from '../email/templates'

/**
 * الإشعارات.
 *
 * القناة داخل النظام تعمل فعليًا (تُكتب في قاعدة البيانات وتُقرأ من الواجهة).
 * البريد يعمل متى ضُبط مزوّد في البيئة، وإلا بقي وهميًا. الرسائل والواتساب
 * لهما واجهة جاهزة بلا مرسل. في كل الحالات تبقى `sentAt` فارغة ما لم يحدث
 * إرسال فعلي، فلا نزعم وصولًا لم يقع.
 */

export const NOTIFICATION_TITLES: Record<NotificationType, string> = {
  TASK_OVERDUE: 'مهمة متأخرة',
  PAYMENT_FAILED: 'فشل عملية دفع',
  DOCUMENT_EXPIRING: 'مستند قارب على الانتهاء',
  INSPECTION_COMPLETED: 'اكتمل فحص',
  COMPLIANCE_DROP: 'انخفاض في درجة الالتزام',
  INGREDIENT_COST_CHANGED: 'تغيّرت تكلفة مكوّن',
  USER_INVITED: 'دعوة عضو جديد',
  SERVICE_ORDER_UPDATE: 'تحديث على طلب خدمة',
  GENERAL: 'إشعار',
}

export interface NotifyInput {
  organizationId: string
  userId: string
  type: NotificationType
  title?: string
  body: string
  linkPath?: string
  channels?: NotificationChannel[]
}

export interface Channel {
  readonly name: NotificationChannel
  readonly isLive: boolean
  send(input: NotifyInput): Promise<{ deliveryRef: string | null }>
}

/** القناة داخل النظام — الوحيدة العاملة فعليًا اليوم. */
const inAppChannel: Channel = {
  name: NotificationChannel.IN_APP,
  isLive: true,
  async send() {
    // الكتابة في قاعدة البيانات هي الإرسال نفسه لهذه القناة
    return { deliveryRef: null }
  },
}

/**
 * البريد. يوجد المستخدم أولًا للحصول على عنوانه: الإشعار يحمل معرّف مستخدم لا
 * بريدًا، والعنوان لا يُقبل من المتصل حتى لا يصير الإشعار قناة إرسال لأي جهة.
 */
const emailChannel: Channel = {
  name: NotificationChannel.EMAIL,
  get isLive() {
    return resolveEmailProvider().isLive
  },
  async send(input) {
    const provider = resolveEmailProvider()

    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true },
    })
    if (!user) return { deliveryRef: null }

    const origin = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const message = notificationEmail({
      to: user.email,
      title: input.title ?? NOTIFICATION_TITLES[input.type],
      body: input.body,
      linkUrl: input.linkPath && origin ? `${origin}${input.linkPath}` : undefined,
    })

    try {
      const result = await provider.send(message)
      return { deliveryRef: result.reference }
    } catch {
      // فشل البريد لا يُسقط العملية التي أنتجت الإشعار. الإشعار داخل النظام
      // يبقى، و sentAt يبقى فارغًا فيظهر الفشل في السجل بدل أن يُبتلع.
      return { deliveryRef: null }
    }
  },
}

/** قنوات خارجية — واجهة جاهزة بلا مزوّد. لا تدّعي الإرسال. */
function pendingChannel(name: NotificationChannel): Channel {
  return {
    name,
    isLive: false,
    async send(input) {
      console.info(
        `[notify:${name}] لم يُرسل — لا مزوّد مضبوط. ` +
          `المستخدم ${input.userId}، النوع ${input.type}.`,
      )
      return { deliveryRef: null }
    },
  }
}

const CHANNELS: Record<NotificationChannel, Channel> = {
  IN_APP: inAppChannel,
  EMAIL: emailChannel,
  SMS: pendingChannel(NotificationChannel.SMS),
  WHATSAPP: pendingChannel(NotificationChannel.WHATSAPP),
}

export async function notify(input: NotifyInput): Promise<void> {
  const channels = input.channels ?? [NotificationChannel.IN_APP]
  const title = input.title ?? NOTIFICATION_TITLES[input.type]

  for (const channelName of channels) {
    const channel = CHANNELS[channelName]
    const { deliveryRef } = await channel.send(input)
    // قناة حيّة قد تفشل مع ذلك: نعتبر الإرسال واقعًا فقط إن كانت حيّة ولم ترمِ
    const sent = channel.isLive && (channelName !== NotificationChannel.EMAIL || deliveryRef !== null)

    await prisma.notification.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        type: input.type,
        channel: channelName,
        title,
        body: input.body,
        linkPath: input.linkPath ?? null,
        // sentAt يبقى فارغًا للقنوات غير الفعّالة — لا نزعم إرسالًا
        sentAt: sent ? new Date() : null,
        deliveryRef,
      },
    })
  }
}

export async function listUnread(userId: string, limit = 20) {
  return prisma.notification.findMany({
    where: { userId, readAt: null, channel: NotificationChannel.IN_APP },
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      linkPath: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

export async function markRead(userId: string, ids: string[]): Promise<void> {
  // مقيّد بالمستخدم: لا يمكن تعليم إشعارات غيرك كمقروءة
  await prisma.notification.updateMany({
    where: { id: { in: ids }, userId, readAt: null },
    data: { readAt: new Date() },
  })
}
