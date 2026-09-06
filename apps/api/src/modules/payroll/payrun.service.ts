import { createHash } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import {
  aggregatePayrollDays,
  executeSalaryRules,
  type RuleCalculationInput,
} from './payroll-calculation.js';
import { buildComputationInputHash } from './payroll-input-hash.js';
import { detectPayrollWarnings } from './payroll-warning.js';
import { generatePayslipPdf } from './payslip-pdf.service.js';
import { evaluatePayrunEligibility, validatePeriodDates } from './eligibility.service.js';
import {
  toPayrunListItemDto,
  toPayrunDetailDto,
} from './payroll.mapper.js';
import type {
  CreatePayrunInput,
  ListPayrunsQuery,
  PayrunDetailDto,
  PayrunListResponse,
} from '@peoplepay360/shared';
import { Prisma, type PayrollStatus } from '@prisma/client';

async function getNextPayrunNumber(year: number): Promise<string> {
  try {
    const result = await prisma.$queryRaw<Array<{ nextval: bigint }>>`
      SELECT nextval('payrun_number_seq') AS nextval
    `;
    const seq = result[0]?.nextval ? Number(result[0].nextval) : 1;
    return `PAY/${year}/${String(seq).padStart(6, '0')}`;
  } catch {
    const count = await prisma.payrun.count();
    return `PAY/${year}/${String(count + 1).padStart(6, '0')}`;
  }
}

export async function createPayrun(
  actorUserId: string,
  input: CreatePayrunInput
): Promise<PayrunDetailDto> {
  validatePeriodDates(input.periodStart, input.periodEnd);

  // 1. Revalidate eligibility for all selected employees inside transaction
  const eligibilityResult = await evaluatePayrunEligibility({
    salaryStructureId: input.salaryStructureId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    page: 1,
    pageSize: 500,
  });

  const eligibleMap = new Map(
    eligibilityResult.items
      .filter((i) => i.eligible)
      .map((i) => [i.employeeId, i])
  );

  for (const empId of input.employeeIds) {
    if (!eligibleMap.has(empId)) {
      const item = eligibilityResult.items.find((i) => i.employeeId === empId);
      if (item && !item.eligible) {
        if (item.ineligibilityReasons.includes('DUPLICATE_PAYSLIP')) {
          throw new AppError(
            409,
            'PAYSLIP_PERIOD_DUPLICATE',
            `Employee "${empId}" already has a payslip for this exact period`,
            { employeeId: empId }
          );
        }
        const reasons = item.ineligibilityReasons.join(', ') || 'Unknown ineligibility';
        throw new AppError(
          422,
          'PAYROLL_EMPLOYEE_INELIGIBLE',
          `Employee "${empId}" is ineligible for this payrun: ${reasons}`,
          { employeeId: empId, reasons: item.ineligibilityReasons }
        );
      }
    }
  }

  const structure = await prisma.salaryStructure.findUnique({
    where: { id: input.salaryStructureId },
  });
  if (!structure) {
    throw new AppError(404, 'SALARY_STRUCTURE_NOT_FOUND', 'Salary structure not found');
  }

  const year = parseInt(input.periodStart.slice(0, 4), 10);
  const payrunNumber = await getNextPayrunNumber(year);
  const name = `Payrun - ${structure.name} - ${input.periodStart} to ${input.periodEnd}`;

  return await prisma.$transaction(async (tx) => {
    // Check for duplicate exact-period payrun
    const existingPeriodPayslips = await tx.payslip.findMany({
      where: {
        employeeId: { in: input.employeeIds },
        periodStart: new Date(input.periodStart),
        periodEnd: new Date(input.periodEnd),
      },
    });

    if (existingPeriodPayslips.length > 0) {
      throw new AppError(
        409,
        'PAYSLIP_PERIOD_DUPLICATE',
        'One or more selected employees already have a payslip for this exact period'
      );
    }

    const payrun = await tx.payrun.create({
      data: {
        payrunNumber,
        name,
        salaryStructureId: structure.id,
        salaryStructureName: structure.name,
        periodStart: new Date(input.periodStart),
        periodEnd: new Date(input.periodEnd),
        currency: 'INR',
        status: 'DRAFT',
        createdByUserId: actorUserId,
      },
    });

    // Create Draft Payslips
    const createdPayslips = [];
    for (const empId of input.employeeIds) {
      const eligibleInfo = eligibleMap.get(empId)!;
      const payslip = await tx.payslip.create({
        data: {
          payrunId: payrun.id,
          employeeId: empId,
          contractId: eligibleInfo.contractId,
          salaryStructureId: structure.id,
          periodStart: new Date(input.periodStart),
          periodEnd: new Date(input.periodEnd),
          status: 'DRAFT',
          monthlyWage: new Prisma.Decimal(eligibleInfo.monthlyWage),
          employeeNumberSnapshot: eligibleInfo.employeeNumber,
          employeeNameSnapshot: eligibleInfo.employeeName,
          departmentNameSnapshot: eligibleInfo.departmentName,
          contractNumberSnapshot: eligibleInfo.contractNumber,
          structureNameSnapshot: structure.name,
          scheduleIdSnapshot: eligibleInfo.effectiveScheduleId,
          scheduleNameSnapshot: eligibleInfo.effectiveScheduleName,
        },
      });
      createdPayslips.push(payslip);
    }

    // Write AuditLog
    await tx.auditLog.create({
      data: {
        actorId: actorUserId,
        entityType: 'Payrun',
        entityId: payrun.id,
        action: 'PAYRUN_CREATED',
        before: Prisma.JsonNull,
        after: {
          payrunNumber,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          salaryStructureId: structure.id,
          totalPayslips: createdPayslips.length,
        },
      },
    });

    const fullPayrun = await tx.payrun.findUniqueOrThrow({
      where: { id: payrun.id },
      include: {
        createdByUser: true,
        computedByUser: true,
        validatedByUser: true,
        paidByUser: true,
        payslips: {
          include: {
            warnings: true,
          },
        },
        warnings: {
          include: {
            acknowledgedByUser: true,
          },
        },
      },
    });

    return toPayrunDetailDto(fullPayrun as any);
  });
}

