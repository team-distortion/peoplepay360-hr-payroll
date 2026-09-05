import { z } from 'zod';
import { DATE_REGEX, type RecordStatus } from './employees.js';
import type { WorkingScheduleType } from './schedules.js';

export const ContractStatusValues = ['RUNNING', 'EXPIRED'] as const;
export type ContractStatus = (typeof ContractStatusValues)[number];

export const EffectiveScheduleSourceValues = ['CONTRACT', 'EMPLOYEE', 'MISSING'] as const;
export type EffectiveScheduleSource = (typeof EffectiveScheduleSourceValues)[number];

export const CONTRACT_SORT_FIELDS = [
  'contractNumber',
  'employee',
  'startDate',
  'endDate',
  'monthlyWage',
  'status',
] as const;
export type ContractSortField = (typeof CONTRACT_SORT_FIELDS)[number];

// Non-negative decimal: up to 16 integer digits and up to 2 decimal places
export const MONTHLY_WAGE_REGEX = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/;

export function isValidDateOnlyString(dateStr: string): boolean {
  if (!DATE_REGEX.test(dateStr)) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (month < 1 || month > 12) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth;
}

export interface ContractInput {
  employeeId: string;
  departmentId: string;
  workingScheduleId: string | null;
  salaryStructureId: string;
  jobPosition: string;
  startDate: string;
  endDate: string | null;
  monthlyWage: string;
  notes: string | null;
}

export const ContractInputSchema = z
  .object({
    employeeId: z.string().uuid('Valid employee ID is required'),
    departmentId: z.string().uuid('Valid department ID is required'),
    workingScheduleId: z.string().uuid('Valid schedule ID').nullable().optional().transform((v) => v || null),
    salaryStructureId: z.string().uuid('Valid salary structure ID is required'),
    jobPosition: z
      .string()
      .trim()
      .min(2, 'Job position must be at least 2 characters')
      .max(100, 'Job position must not exceed 100 characters'),
    startDate: z
      .string()
      .regex(DATE_REGEX, 'Start date must be in YYYY-MM-DD format')
      .refine(isValidDateOnlyString, { message: 'Start date must be a valid calendar date' }),
    endDate: z
      .string()
      .regex(DATE_REGEX, 'End date must be in YYYY-MM-DD format')
      .refine(isValidDateOnlyString, { message: 'End date must be a valid calendar date' })
      .nullable()
      .optional()
      .transform((v) => (v && v.trim().length > 0 ? v : null)),
    monthlyWage: z
      .string()
      .regex(
        MONTHLY_WAGE_REGEX,
        'Monthly wage must be a non-negative decimal string (up to 16 digits and 2 decimal places)'
      ),
    notes: z
      .string()
      .trim()
      .max(1000, 'Notes must not exceed 1000 characters')
      .nullable()
      .optional()
      .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
  })
  .refine(
    (data) => {
      if (!data.endDate) return true;
      return data.endDate >= data.startDate;
    },
    {
      message: 'End date cannot be earlier than start date',
      path: ['endDate'],
    }
  );

export interface ContractListItemDto {
  id: string;
  contractNumber: string;
  employee: {
    id: string;
    employeeNumber: string;
    fullName: string;
  };
  department: {
    id: string;
    name: string;
  };
  startDate: string;
  endDate: string | null;
  monthlyWage: string;
  currency: string;
  jobPosition: string;
  salaryStructure: {
    id: string;
    name: string;
    status: RecordStatus;
  };
  workingSchedule: {
    id: string;
    name: string;
  } | null;
  effectiveScheduleSource: EffectiveScheduleSource;
  effectiveSchedule: {
    id: string;
    name: string;
    type?: WorkingScheduleType;
  } | null;
  status: ContractStatus;
  isEffectiveToday: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContractDetailDto extends ContractListItemDto {
  notes: string | null;
  employeeSuggestions: {
    department: {
      id: string;
      name: string;
    } | null;
    jobPosition: string | null;
    workingSchedule: {
      id: string;
      name: string;
    } | null;
  };
}

export interface ContractListQuery {
  search?: string;
  employeeId?: string;
  departmentId?: string;
  salaryStructureId?: string;
  status?: ContractStatus;
  effectiveOn?: string;
  page?: number;
  pageSize?: number;
  sort?: ContractSortField;
  order?: 'asc' | 'desc';
}

export interface ContractListResponse {
  items: ContractListItemDto[];
  pagination: {
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export const ContractListQuerySchema = z.object({
  search: z.string().trim().optional(),
  employeeId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  salaryStructureId: z.string().uuid().optional(),
  status: z.enum(ContractStatusValues).optional(),
  effectiveOn: z
    .string()
    .regex(DATE_REGEX, 'effectiveOn must be in YYYY-MM-DD format')
    .refine(isValidDateOnlyString, { message: 'effectiveOn must be a valid calendar date' })
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(CONTRACT_SORT_FIELDS).default('startDate'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
