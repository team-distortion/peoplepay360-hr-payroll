import type {
  Employee,
  Department,
  WorkingSchedule,
  WorkingScheduleDay,
  User,
} from '@prisma/client';
import type {
  EmployeeDetailDto,
  EmployeeListItemDto,
} from '@peoplepay360/shared';
import {
  formatEmployeeFullName,
  formatEmployeeInitials,
} from '@peoplepay360/shared';
import { env } from '../../config/env.js';

export interface WorkingScheduleWithDays extends WorkingSchedule {
  days?: WorkingScheduleDay[];
}

export interface EmployeeWithRelations extends Employee {
  department?: Department | null;
  manager?: Employee | null;
  workingSchedule?: WorkingScheduleWithDays | null;
  user?: User | null;
}

export function computeScheduleWeeklyMinutes(days?: WorkingScheduleDay[]): number {
  if (!days || days.length === 0) return 0;
  return days.reduce((total, day) => {
    const overnight = day.endMinute < day.startMinute;
    const intervalDuration = overnight
      ? 1440 - day.startMinute + day.endMinute
      : day.endMinute - day.startMinute;
    const net = Math.max(0, intervalDuration - day.breakMinutes);
    return total + net;
  }, 0);
}

export function toEmployeeListItemDto(employee: EmployeeWithRelations): EmployeeListItemDto {
  return {
    id: employee.id,
    employeeNumber: employee.employeeNumber,
    firstName: employee.firstName,
    lastName: employee.lastName,
    fullName: formatEmployeeFullName(employee.firstName, employee.lastName),
    initials: formatEmployeeInitials(employee.firstName, employee.lastName),
    workEmail: employee.workEmail,
    jobPosition: employee.jobPosition,
    employeeType: employee.employeeType,
    status: employee.status,
    workLocation: employee.workLocation ?? null,
    department: employee.department
      ? {
          id: employee.department.id,
          name: employee.department.name,
        }
      : null,
    manager: employee.manager
      ? {
          id: employee.manager.id,
          fullName: formatEmployeeFullName(
            employee.manager.firstName,
            employee.manager.lastName
          ),
        }
      : null,
    workingSchedule: employee.workingSchedule
      ? {
          id: employee.workingSchedule.id,
          name: employee.workingSchedule.name,
          weeklyMinutes: computeScheduleWeeklyMinutes(employee.workingSchedule.days),
        }
      : null,
  };
}

export function toEmployeeDetailDto(
  employee: EmployeeWithRelations,
  contractCount?: number,
  attendanceCount?: number,
  timeOffRequestCount?: number,
  timeOffAllocationCount?: number
): EmployeeDetailDto {
  const listItem = toEmployeeListItemDto(employee);

  return {
    ...listItem,
    workPhone: employee.workPhone ?? null,
    personalEmail: employee.personalEmail ?? null,
    personalPhone: employee.personalPhone ?? null,
    dateOfBirth: employee.dateOfBirth
      ? employee.dateOfBirth.toISOString().split('T')[0]
      : null,
    personalAddress: employee.personalAddress ?? null,
    emergencyContactName: employee.emergencyContactName ?? null,
    emergencyContactPhone: employee.emergencyContactPhone ?? null,
    bankAccountName: employee.bankAccountName ?? null,
    bankAccountNumber: employee.bankAccountNumber ?? null,
    bankName: employee.bankName ?? null,
    bankIfsc: employee.bankIfsc ?? null,
    companyName: env.COMPANY_NAME,
    user: employee.user
      ? {
          id: employee.user.id,
          email: employee.user.email,
          role: employee.user.role,
          isActive: employee.user.isActive,
        }
      : null,
    contractCount: contractCount ?? (employee as any)._count?.contracts ?? 0,
    attendanceCount: attendanceCount ?? (employee as any)._count?.attendances ?? 0,
    timeOffRequestCount: timeOffRequestCount ?? (employee as any)._count?.timeOffRequests ?? 0,
    timeOffAllocationCount: timeOffAllocationCount ?? (employee as any)._count?.timeOffAllocations ?? 0,
    createdAt: employee.createdAt.toISOString(),
    updatedAt: employee.updatedAt.toISOString(),
  };
}
