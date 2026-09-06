import type { EmployeeType } from './employees.js';

export interface DashboardFilters {
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD
  departmentId?: string;
  employeeType?: EmployeeType;
}

export interface DashboardFilterOptionsDto {
  departments: Array<{ id: string; name: string }>;
  employeeTypes: EmployeeType[];
  minAvailableDate: string | null;
  maxAvailableDate: string | null;
}

export type DashboardAlertSeverity = 'warning' | 'error' | 'info';

export interface DashboardAlertItemDto {
  code: string;
  severity: DashboardAlertSeverity;
  count: number;
  label: string;
  safeSummary: string;
  deepLink: string;
}

export interface DashboardAttendanceSectionDto {
  expectedDays: number;
  coveredDays: number;
  coveragePercent: string;
  hasCoverageData: boolean;
  present: number;
  late: number;
  absent: number;
  overtimeMinutes: number;
  missingCheckOuts: number;
  manualEdits: number;
}

export interface DashboardTimeOffSectionDto {
  approvedRequestCount: number;
  approvedDayUnits: string;
  approvedHourUnits: string;
  pendingRequestCount: number;
  usableAllocationCount: number;
}

export interface DepartmentHeadcountDto {
  departmentId: string | null;
  departmentName: string;
  headcount: number;
}

export interface DashboardHrResponseDto {
  headcount: number;
  attendance: DashboardAttendanceSectionDto;
  timeOff: DashboardTimeOffSectionDto;
  departmentHeadcount: DepartmentHeadcountDto[];
  hrAlerts: DashboardAlertItemDto[];
}

export interface SalaryCostByDepartmentDto {
  departmentId: string | null;
  departmentName: string;
  totalPaidNet: string;
  paidPayslipCount: number;
}

export interface MonthlyNetSalaryTrendDto {
  month: string; // YYYY-MM
  totalPaidNet: string;
  paidPayslipCount: number;
}

export interface PayrunStatusCountsDto {
  draft: number;
  computed: number;
  validated: number;
  paid: number;
}

export interface WarningCountsDto {
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  blockingCount: number;
  nonBlockingCount: number;
}

export interface DeliveryCountsDto {
  pending: number;
  sent: number;
  failed: number;
  unknown: number;
}

export interface DashboardPayrollResponseDto {
  totalNetSalaryPaid: string;
  payslipsGenerated: number;
  averagePaidSalary: string;
  salaryCostByDepartment: SalaryCostByDepartmentDto[];
  monthlyNetSalaryTrend: MonthlyNetSalaryTrendDto[];
  payrunStatusCounts: PayrunStatusCountsDto;
  warningCounts: WarningCountsDto;
  deliveryCounts: DeliveryCountsDto;
  payrollAlerts: DashboardAlertItemDto[];
}
