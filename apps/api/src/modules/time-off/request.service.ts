import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import type { AuthenticatedUser } from '../../types/express.js';
import type {
  TimeOffRequestInput,
  TimeOffRequestListItemDto,
  TimeOffRequestDetailDto,
  TimeOffSortField,
} from '@peoplepay360/shared';
import {
  toTimeOffRequestListItemDto,
  toTimeOffRequestDetailDto,
  toSafeRequestAuditJson,
  getCompanyTodayString,
  toDateStr,
} from './time-off.mapper.js';
import {
  calculateDayDuration,
  calculateHourDuration,
} from './time-off-calculation.js';
import {
  lockEmployeeTimeOff,
  assertNoTimeOffOverlap,
} from './time-off-overlap.js';

const REQUEST_INCLUDE = {
  employee: {
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      managerId: true,
      department: { select: { name: true } },
    },
  },
  timeOffType: {
    select: {
      id: true,
      name: true,
      unit: true,
      requiresAllocation: true,
      approvalMode: true,
      payrollTreatment: true,
      status: true,
    },
  },
  allocation: {
    select: {
      id: true,
      description: true,
      allocatedUnits: true,
      consumedUnits: true,
      validFrom: true,
      validTo: true,
      unitSnapshot: true,
      status: true,
      employeeId: true,
      timeOffTypeId: true,
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

export async function listRequests(
  query: {
    scope?: 'mine' | 'team' | 'all';
    search?: string;
    employeeId?: string;
    timeOffTypeId?: string;
    status?: string;
    payrollTreatment?: string;
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
    sort?: TimeOffSortField;
    order?: 'asc' | 'desc';
  },
  requestingUser: AuthenticatedUser
): Promise<{ items: TimeOffRequestListItemDto[]; pagination: { totalItems: number; page: number; pageSize: number; totalPages: number } }> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const skip = (page - 1) * pageSize;
  const order = query.order ?? 'asc';

  const where: Prisma.TimeOffRequestWhereInput = {};

  // Determine scope
  const effectiveScope = requestingUser.role === 'EMPLOYEE' ? 'mine' : (query.scope ?? 'all');

  if (effectiveScope === 'mine') {
    if (!requestingUser.employeeId) {
      throw new AppError(403, 'EMPLOYEE_PROFILE_NOT_LINKED', 'User account is not linked to an employee profile');
    }
    where.employeeId = requestingUser.employeeId;
  } else if (effectiveScope === 'team') {
    if (!requestingUser.employeeId) {
      throw new AppError(403, 'EMPLOYEE_PROFILE_NOT_LINKED', 'Team scope requires a linked employee profile');
    }
    where.employee = { managerId: requestingUser.employeeId };
    if (query.employeeId) {
      where.employeeId = query.employeeId;
    }
  } else {
    // All
    if (query.employeeId) {
      where.employeeId = query.employeeId;
    }
  }

  if (query.timeOffTypeId) {
    where.timeOffTypeId = query.timeOffTypeId;
  }

  if (query.status) {
    where.status = query.status as any;
  }

  if (query.payrollTreatment) {
    where.payrollTreatmentSnapshot = query.payrollTreatment as any;
  }

  if (query.search) {
    where.OR = [
      { employee: { firstName: { contains: query.search, mode: 'insensitive' } } },
      { employee: { lastName: { contains: query.search, mode: 'insensitive' } } },
      { employee: { employeeNumber: { contains: query.search, mode: 'insensitive' } } },
      { timeOffType: { name: { contains: query.search, mode: 'insensitive' } } },
    ];
  }

  // Date filters
  if (query.date) {
    const d = new Date(query.date + 'T00:00:00.000Z');
    where.startDate = { lte: d };
    where.endDate = { gte: d };
  } else if (query.dateFrom || query.dateTo) {
    const fromDate = query.dateFrom ? new Date(query.dateFrom + 'T00:00:00.000Z') : undefined;
    const toDate = query.dateTo ? new Date(query.dateTo + 'T00:00:00.000Z') : undefined;

    if (fromDate && toDate && query.dateTo! < query.dateFrom!) {
      throw new AppError(400, 'INVALID_TIME_OFF_PERIOD', 'dateTo cannot be earlier than dateFrom');
    }

    if (fromDate && toDate) {
      where.startDate = { lte: toDate };
      where.endDate = { gte: fromDate };
    } else if (fromDate) {
      where.endDate = { gte: fromDate };
    } else if (toDate) {
      where.startDate = { lte: toDate };
    }
  }

  // Sorting
  let orderBy: Prisma.TimeOffRequestOrderByWithRelationInput[] = [];
  if (query.sort === 'employee') {
    orderBy = [{ employee: { lastName: order } }, { employee: { firstName: order } }];
  } else if (query.sort === 'type') {
    orderBy = [{ timeOffType: { name: order } }];
  } else if (query.sort === 'startDate') {
    orderBy = [{ startDate: order }, { id: 'asc' }];
  } else if (query.sort === 'endDate') {
    orderBy = [{ endDate: order }, { id: 'asc' }];
  } else if (query.sort === 'requestedUnits') {
    orderBy = [{ requestedUnits: order }];
  } else if (query.sort === 'status') {
    orderBy = [{ status: order }, { startDate: 'asc' }];
  } else if (query.sort === 'createdAt') {
    orderBy = [{ createdAt: order }];
  } else {
    // Default sort: Pending first, then startDate asc, createdAt asc, id asc
    // Prisma does not support custom enum value ordering natively in orderBy,
    // so we can order by startDate asc, createdAt asc, id asc, and we can sort PENDING first.
    orderBy = [{ startDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }];
  }

  const [totalItems, requests] = await Promise.all([
    prisma.timeOffRequest.count({ where }),
    prisma.timeOffRequest.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
      include: REQUEST_INCLUDE,
    }),
  ]);

  // If using default sort, sort PENDING first while preserving sub-order
  if (!query.sort) {
    requests.sort((a, b) => {
      if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
      if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
      return 0;
    });
  }

  const items = requests.map(toTimeOffRequestListItemDto);

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

