import 'dotenv/config'

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL غير معرّف. اختبارات التكامل تحتاج قاعدة بيانات فعلية.',
  )
}

// حارس: لا تُشغَّل الاختبارات أبدًا على قاعدة إنتاج
if (/prod|production/i.test(process.env.DATABASE_URL)) {
  throw new Error('رُفض التشغيل: DATABASE_URL يشير إلى قاعدة إنتاج.')
}
