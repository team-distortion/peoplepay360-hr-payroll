import type {
  PayrunListItemDto,
  PayrunDetailDto,
  PayslipListItemDto,
  PayslipDetailDto,
  PayslipLineDto,
  PayrollWarningDto,
} from '@peoplepay360/shared';
import type {
  Payrun,
  Payslip,
  PayslipLine,
  PayrollWarning,
  User,
} from '@prisma/client';

export function toPayrollWarningDto(
  warning: PayrollWarning & { acknowledgedByUser?: User | null }
): PayrollWarningDto {
  return {
    id: warning.id,
    payrunId: warning.payrunId,
    payslipId: warning.payslipId,
    type: warning.type,
    status: warning.status,
    message: warning.message,
    blocking: warning.blocking,
    acknowledgeable: warning.acknowledgeable,
    details: (warning.details as Record<string, any>) ?? null,
    acknowledgedByUserId: warning.acknowledgedByUserId,
    acknowledgedByUserName: warning.acknowledgedByUser
      ? warning.acknowledgedByUser.email
      : null,
    acknowledgedAt: warning.acknowledgedAt
      ? warning.acknowledgedAt.toISOString()
      : null,
    acknowledgementReason: warning.acknowledgementReason,
    resolvedAt: warning.resolvedAt ? warning.resolvedAt.toISOString() : null,
    createdAt: warning.createdAt.toISOString(),
  };
}

export function toPayslipLineDto(line: PayslipLine): PayslipLineDto {
  return {
    id: line.id,
    payslipId: line.payslipId,
    salaryRuleId: line.salaryRuleId,
    name: line.name,
    code: line.code,
    category: line.category,
    sequence: line.sequence,
    method: line.method,
    amount: line.amount.toString(),
  };
}

export function toPayslipListItemDto(
  payslip: Payslip & {
    payrun?: { payrunNumber: string } | null;
    warnings?: PayrollWarning[];
  }
): PayslipListItemDto {
  const hasWarnings = (payslip.warnings && payslip.warnings.length > 0) || false;
  const hasPdf = !!payslip.finalPdfSha256;

  return {
    id: payslip.id,
    payrunId: payslip.payrunId,
    payrunNumber: payslip.payrun?.payrunNumber ?? '',
    employeeId: payslip.employeeId,
    employeeNumber: payslip.employeeNumberSnapshot ?? '',
    employeeName: payslip.employeeNameSnapshot ?? '',
    departmentName: payslip.departmentNameSnapshot ?? null,
    periodStart: payslip.periodStart.toISOString().slice(0, 10),
    periodEnd: payslip.periodEnd.toISOString().slice(0, 10),
    status: payslip.status,
    currency: 'INR',
    grossAmount: payslip.grossAmount ? payslip.grossAmount.toString() : null,
    netAmount: payslip.netAmount ? payslip.netAmount.toString() : null,
    hasWarnings,
    hasPdf,
    createdAt: payslip.createdAt.toISOString(),
  };
}

