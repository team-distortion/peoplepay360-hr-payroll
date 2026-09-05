-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "EmployeeType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN');

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "workEmail" TEXT NOT NULL,
    "workPhone" TEXT,
    "jobPosition" TEXT NOT NULL,
    "employeeType" "EmployeeType" NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "workLocation" TEXT,
    "departmentId" TEXT,
    "managerId" TEXT,
    "workingScheduleId" TEXT,
    "personalEmail" TEXT,
    "personalPhone" TEXT,
    "dateOfBirth" DATE,
    "personalAddress" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "bankName" TEXT,
    "bankIfsc" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_nameKey_key" ON "Department"("nameKey");

-- CreateIndex
CREATE INDEX "Department_status_idx" ON "Department"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeNumber_key" ON "Employee"("employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_workEmail_key" ON "Employee"("workEmail");

-- CreateIndex
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");

-- CreateIndex
CREATE INDEX "Employee_managerId_idx" ON "Employee"("managerId");

-- CreateIndex
CREATE INDEX "Employee_workingScheduleId_idx" ON "Employee"("workingScheduleId");

-- CreateIndex
CREATE INDEX "Employee_status_idx" ON "Employee"("status");

-- CreateIndex
CREATE INDEX "Employee_employeeType_idx" ON "Employee"("employeeType");

-- CreateIndex
CREATE INDEX "Employee_lastName_firstName_id_idx" ON "Employee"("lastName", "firstName", "id");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_workingScheduleId_fkey" FOREIGN KEY ("workingScheduleId") REFERENCES "WorkingSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 21: Clear placeholder User.employeeId values before creating FK
UPDATE "User" SET "employeeId" = NULL WHERE "employeeId" IS NOT NULL;

-- AddForeignKey for User
ALTER TABLE "User" ADD CONSTRAINT "User_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add Department Constraints
ALTER TABLE "Department"
  ADD CONSTRAINT "Department_name_length_check"
  CHECK (length(trim("name")) >= 2 AND length(trim("name")) <= 100),
  ADD CONSTRAINT "Department_nameKey_normalized_check"
  CHECK ("nameKey" = lower(trim("nameKey")));

-- Add Employee Constraints
ALTER TABLE "Employee"
  ADD CONSTRAINT "Employee_employeeNumber_check"
  CHECK ("employeeNumber" = upper(trim("employeeNumber")) AND length("employeeNumber") >= 2 AND length("employeeNumber") <= 30),
  ADD CONSTRAINT "Employee_workEmail_check"
  CHECK ("workEmail" = lower(trim("workEmail"))),
  ADD CONSTRAINT "Employee_firstName_check"
  CHECK (length(trim("firstName")) >= 1 AND length(trim("firstName")) <= 80),
  ADD CONSTRAINT "Employee_lastName_check"
  CHECK (length(trim("lastName")) >= 1 AND length(trim("lastName")) <= 80),
  ADD CONSTRAINT "Employee_jobPosition_check"
  CHECK (length(trim("jobPosition")) >= 2 AND length(trim("jobPosition")) <= 120),
  ADD CONSTRAINT "Employee_workPhone_check"
  CHECK ("workPhone" IS NULL OR length(trim("workPhone")) > 0),
  ADD CONSTRAINT "Employee_workLocation_check"
  CHECK ("workLocation" IS NULL OR length(trim("workLocation")) > 0),
  ADD CONSTRAINT "Employee_personalEmail_check"
  CHECK ("personalEmail" IS NULL OR length(trim("personalEmail")) > 0),
  ADD CONSTRAINT "Employee_personalPhone_check"
  CHECK ("personalPhone" IS NULL OR length(trim("personalPhone")) > 0),
  ADD CONSTRAINT "Employee_personalAddress_check"
  CHECK ("personalAddress" IS NULL OR length(trim("personalAddress")) > 0),
  ADD CONSTRAINT "Employee_emergencyContactName_check"
  CHECK ("emergencyContactName" IS NULL OR length(trim("emergencyContactName")) > 0),
  ADD CONSTRAINT "Employee_emergencyContactPhone_check"
  CHECK ("emergencyContactPhone" IS NULL OR length(trim("emergencyContactPhone")) > 0),
  ADD CONSTRAINT "Employee_bankAccountName_check"
  CHECK ("bankAccountName" IS NULL OR length(trim("bankAccountName")) > 0),
  ADD CONSTRAINT "Employee_bankAccountNumber_check"
  CHECK ("bankAccountNumber" IS NULL OR length(trim("bankAccountNumber")) > 0),
  ADD CONSTRAINT "Employee_bankName_check"
  CHECK ("bankName" IS NULL OR length(trim("bankName")) > 0),
  ADD CONSTRAINT "Employee_bankIfsc_check"
  CHECK ("bankIfsc" IS NULL OR length(trim("bankIfsc")) > 0);
