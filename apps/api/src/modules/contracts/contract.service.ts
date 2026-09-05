import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import { Prisma } from '@prisma/client';
import type {
  ContractDetailDto,
  ContractInput,
  ContractListItemDto,
  ContractListQuery,
  ContractListResponse,
} from '@peoplepay360/shared';
import {
  toContractDetailDto,
  toContractListItemDto,
  type ContractWithRelations,
} from './contract.mapper.js';
import { getCompanyTodayDateString } from './contract-status.js';

const CONTRACT_INCLUDE = {
  employee: {
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      jobPosition: true,
      departmentId: true,
      workingScheduleId: true,
      department: {
        select: { id: true, name: true },
      },
      workingSchedule: {
        select: { id: true, name: true, type: true },
      },
    },
  },
  department: {
    select: { id: true, name: true },
  },
  salaryStructure: {
    select: { id: true, name: true, status: true },
  },
  workingSchedule: {
    select: { id: true, name: true, type: true },
  },
} as const;

function toSafeContractAuditJson(c: {
  contractNumber: string;
  employeeId: string;
  departmentId: string;
  salaryStructureId: string;
  workingScheduleId: string | null;
  jobPosition: string;
  startDate: Date | string;
  endDate: Date | string | null;
  monthlyWage: any;
  notes: string | null;
}) {
  return {
    contractNumber: c.contractNumber,
    employeeId: c.employeeId,
    departmentId: c.departmentId,
    salaryStructureId: c.salaryStructureId,
    workingScheduleId: c.workingScheduleId,
    jobPosition: c.jobPosition,
    startDate:
      typeof c.startDate === 'string'
        ? c.startDate.slice(0, 10)
        : c.startDate.toISOString().slice(0, 10),
    endDate: c.endDate
      ? typeof c.endDate === 'string'
        ? c.endDate.slice(0, 10)
        : c.endDate.toISOString().slice(0, 10)
      : null,
    monthlyWage: c.monthlyWage.toString(),
    notes: c.notes,
  };
}

async function validateEmployeeActive(employeeId: string, tx: Prisma.TransactionClient = prisma) {
  const employee = await tx.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, status: true },
  });
  if (!employee) {
    throw new AppError(404, 'CONTRACT_NOT_FOUND', 'Selected employee does not exist');
  }
  if (employee.status !== 'ACTIVE') {
    throw new AppError(422, 'CONTRACT_EMPLOYEE_INACTIVE', 'Selected employee is inactive');
  }
}

async function validateDepartmentActive(departmentId: string, tx: Prisma.TransactionClient = prisma) {
  const department = await tx.department.findUnique({
    where: { id: departmentId },
    select: { id: true, status: true },
  });
  if (!department) {
    throw new AppError(404, 'CONTRACT_NOT_FOUND', 'Selected department does not exist');
  }
  if (department.status !== 'ACTIVE') {
    throw new AppError(422, 'CONTRACT_DEPARTMENT_INACTIVE', 'Selected department is inactive');
  }
}

async function validateWorkingScheduleActive(scheduleId: string | null, tx: Prisma.TransactionClient = prisma) {
  if (!scheduleId) return;
  const schedule = await tx.workingSchedule.findUnique({
    where: { id: scheduleId },
    select: { id: true, status: true },
  });
  if (!schedule) {
    throw new AppError(404, 'CONTRACT_NOT_FOUND', 'Selected working schedule does not exist');
  }
  if (schedule.status !== 'ACTIVE') {
    throw new AppError(422, 'CONTRACT_SCHEDULE_INACTIVE', 'Selected working schedule is inactive');
  }
}

async function validateSalaryStructureActiveAndUsable(structureId: string, tx: Prisma.TransactionClient = prisma) {
  const structure = await tx.salaryStructure.findUnique({
    where: { id: structureId },
    include: {
      rules: {
        select: { id: true, status: true, code: true, category: true },
      },
    },
  });
  if (!structure) {
    throw new AppError(404, 'CONTRACT_NOT_FOUND', 'Selected salary structure does not exist');
  }
  if (structure.status !== 'ACTIVE') {
    throw new AppError(422, 'CONTRACT_STRUCTURE_INACTIVE', 'Selected salary structure is inactive');
  }

  const activeRules = structure.rules.filter((r) => r.status === 'ACTIVE');
  if (activeRules.length === 0) {
    throw new AppError(
      422,
      'CONTRACT_STRUCTURE_INVALID',
      'Salary structure has no active rules and cannot be assigned to a contract'
    );
  }
}

