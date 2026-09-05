import type { Role } from '@peoplepay360/shared';
import type { AuthenticatedUser } from '../types/express.js';

export function canAccessEmployee(
  user: AuthenticatedUser,
  targetEmployeeId: string,
  bypassRoles: Role[] = ['HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN']
): boolean {
  if (bypassRoles.includes(user.role as Role)) return true;
  if (user.role === 'EMPLOYEE') {
    return user.employeeId !== null && user.employeeId === targetEmployeeId;
  }
  return false;
}