export function toPayslipDetailDto(
  payslip: Payslip & {
    payrun?: { payrunNumber: string } | null;
    lines?: PayslipLine[];
    warnings?: (PayrollWarning & { acknowledgedByUser?: User | null })[];
  }
): PayslipDetailDto {
  return {
    id: payslip.id,
    payrunId: payslip.payrunId,
    payrunNumber: payslip.payrun?.payrunNumber ?? '',
    employeeId: payslip.employeeId,
    contractId: payslip.contractId,
    salaryStructureId: payslip.salaryStructureId,
    periodStart: payslip.periodStart.toISOString().slice(0, 10),
    periodEnd: payslip.periodEnd.toISOString().slice(0, 10),
    status: payslip.status,
    currency: 'INR',

    employeeNumberSnapshot: payslip.employeeNumberSnapshot,
    employeeNameSnapshot: payslip.employeeNameSnapshot,
    workEmailSnapshot: payslip.workEmailSnapshot,
    departmentNameSnapshot: payslip.departmentNameSnapshot,
    jobPositionSnapshot: payslip.jobPositionSnapshot,
    contractNumberSnapshot: payslip.contractNumberSnapshot,
    structureNameSnapshot: payslip.structureNameSnapshot,
    scheduleIdSnapshot: payslip.scheduleIdSnapshot,
    scheduleNameSnapshot: payslip.scheduleNameSnapshot,
    bankAccountNameSnapshot: payslip.bankAccountNameSnapshot,
    bankAccountMaskSnapshot: payslip.bankAccountMaskSnapshot,
    bankNameSnapshot: payslip.bankNameSnapshot,
    bankIfscSnapshot: payslip.bankIfscSnapshot,

    monthlyWage: payslip.monthlyWage ? payslip.monthlyWage.toString() : null,
    expectedDays: payslip.expectedDays,
    workedDays: payslip.workedDays,
    expectedMinutes: payslip.expectedMinutes,
    workedMinutes: payslip.workedMinutes,
    overtimeMinutes: payslip.overtimeMinutes,
    proratedBasic: payslip.proratedBasic ? payslip.proratedBasic.toString() : null,
    basicAmount: payslip.basicAmount ? payslip.basicAmount.toString() : null,
    allowanceAmount: payslip.allowanceAmount ? payslip.allowanceAmount.toString() : null,
    overtimeAmount: payslip.overtimeAmount ? payslip.overtimeAmount.toString() : null,
    deductionAmount: payslip.deductionAmount ? payslip.deductionAmount.toString() : null,
    contributionAmount: payslip.contributionAmount ? payslip.contributionAmount.toString() : null,
    grossAmount: payslip.grossAmount ? payslip.grossAmount.toString() : null,
    netAmount: payslip.netAmount ? payslip.netAmount.toString() : null,

    computationInputHash: payslip.computationInputHash,
    finalPdfSha256: payslip.finalPdfSha256,
    hasFinalPdf: !!payslip.finalPdfSha256,

    lines: payslip.lines ? payslip.lines.map(toPayslipLineDto) : [],
    warnings: payslip.warnings ? payslip.warnings.map(toPayrollWarningDto) : [],
    createdAt: payslip.createdAt.toISOString(),
    updatedAt: payslip.updatedAt.toISOString(),
  };
}

export function toPayrunListItemDto(
  payrun: Payrun & {
    payslips?: { status: string; grossAmount: any; netAmount: any }[];
    warnings?: { blocking: boolean; status: string }[];
  }
): PayrunListItemDto {
  const payslips = payrun.payslips ?? [];
  const warnings = payrun.warnings ?? [];

  const draftPayslips = payslips.filter((p) => p.status === 'DRAFT').length;
  const computedPayslips = payslips.filter((p) => p.status === 'COMPUTED').length;
  const validatedPayslips = payslips.filter((p) => p.status === 'VALIDATED').length;
  const paidPayslips = payslips.filter((p) => p.status === 'PAID').length;

  let grossSum = 0;
  let netSum = 0;
  let hasTotals = payrun.status !== 'DRAFT';

  if (hasTotals) {
    for (const p of payslips) {
      if (p.grossAmount) grossSum += Number(p.grossAmount);
      if (p.netAmount) netSum += Number(p.netAmount);
    }
  }

  const openBlockingWarningsCount = warnings.filter(
    (w) => w.blocking && w.status === 'OPEN'
  ).length;

  return {
    id: payrun.id,
    payrunNumber: payrun.payrunNumber,
    name: payrun.name,
    salaryStructureId: payrun.salaryStructureId,
    salaryStructureName: payrun.salaryStructureName,
    periodStart: payrun.periodStart.toISOString().slice(0, 10),
    periodEnd: payrun.periodEnd.toISOString().slice(0, 10),
    currency: payrun.currency,
    status: payrun.status,
    totalPayslips: payslips.length,
    draftPayslips,
    computedPayslips,
    validatedPayslips,
    paidPayslips,
    grossTotal: hasTotals ? grossSum.toFixed(2) : null,
    netTotal: hasTotals ? netSum.toFixed(2) : null,
    openBlockingWarningsCount,
    totalWarningsCount: warnings.length,
    createdAt: payrun.createdAt.toISOString(),
  };
}

