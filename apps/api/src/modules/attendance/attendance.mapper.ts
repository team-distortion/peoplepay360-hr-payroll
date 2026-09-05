import type {
  Attendance,
  Employee,
  Department,
  WorkingSchedule,
  User,
} from '@prisma/client';
import {
  formatEmployeeFullName,
  type AttendanceDto,
} from '@peoplepay360/shared';
import { deriveAttendanceFlags } from './attendance-calculation.js';

export type AttendanceWithRelations = Attendance & {
  employee: Employee & {
    department: Department | null;
    manager: Employee | null;
  };
  workingSchedule: WorkingSchedule;
  lastEditedByUser: Pick<User, 'id' | 'email'> | null;
};

export function formatDateToYYYYMMDD(date: Date): string {
  // Extract UTC components from Prisma Date object
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toAttendanceDto(
  record: AttendanceWithRelations,
  options?: { omitEditorEmail?: boolean }
): AttendanceDto {
  const flags = deriveAttendanceFlags({
    checkInAt: record.checkInAt,
    checkOutAt: record.checkOutAt,
    overtimeMinutes: record.overtimeMinutes,
    manuallyEdited: record.manuallyEdited,
  });

  let lastEditedBy: { id: string; email: string } | null = null;
  if (record.lastEditedByUser) {
    lastEditedBy = {
      id: record.lastEditedByUser.id,
      email: options?.omitEditorEmail ? '' : record.lastEditedByUser.email,
    };
  }

  return {
    id: record.id,
    employee: {
      id: record.employee.id,
      employeeNumber: record.employee.employeeNumber,
      fullName: formatEmployeeFullName(
        record.employee.firstName,
        record.employee.lastName
      ),
    },
    department: record.employee.department
      ? {
          id: record.employee.department.id,
          name: record.employee.department.name,
        }
      : null,
    manager: record.employee.manager
      ? {
          id: record.employee.manager.id,
          fullName: formatEmployeeFullName(
            record.employee.manager.firstName,
            record.employee.manager.lastName
          ),
        }
      : null,
    attendanceDate: formatDateToYYYYMMDD(record.attendanceDate),
    checkInAt: record.checkInAt ? record.checkInAt.toISOString() : null,
    checkOutAt: record.checkOutAt ? record.checkOutAt.toISOString() : null,
    status: record.status,
    workedMinutes: record.workedMinutes,
    overtimeMinutes: record.overtimeMinutes,
    workingSchedule: {
      id: record.workingSchedule.id,
      name: record.workingSchedule.name,
    },
    expectedStartMinute: record.expectedStartMinute,
    expectedEndMinute: record.expectedEndMinute,
    expectedBreakMinutes: record.expectedBreakMinutes,
    expectedMinutes: record.expectedMinutes,
    flags,
    manuallyEdited: record.manuallyEdited,
    lastEditedBy,
    lastEditedAt: record.lastEditedAt ? record.lastEditedAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
