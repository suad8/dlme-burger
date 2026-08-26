-- المرشّح كان معزولًا عبر طلب التوظيف فقط. نضيف عمود المنشأة مباشرةً كبقية
-- الجداول، لكن على ثلاث خطوات حتى لا تفشل الترقية على قاعدة فيها مرشّحون:
-- عمود قابل للفراغ، ثم تعبئة من الطلب، ثم فرض عدم الفراغ.

-- AlterTable
ALTER TABLE "attachments" ADD COLUMN "candidateId" TEXT;

-- ١) عمود قابل للفراغ مؤقتًا
ALTER TABLE "candidates" ADD COLUMN "organizationId" TEXT;

-- ٢) تعبئة من طلب التوظيف المرتبط
UPDATE "candidates" c
SET "organizationId" = r."organizationId"
FROM "recruitment_requests" r
WHERE c."requestId" = r."id" AND c."organizationId" IS NULL;

-- ٣) فرض عدم الفراغ بعد اكتمال التعبئة
ALTER TABLE "candidates" ALTER COLUMN "organizationId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "attachments_candidateId_idx" ON "attachments"("candidateId");

-- CreateIndex
CREATE INDEX "candidates_organizationId_stage_idx" ON "candidates"("organizationId", "stage");

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