export async function listPayruns(query: ListPayrunsQuery): Promise<PayrunListResponse> {
  const page = query.page && query.page >= 1 ? query.page : 1;
  const pageSize = query.pageSize && query.pageSize >= 1 && query.pageSize <= 100 ? query.pageSize : 20;
  const skip = (page - 1) * pageSize;

  const where: Prisma.PayrunWhereInput = {};

  if (query.salaryStructureId) {
    where.salaryStructureId = query.salaryStructureId;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.periodStart && query.periodEnd) {
    where.AND = [
      { periodStart: { lte: new Date(query.periodEnd) } },
      { periodEnd: { gte: new Date(query.periodStart) } },
    ];
  } else if (query.periodStart) {
    where.periodEnd = { gte: new Date(query.periodStart) };
  } else if (query.periodEnd) {
    where.periodStart = { lte: new Date(query.periodEnd) };
  }

  if (query.search && query.search.trim().length > 0) {
    const term = query.search.trim();
    where.OR = [
      { payrunNumber: { contains: term, mode: 'insensitive' } },
      { name: { contains: term, mode: 'insensitive' } },
      { salaryStructureName: { contains: term, mode: 'insensitive' } },
    ];
  }

  const orderBy: Prisma.PayrunOrderByWithRelationInput[] = [];
  if (query.sort === 'payrunNumber') {
    orderBy.push({ payrunNumber: query.order });
  } else if (query.sort === 'periodStart') {
    orderBy.push({ periodStart: query.order });
  } else if (query.sort === 'periodEnd') {
    orderBy.push({ periodEnd: query.order });
  } else if (query.sort === 'status') {
    orderBy.push({ status: query.order });
  } else if (query.sort === 'createdAt') {
    orderBy.push({ createdAt: query.order });
  } else {
    orderBy.push({ periodStart: 'desc' }, { createdAt: 'desc' }, { id: 'asc' });
  }

  const [totalItems, payruns] = await Promise.all([
    prisma.payrun.count({ where }),
    prisma.payrun.findMany({
      where,
      include: {
        payslips: {
          select: { status: true, grossAmount: true, netAmount: true },
        },
        warnings: {
          select: { blocking: true, status: true },
        },
      },
      orderBy,
      skip,
      take: pageSize,
    }),
  ]);

  const items = payruns.map(toPayrunListItemDto);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  return {
    items,
    pagination: {
      totalItems,
      page,
      pageSize,
      totalPages,
    },
  };
}

export async function getPayrunById(id: string): Promise<PayrunDetailDto> {
  const payrun = await prisma.payrun.findUnique({
    where: { id },
    include: {
      createdByUser: true,
      computedByUser: true,
      validatedByUser: true,
      paidByUser: true,
      payslips: {
        include: {
          warnings: true,
        },
        orderBy: [{ employeeNameSnapshot: 'asc' }, { id: 'asc' }],
      },
      warnings: {
        include: {
          acknowledgedByUser: true,
        },
      },
    },
  });

  if (!payrun) {
    throw new AppError(404, 'PAYRUN_NOT_FOUND', `Payrun with ID "${id}" was not found`);
  }

  return toPayrunDetailDto(payrun as any);
}

