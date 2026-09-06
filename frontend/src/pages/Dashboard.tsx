import { useMemo, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/context/AuthContext';
import {
  useDashboardFilters,
  useDashboardHr,
  useDashboardPayroll,
} from '@/features/dashboard/dashboard.queries';
import type { DashboardFilters, EmployeeType } from '@peoplepay360/shared';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import {
  Users,
  IndianRupee,
  CalendarCheck,
  Clock,
  CalendarOff,
  AlertTriangle,
  TrendingUp,
  FileText,
  Building2,
  Filter,
  RotateCcw,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

/* ─── Design Tokens ─────────────────────────────────────────── */
const T = {
  bg: '#FFFFFF',
  surface: '#F6F9FC',
  navy: '#0A2540',
  slate: '#425466',
  muted: '#697386',
  border: '#E3E8EE',
  accent: '#635BFF',
  accentSoft: '#EDECFF',
  gradientEnd: '#00D4FF',
  success: '#3ECF8E',
  successSoft: '#E8FBF4',
  error: '#DF1B41',
  errorSoft: '#FDF0F2',
  warning: '#FFA940',
  warningSoft: '#FFF6EB',
};

/* ─── Currency & Number Formatting Helpers ─────────────────── */
function formatINR(valueStr?: string | number | null): string {
  if (valueStr === undefined || valueStr === null) return '₹0.00';
  const num = typeof valueStr === 'number' ? valueStr : parseFloat(valueStr);
  if (isNaN(num)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatMinutesToHours(minutes: number): string {
  if (!minutes || minutes <= 0) return '0h';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function getDefaultPeriod(): { periodStart: string; periodEnd: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const end = new Date(Date.UTC(y, m + 1, 0));
  const startStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const endStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(end.getUTCDate()).padStart(2, '0')}`;
  return { periodStart: startStr, periodEnd: endStr };
}

/* ─── Main Dashboard Component ─────────────────────────────── */
export default function Dashboard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const isPayrollRole =
    user?.role === 'ADMIN' ||
    user?.role === 'HR_PAYROLL_USER' ||
    user?.role === 'HR_PAYROLL_MANAGER';

  // 1. Parse active filters from URL query parameters
  const defaults = useMemo(() => getDefaultPeriod(), []);

  const periodStart = searchParams.get('periodStart') || defaults.periodStart;
  const periodEnd = searchParams.get('periodEnd') || defaults.periodEnd;
  const departmentId = searchParams.get('departmentId') || '';
  const employeeType = (searchParams.get('employeeType') as EmployeeType) || '';

  const activeFilters: DashboardFilters = useMemo(
    () => ({
      periodStart,
      periodEnd,
      departmentId: departmentId || undefined,
      employeeType: employeeType || undefined,
    }),
    [periodStart, periodEnd, departmentId, employeeType]
  );

  // Update URL helper
  const updateFilters = useCallback(
    (newFilters: Partial<Record<'periodStart' | 'periodEnd' | 'departmentId' | 'employeeType', string>>) => {
      const updated = new URLSearchParams(searchParams);
      Object.entries(newFilters).forEach(([k, v]) => {
        if (v) {
          updated.set(k, v);
        } else {
          updated.delete(k);
        }
      });
      setSearchParams(updated, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  // Date Presets
  const handlePreset = useCallback(
    (preset: 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'ytd') => {
      const now = new Date();
      const y = now.getUTCFullYear();
      const m = now.getUTCMonth(); // 0-indexed

      let startStr = '';
      let endStr = '';

      if (preset === 'thisMonth') {
        const lastDay = new Date(Date.UTC(y, m + 1, 0));
        startStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
        endStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay.getUTCDate()).padStart(2, '0')}`;
      } else if (preset === 'lastMonth') {
        const prevM = m === 0 ? 11 : m - 1;
        const prevY = m === 0 ? y - 1 : y;
        const lastDay = new Date(Date.UTC(prevY, prevM + 1, 0));
        startStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-01`;
        endStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(lastDay.getUTCDate()).padStart(2, '0')}`;
      } else if (preset === 'thisQuarter') {
        const qStartMonth = Math.floor(m / 3) * 3;
        const qEndMonth = qStartMonth + 2;
        const lastDay = new Date(Date.UTC(y, qEndMonth + 1, 0));
        startStr = `${y}-${String(qStartMonth + 1).padStart(2, '0')}-01`;
        endStr = `${y}-${String(qEndMonth + 1).padStart(2, '0')}-${String(lastDay.getUTCDate()).padStart(2, '0')}`;
      } else if (preset === 'ytd') {
        const lastDay = new Date(Date.UTC(y, m + 1, 0));
        startStr = `${y}-01-01`;
        endStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay.getUTCDate()).padStart(2, '0')}`;
      }

      updateFilters({ periodStart: startStr, periodEnd: endStr });
    },
    [updateFilters]
  );

  const handleResetFilters = useCallback(() => {
    const updated = new URLSearchParams();
    updated.set('periodStart', defaults.periodStart);
    updated.set('periodEnd', defaults.periodEnd);
    setSearchParams(updated, { replace: true });
  }, [defaults, setSearchParams]);

  // 2. Fetch Data Independently
  const { data: filterOptions, isLoading: isFiltersLoading } = useDashboardFilters();
  const {
    data: hrData,
    isLoading: isHrLoading,
    isError: isHrError,
    error: hrError,
  } = useDashboardHr(activeFilters);

  const {
    data: payrollData,
    isLoading: isPayrollLoading,
    isError: isPayrollError,
    error: payrollError,
  } = useDashboardPayroll(activeFilters, { enabled: isPayrollRole });

  // Combined Alerts
  const allAlerts = useMemo(() => {
    const list = [...(hrData?.hrAlerts || [])];
    if (isPayrollRole && payrollData?.payrollAlerts) {
      list.push(...payrollData.payrollAlerts);
    }
    return list;
  }, [hrData?.hrAlerts, isPayrollRole, payrollData?.payrollAlerts]);

  return (
    <AppLayout>
      <div className="bg-surface min-h-[calc(100vh-3.5rem)] pb-16">
        {/* ─── Header & Title ────────────────────────────────────── */}
        <div className="bg-white border-b border-border px-6 py-5">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-display font-bold text-navy tracking-tight">
                  {isPayrollRole ? 'Payroll & HR Executive Dashboard' : 'Workforce & HR Dashboard'}
                </h1>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-accentSoft text-accent">
                  Live Analytics
                </span>
              </div>
              <p className="text-sm text-slate mt-0.5">
                Real-time insights across headcount, attendance, time-off
                {isPayrollRole && ', salary expenditure, and payrun operations'}.
              </p>
            </div>

            {/* Role Badge */}
            <div className="flex items-center gap-2 text-xs text-muted">
              <span>Logged in as:</span>
              <span className="font-semibold text-navy bg-surface px-2.5 py-1 rounded-md border border-border">
                {user?.role?.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 pt-6">
          {/* ─── Filter Bar ────────────────────────────────────────── */}
          <div className="bg-white border border-border rounded-xl p-4 shadow-sm mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Presets & Custom Range */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate mr-1">
                  <Filter className="w-3.5 h-3.5 text-accent" />
                  <span>Period:</span>
                </div>
                <button
                  onClick={() => handlePreset('thisMonth')}
                  className="px-2.5 py-1 text-xs font-medium rounded-md border border-border hover:bg-surface text-slate transition-colors"
                >
                  This Month
                </button>
                <button
                  onClick={() => handlePreset('lastMonth')}
                  className="px-2.5 py-1 text-xs font-medium rounded-md border border-border hover:bg-surface text-slate transition-colors"
                >
                  Last Month
                </button>
                <button
                  onClick={() => handlePreset('thisQuarter')}
                  className="px-2.5 py-1 text-xs font-medium rounded-md border border-border hover:bg-surface text-slate transition-colors"
                >
                  This Quarter
                </button>
                <button
                  onClick={() => handlePreset('ytd')}
                  className="px-2.5 py-1 text-xs font-medium rounded-md border border-border hover:bg-surface text-slate transition-colors"
                >
                  Year to Date
                </button>

                <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

                {/* Custom Dates */}
                <div className="flex items-center gap-1.5">
                  <div className="relative">
                    <input
                      type="date"
                      value={periodStart}
                      onChange={(e) => updateFilters({ periodStart: e.target.value })}
                      className="text-xs px-2.5 py-1 rounded-md border border-border bg-white text-navy focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>
                  <span className="text-xs text-muted">to</span>
                  <div className="relative">
                    <input
                      type="date"
                      value={periodEnd}
                      onChange={(e) => updateFilters({ periodEnd: e.target.value })}
                      className="text-xs px-2.5 py-1 rounded-md border border-border bg-white text-navy focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>
                </div>
              </div>

              {/* Department & Employee Type Selectors */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Department */}
                <div className="flex items-center gap-1.5">
                  <label htmlFor="dept-filter" className="text-xs font-medium text-slate">
                    Department:
                  </label>
                  <select
                    id="dept-filter"
                    value={departmentId}
                    onChange={(e) => updateFilters({ departmentId: e.target.value })}
                    className="text-xs px-2.5 py-1 rounded-md border border-border bg-white text-navy focus:outline-none focus:ring-1 focus:ring-accent min-w-[140px]"
                    disabled={isFiltersLoading}
                  >
                    <option value="">All Departments</option>
                    {filterOptions?.departments?.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Employee Type */}
                <div className="flex items-center gap-1.5">
                  <label htmlFor="emptype-filter" className="text-xs font-medium text-slate">
                    Type:
                  </label>
                  <select
                    id="emptype-filter"
                    value={employeeType}
                    onChange={(e) => updateFilters({ employeeType: e.target.value })}
                    className="text-xs px-2.5 py-1 rounded-md border border-border bg-white text-navy focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="">All Types</option>
                    <option value="FULL_TIME">Full Time</option>
                    <option value="PART_TIME">Part Time</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="INTERN">Intern</option>
                  </select>
                </div>

                {/* Reset Filters */}
                <button
                  onClick={handleResetFilters}
                  title="Reset to current month"
                  className="flex items-center gap-1 px-2.5 py-1 text-xs text-muted hover:text-navy rounded-md border border-border hover:bg-surface transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>
            </div>
          </div>

          {/* ─── Top KPI Cards Row (Payroll) ───────────────────────── */}
          {isPayrollRole && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
                  Payroll Financial Summary
                </h2>
                {isPayrollLoading && (
                  <span className="text-xs text-muted animate-pulse">Loading payroll data...</span>
                )}
              </div>

              {isPayrollError ? (
                <div className="bg-errorSoft border border-error/20 rounded-xl p-4 text-xs text-error">
                  Failed to load payroll metrics: {payrollError?.message || 'Unknown error'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Total Net Paid */}
                  <div className="bg-white border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted">Total Net Salary Paid</span>
                      <div className="w-8 h-8 rounded-lg bg-accentSoft text-accent flex items-center justify-center">
                        <IndianRupee className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-display font-bold text-navy tracking-tight">
                      {isPayrollLoading ? '...' : formatINR(payrollData?.totalNetSalaryPaid)}
                    </div>
                    <div className="text-xs text-muted mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                      <span>PAID payslips in period</span>
                    </div>
                  </div>

                  {/* Card 2: Average Salary */}
                  <div className="bg-white border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted">Average Net Salary</span>
                      <div className="w-8 h-8 rounded-lg bg-successSoft text-success flex items-center justify-center">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-display font-bold text-navy tracking-tight">
                      {isPayrollLoading ? '...' : formatINR(payrollData?.averagePaidSalary)}
                    </div>
                    <div className="text-xs text-muted mt-1">Per distinct paid employee</div>
                  </div>

                  {/* Card 3: Generated Payslips */}
                  <div className="bg-white border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted">Payslips Generated</span>
                      <div className="w-8 h-8 rounded-lg bg-warningSoft text-warning flex items-center justify-center">
                        <FileText className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-display font-bold text-navy tracking-tight">
                      {isPayrollLoading ? '...' : payrollData?.payslipsGenerated ?? 0}
                    </div>
                    <div className="text-xs text-muted mt-1">Computed, Validated & Paid</div>
                  </div>

                  {/* Card 4: Active Payruns */}
                  <div className="bg-white border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted">Payruns in Period</span>
                      <div className="w-8 h-8 rounded-lg bg-surface text-slate flex items-center justify-center border border-border">
                        <Calendar className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-display font-bold text-navy tracking-tight">
                      {isPayrollLoading
                        ? '...'
                        : (payrollData?.payrunStatusCounts.paid ?? 0) +
                          (payrollData?.payrunStatusCounts.validated ?? 0) +
                          (payrollData?.payrunStatusCounts.computed ?? 0) +
                          (payrollData?.payrunStatusCounts.draft ?? 0)}
                    </div>
                    <div className="text-xs text-muted mt-1 flex items-center gap-1.5">
                      <span className="text-success font-medium">
                        {payrollData?.payrunStatusCounts.paid ?? 0} Paid
                      </span>
                      <span>•</span>
                      <span className="text-warning font-medium">
                        {payrollData?.payrunStatusCounts.draft ?? 0} Draft
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Middle KPI Cards Row (HR & Workforce) ─────────────── */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
                Workforce & Attendance Health
              </h2>
              {isHrLoading && (
                <span className="text-xs text-muted animate-pulse">Loading HR data...</span>
              )}
            </div>

            {isHrError ? (
              <div className="bg-errorSoft border border-error/20 rounded-xl p-4 text-xs text-error">
                Failed to load workforce metrics: {hrError?.message || 'Unknown error'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Active Headcount */}
                <div className="bg-white border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted">Active Headcount</span>
                    <div className="w-8 h-8 rounded-lg bg-accentSoft text-accent flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-display font-bold text-navy tracking-tight">
                    {isHrLoading ? '...' : hrData?.headcount ?? 0}
                  </div>
                  <div className="text-xs text-muted mt-1">Matching selected filters</div>
                </div>

                {/* Card 2: Attendance Coverage */}
                <div className="bg-white border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted">Attendance Health</span>
                    <div className="w-8 h-8 rounded-lg bg-successSoft text-success flex items-center justify-center">
                      <CalendarCheck className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <div className="text-2xl font-display font-bold text-navy tracking-tight">
                      {isHrLoading
                        ? '...'
                        : hrData?.attendance.hasCoverageData
                        ? `${parseFloat(hrData.attendance.coveragePercent).toFixed(1)}%`
                        : 'N/A'}
                    </div>
                    {hrData?.attendance.hasCoverageData && (
                      <span className="text-xs font-medium text-success">Coverage</span>
                    )}
                  </div>
                  <div className="text-xs text-muted mt-1">
                    {hrData?.attendance.coveredDays ?? 0} of {hrData?.attendance.expectedDays ?? 0} expected days
                  </div>
                </div>

                {/* Card 3: Overtime Hours */}
                <div className="bg-white border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted">Overtime Logged</span>
                    <div className="w-8 h-8 rounded-lg bg-warningSoft text-warning flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-display font-bold text-navy tracking-tight">
                    {isHrLoading ? '...' : formatMinutesToHours(hrData?.attendance.overtimeMinutes ?? 0)}
                  </div>
                  <div className="text-xs text-muted mt-1">
                    {hrData?.attendance.late ?? 0} late punches • {hrData?.attendance.absent ?? 0} absent
                  </div>
                </div>

                {/* Card 4: Time Off Activity */}
                <div className="bg-white border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted">Approved Time Off</span>
                    <div className="w-8 h-8 rounded-lg bg-surface text-slate flex items-center justify-center border border-border">
                      <CalendarOff className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-display font-bold text-navy tracking-tight">
                    {isHrLoading
                      ? '...'
                      : `${parseFloat(hrData?.timeOff.approvedDayUnits ?? '0')}d`}
                  </div>
                  <div className="text-xs text-muted mt-1">
                    {hrData?.timeOff.pendingRequestCount ?? 0} pending request(s) awaiting review
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ─── Charts Row 1: Payroll Trends (Payroll Roles Only) ─── */}
          {isPayrollRole && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Monthly Net Salary Trend Chart */}
              <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-navy">Monthly Net Salary Trend</h3>
                    <p className="text-xs text-muted">Chronological paid salary expenditure</p>
                  </div>
                </div>

                <div className="h-64 w-full">
                  {payrollData?.monthlyNetSalaryTrend && payrollData.monthlyNetSalaryTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={payrollData.monthlyNetSalaryTrend}
                        margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="salaryGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={T.accent} stopOpacity={0.4} />
                            <stop offset="95%" stopColor={T.accent} stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                        <XAxis
                          dataKey="month"
                          stroke={T.muted}
                          fontSize={11}
                          tickLine={false}
                          axisLine={{ stroke: T.border }}
                        />
                        <YAxis
                          stroke={T.muted}
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          formatter={(val: any) => [formatINR(val ? String(val) : '0'), 'Net Paid']}
                          contentStyle={{
                            backgroundColor: '#FFFFFF',
                            borderColor: T.border,
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                            fontSize: '12px',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="totalPaidNet"
                          stroke={T.accent}
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#salaryGradient)"
                          name="Net Salary"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-muted text-xs">
                      <FileText className="w-8 h-8 stroke-[1.5] text-slate/40 mb-2" />
                      <span>No paid salary trend data in this period</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Department Salary Cost Breakdown Chart */}
              <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-navy">Department Salary Cost</h3>
                    <p className="text-xs text-muted">Finalized salary expenditure grouped by snapshot</p>
                  </div>
                </div>

                <div className="h-64 w-full">
                  {payrollData?.salaryCostByDepartment && payrollData.salaryCostByDepartment.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={payrollData.salaryCostByDepartment}
                        margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                        <XAxis
                          dataKey="departmentName"
                          stroke={T.muted}
                          fontSize={11}
                          tickLine={false}
                          axisLine={{ stroke: T.border }}
                        />
                        <YAxis
                          stroke={T.muted}
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          formatter={(val: any) => [formatINR(val ? String(val) : '0'), 'Total Cost']}
                          contentStyle={{
                            backgroundColor: '#FFFFFF',
                            borderColor: T.border,
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                            fontSize: '12px',
                          }}
                        />
                        <Bar dataKey="totalPaidNet" fill={T.accent} radius={[4, 4, 0, 0]} name="Paid Salary" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-muted text-xs">
                      <Building2 className="w-8 h-8 stroke-[1.5] text-slate/40 mb-2" />
                      <span>No department salary data available</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ─── Charts Row 2: Workforce & Attendance ──────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Department Headcount Breakdown */}
            <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-navy">Headcount by Department</h3>
                  <p className="text-xs text-muted">Active employee distribution</p>
                </div>
              </div>

              <div className="h-64 w-full">
                {hrData?.departmentHeadcount && hrData.departmentHeadcount.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={hrData.departmentHeadcount}
                      margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                      <XAxis
                        dataKey="departmentName"
                        stroke={T.muted}
                        fontSize={11}
                        tickLine={false}
                        axisLine={{ stroke: T.border }}
                      />
                      <YAxis stroke={T.muted} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip
                        formatter={(val: any) => [`${val ?? 0} employees`, 'Headcount']}
                        contentStyle={{
                          backgroundColor: '#FFFFFF',
                          borderColor: T.border,
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="headcount" fill={T.navy} radius={[4, 4, 0, 0]} name="Headcount" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted text-xs">
                    <Users className="w-8 h-8 stroke-[1.5] text-slate/40 mb-2" />
                    <span>No employees in selected period</span>
                  </div>
                )}
              </div>
            </div>

            {/* Attendance Status Distribution */}
            <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-navy">Attendance Punches & Status</h3>
                  <p className="text-xs text-muted">Persisted attendance records in selected period</p>
                </div>
              </div>

              <div className="h-64 w-full">
                {hrData?.attendance ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: 'Present', count: hrData.attendance.present, fill: T.success },
                        { name: 'Late', count: hrData.attendance.late, fill: T.warning },
                        { name: 'Absent', count: hrData.attendance.absent, fill: T.error },
                        { name: 'Manual Edits', count: hrData.attendance.manualEdits, fill: T.accent },
                      ]}
                      margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                      <XAxis dataKey="name" stroke={T.muted} fontSize={11} tickLine={false} axisLine={{ stroke: T.border }} />
                      <YAxis stroke={T.muted} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip
                        formatter={(val: any) => [`${val ?? 0} records`, 'Total']}
                        contentStyle={{
                          backgroundColor: '#FFFFFF',
                          borderColor: T.border,
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {[T.success, T.warning, T.error, T.accent].map((color, index) => (
                          <Cell key={`cell-${index}`} fill={color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted text-xs">
                    <CalendarCheck className="w-8 h-8 stroke-[1.5] text-slate/40 mb-2" />
                    <span>No attendance recorded in this period</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ─── Operational Alerts & Actions ──────────────────────── */}
          <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <h3 className="text-sm font-bold text-navy">Operational Alerts & Action Items</h3>
              </div>
              <span className="text-xs text-muted font-medium">
                {allAlerts.length} item{allAlerts.length === 1 ? '' : 's'} requiring attention
              </span>
            </div>

            {allAlerts.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-successSoft text-success flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-navy mb-1">All Operational Checks Healthy</h4>
                <p className="text-xs text-muted max-w-sm">
                  No blocking warnings, expiring contracts, or pending checkout issues found for this period.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {allAlerts.map((alert, idx) => {
                  const isError = alert.severity === 'error';
                  return (
                    <div
                      key={`${alert.code}-${idx}`}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface/50 px-2 rounded-lg transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 p-1.5 rounded-md ${
                            isError ? 'bg-errorSoft text-error' : 'bg-warningSoft text-warning'
                          }`}
                        >
                          {isError ? (
                            <ShieldAlert className="w-4 h-4" />
                          ) : (
                            <AlertTriangle className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-navy">{alert.label}</span>
                            <span
                              className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded ${
                                isError ? 'bg-errorSoft text-error' : 'bg-warningSoft text-warning'
                              }`}
                            >
                              {alert.count}
                            </span>
                          </div>
                          <p className="text-xs text-slate mt-0.5">{alert.safeSummary}</p>
                        </div>
                      </div>

                      <Link
                        to={alert.deepLink}
                        className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent/80 transition-colors self-end sm:self-center"
                      >
                        <span>Resolve</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
