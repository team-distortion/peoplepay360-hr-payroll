import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import type { AuthenticatedUser } from '../../types/express.js';
import type {
  AllocationInput,
  AllocationListItemDto,
  AllocationDetailDto,
  AllocationSortField,
} from '@peoplepay360/shared';
import {
  toAllocationListItemDto,
  toAllocationDetailDto,
  toSafeAllocationAuditJson,
  getCompanyTodayString,
  deriveAllocationStatus,
} from './time-off.mapper.js';

const ALLOCATION_INCLUDE = {
  employee: {
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      department: { select: { name: true } },
    },
  },
  timeOffType: {
    select: {
      id: true,
      name: true,
      unit: true,
    },
  },
  createdByUser: {
    select: {
      id: true,
      email: true,
    },
  },
  decidedByUser: {
    select: {
      id: true,
      email: true,
    },
  },
} as const;

function validateUnitRules(unit: string, unitsStr: string) {
  const dec = new Prisma.Decimal(unitsStr);
  if (dec.lessThanOrEqualTo(0)) {
    throw new AppError(400, 'INVALID_TIME_OFF_INPUT', 'Allocated units must be greater than zero');
  }

  if (unit === 'DAY') {
    if (!dec.isInteger()) {
      throw new AppError(400, 'INVALID_TIME_OFF_INPUT', 'DAY allocations must use whole units');
    }
  } else if (unit === 'HOUR') {
    const times4 = dec.times(4);
    if (!times4.isInteger()) {
      throw new AppError(400, 'INVALID_TIME_OFF_INPUT', 'HOUR allocations must use multiples of 0.25 hours');
    }
  }
}

export async function listAllocations(
  query: {
    search?: string;
    employeeId?: string;
    timeOffTypeId?: string;
    status?: string;
    validOn?: string;
    page?: number;
    pageSize?: number;
    sort?: AllocationSortField;
    order?: 'asc' | 'desc';
  },
  requestingUser: AuthenticatedUser
): Promise<{ items: AllocationListItemDto[]; pagination: { totalItems: number; page: number; pageSize: number; totalPages: number } }> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const skip = (page - 1) * pageSize;
  const order = query.order ?? 'desc';

  const todayStr = getCompanyTodayString();
  const todayDate = new Date(todayStr + 'T00:00:00.000Z');

  const where: Prisma.TimeOffAllocationWhereInput = {};

  // Role ownership
  if (requestingUser.role === 'EMPLOYEE') {
    if (!requestingUser.employeeId) {
      throw new AppError(403, 'EMPLOYEE_PROFILE_NOT_LINKED', 'User is not linked to an employee profile');
    }
    where.employeeId = requestingUser.employeeId;
  } else if (query.employeeId) {
    where.employeeId = query.employeeId;
  }

  if (query.timeOffTypeId) {
    where.timeOffTypeId = query.timeOffTypeId;
  }

  if (query.search) {
    where.OR = [
      { employee: { firstName: { contains: query.search, mode: 'insensitive' } } },
      { employee: { lastName: { contains: query.search, mode: 'insensitive' } } },
      { employee: { employeeNumber: { contains: query.search, mode: 'insensitive' } } },
      { timeOffType: { name: { contains: query.search, mode: 'insensitive' } } },
    ];
  }

  if (query.validOn) {
    const validOnDate = new Date(query.validOn + 'T00:00:00.000Z');
    where.validFrom = { lte: validOnDate };
    where.validTo = { gte: validOnDate };
  }

  if (query.status) {
    if (query.status === 'EXPIRED') {
      where.status = 'APPROVED';
      where.validTo = { lt: todayDate };
    } else if (query.status === 'APPROVED') {
      where.status = 'APPROVED';
      where.validTo = { gte: todayDate };
    } else if (query.status === 'PENDING' || query.status === 'REFUSED') {
      where.status = query.status as any;
    }
  }

  // Sorting
  let orderBy: Prisma.TimeOffAllocationOrderByWithRelationInput[] = [];
  if (query.sort === 'employee') {
    orderBy = [{ employee: { lastName: order } }, { employee: { firstName: order } }];
  } else if (query.sort === 'type') {
    orderBy = [{ timeOffType: { name: order } }];
  } else if (query.sort === 'allocatedUnits') {
    orderBy = [{ allocatedUnits: order }];
  } else if (query.sort === 'validFrom') {
    orderBy = [{ validFrom: order }];
  } else if (query.sort === 'validTo') {
    orderBy = [{ validTo: order }];
  } else if (query.sort === 'status') {
    orderBy = [{ status: order }];
  } else {
    // Default sort: validFrom desc, createdAt desc, id asc
    orderBy = [{ validFrom: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }];
  }

  const [totalItems, allocations] = await Promise.all([
    prisma.timeOffAllocation.count({ where }),
    prisma.timeOffAllocation.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
      include: ALLOCATION_INCLUDE,
    }),
  ]);

  const items = allocations.map((a) => toAllocationListItemDto(a, todayStr));

  return {
    items,
    pagination: {
      totalItems,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    },
  };
}

