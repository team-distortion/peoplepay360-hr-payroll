import { z } from 'zod';
import { RecordStatusValues, type RecordStatus } from './employees.js';

export const SalaryRuleCategoryValues = [
  'BASIC',
  'ALLOWANCE',
  'OVERTIME',
  'GROSS',
  'DEDUCTION',
  'CONTRIBUTION',
  'NET',
] as const;
export type SalaryRuleCategory = (typeof SalaryRuleCategoryValues)[number];

export const SalaryRuleMethodValues = ['FIXED', 'PERCENTAGE', 'FORMULA'] as const;
export type SalaryRuleMethod = (typeof SalaryRuleMethodValues)[number];

export const SalaryFormulaBuiltinValues = [
  'WAGE',
  'PRORATED_BASIC',
  'WORKED_DAYS',
  'EXPECTED_DAYS',
  'WORKED_HOURS',
  'EXPECTED_HOURS',
  'OVERTIME_HOURS',
] as const;
export type SalaryFormulaBuiltin = (typeof SalaryFormulaBuiltinValues)[number];

// Normalization helper
export function normalizeStructureNameKey(name: string): string {
  return name.trim().toLowerCase();
}

// Decimal regex patterns matching PRD & Section 6
// Max 16 integral digits, max 2 decimal digits: ^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$
export const FIXED_AMOUNT_REGEX = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/;
// Max 4 fractional digits, range 0 to 1000 inclusive
export const PERCENTAGE_RATE_REGEX = /^(?:0|[1-9]\d{0,2}|1000)(?:\.\d{1,4})?$/;
export const RULE_CODE_REGEX = /^[A-Z][A-Z0-9_]{0,39}$/;

// ── Salary Structure Types & Schemas ───────────────────────────

export interface SalaryStructureInput {
  name: string;
  description: string | null;
  status: RecordStatus;
}

export const SalaryStructureInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Structure name must be at least 2 characters')
    .max(100, 'Structure name must not exceed 100 characters'),
  description: z
    .string()
    .trim()
    .max(500, 'Description must not exceed 500 characters')
    .nullable()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
  status: z.enum(RecordStatusValues).default('ACTIVE'),
});

export const SalaryStructureStatusInputSchema = z.object({
  status: z.enum(RecordStatusValues),
});

export interface SalaryStructureListItemDto {
  id: string;
  name: string;
  description: string | null;
  status: RecordStatus;
  activeRuleCount: number;
  totalRuleCount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryRuleDto {
  id: string;
  salaryStructureId: string;
  name: string;
  code: string;
  category: SalaryRuleCategory;
  sequence: number;
  method: SalaryRuleMethod;
  fixedAmount: string | null;
  percentageRate: string | null;
  percentageBase: string | null;
  formula: string | null;
  status: RecordStatus;
  salaryStructure: {
    id: string;
    name: string;
  };
  referencedIdentifiers: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SalaryStructureDetailDto extends SalaryStructureListItemDto {
  rules: SalaryRuleDto[];
}

export interface SalaryStructureListQuery {
  search?: string;
  status?: RecordStatus;
  page?: number;
  pageSize?: number;
}

export interface SalaryStructureListResponse {
  items: SalaryStructureListItemDto[];
  pagination: {
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

// ── Salary Rule Types & Schemas ────────────────────────────────

export interface SalaryRuleInput {
  name: string;
  code: string;
  category: SalaryRuleCategory;
  sequence: number;
  method: SalaryRuleMethod;
  fixedAmount: string | null;
  percentageRate: string | null;
  percentageBase: string | null;
  formula: string | null;
  status: RecordStatus;
}

function normalizeNullableString(val: unknown): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const SalaryRuleInputSchema: z.ZodType<SalaryRuleInput, z.ZodTypeDef, any> = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Rule name must be at least 2 characters')
      .max(100, 'Rule name must not exceed 100 characters'),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(
        RULE_CODE_REGEX,
        'Code must start with an uppercase letter and contain only uppercase letters, numbers, and underscores (max 40 chars)'
      ),
    category: z.enum(SalaryRuleCategoryValues),
    sequence: z
      .number()
      .int('Sequence must be an integer')
      .min(1, 'Sequence must be at least 1')
      .max(1_000_000, 'Sequence cannot exceed 1,000,000'),
    method: z.enum(SalaryRuleMethodValues),
    fixedAmount: z.preprocess(normalizeNullableString, z.string().nullable().default(null)),
    percentageRate: z.preprocess(normalizeNullableString, z.string().nullable().default(null)),
    percentageBase: z.preprocess(normalizeNullableString, z.string().nullable().default(null)),
    formula: z.preprocess(normalizeNullableString, z.string().nullable().default(null)),
    status: z.enum(RecordStatusValues).default('ACTIVE'),
  })
  .superRefine((data, ctx) => {
    const fixedAmount = data.fixedAmount ?? null;
    const percentageRate = data.percentageRate ?? null;
    const percentageBase = data.percentageBase ?? null;
    const formula = data.formula ?? null;

    if (data.method === 'FIXED') {
      if (!fixedAmount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fixedAmount'],
          message: 'Fixed amount is required for FIXED method',
        });
      } else if (!FIXED_AMOUNT_REGEX.test(fixedAmount)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fixedAmount'],
          message:
            'Fixed amount must be a valid non-negative decimal with at most 2 decimal places and 16 integer digits',
        });
      }

