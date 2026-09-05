-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "workingScheduleId" TEXT,
    "salaryStructureId" TEXT NOT NULL,
    "jobPosition" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "monthlyWage" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contract_contractNumber_key" ON "Contract"("contractNumber");

-- CreateIndex
CREATE INDEX "Contract_employeeId_startDate_endDate_idx" ON "Contract"("employeeId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Contract_departmentId_idx" ON "Contract"("departmentId");

-- CreateIndex
CREATE INDEX "Contract_workingScheduleId_idx" ON "Contract"("workingScheduleId");

-- CreateIndex
CREATE INDEX "Contract_salaryStructureId_idx" ON "Contract"("salaryStructureId");

-- CreateIndex
CREATE INDEX "Contract_endDate_idx" ON "Contract"("endDate");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_workingScheduleId_fkey" FOREIGN KEY ("workingScheduleId") REFERENCES "WorkingSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_salaryStructureId_fkey" FOREIGN KEY ("salaryStructureId") REFERENCES "SalaryStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Custom SQL for Phase 5A Contract Management
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE SEQUENCE IF NOT EXISTS contract_number_seq START 1;

ALTER TABLE "Contract"
  ADD CONSTRAINT "Contract_contractNumber_check"
    CHECK ("contractNumber" ~ '^CON/[0-9]{4}/[0-9]{6}$'),
  ADD CONSTRAINT "Contract_jobPosition_check"
    CHECK (length(btrim("jobPosition")) BETWEEN 2 AND 100),
  ADD CONSTRAINT "Contract_monthlyWage_check"
    CHECK ("monthlyWage" >= 0),
  ADD CONSTRAINT "Contract_dates_check"
    CHECK ("endDate" IS NULL OR "endDate" >= "startDate"),
  ADD CONSTRAINT "Contract_notes_check"
    CHECK ("notes" IS NULL OR length(btrim("notes")) BETWEEN 1 AND 1000),
  ADD CONSTRAINT "Contract_employee_dates_excl"
    EXCLUDE USING gist (
      "employeeId" WITH =,
      daterange(
        "startDate",
        COALESCE("endDate" + 1, 'infinity'::date),
        '[)'
      ) WITH &&
    );
