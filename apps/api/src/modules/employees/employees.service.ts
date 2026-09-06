import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import type {
  EmployeeDetailDto,
  EmployeeInput,
  EmployeeListQuery,
  EmployeeListResponse,
  RecordStatus,
} from '@peoplepay360/shared';
import type { AuthenticatedUser } from '../../types/express.js';
import { Role, Prisma } from '@prisma/client';
import {
  toEmployeeDetailDto,
  toEmployeeListItemDto,
} from './employee-mapper.js';
import { validateManagerCycle } from './manager-cycle.js';

const employeeDetailIncludes = {
  department: true,
  manager: true,
  workingSchedule: {
    include: {
      days: true,
    },
  },
  user: true,
};

const employeeListIncludes = {
  department: true,
  manager: true,
  workingSchedule: {
    include: {
      days: true,
    },
  },
};

export async function listEmployees(
  query: EmployeeListQuery
): Promise<EmployeeListResponse> {
  const where: Prisma.EmployeeWhereInput = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.employeeType) {
    where.employeeType = query.employeeType;
  }

  if (query.departmentId) {
    where.departmentId = query.departmentId;
  }

  if (query.managerId) {
    where.managerId = query.managerId;
  }

  if (query.workingScheduleId) {
    where.workingScheduleId = query.workingScheduleId;
  }

  if (query.search && query.search.trim().length > 0) {
    const term = query.search.trim();
    where.OR = [
      { employeeNumber: { contains: term, mode: 'insensitive' } },
      { workEmail: { contains: term, mode: 'insensitive' } },
      { jobPosition: { contains: term, mode: 'insensitive' } },
      { firstName: { contains: term, mode: 'insensitive' } },
      { lastName: { contains: term, mode: 'insensitive' } },
    ];
  }

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const skip = (page - 1) * pageSize;
  const take = pageSize;

  let orderBy: Prisma.EmployeeOrderByWithRelationInput[];
  const sortOrder = query.sortOrder ?? 'asc';

  if (query.sortBy === 'employeeNumber') {
    orderBy = [{ employeeNumber: sortOrder }, { id: sortOrder }];
  } else if (query.sortBy === 'createdAt') {
    orderBy = [{ createdAt: sortOrder }, { id: sortOrder }];
  } else {
    // Default: name (lastName, firstName)
    orderBy = [{ lastName: sortOrder }, { firstName: sortOrder }, { id: sortOrder }];
  }

  const [total, items] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      include: employeeListIncludes,
      orderBy,
      skip,
      take,
    }),
  ]);

  return {
    items: items.map(toEmployeeListItemDto),
    page,
    pageSize,
    total,
  };
}

export async function getEmployeeById(
  id: string,
  requestingUser: AuthenticatedUser
): Promise<EmployeeDetailDto> {
  // Authorization: Employee role can only read their own record
  if (requestingUser.role === Role.EMPLOYEE) {
    if (requestingUser.employeeId !== id) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'You do not have permission to view this employee profile'
      );
    }
  }

  const [
    employee,
    contractCount,
    attendanceCount,
    timeOffRequestCount,
    timeOffAllocationCount,
  ] = await Promise.all([
    prisma.employee.findUnique({
      where: { id },
      include: employeeDetailIncludes,
    }),
    prisma.contract.count({ where: { employeeId: id } }),
    prisma.attendance.count({ where: { employeeId: id } }),
    prisma.timeOffRequest.count({ where: { employeeId: id } }),
    prisma.timeOffAllocation.count({ where: { employeeId: id } }),
  ]);

  if (!employee) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
  }

  return toEmployeeDetailDto(
    employee,
    contractCount,
    attendanceCount,
    timeOffRequestCount,
    timeOffAllocationCount
  );
}

export async function getCurrentEmployee(
  requestingUser: AuthenticatedUser
): Promise<EmployeeDetailDto> {
  if (!requestingUser.employeeId) {
    throw new AppError(
      403,
      'EMPLOYEE_PROFILE_NOT_LINKED',
      'Your user account is not linked to an employee profile'
    );
  }

  const [
    employee,
    contractCount,
    attendanceCount,
    timeOffRequestCount,
    timeOffAllocationCount,
  ] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: requestingUser.employeeId },
      include: employeeDetailIncludes,
    }),
    prisma.contract.count({ where: { employeeId: requestingUser.employeeId } }),
    prisma.attendance.count({ where: { employeeId: requestingUser.employeeId } }),
    prisma.timeOffRequest.count({ where: { employeeId: requestingUser.employeeId } }),
    prisma.timeOffAllocation.count({ where: { employeeId: requestingUser.employeeId } }),
  ]);

  if (!employee) {
    throw new AppError(
      404,
      'EMPLOYEE_NOT_FOUND',
      'Linked employee profile not found'
    );
  }

  return toEmployeeDetailDto(
    employee,
    contractCount,
    attendanceCount,
    timeOffRequestCount,
    timeOffAllocationCount
  );
}