async function checkDateOverlap(
  employeeId: string,
  startDate: string,
  endDate: string | null,
  excludeContractId?: string,
  tx: Prisma.TransactionClient = prisma
) {
  const startDt = new Date(startDate + 'T00:00:00.000Z');
  const endDt = endDate ? new Date(endDate + 'T00:00:00.000Z') : new Date('9999-12-31T00:00:00.000Z');

  const conflicting = await tx.contract.findFirst({
    where: {
      employeeId,
      ...(excludeContractId ? { id: { not: excludeContractId } } : {}),
      startDate: { lte: endDt },
      OR: [
        { endDate: null },
        { endDate: { gte: startDt } },
      ],
    },
    select: { id: true, contractNumber: true, startDate: true, endDate: true },
  });

  if (conflicting) {
    throw new AppError(
      409,
      'CONTRACT_PERIOD_OVERLAP',
      `Employee already has an overlapping contract: ${conflicting.contractNumber}`,
      {
        fields: {
          period: `Overlaps with contract ${conflicting.contractNumber}`,
          conflictingContractNumber: conflicting.contractNumber,
        },
      }
    );
  }
}

export async function listContracts(
  query: ContractListQuery,
  scopedEmployeeId?: string
): Promise<ContractListResponse> {
  const page = query.page && query.page >= 1 ? query.page : 1;
  const pageSize = query.pageSize && query.pageSize >= 1 && query.pageSize <= 100 ? query.pageSize : 20;
  const skip = (page - 1) * pageSize;
  const todayStr = getCompanyTodayDateString();
  const todayDate = new Date(todayStr + 'T00:00:00.000Z');

  const where: Prisma.ContractWhereInput = {};

  // Ownership scope: if requesting user is an EMPLOYEE, lock to their employeeId
  if (scopedEmployeeId) {
    where.employeeId = scopedEmployeeId;
  } else if (query.employeeId) {
    where.employeeId = query.employeeId;
  }

  if (query.departmentId) {
    where.departmentId = query.departmentId;
  }

  if (query.salaryStructureId) {
    where.salaryStructureId = query.salaryStructureId;
  }

  // Derived status filter:
  // RUNNING: endDate IS NULL OR endDate >= today
  // EXPIRED: endDate IS NOT NULL AND endDate < today
  if (query.status === 'RUNNING') {
    where.OR = [
      { endDate: null },
      { endDate: { gte: todayDate } },
    ];
  } else if (query.status === 'EXPIRED') {
    where.endDate = { lt: todayDate };
  }

  // effectiveOn filter:
  // startDate <= effectiveOn AND (endDate IS NULL OR endDate >= effectiveOn)
  if (query.effectiveOn) {
    const effDate = new Date(query.effectiveOn + 'T00:00:00.000Z');
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      { startDate: { lte: effDate } },
      {
        OR: [
          { endDate: null },
          { endDate: { gte: effDate } },
        ],
      },
    ];
  }

  // Search filter: contractNumber, employee number, first name, last name, job position
  if (query.search && query.search.trim().length > 0) {
    const term = query.search.trim();
    const searchConditions: Prisma.ContractWhereInput[] = [
      { contractNumber: { contains: term, mode: 'insensitive' } },
      { jobPosition: { contains: term, mode: 'insensitive' } },
      { employee: { employeeNumber: { contains: term, mode: 'insensitive' } } },
      { employee: { firstName: { contains: term, mode: 'insensitive' } } },
      { employee: { lastName: { contains: term, mode: 'insensitive' } } },
    ];

    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      { OR: searchConditions },
    ];
  }

  // Sort handling
  const sort = query.sort || 'startDate';
  const order = query.order || 'desc';

  let orderBy: Prisma.ContractOrderByWithRelationInput[];
  switch (sort) {
    case 'contractNumber':
      orderBy = [{ contractNumber: order }, { id: 'asc' }];
      break;
    case 'employee':
      orderBy = [
        { employee: { lastName: order } },
        { employee: { firstName: order } },
        { id: 'asc' },
      ];
      break;
    case 'startDate':
      orderBy = [{ startDate: order }, { contractNumber: 'desc' }, { id: 'asc' }];
      break;
    case 'endDate':
      orderBy = [{ endDate: order }, { contractNumber: 'desc' }, { id: 'asc' }];
      break;
    case 'monthlyWage':
      orderBy = [{ monthlyWage: order }, { contractNumber: 'desc' }, { id: 'asc' }];
      break;
    case 'status':
      orderBy = [{ endDate: order }, { startDate: 'desc' }, { id: 'asc' }];
      break;
    default:
      orderBy = [{ startDate: 'desc' }, { contractNumber: 'desc' }, { id: 'asc' }];
  }

  const [totalItems, contracts] = await Promise.all([
    prisma.contract.count({ where }),
    prisma.contract.findMany({
      where,
      include: CONTRACT_INCLUDE,
      orderBy,
      skip,
      take: pageSize,
    }),
  ]);

  const items: ContractListItemDto[] = (contracts as ContractWithRelations[]).map((c) =>
    toContractListItemDto(c, todayStr)
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

export async function getContractById(
  id: string,
  scopedEmployeeId?: string
): Promise<ContractDetailDto> {
  const contract = await prisma.contract.findUnique({
    where: { id },
    include: CONTRACT_INCLUDE,
  });

  if (!contract) {
    throw new AppError(404, 'CONTRACT_NOT_FOUND', 'Contract not found');
  }

  // If user is restricted to an employee profile, hide other contracts as 404
  if (scopedEmployeeId && contract.employeeId !== scopedEmployeeId) {
    throw new AppError(404, 'CONTRACT_NOT_FOUND', 'Contract not found');
  }

  return toContractDetailDto(contract as ContractWithRelations);
}

export async function createContract(
  input: ContractInput,
  actorUserId: string
): Promise<ContractDetailDto> {
  if (input.endDate && input.endDate < input.startDate) {
    throw new AppError(400, 'INVALID_CONTRACT_PERIOD', 'End date cannot be earlier than start date', {
      fields: { endDate: 'End date cannot be earlier than start date' },
    });
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Validation checks
      await validateEmployeeActive(input.employeeId, tx);
      await validateDepartmentActive(input.departmentId, tx);
      await validateSalaryStructureActiveAndUsable(input.salaryStructureId, tx);
      await validateWorkingScheduleActive(input.workingScheduleId, tx);

      // 2. Overlap check in service layer
      await checkDateOverlap(input.employeeId, input.startDate, input.endDate, undefined, tx);

      // 3. Generate immutable Contract number using PostgreSQL sequence
      const seqRows = await tx.$queryRaw<{ seq: string }[]>`SELECT nextval('contract_number_seq')::text as seq`;
      const seqNum = String(seqRows[0]?.seq ?? '1').padStart(6, '0');
      const year = input.startDate.slice(0, 4);
      const contractNumber = `CON/${year}/${seqNum}`;

      // 4. Create contract
      const contract = await tx.contract.create({
        data: {
          contractNumber,
          employeeId: input.employeeId,
          departmentId: input.departmentId,
          salaryStructureId: input.salaryStructureId,
          workingScheduleId: input.workingScheduleId,
          jobPosition: input.jobPosition.trim(),
          startDate: new Date(input.startDate + 'T00:00:00.000Z'),
          endDate: input.endDate ? new Date(input.endDate + 'T00:00:00.000Z') : null,
          monthlyWage: new Prisma.Decimal(input.monthlyWage),
          notes: input.notes?.trim() || null,
        },
        include: CONTRACT_INCLUDE,
      });

      // 5. AuditLog
      await tx.auditLog.create({
        data: {
          actorId: actorUserId,
          action: 'CONTRACT_CREATED',
          entityType: 'Contract',
          entityId: contract.id,
          before: Prisma.JsonNull,
          after: toSafeContractAuditJson(contract),
        },
      });

      return toContractDetailDto(contract as ContractWithRelations);
    });
  } catch (error: any) {
    if (
      error?.code === '23P01' ||
      error?.message?.includes('Contract_employee_dates_excl') ||
      error?.message?.includes('conflicting key value violates exclusion constraint')
    ) {
      throw new AppError(
        409,
        'CONTRACT_PERIOD_OVERLAP',
        'The contract period overlaps with an existing contract for this employee',
        { fields: { period: 'Period overlaps with an existing contract' } }
      );
    }
    if (
      error?.code === 'P2002' &&
      Array.isArray(error?.meta?.target) &&
      error.meta.target.includes('contractNumber')
    ) {
      throw new AppError(
        409,
        'CONTRACT_NUMBER_CONFLICT',
        'Contract number collision occurred. Please retry.'
      );
    }
    throw error;
  }
}

