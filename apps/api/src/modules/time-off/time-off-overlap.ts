import { Prisma } from '@prisma/client';
import { AppError } from '../../errors/app-error.js';
import type { TimeOffUnit } from '@peoplepay360/shared';

export interface RequestOverlapCandidate {
  id: string;
  unitSnapshot: TimeOffUnit;
  startDate: Date | string;
  endDate: Date | string;
  startMinute: number | null;
  endMinute: number | null;
  status: string;
}

/**
 * Normalizes a Date or string to YYYY-MM-DD string.
 */
function toDateStr(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/**
 * Checks whether two time off requests overlap based on business rules.
 */
export function checkTwoRequestsOverlap(
  reqA: {
    unit: TimeOffUnit;
    startDate: string;
    endDate: string;
    startMinute?: number | null;
    endMinute?: number | null;
  },
  reqB: {
    unit: TimeOffUnit;
    startDate: string;
    endDate: string;
    startMinute?: number | null;
    endMinute?: number | null;
  }
): boolean {
  if (reqA.unit === 'DAY' && reqB.unit === 'DAY') {
    // Inclusive date ranges intersect
    return reqA.startDate <= reqB.endDate && reqA.endDate >= reqB.startDate;
  }

  if (reqA.unit === 'DAY' && reqB.unit === 'HOUR') {
    // DAY range contains HOUR date
    return reqB.startDate >= reqA.startDate && reqB.startDate <= reqA.endDate;
  }

  if (reqA.unit === 'HOUR' && reqB.unit === 'DAY') {
    // DAY range contains HOUR date
    return reqA.startDate >= reqB.startDate && reqA.startDate <= reqB.endDate;
  }

  if (reqA.unit === 'HOUR' && reqB.unit === 'HOUR') {
    // Same date and half-open minute ranges overlap
    if (reqA.startDate !== reqB.startDate) return false;
    const aStart = reqA.startMinute ?? 0;
    const aEnd = reqA.endMinute ?? 0;
    const bStart = reqB.startMinute ?? 0;
    const bEnd = reqB.endMinute ?? 0;
    // Strict inequality: adjacent ranges do not overlap
    return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
  }

  return false;
}

/**
 * Obtains a transaction-scoped advisory lock for an employee's time off writes.
 */
export async function lockEmployeeTimeOff(
  employeeId: string,
  tx: Prisma.TransactionClient
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('time_off:' || ${employeeId}))`;
}

/**
 * Queries all PENDING and APPROVED requests for the employee and verifies that the new/updated
 * request does not overlap with any of them.
 */
export async function assertNoTimeOffOverlap(
  employeeId: string,
  newReq: {
    unit: TimeOffUnit;
    startDate: string;
    endDate: string;
    startMinute?: number | null;
    endMinute?: number | null;
  },
  excludeRequestId: string | undefined,
  tx: Prisma.TransactionClient
): Promise<void> {
  const existingRequests = await tx.timeOffRequest.findMany({
    where: {
      employeeId,
      status: { in: ['PENDING', 'APPROVED'] },
      ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
    },
    select: {
      id: true,
      unitSnapshot: true,
      startDate: true,
      endDate: true,
      startMinute: true,
      endMinute: true,
      status: true,
    },
  });

  for (const existing of existingRequests) {
    const existStart = toDateStr(existing.startDate);
    const existEnd = toDateStr(existing.endDate);

    const overlaps = checkTwoRequestsOverlap(newReq, {
      unit: existing.unitSnapshot as TimeOffUnit,
      startDate: existStart,
      endDate: existEnd,
      startMinute: existing.startMinute,
      endMinute: existing.endMinute,
    });

    if (overlaps) {
      throw new AppError(
        409,
        'TIME_OFF_REQUEST_OVERLAP',
        `Time off request overlaps with an existing ${existing.status.toLowerCase()} request (${existStart} to ${existEnd})`
      );
    }
  }
}
