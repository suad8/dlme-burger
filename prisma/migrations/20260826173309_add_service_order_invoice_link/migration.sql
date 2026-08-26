-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "serviceOrderId" TEXT;

-- CreateIndex
CREATE INDEX "invoices_serviceOrderId_idx" ON "invoices"("serviceOrderId");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "service_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
