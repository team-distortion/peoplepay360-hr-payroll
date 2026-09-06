import { z } from 'zod';
import type { Role } from './auth.js';

export const RecordStatusValues = ['ACTIVE', 'INACTIVE'] as const;
export type RecordStatus = (typeof RecordStatusValues)[number];

export const EmployeeTypeValues = [
  'FULL_TIME',
  'PART_TIME',
  'CONTRACT',
  'INTERN',
] as const;
export type EmployeeType = (typeof EmployeeTypeValues)[number];

// Department types
export interface DepartmentInput {
  name: string;
  status: RecordStatus;
}

export interface DepartmentDto {
  id: string;
  name: string;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentQuery {
  search?: string;
  status?: RecordStatus;
}

// Employee types
export interface EmployeeInput {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  workPhone: string | null;
  jobPosition: string;
  employeeType: EmployeeType;
  status: RecordStatus;
  workLocation: string | null;
  departmentId: string | null;
  managerId: string | null;
  workingScheduleId: string | null;
  personalEmail: string | null;
  personalPhone: string | null;
  dateOfBirth: string | null; // YYYY-MM-DD
  personalAddress: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  bankIfsc: string | null;
}

export interface EmployeeListItemDto {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  initials: string;
  workEmail: string;
  jobPosition: string;
  employeeType: EmployeeType;
  status: RecordStatus;
  workLocation: string | null;
  department: { id: string; name: string } | null;
  manager: { id: string; fullName: string } | null;
  workingSchedule: {
    id: string;
    name: string;
    weeklyMinutes: number;
  } | null;
}

export interface EmployeeLinkedUserSummary {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
}

export interface EmployeeDetailDto extends EmployeeListItemDto {
  workPhone: string | null;
  personalEmail: string | null;
  personalPhone: string | null;
  dateOfBirth: string | null;
  personalAddress: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  bankIfsc: string | null;
  companyName: string;
  user: EmployeeLinkedUserSummary | null;
  contractCount?: number;
  attendanceCount?: number;
  timeOffRequestCount?: number;
  timeOffAllocationCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeListQuery {
  search?: string;
  status?: RecordStatus;
  employeeType?: EmployeeType;
  departmentId?: string;
  managerId?: string;
  workingScheduleId?: string;
  sortBy?: 'name' | 'employeeNumber' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface EmployeeListResponse {
  items: EmployeeListItemDto[];
  page: number;
  pageSize: number;
  total: number;
}

export interface EmployeeStatusInput {
  status: RecordStatus;
}

// Pure helper functions
export function normalizeDepartmentNameKey(name: string): string {
  return name.trim().toLowerCase();
}

export function formatEmployeeFullName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

export function formatEmployeeInitials(firstName: string, lastName: string): string {
  const f = firstName.trim().charAt(0);
  const l = lastName.trim().charAt(0);
  return `${f}${l}`.toUpperCase();
}

// Common Regexes
export const EMPLOYEE_NUMBER_REGEX = /^[A-Z0-9][A-Z0-9_-]*$/;
export const PHONE_REGEX = /^[\d\s+\-()]{7,20}$/;
export const BANK_IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const BANK_ACCOUNT_REGEX = /^[A-Za-z0-9]{4,34}$/;
export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Helpers for nullable trimmed strings
const nullableTrimmedString = (min: number, max: number, errorLabel: string) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((val) => {
      if (val === null || val === undefined) return null;
      const trimmed = val.trim();
      return trimmed.length === 0 ? null : trimmed;
    })
    .refine(
      (val) => val === null || (val.length >= min && val.length <= max),
      { message: `${errorLabel} must be between ${min} and ${max} characters` }
    );

const nullablePhone = (errorLabel: string) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((val) => {
      if (val === null || val === undefined) return null;
      const trimmed = val.trim();
      return trimmed.length === 0 ? null : trimmed;
    })
    .refine(
      (val) => val === null || PHONE_REGEX.test(val),
      { message: `${errorLabel} must be 7-20 digits/symbols (+, -, (), spaces)` }
    );

const nullableDateOfBirth = () =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((val) => {
      if (val === null || val === undefined) return null;
      const trimmed = val.trim();
      return trimmed.length === 0 ? null : trimmed;
    })
    .refine(
      (val) => {
        if (val === null) return true;
        if (!DATE_REGEX.test(val)) return false;
        const date = new Date(val);
        if (isNaN(date.getTime())) return false;
        const now = new Date();
        // date must be strictly earlier than current date
        return date < now;
      },
      { message: 'Date of birth must be a valid date in YYYY-MM-DD format earlier than today' }
    );

const nullableEmail = () =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((val) => {
      if (val === null || val === undefined) return null;
      const trimmed = val.trim().toLowerCase();
      return trimmed.length === 0 ? null : trimmed;
    })
    .refine(
      (val) => {
        if (val === null) return true;
        return z.string().email().safeParse(val).success;
      },
      { message: 'Personal email must be a valid email address' }
    );

const nullableIfsc = () =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((val) => {
      if (val === null || val === undefined) return null;
      const trimmed = val.trim().toUpperCase();
      return trimmed.length === 0 ? null : trimmed;
    })
    .refine(
      (val) => val === null || BANK_IFSC_REGEX.test(val),
      { message: 'Bank IFSC must be 11 characters (4 letters, 0, 6 alphanumeric)' }
    );

const nullableAccountNumber = () =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((val) => {
      if (val === null || val === undefined) return null;
      const trimmed = val.trim();
      return trimmed.length === 0 ? null : trimmed;
    })
    .refine(
      (val) => val === null || BANK_ACCOUNT_REGEX.test(val),
      { message: 'Bank account number must be 4-34 alphanumeric characters' }
    );

// Department Schemas
export const DepartmentInputSchema = z.object({
  name: z
    .string({ required_error: 'Department name is required' })
    .trim()
    .min(2, 'Department name must be at least 2 characters')
    .max(100, 'Department name cannot exceed 100 characters'),
  status: z.enum(RecordStatusValues, {
    errorMap: () => ({ message: 'Invalid department status' }),
  }),
});

export const DepartmentQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(RecordStatusValues).optional(),
});

// Employee Schemas
export const EmployeeInputSchema = z
  .object({
    employeeNumber: z
      .string({ required_error: 'Employee number is required' })
      .trim()
      .toUpperCase()
      .min(2, 'Employee number must be at least 2 characters')
      .max(30, 'Employee number cannot exceed 30 characters')
      .regex(
        EMPLOYEE_NUMBER_REGEX,
        'Employee number must start with alphanumeric and contain only uppercase alphanumeric, _, -'
      ),
    firstName: z
      .string({ required_error: 'First name is required' })
      .trim()
      .min(1, 'First name is required')
      .max(80, 'First name cannot exceed 80 characters'),
    lastName: z
      .string({ required_error: 'Last name is required' })
      .trim()
      .min(1, 'Last name is required')
      .max(80, 'Last name cannot exceed 80 characters'),
    workEmail: z
      .string({ required_error: 'Work email is required' })
      .trim()
      .toLowerCase()
      .email('Invalid work email address')
      .max(254, 'Work email cannot exceed 254 characters'),
    workPhone: nullablePhone('Work phone'),
    jobPosition: z
      .string({ required_error: 'Job position is required' })
      .trim()
      .min(2, 'Job position must be at least 2 characters')
      .max(120, 'Job position cannot exceed 120 characters'),
    employeeType: z.enum(EmployeeTypeValues, {
      errorMap: () => ({ message: 'Invalid employee type' }),
    }),
    status: z.enum(RecordStatusValues, {
      errorMap: () => ({ message: 'Invalid status' }),
    }),
    workLocation: nullableTrimmedString(1, 100, 'Work location'),
    departmentId: z
      .union([z.string().uuid('Invalid department ID'), z.literal(''), z.null(), z.undefined()])
      .transform((val) => (val ? val : null)),
    managerId: z
      .union([z.string().uuid('Invalid manager ID'), z.literal(''), z.null(), z.undefined()])
      .transform((val) => (val ? val : null)),
    workingScheduleId: z
      .union([z.string().uuid('Invalid working schedule ID'), z.literal(''), z.null(), z.undefined()])
      .transform((val) => (val ? val : null)),
    personalEmail: nullableEmail(),
    personalPhone: nullablePhone('Personal phone'),
    dateOfBirth: nullableDateOfBirth(),
    personalAddress: nullableTrimmedString(1, 255, 'Personal address'),
    emergencyContactName: nullableTrimmedString(1, 80, 'Emergency contact name'),
    emergencyContactPhone: nullablePhone('Emergency contact phone'),
    bankAccountName: nullableTrimmedString(1, 100, 'Bank account name'),
    bankAccountNumber: nullableAccountNumber(),
    bankName: nullableTrimmedString(1, 100, 'Bank name'),
    bankIfsc: nullableIfsc(),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'ACTIVE') {
      if (!data.departmentId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Department is required for active employee',
          path: ['departmentId'],
        });
      }
      if (!data.workingScheduleId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Working schedule is required for active employee',
          path: ['workingScheduleId'],
        });
      }
    }
  });

export const EmployeeStatusSchema = z.object({
  status: z.enum(RecordStatusValues, {
    errorMap: () => ({ message: 'Invalid status' }),
  }),
});

export const EmployeeQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(RecordStatusValues).optional(),
  employeeType: z.enum(EmployeeTypeValues).optional(),
  departmentId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
  workingScheduleId: z.string().uuid().optional(),
  sortBy: z.enum(['name', 'employeeNumber', 'createdAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
