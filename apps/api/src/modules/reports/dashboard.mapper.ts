import type {
  DashboardFilterOptionsDto,
  DashboardHrResponseDto,
  DashboardPayrollResponseDto,
} from './dashboard.types.js';

export function mapFilterOptionsResponse(data: DashboardFilterOptionsDto): {
  data: DashboardFilterOptionsDto;
  error: null;
} {
  return {
    data: {
      departments: data.departments.map((d) => ({
        id: d.id,
        name: d.name,
      })),
      employeeTypes: data.employeeTypes,
      minAvailableDate: data.minAvailableDate,
      maxAvailableDate: data.maxAvailableDate,
    },
    error: null,
  };
}

export function mapHrDashboardResponse(data: DashboardHrResponseDto): {
  data: DashboardHrResponseDto;
  error: null;
} {
  return {
    data: {
      headcount: data.headcount,
      attendance: {
        expectedDays: data.attendance.expectedDays,
        coveredDays: data.attendance.coveredDays,
        coveragePercent: data.attendance.coveragePercent,
        hasCoverageData: data.attendance.hasCoverageData,
        present: data.attendance.present,
        late: data.attendance.late,
        absent: data.attendance.absent,
        overtimeMinutes: data.attendance.overtimeMinutes,
        missingCheckOuts: data.attendance.missingCheckOuts,
        manualEdits: data.attendance.manualEdits,
      },
      timeOff: {
        approvedRequestCount: data.timeOff.approvedRequestCount,
        approvedDayUnits: data.timeOff.approvedDayUnits,
        approvedHourUnits: data.timeOff.approvedHourUnits,
        pendingRequestCount: data.timeOff.pendingRequestCount,
        usableAllocationCount: data.timeOff.usableAllocationCount,
      },
      departmentHeadcount: data.departmentHeadcount.map((dh) => ({
        departmentId: dh.departmentId,
        departmentName: dh.departmentName,
        headcount: dh.headcount,
      })),
      hrAlerts: data.hrAlerts.map((a) => ({
        code: a.code,
        severity: a.severity,
        count: a.count,
        label: a.label,
        safeSummary: a.safeSummary,
        deepLink: a.deepLink,
      })),
    },
    error: null,
  };
}

export function mapPayrollDashboardResponse(data: DashboardPayrollResponseDto): {
  data: DashboardPayrollResponseDto;
  error: null;
} {
  return {
    data: {
      totalNetSalaryPaid: data.totalNetSalaryPaid,
      payslipsGenerated: data.payslipsGenerated,
      averagePaidSalary: data.averagePaidSalary,
      salaryCostByDepartment: data.salaryCostByDepartment.map((sc) => ({
        departmentId: sc.departmentId,
        departmentName: sc.departmentName,
        totalPaidNet: sc.totalPaidNet,
        paidPayslipCount: sc.paidPayslipCount,
      })),
      monthlyNetSalaryTrend: data.monthlyNetSalaryTrend.map((t) => ({
        month: t.month,
        totalPaidNet: t.totalPaidNet,
        paidPayslipCount: t.paidPayslipCount,
      })),
      payrunStatusCounts: {
        draft: data.payrunStatusCounts.draft,
        computed: data.payrunStatusCounts.computed,
        validated: data.payrunStatusCounts.validated,
        paid: data.payrunStatusCounts.paid,
      },
      warningCounts: {
        byType: { ...data.warningCounts.byType },
        byStatus: { ...data.warningCounts.byStatus },
        blockingCount: data.warningCounts.blockingCount,
        nonBlockingCount: data.warningCounts.nonBlockingCount,
      },
      deliveryCounts: {
        pending: data.deliveryCounts.pending,
        sent: data.deliveryCounts.sent,
        failed: data.deliveryCounts.failed,
        unknown: data.deliveryCounts.unknown,
      },
      payrollAlerts: data.payrollAlerts.map((a) => ({
        code: a.code,
        severity: a.severity,
        count: a.count,
        label: a.label,
        safeSummary: a.safeSummary,
        deepLink: a.deepLink,
      })),
    },
    error: null,
  };
}
