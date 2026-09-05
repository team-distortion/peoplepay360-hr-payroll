import {
  timeStringToMinutes,
  minutesToTimeString,
  calculateDayInterval,
  normalizeScheduleName,
  type Weekday,
  WeekdayValues,
} from '@peoplepay360/shared';

export {
  timeStringToMinutes,
  minutesToTimeString,
  calculateDayInterval,
  normalizeScheduleName,
  type Weekday,
  WeekdayValues,
};

export interface CalculatedInterval {
  intervalDuration: number;
  dailyMinutes: number;
  overnight: boolean;
}

export function computeDailyMinutes(
  startTime: string,
  endTime: string,
  breakMinutes: number
): CalculatedInterval {
  return calculateDayInterval(startTime, endTime, breakMinutes);
}

export function computeWeeklyMinutes(
  days: Array<{ startTime: string; endTime: string; breakMinutes: number }>
): number {
  return days.reduce((total, day) => {
    const { dailyMinutes } = calculateDayInterval(
      day.startTime,
      day.endTime,
      day.breakMinutes
    );
    return total + dailyMinutes;
  }, 0);
}

export const WEEKDAY_ORDER: Record<Weekday, number> = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 7,
};

export function sortDaysByWeekday<T extends { dayOfWeek: Weekday }>(days: T[]): T[] {
  return [...days].sort(
    (a, b) => WEEKDAY_ORDER[a.dayOfWeek] - WEEKDAY_ORDER[b.dayOfWeek]
  );
}
