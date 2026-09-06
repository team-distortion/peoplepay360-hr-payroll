import { z } from 'zod';
import {
  PayrunEligibilityInputSchema,
  CreatePayrunInputSchema,
  WarningAcknowledgementInputSchema,
  ListPayrunsQuerySchema,
  ListPayslipsQuerySchema,
} from '@peoplepay360/shared';

export {
  PayrunEligibilityInputSchema,
  CreatePayrunInputSchema,
  WarningAcknowledgementInputSchema,
  ListPayrunsQuerySchema,
  ListPayslipsQuerySchema,
};

export const PayrunIdParamSchema = z.object({
  id: z.string().uuid('Payrun ID must be a valid UUID'),
});

export const PayslipIdParamSchema = z.object({
  id: z.string().uuid('Payslip ID must be a valid UUID'),
});

export const WarningIdParamSchema = z.object({
  id: z.string().uuid('Warning ID must be a valid UUID'),
});

export const GetPdfQuerySchema = z.object({
  download: z
    .preprocess((val) => {
      if (typeof val === 'string') return val.toLowerCase() === 'true';
      return !!val;
    }, z.boolean())
    .optional(),
});
