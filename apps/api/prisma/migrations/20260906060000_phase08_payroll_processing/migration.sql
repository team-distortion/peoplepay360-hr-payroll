-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'COMPUTED', 'VALIDATED', 'PAID');

-- CreateEnum
CREATE TYPE "PayrollWarningStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "PayrollWarningType" AS ENUM ('MISSING_ATTENDANCE', 'OPEN_ATTENDANCE_RECORD', 'ATTENDANCE_TIME_OFF_CONFLICT', 'ATTENDANCE_SCHEDULE_MISMATCH', 'MISSING_BANK_DETAILS');

-- CreateSequence
CREATE SEQUENCE IF NOT EXISTS payrun_number_seq START WITH 1 INCREMENT BY 1;

-- CreateTable Contract
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "salaryStructureId" TEXT NOT NULL,
    "workingScheduleId" TEXT,
    "jobPosition" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "monthlyWage" DECIMAL(18,2) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable Attendance
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "checkIn" TIMESTAMPTZ(3),
    "checkOut" TIMESTAMPTZ(3),
    "workedMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable TimeOffRequest
CREATE TABLE "TimeOffRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TimeOffRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable AuditLog
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable Payrun
CREATE TABLE "Payrun" (
    "id" TEXT NOT NULL,
    "payrunNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "salaryStructureId" TEXT NOT NULL,
    "salaryStructureName" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "computedByUserId" TEXT,
    "computedAt" TIMESTAMPTZ(3),
    "validatedByUserId" TEXT,
    "validatedAt" TIMESTAMPTZ(3),
    "paidByUserId" TEXT,
    "paidAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Payrun_pkey" PRIMARY KEY ("id")
);

-- CreateTable Payslip
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "payrunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "salaryStructureId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "employeeNumberSnapshot" TEXT,
    "employeeNameSnapshot" TEXT,
    "workEmailSnapshot" TEXT,
    "departmentNameSnapshot" TEXT,
    "jobPositionSnapshot" TEXT,
    "contractNumberSnapshot" TEXT,
    "structureNameSnapshot" TEXT,
    "scheduleIdSnapshot" TEXT,
    "scheduleNameSnapshot" TEXT,
    "bankAccountNameSnapshot" TEXT,
    "bankAccountMaskSnapshot" TEXT,
    "bankNameSnapshot" TEXT,
    "bankIfscSnapshot" TEXT,
    "monthlyWage" DECIMAL(18,2),
    "expectedDays" INTEGER,
    "workedDays" INTEGER,
    "expectedMinutes" INTEGER,
    "workedMinutes" INTEGER,
    "overtimeMinutes" INTEGER,
    "proratedBasic" DECIMAL(18,2),
    "basicAmount" DECIMAL(18,2),
    "allowanceAmount" DECIMAL(18,2),
    "overtimeAmount" DECIMAL(18,2),
    "deductionAmount" DECIMAL(18,2),
    "contributionAmount" DECIMAL(18,2),
    "grossAmount" DECIMAL(18,2),
    "netAmount" DECIMAL(18,2),
    "computationInputHash" TEXT,
    "finalPdf" BYTEA,
    "finalPdfSha256" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable PayslipLine
