import { Prisma } from '@prisma/client';
import type {
  TimeOffTypeListItemDto,
  TimeOffTypeDetailDto,
  AllocationListItemDto,
  AllocationDetailDto,
  TimeOffRequestListItemDto,
  TimeOffRequestDetailDto,
  AllocationStatus,
  TimeOffUnit,
  TimeOffRequestStatus,
  TimeOffPayrollTreatment,
} from '@peoplepay360/shared';
import { getCompanyBusinessDate } from '../attendance/attendance-clock.js';

export function getCompanyTodayString(): string {
  return getCompanyBusinessDate(new Date());
}

export function toDateStr(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function toTimeOffTypeListItemDto(
  type: {
    id: string;
    name: string;
    description: string | null;
    unit: string;
    requiresAllocation: boolean;
    approvalMode: string;
    payrollTreatment: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  },
  activeAllocationsCount = 0,
  activeRequestsCount = 0
): TimeOffTypeListItemDto {
  return {
    id: type.id,
    name: type.name,
    description: type.description,
    unit: type.unit as TimeOffUnit,
    requiresAllocation: type.requiresAllocation,
    approvalMode: type.approvalMode as any,
    payrollTreatment: type.payrollTreatment as any,
    status: type.status as any,
    activeAllocationsCount,
    activeRequestsCount,
    createdAt: type.createdAt.toISOString(),
    updatedAt: type.updatedAt.toISOString(),
  };
}

export function toTimeOffTypeDetailDto(
  type: any,
  activeAllocationsCount = 0,
  activeRequestsCount = 0
): TimeOffTypeDetailDto {
  return toTimeOffTypeListItemDto(type, activeAllocationsCount, activeRequestsCount);
}

export function deriveAllocationStatus(
  storedStatus: string,
  validToDate: Date | string,
  todayStr: string
): AllocationStatus {
  const validToStr = toDateStr(validToDate);
  if (storedStatus === 'APPROVED' && validToStr < todayStr) {
    return 'EXPIRED';
  }
  return storedStatus as AllocationStatus;
}

export function toAllocationListItemDto(
  allocation: {
    id: string;
    unitSnapshot: string;
    allocatedUnits: Prisma.Decimal | string;
    consumedUnits: Prisma.Decimal | string;
    validFrom: Date | string;
    validTo: Date | string;
    status: string;
    description: string | null;
    decidedAt: Date | null;
    decisionNote: string | null;
    createdAt: Date;
    updatedAt: Date;
    employee: {
      id: string;
      employeeNumber: string;
      firstName: string;
      lastName: string;
      department?: { name: string } | null;
    };
    timeOffType: {
      id: string;
      name: string;
      unit: string;
    };
    decidedByUser?: {
      id: string;
      email: string;
    } | null;
  },
  todayStr = getCompanyTodayString()
): AllocationListItemDto {
  const allocatedDec = new Prisma.Decimal(allocation.allocatedUnits);
  const consumedDec = new Prisma.Decimal(allocation.consumedUnits);
  const remainingDec = allocatedDec.minus(consumedDec);

  const derivedStatus = deriveAllocationStatus(allocation.status, allocation.validTo, todayStr);
  const validFromStr = toDateStr(allocation.validFrom);
  const validToStr = toDateStr(allocation.validTo);

  const isCurrentlyUsable =
    allocation.status === 'APPROVED' &&
    validFromStr <= todayStr &&
    validToStr >= todayStr &&
    remainingDec.greaterThan(0);

  return {
    id: allocation.id,
    employee: {
      id: allocation.employee.id,
      employeeNumber: allocation.employee.employeeNumber,
      fullName: `${allocation.employee.firstName} ${allocation.employee.lastName}`.trim(),
      departmentName: allocation.employee.department?.name ?? null,
    },
    timeOffType: {
      id: allocation.timeOffType.id,
      name: allocation.timeOffType.name,
      unit: allocation.timeOffType.unit as TimeOffUnit,
    },
    unitSnapshot: allocation.unitSnapshot as TimeOffUnit,
    allocatedUnits: allocatedDec.toFixed(4),
    consumedUnits: consumedDec.toFixed(4),
    remainingUnits: remainingDec.toFixed(4),
    validFrom: validFromStr,
    validTo: validToStr,
    status: derivedStatus,
    isCurrentlyUsable,
    description: allocation.description,
    decidedBy: allocation.decidedByUser
      ? { id: allocation.decidedByUser.id, email: allocation.decidedByUser.email }
      : null,
    decidedAt: allocation.decidedAt ? allocation.decidedAt.toISOString() : null,
    decisionNote: allocation.decisionNote,
    createdAt: allocation.createdAt.toISOString(),
    updatedAt: allocation.updatedAt.toISOString(),
  };
}

export function toAllocationDetailDto(
  allocation: any,
  todayStr = getCompanyTodayString()
): AllocationDetailDto {
  const base = toAllocationListItemDto(allocation, todayStr);
  return {
    ...base,
    createdBy: {
      id: allocation.createdByUser.id,
      email: allocation.createdByUser.email,
    },
  };
}

export function toTimeOffRequestListItemDto(request: {
  id: string;
  unitSnapshot: string;
  requiresAllocationSnapshot: boolean;
  payrollTreatmentSnapshot: string;
  startDate: Date | string;
  endDate: Date | string;
  startMinute: number | null;
  endMinute: number | null;
  requestedUnits: Prisma.Decimal | string;
  reason: string;
  status: string;
  decidedAt: Date | null;
  decisionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    department?: { name: string } | null;
  };
  timeOffType: {
    id: string;
    name: string;
    unit: string;
  };
  allocation?: {
    id: string;
    description: string | null;
    allocatedUnits: Prisma.Decimal | string;
    consumedUnits: Prisma.Decimal | string;
    validFrom: Date | string;
    validTo: Date | string;
  } | null;
  decidedByUser?: {
    id: string;
    email: string;
  } | null;
}): TimeOffRequestListItemDto {
  let allocSummary: TimeOffRequestListItemDto['allocation'] = null;
  if (request.allocation) {
    const allocTotal = new Prisma.Decimal(request.allocation.allocatedUnits);
    const allocUsed = new Prisma.Decimal(request.allocation.consumedUnits);
    allocSummary = {
      id: request.allocation.id,
      description: request.allocation.description,
      remainingUnits: allocTotal.minus(allocUsed).toFixed(4),
      validFrom: toDateStr(request.allocation.validFrom),
      validTo: toDateStr(request.allocation.validTo),
    };
  }

  return {
    id: request.id,
    employee: {
      id: request.employee.id,
      employeeNumber: request.employee.employeeNumber,
      fullName: `${request.employee.firstName} ${request.employee.lastName}`.trim(),
      departmentName: request.employee.department?.name ?? null,
    },
    timeOffType: {
      id: request.timeOffType.id,
      name: request.timeOffType.name,
      unit: request.timeOffType.unit as TimeOffUnit,
    },
    allocation: allocSummary,
    unitSnapshot: request.unitSnapshot as TimeOffUnit,
    requiresAllocationSnapshot: request.requiresAllocationSnapshot,
    payrollTreatmentSnapshot: request.payrollTreatmentSnapshot as TimeOffPayrollTreatment,
    startDate: toDateStr(request.startDate),
    endDate: toDateStr(request.endDate),
    startMinute: request.startMinute,
    endMinute: request.endMinute,
    requestedUnits: new Prisma.Decimal(request.requestedUnits).toFixed(4),
    reason: request.reason,
    status: request.status as TimeOffRequestStatus,
    decidedBy: request.decidedByUser
      ? { id: request.decidedByUser.id, email: request.decidedByUser.email }
      : null,
    decidedAt: request.decidedAt ? request.decidedAt.toISOString() : null,
    decisionNote: request.decisionNote,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  };
}

