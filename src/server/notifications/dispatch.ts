import 'server-only'
import { NotificationChannel, NotificationType } from '@prisma/client'
import { prisma } from '../db'

/**
 * الإشعارات.
 *
 * القناة داخل النظام تعمل فعليًا (تُكتب في قاعدة البيانات وتُقرأ من الواجهة).
 * البريد والرسائل والواتساب لها واجهة جاهزة لكن بلا مرسل حقيقي — تُسجَّل
 * وتبقى `sentAt` فارغة، فلا نزعم إرسالًا لم يحدث.
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
  EMAIL: pendingChannel(NotificationChannel.EMAIL),
  SMS: pendingChannel(NotificationChannel.SMS),
  WHATSAPP: pendingChannel(NotificationChannel.WHATSAPP),
}

export async function notify(input: NotifyInput): Promise<void> {
  const channels = input.channels ?? [NotificationChannel.IN_APP]
  const title = input.title ?? NOTIFICATION_TITLES[input.type]

  for (const channelName of channels) {
    const channel = CHANNELS[channelName]
    const { deliveryRef } = await channel.send(input)

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
        sentAt: channel.isLive ? new Date() : null,
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