export async function discardDraftPayrun(
  id: string,
  actorUserId: string,
  actorRole: string
): Promise<void> {
  if (actorRole !== 'ADMIN' && actorRole !== 'HR_PAYROLL_MANAGER') {
    throw new AppError(
      403,
      'PAYROLL_ACCESS_DENIED',
      'Only HR Payroll Manager and Admin can discard an uncomputed Draft Payrun'
    );
  }

  const payrun = await prisma.payrun.findUnique({
    where: { id },
    include: {
      payslips: { select: { id: true, employeeId: true, computationInputHash: true } },
      warnings: { select: { id: true } },
    },
  });

  if (!payrun) {
    throw new AppError(404, 'PAYRUN_NOT_FOUND', 'Payrun not found');
  }

  if (payrun.status !== 'DRAFT') {
    throw new AppError(
      409,
      'PAYRUN_DISCARD_FORBIDDEN',
      'Only an uncomputed Draft Payrun can be discarded. Computed, Validated, or Paid payruns are permanent.'
    );
  }

  const hasComputedData =
    payrun.computedAt !== null ||
    payrun.warnings.length > 0 ||
    payrun.payslips.some((p) => p.computationInputHash !== null);

  if (hasComputedData) {
    throw new AppError(
      409,
      'PAYRUN_DISCARD_FORBIDDEN',
      'Draft payrun has computed data and cannot be discarded'
    );
  }

  const employeeIds = payrun.payslips.map((p) => p.employeeId);

  await prisma.$transaction(async (tx) => {
    await tx.payslip.deleteMany({ where: { payrunId: id } });
    await tx.payrun.delete({ where: { id } });

    await tx.auditLog.create({
      data: {
        actorId: actorUserId,
        entityType: 'Payrun',
        entityId: id,
        action: 'PAYRUN_DISCARDED',
        before: { payrunNumber: payrun.payrunNumber, status: payrun.status },
        after: Prisma.JsonNull,
      },
    });
  });
}

