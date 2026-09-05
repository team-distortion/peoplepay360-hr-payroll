import { z } from 'zod';
import { ContractInputSchema, ContractListQuerySchema } from '@peoplepay360/shared';

export { ContractInputSchema, ContractListQuerySchema };

export const ContractIdParamSchema = z.object({
  id: z.string().uuid('Contract ID must be a valid UUID'),
});
