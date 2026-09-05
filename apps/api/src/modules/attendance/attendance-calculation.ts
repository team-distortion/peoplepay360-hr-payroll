import type { AttendanceStatus, AttendanceFlag } from '@peoplepay360/shared';

export interface ExpectedScheduleSnapshot {
  expectedStartMinute: number | null;
  expectedEndMinute: number | null;
  expectedBreakMinutes: number;
  expectedMinutes: number;
}

export interface CalculationInput {
  statusKind?: 'WORKED' | 'ABSENT';
  checkInAt: Date | null;
  checkOutAt: Date | null;
  checkInMinuteOfDay: number | null;
  snapshot: ExpectedScheduleSnapshot;
  manuallyEdited?: boolean;
}

export interface CalculationResult {
  status: AttendanceStatus;
  workedMinutes: number;
  overtimeMinutes: number;
  flags: AttendanceFlag[];
}

/**
 * Derives AttendanceStatus for a record.
 * - ABSENT input -> ABSENT
 * - non-working day (expectedStartMinute === null) -> PRESENT
 * - checkInMinuteOfDay > expectedStartMinute -> LATE
 * - otherwise -> PRESENT
 */
export function deriveAttendanceStatus(
  statusKind: 'WORKED' | 'ABSENT' | undefined,
  checkInMinuteOfDay: number | null,
  expectedStartMinute: number | null
): AttendanceStatus {
  if (statusKind === 'ABSENT') {
    return 'ABSENT';
  }

  if (expectedStartMinute === null) {
    return 'PRESENT';
  }

  if (checkInMinuteOfDay !== null && checkInMinuteOfDay > expectedStartMinute) {
    return 'LATE';
  }

  return 'PRESENT';
}

/**
 * Derives workedMinutes, overtimeMinutes for completed or open record.
 * Open record stores workedMinutes = 0 and overtimeMinutes = 0.
 */
export function calculateMinutes(
  checkInAt: Date | null,
  checkOutAt: Date | null,
  snapshot: ExpectedScheduleSnapshot
): { workedMinutes: number; overtimeMinutes: number } {
  if (!checkInAt || !checkOutAt) {
    return { workedMinutes: 0, overtimeMinutes: 0 };
  }

  const elapsedMs = checkOutAt.getTime() - checkInAt.getTime();
  const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / (1000 * 60)));
  const workedMinutes = Math.max(0, elapsedMinutes - snapshot.expectedBreakMinutes);

  const overtimeMinutes = Math.max(0, workedMinutes - snapshot.expectedMinutes);

  return { workedMinutes, overtimeMinutes };
}

/**
 * Derives the ordered flags array:
 * 1. OVERTIME when overtimeMinutes > 0
 * 2. MISSING_CHECK_OUT when checkInAt exists and checkOutAt is null
 * 3. MANUALLY_EDITED when manuallyEdited is true
 */
export function deriveAttendanceFlags(params: {
  checkInAt: Date | null;
  checkOutAt: Date | null;
  overtimeMinutes: number;
  manuallyEdited: boolean;
}): AttendanceFlag[] {
  const flags: AttendanceFlag[] = [];

  if (params.overtimeMinutes > 0) {
    flags.push('OVERTIME');
  }

  if (params.checkInAt !== null && params.checkOutAt === null) {
    flags.push('MISSING_CHECK_OUT');
  }

  if (params.manuallyEdited) {
    flags.push('MANUALLY_EDITED');
  }

  return flags;
}

/**
 * Raw display-only elapsed minutes between check-in and serverNow / checkOut.
 * Does not subtract break.
 */
export function calculateDisplayElapsedMinutes(
  checkInAt: Date | null,
  checkOutAt: Date | null,
  serverNow: Date
): number {
  if (!checkInAt) {
    return 0;
  }

  const endInstant = checkOutAt ?? serverNow;
  const elapsedMs = endInstant.getTime() - checkInAt.getTime();
  return Math.max(0, Math.floor(elapsedMs / (1000 * 60)));
}
