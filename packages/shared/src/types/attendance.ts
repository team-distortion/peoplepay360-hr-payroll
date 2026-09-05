import { z } from 'zod';

export const AttendanceStatusValues = ['PRESENT', 'LATE', 'ABSENT'] as const;
export type AttendanceStatus = (typeof AttendanceStatusValues)[number];

export const AttendanceFlagValues = [
  'OVERTIME',
  'MISSING_CHECK_OUT',
  'MANUALLY_EDITED',
] as const;
export type AttendanceFlag = (typeof AttendanceFlagValues)[number];

export const AttendanceTodayStateValues = [
  'NOT_CHECKED_IN',
  'CHECKED_IN',
  'CHECKED_OUT',
  'ABSENT',
] as const;
export type AttendanceTodayState = (typeof AttendanceTodayStateValues)[number];

export const AttendanceSortFields = [
  'employee',
  'attendanceDate',
  'checkInAt',
  'checkOutAt',
  'workedMinutes',
  'overtimeMinutes',
  'status',
] as const;
export type AttendanceSortField = (typeof AttendanceSortFields)[number];

// ISO timestamp with timezone (Z or +/-offset) regex
const ISO_TIMESTAMP_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

// YYYY-MM-DD date regex
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const ManualAttendanceInputSchema = z
  .object({
    employeeId: z.string().uuid('Invalid employee ID'),
    attendanceDate: z
      .string()
      .regex(DATE_ONLY_REGEX, 'attendanceDate must be YYYY-MM-DD format'),
    kind: z.enum(['WORKED', 'ABSENT']),
    checkInAt: z
      .string()
      .regex(ISO_TIMESTAMP_REGEX, 'checkInAt must be a valid ISO 8601 string with timezone offset or Z')
      .nullable()
      .optional()
      .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
    checkOutAt: z
      .string()
      .regex(ISO_TIMESTAMP_REGEX, 'checkOutAt must be a valid ISO 8601 string with timezone offset or Z')
      .nullable()
      .optional()
      .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
    reason: z
      .string()
      .trim()
      .min(5, 'Reason must be at least 5 characters')
      .max(500, 'Reason cannot exceed 500 characters'),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.kind === 'WORKED') {
      if (!data.checkInAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Check-in time is required for WORKED attendance',
          path: ['checkInAt'],
        });
      }
      if (data.checkInAt && data.checkOutAt) {
        const checkIn = new Date(data.checkInAt).getTime();
        const checkOut = new Date(data.checkOutAt).getTime();
        if (checkOut <= checkIn) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Check-out time must be later than check-in time',
            path: ['checkOutAt'],
          });
        }
      }
    } else if (data.kind === 'ABSENT') {
      if (data.checkInAt !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Check-in time must be null for ABSENT attendance',
          path: ['checkInAt'],
        });
      }
      if (data.checkOutAt !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Check-out time must be null for ABSENT attendance',
          path: ['checkOutAt'],
        });
      }
    }
  });

export type ManualAttendanceInput = z.infer<typeof ManualAttendanceInputSchema>;

export const AttendanceCorrectionInputSchema = z
  .object({
    kind: z.enum(['WORKED', 'ABSENT']),
    checkInAt: z
      .string()
      .regex(ISO_TIMESTAMP_REGEX, 'checkInAt must be a valid ISO 8601 string with timezone offset or Z')
      .nullable()
      .optional()
      .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
    checkOutAt: z
      .string()
      .regex(ISO_TIMESTAMP_REGEX, 'checkOutAt must be a valid ISO 8601 string with timezone offset or Z')
      .nullable()
      .optional()
      .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
    reason: z
      .string()
      .trim()
      .min(5, 'Reason must be at least 5 characters')
      .max(500, 'Reason cannot exceed 500 characters'),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.kind === 'WORKED') {
      if (!data.checkInAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Check-in time is required for WORKED attendance',
          path: ['checkInAt'],
        });
      }
      if (data.checkInAt && data.checkOutAt) {
        const checkIn = new Date(data.checkInAt).getTime();
        const checkOut = new Date(data.checkOutAt).getTime();
        if (checkOut <= checkIn) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Check-out time must be later than check-in time',
            path: ['checkOutAt'],
          });
        }
      }
    } else if (data.kind === 'ABSENT') {
      if (data.checkInAt !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Check-in time must be null for ABSENT attendance',
          path: ['checkInAt'],
        });
      }
      if (data.checkOutAt !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Check-out time must be null for ABSENT attendance',
          path: ['checkOutAt'],
        });
      }
    }
  });

export type AttendanceCorrectionInput = z.infer<typeof AttendanceCorrectionInputSchema>;

export const AttendanceListQuerySchema = z
  .object({
    search: z.string().trim().optional(),
    employeeId: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
    status: z.enum(AttendanceStatusValues).optional(),
    flag: z.enum(AttendanceFlagValues).optional(),
    date: z.string().regex(DATE_ONLY_REGEX).optional(),
    dateFrom: z.string().regex(DATE_ONLY_REGEX).optional(),
    dateTo: z.string().regex(DATE_ONLY_REGEX).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(AttendanceSortFields).default('attendanceDate'),
    order: z.enum(['asc', 'desc']).default('desc'),
  })
  .superRefine((data, ctx) => {
    if (data.date && (data.dateFrom || data.dateTo)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Query parameter date is mutually exclusive with dateFrom and dateTo',
        path: ['date'],
      });
    }
    if (data.dateFrom && data.dateTo) {
      if (data.dateFrom > data.dateTo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'dateFrom cannot be later than dateTo',
          path: ['dateFrom'],
        });
      } else {
        const from = new Date(data.dateFrom).getTime();
        const to = new Date(data.dateTo).getTime();
        const diffDays = (to - from) / (1000 * 60 * 60 * 24);
        if (diffDays > 366) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Date range cannot exceed 366 days',
            path: ['dateTo'],
          });
        }
      }
    }
  });

export interface AttendanceListQuery {
  search?: string;
  employeeId?: string;
  departmentId?: string;
  status?: AttendanceStatus;
  flag?: AttendanceFlag;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sort?: AttendanceSortField;
  order?: 'asc' | 'desc';
}

export type AttendanceListQueryParsed = z.infer<typeof AttendanceListQuerySchema>;

export interface AttendanceDto {
  id: string;
  employee: {
    id: string;
    employeeNumber: string;
    fullName: string;
  };
  department: {
    id: string;
    name: string;
  } | null;
  manager: {
    id: string;
    fullName: string;
  } | null;
  attendanceDate: string; // YYYY-MM-DD
  checkInAt: string | null;
  checkOutAt: string | null;
  status: AttendanceStatus;
  workedMinutes: number;
  overtimeMinutes: number;
  workingSchedule: {
    id: string;
    name: string;
  };
  expectedStartMinute: number | null;
  expectedEndMinute: number | null;
  expectedBreakMinutes: number;
  expectedMinutes: number;
  flags: AttendanceFlag[];
  manuallyEdited: boolean;
  lastEditedBy: {
    id: string;
    email: string;
  } | null;
  lastEditedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceDetailDto extends AttendanceDto {
  lastEditReason: string | null;
}

export interface AttendanceListResponse {
  items: AttendanceDto[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AttendanceTodayDto {
  businessDate: string; // YYYY-MM-DD
  serverNow: string; // ISO 8601 UTC
  state: AttendanceTodayState;
  attendance: AttendanceDto | null;
  elapsedMinutes: number;
}
