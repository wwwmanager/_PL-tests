-- CreateIndex
CREATE INDEX "blanks_organizationId_issuedToDriverId_status_series_number_idx" ON "blanks"("organizationId", "issuedToDriverId", "status", "series", "number");
