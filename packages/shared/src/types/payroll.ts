import { z } from 'zod';
import { EmployeeTypeValues, type EmployeeType, DATE_REGEX } from './employees.js';
import { SalaryRuleCategoryValues, SalaryRuleMethodValues, type SalaryRuleCategory, type SalaryRuleMethod } from './salary-config.js';
import { AttendanceStatusValues, type AttendanceStatus } from './attendance.js';

export const PayrollStatusValues = ['DRAFT', 'COMPUTED', 'VALIDATED', 'PAID'] as const;
export type PayrollStatus = (typeof PayrollStatusValues)[number];

export const PayrollWarningStatusValues = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'] as const;
export type PayrollWarningStatus = (typeof PayrollWarningStatusValues)[number];

export const PayrollWarningTypeValues = [
  'MISSING_ATTENDANCE',
  'OPEN_ATTENDANCE_RECORD',
  'ATTENDANCE_TIME_OFF_CONFLICT',
  'ATTENDANCE_SCHEDULE_MISMATCH',
  'MISSING_BANK_DETAILS',
] as const;
export type PayrollWarningType = (typeof PayrollWarningTypeValues)[number];

export const IneligibilityReasonValues = [
  'EMPLOYEE_INACTIVE',
  'NO_APPLICABLE_CONTRACT',
  'MULTIPLE_APPLICABLE_CONTRACTS',
  'SALARY_STRUCTURE_MISMATCH',
  'WORKING_SCHEDULE_MISSING',
  'SALARY_STRUCTURE_INACTIVE',
  'SALARY_STRUCTURE_INVALID',
  'DUPLICATE_PAYSLIP',
] as const;
export type IneligibilityReason = (typeof IneligibilityReasonValues)[number];

// ── Validation Schemas ───────────────────────────────────────────

export const PayrunEligibilityInputSchema = z.object({
  salaryStructureId: z.string().uuid('Structure ID must be a valid UUID'),
  periodStart: z.string().regex(DATE_REGEX, 'periodStart must be YYYY-MM-DD'),
  periodEnd: z.string().regex(DATE_REGEX, 'periodEnd must be YYYY-MM-DD'),
  search: z.string().trim().max(100).optional(),
  departmentId: z.string().uuid().optional(),
  employeeType: z.enum(EmployeeTypeValues).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
});
export type PayrunEligibilityInput = z.infer<typeof PayrunEligibilityInputSchema>;

export const CreatePayrunInputSchema = z.object({
  salaryStructureId: z.string().uuid('Structure ID must be a valid UUID'),
  periodStart: z.string().regex(DATE_REGEX, 'periodStart must be YYYY-MM-DD'),
  periodEnd: z.string().regex(DATE_REGEX, 'periodEnd must be YYYY-MM-DD'),
  employeeIds: z
    .array(z.string().uuid('Employee ID must be a valid UUID'))
    .min(1, 'At least one employee must be selected')
    .max(500, 'Cannot exceed 500 employees per payrun')
    .refine((items) => new Set(items).size === items.length, {
      message: 'employeeIds cannot contain duplicates',
    }),
});
export type CreatePayrunInput = z.infer<typeof CreatePayrunInputSchema>;

export const WarningAcknowledgementInputSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'Acknowledgement reason must be at least 5 characters')
    .max(500, 'Acknowledgement reason cannot exceed 500 characters'),
});
export type WarningAcknowledgementInput = z.infer<typeof WarningAcknowledgementInputSchema>;

