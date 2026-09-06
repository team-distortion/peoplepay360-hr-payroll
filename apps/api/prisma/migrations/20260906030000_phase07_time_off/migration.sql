-- CreateEnum
CREATE TYPE "TimeOffUnit" AS ENUM ('DAY', 'HOUR');

-- CreateEnum
CREATE TYPE "TimeOffApprovalMode" AS ENUM ('NO_APPROVAL', 'HR_APPROVAL');

-- CreateEnum
CREATE TYPE "TimeOffPayrollTreatment" AS ENUM ('PAID', 'UNPAID');

-- CreateEnum
CREATE TYPE "TimeOffDecisionStatus" AS ENUM ('PENDING', 'APPROVED', 'REFUSED');

-- CreateTable
CREATE TABLE "TimeOffType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "description" TEXT,
    "unit" "TimeOffUnit" NOT NULL,
    "requiresAllocation" BOOLEAN NOT NULL DEFAULT true,
    "approvalMode" "TimeOffApprovalMode" NOT NULL DEFAULT 'HR_APPROVAL',
    "payrollTreatment" "TimeOffPayrollTreatment" NOT NULL DEFAULT 'PAID',
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TimeOffType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeOffAllocation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "timeOffTypeId" TEXT NOT NULL,
    "unitSnapshot" "TimeOffUnit" NOT NULL,
    "allocatedUnits" DECIMAL(12,4) NOT NULL,
    "consumedUnits" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "validFrom" DATE NOT NULL,
    "validTo" DATE NOT NULL,
    "status" "TimeOffDecisionStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMPTZ(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TimeOffAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeOffRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "timeOffTypeId" TEXT NOT NULL,
    "allocationId" TEXT,
    "unitSnapshot" "TimeOffUnit" NOT NULL,
    "requiresAllocationSnapshot" BOOLEAN NOT NULL,
    "payrollTreatmentSnapshot" "TimeOffPayrollTreatment" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "startMinute" INTEGER,
    "endMinute" INTEGER,
    "requestedUnits" DECIMAL(12,4) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "TimeOffDecisionStatus" NOT NULL DEFAULT 'PENDING',
    "createdByUserId" TEXT NOT NULL,
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMPTZ(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TimeOffRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TimeOffType_nameKey_key" ON "TimeOffType"("nameKey");

-- CreateIndex
CREATE INDEX "TimeOffType_status_idx" ON "TimeOffType"("status");

-- CreateIndex
CREATE INDEX "TimeOffType_unit_idx" ON "TimeOffType"("unit");

-- CreateIndex
CREATE INDEX "TimeOffAllocation_employeeId_timeOffTypeId_validFrom_validT_idx" ON "TimeOffAllocation"("employeeId", "timeOffTypeId", "validFrom", "validTo");

-- CreateIndex
CREATE INDEX "TimeOffAllocation_status_validTo_idx" ON "TimeOffAllocation"("status", "validTo");

-- CreateIndex
CREATE INDEX "TimeOffRequest_employeeId_startDate_endDate_status_idx" ON "TimeOffRequest"("employeeId", "startDate", "endDate", "status");

-- CreateIndex
CREATE INDEX "TimeOffRequest_timeOffTypeId_status_idx" ON "TimeOffRequest"("timeOffTypeId", "status");

-- CreateIndex
CREATE INDEX "TimeOffRequest_allocationId_idx" ON "TimeOffRequest"("allocationId");

-- CreateIndex
CREATE INDEX "TimeOffRequest_status_startDate_idx" ON "TimeOffRequest"("status", "startDate");

-- AddForeignKey
ALTER TABLE "TimeOffAllocation" ADD CONSTRAINT "TimeOffAllocation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOffAllocation" ADD CONSTRAINT "TimeOffAllocation_timeOffTypeId_fkey" FOREIGN KEY ("timeOffTypeId") REFERENCES "TimeOffType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOffAllocation" ADD CONSTRAINT "TimeOffAllocation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOffAllocation" ADD CONSTRAINT "TimeOffAllocation_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOffRequest" ADD CONSTRAINT "TimeOffRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOffRequest" ADD CONSTRAINT "TimeOffRequest_timeOffTypeId_fkey" FOREIGN KEY ("timeOffTypeId") REFERENCES "TimeOffType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOffRequest" ADD CONSTRAINT "TimeOffRequest_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "TimeOffAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOffRequest" ADD CONSTRAINT "TimeOffRequest_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOffRequest" ADD CONSTRAINT "TimeOffRequest_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Business Invariant Check Constraints

-- TimeOffType Checks
ALTER TABLE "TimeOffType"
  ADD CONSTRAINT "TimeOffType_name_check"
    CHECK (length(trim("name")) >= 1 AND length(trim("nameKey")) >= 1),
  ADD CONSTRAINT "TimeOffType_description_check"
    CHECK ("description" IS NULL OR (length(trim("description")) >= 1 AND length(trim("description")) <= 1000));

-- TimeOffAllocation Checks
ALTER TABLE "TimeOffAllocation"
  ADD CONSTRAINT "TimeOffAllocation_units_positive_check"
    CHECK ("allocatedUnits" > 0),
  ADD CONSTRAINT "TimeOffAllocation_consumed_range_check"
    CHECK ("consumedUnits" >= 0 AND "consumedUnits" <= "allocatedUnits"),
  ADD CONSTRAINT "TimeOffAllocation_validity_check"
    CHECK ("validTo" >= "validFrom"),
  ADD CONSTRAINT "TimeOffAllocation_day_units_check"
    CHECK ("unitSnapshot" != 'DAY' OR "allocatedUnits" = FLOOR("allocatedUnits")),
  ADD CONSTRAINT "TimeOffAllocation_hour_units_check"
    CHECK ("unitSnapshot" != 'HOUR' OR ("allocatedUnits" * 4) = FLOOR("allocatedUnits" * 4)),
  ADD CONSTRAINT "TimeOffAllocation_pending_decider_check"
    CHECK ("status" != 'PENDING' OR ("decidedByUserId" IS NULL AND "decidedAt" IS NULL AND "decisionNote" IS NULL)),
  ADD CONSTRAINT "TimeOffAllocation_decided_decider_check"
    CHECK ("status" = 'PENDING' OR ("decidedByUserId" IS NOT NULL AND "decidedAt" IS NOT NULL)),
  ADD CONSTRAINT "TimeOffAllocation_refused_consumed_check"
    CHECK ("status" != 'REFUSED' OR "consumedUnits" = 0),
  ADD CONSTRAINT "TimeOffAllocation_description_check"
    CHECK ("description" IS NULL OR (length(trim("description")) >= 1 AND length(trim("description")) <= 1000)),
  ADD CONSTRAINT "TimeOffAllocation_decision_note_check"
    CHECK ("decisionNote" IS NULL OR (length(trim("decisionNote")) >= 3 AND length(trim("decisionNote")) <= 500));

-- TimeOffRequest Checks
ALTER TABLE "TimeOffRequest"
  ADD CONSTRAINT "TimeOffRequest_requestedUnits_positive_check"
    CHECK ("requestedUnits" > 0),
  ADD CONSTRAINT "TimeOffRequest_dates_order_check"
    CHECK ("endDate" >= "startDate"),
  ADD CONSTRAINT "TimeOffRequest_day_minutes_check"
    CHECK ("unitSnapshot" != 'DAY' OR ("startMinute" IS NULL AND "endMinute" IS NULL AND "requestedUnits" = FLOOR("requestedUnits"))),
  ADD CONSTRAINT "TimeOffRequest_hour_check"
    CHECK (
      "unitSnapshot" != 'HOUR' OR (
        "startDate" = "endDate"
        AND "startMinute" IS NOT NULL
        AND "endMinute" IS NOT NULL
        AND "startMinute" >= 0
        AND "startMinute" <= 1439
        AND "endMinute" >= 0
        AND "endMinute" <= 1439
        AND "endMinute" > "startMinute"
        AND ("startMinute" % 15 = 0)
        AND ("endMinute" % 15 = 0)
        AND "requestedUnits" = (("endMinute" - "startMinute")::numeric / 60)
      )
    ),
  ADD CONSTRAINT "TimeOffRequest_allocation_link_check"
    CHECK (
      ("requiresAllocationSnapshot" = TRUE AND "allocationId" IS NOT NULL)
      OR ("requiresAllocationSnapshot" = FALSE AND "allocationId" IS NULL)
    ),
  ADD CONSTRAINT "TimeOffRequest_pending_decider_check"
    CHECK ("status" != 'PENDING' OR ("decidedByUserId" IS NULL AND "decidedAt" IS NULL AND "decisionNote" IS NULL)),
  ADD CONSTRAINT "TimeOffRequest_decided_decider_check"
    CHECK ("status" = 'PENDING' OR ("decidedByUserId" IS NOT NULL AND "decidedAt" IS NOT NULL)),
  ADD CONSTRAINT "TimeOffRequest_reason_check"
    CHECK (length(trim("reason")) >= 5 AND length(trim("reason")) <= 1000),
  ADD CONSTRAINT "TimeOffRequest_decision_note_check"
    CHECK ("decisionNote" IS NULL OR (length(trim("decisionNote")) >= 3 AND length(trim("decisionNote")) <= 500));
