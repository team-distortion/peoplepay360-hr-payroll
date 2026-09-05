import { describe, it, expect } from 'vitest';
import {
  timeStringToMinutes,
  minutesToTimeString,
  calculateDayInterval,
  computeWeeklyMinutes,
  sortDaysByWeekday,
  normalizeScheduleName,
} from '../src/modules/schedules/schedule-time.js';

describe('schedule-time pure helper tests', () => {
  it('09:00-18:00 with 60-minute break = 480 minutes', () => {
    const result = calculateDayInterval('09:00', '18:00', 60);
    expect(result.intervalDuration).toBe(540);
    expect(result.dailyMinutes).toBe(480);
    expect(result.overnight).toBe(false);
  });

  it('22:00-06:00 with no break = 480 minutes and overnight=true', () => {
    const result = calculateDayInterval('22:00', '06:00', 0);
    expect(result.intervalDuration).toBe(480);
    expect(result.dailyMinutes).toBe(480);
    expect(result.overnight).toBe(true);
  });

  it('equal start/end is rejected', () => {
    expect(() => calculateDayInterval('09:00', '09:00', 0)).toThrow(
      'Start time and end time cannot be equal'
    );
  });

  it('invalid HH:mm format is rejected', () => {
    expect(() => timeStringToMinutes('25:00')).toThrow('Invalid time format');
    expect(() => timeStringToMinutes('09:60')).toThrow('Invalid time format');
    expect(() => timeStringToMinutes('9:00')).toThrow('Invalid time format');
    expect(() => timeStringToMinutes('abc')).toThrow('Invalid time format');
  });

  it('break equal to or exceeding interval is rejected', () => {
    // 09:00 to 17:00 is 480 minutes (8 hours)
    expect(() => calculateDayInterval('09:00', '17:00', 480)).toThrow(
      'Break minutes must be less than shift duration'
    );
    expect(() => calculateDayInterval('09:00', '17:00', 500)).toThrow(
      'Break minutes must be less than shift duration'
    );
  });

  it('net duration over 16 hours (960 minutes) is rejected', () => {
    // 06:00 to 23:00 is 17 hours = 1020 minutes. Break 0 -> dailyMinutes = 1020 > 960
    expect(() => calculateDayInterval('06:00', '23:00', 0)).toThrow(
      'Net working interval cannot exceed 16 hours (960 minutes)'
    );

    // Overnight: 14:00 to 07:00 is 17 hours = 1020 minutes. Break 0 -> > 960
    expect(() => calculateDayInterval('14:00', '07:00', 0)).toThrow(
      'Net working interval cannot exceed 16 hours (960 minutes)'
    );
  });

  it('weekly total sums integer minutes exactly', () => {
    const days = [
      { startTime: '09:00', endTime: '18:00', breakMinutes: 60 }, // 480 min
      { startTime: '09:00', endTime: '18:00', breakMinutes: 60 }, // 480 min
      { startTime: '09:00', endTime: '18:00', breakMinutes: 60 }, // 480 min
      { startTime: '09:00', endTime: '18:00', breakMinutes: 60 }, // 480 min
      { startTime: '09:00', endTime: '18:00', breakMinutes: 60 }, // 480 min
    ];
    const total = computeWeeklyMinutes(days);
    expect(total).toBe(2400); // 40 hours = 2400 minutes
  });

  it('converts minutes to HH:mm string accurately', () => {
    expect(minutesToTimeString(0)).toBe('00:00');
    expect(minutesToTimeString(540)).toBe('09:00');
    expect(minutesToTimeString(1080)).toBe('18:00');
    expect(minutesToTimeString(1439)).toBe('23:59');
    expect(() => minutesToTimeString(1440)).toThrow();
    expect(() => minutesToTimeString(-1)).toThrow();
  });

  it('sorts days strictly Monday to Sunday', () => {
    const unsorted = [
      { dayOfWeek: 'FRIDAY' as const, value: 5 },
      { dayOfWeek: 'MONDAY' as const, value: 1 },
      { dayOfWeek: 'WEDNESDAY' as const, value: 3 },
      { dayOfWeek: 'SUNDAY' as const, value: 7 },
    ];
    const sorted = sortDaysByWeekday(unsorted);
    expect(sorted.map((s) => s.dayOfWeek)).toEqual([
      'MONDAY',
      'WEDNESDAY',
      'FRIDAY',
      'SUNDAY',
    ]);
  });

  it('normalizes schedule names for case-insensitive uniqueness', () => {
    expect(normalizeScheduleName('  40 Hours / Week  ')).toBe('40 hours / week');
    expect(normalizeScheduleName('NIGHT SHIFT')).toBe('night shift');
  });
});
