import { z } from 'zod';
import type { RecordStatus } from './employees.js';
import { DATE_REGEX } from './employees.js';

export const TimeOffUnitValues = ['DAY', 'HOUR'] as const;
export type TimeOffUnit = (typeof TimeOffUnitValues)[number];

export const TimeOffApprovalModeValues = ['NO_APPROVAL', 'HR_APPROVAL'] as const;
export type TimeOffApprovalMode = (typeof TimeOffApprovalModeValues)[number];

export const TimeOffPayrollTreatmentValues = ['PAID', 'UNPAID'] as const;
export type TimeOffPayrollTreatment = (typeof TimeOffPayrollTreatmentValues)[number];

export const TimeOffDecisionStatusValues = ['PENDING', 'APPROVED', 'REFUSED'] as const;
export type TimeOffDecisionStatus = (typeof TimeOffDecisionStatusValues)[number];

export const TimeOffRequestStatusValues = ['PENDING', 'APPROVED', 'REFUSED'] as const;
export type TimeOffRequestStatus = (typeof TimeOffRequestStatusValues)[number];

export const AllocationStatusValues = ['PENDING', 'APPROVED', 'REFUSED', 'EXPIRED'] as const;
export type AllocationStatus = (typeof AllocationStatusValues)[number];

export const TimeOffSortFieldValues = [
  'employee',
  'type',
  'startDate',
  'endDate',
  'requestedUnits',
  'status',
  'createdAt',
] as const;
export type TimeOffSortField = (typeof TimeOffSortFieldValues)[number];

export const AllocationSortFieldValues = [
  'employee',
  'type',
  'allocatedUnits',
  'remainingUnits',
  'validFrom',
  'validTo',
  'status',
  'createdAt',
] as const;
export type AllocationSortField = (typeof AllocationSortFieldValues)[number];

// Helper to validate calendar date
export function isValidCalendarDate(dateStr: string): boolean {
  if (!DATE_REGEX.test(dateStr)) return false;
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

// Decimal string validation regex (positive, up to 4 decimal places)
export const DECIMAL_STRING_REGEX = /^\d+(\.\d{1,4})?$/;

// Input Schemas
export const TimeOffTypeInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Name is required')
      .max(100, 'Name cannot exceed 100 characters'),
    description: z
      .string()
      .trim()
      .max(1000, 'Description cannot exceed 1000 characters')
      .nullable()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    unit: z.enum(TimeOffUnitValues, {
      errorMap: () => ({ message: 'Unit must be DAY or HOUR' }),
    }),
    requiresAllocation: z.boolean().default(true),
    approvalMode: z
      .enum(TimeOffApprovalModeValues, {
        errorMap: () => ({ message: 'Approval mode must be NO_APPROVAL or HR_APPROVAL' }),
      })
      .default('HR_APPROVAL'),
    payrollTreatment: z
      .enum(TimeOffPayrollTreatmentValues, {
        errorMap: () => ({ message: 'Payroll treatment must be PAID or UNPAID' }),
      })
      .default('PAID'),
    status: z
      .enum(['ACTIVE', 'INACTIVE'] as const, {
        errorMap: () => ({ message: 'Status must be ACTIVE or INACTIVE' }),
      })
      .default('ACTIVE'),
  })
  .strict();

export type TimeOffTypeInput = z.infer<typeof TimeOffTypeInputSchema>;

export const AllocationInputSchema = z
  .object({
    employeeId: z.string().uuid('Invalid employee ID'),
    timeOffTypeId: z.string().uuid('Invalid time off type ID'),
    allocatedUnits: z
      .string()
      .trim()
      .regex(DECIMAL_STRING_REGEX, 'Allocated units must be a valid positive decimal string')
      .refine((v) => parseFloat(v) > 0, 'Allocated units must be greater than zero'),
    validFrom: z
      .string()
      .refine(isValidCalendarDate, 'validFrom must be a valid YYYY-MM-DD date'),
    validTo: z
      .string()
      .refine(isValidCalendarDate, 'validTo must be a valid YYYY-MM-DD date'),
    description: z
      .string()
      .trim()
      .max(1000, 'Description cannot exceed 1000 characters')
      .nullable()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
  })
  .strict()
  .refine((data) => data.validTo >= data.validFrom, {
    message: 'validTo cannot be earlier than validFrom',
    path: ['validTo'],
  });

export type AllocationInput = z.infer<typeof AllocationInputSchema>;

