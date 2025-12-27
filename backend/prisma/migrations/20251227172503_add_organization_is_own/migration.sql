-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "isOwn" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "organizations_isOwn_idx" ON "organizations"("isOwn");