export async function getRequestById(
  id: string,
  requestingUser: AuthenticatedUser
): Promise<TimeOffRequestDetailDto> {
  const request = await prisma.timeOffRequest.findUnique({
    where: { id },
    include: REQUEST_INCLUDE,
  });

  if (!request) {
    throw new AppError(404, 'TIME_OFF_REQUEST_NOT_FOUND', 'Time off request not found');
  }

  if (requestingUser.role === 'EMPLOYEE') {
    if (!requestingUser.employeeId || request.employeeId !== requestingUser.employeeId) {
      throw new AppError(404, 'TIME_OFF_REQUEST_NOT_FOUND', 'Time off request not found');
    }
  }

  return toTimeOffRequestDetailDto(request);
}

export async function createRequest(
  input: TimeOffRequestInput,
  requestingUser: AuthenticatedUser
): Promise<TimeOffRequestDetailDto> {
  let targetEmployeeId: string;

  if (requestingUser.role === 'EMPLOYEE') {
    if (!requestingUser.employeeId) {
      throw new AppError(403, 'EMPLOYEE_PROFILE_NOT_LINKED', 'User account is not linked to an employee profile');
    }
    targetEmployeeId = requestingUser.employeeId;
  } else {
    // HR on behalf
    if (!input.employeeId && !requestingUser.employeeId) {
      throw new AppError(400, 'INVALID_TIME_OFF_INPUT', 'employeeId is required');
    }
    targetEmployeeId = input.employeeId ?? requestingUser.employeeId!;
  }

  const todayStr = getCompanyTodayString();
  if (input.startDate < todayStr) {
    throw new AppError(400, 'INVALID_TIME_OFF_PERIOD', 'New requests cannot start in the past. Same-day requests are allowed.');
  }

  return await prisma.$transaction(async (tx) => {
    // Advisory lock to serialize all writes for this employee
    await lockEmployeeTimeOff(targetEmployeeId, tx);

    // Validate employee
    const employee = await tx.employee.findUnique({
      where: { id: targetEmployeeId },
    });
    if (!employee || employee.status !== 'ACTIVE') {
      throw new AppError(422, 'TIME_OFF_EMPLOYEE_INACTIVE', 'Employee is inactive or does not exist');
    }

    // Validate type
    const type = await tx.timeOffType.findUnique({
      where: { id: input.timeOffTypeId },
    });
    if (!type || type.status !== 'ACTIVE') {
      throw new AppError(422, 'TIME_OFF_TYPE_INACTIVE', 'Time off type is inactive or does not exist');
    }

    // Calculate duration
    let requestedUnits: string;
    if (type.unit === 'DAY') {
      if (input.startMinute !== null && input.startMinute !== undefined) {
        throw new AppError(400, 'INVALID_TIME_OFF_PERIOD', 'Start minute must be null for DAY requests');
      }
      if (input.endMinute !== null && input.endMinute !== undefined) {
        throw new AppError(400, 'INVALID_TIME_OFF_PERIOD', 'End minute must be null for DAY requests');
      }
      requestedUnits = await calculateDayDuration(targetEmployeeId, input.startDate, input.endDate, tx);
    } else {
      // HOUR
      if (input.startDate !== input.endDate) {
        throw new AppError(400, 'INVALID_TIME_OFF_PERIOD', 'HOUR requests must use a single business date');
      }
      requestedUnits = await calculateHourDuration(
        targetEmployeeId,
        input.startDate,
        input.startMinute,
        input.endMinute,
        tx
      );
    }

    // Check overlap
    await assertNoTimeOffOverlap(
      targetEmployeeId,
      {
        unit: type.unit,
        startDate: input.startDate,
        endDate: input.endDate,
        startMinute: input.startMinute,
        endMinute: input.endMinute,
      },
      undefined,
      tx
    );

    // Validate allocation requirement
    let targetAllocationId: string | null = null;
    if (type.requiresAllocation) {
      if (!input.allocationId) {
        throw new AppError(422, 'ALLOCATION_MISMATCH', 'Selected time off type requires an allocation');
      }

      const allocation = await tx.timeOffAllocation.findUnique({
        where: { id: input.allocationId },
      });

      if (!allocation) {
        throw new AppError(404, 'ALLOCATION_NOT_FOUND', 'Selected allocation not found');
      }

      if (allocation.employeeId !== targetEmployeeId) {
        throw new AppError(422, 'ALLOCATION_MISMATCH', 'Allocation does not belong to the selected employee');
      }

      if (allocation.timeOffTypeId !== type.id) {
        throw new AppError(422, 'ALLOCATION_MISMATCH', 'Allocation type does not match request type');
      }

      if (allocation.unitSnapshot !== type.unit) {
        throw new AppError(422, 'ALLOCATION_MISMATCH', 'Allocation unit does not match request unit');
      }

      if (allocation.status !== 'APPROVED') {
        throw new AppError(422, 'ALLOCATION_NOT_APPROVED', 'Selected allocation is not approved');
      }

      const allocFrom = toDateStr(allocation.validFrom);
      const allocTo = toDateStr(allocation.validTo);
      if (allocFrom > input.startDate || allocTo < input.endDate) {
        throw new AppError(422, 'ALLOCATION_EXPIRED_OR_NOT_STARTED', 'Allocation validity period does not cover the request period');
      }

      const remaining = allocation.allocatedUnits.minus(allocation.consumedUnits);
      if (remaining.lessThan(new Prisma.Decimal(requestedUnits))) {
        throw new AppError(422, 'ALLOCATION_BALANCE_INSUFFICIENT', 'Allocation balance is insufficient for this request');
      }

      targetAllocationId = allocation.id;
    } else {
      if (input.allocationId) {
        throw new AppError(422, 'ALLOCATION_NOT_REQUIRED', 'Selected time off type does not require an allocation');
      }
    }

    const isAutoApproved = type.approvalMode === 'NO_APPROVAL';
    const requestStatus = isAutoApproved ? 'APPROVED' : 'PENDING';
    const decidedAt = isAutoApproved ? new Date() : null;
    const decidedByUserId = isAutoApproved ? requestingUser.id : null;
    const decisionNote = isAutoApproved ? 'Auto-approved' : null;

    // Create Request
    const created = await tx.timeOffRequest.create({
      data: {
        employeeId: targetEmployeeId,
        timeOffTypeId: type.id,
        allocationId: targetAllocationId,
        unitSnapshot: type.unit,
        requiresAllocationSnapshot: type.requiresAllocation,
        payrollTreatmentSnapshot: type.payrollTreatment,
        startDate: new Date(input.startDate + 'T00:00:00.000Z'),
        endDate: new Date(input.endDate + 'T00:00:00.000Z'),
        startMinute: input.startMinute ?? null,
        endMinute: input.endMinute ?? null,
        requestedUnits: new Prisma.Decimal(requestedUnits),
        reason: input.reason.trim(),
        status: requestStatus,
        createdByUserId: requestingUser.id,
        decidedByUserId,
        decidedAt,
        decisionNote,
      },
      include: REQUEST_INCLUDE,
    });

    await tx.auditLog.create({
      data: {
        actorId: requestingUser.id,
        action: 'TIME_OFF_REQUEST_CREATED',
        entityType: 'TimeOffRequest',
        entityId: created.id,
        before: Prisma.DbNull,
        after: toSafeRequestAuditJson(created),
      },
    });

    // If NO_APPROVAL, atomically deduct allocation balance
    if (isAutoApproved) {
      await tx.auditLog.create({
        data: {
          actorId: requestingUser.id,
          action: 'TIME_OFF_REQUEST_APPROVED',
          entityType: 'TimeOffRequest',
          entityId: created.id,
          before: { status: 'PENDING' },
          after: { status: 'APPROVED', note: decisionNote },
        },
      });

      if (targetAllocationId) {
        const updateCount = await tx.$executeRaw`
          UPDATE "TimeOffAllocation"
          SET "consumedUnits" = "consumedUnits" + ${new Prisma.Decimal(requestedUnits)},
              "updatedAt" = NOW()
          WHERE "id" = ${targetAllocationId}
            AND ("allocatedUnits" - "consumedUnits") >= ${new Prisma.Decimal(requestedUnits)}
        `;

        if (updateCount === 0) {
          throw new AppError(422, 'ALLOCATION_BALANCE_INSUFFICIENT', 'Allocation balance became insufficient during approval');
        }

        await tx.auditLog.create({
          data: {
            actorId: requestingUser.id,
            action: 'ALLOCATION_BALANCE_CONSUMED',
            entityType: 'TimeOffAllocation',
            entityId: targetAllocationId,
            before: { consumedUnits: 'deduction_pending' },
            after: { requestedUnits, requestId: created.id },
          },
        });
      }
    }

    return toTimeOffRequestDetailDto(created);
  });
}

