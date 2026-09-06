import { Weekday } from '@prisma/client';

const WEEKDAYS: Weekday[] = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

export function getWeekdayFromDateString(dateStr: string): Weekday {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return WEEKDAYS[d.getUTCDay()];
}

export function generateDateRange(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const [ey, em, ed] = endDateStr.split('-').map(Number);

  let current = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));

  while (current <= end) {
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, '0');
    const d = String(current.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

export function toMonthKey(date: Date | string): string {
  if (typeof date === 'string') {
    return date.slice(0, 7);
  }
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getDefaultPeriod(): { periodStart: string; periodEnd: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-indexed
  const start = new Date(Date.UTC(y, m, 1));
  const end = new Date(Date.UTC(y, m + 1, 0)); // last day of month

  const startStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const endStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(end.getUTCDate()).padStart(2, '0')}`;
  return { periodStart: startStr, periodEnd: endStr };
}