export async function computePayrun(
  id: string,
  actorUserId: string
): Promise<PayrunDetailDto> {
  const payrun = await prisma.payrun.findUnique({
    where: { id },
    include: {
      payslips: true,
      salaryStructure: {
        include: {
          rules: { where: { status: 'ACTIVE' }, orderBy: { sequence: 'asc' } },
        },
      },
    },
  });

  if (!payrun) {
    throw new AppError(404, 'PAYRUN_NOT_FOUND', 'Payrun not found');
  }

  if (payrun.status !== 'DRAFT') {
    throw new AppError(
      409,
      'PAYROLL_INVALID_TRANSITION',
      `Payrun cannot be computed from status "${payrun.status}". Use Recompute if already computed.`
    );
  }

  const periodStartStr = payrun.periodStart.toISOString().slice(0, 10);
  const periodEndStr = payrun.periodEnd.toISOString().slice(0, 10);

  const activeRules: RuleCalculationInput[] = payrun.salaryStructure.rules.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    category: r.category,
    sequence: r.sequence,
    method: r.method,
    fixedAmount: r.fixedAmount,
    percentageRate: r.percentageRate,
    percentageBase: r.percentageBase,
    formula: r.formula,
  }));

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    for (const payslip of payrun.payslips) {
      // Fetch employee & contract details
      const employee = await tx.employee.findUniqueOrThrow({
        where: { id: payslip.employeeId },
        include: {
          department: true,
          workingSchedule: { include: { days: true } },
          contracts: {
            where: { id: payslip.contractId },
            include: { workingSchedule: { include: { days: true } } },
          },
        },
      });

      const contract = employee.contracts[0];
      if (!contract) {
        throw new AppError(422, 'PAYROLL_CONTRACT_INVALID', 'Contract not found for employee');
      }

      // Schedule resolution
      const effectiveSchedule = contract.workingSchedule ?? employee.workingSchedule;
      if (!effectiveSchedule) {
        throw new AppError(422, 'PAYROLL_SCHEDULE_MISSING', 'Working schedule missing');
      }

      // Query attendances and time off in period
      const attendances = await tx.attendance.findMany({
        where: {
          employeeId: employee.id,
          attendanceDate: { gte: payrun.periodStart, lte: payrun.periodEnd },
        },
      });

      const timeOffRequests = await tx.timeOffRequest.findMany({
        where: {
          employeeId: employee.id,
          status: 'APPROVED',
          startDate: { lte: payrun.periodEnd },
          endDate: { gte: payrun.periodStart },
        },
      });

      // Day & hour aggregation
      const dayAggregation = aggregatePayrollDays({
        periodStart: periodStartStr,
        periodEnd: periodEndStr,
        scheduleDays: effectiveSchedule.days,
        attendances: attendances.map((a) => ({
          date: a.attendanceDate.toISOString().slice(0, 10),
          status: a.status,
          checkIn: a.checkInAt,
          checkOut: a.checkOutAt,
          workedMinutes: a.workedMinutes,
          overtimeMinutes: a.overtimeMinutes,
        })),
        timeOffRequests: timeOffRequests.map((to) => ({
          startDate: to.startDate.toISOString().slice(0, 10),
          endDate: to.endDate.toISOString().slice(0, 10),
          isPaid: to.payrollTreatmentSnapshot === 'PAID',
        })),
      });

      // Salary rule computation
      const calculationResult = executeSalaryRules({
        monthlyWage: contract.monthlyWage,
        dayAggregation,
        rules: activeRules,
      });

      // Warnings detection
      const discoveredWarnings = detectPayrollWarnings({
        dayAggregation,
        bankDetails: {
          bankAccountName: employee.bankAccountName,
          bankAccountNumber: employee.bankAccountNumber,
          bankName: employee.bankName,
          bankIfsc: employee.bankIfsc,
        },
      });

      // Build computation input hash
      const computationInputHash = buildComputationInputHash({
        contract: {
          id: contract.id,
          startDate: contract.startDate.toISOString().slice(0, 10),
          endDate: contract.endDate ? contract.endDate.toISOString().slice(0, 10) : null,
          monthlyWage: contract.monthlyWage.toString(),
          salaryStructureId: contract.salaryStructureId,
          workingScheduleId: contract.workingScheduleId,
        },
        scheduleDays: effectiveSchedule.days.map((d) => ({
          dayOfWeek: d.dayOfWeek,
          startMinute: d.startMinute,
          endMinute: d.endMinute,
          breakMinutes: d.breakMinutes,
        })),
        attendances: attendances.map((a) => ({
          date: a.attendanceDate.toISOString().slice(0, 10),
          status: a.status,
          workedMinutes: a.workedMinutes,
          overtimeMinutes: a.overtimeMinutes,
        })),
        timeOffRequests: timeOffRequests.map((to) => ({
          startDate: to.startDate.toISOString().slice(0, 10),
          endDate: to.endDate.toISOString().slice(0, 10),
          isPaid: to.payrollTreatmentSnapshot === 'PAID',
        })),
        rules: activeRules.map((r) => ({
          id: r.id,
          code: r.code,
          sequence: r.sequence,
          method: r.method,
          fixedAmount: r.fixedAmount ? r.fixedAmount.toString() : null,
          percentageRate: r.percentageRate ? r.percentageRate.toString() : null,
          percentageBase: r.percentageBase,
          formula: r.formula,
        })),
        bankDetails: {
          bankAccountName: employee.bankAccountName,
          bankAccountNumber: employee.bankAccountNumber,
          bankName: employee.bankName,
          bankIfsc: employee.bankIfsc,
        },
        currency: 'INR',
      });

      // Mask bank account number
      const fullAccount = employee.bankAccountNumber?.trim();
      const maskedAccount = fullAccount && fullAccount.length >= 4
        ? `•••• ${fullAccount.slice(-4)}`
        : fullAccount ? '••••' : null;

      // Update Payslip
      await tx.payslip.update({
        where: { id: payslip.id },
        data: {
          status: 'COMPUTED',
          employeeNumberSnapshot: employee.employeeNumber,
          employeeNameSnapshot: `${employee.firstName} ${employee.lastName}`.trim(),
          workEmailSnapshot: employee.workEmail,
          departmentNameSnapshot: employee.department?.name ?? null,
          jobPositionSnapshot: employee.jobPosition,
          contractNumberSnapshot: contract.contractNumber,
          structureNameSnapshot: payrun.salaryStructureName,
          scheduleIdSnapshot: effectiveSchedule.id,
          scheduleNameSnapshot: effectiveSchedule.name,
          bankAccountNameSnapshot: employee.bankAccountName,
          bankAccountMaskSnapshot: maskedAccount,
          bankNameSnapshot: employee.bankName,
          bankIfscSnapshot: employee.bankIfsc,

          monthlyWage: contract.monthlyWage,
          expectedDays: dayAggregation.expectedDays,
          workedDays: dayAggregation.workedDays,
          expectedMinutes: dayAggregation.expectedMinutes,
          workedMinutes: dayAggregation.workedMinutes,
          overtimeMinutes: dayAggregation.overtimeMinutes,

          proratedBasic: calculationResult.proratedBasic,
          basicAmount: calculationResult.basicAmount,
          allowanceAmount: calculationResult.allowanceAmount,
          overtimeAmount: calculationResult.overtimeAmount,
          deductionAmount: calculationResult.deductionAmount,
          contributionAmount: calculationResult.contributionAmount,
          grossAmount: calculationResult.grossAmount,
          netAmount: calculationResult.netAmount,

          computationInputHash,
        },
      });

      // Recreate Payslip Lines
      await tx.payslipLine.deleteMany({ where: { payslipId: payslip.id } });
      for (const line of calculationResult.lines) {
        await tx.payslipLine.create({
          data: {
            payslipId: payslip.id,
            salaryRuleId: line.salaryRuleId,
            name: line.name,
            code: line.code,
            category: line.category,
            sequence: line.sequence,
            method: line.method,
            amount: line.amount,
          },
        });
      }

      // Create Payroll Warnings
      for (const w of discoveredWarnings) {
        await tx.payrollWarning.create({
          data: {
            payrunId: payrun.id,
            payslipId: payslip.id,
            type: w.type,
            status: 'OPEN',
            message: w.message,
            blocking: w.blocking,
            acknowledgeable: w.acknowledgeable,
            details: w.details,
          },
        });
      }
    }

    // Update Payrun header
    await tx.payrun.update({
      where: { id },
      data: {
        status: 'COMPUTED',
        computedByUserId: actorUserId,
        computedAt: now,
      },
    });

    // Write AuditLog
    await tx.auditLog.create({
      data: {
        actorId: actorUserId,
        entityType: 'Payrun',
        entityId: id,
        action: 'PAYRUN_COMPUTED',
        before: Prisma.JsonNull,
        after: {
          payrunNumber: payrun.payrunNumber,
          computedAt: now.toISOString(),
          payslipsCount: payrun.payslips.length,
        },
      },
    });
  });

  return getPayrunById(id);
}

