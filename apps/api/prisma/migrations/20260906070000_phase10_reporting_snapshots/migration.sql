-- AlterTable
ALTER TABLE "Payslip" ADD COLUMN "departmentIdSnapshot" TEXT,
ADD COLUMN "employeeTypeSnapshot" "EmployeeType";

-- Backfill non-draft payslips from current Employee data
UPDATE "Payslip" p
SET "departmentIdSnapshot" = e."departmentId",
    "employeeTypeSnapshot" = e."employeeType"
FROM "Employee" e
WHERE p."employeeId" = e.id AND p.status != 'DRAFT';

-- CreateIndex
CREATE INDEX "Payslip_status_periodStart_periodEnd_idx" ON "Payslip"("status", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "Payslip_departmentIdSnapshot_employeeTypeSnapshot_status_idx" ON "Payslip"("departmentIdSnapshot", "employeeTypeSnapshot", "status");
