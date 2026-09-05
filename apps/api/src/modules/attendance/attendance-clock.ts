import { env } from '../../config/env.js';
import type { Weekday } from '@peoplepay360/shared';

export interface CompanyClock {
  now(): Date;
  timeZone: string;
}

export class SystemCompanyClock implements CompanyClock {
  constructor(public readonly timeZone: string = env.COMPANY_TIMEZONE) {}

  now(): Date {
    return new Date();
  }
}

export class FixedCompanyClock implements CompanyClock {
  private currentTime: Date;

  constructor(
    initialTime: Date | string,
    public readonly timeZone: string = env.COMPANY_TIMEZONE
  ) {
    this.currentTime = typeof initialTime === 'string' ? new Date(initialTime) : initialTime;
  }

  now(): Date {
    return new Date(this.currentTime.getTime());
  }

  setTime(time: Date | string): void {
    this.currentTime = typeof time === 'string' ? new Date(time) : time;
  }

  advanceMinutes(minutes: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + minutes * 60 * 1000);
  }
}

export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

interface DateParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  weekday: string;
}

function extractDateParts(instant: Date, timeZone: string): DateParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'long',
  });

  const parts = dtf.formatToParts(instant);
  const map: Record<string, string> = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }

  return {
    year: map.year ?? '1970',
    month: map.month ?? '01',
    day: map.day ?? '01',
    hour: map.hour ?? '00',
    minute: map.minute ?? '00',
    weekday: map.weekday ?? 'Monday',
  };
}

/**
 * Returns the company-local calendar date in YYYY-MM-DD format.
 */
export function getCompanyBusinessDate(
  instant: Date,
  timeZone: string = env.COMPANY_TIMEZONE
): string {
  const { year, month, day } = extractDateParts(instant, timeZone);
  return `${year}-${month}-${day}`;
}

/**
 * Returns minute-of-day (0..1439) in company-local time.
 */
export function getCompanyMinuteOfDay(
  instant: Date,
  timeZone: string = env.COMPANY_TIMEZONE
): number {
  const { hour, minute } = extractDateParts(instant, timeZone);
  const h = parseInt(hour, 10) % 24;
  const m = parseInt(minute, 10);
  return h * 60 + m;
}

const WEEKDAY_MAP: Record<string, Weekday> = {
  monday: 'MONDAY',
  tuesday: 'TUESDAY',
  wednesday: 'WEDNESDAY',
  thursday: 'THURSDAY',
  friday: 'FRIDAY',
  saturday: 'SATURDAY',
  sunday: 'SUNDAY',
};

/**
 * Returns the company-local Weekday enum.
 */
export function getCompanyWeekday(
  instant: Date,
  timeZone: string = env.COMPANY_TIMEZONE
): Weekday {
  const { weekday } = extractDateParts(instant, timeZone);
  const normalized = weekday.toLowerCase();
  const matched = WEEKDAY_MAP[normalized];
  if (!matched) {
    throw new Error(`Unrecognized weekday: ${weekday}`);
  }
  return matched;
}

/**
 * Verifies whether a given UTC instant belongs to the specified company business date (YYYY-MM-DD).
 */
export function isInstantOnBusinessDate(
  instant: Date,
  businessDate: string,
  timeZone: string = env.COMPANY_TIMEZONE
): boolean {
  const derivedDate = getCompanyBusinessDate(instant, timeZone);
  return derivedDate === businessDate;
}
