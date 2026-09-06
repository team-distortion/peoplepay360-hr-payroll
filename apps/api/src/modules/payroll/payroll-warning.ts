import type { PayrollWarningType } from '@peoplepay360/shared';
import type { PayrollDayAggregationResult } from './payroll-calculation.js';

export interface DiscoveredWarning {
  type: PayrollWarningType;
  message: string;
  blocking: boolean;
  acknowledgeable: boolean;
  details: Record<string, any>;
}

export function detectPayrollWarnings(input: {
  dayAggregation: PayrollDayAggregationResult;
  bankDetails: {
    bankAccountName: string | null;
    bankAccountNumber: string | null;
    bankName: string | null;
    bankIfsc: string | null;
  };
  scheduleMismatchDates?: string[];
}): DiscoveredWarning[] {
  const warnings: DiscoveredWarning[] = [];

  // 1. MISSING_ATTENDANCE
  if (input.dayAggregation.missingAttendanceDates.length > 0) {
    const dates = input.dayAggregation.missingAttendanceDates;
    warnings.push({
      type: 'MISSING_ATTENDANCE',
      message: `Expected work dates lack attendance and approved time off: ${dates.join(', ')}`,
      blocking: true,
      acknowledgeable: true,
      details: { missingDates: dates, count: dates.length },
    });
  }

  // 2. OPEN_ATTENDANCE_RECORD
  if (input.dayAggregation.openAttendanceDates.length > 0) {
    const dates = input.dayAggregation.openAttendanceDates;
    warnings.push({
      type: 'OPEN_ATTENDANCE_RECORD',
      message: `Attendance has check-in but no check-out on dates: ${dates.join(', ')}`,
      blocking: true,
      acknowledgeable: true,
      details: { openDates: dates, count: dates.length },
    });
  }

  // 3. ATTENDANCE_TIME_OFF_CONFLICT
  if (input.dayAggregation.attendanceTimeOffConflictDates.length > 0) {
    const dates = input.dayAggregation.attendanceTimeOffConflictDates;
    warnings.push({
      type: 'ATTENDANCE_TIME_OFF_CONFLICT',
      message: `Both attendance and approved time off recorded for dates: ${dates.join(', ')}`,
      blocking: true,
      acknowledgeable: true,
      details: { conflictDates: dates, count: dates.length },
    });
  }

  // 4. ATTENDANCE_SCHEDULE_MISMATCH
  if (input.scheduleMismatchDates && input.scheduleMismatchDates.length > 0) {
    warnings.push({
      type: 'ATTENDANCE_SCHEDULE_MISMATCH',
      message: `Attendance expectations conflict with resolved schedule on dates: ${input.scheduleMismatchDates.join(', ')}`,
      blocking: true,
      acknowledgeable: true,
      details: { mismatchDates: input.scheduleMismatchDates },
    });
  }

  // 5. MISSING_BANK_DETAILS
  const missingBankFields: string[] = [];
  if (!input.bankDetails.bankAccountName || input.bankDetails.bankAccountName.trim().length === 0) {
    missingBankFields.push('bankAccountName');
  }
  if (!input.bankDetails.bankAccountNumber || input.bankDetails.bankAccountNumber.trim().length === 0) {
    missingBankFields.push('bankAccountNumber');
  }
  if (!input.bankDetails.bankName || input.bankDetails.bankName.trim().length === 0) {
    missingBankFields.push('bankName');
  }
  if (!input.bankDetails.bankIfsc || input.bankDetails.bankIfsc.trim().length === 0) {
    missingBankFields.push('bankIfsc');
  }

  if (missingBankFields.length > 0) {
    warnings.push({
      type: 'MISSING_BANK_DETAILS',
      message: `Employee is missing required bank details: ${missingBankFields.join(', ')}`,
      blocking: true,
      acknowledgeable: true,
      details: { missingFields: missingBankFields },
    });
  }

  return warnings;
}