export async function createEmployee(
  input: EmployeeInput
): Promise<EmployeeDetailDto> {
  const employeeNumber = input.employeeNumber.trim().toUpperCase();
  const workEmail = input.workEmail.trim().toLowerCase();

  // Check unique employeeNumber
  const existingNumber = await prisma.employee.findUnique({
    where: { employeeNumber },
  });
  if (existingNumber) {
    throw new AppError(
      409,
      'EMPLOYEE_NUMBER_EXISTS',
      'An employee with this employee number already exists'
    );
  }

  // Check unique workEmail
  const existingEmail = await prisma.employee.findUnique({
    where: { workEmail },
  });
  if (existingEmail) {
    throw new AppError(
      409,
      'EMPLOYEE_EMAIL_EXISTS',
      'An employee with this work email already exists'
    );
  }

  // Active employee must have department and working schedule
  if (input.status === 'ACTIVE') {
    if (!input.departmentId) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Department is required for active employee'
      );
    }
    if (!input.workingScheduleId) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Working schedule is required for active employee'
      );
    }
  }

  // Validate referenced Department
  if (input.departmentId) {
    const dept = await prisma.department.findUnique({
      where: { id: input.departmentId },
    });
    if (!dept) {
      throw new AppError(404, 'DEPARTMENT_NOT_FOUND', 'Department not found');
    }
    if (input.status === 'ACTIVE' && dept.status === 'INACTIVE') {
      throw new AppError(
        409,
        'INACTIVE_DEPARTMENT',
        'Cannot assign an inactive department to an active employee'
      );
    }
  }

  // Validate referenced Working Schedule
  if (input.workingScheduleId) {
    const sched = await prisma.workingSchedule.findUnique({
      where: { id: input.workingScheduleId },
    });
    if (!sched) {
      throw new AppError(404, 'SCHEDULE_NOT_FOUND', 'Working schedule not found');
    }
    if (input.status === 'ACTIVE' && sched.status === 'INACTIVE') {
      throw new AppError(
        409,
        'INACTIVE_SCHEDULE',
        'Cannot assign an inactive working schedule to an active employee'
      );
    }
  }

  // Validate referenced Manager
  if (input.managerId) {
    const mgr = await prisma.employee.findUnique({
      where: { id: input.managerId },
    });
    if (!mgr) {
      throw new AppError(404, 'MANAGER_NOT_FOUND', 'Manager not found');
    }
    if (mgr.status === 'INACTIVE') {
      throw new AppError(
        409,
        'INACTIVE_MANAGER',
        'Cannot assign an inactive manager'
      );
    }
  }

  const created = await prisma.employee.create({
    data: {
      employeeNumber,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      workEmail,
      workPhone: input.workPhone,
      jobPosition: input.jobPosition.trim(),
      employeeType: input.employeeType,
      status: input.status,
      workLocation: input.workLocation,
      departmentId: input.departmentId,
      managerId: input.managerId,
      workingScheduleId: input.workingScheduleId,
      personalEmail: input.personalEmail,
      personalPhone: input.personalPhone,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
      personalAddress: input.personalAddress,
      emergencyContactName: input.emergencyContactName,
      emergencyContactPhone: input.emergencyContactPhone,
      bankAccountName: input.bankAccountName,
      bankAccountNumber: input.bankAccountNumber,
      bankName: input.bankName,
      bankIfsc: input.bankIfsc,
    },
    include: employeeDetailIncludes,
  });

  return toEmployeeDetailDto(created);
}

