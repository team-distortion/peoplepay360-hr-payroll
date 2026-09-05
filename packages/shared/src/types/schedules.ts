import { z } from 'zod';

export const WorkingScheduleTypeValues = ['STANDARD', 'SHIFT', 'FLEXIBLE'] as const;
export const WorkingScheduleStatusValues = ['ACTIVE', 'INACTIVE'] as const;
export const WeekdayValues = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

export type WorkingScheduleType = (typeof WorkingScheduleTypeValues)[number];
export type WorkingScheduleStatus = (typeof WorkingScheduleStatusValues)[number];
export type Weekday = (typeof WeekdayValues)[number];

export interface WorkingScheduleDayInput {
  dayOfWeek: Weekday;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  breakMinutes: number; // integer
}

export interface WorkingScheduleInput {
  name: string;
  type: WorkingScheduleType;
  companyName: string;
  status: WorkingScheduleStatus;
  days: WorkingScheduleDayInput[];
}

export interface WorkingScheduleDayDto extends WorkingScheduleDayInput {
  id: string;
  dailyMinutes: number;
  overnight: boolean;
}

export interface WorkingScheduleDto {
  id: string;
  name: string;
  type: WorkingScheduleType;
  companyName: string;
  timezone: string;
  status: WorkingScheduleStatus;
  days: WorkingScheduleDayDto[];
  daysPerWeek: number;
  weeklyMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkingScheduleListQuery {
  search?: string;
  status?: WorkingScheduleStatus;
  type?: WorkingScheduleType;
  page?: number;
  pageSize?: number;
}

export interface WorkingScheduleListResponse {
  items: WorkingScheduleDto[];
  page: number;
  pageSize: number;
  total: number;
}

export interface WorkingScheduleStatusInput {
  status: WorkingScheduleStatus;
}

// Pure time helpers
export function timeStringToMinutes(time: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error(`Invalid time format: ${time}. Expected HH:mm`);
  }
  const [hoursStr, minutesStr] = time.split(':');
  return Number(hoursStr) * 60 + Number(minutesStr);
}

export function minutesToTimeString(minutes: number): string {
  if (minutes < 0 || minutes > 1439 || !Number.isInteger(minutes)) {
    throw new Error(`Invalid minute value: ${minutes}. Expected integer 0-1439`);
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export function calculateDayInterval(
  startTime: string,
  endTime: string,
  breakMinutes: number
): { intervalDuration: number; dailyMinutes: number; overnight: boolean } {
  const startMinute = timeStringToMinutes(startTime);
  const endMinute = timeStringToMinutes(endTime);

  if (startMinute === endMinute) {
    throw new Error('Start time and end time cannot be equal');
  }

  const overnight = endMinute < startMinute;
  const intervalDuration = overnight
    ? 1440 - startMinute + endMinute
    : endMinute - startMinute;

  if (breakMinutes < 0) {
    throw new Error('Break minutes cannot be negative');
  }

  if (breakMinutes >= intervalDuration) {
    throw new Error('Break minutes must be less than shift duration');
  }

  const dailyMinutes = intervalDuration - breakMinutes;

  if (dailyMinutes > 960) {
    throw new Error('Net working interval cannot exceed 16 hours (960 minutes)');
  }

  return {
    intervalDuration,
    dailyMinutes,
    overnight,
  };
}

export function normalizeScheduleName(name: string): string {
  return name.trim().toLowerCase();
}

// Zod Schemas
export const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const WorkingScheduleDayInputSchema = z
  .object({
    dayOfWeek: z.enum(WeekdayValues, {
      errorMap: () => ({ message: 'Invalid weekday' }),
    }),
    startTime: z.string().regex(TIME_REGEX, 'Start time must be in HH:mm format'),
    endTime: z.string().regex(TIME_REGEX, 'End time must be in HH:mm format'),
    breakMinutes: z
      .number({ invalid_type_error: 'Break minutes must be a number' })
      .int('Break minutes must be an integer')
      .min(0, 'Break minutes cannot be negative')
      .max(720, 'Break minutes cannot exceed 720 minutes (12 hours)'),
  })
  .superRefine((data, ctx) => {
    if (!TIME_REGEX.test(data.startTime) || !TIME_REGEX.test(data.endTime)) {
      return;
    }

    const startMin = timeStringToMinutes(data.startTime);
    const endMin = timeStringToMinutes(data.endTime);

    if (startMin === endMin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Start time and end time cannot be equal',
        path: ['endTime'],
      });
      return;
    }

    const overnight = endMin < startMin;
    const intervalDuration = overnight
      ? 1440 - startMin + endMin
      : endMin - startMin;

    if (data.breakMinutes >= intervalDuration) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Break minutes must be strictly less than shift duration',
        path: ['breakMinutes'],
      });
      return;
    }

    const dailyMinutes = intervalDuration - data.breakMinutes;
    if (dailyMinutes <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Daily net working minutes must be greater than zero',
        path: ['breakMinutes'],
      });
    }

    if (dailyMinutes > 960) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Daily net working minutes cannot exceed 16 hours (960 minutes)',
        path: ['endTime'],
      });
    }
  });

export const WorkingScheduleInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Schedule name must be at least 2 characters')
      .max(100, 'Schedule name cannot exceed 100 characters'),
    type: z.enum(WorkingScheduleTypeValues, {
      errorMap: () => ({ message: 'Invalid schedule type' }),
    }),
    companyName: z
      .string()
      .trim()
      .min(2, 'Company name must be at least 2 characters')
      .max(120, 'Company name cannot exceed 120 characters'),
    status: z.enum(WorkingScheduleStatusValues, {
      errorMap: () => ({ message: 'Invalid schedule status' }),
    }),
    days: z
      .array(WorkingScheduleDayInputSchema)
      .min(1, 'Schedule must contain at least one day')
      .max(7, 'Schedule cannot contain more than 7 days'),
  })
  .superRefine((data, ctx) => {
    const seenDays = new Set<Weekday>();
    data.days.forEach((day, idx) => {
      if (seenDays.has(day.dayOfWeek)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate day ${day.dayOfWeek} in schedule`,
          path: ['days', idx, 'dayOfWeek'],
        });
      }
      seenDays.add(day.dayOfWeek);
    });
  });

export const WorkingScheduleStatusSchema = z.object({
  status: z.enum(WorkingScheduleStatusValues, {
    errorMap: () => ({ message: 'Invalid schedule status' }),
  }),
});

export const WorkingScheduleQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(WorkingScheduleStatusValues).optional(),
  type: z.enum(WorkingScheduleTypeValues).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
