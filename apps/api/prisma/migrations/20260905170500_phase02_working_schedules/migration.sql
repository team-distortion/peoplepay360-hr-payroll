-- CreateEnum
CREATE TYPE "WorkingScheduleType" AS ENUM ('STANDARD', 'SHIFT', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "WorkingScheduleStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateTable
CREATE TABLE "WorkingSchedule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "type" "WorkingScheduleType" NOT NULL DEFAULT 'STANDARD',
    "companyName" TEXT NOT NULL,
    "status" "WorkingScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WorkingSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkingScheduleDay" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "dayOfWeek" "Weekday" NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WorkingScheduleDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkingSchedule_nameKey_key" ON "WorkingSchedule"("nameKey");

-- CreateIndex
CREATE INDEX "WorkingSchedule_status_idx" ON "WorkingSchedule"("status");

-- CreateIndex
CREATE INDEX "WorkingSchedule_type_idx" ON "WorkingSchedule"("type");

-- CreateIndex
CREATE INDEX "WorkingScheduleDay_scheduleId_idx" ON "WorkingScheduleDay"("scheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkingScheduleDay_scheduleId_dayOfWeek_key" ON "WorkingScheduleDay"("scheduleId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "WorkingScheduleDay" ADD CONSTRAINT "WorkingScheduleDay_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "WorkingSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add Constraints
ALTER TABLE "WorkingScheduleDay"
  ADD CONSTRAINT "WorkingScheduleDay_startMinute_check"
  CHECK ("startMinute" >= 0 AND "startMinute" <= 1439),
  ADD CONSTRAINT "WorkingScheduleDay_endMinute_check"
  CHECK ("endMinute" >= 0 AND "endMinute" <= 1439),
  ADD CONSTRAINT "WorkingScheduleDay_start_end_different_check"
  CHECK ("startMinute" <> "endMinute"),
  ADD CONSTRAINT "WorkingScheduleDay_breakMinutes_check"
  CHECK ("breakMinutes" >= 0 AND "breakMinutes" <= 720);