CREATE TABLE "PayslipLine" (
    "id" TEXT NOT NULL,
    "payslipId" TEXT NOT NULL,
    "salaryRuleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" "SalaryRuleCategory" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "method" "SalaryRuleMethod" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayslipLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable PayrollWarning
CREATE TABLE "PayrollWarning" (
    "id" TEXT NOT NULL,
    "payrunId" TEXT NOT NULL,
    "payslipId" TEXT,
    "type" "PayrollWarningType" NOT NULL,
    "status" "PayrollWarningStatus" NOT NULL DEFAULT 'OPEN',
    "message" TEXT NOT NULL,
    "blocking" BOOLEAN NOT NULL,
    "acknowledgeable" BOOLEAN NOT NULL,
    "details" JSONB,
    "acknowledgedByUserId" TEXT,
    "acknowledgedAt" TIMESTAMPTZ(3),
    "acknowledgementReason" TEXT,
    "resolvedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PayrollWarning_pkey" PRIMARY KEY ("id")
);

-- Indexes for Contract
CREATE UNIQUE INDEX "Contract_contractNumber_key" ON "Contract"("contractNumber");
CREATE INDEX "Contract_employeeId_idx" ON "Contract"("employeeId");
CREATE INDEX "Contract_salaryStructureId_idx" ON "Contract"("salaryStructureId");
CREATE INDEX "Contract_workingScheduleId_idx" ON "Contract"("workingScheduleId");
CREATE INDEX "Contract_status_idx" ON "Contract"("status");
CREATE INDEX "Contract_startDate_endDate_idx" ON "Contract"("startDate", "endDate");

-- Indexes for Attendance
CREATE UNIQUE INDEX "Attendance_employeeId_date_key" ON "Attendance"("employeeId", "date");
CREATE INDEX "Attendance_date_idx" ON "Attendance"("date");

-- Indexes for TimeOffRequest
CREATE INDEX "TimeOffRequest_employeeId_startDate_endDate_idx" ON "TimeOffRequest"("employeeId", "startDate", "endDate");

-- Indexes for AuditLog
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- Indexes for Payrun
CREATE UNIQUE INDEX "Payrun_payrunNumber_key" ON "Payrun"("payrunNumber");
CREATE INDEX "Payrun_periodStart_periodEnd_idx" ON "Payrun"("periodStart", "periodEnd");
CREATE INDEX "Payrun_salaryStructureId_status_idx" ON "Payrun"("salaryStructureId", "status");
CREATE INDEX "Payrun_status_createdAt_idx" ON "Payrun"("status", "createdAt");

-- Indexes for Payslip
CREATE UNIQUE INDEX "Payslip_payrunId_employeeId_key" ON "Payslip"("payrunId", "employeeId");
CREATE UNIQUE INDEX "Payslip_employeeId_periodStart_periodEnd_key" ON "Payslip"("employeeId", "periodStart", "periodEnd");
CREATE INDEX "Payslip_payrunId_status_idx" ON "Payslip"("payrunId", "status");
CREATE INDEX "Payslip_employeeId_periodStart_periodEnd_idx" ON "Payslip"("employeeId", "periodStart", "periodEnd");
CREATE INDEX "Payslip_departmentNameSnapshot_idx" ON "Payslip"("departmentNameSnapshot");

-- Indexes for PayslipLine
CREATE UNIQUE INDEX "PayslipLine_payslipId_code_key" ON "PayslipLine"("payslipId", "code");
CREATE UNIQUE INDEX "PayslipLine_payslipId_sequence_key" ON "PayslipLine"("payslipId", "sequence");
CREATE INDEX "PayslipLine_payslipId_category_sequence_idx" ON "PayslipLine"("payslipId", "category", "sequence");

-- Indexes for PayrollWarning
CREATE INDEX "PayrollWarning_payrunId_status_blocking_idx" ON "PayrollWarning"("payrunId", "status", "blocking");
CREATE INDEX "PayrollWarning_payslipId_status_idx" ON "PayrollWarning"("payslipId", "status");
CREATE INDEX "PayrollWarning_type_status_idx" ON "PayrollWarning"("type", "status");

-- Foreign Keys for Contract
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_salaryStructureId_fkey" FOREIGN KEY ("salaryStructureId") REFERENCES "SalaryStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_workingScheduleId_fkey" FOREIGN KEY ("workingScheduleId") REFERENCES "WorkingSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign Keys for Attendance
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign Keys for TimeOffRequest
ALTER TABLE "TimeOffRequest" ADD CONSTRAINT "TimeOffRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign Keys for AuditLog
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign Keys for Payrun
ALTER TABLE "Payrun" ADD CONSTRAINT "Payrun_salaryStructureId_fkey" FOREIGN KEY ("salaryStructureId") REFERENCES "SalaryStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payrun" ADD CONSTRAINT "Payrun_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payrun" ADD CONSTRAINT "Payrun_computedByUserId_fkey" FOREIGN KEY ("computedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payrun" ADD CONSTRAINT "Payrun_validatedByUserId_fkey" FOREIGN KEY ("validatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payrun" ADD CONSTRAINT "Payrun_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign Keys for Payslip
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_payrunId_fkey" FOREIGN KEY ("payrunId") REFERENCES "Payrun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_salaryStructureId_fkey" FOREIGN KEY ("salaryStructureId") REFERENCES "SalaryStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign Keys for PayslipLine
ALTER TABLE "PayslipLine" ADD CONSTRAINT "PayslipLine_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "Payslip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayslipLine" ADD CONSTRAINT "PayslipLine_salaryRuleId_fkey" FOREIGN KEY ("salaryRuleId") REFERENCES "SalaryRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign Keys for PayrollWarning
ALTER TABLE "PayrollWarning" ADD CONSTRAINT "PayrollWarning_payrunId_fkey" FOREIGN KEY ("payrunId") REFERENCES "Payrun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollWarning" ADD CONSTRAINT "PayrollWarning_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "Payslip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollWarning" ADD CONSTRAINT "PayrollWarning_acknowledgedByUserId_fkey" FOREIGN KEY ("acknowledgedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