export async function recomputePayrun(
  id: string,
  actorUserId: string
): Promise<PayrunDetailDto> {
  const payrun = await prisma.payrun.findUnique({
    where: { id },
    include: {
      payslips: true,
      salaryStructure: {
        include: {
          rules: { where: { status: 'ACTIVE' }, orderBy: { sequence: 'asc' } },
        },
      },
    },
  });

  if (!payrun) {
    throw new AppError(404, 'PAYRUN_NOT_FOUND', 'Payrun not found');
  }

  if (payrun.status !== 'COMPUTED') {
    throw new AppError(
      409,
      'PAYROLL_INVALID_TRANSITION',
      `Recompute is allowed only for COMPUTED payruns (current: ${payrun.status})`
    );
  }

  const periodStartStr = payrun.periodStart.toISOString().slice(0, 10);
  const periodEndStr = payrun.periodEnd.toISOString().slice(0, 10);

  const activeRules: RuleCalculationInput[] = payrun.salaryStructure.rules.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    category: r.category,
    sequence: r.sequence,
    method: r.method,
    fixedAmount: r.fixedAmount,
    percentageRate: r.percentageRate,
    percentageBase: r.percentageBase,
    formula: r.formula,
  }));

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Resolve prior current warnings
    await tx.payrollWarning.updateMany({
      where: { payrunId: id, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
      data: { status: 'RESOLVED', resolvedAt: now },
    });

    for (const payslip of payrun.payslips) {
      const employee = await tx.employee.findUniqueOrThrow({
        where: { id: payslip.employeeId },
        include: {
          department: true,
          workingSchedule: { include: { days: true } },
          contracts: {
            where: { id: payslip.contractId },
            include: { workingSchedule: { include: { days: true } } },
          },
        },
      });

      const contract = employee.contracts[0];
      if (!contract) {
        throw new AppError(422, 'PAYROLL_CONTRACT_INVALID', 'Contract not found for employee');
      }

      const effectiveSchedule = contract.workingSchedule ?? employee.workingSchedule;
      if (!effectiveSchedule) {
        throw new AppError(422, 'PAYROLL_SCHEDULE_MISSING', 'Working schedule missing');
      }

      const attendances = await tx.attendance.findMany({
        where: {
          employeeId: employee.id,
          attendanceDate: { gte: payrun.periodStart, lte: payrun.periodEnd },
        },
      });

      const timeOffRequests = await tx.timeOffRequest.findMany({
        where: {
          employeeId: employee.id,
          status: 'APPROVED',
          startDate: { lte: payrun.periodEnd },
          endDate: { gte: payrun.periodStart },
        },
      });

      const dayAggregation = aggregatePayrollDays({
        periodStart: periodStartStr,
        periodEnd: periodEndStr,
        scheduleDays: effectiveSchedule.days,
        attendances: attendances.map((a) => ({
          date: a.attendanceDate.toISOString().slice(0, 10),
          status: a.status,
          checkIn: a.checkInAt,
          checkOut: a.checkOutAt,
          workedMinutes: a.workedMinutes,
          overtimeMinutes: a.overtimeMinutes,
        })),
        timeOffRequests: timeOffRequests.map((to) => ({
          startDate: to.startDate.toISOString().slice(0, 10),
          endDate: to.endDate.toISOString().slice(0, 10),
          isPaid: to.payrollTreatmentSnapshot === 'PAID',
        })),
      });

      const calculationResult = executeSalaryRules({
        monthlyWage: contract.monthlyWage,
        dayAggregation,
        rules: activeRules,
      });

      const discoveredWarnings = detectPayrollWarnings({
        dayAggregation,
        bankDetails: {
          bankAccountName: employee.bankAccountName,
          bankAccountNumber: employee.bankAccountNumber,
          bankName: employee.bankName,
          bankIfsc: employee.bankIfsc,
        },
      });

      const computationInputHash = buildComputationInputHash({
        contract: {
          id: contract.id,
          startDate: contract.startDate.toISOString().slice(0, 10),
          endDate: contract.endDate ? contract.endDate.toISOString().slice(0, 10) : null,
          monthlyWage: contract.monthlyWage.toString(),
          salaryStructureId: contract.salaryStructureId,
          workingScheduleId: contract.workingScheduleId,
        },
        scheduleDays: effectiveSchedule.days.map((d) => ({
          dayOfWeek: d.dayOfWeek,
          startMinute: d.startMinute,
          endMinute: d.endMinute,
          breakMinutes: d.breakMinutes,
        })),
        attendances: attendances.map((a) => ({
          date: a.attendanceDate.toISOString().slice(0, 10),
          status: a.status,
          workedMinutes: a.workedMinutes,
          overtimeMinutes: a.overtimeMinutes,
        })),
        timeOffRequests: timeOffRequests.map((to) => ({
          startDate: to.startDate.toISOString().slice(0, 10),
          endDate: to.endDate.toISOString().slice(0, 10),
          isPaid: to.payrollTreatmentSnapshot === 'PAID',
        })),
        rules: activeRules.map((r) => ({
          id: r.id,
          code: r.code,
          sequence: r.sequence,
          method: r.method,
          fixedAmount: r.fixedAmount ? r.fixedAmount.toString() : null,
          percentageRate: r.percentageRate ? r.percentageRate.toString() : null,
          percentageBase: r.percentageBase,
          formula: r.formula,
        })),
        bankDetails: {
          bankAccountName: employee.bankAccountName,
          bankAccountNumber: employee.bankAccountNumber,
          bankName: employee.bankName,
          bankIfsc: employee.bankIfsc,
        },
        currency: 'INR',
      });

      const fullAccount = employee.bankAccountNumber?.trim();
      const maskedAccount = fullAccount && fullAccount.length >= 4
        ? `•••• ${fullAccount.slice(-4)}`
        : fullAccount ? '••••' : null;

      await tx.payslip.update({
        where: { id: payslip.id },
        data: {
          employeeNumberSnapshot: employee.employeeNumber,
          employeeNameSnapshot: `${employee.firstName} ${employee.lastName}`.trim(),
          workEmailSnapshot: employee.workEmail,
          departmentNameSnapshot: employee.department?.name ?? null,
          jobPositionSnapshot: employee.jobPosition,
          contractNumberSnapshot: contract.contractNumber,
          structureNameSnapshot: payrun.salaryStructureName,
          scheduleIdSnapshot: effectiveSchedule.id,
          scheduleNameSnapshot: effectiveSchedule.name,
          bankAccountNameSnapshot: employee.bankAccountName,
          bankAccountMaskSnapshot: maskedAccount,
          bankNameSnapshot: employee.bankName,
          bankIfscSnapshot: employee.bankIfsc,

          monthlyWage: contract.monthlyWage,
          expectedDays: dayAggregation.expectedDays,
          workedDays: dayAggregation.workedDays,
          expectedMinutes: dayAggregation.expectedMinutes,
          workedMinutes: dayAggregation.workedMinutes,
          overtimeMinutes: dayAggregation.overtimeMinutes,

          proratedBasic: calculationResult.proratedBasic,
          basicAmount: calculationResult.basicAmount,
          allowanceAmount: calculationResult.allowanceAmount,
          overtimeAmount: calculationResult.overtimeAmount,
          deductionAmount: calculationResult.deductionAmount,
          contributionAmount: calculationResult.contributionAmount,
          grossAmount: calculationResult.grossAmount,
          netAmount: calculationResult.netAmount,

          computationInputHash,
        },
      });

      // Replace lines
      await tx.payslipLine.deleteMany({ where: { payslipId: payslip.id } });
      for (const line of calculationResult.lines) {
        await tx.payslipLine.create({
          data: {
            payslipId: payslip.id,
            salaryRuleId: line.salaryRuleId,
            name: line.name,
            code: line.code,
            category: line.category,
            sequence: line.sequence,
            method: line.method,
            amount: line.amount,
          },
        });
      }

      // Create new open warnings
      for (const w of discoveredWarnings) {
        await tx.payrollWarning.create({
          data: {
            payrunId: payrun.id,
            payslipId: payslip.id,
            type: w.type,
            status: 'OPEN',
            message: w.message,
            blocking: w.blocking,
            acknowledgeable: w.acknowledgeable,
            details: w.details,
          },
        });
      }
    }

    await tx.payrun.update({
      where: { id },
      data: {
        computedByUserId: actorUserId,
        computedAt: now,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actorUserId,
        entityType: 'Payrun',
        entityId: id,
        action: 'PAYRUN_RECOMPUTED',
        before: Prisma.JsonNull,
        after: {
          payrunNumber: payrun.payrunNumber,
          recomputedAt: now.toISOString(),
        },
      },
    });
  });

  return getPayrunById(id);
}