export async function updateRequest(
  id: string,
  input: TimeOffRequestInput,
  requestingUser: AuthenticatedUser
): Promise<TimeOffRequestDetailDto> {
  const existing = await prisma.timeOffRequest.findUnique({
    where: { id },
    include: REQUEST_INCLUDE,
  });

  if (!existing) {
    throw new AppError(404, 'TIME_OFF_REQUEST_NOT_FOUND', 'Time off request not found');
  }

  if (requestingUser.role === 'EMPLOYEE') {
    if (!requestingUser.employeeId || existing.employeeId !== requestingUser.employeeId) {
      throw new AppError(404, 'TIME_OFF_REQUEST_NOT_FOUND', 'Time off request not found');
    }
  }

  if (existing.status !== 'PENDING') {
    throw new AppError(409, 'TIME_OFF_REQUEST_IMMUTABLE', 'Only pending requests can be edited');
  }

  const todayStr = getCompanyTodayString();
  if (input.startDate < todayStr) {
    throw new AppError(400, 'INVALID_TIME_OFF_PERIOD', 'Requests cannot start in the past');
  }

  return await prisma.$transaction(async (tx) => {
    await lockEmployeeTimeOff(existing.employeeId, tx);

    const type = existing.timeOffType;

    // Calculate duration
    let requestedUnits: string;
    if (type.unit === 'DAY') {
      if (input.startMinute !== null && input.startMinute !== undefined) {
        throw new AppError(400, 'INVALID_TIME_OFF_PERIOD', 'Start minute must be null for DAY requests');
      }
      if (input.endMinute !== null && input.endMinute !== undefined) {
        throw new AppError(400, 'INVALID_TIME_OFF_PERIOD', 'End minute must be null for DAY requests');
      }
      requestedUnits = await calculateDayDuration(existing.employeeId, input.startDate, input.endDate, tx);
    } else {
      if (input.startDate !== input.endDate) {
        throw new AppError(400, 'INVALID_TIME_OFF_PERIOD', 'HOUR requests must use a single business date');
      }
      requestedUnits = await calculateHourDuration(
        existing.employeeId,
        input.startDate,
        input.startMinute,
        input.endMinute,
        tx
      );
    }

    // Check overlap excluding current request
    await assertNoTimeOffOverlap(
      existing.employeeId,
      {
        unit: type.unit as any,
        startDate: input.startDate,
        endDate: input.endDate,
        startMinute: input.startMinute,
        endMinute: input.endMinute,
      },
      id,
      tx
    );

    // Validate allocation requirement
    let targetAllocationId: string | null = null;
    if (existing.requiresAllocationSnapshot) {
      const allocId = input.allocationId ?? existing.allocationId;
      if (!allocId) {
        throw new AppError(422, 'ALLOCATION_MISMATCH', 'Request requires an allocation');
      }

      const allocation = await tx.timeOffAllocation.findUnique({
        where: { id: allocId },
      });

      if (!allocation) {
        throw new AppError(404, 'ALLOCATION_NOT_FOUND', 'Selected allocation not found');
      }

      if (allocation.employeeId !== existing.employeeId) {
        throw new AppError(422, 'ALLOCATION_MISMATCH', 'Allocation does not belong to the selected employee');
      }

      if (allocation.timeOffTypeId !== existing.timeOffTypeId) {
        throw new AppError(422, 'ALLOCATION_MISMATCH', 'Allocation type does not match request type');
      }

      if (allocation.status !== 'APPROVED') {
        throw new AppError(422, 'ALLOCATION_NOT_APPROVED', 'Selected allocation is not approved');
      }

      const allocFrom = toDateStr(allocation.validFrom);
      const allocTo = toDateStr(allocation.validTo);
      if (allocFrom > input.startDate || allocTo < input.endDate) {
        throw new AppError(422, 'ALLOCATION_EXPIRED_OR_NOT_STARTED', 'Allocation validity period does not cover the request period');
      }

      const remaining = allocation.allocatedUnits.minus(allocation.consumedUnits);
      if (remaining.lessThan(new Prisma.Decimal(requestedUnits))) {
        throw new AppError(422, 'ALLOCATION_BALANCE_INSUFFICIENT', 'Allocation balance is insufficient for this request');
      }

      targetAllocationId = allocation.id;
    }

    const updated = await tx.timeOffRequest.update({
      where: { id },
      data: {
        allocationId: targetAllocationId,
        startDate: new Date(input.startDate + 'T00:00:00.000Z'),
        endDate: new Date(input.endDate + 'T00:00:00.000Z'),
        startMinute: input.startMinute ?? null,
        endMinute: input.endMinute ?? null,
        requestedUnits: new Prisma.Decimal(requestedUnits),
        reason: input.reason.trim(),
      },
      include: REQUEST_INCLUDE,
    });

    await tx.auditLog.create({
      data: {
        actorId: requestingUser.id,
        action: 'TIME_OFF_REQUEST_UPDATED',
        entityType: 'TimeOffRequest',
        entityId: updated.id,
        before: toSafeRequestAuditJson(existing),
        after: toSafeRequestAuditJson(updated),
      },
    });

    return toTimeOffRequestDetailDto(updated);
  });
}

