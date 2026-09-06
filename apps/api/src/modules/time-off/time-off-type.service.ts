import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import type { AuthenticatedUser } from '../../types/express.js';
import type {
  TimeOffTypeInput,
  TimeOffTypeListItemDto,
  TimeOffTypeDetailDto,
} from '@peoplepay360/shared';
import {
  toTimeOffTypeListItemDto,
  toTimeOffTypeDetailDto,
  toSafeTypeAuditJson,
  getCompanyTodayString,
} from './time-off.mapper.js';

export async function listTimeOffTypes(
  query: {
    search?: string;
    unit?: string;
    status?: 'ACTIVE' | 'INACTIVE';
    requiresAllocation?: boolean;
    page?: number;
    pageSize?: number;
  },
  requestingUser: AuthenticatedUser
): Promise<{ items: TimeOffTypeListItemDto[]; pagination: { totalItems: number; page: number; pageSize: number; totalPages: number } }> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Prisma.TimeOffTypeWhereInput = {};

  if (requestingUser.role === 'EMPLOYEE') {
    where.status = 'ACTIVE';
  } else if (query.status) {
    where.status = query.status;
  }

  if (query.unit) {
    where.unit = query.unit as any;
  }

  if (query.requiresAllocation !== undefined) {
    where.requiresAllocation = query.requiresAllocation;
  }

  if (query.search) {
    where.name = { contains: query.search, mode: 'insensitive' };
  }

  const [totalItems, types] = await Promise.all([
    prisma.timeOffType.count({ where }),
    prisma.timeOffType.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ name: 'asc' }],
    }),
  ]);

  const todayStr = getCompanyTodayString();
  const todayDate = new Date(todayStr + 'T00:00:00.000Z');

  // Count active allocations and requests for each type
  const items = await Promise.all(
    types.map(async (t) => {
      const [activeAllocationsCount, activeRequestsCount] = await Promise.all([
        prisma.timeOffAllocation.count({
          where: {
            timeOffTypeId: t.id,
            status: 'APPROVED',
            validTo: { gte: todayDate },
          },
        }),
        prisma.timeOffRequest.count({
          where: {
            timeOffTypeId: t.id,
            status: 'APPROVED',
            endDate: { gte: todayDate },
          },
        }),
      ]);
      return toTimeOffTypeListItemDto(t, activeAllocationsCount, activeRequestsCount);
    })
  );

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

export async function getTimeOffTypeById(
  id: string,
  requestingUser: AuthenticatedUser
): Promise<TimeOffTypeDetailDto> {
  const type = await prisma.timeOffType.findUnique({
    where: { id },
  });

  if (!type) {
    throw new AppError(404, 'TIME_OFF_TYPE_NOT_FOUND', 'Time off type not found');
  }

  if (requestingUser.role === 'EMPLOYEE' && type.status !== 'ACTIVE') {
    throw new AppError(404, 'TIME_OFF_TYPE_NOT_FOUND', 'Time off type not found');
  }

  const todayStr = getCompanyTodayString();
  const todayDate = new Date(todayStr + 'T00:00:00.000Z');

  const [activeAllocationsCount, activeRequestsCount] = await Promise.all([
    prisma.timeOffAllocation.count({
      where: {
        timeOffTypeId: type.id,
        status: 'APPROVED',
        validTo: { gte: todayDate },
      },
    }),
    prisma.timeOffRequest.count({
      where: {
        timeOffTypeId: type.id,
        status: 'APPROVED',
        endDate: { gte: todayDate },
      },
    }),
  ]);

  return toTimeOffTypeDetailDto(type, activeAllocationsCount, activeRequestsCount);
}

