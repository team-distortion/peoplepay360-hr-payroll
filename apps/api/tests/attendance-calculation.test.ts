import { describe, it, expect } from 'vitest';
import {
  deriveAttendanceStatus,
  calculateMinutes,
  deriveAttendanceFlags,
  calculateDisplayElapsedMinutes,
  type ExpectedScheduleSnapshot,
} from '../src/modules/attendance/attendance-calculation.js';

describe('Attendance Pure Calculations', () => {
  const standardScheduleSnapshot: ExpectedScheduleSnapshot = {
    expectedStartMinute: 9 * 60, // 540 (09:00)
    expectedEndMinute: 18 * 60, // 1080 (18:00)
    expectedBreakMinutes: 60, // 1 hour break
    expectedMinutes: 480, // 8 hours net
  };

  const nonWorkingDaySnapshot: ExpectedScheduleSnapshot = {
    expectedStartMinute: null,
    expectedEndMinute: null,
    expectedBreakMinutes: 0,
    expectedMinutes: 0,
  };

  describe('Status Derivation', () => {
    it('exact expected start time is PRESENT', () => {
      const status = deriveAttendanceStatus('WORKED', 540, standardScheduleSnapshot.expectedStartMinute);
      expect(status).toBe('PRESENT');
    });

    it('early check-in is PRESENT', () => {
      const status = deriveAttendanceStatus('WORKED', 530, standardScheduleSnapshot.expectedStartMinute);
      expect(status).toBe('PRESENT');
    });

    it('one minute after expected start is LATE', () => {
      const status = deriveAttendanceStatus('WORKED', 541, standardScheduleSnapshot.expectedStartMinute);
      expect(status).toBe('LATE');
    });

    it('non-working-day check-in is PRESENT regardless of minute', () => {
      const status = deriveAttendanceStatus('WORKED', 600, nonWorkingDaySnapshot.expectedStartMinute);
      expect(status).toBe('PRESENT');
    });

    it('explicit ABSENT status kind derives ABSENT', () => {
      const status = deriveAttendanceStatus('ABSENT', null, standardScheduleSnapshot.expectedStartMinute);
      expect(status).toBe('ABSENT');
    });
  });

  describe('Duration and Overtime Calculation', () => {
    it('floors partial minutes and subtracts break once', () => {
      // 9 hours and 30 seconds = 540 complete minutes. Break 60m => 480 worked minutes, 0 overtime.
      const checkIn = new Date('2026-09-07T03:30:00.000Z');
      const checkOut = new Date('2026-09-07T12:30:30.000Z'); // 9h 30s later
      const result = calculateMinutes(checkIn, checkOut, standardScheduleSnapshot);
      expect(result.workedMinutes).toBe(480);
      expect(result.overtimeMinutes).toBe(0);
    });

    it('calculates daily excess overtime correctly', () => {
      // 10 hours elapsed = 600m. Break 60m => 540 worked minutes. Expected 480m => 60m overtime.
      const checkIn = new Date('2026-09-07T03:30:00.000Z');
      const checkOut = new Date('2026-09-07T13:30:00.000Z');
      const result = calculateMinutes(checkIn, checkOut, standardScheduleSnapshot);
      expect(result.workedMinutes).toBe(540);
      expect(result.overtimeMinutes).toBe(60);
    });

    it('non-working day derives all worked minutes as overtime', () => {
      // 4 hours elapsed, 0 break, 0 expected => 240 worked, 240 overtime.
      const checkIn = new Date('2026-09-07T03:30:00.000Z');
      const checkOut = new Date('2026-09-07T07:30:00.000Z');
      const result = calculateMinutes(checkIn, checkOut, nonWorkingDaySnapshot);
      expect(result.workedMinutes).toBe(240);
      expect(result.overtimeMinutes).toBe(240);
    });

    it('never produces negative worked or overtime minutes when short day', () => {
      // 30 minutes worked, 60 min expected break => max(30 - 60, 0) = 0
      const checkIn = new Date('2026-09-07T03:30:00.000Z');
      const checkOut = new Date('2026-09-07T04:00:00.000Z');
      const result = calculateMinutes(checkIn, checkOut, standardScheduleSnapshot);
      expect(result.workedMinutes).toBe(0);
      expect(result.overtimeMinutes).toBe(0);
    });

    it('open record stays at zero persisted worked and overtime minutes', () => {
      const checkIn = new Date('2026-09-07T03:30:00.000Z');
      const result = calculateMinutes(checkIn, null, standardScheduleSnapshot);
      expect(result.workedMinutes).toBe(0);
      expect(result.overtimeMinutes).toBe(0);
    });
  });

  describe('Flags Derivation', () => {
    it('orders flags: OVERTIME -> MISSING_CHECK_OUT -> MANUALLY_EDITED', () => {
      const flags = deriveAttendanceFlags({
        checkInAt: new Date('2026-09-07T03:30:00.000Z'),
        checkOutAt: null,
        overtimeMinutes: 0,
        manuallyEdited: true,
      });
      expect(flags).toEqual(['MISSING_CHECK_OUT', 'MANUALLY_EDITED']);

      const overtimeFlags = deriveAttendanceFlags({
        checkInAt: new Date('2026-09-07T03:30:00.000Z'),
        checkOutAt: new Date('2026-09-07T14:30:00.000Z'),
        overtimeMinutes: 60,
        manuallyEdited: true,
      });
      expect(overtimeFlags).toEqual(['OVERTIME', 'MANUALLY_EDITED']);
    });
  });

  describe('Display Elapsed Minutes', () => {
    it('computes display elapsed minutes without break subtraction', () => {
      const checkIn = new Date('2026-09-07T03:30:00.000Z');
      const serverNow = new Date('2026-09-07T05:45:00.000Z'); // 2h 15m = 135 minutes
      const elapsed = calculateDisplayElapsedMinutes(checkIn, null, serverNow);
      expect(elapsed).toBe(135);
    });
  });
});