export function toTimeOffRequestDetailDto(request: any): TimeOffRequestDetailDto {
  const base = toTimeOffRequestListItemDto(request);
  return {
    ...base,
    createdBy: {
      id: request.createdByUser.id,
      email: request.createdByUser.email,
    },
  };
}

export function toSafeTypeAuditJson(t: any) {
  return {
    name: t.name,
    nameKey: t.nameKey,
    description: t.description,
    unit: t.unit,
    requiresAllocation: t.requiresAllocation,
    approvalMode: t.approvalMode,
    payrollTreatment: t.payrollTreatment,
    status: t.status,
  };
}

export function toSafeAllocationAuditJson(a: any) {
  return {
    employeeId: a.employeeId,
    timeOffTypeId: a.timeOffTypeId,
    unitSnapshot: a.unitSnapshot,
    allocatedUnits: new Prisma.Decimal(a.allocatedUnits).toFixed(4),
    consumedUnits: new Prisma.Decimal(a.consumedUnits).toFixed(4),
    validFrom: toDateStr(a.validFrom),
    validTo: toDateStr(a.validTo),
    status: a.status,
    description: a.description,
    decidedByUserId: a.decidedByUserId,
    decidedAt: a.decidedAt ? a.decidedAt.toISOString() : null,
    decisionNote: a.decisionNote,
  };
}

export function toSafeRequestAuditJson(r: any) {
  return {
    employeeId: r.employeeId,
    timeOffTypeId: r.timeOffTypeId,
    allocationId: r.allocationId,
    unitSnapshot: r.unitSnapshot,
    requiresAllocationSnapshot: r.requiresAllocationSnapshot,
    payrollTreatmentSnapshot: r.payrollTreatmentSnapshot,
    startDate: toDateStr(r.startDate),
    endDate: toDateStr(r.endDate),
    startMinute: r.startMinute,
    endMinute: r.endMinute,
    requestedUnits: new Prisma.Decimal(r.requestedUnits).toFixed(4),
    reason: r.reason,
    status: r.status,
    decidedByUserId: r.decidedByUserId,
    decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
    decisionNote: r.decisionNote,
  };
}
