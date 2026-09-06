import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import type { AuthenticatedUser } from '../../types/express.js';
import type { TimeOffSummaryDto, TimeOffSummaryBalanceDto, TimeOffUnit } from '@peoplepay360/shared';
import { getCompanyTodayString } from './time-off.mapper.js';

export async function getTimeOffSummary(
  targetEmployeeId: string | undefined,
  requestingUser: AuthenticatedUser
): Promise<TimeOffSummaryDto> {
  let scopedEmployeeId: string | undefined;

  if (requestingUser.role === 'EMPLOYEE') {
    if (!requestingUser.employeeId) {
      throw new AppError(403, 'EMPLOYEE_PROFILE_NOT_LINKED', 'User account is not linked to an employee profile');
    }
    scopedEmployeeId = requestingUser.employeeId;
  } else {
    scopedEmployeeId = targetEmployeeId;
  }

  const todayStr = getCompanyTodayString();
  const todayDate = new Date(todayStr + 'T00:00:00.000Z');
  const currentYear = todayDate.getUTCFullYear();
  const yearStart = new Date(`${currentYear}-01-01T00:00:00.000Z`);
  const yearEnd = new Date(`${currentYear}-12-31T23:59:59.999Z`);

  const reqWhere: Prisma.TimeOffRequestWhereInput = {};
  const allocWhere: Prisma.TimeOffAllocationWhereInput = {};

  if (scopedEmployeeId) {
    reqWhere.employeeId = scopedEmployeeId;
    allocWhere.employeeId = scopedEmployeeId;
  }

  const [
    pendingRequestCount,
    approvedRequestCountInCurrentYear,
    pendingAllocationCount,
    usableAllocationCount,
    activeTypes,
    approvedAllocations,
  ] = await Promise.all([
    prisma.timeOffRequest.count({
      where: {
        ...reqWhere,
        status: 'PENDING',
      },
    }),
    prisma.timeOffRequest.count({
      where: {
        ...reqWhere,
        status: 'APPROVED',
        startDate: { gte: yearStart, lte: yearEnd },
      },
    }),
    prisma.timeOffAllocation.count({
      where: {
        ...allocWhere,
        status: 'PENDING',
      },
    }),
    prisma.timeOffAllocation.count({
      where: {
        ...allocWhere,
        status: 'APPROVED',
        validFrom: { lte: todayDate },
        validTo: { gte: todayDate },
        consumedUnits: { lt: prisma.timeOffAllocation.fields.allocatedUnits },
      },
    }),
    prisma.timeOffType.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    }),
    prisma.timeOffAllocation.findMany({
      where: {
        ...allocWhere,
        status: 'APPROVED',
        validTo: { gte: todayDate },
      },
      select: {
        timeOffTypeId: true,
        allocatedUnits: true,
        consumedUnits: true,
      },
    }),
  ]);

  // Aggregate balances by type
  const typeMap = new Map<string, { allocated: Prisma.Decimal; consumed: Prisma.Decimal }>();
  for (const alloc of approvedAllocations) {
    const existing = typeMap.get(alloc.timeOffTypeId) ?? {
      allocated: new Prisma.Decimal(0),
      consumed: new Prisma.Decimal(0),
    };
    existing.allocated = existing.allocated.plus(alloc.allocatedUnits);
    existing.consumed = existing.consumed.plus(alloc.consumedUnits);
    typeMap.set(alloc.timeOffTypeId, existing);
  }

  const balancesByType: TimeOffSummaryBalanceDto[] = activeTypes
    .filter((t) => t.requiresAllocation)
    .map((t) => {
      const stats = typeMap.get(t.id) ?? {
        allocated: new Prisma.Decimal(0),
        consumed: new Prisma.Decimal(0),
      };
      const remaining = stats.allocated.minus(stats.consumed);
      return {
        timeOffTypeId: t.id,
        timeOffTypeName: t.name,
        unit: t.unit as TimeOffUnit,
        allocatedUnits: stats.allocated.toFixed(4),
        consumedUnits: stats.consumed.toFixed(4),
        remainingUnits: remaining.toFixed(4),
      };
    });

  return {
    pendingRequestCount,
    approvedRequestCountInCurrentYear,
    pendingAllocationCount,
    usableAllocationCount,
    balancesByType,
  };
}
