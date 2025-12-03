-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "address" TEXT,
ADD COLUMN     "controllerId" UUID,
ADD COLUMN     "dateOfBirth" TEXT,
ADD COLUMN     "dispatcherId" UUID,
ADD COLUMN     "documentExpiry" TEXT,
ADD COLUMN     "documentNumber" TEXT,
ADD COLUMN     "driverCardExpiryDate" TEXT,
ADD COLUMN     "driverCardNumber" TEXT,
ADD COLUMN     "driverCardStartDate" TEXT,
ADD COLUMN     "driverCardType" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "employeeType" TEXT NOT NULL DEFAULT 'driver',
ADD COLUMN     "fuelCardBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "fuelCardNumber" TEXT,
ADD COLUMN     "licenseCategory" TEXT,
ADD COLUMN     "medicalCertificateExpiryDate" TEXT,
ADD COLUMN     "medicalCertificateIssueDate" TEXT,
ADD COLUMN     "medicalCertificateNumber" TEXT,
ADD COLUMN     "medicalCertificateSeries" TEXT,
ADD COLUMN     "medicalInstitutionId" UUID,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "personnelNumber" TEXT,
ADD COLUMN     "shortName" TEXT,
ADD COLUMN     "snils" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'Active';

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_dispatcherId_fkey" FOREIGN KEY ("dispatcherId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_controllerId_fkey" FOREIGN KEY ("controllerId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