export const TimeOffRequestInputSchema = z
  .object({
    employeeId: z.string().uuid('Invalid employee ID').optional(),
    timeOffTypeId: z.string().uuid('Invalid time off type ID'),
    allocationId: z.string().uuid('Invalid allocation ID').nullable().optional(),
    startDate: z
      .string()
      .refine(isValidCalendarDate, 'startDate must be a valid YYYY-MM-DD date'),
    endDate: z
      .string()
      .refine(isValidCalendarDate, 'endDate must be a valid YYYY-MM-DD date'),
    startMinute: z
      .number()
      .int()
      .min(0, 'startMinute must be between 0 and 1439')
      .max(1439, 'startMinute must be between 0 and 1439')
      .nullable()
      .optional(),
    endMinute: z
      .number()
      .int()
      .min(0, 'endMinute must be between 0 and 1439')
      .max(1439, 'endMinute must be between 0 and 1439')
      .nullable()
      .optional(),
    reason: z
      .string()
      .trim()
      .min(5, 'Reason must be at least 5 characters')
      .max(1000, 'Reason cannot exceed 1000 characters'),
  })
  .strict()
  .refine((data) => data.endDate >= data.startDate, {
    message: 'endDate cannot be earlier than startDate',
    path: ['endDate'],
  });

export type TimeOffRequestInput = z.infer<typeof TimeOffRequestInputSchema>;

export const DecisionInputSchema = z
  .object({
    note: z
      .string()
      .trim()
      .max(500, 'Decision note cannot exceed 500 characters')
      .nullable()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
  })
  .strict();

export type DecisionInput = z.infer<typeof DecisionInputSchema>;

// DTOs
export interface TimeOffTypeSummaryDto {
  id: string;
  name: string;
  unit: TimeOffUnit;
  requiresAllocation: boolean;
  approvalMode: TimeOffApprovalMode;
  payrollTreatment: TimeOffPayrollTreatment;
  status: RecordStatus;
}

export interface TimeOffTypeListItemDto extends TimeOffTypeSummaryDto {
  description: string | null;
  activeAllocationsCount: number;
  activeRequestsCount: number;
  createdAt: string;
  updatedAt: string;
}

export type TimeOffTypeDetailDto = TimeOffTypeListItemDto;

export interface AllocationEmployeeSummaryDto {
  id: string;
  employeeNumber: string;
  fullName: string;
  departmentName?: string | null;
}

export interface AllocationTypeSummaryDto {
  id: string;
  name: string;
  unit: TimeOffUnit;
}

export interface AllocationListItemDto {
  id: string;
  employee: AllocationEmployeeSummaryDto;
  timeOffType: AllocationTypeSummaryDto;
  unitSnapshot: TimeOffUnit;
  allocatedUnits: string;
  consumedUnits: string;
  remainingUnits: string;
  validFrom: string;
  validTo: string;
  status: AllocationStatus;
  isCurrentlyUsable: boolean;
  description: string | null;
  decidedBy: { id: string; email: string } | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AllocationDetailDto extends AllocationListItemDto {
  createdBy: { id: string; email: string };
}

export interface TimeOffRequestListItemDto {
  id: string;
  employee: AllocationEmployeeSummaryDto;
  timeOffType: AllocationTypeSummaryDto;
  allocation: {
    id: string;
    description: string | null;
    remainingUnits: string;
    validFrom: string;
    validTo: string;
  } | null;
  unitSnapshot: TimeOffUnit;
  requiresAllocationSnapshot: boolean;
  payrollTreatmentSnapshot: TimeOffPayrollTreatment;
  startDate: string;
  endDate: string;
  startMinute: number | null;
  endMinute: number | null;
  requestedUnits: string;
  reason: string;
  status: TimeOffRequestStatus;
  decidedBy: { id: string; email: string } | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimeOffRequestDetailDto extends TimeOffRequestListItemDto {
  createdBy: { id: string; email: string };
}

export interface TimeOffSummaryBalanceDto {
  timeOffTypeId: string;
  timeOffTypeName: string;
  unit: TimeOffUnit;
  allocatedUnits: string;
  consumedUnits: string;
  remainingUnits: string;
}

export interface TimeOffSummaryDto {
  pendingRequestCount: number;
  approvedRequestCountInCurrentYear: number;
  pendingAllocationCount: number;
  usableAllocationCount: number;
  balancesByType: TimeOffSummaryBalanceDto[];
}
