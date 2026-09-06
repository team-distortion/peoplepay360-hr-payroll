import { createHash } from 'node:crypto';
import type { Weekday } from '@prisma/client';

export interface HashableContractInput {
  id: string;
  startDate: string;
  endDate: string | null;
  monthlyWage: string;
  salaryStructureId: string;
  workingScheduleId: string | null;
}

export interface HashableScheduleDay {
  dayOfWeek: Weekday;
  startMinute: number;
  endMinute: number;
  breakMinutes: number;
}

export interface HashableAttendance {
  date: string;
  status: string;
  workedMinutes: number;
  overtimeMinutes: number;
}

export interface HashableTimeOff {
  startDate: string;
  endDate: string;
  isPaid: boolean;
}

export interface HashableSalaryRule {
  id: string;
  code: string;
  sequence: number;
  method: string;
  fixedAmount: string | null;
  percentageRate: string | null;
  percentageBase: string | null;
  formula: string | null;
}

export interface HashableBankDetails {
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  bankIfsc: string | null;
}

export interface ComputationInputHashData {
  contract: HashableContractInput;
  scheduleDays: readonly HashableScheduleDay[];
  attendances: readonly HashableAttendance[];
  timeOffRequests: readonly HashableTimeOff[];
  rules: readonly HashableSalaryRule[];
  bankDetails: HashableBankDetails;
  currency: string;
}

const WEEKDAY_ORDER: Record<Weekday, number> = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 7,
};

export function buildComputationInputHash(data: ComputationInputHashData): string {
  // Sort schedule days deterministically by weekday
  const sortedScheduleDays = [...data.scheduleDays].sort(
    (a, b) => WEEKDAY_ORDER[a.dayOfWeek] - WEEKDAY_ORDER[b.dayOfWeek]
  );

  // Sort attendances deterministically by date
  const sortedAttendances = [...data.attendances].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // Sort time off requests deterministically by startDate
  const sortedTimeOff = [...data.timeOffRequests].sort((a, b) =>
    a.startDate.localeCompare(b.startDate)
  );

  // Sort rules deterministically by sequence, then code
  const sortedRules = [...data.rules].sort(
    (a, b) => a.sequence - b.sequence || a.code.localeCompare(b.code)
  );

  const canonicalPayload = {
    bankDetails: {
      bankAccountName: data.bankDetails.bankAccountName ?? null,
      bankAccountNumber: data.bankDetails.bankAccountNumber ?? null,
      bankIfsc: data.bankDetails.bankIfsc ?? null,
      bankName: data.bankDetails.bankName ?? null,
    },
    contract: {
      endDate: data.contract.endDate ?? null,
      id: data.contract.id,
      monthlyWage: data.contract.monthlyWage,
      salaryStructureId: data.contract.salaryStructureId,
      startDate: data.contract.startDate,
      workingScheduleId: data.contract.workingScheduleId ?? null,
    },
    currency: data.currency,
    periodAttendances: sortedAttendances.map((att) => ({
      date: att.date,
      overtimeMinutes: att.overtimeMinutes,
      status: att.status,
      workedMinutes: att.workedMinutes,
    })),
    periodTimeOff: sortedTimeOff.map((to) => ({
      endDate: to.endDate,
      isPaid: to.isPaid,
      startDate: to.startDate,
    })),
    rules: sortedRules.map((r) => ({
      code: r.code,
      fixedAmount: r.fixedAmount ?? null,
      formula: r.formula ?? null,
      id: r.id,
      method: r.method,
      percentageBase: r.percentageBase ?? null,
      percentageRate: r.percentageRate ?? null,
      sequence: r.sequence,
    })),
    scheduleDays: sortedScheduleDays.map((s) => ({
      breakMinutes: s.breakMinutes,
      dayOfWeek: s.dayOfWeek,
      endMinute: s.endMinute,
      startMinute: s.startMinute,
    })),
  };

  const serialized = JSON.stringify(canonicalPayload);
  return createHash('sha256').update(serialized).digest('hex').toLowerCase();
}