      if (percentageRate !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['percentageRate'],
          message: 'Percentage rate must be null for FIXED method',
        });
      }
      if (percentageBase !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['percentageBase'],
          message: 'Percentage base must be null for FIXED method',
        });
      }
      if (formula !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['formula'],
          message: 'Formula must be null for FIXED method',
        });
      }
    } else if (data.method === 'PERCENTAGE') {
      if (!percentageRate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['percentageRate'],
          message: 'Percentage rate is required for PERCENTAGE method',
        });
      } else if (!PERCENTAGE_RATE_REGEX.test(percentageRate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['percentageRate'],
          message:
            'Percentage rate must be a valid decimal between 0 and 1000 with at most 4 decimal places',
        });
      } else {
        const num = parseFloat(percentageRate);
        if (isNaN(num) || num < 0 || num > 1000) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['percentageRate'],
            message: 'Percentage rate must be between 0 and 1000 inclusive',
          });
        }
      }

      if (!percentageBase) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['percentageBase'],
          message: 'Percentage base is required for PERCENTAGE method',
        });
      } else if (!RULE_CODE_REGEX.test(percentageBase)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['percentageBase'],
          message: 'Percentage base must be a valid identifier code',
        });
      }

      if (fixedAmount !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fixedAmount'],
          message: 'Fixed amount must be null for PERCENTAGE method',
        });
      }
      if (formula !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['formula'],
          message: 'Formula must be null for PERCENTAGE method',
        });
      }
    } else if (data.method === 'FORMULA') {
      if (!formula) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['formula'],
          message: 'Formula is required for FORMULA method',
        });
      } else if (formula.length > 1000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['formula'],
          message: 'Formula cannot exceed 1000 characters',
        });
      }

      if (fixedAmount !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fixedAmount'],
          message: 'Fixed amount must be null for FORMULA method',
        });
      }
      if (percentageRate !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['percentageRate'],
          message: 'Percentage rate must be null for FORMULA method',
        });
      }
      if (percentageBase !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['percentageBase'],
          message: 'Percentage base must be null for FORMULA method',
        });
      }
    }
  })
  .transform((data): SalaryRuleInput => ({
    name: data.name,
    code: data.code,
    category: data.category,
    sequence: data.sequence,
    method: data.method,
    fixedAmount: data.fixedAmount ?? null,
    percentageRate: data.percentageRate ?? null,
    percentageBase: data.percentageBase ?? null,
    formula: data.formula ?? null,
    status: data.status,
  }));

export const SalaryRuleStatusInputSchema = z.object({
  status: z.enum(RecordStatusValues),
});

export interface SalaryRuleConfigurationInput {
  rules: Array<SalaryRuleInput & { id: string | null }>;
}

export const SalaryRuleConfigurationInputSchema: z.ZodType<SalaryRuleConfigurationInput> = z.object({
  rules: z.array(
    z.intersection(
      SalaryRuleInputSchema,
      z.object({
        id: z.string().uuid().nullable(),
      })
    )
  ),
});

export interface SalaryRuleListQuery {
  salaryStructureId?: string;
  search?: string;
  category?: SalaryRuleCategory;
  method?: SalaryRuleMethod;
  status?: RecordStatus;
  page?: number;
  pageSize?: number;
}

export interface SalaryRuleListResponse {
  items: SalaryRuleDto[];
  pagination: {
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}