export async function approveRequest(
  id: string,
  note: string | null,
  actorUserId: string
): Promise<TimeOffRequestDetailDto> {
  return await prisma.$transaction(async (tx) => {
    const request = await tx.timeOffRequest.findUnique({
      where: { id },
      include: REQUEST_INCLUDE,
    });

    if (!request) {
      throw new AppError(404, 'TIME_OFF_REQUEST_NOT_FOUND', 'Time off request not found');
    }

    // Idempotent repeat: return already approved request without changing balance
    if (request.status === 'APPROVED') {
      return toTimeOffRequestDetailDto(request);
    }

    if (request.status === 'REFUSED') {
      throw new AppError(409, 'TIME_OFF_REQUEST_DECISION_FINAL', 'Cannot approve a request that has been refused');
    }

    await lockEmployeeTimeOff(request.employeeId, tx);

    // Consume allocation balance if required
    if (request.requiresAllocationSnapshot && request.allocationId) {
      const allocation = await tx.timeOffAllocation.findUnique({
        where: { id: request.allocationId },
      });

      if (!allocation) {
        throw new AppError(404, 'ALLOCATION_NOT_FOUND', 'Selected allocation not found');
      }

      if (allocation.status !== 'APPROVED') {
        throw new AppError(422, 'ALLOCATION_NOT_APPROVED', 'Selected allocation is not approved');
      }

      const allocFrom = toDateStr(allocation.validFrom);
      const allocTo = toDateStr(allocation.validTo);
      const reqStart = toDateStr(request.startDate);
      const reqEnd = toDateStr(request.endDate);

      if (allocFrom > reqStart || allocTo < reqEnd) {
        throw new AppError(422, 'ALLOCATION_EXPIRED_OR_NOT_STARTED', 'Allocation validity period does not cover the request period');
      }

      const updateCount = await tx.$executeRaw`
        UPDATE "TimeOffAllocation"
        SET "consumedUnits" = "consumedUnits" + ${request.requestedUnits},
            "updatedAt" = NOW()
        WHERE "id" = ${request.allocationId}
          AND ("allocatedUnits" - "consumedUnits") >= ${request.requestedUnits}
      `;

      if (updateCount === 0) {
        throw new AppError(422, 'ALLOCATION_BALANCE_INSUFFICIENT', 'Allocation balance is insufficient to approve this request');
      }

      await tx.auditLog.create({
        data: {
          actorId: actorUserId,
          action: 'ALLOCATION_BALANCE_CONSUMED',
          entityType: 'TimeOffAllocation',
          entityId: request.allocationId,
          before: { consumedUnits: allocation.consumedUnits.toFixed(4) },
          after: {
            consumedUnits: allocation.consumedUnits.plus(request.requestedUnits).toFixed(4),
            requestId: request.id,
          },
        },
      });
    }

    const updated = await tx.timeOffRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        decidedByUserId: actorUserId,
        decidedAt: new Date(),
        decisionNote: note?.trim() || null,
      },
      include: REQUEST_INCLUDE,
    });

    await tx.auditLog.create({
      data: {
        actorId: actorUserId,
        action: 'TIME_OFF_REQUEST_APPROVED',
        entityType: 'TimeOffRequest',
        entityId: updated.id,
        before: toSafeRequestAuditJson(request),
        after: toSafeRequestAuditJson(updated),
      },
    });

    return toTimeOffRequestDetailDto(updated);
  });
}