export async function getAllocationById(
  id: string,
  requestingUser: AuthenticatedUser
): Promise<AllocationDetailDto> {
  const allocation = await prisma.timeOffAllocation.findUnique({
    where: { id },
    include: ALLOCATION_INCLUDE,
  });

  if (!allocation) {
    throw new AppError(404, 'ALLOCATION_NOT_FOUND', 'Allocation not found');
  }

  if (requestingUser.role === 'EMPLOYEE') {
    if (!requestingUser.employeeId || allocation.employeeId !== requestingUser.employeeId) {
      throw new AppError(404, 'ALLOCATION_NOT_FOUND', 'Allocation not found');
    }
  }

  return toAllocationDetailDto(allocation);
}

export async function createAllocation(
  input: AllocationInput,
  actorUserId: string
): Promise<AllocationDetailDto> {
  // Validate Employee
  const employee = await prisma.employee.findUnique({
    where: { id: input.employeeId },
  });
  if (!employee || employee.status !== 'ACTIVE') {
    throw new AppError(422, 'TIME_OFF_EMPLOYEE_INACTIVE', 'Selected employee is inactive or does not exist');
  }

  // Validate Type
  const type = await prisma.timeOffType.findUnique({
    where: { id: input.timeOffTypeId },
  });
  if (!type || type.status !== 'ACTIVE') {
    throw new AppError(422, 'TIME_OFF_TYPE_INACTIVE', 'Selected time off type is inactive or does not exist');
  }

  if (!type.requiresAllocation) {
    throw new AppError(422, 'ALLOCATION_NOT_REQUIRED', 'Selected time off type does not require allocations');
  }

  validateUnitRules(type.unit, input.allocatedUnits);

  return await prisma.$transaction(async (tx) => {
    const created = await tx.timeOffAllocation.create({
      data: {
        employeeId: input.employeeId,
        timeOffTypeId: input.timeOffTypeId,
        unitSnapshot: type.unit,
        allocatedUnits: new Prisma.Decimal(input.allocatedUnits),
        consumedUnits: new Prisma.Decimal(0),
        validFrom: new Date(input.validFrom + 'T00:00:00.000Z'),
        validTo: new Date(input.validTo + 'T00:00:00.000Z'),
        status: 'PENDING',
        description: input.description?.trim() || null,
        createdByUserId: actorUserId,
      },
      include: ALLOCATION_INCLUDE,
    });

    await tx.auditLog.create({
      data: {
        actorId: actorUserId,
        action: 'ALLOCATION_CREATED',
        entityType: 'TimeOffAllocation',
        entityId: created.id,
        before: Prisma.DbNull,
        after: toSafeAllocationAuditJson(created),
      },
    });

    return toAllocationDetailDto(created);
  });
}

