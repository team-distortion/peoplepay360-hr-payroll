import { z } from 'zod';
import {
  RecordStatusValues,
  SalaryRuleCategoryValues,
  SalaryRuleMethodValues,
  SalaryStructureInputSchema,
  SalaryStructureStatusInputSchema,
  SalaryRuleInputSchema,
  SalaryRuleStatusInputSchema,
  SalaryRuleConfigurationInputSchema,
} from '@peoplepay360/shared';

export {
  SalaryStructureInputSchema,
  SalaryStructureStatusInputSchema,
  SalaryRuleInputSchema,
  SalaryRuleStatusInputSchema,
  SalaryRuleConfigurationInputSchema,
};

export const StructureIdParamSchema = z.object({
  id: z.string().uuid('Structure ID must be a valid UUID'),
});

export const RuleIdParamSchema = z.object({
  id: z.string().uuid('Rule ID must be a valid UUID'),
});

export const StructureRuleParamsSchema = z.object({
  structureId: z.string().uuid('Structure ID must be a valid UUID'),
});

export const ListStructuresQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(RecordStatusValues).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const GetStructureQuerySchema = z.object({
  includeInactiveRules: z
    .preprocess((val) => {
      if (typeof val === 'string') {
        return val.toLowerCase() !== 'false';
      }
      return val ?? true;
    }, z.boolean())
    .default(true),
});

export const ListRulesQuerySchema = z.object({
  salaryStructureId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
  category: z.enum(SalaryRuleCategoryValues).optional(),
  method: z.enum(SalaryRuleMethodValues).optional(),
  status: z.enum(RecordStatusValues).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
