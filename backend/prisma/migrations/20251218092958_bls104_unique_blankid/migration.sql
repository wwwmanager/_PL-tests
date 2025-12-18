/*
  Warnings:

  - A unique constraint covering the columns `[blankId]` on the table `waybills` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "waybills_blankId_key" ON "waybills"("blankId");
