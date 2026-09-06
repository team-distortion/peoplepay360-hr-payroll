import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import { Prisma, PayrollStatus, PayrollWarningStatus, PayrollWarningType } from '@prisma/client';
import type { DashboardFiltersQuery } from './dashboard.schemas.js';
import type {
  DashboardPayrollResponseDto,
  SalaryCostByDepartmentDto,
  MonthlyNetSalaryTrendDto,
  PayrunStatusCountsDto,
  WarningCountsDto,
  DeliveryCountsDto,
  DashboardAlertItemDto,
} from './dashboard.types.js';
import { toMonthKey } from './dashboard-date.service.js';

export async function getDashboardPayrollMetrics(
  filters: DashboardFiltersQuery
): Promise<DashboardPayrollResponseDto> {
  const { periodStart, periodEnd, departmentId, employeeType } = filters;

  // Validate department if provided
  if (departmentId) {
    const dept = await prisma.department.findUnique({
      where: { id: departmentId },
    });
    if (!dept) {
      throw new AppError(404, 'DEPARTMENT_NOT_FOUND', 'Department not found');
    }
  }

  const periodStartDate = new Date(periodStart);
  const periodEndDate = new Date(periodEnd);

  // Payslip filtering semantics:
  // complete payroll period contained within selected period
  // Department and Employee Type use immutable snapshots
  const payslipBaseWhere: Prisma.PayslipWhereInput = {
    periodStart: { gte: periodStartDate },
    periodEnd: { lte: periodEndDate },
    ...(departmentId ? { departmentIdSnapshot: departmentId } : {}),
    ...(employeeType ? { employeeTypeSnapshot: employeeType } : {}),
  };

  // 1. Payslips Generated (COMPUTED, VALIDATED, PAID - Draft excluded)
  const payslipsGenerated = await prisma.payslip.count({
    where: {
      ...payslipBaseWhere,
      status: {
        in: [PayrollStatus.COMPUTED, PayrollStatus.VALIDATED, PayrollStatus.PAID],
      },
    },
  });

  // 2. Paid Payslips: Total Net, Average, Trends, Department Cost
  const paidPayslips = await prisma.payslip.findMany({
    where: {
      ...payslipBaseWhere,
      status: PayrollStatus.PAID,
    },
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      netAmount: true,
      departmentIdSnapshot: true,
      departmentNameSnapshot: true,
      employeeTypeSnapshot: true,
    },
  });

  let totalNetPaidDecimal = new Prisma.Decimal(0);
  const deptCostMap = new Map<
    string,
    { id: string | null; name: string; total: Prisma.Decimal; count: number }
  >();
  const monthlyTrendMap = new Map<
    string,
    { month: string; total: Prisma.Decimal; count: number }
  >();

  for (const p of paidPayslips) {
    const net = p.netAmount ?? new Prisma.Decimal(0);
    totalNetPaidDecimal = totalNetPaidDecimal.plus(net);

    // Group by Department snapshot
    const deptKey = p.departmentIdSnapshot ?? 'unassigned';
    const deptName = p.departmentNameSnapshot ?? 'Unassigned';
    const existingDept = deptCostMap.get(deptKey);
    if (existingDept) {
      existingDept.total = existingDept.total.plus(net);
      existingDept.count++;
    } else {
      deptCostMap.set(deptKey, {
        id: p.departmentIdSnapshot,
        name: deptName,
        total: net,
        count: 1,
      });
    }

    // Group by Month (YYYY-MM) based on periodStart
    const monthKey = toMonthKey(p.periodStart);
    const existingMonth = monthlyTrendMap.get(monthKey);
    if (existingMonth) {
      existingMonth.total = existingMonth.total.plus(net);
      existingMonth.count++;
    } else {
      monthlyTrendMap.set(monthKey, {
        month: monthKey,
        total: net,
        count: 1,
      });
    }
  }

  const paidCount = paidPayslips.length;
  const totalNetSalaryPaid = totalNetPaidDecimal.toFixed(2);
  const averagePaidSalary =
    paidCount > 0 ? totalNetPaidDecimal.dividedBy(paidCount).toFixed(2) : '0.00';

  // Department salary cost array with deterministic sort (name asc)
  const salaryCostByDepartment: SalaryCostByDepartmentDto[] = Array.from(
    deptCostMap.values()
  )
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((d) => ({
      departmentId: d.id,
      departmentName: d.name,
      totalPaidNet: d.total.toFixed(2),
      paidPayslipCount: d.count,
    }));

  // Monthly net salary trend array with chronological sort
  const monthlyNetSalaryTrend: MonthlyNetSalaryTrendDto[] = Array.from(
    monthlyTrendMap.values()
  )
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({
      month: m.month,
      totalPaidNet: m.total.toFixed(2),
      paidPayslipCount: m.count,
    }));

  // 3. Payrun Status Counts (payruns intersecting the selected period)
  const payrunsInPeriod = await prisma.payrun.findMany({
    where: {
      periodStart: { lte: periodEndDate },
      periodEnd: { gte: periodStartDate },
    },
    select: {
      id: true,
      status: true,
    },
  });

  const payrunStatusCounts: PayrunStatusCountsDto = {
    draft: 0,
    computed: 0,
    validated: 0,
    paid: 0,
  };

  const payrunIds = payrunsInPeriod.map((pr) => pr.id);

  for (const pr of payrunsInPeriod) {
    if (pr.status === PayrollStatus.DRAFT) payrunStatusCounts.draft++;
    else if (pr.status === PayrollStatus.COMPUTED) payrunStatusCounts.computed++;
    else if (pr.status === PayrollStatus.VALIDATED) payrunStatusCounts.validated++;
    else if (pr.status === PayrollStatus.PAID) payrunStatusCounts.paid++;
  }

  // 4. Warning Counts
  const warningCounts: WarningCountsDto = {
    byType: {},
    byStatus: {
      OPEN: 0,
      ACKNOWLEDGED: 0,
      RESOLVED: 0,
    },
    blockingCount: 0,
    nonBlockingCount: 0,
  };

  let openBlockingWarningCount = 0;
  let duplicateWarningCount = 0;
  let missingBankDetailsWarningCount = 0;

  if (payrunIds.length > 0) {
    const warnings = await prisma.payrollWarning.findMany({
      where: {
        payrunId: { in: payrunIds },
        payslip: payslipBaseWhere,
      },
      select: {
        id: true,
        type: true,
        status: true,
        blocking: true,
      },
    });

    for (const w of warnings) {
      // byType
      warningCounts.byType[w.type] = (warningCounts.byType[w.type] ?? 0) + 1;

      // byStatus
      warningCounts.byStatus[w.status] = (warningCounts.byStatus[w.status] ?? 0) + 1;

      // blocking / non-blocking
      if (w.blocking) {
        warningCounts.blockingCount++;
        if (w.status === PayrollWarningStatus.OPEN) {
          openBlockingWarningCount++;
        }
      } else {
        warningCounts.nonBlockingCount++;
      }

      if (w.status === PayrollWarningStatus.OPEN) {
        if (w.type === PayrollWarningType.MISSING_BANK_DETAILS) {
          missingBankDetailsWarningCount++;
        }
        if (
          w.type === PayrollWarningType.ATTENDANCE_TIME_OFF_CONFLICT ||
          w.type === PayrollWarningType.ATTENDANCE_SCHEDULE_MISMATCH
        ) {
          duplicateWarningCount++;
        }
      }
    }
  }

  // 5. Delivery Counts (Safe clean stubs per instruction: no mailing)
  const deliveryCounts: DeliveryCountsDto = {
    pending: 0,
    sent: 0,
    failed: 0,
    unknown: 0,
  };

  // 6. Payroll Alerts
  const payrollAlerts: DashboardAlertItemDto[] = [];

  // A. DRAFT_PAYRUN
  if (payrunStatusCounts.draft > 0) {
    payrollAlerts.push({
      code: 'DRAFT_PAYRUN',
      severity: 'warning',
      count: payrunStatusCounts.draft,
      label: 'Draft Payruns',
      safeSummary: `${payrunStatusCounts.draft} draft payrun(s) awaiting processing in selected period`,
      deepLink: '/payroll/payruns',
    });
  }

  // B. OPEN_BLOCKING_PAYROLL_WARNING
  if (openBlockingWarningCount > 0) {
    payrollAlerts.push({
      code: 'OPEN_BLOCKING_PAYROLL_WARNING',
      severity: 'error',
      count: openBlockingWarningCount,
      label: 'Blocking Payroll Warnings',
      safeSummary: `${openBlockingWarningCount} open blocking warning(s) preventing payrun validation`,
      deepLink: '/payroll/payruns',
    });
  }

  // C. DUPLICATE_PAYSLIP_WARNING
  if (duplicateWarningCount > 0) {
    payrollAlerts.push({
      code: 'DUPLICATE_PAYSLIP_WARNING',
      severity: 'warning',
      count: duplicateWarningCount,
      label: 'Schedule & Time Off Conflicts',
      safeSummary: `${duplicateWarningCount} attendance/time-off schedule conflict(s) detected`,
      deepLink: '/payroll/payruns',
    });
  }

  // D. INCOMPLETE_EMPLOYEE_PAYROLL_DATA
  if (missingBankDetailsWarningCount > 0) {
    payrollAlerts.push({
      code: 'INCOMPLETE_EMPLOYEE_PAYROLL_DATA',
      severity: 'error',
      count: missingBankDetailsWarningCount,
      label: 'Missing Bank Details',
      safeSummary: `${missingBankDetailsWarningCount} employee(s) missing bank details for payroll`,
      deepLink: '/employees',
    });
  }

  return {
    totalNetSalaryPaid,
    payslipsGenerated,
    averagePaidSalary,
    salaryCostByDepartment,
    monthlyNetSalaryTrend,
    payrunStatusCounts,
    warningCounts,
    deliveryCounts,
    payrollAlerts,
  };
}