export function toPayrunDetailDto(
  payrun: Payrun & {
    createdByUser: User;
    computedByUser?: User | null;
    validatedByUser?: User | null;
    paidByUser?: User | null;
    payslips: (Payslip & {
      payrun?: { payrunNumber: string } | null;
      warnings?: PayrollWarning[];
    })[];
    warnings: (PayrollWarning & { acknowledgedByUser?: User | null })[];
  }
): PayrunDetailDto {
  const payslips = payrun.payslips ?? [];
  const warnings = payrun.warnings ?? [];

  const draftPayslips = payslips.filter((p) => p.status === 'DRAFT').length;
  const computedPayslips = payslips.filter((p) => p.status === 'COMPUTED').length;
  const validatedPayslips = payslips.filter((p) => p.status === 'VALIDATED').length;
  const paidPayslips = payslips.filter((p) => p.status === 'PAID').length;

  let grossSum = 0;
  let netSum = 0;
  const hasTotals = payrun.status !== 'DRAFT';

  if (hasTotals) {
    for (const p of payslips) {
      if (p.grossAmount) grossSum += Number(p.grossAmount);
      if (p.netAmount) netSum += Number(p.netAmount);
    }
  }

  const openBlockingWarningsCount = warnings.filter(
    (w) => w.blocking && w.status === 'OPEN'
  ).length;

  return {
    id: payrun.id,
    payrunNumber: payrun.payrunNumber,
    name: payrun.name,
    salaryStructureId: payrun.salaryStructureId,
    salaryStructureName: payrun.salaryStructureName,
    periodStart: payrun.periodStart.toISOString().slice(0, 10),
    periodEnd: payrun.periodEnd.toISOString().slice(0, 10),
    currency: payrun.currency,
    status: payrun.status,

    createdByUser: {
      id: payrun.createdByUser.id,
      name: payrun.createdByUser.email,
      email: payrun.createdByUser.email,
    },
    computedByUser: payrun.computedByUser
      ? {
          id: payrun.computedByUser.id,
          name: payrun.computedByUser.email,
          email: payrun.computedByUser.email,
        }
      : null,
    computedAt: payrun.computedAt ? payrun.computedAt.toISOString() : null,
    validatedByUser: payrun.validatedByUser
      ? {
          id: payrun.validatedByUser.id,
          name: payrun.validatedByUser.email,
          email: payrun.validatedByUser.email,
        }
      : null,
    validatedAt: payrun.validatedAt ? payrun.validatedAt.toISOString() : null,
    paidByUser: payrun.paidByUser
      ? {
          id: payrun.paidByUser.id,
          name: payrun.paidByUser.email,
          email: payrun.paidByUser.email,
        }
      : null,
    paidAt: payrun.paidAt ? payrun.paidAt.toISOString() : null,

    totalPayslips: payslips.length,
    draftPayslips,
    computedPayslips,
    validatedPayslips,
    paidPayslips,
    grossTotal: hasTotals ? grossSum.toFixed(2) : null,
    netTotal: hasTotals ? netSum.toFixed(2) : null,

    openBlockingWarningsCount,
    totalWarningsCount: warnings.length,

    payslips: payslips.map(toPayslipListItemDto),
    warnings: warnings.map(toPayrollWarningDto),
    createdAt: payrun.createdAt.toISOString(),
    updatedAt: payrun.updatedAt.toISOString(),
  };
}