export async function updateEmployee(
  id: string,
  input: EmployeeInput
): Promise<EmployeeDetailDto> {
  const existing = await prisma.employee.findUnique({
    where: { id },
  });
  if (!existing) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
  }

  const employeeNumber = input.employeeNumber.trim().toUpperCase();
  const workEmail = input.workEmail.trim().toLowerCase();

  // Check unique employeeNumber excluding this employee
  const duplicateNumber = await prisma.employee.findFirst({
    where: {
      employeeNumber,
      id: { not: id },
    },
  });
  if (duplicateNumber) {
    throw new AppError(
      409,
      'EMPLOYEE_NUMBER_EXISTS',
      'An employee with this employee number already exists'
    );
  }

  // Check unique workEmail excluding this employee
  const duplicateEmail = await prisma.employee.findFirst({
    where: {
      workEmail,
      id: { not: id },
    },
  });
  if (duplicateEmail) {
    throw new AppError(
      409,
      'EMPLOYEE_EMAIL_EXISTS',
      'An employee with this work email already exists'
    );
  }

  // Active employee requires non-null department and schedule
  if (input.status === 'ACTIVE') {
    if (!input.departmentId) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Department is required for active employee'
      );
    }
    if (!input.workingScheduleId) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Working schedule is required for active employee'
      );
    }
  }

  // Validate referenced Department
  if (input.departmentId) {
    const dept = await prisma.department.findUnique({
      where: { id: input.departmentId },
    });
    if (!dept) {
      throw new AppError(404, 'DEPARTMENT_NOT_FOUND', 'Department not found');
    }
    if (input.status === 'ACTIVE' && dept.status === 'INACTIVE') {
      throw new AppError(
        409,
        'INACTIVE_DEPARTMENT',
        'Cannot assign an inactive department to an active employee'
      );
    }
  }

  // Validate referenced Working Schedule
  if (input.workingScheduleId) {
    const sched = await prisma.workingSchedule.findUnique({
      where: { id: input.workingScheduleId },
    });
    if (!sched) {
      throw new AppError(404, 'SCHEDULE_NOT_FOUND', 'Working schedule not found');
    }
    if (input.status === 'ACTIVE' && sched.status === 'INACTIVE') {
      throw new AppError(
        409,
        'INACTIVE_SCHEDULE',
        'Cannot assign an inactive working schedule to an active employee'
      );
    }
  }

  // Validate referenced Manager
  if (input.managerId) {
    const mgr = await prisma.employee.findUnique({
      where: { id: input.managerId },
    });
    if (!mgr) {
      throw new AppError(404, 'MANAGER_NOT_FOUND', 'Manager not found');
    }
    // Only active manager can be assigned/changed
    if (mgr.status === 'INACTIVE' && existing.managerId !== input.managerId) {
      throw new AppError(
        409,
        'INACTIVE_MANAGER',
        'Cannot assign an inactive manager'
      );
    }
    // Cycle check
    await validateManagerCycle(id, input.managerId);
  }

  const updated = await prisma.employee.update({
    where: { id },
    data: {
      employeeNumber,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      workEmail,
      workPhone: input.workPhone,
      jobPosition: input.jobPosition.trim(),
      employeeType: input.employeeType,
      status: input.status,
      workLocation: input.workLocation,
      departmentId: input.departmentId,
      managerId: input.managerId,
      workingScheduleId: input.workingScheduleId,
      personalEmail: input.personalEmail,
      personalPhone: input.personalPhone,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
      personalAddress: input.personalAddress,
      emergencyContactName: input.emergencyContactName,
      emergencyContactPhone: input.emergencyContactPhone,
      bankAccountName: input.bankAccountName,
      bankAccountNumber: input.bankAccountNumber,
      bankName: input.bankName,
      bankIfsc: input.bankIfsc,
    },
    include: employeeDetailIncludes,
  });

  return toEmployeeDetailDto(updated);
}

export async function updateEmployeeStatus(
  id: string,
  status: RecordStatus
): Promise<EmployeeDetailDto> {
  const existing = await prisma.employee.findUnique({
    where: { id },
    include: {
      department: true,
      workingSchedule: true,
    },
  });

  if (!existing) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
  }

  // Reactivation requires valid ACTIVE Department and Working Schedule
  if (status === 'ACTIVE') {
    if (!existing.departmentId || !existing.department) {
      throw new AppError(
        409,
        'VALIDATION_ERROR',
        'Cannot activate employee without an assigned department'
      );
    }
    if (existing.department.status === 'INACTIVE') {
      throw new AppError(
        409,
        'INACTIVE_DEPARTMENT',
        'Cannot activate employee with an inactive department'
      );
    }

    if (!existing.workingScheduleId || !existing.workingSchedule) {
      throw new AppError(
        409,
        'VALIDATION_ERROR',
        'Cannot activate employee without an assigned working schedule'
      );
    }
    if (existing.workingSchedule.status === 'INACTIVE') {
      throw new AppError(
        409,
        'INACTIVE_SCHEDULE',
        'Cannot activate employee with an inactive working schedule'
      );
    }
  }

  const updated = await prisma.employee.update({
    where: { id },
    data: { status },
    include: employeeDetailIncludes,
  });

  return toEmployeeDetailDto(updated);
}