export async function updateContract(
  id: string,
  input: ContractInput,
  actorUserId: string
): Promise<ContractDetailDto> {
  if (input.endDate && input.endDate < input.startDate) {
    throw new AppError(400, 'INVALID_CONTRACT_PERIOD', 'End date cannot be earlier than start date', {
      fields: { endDate: 'End date cannot be earlier than start date' },
    });
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.contract.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new AppError(404, 'CONTRACT_NOT_FOUND', 'Contract not found');
      }

      // Active checks only apply when reference is changed
      if (input.employeeId !== existing.employeeId) {
        await validateEmployeeActive(input.employeeId, tx);
      }
      if (input.departmentId !== existing.departmentId) {
        await validateDepartmentActive(input.departmentId, tx);
      }
      if (input.salaryStructureId !== existing.salaryStructureId) {
        await validateSalaryStructureActiveAndUsable(input.salaryStructureId, tx);
      }
      if (input.workingScheduleId && input.workingScheduleId !== existing.workingScheduleId) {
        await validateWorkingScheduleActive(input.workingScheduleId, tx);
      }

      // Recheck overlap excluding current ID
      await checkDateOverlap(input.employeeId, input.startDate, input.endDate, id, tx);

      const beforeAudit = toSafeContractAuditJson(existing);

      const updated = await tx.contract.update({
        where: { id },
        data: {
          employeeId: input.employeeId,
          departmentId: input.departmentId,
          salaryStructureId: input.salaryStructureId,
          workingScheduleId: input.workingScheduleId,
          jobPosition: input.jobPosition.trim(),
          startDate: new Date(input.startDate + 'T00:00:00.000Z'),
          endDate: input.endDate ? new Date(input.endDate + 'T00:00:00.000Z') : null,
          monthlyWage: new Prisma.Decimal(input.monthlyWage),
          notes: input.notes?.trim() || null,
        },
        include: CONTRACT_INCLUDE,
      });

      const afterAudit = toSafeContractAuditJson(updated);

      await tx.auditLog.create({
        data: {
          actorId: actorUserId,
          action: 'CONTRACT_UPDATED',
          entityType: 'Contract',
          entityId: id,
          before: beforeAudit,
          after: afterAudit,
        },
      });

      return toContractDetailDto(updated as ContractWithRelations);
    });
  } catch (error: any) {
    if (
      error?.code === '23P01' ||
      error?.message?.includes('Contract_employee_dates_excl') ||
      error?.message?.includes('conflicting key value violates exclusion constraint')
    ) {
      throw new AppError(
        409,
        'CONTRACT_PERIOD_OVERLAP',
        'The contract period overlaps with an existing contract for this employee',
        { fields: { period: 'Period overlaps with an existing contract' } }
      );
    }
    throw error;
  }
}

export async function getActiveSalaryStructuresSelector(): Promise<
  Array<{ id: string; name: string; status: string }>
> {
  return prisma.salaryStructure.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true, status: true },
    orderBy: { name: 'asc' },
  });
}
