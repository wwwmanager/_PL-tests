-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "parentOrganizationId" UUID;

-- CreateIndex
CREATE INDEX "organizations_parentOrganizationId_idx" ON "organizations"("parentOrganizationId");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_parentOrganizationId_fkey" FOREIGN KEY ("parentOrganizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