export async function updateAllocation(
  id: string,
  input: AllocationInput,
  actorUserId: string
): Promise<AllocationDetailDto> {
  const existing = await prisma.timeOffAllocation.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError(404, 'ALLOCATION_NOT_FOUND', 'Allocation not found');
  }

  if (existing.status !== 'PENDING') {
    throw new AppError(409, 'ALLOCATION_IMMUTABLE', 'Only pending allocations can be edited');
  }

  // Validate Employee
  const employee = await prisma.employee.findUnique({
    where: { id: input.employeeId },
  });
  if (!employee || employee.status !== 'ACTIVE') {
    throw new AppError(422, 'TIME_OFF_EMPLOYEE_INACTIVE', 'Selected employee is inactive or does not exist');
  }

  // Validate Type
  const type = await prisma.timeOffType.findUnique({
    where: { id: input.timeOffTypeId },
  });
  if (!type || type.status !== 'ACTIVE') {
    throw new AppError(422, 'TIME_OFF_TYPE_INACTIVE', 'Selected time off type is inactive or does not exist');
  }

  if (!type.requiresAllocation) {
    throw new AppError(422, 'ALLOCATION_NOT_REQUIRED', 'Selected time off type does not require allocations');
  }

  validateUnitRules(type.unit, input.allocatedUnits);

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.timeOffAllocation.update({
      where: { id },
      data: {
        employeeId: input.employeeId,
        timeOffTypeId: input.timeOffTypeId,
        unitSnapshot: type.unit,
        allocatedUnits: new Prisma.Decimal(input.allocatedUnits),
        validFrom: new Date(input.validFrom + 'T00:00:00.000Z'),
        validTo: new Date(input.validTo + 'T00:00:00.000Z'),
        description: input.description?.trim() || null,
      },
      include: ALLOCATION_INCLUDE,
    });

    await tx.auditLog.create({
      data: {
        actorId: actorUserId,
        action: 'ALLOCATION_UPDATED',
        entityType: 'TimeOffAllocation',
        entityId: updated.id,
        before: toSafeAllocationAuditJson(existing),
        after: toSafeAllocationAuditJson(updated),
      },
    });

    return toAllocationDetailDto(updated);
  });
}

export async function approveAllocation(
  id: string,
  note: string | null,
  actorUserId: string
): Promise<AllocationDetailDto> {
  return await prisma.$transaction(async (tx) => {
    const allocation = await tx.timeOffAllocation.findUnique({
      where: { id },
      include: ALLOCATION_INCLUDE,
    });

    if (!allocation) {
      throw new AppError(404, 'ALLOCATION_NOT_FOUND', 'Allocation not found');
    }

    // Idempotent repeat
    if (allocation.status === 'APPROVED') {
      return toAllocationDetailDto(allocation);
    }

    if (allocation.status === 'REFUSED') {
      throw new AppError(409, 'ALLOCATION_DECISION_FINAL', 'Cannot approve an allocation that has been refused');
    }

    // Check Type status
    const type = await tx.timeOffType.findUnique({
      where: { id: allocation.timeOffTypeId },
    });
    if (!type || type.status !== 'ACTIVE') {
      throw new AppError(422, 'TIME_OFF_TYPE_INACTIVE', 'Cannot approve an allocation for an inactive time off type');
    }

    const updated = await tx.timeOffAllocation.update({
      where: { id },
      data: {
        status: 'APPROVED',
        decidedByUserId: actorUserId,
        decidedAt: new Date(),
        decisionNote: note?.trim() || null,
      },
      include: ALLOCATION_INCLUDE,
    });

    await tx.auditLog.create({
      data: {
        actorId: actorUserId,
        action: 'ALLOCATION_APPROVED',
        entityType: 'TimeOffAllocation',
        entityId: updated.id,
        before: toSafeAllocationAuditJson(allocation),
        after: toSafeAllocationAuditJson(updated),
      },
    });

    return toAllocationDetailDto(updated);
  });
}

export async function refuseAllocation(
  id: string,
  note: string,
  actorUserId: string
): Promise<AllocationDetailDto> {
  return await prisma.$transaction(async (tx) => {
    const allocation = await tx.timeOffAllocation.findUnique({
      where: { id },
      include: ALLOCATION_INCLUDE,
    });

    if (!allocation) {
      throw new AppError(404, 'ALLOCATION_NOT_FOUND', 'Allocation not found');
    }

    // Idempotent repeat
    if (allocation.status === 'REFUSED') {
      return toAllocationDetailDto(allocation);
    }

    if (allocation.status === 'APPROVED') {
      throw new AppError(409, 'ALLOCATION_DECISION_FINAL', 'Cannot refuse an allocation that has been approved');
    }

    const updated = await tx.timeOffAllocation.update({
      where: { id },
      data: {
        status: 'REFUSED',
        decidedByUserId: actorUserId,
        decidedAt: new Date(),
        decisionNote: note.trim(),
      },
      include: ALLOCATION_INCLUDE,
    });

    await tx.auditLog.create({
      data: {
        actorId: actorUserId,
        action: 'ALLOCATION_REFUSED',
        entityType: 'TimeOffAllocation',
        entityId: updated.id,
        before: toSafeAllocationAuditJson(allocation),
        after: toSafeAllocationAuditJson(updated),
      },
    });

    return toAllocationDetailDto(updated);
  });
}
