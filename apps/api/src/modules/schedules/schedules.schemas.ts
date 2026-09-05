import { z } from 'zod';
export {
  WorkingScheduleInputSchema,
  WorkingScheduleStatusSchema,
  WorkingScheduleQuerySchema,
  WorkingScheduleDayInputSchema,
} from '@peoplepay360/shared';

export const ScheduleIdParamSchema = z.object({
  id: z.string().uuid('Schedule ID must be a valid UUID'),
});
