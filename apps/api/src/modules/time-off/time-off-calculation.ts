import { Prisma } from '@prisma/client';
import { AppError } from '../../errors/app-error.js';
import type { Weekday } from '@peoplepay360/shared';

const WEEKDAYS_IN_ORDER: Weekday[] = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

/**
 * Deterministically returns the Weekday enum for a YYYY-MM-DD date string.
 */
export function getWeekdayFromDateString(dateStr: string): Weekday {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dayIndex = dt.getUTCDay();
  return WEEKDAYS_IN_ORDER[dayIndex];
}

/**
 * Returns an array of date strings in YYYY-MM-DD format between startDate and endDate inclusive.
 * Rejects if endDate < startDate or range exceeds 366 calendar days.
 */
export function generateDateRange(startDate: string, endDate: string): string[] {
  if (endDate < startDate) {
    throw new AppError(400, 'INVALID_TIME_OFF_PERIOD', 'End date cannot be earlier than start date');
  }

  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);

  const startUtc = Date.UTC(sy, sm - 1, sd);
  const endUtc = Date.UTC(ey, em - 1, ed);

  const dayMs = 24 * 60 * 60 * 1000;
  const daysDiff = Math.round((endUtc - startUtc) / dayMs) + 1;

  if (daysDiff > 366) {
    throw new AppError(400, 'INVALID_TIME_OFF_PERIOD', 'Date range cannot exceed 366 calendar days');
  }

  const dates: string[] = [];
  let currentUtc = startUtc;
  while (currentUtc <= endUtc) {
    const d = new Date(currentUtc);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
    currentUtc += dayMs;
  }

  return dates;
}

export interface ScheduleDaySnapshot {
  startMinute: number;
  endMinute: number;
  breakMinutes: number;
}

export interface ResolvedScheduleInfo {
  scheduleId: string;
  days: Map<Weekday, ScheduleDaySnapshot>;
}

/**
 * Resolves the effective schedule for a specific date for an employee:
 * 1. Contract override covering the date with a non-null workingScheduleId
 * 2. Employee fallback workingScheduleId
 * Throws TIME_OFF_SCHEDULE_MISSING (422) if no schedule resolves or schedule does not exist.
 */
export async function resolveScheduleForDate(
  employeeId: string,
  dateStr: string,
  tx: Prisma.TransactionClient
): Promise<ResolvedScheduleInfo> {
  const dateObj = new Date(dateStr + 'T00:00:00.000Z');

  // 1. Contract override
  const contract = await tx.contract.findFirst({
    where: {
      employeeId,
      startDate: { lte: dateObj },
      OR: [{ endDate: null }, { endDate: { gte: dateObj } }],
    },
    select: {
      id: true,
      workingScheduleId: true,
    },
  });

  let scheduleId: string | null = contract?.workingScheduleId ?? null;

  // 2. Employee fallback
  if (!scheduleId) {
    const emp = await tx.employee.findUnique({
      where: { id: employeeId },
      select: { workingScheduleId: true },
    });
    scheduleId = emp?.workingScheduleId ?? null;
  }

  if (!scheduleId) {
    throw new AppError(
      422,
      'TIME_OFF_SCHEDULE_MISSING',
      `Expected schedule cannot resolve for employee on date ${dateStr}`
    );
  }

  const schedule = await tx.workingSchedule.findUnique({
    where: { id: scheduleId },
    include: { days: true },
  });

  if (!schedule) {
    throw new AppError(
      422,
      'TIME_OFF_SCHEDULE_MISSING',
      `Assigned working schedule ${scheduleId} does not exist`
    );
  }

  const daysMap = new Map<Weekday, ScheduleDaySnapshot>();
  for (const day of schedule.days) {
    daysMap.set(day.dayOfWeek, {
      startMinute: day.startMinute,
      endMinute: day.endMinute,
      breakMinutes: day.breakMinutes,
    });
  }

  return {
    scheduleId: schedule.id,
    days: daysMap,
  };
}

/**
 * Calculates DAY request duration by counting expected working days in the range.
 * Contract schedule overrides Employee fallback per date.
 * Throws TIME_OFF_NO_WORKING_TIME if 0 working days found.
 */
export async function calculateDayDuration(
  employeeId: string,
  startDate: string,
  endDate: string,
  tx: Prisma.TransactionClient
): Promise<string> {
  const dates = generateDateRange(startDate, endDate);
  let workingDaysCount = 0;

  for (const dateStr of dates) {
    const scheduleInfo = await resolveScheduleForDate(employeeId, dateStr, tx);
    const weekday = getWeekdayFromDateString(dateStr);
    if (scheduleInfo.days.has(weekday)) {
      workingDaysCount += 1;
    }
  }

  if (workingDaysCount === 0) {
    throw new AppError(
      400,
      'TIME_OFF_NO_WORKING_TIME',
      'DAY request must contain at least one expected working date'
    );
  }

  return new Prisma.Decimal(workingDaysCount).toFixed(4);
}

/**
 * Calculates HOUR request duration:
 * 1. Requires startDate === endDate.
 * 2. startMinute and endMinute within 0..1439, divisible by 15, endMinute > startMinute.
 * 3. Schedule must have working day on this date, and [startMinute, endMinute] must be within scheduled hours.
 * Returns (endMinute - startMinute) / 60 as exact Decimal string.
 */
export async function calculateHourDuration(
  employeeId: string,
  dateStr: string,
  startMinute: number | null | undefined,
  endMinute: number | null | undefined,
  tx: Prisma.TransactionClient
): Promise<string> {
  if (
    startMinute === null ||
    startMinute === undefined ||
    endMinute === null ||
    endMinute === undefined
  ) {
    throw new AppError(
      400,
      'INVALID_TIME_OFF_PERIOD',
      'Start minute and end minute are required for HOUR requests'
    );
  }

  if (
    startMinute < 0 ||
    startMinute > 1439 ||
    endMinute < 0 ||
    endMinute > 1439 ||
    endMinute <= startMinute
  ) {
    throw new AppError(
      400,
      'INVALID_TIME_OFF_PERIOD',
      'Minutes must be between 0 and 1439 with end minute greater than start minute'
    );
  }

  if (startMinute % 15 !== 0 || endMinute % 15 !== 0) {
    throw new AppError(
      400,
      'INVALID_TIME_OFF_PERIOD',
      'Start and end minutes must use 15-minute boundaries'
    );
  }

  const scheduleInfo = await resolveScheduleForDate(employeeId, dateStr, tx);
  const weekday = getWeekdayFromDateString(dateStr);
  const dayRow = scheduleInfo.days.get(weekday);

  if (!dayRow) {
    throw new AppError(
      400,
      'TIME_OFF_NO_WORKING_TIME',
      'HOUR request must occur on an expected working date'
    );
  }

  if (startMinute < dayRow.startMinute || endMinute > dayRow.endMinute) {
    throw new AppError(
      400,
      'TIME_OFF_NO_WORKING_TIME',
      `Requested time ${startMinute}-${endMinute} must remain within scheduled hours ${dayRow.startMinute}-${dayRow.endMinute}`
    );
  }

  const diffMinutes = endMinute - startMinute;
  const decimalHours = new Prisma.Decimal(diffMinutes).dividedBy(60);
  return decimalHours.toFixed(4);
}