export const ListPayrunsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  salaryStructureId: z.string().uuid().optional(),
  status: z.enum(PayrollStatusValues).optional(),
  periodStart: z.string().regex(DATE_REGEX).optional(),
  periodEnd: z.string().regex(DATE_REGEX).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z
    .enum(['payrunNumber', 'periodStart', 'periodEnd', 'status', 'createdAt', 'netTotal'])
    .default('periodStart'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type ListPayrunsQuery = z.infer<typeof ListPayrunsQuerySchema>;

export const ListPayslipsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  payrunId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  department: z.string().trim().max(100).optional(),
  salaryStructureId: z.string().uuid().optional(),
  status: z.enum(PayrollStatusValues).optional(),
  periodStart: z.string().regex(DATE_REGEX).optional(),
  periodEnd: z.string().regex(DATE_REGEX).optional(),
  warningType: z.enum(PayrollWarningTypeValues).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['employee', 'periodStart', 'status', 'grossAmount', 'netAmount']).default('periodStart'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type ListPayslipsQuery = z.infer<typeof ListPayslipsQuerySchema>;

// ── DTOs ──────────────────────────────────────────────────────────

export interface EligibleEmployeeDto {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  employeeType: EmployeeType;
  departmentName: string | null;
  contractId: string;
  contractNumber: string;
  contractStartDate: string;
  contractEndDate: string | null;
  monthlyWage: string;
  effectiveScheduleId: string;
  effectiveScheduleName: string;
  effectiveScheduleWeeklyMinutes: number;
  effectiveScheduleSource: 'CONTRACT' | 'EMPLOYEE';
  eligible: true;
  ineligibilityReasons: [];
}

export interface IneligibleEmployeeDto {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  employeeType: EmployeeType;
  departmentName: string | null;
  contractId: string | null;
  contractNumber: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  monthlyWage: string | null;
  effectiveScheduleId: string | null;
  effectiveScheduleName: string | null;
  effectiveScheduleWeeklyMinutes: number | null;
  effectiveScheduleSource: 'CONTRACT' | 'EMPLOYEE' | null;
  eligible: false;
  ineligibilityReasons: IneligibilityReason[];
}

export type EligibilityEmployeeItemDto = EligibleEmployeeDto | IneligibleEmployeeDto;

export interface PayrunEligibilityResponse {
  periodStart: string;
  periodEnd: string;
  salaryStructureId: string;
  salaryStructureName: string;
  eligibleCount: number;
  ineligibleCount: number;
  items: EligibilityEmployeeItemDto[];
  pagination: {
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface PayrollWarningDto {
  id: string;
  payrunId: string;
  payslipId: string | null;
  type: PayrollWarningType;
  status: PayrollWarningStatus;
  message: string;
  blocking: boolean;
  acknowledgeable: boolean;
  details: Record<string, any> | null;
  acknowledgedByUserId: string | null;
  acknowledgedByUserName?: string | null;
  acknowledgedAt: string | null;
  acknowledgementReason: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface PayslipLineDto {
  id: string;
  payslipId: string;
  salaryRuleId: string;
  name: string;
  code: string;
  category: SalaryRuleCategory;
  sequence: number;
  method: SalaryRuleMethod;
  amount: string; // Decimal string
}

export interface PayslipListItemDto {
  id: string;
  payrunId: string;
  payrunNumber: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  departmentName: string | null;
  periodStart: string;
  periodEnd: string;
  status: PayrollStatus;
  currency: string;
  grossAmount: string | null;
  netAmount: string | null;
  hasWarnings: boolean;
  hasPdf: boolean;
  createdAt: string;
}

export interface PayslipDetailDto {
  id: string;
  payrunId: string;
  payrunNumber: string;
  employeeId: string;
  contractId: string;
  salaryStructureId: string;
  periodStart: string;
  periodEnd: string;
  status: PayrollStatus;
  currency: string;

  // Snapshots
  employeeNumberSnapshot: string | null;
  employeeNameSnapshot: string | null;
  workEmailSnapshot: string | null;
  departmentNameSnapshot: string | null;
  jobPositionSnapshot: string | null;
  contractNumberSnapshot: string | null;
  structureNameSnapshot: string | null;
  scheduleIdSnapshot: string | null;
  scheduleNameSnapshot: string | null;
  bankAccountNameSnapshot: string | null;
  bankAccountMaskSnapshot: string | null;
  bankNameSnapshot: string | null;
  bankIfscSnapshot: string | null;

  // Numbers & Summaries
  monthlyWage: string | null;
  expectedDays: number | null;
  workedDays: number | null;
  expectedMinutes: number | null;
  workedMinutes: number | null;
  overtimeMinutes: number | null;
  proratedBasic: string | null;
  basicAmount: string | null;
  allowanceAmount: string | null;
  overtimeAmount: string | null;
  deductionAmount: string | null;
  contributionAmount: string | null;
  grossAmount: string | null;
  netAmount: string | null;

  computationInputHash: string | null;
  finalPdfSha256: string | null;
  hasFinalPdf: boolean;

  lines: PayslipLineDto[];
  warnings: PayrollWarningDto[];
  createdAt: string;
  updatedAt: string;
}

export interface PayrunListItemDto {
  id: string;
  payrunNumber: string;
  name: string;
  salaryStructureId: string;
  salaryStructureName: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  status: PayrollStatus;
  totalPayslips: number;
  draftPayslips: number;
  computedPayslips: number;
  validatedPayslips: number;
  paidPayslips: number;
  grossTotal: string | null;
  netTotal: string | null;
  openBlockingWarningsCount: number;
  totalWarningsCount: number;
  createdAt: string;
}

export interface PayrunActorSummary {
  id: string;
  name: string;
  email: string;
}

export interface PayrunDetailDto {
  id: string;
  payrunNumber: string;
  name: string;
  salaryStructureId: string;
  salaryStructureName: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  status: PayrollStatus;

  createdByUser: PayrunActorSummary;
  computedByUser: PayrunActorSummary | null;
  computedAt: string | null;
  validatedByUser: PayrunActorSummary | null;
  validatedAt: string | null;
  paidByUser: PayrunActorSummary | null;
  paidAt: string | null;

  totalPayslips: number;
  draftPayslips: number;
  computedPayslips: number;
  validatedPayslips: number;
  paidPayslips: number;
  grossTotal: string | null;
  netTotal: string | null;

  openBlockingWarningsCount: number;
  totalWarningsCount: number;

  payslips: PayslipListItemDto[];
  warnings: PayrollWarningDto[];
  createdAt: string;
  updatedAt: string;
}

export interface PayrunListResponse {
  items: PayrunListItemDto[];
  pagination: {
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface PayslipListResponse {
  items: PayslipListItemDto[];
  pagination: {
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}
