-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT');

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "attendanceDate" DATE NOT NULL,
    "checkInAt" TIMESTAMPTZ(3),
    "checkOutAt" TIMESTAMPTZ(3),
    "status" "AttendanceStatus" NOT NULL,
    "workedMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "workingScheduleId" TEXT NOT NULL,
    "expectedStartMinute" INTEGER,
    "expectedEndMinute" INTEGER,
    "expectedBreakMinutes" INTEGER NOT NULL DEFAULT 0,
    "expectedMinutes" INTEGER NOT NULL DEFAULT 0,
    "manuallyEdited" BOOLEAN NOT NULL DEFAULT false,
    "lastEditedByUserId" TEXT,
    "lastEditedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attendance_attendanceDate_status_idx" ON "Attendance"("attendanceDate", "status");

-- CreateIndex
CREATE INDEX "Attendance_employeeId_attendanceDate_idx" ON "Attendance"("employeeId", "attendanceDate");

-- CreateIndex
CREATE INDEX "Attendance_workingScheduleId_idx" ON "Attendance"("workingScheduleId");

-- CreateIndex
CREATE INDEX "Attendance_manuallyEdited_idx" ON "Attendance"("manuallyEdited");

-- CreateIndex
CREATE INDEX "Attendance_overtimeMinutes_idx" ON "Attendance"("overtimeMinutes");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_employeeId_attendanceDate_key" ON "Attendance"("employeeId", "attendanceDate");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_workingScheduleId_fkey" FOREIGN KEY ("workingScheduleId") REFERENCES "WorkingSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_lastEditedByUserId_fkey" FOREIGN KEY ("lastEditedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Business Invariant Check Constraints
ALTER TABLE "Attendance"
  ADD CONSTRAINT "Attendance_minutes_check"
    CHECK (
      "workedMinutes" >= 0
      AND "overtimeMinutes" >= 0
      AND "expectedMinutes" >= 0
      AND "expectedBreakMinutes" >= 0
    ),
  ADD CONSTRAINT "Attendance_expected_clock_check"
    CHECK (
      ("expectedStartMinute" IS NULL AND "expectedEndMinute" IS NULL
        AND "expectedMinutes" = 0 AND "expectedBreakMinutes" = 0)
      OR
      ("expectedStartMinute" BETWEEN 0 AND 1439
        AND "expectedEndMinute" BETWEEN 1 AND 1439
        AND "expectedEndMinute" > "expectedStartMinute"
        AND "expectedBreakMinutes" < ("expectedEndMinute" - "expectedStartMinute")
        AND "expectedMinutes" =
          "expectedEndMinute" - "expectedStartMinute" - "expectedBreakMinutes")
    ),
  ADD CONSTRAINT "Attendance_punch_order_check"
    CHECK ("checkOutAt" IS NULL OR ("checkInAt" IS NOT NULL AND "checkOutAt" > "checkInAt")),
  ADD CONSTRAINT "Attendance_derived_minutes_check"
    CHECK (
      ("checkOutAt" IS NOT NULL
        AND "overtimeMinutes" = GREATEST("workedMinutes" - "expectedMinutes", 0))
      OR
      ("checkOutAt" IS NULL
        AND "workedMinutes" = 0 AND "overtimeMinutes" = 0)
    ),
  ADD CONSTRAINT "Attendance_status_shape_check"
    CHECK (
      ("status" = 'ABSENT'
        AND "checkInAt" IS NULL AND "checkOutAt" IS NULL
        AND "workedMinutes" = 0 AND "overtimeMinutes" = 0
        AND "expectedMinutes" > 0)
      OR
      ("status" IN ('PRESENT', 'LATE') AND "checkInAt" IS NOT NULL)
    ),
  ADD CONSTRAINT "Attendance_manual_metadata_check"
    CHECK (
      ("manuallyEdited" = FALSE
        AND "lastEditedByUserId" IS NULL AND "lastEditedAt" IS NULL)
      OR
      ("manuallyEdited" = TRUE
        AND "lastEditedByUserId" IS NOT NULL AND "lastEditedAt" IS NOT NULL)
    );
