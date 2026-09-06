import { z } from 'zod';
import { EmployeeTypeValues } from '@peoplepay360/shared';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(val: string): boolean {
  if (!DATE_REGEX.test(val)) return false;
  const [y, m, d] = val.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

export const dashboardFiltersSchema = z
  .object({
    periodStart: z
      .string({ required_error: 'periodStart is required' })
      .refine(isValidDateString, { message: 'periodStart must be a valid YYYY-MM-DD date' }),
    periodEnd: z
      .string({ required_error: 'periodEnd is required' })
      .refine(isValidDateString, { message: 'periodEnd must be a valid YYYY-MM-DD date' }),
    departmentId: z.string().uuid().optional(),
    employeeType: z.enum(EmployeeTypeValues).optional(),
  })
  .strict({ message: 'Unknown query parameters are not allowed' })
  .refine((data) => data.periodStart <= data.periodEnd, {
    message: 'periodStart must be less than or equal to periodEnd',
    path: ['periodStart'],
  })
  .refine(
    (data) => {
      const [sy, sm, sd] = data.periodStart.split('-').map(Number);
      const [ey, em, ed] = data.periodEnd.split('-').map(Number);
      const s = Date.UTC(sy, sm - 1, sd);
      const e = Date.UTC(ey, em - 1, ed);
      const diffDays = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
      return diffDays <= 366;
    },
    {
      message: 'Date range cannot exceed 366 days',
      path: ['periodEnd'],
    }
  );

export type DashboardFiltersQuery = z.infer<typeof dashboardFiltersSchema>;