export async function refuseRequest(
  id: string,
  note: string,
  actorUserId: string
): Promise<TimeOffRequestDetailDto> {
  return await prisma.$transaction(async (tx) => {
    const request = await tx.timeOffRequest.findUnique({
      where: { id },
      include: REQUEST_INCLUDE,
    });

    if (!request) {
      throw new AppError(404, 'TIME_OFF_REQUEST_NOT_FOUND', 'Time off request not found');
    }

    // Idempotent repeat: return already refused request without error
    if (request.status === 'REFUSED') {
      return toTimeOffRequestDetailDto(request);
    }

    if (request.status === 'APPROVED') {
      throw new AppError(409, 'TIME_OFF_REQUEST_DECISION_FINAL', 'Cannot refuse a request that has been approved');
    }

    await lockEmployeeTimeOff(request.employeeId, tx);

    const updated = await tx.timeOffRequest.update({
      where: { id },
      data: {
        status: 'REFUSED',
        decidedByUserId: actorUserId,
        decidedAt: new Date(),
        decisionNote: note.trim(),
      },
      include: REQUEST_INCLUDE,
    });

    await tx.auditLog.create({
      data: {
        actorId: actorUserId,
        action: 'TIME_OFF_REQUEST_REFUSED',
        entityType: 'TimeOffRequest',
        entityId: updated.id,
        before: toSafeRequestAuditJson(request),
        after: toSafeRequestAuditJson(updated),
      },
    });

    return toTimeOffRequestDetailDto(updated);
  });
}
