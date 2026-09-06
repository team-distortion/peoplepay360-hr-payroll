import { z } from 'zod';
import {
  TimeOffTypeInputSchema,
  AllocationInputSchema,
  TimeOffRequestInputSchema,
  DecisionInputSchema,
  TimeOffUnitValues,
  TimeOffRequestStatusValues,
  AllocationStatusValues,
  TimeOffPayrollTreatmentValues,
  TimeOffSortFieldValues,
  AllocationSortFieldValues,
} from '@peoplepay360/shared';

import { AppError } from '../../errors/app-error.js';

export {
  TimeOffTypeInputSchema,
  AllocationInputSchema,
  TimeOffRequestInputSchema,
  DecisionInputSchema,
};

export function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown, code = 'INVALID_TIME_OFF_INPUT'): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(400, code, result.error.errors[0]?.message || 'Validation failed', {
      fields: result.error.flatten().fieldErrors,
    });
  }
  return result.data;
}

export const TimeOffIdParamSchema = z.object({
  id: z.string().uuid('ID must be a valid UUID'),
});

export const TimeOffTypeStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE'] as const, {
    errorMap: () => ({ message: 'Status must be ACTIVE or INACTIVE' }),
  }),
});

export const ApproveDecisionSchema = z
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

export const RefuseDecisionSchema = z
  .object({
    note: z
      .string({ required_error: 'Refusal note is required' })
      .trim()
      .min(3, 'Refusal note must be at least 3 characters')
      .max(500, 'Refusal note cannot exceed 500 characters'),
  })
  .strict();

export const TimeOffTypeQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  unit: z.enum(TimeOffUnitValues).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE'] as const).optional(),
  requiresAllocation: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const AllocationQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  employeeId: z.string().uuid().optional(),
  timeOffTypeId: z.string().uuid().optional(),
  status: z.enum(AllocationStatusValues).optional(),
  validOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'validOn must be YYYY-MM-DD')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(AllocationSortFieldValues).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const TimeOffRequestQuerySchema = z.object({
  scope: z.enum(['mine', 'team', 'all']).default('all'),
  search: z.string().trim().max(100).optional(),
  employeeId: z.string().uuid().optional(),
  timeOffTypeId: z.string().uuid().optional(),
  status: z.enum(TimeOffRequestStatusValues).optional(),
  payrollTreatment: z.enum(TimeOffPayrollTreatmentValues).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
    .optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'dateFrom must be YYYY-MM-DD')
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'dateTo must be YYYY-MM-DD')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(TimeOffSortFieldValues).optional(),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export const TimeOffSummaryQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
});
