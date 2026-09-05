import { z } from 'zod';

export const RoleValues = [
  'EMPLOYEE',
  'HR_MANAGER',
  'HR_PAYROLL_USER',
  'HR_PAYROLL_MANAGER',
  'ADMIN',
] as const;

export type Role = (typeof RoleValues)[number];

export const LoginRequestSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export interface CurrentUser {
  id: string;
  email: string;
  role: Role;
  employeeId: string | null;
}