export async function validatePayrun(
  id: string,
  actorUserId: string
): Promise<PayrunDetailDto> {
  const payrun = await prisma.payrun.findUnique({
    where: { id },
    include: {
      payslips: {
        include: {
          lines: { orderBy: { sequence: 'asc' } },
          warnings: true,
        },
      },
      warnings: true,
      salaryStructure: {
        include: {
          rules: { where: { status: 'ACTIVE' }, orderBy: { sequence: 'asc' } },
        },
      },
    },
  });

  if (!payrun) {
    throw new AppError(404, 'PAYRUN_NOT_FOUND', 'Payrun not found');
  }

  // Idempotent repeat
  if (payrun.status === 'VALIDATED') {
    return getPayrunById(id);
  }

  if (payrun.status !== 'COMPUTED') {
    throw new AppError(
      409,
      'PAYROLL_INVALID_TRANSITION',
      `Payrun can only be validated from COMPUTED status (current: ${payrun.status})`
    );
  }

  // 1. Check for open blocking warnings across payrun
  const openBlocking = payrun.warnings.filter((w) => w.blocking && w.status === 'OPEN');
  if (openBlocking.length > 0) {
    throw new AppError(
      422,
      'PAYROLL_BLOCKING_WARNINGS',
      `Cannot validate payrun: ${openBlocking.length} open blocking warnings must be acknowledged or resolved`,
      { openBlockingWarningsCount: openBlocking.length }
    );
  }

  const activeRules = payrun.salaryStructure.rules.map((r) => ({
    id: r.id,
    code: r.code,
    sequence: r.sequence,
    method: r.method,
    fixedAmount: r.fixedAmount ? r.fixedAmount.toString() : null,
    percentageRate: r.percentageRate ? r.percentageRate.toString() : null,
    percentageBase: r.percentageBase,
    formula: r.formula,
  }));

  const now = new Date();

  return await prisma.$transaction(async (tx) => {
    for (const payslip of payrun.payslips) {
      // 2. Rebuild computation input hash and compare for staleness
      const employee = await tx.employee.findUniqueOrThrow({
        where: { id: payslip.employeeId },
        include: {
          department: true,
          workingSchedule: { include: { days: true } },
          contracts: {
            where: { id: payslip.contractId },
            include: { workingSchedule: { include: { days: true } } },
          },
        },
      });

      const contract = employee.contracts[0];
      if (!contract) {
        throw new AppError(422, 'PAYROLL_CONTRACT_INVALID', 'Contract not found');
      }

      const effectiveSchedule = contract.workingSchedule ?? employee.workingSchedule;
      if (!effectiveSchedule) {
        throw new AppError(422, 'PAYROLL_SCHEDULE_MISSING', 'Working schedule missing');
      }

      const attendances = await tx.attendance.findMany({
        where: {
          employeeId: employee.id,
          attendanceDate: { gte: payrun.periodStart, lte: payrun.periodEnd },
        },
      });

      const timeOffRequests = await tx.timeOffRequest.findMany({
        where: {
          employeeId: employee.id,
          status: 'APPROVED',
          startDate: { lte: payrun.periodEnd },
          endDate: { gte: payrun.periodStart },
        },
      });

      const freshHash = buildComputationInputHash({
        contract: {
          id: contract.id,
          startDate: contract.startDate.toISOString().slice(0, 10),
          endDate: contract.endDate ? contract.endDate.toISOString().slice(0, 10) : null,
          monthlyWage: contract.monthlyWage.toString(),
          salaryStructureId: contract.salaryStructureId,
          workingScheduleId: contract.workingScheduleId,
        },
        scheduleDays: effectiveSchedule.days.map((d) => ({
          dayOfWeek: d.dayOfWeek,
          startMinute: d.startMinute,
          endMinute: d.endMinute,
          breakMinutes: d.breakMinutes,
        })),
        attendances: attendances.map((a) => ({
          date: a.attendanceDate.toISOString().slice(0, 10),
          status: a.status,
          workedMinutes: a.workedMinutes,
          overtimeMinutes: a.overtimeMinutes,
        })),
        timeOffRequests: timeOffRequests.map((to) => ({
          startDate: to.startDate.toISOString().slice(0, 10),
          endDate: to.endDate.toISOString().slice(0, 10),
          isPaid: to.payrollTreatmentSnapshot === 'PAID',
        })),
        rules: activeRules,
        bankDetails: {
          bankAccountName: employee.bankAccountName,
          bankAccountNumber: employee.bankAccountNumber,
          bankName: employee.bankName,
          bankIfsc: employee.bankIfsc,
        },
        currency: 'INR',
      });

      if (freshHash !== payslip.computationInputHash) {
        throw new AppError(
          409,
          'PAYROLL_COMPUTATION_STALE',
          `Computation is stale for employee "${employee.firstName} ${employee.lastName}". Recompute payrun before validation.`
        );
      }

      // 3. Render official PDF buffer
      const hasAckWarnings = payslip.warnings.some((w) => w.status === 'ACKNOWLEDGED');
      const pdfBuffer = await generatePayslipPdf({
        companyName: 'PeoplePay360',
        payrunNumber: payrun.payrunNumber,
        periodStart: payrun.periodStart.toISOString().slice(0, 10),
        periodEnd: payrun.periodEnd.toISOString().slice(0, 10),
        currency: payrun.currency,
        generatedAt: now.toISOString(),
        status: 'VALIDATED',
        isPreview: false,
        employee: {
          number: payslip.employeeNumberSnapshot ?? employee.employeeNumber,
          name: payslip.employeeNameSnapshot ?? `${employee.firstName} ${employee.lastName}`.trim(),
          department: payslip.departmentNameSnapshot,
          jobPosition: payslip.jobPositionSnapshot,
        },
        contract: {
          number: payslip.contractNumberSnapshot ?? contract.contractNumber,
          structureName: payslip.structureNameSnapshot ?? payrun.salaryStructureName,
          monthlyWage: payslip.monthlyWage?.toString() ?? contract.monthlyWage.toString(),
        },
        attendance: {
          expectedDays: payslip.expectedDays ?? 0,
          workedDays: payslip.workedDays ?? 0,
          expectedHours: payslip.expectedMinutes ? (payslip.expectedMinutes / 60).toFixed(2) : '0.00',
          workedHours: payslip.workedMinutes ? (payslip.workedMinutes / 60).toFixed(2) : '0.00',
          overtimeHours: payslip.overtimeMinutes ? (payslip.overtimeMinutes / 60).toFixed(2) : '0.00',
        },
        bank: {
          accountName: payslip.bankAccountNameSnapshot,
          maskedAccountNumber: payslip.bankAccountMaskSnapshot,
          bankName: payslip.bankNameSnapshot,
          ifsc: payslip.bankIfscSnapshot,
        },
        lines: payslip.lines.map((l) => ({
          category: l.category,
          code: l.code,
          name: l.name,
          amount: l.amount.toString(),
        })),
        summaries: {
          proratedBasic: payslip.proratedBasic?.toString() ?? '0.00',
          basic: payslip.basicAmount?.toString() ?? '0.00',
          allowance: payslip.allowanceAmount?.toString() ?? '0.00',
          overtime: payslip.overtimeAmount?.toString() ?? '0.00',
          deduction: payslip.deductionAmount?.toString() ?? '0.00',
          gross: payslip.grossAmount?.toString() ?? '0.00',
          net: payslip.netAmount?.toString() ?? '0.00',
        },
        hasAcknowledgedWarnings: hasAckWarnings,
      });

      const pdfSha256 = createHash('sha256').update(pdfBuffer).digest('hex').toLowerCase();

      // Store PDF bytes and update payslip status to VALIDATED
      await tx.payslip.update({
        where: { id: payslip.id },
        data: {
          status: 'VALIDATED',
          finalPdf: new Uint8Array(pdfBuffer),
          finalPdfSha256: pdfSha256,
        },
      });
    }

    // Update Payrun status to VALIDATED
    const updatedPayrun = await tx.payrun.update({
      where: { id },
      data: {
        status: 'VALIDATED',
        validatedByUserId: actorUserId,
        validatedAt: now,
      },
      include: {
        createdByUser: true,
        computedByUser: true,
        validatedByUser: true,
        paidByUser: true,
        payslips: {
          include: { warnings: true },
          orderBy: [{ employeeNameSnapshot: 'asc' }, { id: 'asc' }],
        },
        warnings: {
          include: { acknowledgedByUser: true },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actorUserId,
        entityType: 'Payrun',
        entityId: id,
        action: 'PAYRUN_VALIDATED',
        before: Prisma.JsonNull,
        after: {
          payrunNumber: payrun.payrunNumber,
          validatedAt: now.toISOString(),
        },
      },
    });

    return toPayrunDetailDto(updatedPayrun as any);
  });
}

export async function markPaidPayrun(
  id: string,
  actorUserId: string
): Promise<PayrunDetailDto> {
  const payrun = await prisma.payrun.findUnique({
    where: { id },
  });

  if (!payrun) {
    throw new AppError(404, 'PAYRUN_NOT_FOUND', 'Payrun not found');
  }

  // Idempotent repeat
  if (payrun.status === 'PAID') {
    return getPayrunById(id);
  }

  if (payrun.status !== 'VALIDATED') {
    throw new AppError(
      409,
      'PAYROLL_INVALID_TRANSITION',
      `Payrun can only be marked PAID from VALIDATED status (current: ${payrun.status})`
    );
  }

  const now = new Date();

  return await prisma.$transaction(async (tx) => {
    await tx.payslip.updateMany({
      where: { payrunId: id },
      data: { status: 'PAID' },
    });

    const updated = await tx.payrun.update({
      where: { id },
      data: {
        status: 'PAID',
        paidByUserId: actorUserId,
        paidAt: now,
      },
      include: {
        createdByUser: true,
        computedByUser: true,
        validatedByUser: true,
        paidByUser: true,
        payslips: {
          include: { warnings: true },
          orderBy: [{ employeeNameSnapshot: 'asc' }, { id: 'asc' }],
        },
        warnings: {
          include: { acknowledgedByUser: true },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actorUserId,
        entityType: 'Payrun',
        entityId: id,
        action: 'PAYRUN_MARKED_PAID',
        before: Prisma.JsonNull,
        after: {
          payrunNumber: payrun.payrunNumber,
          paidAt: now.toISOString(),
        },
      },
    });

    return toPayrunDetailDto(updated as any);
  });
}