export async function createTimeOffType(
  input: TimeOffTypeInput,
  actorUserId: string
): Promise<TimeOffTypeDetailDto> {
  const nameKey = input.name.trim().toLowerCase();

  const existing = await prisma.timeOffType.findUnique({
    where: { nameKey },
  });

  if (existing) {
    throw new AppError(409, 'TIME_OFF_TYPE_NAME_EXISTS', `A time off type with name '${input.name}' already exists`);
  }

  return await prisma.$transaction(async (tx) => {
    const created = await tx.timeOffType.create({
      data: {
        name: input.name.trim(),
        nameKey,
        description: input.description?.trim() || null,
        unit: input.unit,
        requiresAllocation: input.requiresAllocation,
        approvalMode: input.approvalMode,
        payrollTreatment: input.payrollTreatment,
        status: input.status,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actorUserId,
        action: 'TIME_OFF_TYPE_CREATED',
        entityType: 'TimeOffType',
        entityId: created.id,
        before: Prisma.DbNull,
        after: toSafeTypeAuditJson(created),
      },
    });

    return toTimeOffTypeDetailDto(created, 0, 0);
  });
}

export async function updateTimeOffType(
  id: string,
  input: TimeOffTypeInput,
  actorUserId: string
): Promise<TimeOffTypeDetailDto> {
  const existing = await prisma.timeOffType.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError(404, 'TIME_OFF_TYPE_NOT_FOUND', 'Time off type not found');
  }

  const nameKey = input.name.trim().toLowerCase();
  if (nameKey !== existing.nameKey) {
    const duplicate = await prisma.timeOffType.findUnique({
      where: { nameKey },
    });
    if (duplicate) {
      throw new AppError(409, 'TIME_OFF_TYPE_NAME_EXISTS', `A time off type with name '${input.name}' already exists`);
    }
  }

  // Rule: Unit cannot change while the Type has a Pending Request, a Pending Allocation,
  // or an approved unexpired Allocation with remaining balance.
  if (input.unit !== existing.unit) {
    const todayStr = getCompanyTodayString();
    const todayDate = new Date(todayStr + 'T00:00:00.000Z');

    const [pendingRequests, pendingAllocations, approvedAllocationsWithBalance] = await Promise.all([
      prisma.timeOffRequest.count({
        where: { timeOffTypeId: id, status: 'PENDING' },
      }),
      prisma.timeOffAllocation.count({
        where: { timeOffTypeId: id, status: 'PENDING' },
      }),
      prisma.timeOffAllocation.count({
        where: {
          timeOffTypeId: id,
          status: 'APPROVED',
          validTo: { gte: todayDate },
          consumedUnits: { lt: prisma.timeOffAllocation.fields.allocatedUnits },
        },
      }),
    ]);

    if (pendingRequests > 0 || pendingAllocations > 0 || approvedAllocationsWithBalance > 0) {
      throw new AppError(
        409,
        'TIME_OFF_TYPE_IN_USE',
        'Cannot change unit while the type has pending requests, pending allocations, or active allocations with remaining balance'
      );
    }
  }

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.timeOffType.update({
      where: { id },
      data: {
        name: input.name.trim(),
        nameKey,
        description: input.description?.trim() || null,
        unit: input.unit,
        requiresAllocation: input.requiresAllocation,
        approvalMode: input.approvalMode,
        payrollTreatment: input.payrollTreatment,
        status: input.status,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actorUserId,
        action: 'TIME_OFF_TYPE_UPDATED',
        entityType: 'TimeOffType',
        entityId: updated.id,
        before: toSafeTypeAuditJson(existing),
        after: toSafeTypeAuditJson(updated),
      },
    });

    return toTimeOffTypeDetailDto(updated, 0, 0);
  });
}

export async function updateTimeOffTypeStatus(
  id: string,
  status: 'ACTIVE' | 'INACTIVE',
  actorUserId: string
): Promise<TimeOffTypeDetailDto> {
  const existing = await prisma.timeOffType.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError(404, 'TIME_OFF_TYPE_NOT_FOUND', 'Time off type not found');
  }

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.timeOffType.update({
      where: { id },
      data: { status },
    });

    await tx.auditLog.create({
      data: {
        actorId: actorUserId,
        action: 'TIME_OFF_TYPE_STATUS_CHANGED',
        entityType: 'TimeOffType',
        entityId: updated.id,
        before: { status: existing.status },
        after: { status: updated.status },
      },
    });

    return toTimeOffTypeDetailDto(updated, 0, 0);
  });
}
