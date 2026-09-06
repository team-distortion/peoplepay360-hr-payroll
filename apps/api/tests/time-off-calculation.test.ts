import { describe, it, expect } from 'vitest';
import {
  getWeekdayFromDateString,
  generateDateRange,
  calculateDayDuration,
  calculateHourDuration,
} from '../src/modules/time-off/time-off-calculation.js';
import { checkTwoRequestsOverlap } from '../src/modules/time-off/time-off-overlap.js';
import { AppError } from '../src/errors/app-error.js';

describe('Time Off Calculation & Overlap Unit Tests', () => {
  describe('getWeekdayFromDateString', () => {
    it('correctly maps dates to canonical Weekdays', () => {
      // 2026-09-14 is Monday
      expect(getWeekdayFromDateString('2026-09-14')).toBe('MONDAY');
      // 2026-09-15 is Tuesday
      expect(getWeekdayFromDateString('2026-09-15')).toBe('TUESDAY');
      // 2026-09-16 is Wednesday
      expect(getWeekdayFromDateString('2026-09-16')).toBe('WEDNESDAY');
      // 2026-09-17 is Thursday
      expect(getWeekdayFromDateString('2026-09-17')).toBe('THURSDAY');
      // 2026-09-18 is Friday
      expect(getWeekdayFromDateString('2026-09-18')).toBe('FRIDAY');
      // 2026-09-19 is Saturday
      expect(getWeekdayFromDateString('2026-09-19')).toBe('SATURDAY');
      // 2026-09-20 is Sunday
      expect(getWeekdayFromDateString('2026-09-20')).toBe('SUNDAY');
    });
  });

  describe('generateDateRange', () => {
    it('generates inclusive date range correctly', () => {
      const dates = generateDateRange('2026-09-14', '2026-09-16');
      expect(dates).toEqual(['2026-09-14', '2026-09-15', '2026-09-16']);
    });

    it('generates single day correctly', () => {
      const dates = generateDateRange('2026-09-14', '2026-09-14');
      expect(dates).toEqual(['2026-09-14']);
    });

    it('rejects if endDate < startDate', () => {
      expect(() => generateDateRange('2026-09-16', '2026-09-14')).toThrow(AppError);
    });

    it('rejects if range exceeds 366 days', () => {
      expect(() => generateDateRange('2026-01-01', '2027-01-05')).toThrow(AppError);
    });
  });

  describe('checkTwoRequestsOverlap', () => {
    it('detects DAY vs DAY intersection', () => {
      // Overlapping
      expect(
        checkTwoRequestsOverlap(
          { unit: 'DAY', startDate: '2026-09-10', endDate: '2026-09-15' },
          { unit: 'DAY', startDate: '2026-09-14', endDate: '2026-09-20' }
        )
      ).toBe(true);

      // Non-overlapping
      expect(
        checkTwoRequestsOverlap(
          { unit: 'DAY', startDate: '2026-09-10', endDate: '2026-09-13' },
          { unit: 'DAY', startDate: '2026-09-14', endDate: '2026-09-20' }
        )
      ).toBe(false);
    });

    it('detects DAY vs HOUR containment', () => {
      // HOUR falls within DAY range
      expect(
        checkTwoRequestsOverlap(
          { unit: 'DAY', startDate: '2026-09-10', endDate: '2026-09-15' },
          { unit: 'HOUR', startDate: '2026-09-12', endDate: '2026-09-12', startMinute: 600, endMinute: 660 }
        )
      ).toBe(true);

      // HOUR falls outside DAY range
      expect(
        checkTwoRequestsOverlap(
          { unit: 'DAY', startDate: '2026-09-10', endDate: '2026-09-15' },
          { unit: 'HOUR', startDate: '2026-09-16', endDate: '2026-09-16', startMinute: 600, endMinute: 660 }
        )
      ).toBe(false);
    });

    it('detects HOUR vs HOUR same-day overlap and respects adjacent intervals', () => {
      // Overlapping hours: 09:00-11:00 and 10:00-12:00
      expect(
        checkTwoRequestsOverlap(
          { unit: 'HOUR', startDate: '2026-09-14', endDate: '2026-09-14', startMinute: 540, endMinute: 660 },
          { unit: 'HOUR', startDate: '2026-09-14', endDate: '2026-09-14', startMinute: 600, endMinute: 720 }
        )
      ).toBe(true);

      // Adjacent non-overlapping: 09:00-10:00 (540-600) and 10:00-11:00 (600-660)
      expect(
        checkTwoRequestsOverlap(
          { unit: 'HOUR', startDate: '2026-09-14', endDate: '2026-09-14', startMinute: 540, endMinute: 600 },
          { unit: 'HOUR', startDate: '2026-09-14', endDate: '2026-09-14', startMinute: 600, endMinute: 660 }
        )
      ).toBe(false);

      // Different dates do not overlap
      expect(
        checkTwoRequestsOverlap(
          { unit: 'HOUR', startDate: '2026-09-14', endDate: '2026-09-14', startMinute: 540, endMinute: 660 },
          { unit: 'HOUR', startDate: '2026-09-15', endDate: '2026-09-15', startMinute: 540, endMinute: 660 }
        )
      ).toBe(false);
    });
  });

  describe('calculateDayDuration with Schedule mock', () => {
    it('counts only scheduled working days across a weekend', async () => {
      // Monday 2026-09-14 to Tuesday 2026-09-22: 9 calendar days, 7 weekdays (Mon-Fri)
      const mockTx: any = {
        contract: {
          findFirst: async () => null,
        },
        employee: {
          findUnique: async () => ({ workingScheduleId: 'sched-std' }),
        },
        workingSchedule: {
          findUnique: async () => ({
            id: 'sched-std',
            days: [
              { dayOfWeek: 'MONDAY', startMinute: 540, endMinute: 1020, breakMinutes: 60 },
              { dayOfWeek: 'TUESDAY', startMinute: 540, endMinute: 1020, breakMinutes: 60 },
              { dayOfWeek: 'WEDNESDAY', startMinute: 540, endMinute: 1020, breakMinutes: 60 },
              { dayOfWeek: 'THURSDAY', startMinute: 540, endMinute: 1020, breakMinutes: 60 },
              { dayOfWeek: 'FRIDAY', startMinute: 540, endMinute: 1020, breakMinutes: 60 },
            ],
          }),
        },
      };

      // 2026-09-14 (Mon) to 2026-09-20 (Sun): Mon, Tue, Wed, Thu, Fri = 5 working days
      const duration = await calculateDayDuration('emp-1', '2026-09-14', '2026-09-20', mockTx);
      expect(duration).toBe('5.0000');
    });

    it('throws TIME_OFF_NO_WORKING_TIME if range contains zero working days', async () => {
      // 2026-09-19 (Sat) to 2026-09-20 (Sun)
      const mockTx: any = {
        contract: { findFirst: async () => null },
        employee: { findUnique: async () => ({ workingScheduleId: 'sched-std' }) },
        workingSchedule: {
          findUnique: async () => ({
            id: 'sched-std',
            days: [
              { dayOfWeek: 'MONDAY', startMinute: 540, endMinute: 1020, breakMinutes: 60 },
            ],
          }),
        },
      };

      await expect(
        calculateDayDuration('emp-1', '2026-09-19', '2026-09-20', mockTx)
      ).rejects.toThrow('DAY request must contain at least one expected working date');
    });

    it('throws TIME_OFF_SCHEDULE_MISSING if no schedule resolves', async () => {
      const mockTx: any = {
        contract: { findFirst: async () => null },
        employee: { findUnique: async () => ({ workingScheduleId: null }) },
      };

      await expect(
        calculateDayDuration('emp-1', '2026-09-14', '2026-09-15', mockTx)
      ).rejects.toThrow('Expected schedule cannot resolve for employee');
    });
  });

  describe('calculateHourDuration with Schedule mock', () => {
    it('calculates exact decimal hours in 15-minute increments', async () => {
      // 09:15 (555) to 11:45 (705) = 150 minutes = 2.5000 hours
      const mockTx: any = {
        contract: { findFirst: async () => null },
        employee: { findUnique: async () => ({ workingScheduleId: 'sched-std' }) },
        workingSchedule: {
          findUnique: async () => ({
            id: 'sched-std',
            days: [
              { dayOfWeek: 'MONDAY', startMinute: 540, endMinute: 1020, breakMinutes: 60 },
            ],
          }),
        },
      };

      const duration = await calculateHourDuration('emp-1', '2026-09-14', 555, 705, mockTx);
      expect(duration).toBe('2.5000');
    });

    it('rejects minutes not on 15-minute boundary', async () => {
      const mockTx: any = {};
      await expect(
        calculateHourDuration('emp-1', '2026-09-14', 550, 600, mockTx)
      ).rejects.toThrow('Start and end minutes must use 15-minute boundaries');
    });

    it('rejects hours outside expected schedule hours', async () => {
      const mockTx: any = {
        contract: { findFirst: async () => null },
        employee: { findUnique: async () => ({ workingScheduleId: 'sched-std' }) },
        workingSchedule: {
          findUnique: async () => ({
            id: 'sched-std',
            days: [
              { dayOfWeek: 'MONDAY', startMinute: 540, endMinute: 1020, breakMinutes: 60 },
            ],
          }),
        },
      };

      // 08:00 (480) is before 09:00 (540)
      await expect(
        calculateHourDuration('emp-1', '2026-09-14', 480, 600, mockTx)
      ).rejects.toThrow('must remain within scheduled hours');
    });
  });
});
