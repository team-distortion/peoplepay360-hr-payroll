import { describe, it, expect } from 'vitest';
import {
  getCompanyBusinessDate,
  getCompanyMinuteOfDay,
  getCompanyWeekday,
  isInstantOnBusinessDate,
  isValidTimezone,
  FixedCompanyClock,
} from '../src/modules/attendance/attendance-clock.js';

describe('Attendance Timezone Clock Utility', () => {
  const IST = 'Asia/Kolkata'; // UTC +05:30

  describe('Timezone validation', () => {
    it('accepts valid IANA timezones', () => {
      expect(isValidTimezone('Asia/Kolkata')).toBe(true);
      expect(isValidTimezone('UTC')).toBe(true);
      expect(isValidTimezone('America/New_York')).toBe(true);
      expect(isValidTimezone('Europe/London')).toBe(true);
    });

    it('rejects invalid timezone names', () => {
      expect(isValidTimezone('Invalid/Timezone')).toBe(false);
      expect(isValidTimezone('foo_bar')).toBe(false);
    });
  });

  describe('Midnight boundary conversions', () => {
    it('correctly maps instant before company midnight to previous day in IST', () => {
      // 2026-09-05 18:29:00 UTC + 05:30 = 2026-09-05 23:59:00 IST
      const instant = new Date('2026-09-05T18:29:00.000Z');
      expect(getCompanyBusinessDate(instant, IST)).toBe('2026-09-05');
      expect(getCompanyMinuteOfDay(instant, IST)).toBe(23 * 60 + 59); // 1439
      expect(getCompanyWeekday(instant, IST)).toBe('SATURDAY');
      expect(isInstantOnBusinessDate(instant, '2026-09-05', IST)).toBe(true);
      expect(isInstantOnBusinessDate(instant, '2026-09-06', IST)).toBe(false);
    });

    it('correctly maps instant after company midnight to next day in IST', () => {
      // 2026-09-05 18:31:00 UTC + 05:30 = 2026-09-06 00:01:00 IST
      const instant = new Date('2026-09-05T18:31:00.000Z');
      expect(getCompanyBusinessDate(instant, IST)).toBe('2026-09-06');
      expect(getCompanyMinuteOfDay(instant, IST)).toBe(1);
      expect(getCompanyWeekday(instant, IST)).toBe('SUNDAY');
      expect(isInstantOnBusinessDate(instant, '2026-09-06', IST)).toBe(true);
      expect(isInstantOnBusinessDate(instant, '2026-09-05', IST)).toBe(false);
    });

    it('handles exact midnight in company timezone', () => {
      // 2026-09-05 18:30:00 UTC + 05:30 = 2026-09-06 00:00:00 IST
      const instant = new Date('2026-09-05T18:30:00.000Z');
      expect(getCompanyBusinessDate(instant, IST)).toBe('2026-09-06');
      expect(getCompanyMinuteOfDay(instant, IST)).toBe(0);
      expect(getCompanyWeekday(instant, IST)).toBe('SUNDAY');
    });

    it('handles morning work hours conversion', () => {
      // 09:15 IST on 2026-09-07 (Monday) is 03:45 UTC
      const instant = new Date('2026-09-07T03:45:00.000Z');
      expect(getCompanyBusinessDate(instant, IST)).toBe('2026-09-07');
      expect(getCompanyMinuteOfDay(instant, IST)).toBe(9 * 60 + 15); // 555
      expect(getCompanyWeekday(instant, IST)).toBe('MONDAY');
    });
  });

  describe('FixedCompanyClock', () => {
    it('returns frozen time and advances deterministically', () => {
      const clock = new FixedCompanyClock('2026-09-07T03:30:00.000Z', IST);
      expect(clock.now().toISOString()).toBe('2026-09-07T03:30:00.000Z');

      clock.advanceMinutes(45);
      expect(clock.now().toISOString()).toBe('2026-09-07T04:15:00.000Z');
      expect(getCompanyMinuteOfDay(clock.now(), clock.timeZone)).toBe(9 * 60 + 45); // 10:00 IST
    });
  });
});
