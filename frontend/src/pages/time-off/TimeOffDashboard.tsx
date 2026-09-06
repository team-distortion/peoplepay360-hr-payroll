import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  ArrowRight,
  ShieldCheck,
  CalendarCheck,
  FileSpreadsheet,
  Layers,
  Loader2,
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '@/context/AuthContext';
import { useTimeOffSummary } from '../../features/time-off/time-off.queries';
import { useEmployees } from '../../features/employees/employees.queries';

export default function TimeOffDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  const isHrOrAdmin =
    user?.role === 'ADMIN' ||
    user?.role === 'HR_MANAGER' ||
    user?.role === 'HR_PAYROLL_MANAGER' ||
    user?.role === 'HR_PAYROLL_USER';

  const { data: summary, isLoading, error } = useTimeOffSummary(
    isHrOrAdmin && selectedEmployeeId ? selectedEmployeeId : undefined
  );

  const { data: employeesData } = useEmployees(
    isHrOrAdmin ? { pageSize: 100, status: 'ACTIVE' } : undefined
  );

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col bg-surface/30 p-6 md:p-8 animate-in fade-in duration-500">
        <div className="max-w-6xl mx-auto w-full space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold text-navy tracking-tight">
                Time Off Dashboard
              </h1>
              <p className="text-slate mt-1 text-base">
                Overview of leaves, remaining balances, and allocation lifecycle.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {isHrOrAdmin && (
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-border shadow-xs">
                  <span className="text-xs font-medium text-slate">Filter Employee:</span>
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    className="text-xs font-semibold text-navy bg-transparent outline-none cursor-pointer"
                  >
                    <option value="">All Organization</option>
                    {employeesData?.items?.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.employeeNumber})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                onClick={() => navigate('/time-off/requests?new=true')}
                className="px-4 py-2 bg-accent hover:bg-accent/90 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-2"
              >
                <Plus size={16} />
                <span>New Request</span>
              </button>
            </div>
          </div>

          {/* Loading / Error States */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
              <span className="ml-3 text-slate font-medium text-sm">Loading summary metrics...</span>
            </div>
          ) : error ? (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 flex items-center gap-3">
              <AlertCircle size={20} className="shrink-0" />
              <div>
                <p className="font-semibold text-sm">Failed to load dashboard metrics</p>
                <p className="text-xs opacity-90">{(error as any)?.message || 'An unexpected error occurred'}</p>
              </div>
            </div>
          ) : summary ? (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div
                  onClick={() => navigate('/time-off/requests?status=PENDING')}
                  className="bg-white p-5 rounded-2xl border border-border shadow-xs hover:border-amber-400 hover:shadow-md transition-all cursor-pointer flex items-start gap-4 group"
                >
                  <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <AlertCircle size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-2xl font-bold text-navy font-mono">
                      {summary.pendingRequestCount}
                    </div>
                    <div className="text-xs font-semibold text-slate mt-0.5">
                      Pending Requests
                    </div>
                    <div className="text-[11px] text-amber-600 mt-2 font-medium flex items-center gap-1">
                      Awaiting approval <ArrowRight size={12} />
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => navigate('/time-off/requests?status=APPROVED')}
                  className="bg-white p-5 rounded-2xl border border-border shadow-xs hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer flex items-start gap-4 group"
                >
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <CheckCircle size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-2xl font-bold text-navy font-mono">
                      {summary.approvedRequestCountInCurrentYear}
                    </div>
                    <div className="text-xs font-semibold text-slate mt-0.5">
                      Approved This Year
                    </div>
                    <div className="text-[11px] text-emerald-600 mt-2 font-medium flex items-center gap-1">
                      Recorded leaves <ArrowRight size={12} />
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => navigate('/time-off/allocations?status=PENDING')}
                  className="bg-white p-5 rounded-2xl border border-border shadow-xs hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex items-start gap-4 group"
                >
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Clock size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-2xl font-bold text-navy font-mono">
                      {summary.pendingAllocationCount}
                    </div>
                    <div className="text-xs font-semibold text-slate mt-0.5">
                      Pending Allocations
                    </div>
                    <div className="text-[11px] text-blue-600 mt-2 font-medium flex items-center gap-1">
                      Awaiting HR review <ArrowRight size={12} />
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => navigate('/time-off/allocations?status=APPROVED')}
                  className="bg-white p-5 rounded-2xl border border-border shadow-xs hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer flex items-start gap-4 group"
                >
                  <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <CalendarCheck size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-2xl font-bold text-navy font-mono">
                      {summary.usableAllocationCount}
                    </div>
                    <div className="text-xs font-semibold text-slate mt-0.5">
                      Active Usable Allocations
                    </div>
                    <div className="text-[11px] text-indigo-600 mt-2 font-medium flex items-center gap-1">
                      Currently available <ArrowRight size={12} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Balances by Type Section */}
              <div className="bg-white rounded-2xl border border-border shadow-xs p-6">
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <div>
                    <h2 className="text-lg font-bold text-navy">Time Off Balances by Type</h2>
                    <p className="text-xs text-slate mt-0.5">
                      Total allocations and consumption tracked for active time off types.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/time-off/allocations')}
                    className="text-xs font-semibold text-accent hover:text-accent/80 transition-colors flex items-center gap-1"
                  >
                    Manage Allocations <ArrowRight size={13} />
                  </button>
                </div>

                {summary.balancesByType.length === 0 ? (
                  <div className="py-12 text-center text-slate">
                    <FileSpreadsheet className="w-10 h-10 mx-auto text-slate/40 mb-2" />
                    <p className="text-sm font-medium">No active time off balances found.</p>
                    <p className="text-xs text-slate/80 mt-1">
                      Create allocations for time off types to start tracking team balances.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-6">
                    {summary.balancesByType.map((bal) => {
                      const allocated = parseFloat(bal.allocatedUnits) || 0;
                      const consumed = parseFloat(bal.consumedUnits) || 0;
                      const percentUsed =
                        allocated > 0 ? Math.min(100, Math.round((consumed / allocated) * 100)) : 0;

                      return (
                        <div
                          key={bal.timeOffTypeId}
                          className="p-4 rounded-xl border border-border/70 bg-surface/20 hover:bg-surface/50 transition-colors flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-bold text-navy text-sm truncate mr-2">
                                {bal.timeOffTypeName}
                              </span>
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate/10 text-slate uppercase tracking-wider">
                                {bal.unit === 'DAY' ? 'Days' : 'Hours'}
                              </span>
                            </div>

                            <div className="flex items-baseline gap-2 mt-2">
                              <span className="text-2xl font-bold font-mono text-navy">
                                {bal.remainingUnits}
                              </span>
                              <span className="text-xs text-slate font-medium">
                                remaining of {bal.allocatedUnits}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4">
                            <div className="flex items-center justify-between text-[11px] text-slate mb-1">
                              <span>Consumed: {bal.consumedUnits}</span>
                              <span className="font-semibold">{percentUsed}%</span>
                            </div>
                            <div className="w-full bg-slate/10 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  percentUsed > 85
                                    ? 'bg-rose-500'
                                    : percentUsed > 50
                                    ? 'bg-amber-500'
                                    : 'bg-accent'
                                }`}
                                style={{ width: `${percentUsed}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Quick Hub Navigation Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div
                  onClick={() => navigate('/time-off/requests')}
                  className="bg-white p-6 rounded-2xl border border-border shadow-xs hover:shadow-md hover:border-accent/40 transition-all cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                    <Calendar size={20} />
                  </div>
                  <h3 className="text-base font-bold text-navy">Time Off Requests</h3>
                  <p className="text-xs text-slate mt-1">
                    Submit, track, and review leave requests with working schedule validation.
                  </p>
                  <div className="mt-4 flex items-center text-xs font-semibold text-accent gap-1">
                    Open Requests <ArrowRight size={13} />
                  </div>
                </div>

                <div
                  onClick={() => navigate('/time-off/allocations')}
                  className="bg-white p-6 rounded-2xl border border-border shadow-xs hover:shadow-md hover:border-accent/40 transition-all cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                    <Layers size={20} />
                  </div>
                  <h3 className="text-base font-bold text-navy">Leave Allocations</h3>
                  <p className="text-xs text-slate mt-1">
                    Manage annual balances, compensatory time credits, and expiration dates.
                  </p>
                  <div className="mt-4 flex items-center text-xs font-semibold text-purple-600 gap-1">
                    Open Allocations <ArrowRight size={13} />
                  </div>
                </div>

                <div
                  onClick={() => navigate('/time-off/types')}
                  className="bg-white p-6 rounded-2xl border border-border shadow-xs hover:shadow-md hover:border-accent/40 transition-all cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                    <ShieldCheck size={20} />
                  </div>
                  <h3 className="text-base font-bold text-navy">Time Off Types</h3>
                  <p className="text-xs text-slate mt-1">
                    Configure day/hour units, approval policies, and payroll treatment.
                  </p>
                  <div className="mt-4 flex items-center text-xs font-semibold text-emerald-600 gap-1">
                    Configure Types <ArrowRight size={13} />
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </AppLayout>
  );
}
