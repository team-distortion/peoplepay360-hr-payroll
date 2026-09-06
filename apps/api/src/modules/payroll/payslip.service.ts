import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import { generatePayslipPdf } from './payslip-pdf.service.js';
import {
  toPayslipListItemDto,
  toPayslipDetailDto,
  toPayrollWarningDto,
} from './payroll.mapper.js';
import type {
  ListPayslipsQuery,
  PayslipDetailDto,
  PayslipListResponse,
  PayrollWarningDto,
} from '@peoplepay360/shared';
import { Prisma } from '@prisma/client';

export async function listPayslips(query: ListPayslipsQuery): Promise<PayslipListResponse> {
  const page = query.page && query.page >= 1 ? query.page : 1;
  const pageSize = query.pageSize && query.pageSize >= 1 && query.pageSize <= 100 ? query.pageSize : 20;
  const skip = (page - 1) * pageSize;

  const where: Prisma.PayslipWhereInput = {};

  if (query.payrunId) {
    where.payrunId = query.payrunId;
  }

  if (query.employeeId) {
    where.employeeId = query.employeeId;
  }

  if (query.department) {
    where.departmentNameSnapshot = { contains: query.department, mode: 'insensitive' };
  }

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

  if (query.warningType) {
    where.warnings = { some: { type: query.warningType } };
  }

  if (query.search && query.search.trim().length > 0) {
    const term = query.search.trim();
    where.OR = [
      { employeeNameSnapshot: { contains: term, mode: 'insensitive' } },
      { employeeNumberSnapshot: { contains: term, mode: 'insensitive' } },
      { payrun: { payrunNumber: { contains: term, mode: 'insensitive' } } },
    ];
  }

  const orderBy: Prisma.PayslipOrderByWithRelationInput[] = [];
  if (query.sort === 'employee') {
    orderBy.push({ employeeNameSnapshot: query.order });
  } else if (query.sort === 'grossAmount') {
    orderBy.push({ grossAmount: query.order });
  } else if (query.sort === 'netAmount') {
    orderBy.push({ netAmount: query.order });
  } else if (query.sort === 'status') {
    orderBy.push({ status: query.order });
  } else {
    orderBy.push({ periodStart: 'desc' }, { employeeNameSnapshot: 'asc' }, { id: 'asc' });
  }

  const [totalItems, payslips] = await Promise.all([
    prisma.payslip.count({ where }),
    prisma.payslip.findMany({
      where,
      include: {
        payrun: { select: { payrunNumber: true } },
        warnings: true,
      },
      orderBy,
      skip,
      take: pageSize,
    }),
  ]);

  const items = payslips.map(toPayslipListItemDto);
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

export async function getPayslipById(id: string): Promise<PayslipDetailDto> {
  const payslip = await prisma.payslip.findUnique({
    where: { id },
    include: {
      payrun: { select: { payrunNumber: true } },
      lines: { orderBy: { sequence: 'asc' } },
      warnings: {
        include: { acknowledgedByUser: true },
        orderBy: [{ createdAt: 'asc' }],
      },
    },
  });

  if (!payslip) {
    throw new AppError(404, 'PAYSLIP_NOT_FOUND', `Payslip with ID "${id}" was not found`);
  }

  return toPayslipDetailDto(payslip);
}

export async function getPayslipPdf(
  id: string
): Promise<{ buffer: Buffer; filename: string; isPreview: boolean }> {
  const payslip = await prisma.payslip.findUnique({
    where: { id },
    include: {
      payrun: { select: { payrunNumber: true, currency: true } },
      lines: { orderBy: { sequence: 'asc' } },
      warnings: true,
    },
  });

  if (!payslip) {
    throw new AppError(404, 'PAYSLIP_NOT_FOUND', 'Payslip not found');
  }

  if (payslip.status === 'DRAFT') {
    throw new AppError(
      409,
      'PAYROLL_INVALID_TRANSITION',
      'Cannot generate PDF for a Draft payslip before computation'
    );
  }

  const empNumber = payslip.employeeNumberSnapshot ?? 'EMP';
  const pStart = payslip.periodStart.toISOString().slice(0, 10);
  const filename = `Payslip-${empNumber}-${pStart}.pdf`;

  // If already Validated or Paid, return stored final PDF
  if (payslip.status === 'VALIDATED' || payslip.status === 'PAID') {
    if (payslip.finalPdf) {
      return {
        buffer: Buffer.from(payslip.finalPdf),
        filename,
        isPreview: false,
      };
    }
  }

  // Otherwise, if Computed, render live preview with watermark
  const hasAckWarnings = payslip.warnings.some((w) => w.status === 'ACKNOWLEDGED');
  const buffer = await generatePayslipPdf({
    companyName: 'PeoplePay360',
    payrunNumber: payslip.payrun?.payrunNumber ?? '',
    periodStart: pStart,
    periodEnd: payslip.periodEnd.toISOString().slice(0, 10),
    currency: payslip.payrun?.currency ?? 'INR',
    generatedAt: new Date().toISOString(),
    status: payslip.status,
    isPreview: payslip.status === 'COMPUTED',
    employee: {
      number: payslip.employeeNumberSnapshot ?? '',
      name: payslip.employeeNameSnapshot ?? '',
      department: payslip.departmentNameSnapshot,
      jobPosition: payslip.jobPositionSnapshot,
    },
    contract: {
      number: payslip.contractNumberSnapshot ?? '',
      structureName: payslip.structureNameSnapshot ?? '',
      monthlyWage: payslip.monthlyWage?.toString() ?? '0.00',
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

  return {
    buffer,
    filename,
    isPreview: payslip.status === 'COMPUTED',
  };
}

export async function acknowledgeWarning(
  warningId: string,
  actorUserId: string,
  reason: string
): Promise<PayrollWarningDto> {
  const warning = await prisma.payrollWarning.findUnique({
    where: { id: warningId },
    include: {
      payrun: { select: { status: true } },
      acknowledgedByUser: true,
    },
  });

  if (!warning) {
    throw new AppError(404, 'PAYROLL_WARNING_NOT_FOUND', 'Payroll warning not found');
  }

  if (warning.payrun.status !== 'COMPUTED') {
    throw new AppError(
      409,
      'PAYROLL_INVALID_TRANSITION',
      'Warnings can only be acknowledged while parent payrun is COMPUTED'
    );
  }

  if (!warning.acknowledgeable) {
    throw new AppError(
      422,
      'PAYROLL_WARNING_NOT_ACKNOWLEDGEABLE',
      'This warning is not acknowledgeable'
    );
  }

  const trimmedReason = reason.trim();

  // If already acknowledged
  if (warning.status === 'ACKNOWLEDGED') {
    if (warning.acknowledgementReason === trimmedReason) {
      return toPayrollWarningDto(warning);
    }
    throw new AppError(
      409,
      'PAYROLL_WARNING_ALREADY_ACKNOWLEDGED',
      'Warning is already acknowledged; replacing reason is forbidden'
    );
  }

  const now = new Date();

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.payrollWarning.update({
      where: { id: warningId },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedByUserId: actorUserId,
        acknowledgedAt: now,
        acknowledgementReason: trimmedReason,
      },
      include: {
        acknowledgedByUser: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actorUserId,
        entityType: 'PayrollWarning',
        entityId: warningId,
        action: 'PAYROLL_WARNING_ACKNOWLEDGED',
        before: Prisma.JsonNull,
        after: {
          warningType: warning.type,
          reason: trimmedReason,
          acknowledgedAt: now.toISOString(),
        },
      },
    });

    return toPayrollWarningDto(updated);
  });
}
