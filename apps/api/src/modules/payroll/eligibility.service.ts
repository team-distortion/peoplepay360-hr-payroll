import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import { validateProspectiveStructureRules } from '../salary-config/salary-rule-dependencies.js';
import { contractCoversPeriod } from '../contracts/resolution/resolve-contract.js';
import { isValidDateOnly } from '../contracts/resolution/date-only.js';
import type {
  PayrunEligibilityInput,
  PayrunEligibilityResponse,
  EligibilityEmployeeItemDto,
  IneligibilityReason,
} from '@peoplepay360/shared';
import type { Prisma } from '@prisma/client';

export function validatePeriodDates(periodStart: string, periodEnd: string): void {
  if (!isValidDateOnly(periodStart) || !isValidDateOnly(periodEnd)) {
    throw new AppError(
      400,
      'INVALID_PAYROLL_PERIOD',
      'Period start and end must be valid YYYY-MM-DD dates'
    );
  }

  if (periodStart > periodEnd) {
    throw new AppError(
      400,
      'INVALID_PAYROLL_PERIOD',
      `Period start (${periodStart}) cannot be after period end (${periodEnd})`
    );
  }

  // Calculate day difference (max 366 days)
  const [sy, sm, sd] = periodStart.split('-').map(Number);
  const [ey, em, ed] = periodEnd.split('-').map(Number);
  const sDate = new Date(Date.UTC(sy, sm - 1, sd));
  const eDate = new Date(Date.UTC(ey, em - 1, ed));
  const diffDays = Math.round((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  if (diffDays > 366) {
    throw new AppError(
      400,
      'INVALID_PAYROLL_PERIOD',
      'Payroll period cannot exceed 366 days'
    );
  }
}

export async function evaluatePayrunEligibility(
  input: PayrunEligibilityInput
): Promise<PayrunEligibilityResponse> {
  validatePeriodDates(input.periodStart, input.periodEnd);

  // 1. Fetch and validate Salary Structure
  const structure = await prisma.salaryStructure.findUnique({
    where: { id: input.salaryStructureId },
    include: {
      rules: true,
    },
  });

  if (!structure) {
    throw new AppError(
      404,
      'SALARY_STRUCTURE_NOT_FOUND',
      `Salary structure with ID "${input.salaryStructureId}" was not found`
    );
  }

  let structureInactive = structure.status !== 'ACTIVE';
  let structureInvalid = false;

  if (!structureInactive) {
    try {
      const activeRules = structure.rules.filter((r) => r.status === 'ACTIVE');
      validateProspectiveStructureRules(
        activeRules.map((r) => ({
          id: r.id,
          code: r.code,
          sequence: r.sequence,
          status: r.status,
          method: r.method,
          percentageBase: r.percentageBase,
          formula: r.formula,
        }))
      );

      const hasBasic = activeRules.some((r) => r.category === 'BASIC');
      const grossCount = activeRules.filter((r) => r.category === 'GROSS').length;
      const netCount = activeRules.filter((r) => r.category === 'NET').length;

      if (!hasBasic || grossCount !== 1 || netCount !== 1) {
        structureInvalid = true;
      }
    } catch {
      structureInvalid = true;
    }
  }

  // 2. Query Employees with filters
  const where: Prisma.EmployeeWhereInput = {};

  if (input.departmentId) {
    where.departmentId = input.departmentId;
  }

  if (input.employeeType) {
    where.employeeType = input.employeeType;
  }

  if (input.search && input.search.trim().length > 0) {
    const term = input.search.trim();
    where.OR = [
      { firstName: { contains: term, mode: 'insensitive' } },
      { lastName: { contains: term, mode: 'insensitive' } },
      { employeeNumber: { contains: term, mode: 'insensitive' } },
    ];
  }

  const employees = await prisma.employee.findMany({
    where,
    include: {
      department: true,
      workingSchedule: true,
      contracts: {
        include: { workingSchedule: true },
      },
      payslips: {
        where: {
          periodStart: new Date(input.periodStart),
          periodEnd: new Date(input.periodEnd),
        },
      },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
  });

  const allItems: EligibilityEmployeeItemDto[] = [];

  const periodObj = {
    startDate: input.periodStart,
    endDate: input.periodEnd,
  };

  for (const emp of employees) {
    const reasons: IneligibilityReason[] = [];

    if (emp.status !== 'ACTIVE') {
      reasons.push('EMPLOYEE_INACTIVE');
    }

    if (structureInactive) {
      reasons.push('SALARY_STRUCTURE_INACTIVE');
    }

    if (structureInvalid) {
      reasons.push('SALARY_STRUCTURE_INVALID');
    }

    // Check duplicate payslip for this exact period
    if (emp.payslips && emp.payslips.length > 0) {
      reasons.push('DUPLICATE_PAYSLIP');
    }

    // Evaluate contracts covering period
    const candidateContracts = emp.contracts.map((c) => ({
      id: c.id,
      contractNumber: c.contractNumber,
      employeeId: c.employeeId,
      salaryStructureId: c.salaryStructureId,
      workingScheduleId: c.workingScheduleId,
      startDate: c.startDate.toISOString().slice(0, 10),
      endDate: c.endDate ? c.endDate.toISOString().slice(0, 10) : null,
      monthlyWage: c.monthlyWage.toString(),
      workingSchedule: c.workingSchedule,
    }));

    const coveringContracts = candidateContracts.filter((c) =>
      contractCoversPeriod(c, periodObj)
    );

    let applicableContract = coveringContracts[0] ?? null;

    if (coveringContracts.length === 0) {
      reasons.push('NO_APPLICABLE_CONTRACT');
    } else if (coveringContracts.length > 1) {
      reasons.push('MULTIPLE_APPLICABLE_CONTRACTS');
    } else {
      // Exactly 1 contract
      if (applicableContract.salaryStructureId !== input.salaryStructureId) {
        reasons.push('SALARY_STRUCTURE_MISMATCH');
      }
    }

    // Evaluate effective schedule
    let effectiveSchedule = null;
    let scheduleSource: 'CONTRACT' | 'EMPLOYEE' | null = null;

    if (applicableContract?.workingSchedule) {
      effectiveSchedule = applicableContract.workingSchedule;
      scheduleSource = 'CONTRACT';
    } else if (emp.workingSchedule) {
      effectiveSchedule = emp.workingSchedule;
      scheduleSource = 'EMPLOYEE';
    } else {
      reasons.push('WORKING_SCHEDULE_MISSING');
    }

    const employeeName = `${emp.firstName} ${emp.lastName}`.trim();

    if (reasons.length === 0 && applicableContract && effectiveSchedule && scheduleSource) {
      allItems.push({
        employeeId: emp.id,
        employeeNumber: emp.employeeNumber,
        employeeName,
        employeeType: emp.employeeType,
        departmentName: emp.department?.name ?? null,
        contractId: applicableContract.id,
        contractNumber: applicableContract.contractNumber,
        contractStartDate: applicableContract.startDate,
        contractEndDate: applicableContract.endDate,
        monthlyWage: applicableContract.monthlyWage,
        effectiveScheduleId: effectiveSchedule.id,
        effectiveScheduleName: effectiveSchedule.name,
        effectiveScheduleWeeklyMinutes: 2400, // Standard weekly minutes
        effectiveScheduleSource: scheduleSource,
        eligible: true,
        ineligibilityReasons: [],
      });
    } else {
      allItems.push({
        employeeId: emp.id,
        employeeNumber: emp.employeeNumber,
        employeeName,
        employeeType: emp.employeeType,
        departmentName: emp.department?.name ?? null,
        contractId: applicableContract?.id ?? null,
        contractNumber: applicableContract?.contractNumber ?? null,
        contractStartDate: applicableContract?.startDate ?? null,
        contractEndDate: applicableContract?.endDate ?? null,
        monthlyWage: applicableContract?.monthlyWage ?? null,
        effectiveScheduleId: effectiveSchedule?.id ?? null,
        effectiveScheduleName: effectiveSchedule?.name ?? null,
        effectiveScheduleWeeklyMinutes: effectiveSchedule ? 2400 : null,
        effectiveScheduleSource: scheduleSource,
        eligible: false,
        ineligibilityReasons: reasons,
      });
    }
  }

  // Pagination
  const page = input.page && input.page >= 1 ? input.page : 1;
  const pageSize = input.pageSize && input.pageSize >= 1 && input.pageSize <= 100 ? input.pageSize : 50;
  const skip = (page - 1) * pageSize;
  const paginatedItems = allItems.slice(skip, skip + pageSize);

  const eligibleCount = allItems.filter((i) => i.eligible).length;
  const ineligibleCount = allItems.length - eligibleCount;
  const totalPages = Math.max(1, Math.ceil(allItems.length / pageSize));

  return {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    salaryStructureId: structure.id,
    salaryStructureName: structure.name,
    eligibleCount,
    ineligibleCount,
    items: paginatedItems,
    pagination: {
      totalItems: allItems.length,
      page,
      pageSize,
      totalPages,
    },
  };
}
