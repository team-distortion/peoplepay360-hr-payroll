import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Check,
  X,
  Calendar,
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Eye,
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '@/context/AuthContext';
import {
  useTimeOffRequests,
  useTimeOffTypes,
  useAllocations,
  useCreateTimeOffRequestMutation,
  useApproveTimeOffRequestMutation,
  useRefuseTimeOffRequestMutation,
} from '../../features/time-off/time-off.queries';
import { useEmployees } from '../../features/employees/employees.queries';
import type {
  TimeOffRequestListItemDto,
  TimeOffRequestInput,
  TimeOffRequestStatus,
} from '@peoplepay360/shared';

// Helper to convert HH:mm string to minute of day (0-1439)
function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// Helper to convert minute of day to HH:mm string
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function TimeOffRequests() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const urlEmployeeId = searchParams.get('employeeId') || '';
  const urlStatus = searchParams.get('status') || '';
  const urlScope = searchParams.get('scope') || '';
  const urlNew = searchParams.get('new');

  const isHrOrAdmin =
    user?.role === 'ADMIN' ||
    user?.role === 'HR_MANAGER' ||
    user?.role === 'HR_PAYROLL_MANAGER' ||
    user?.role === 'HR_PAYROLL_USER';

  // Filters State
  const [scope, setScope] = useState<'mine' | 'team' | 'all'>(
    (urlScope as any) || (isHrOrAdmin ? 'all' : 'mine')
  );
  const [selectedStatus, setSelectedStatus] = useState<string>(urlStatus);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(urlEmployeeId);
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Sync state with URL params
  useEffect(() => {
    if (urlEmployeeId) setSelectedEmployeeId(urlEmployeeId);
    if (urlStatus) setSelectedStatus(urlStatus);
    if (urlScope) setScope(urlScope as any);
  }, [urlEmployeeId, urlStatus, urlScope]);

  // Main Requests Query
  const { data, isLoading, error } = useTimeOffRequests({
    scope,
    employeeId: selectedEmployeeId || undefined,
    timeOffTypeId: selectedTypeId || undefined,
    status: (selectedStatus as TimeOffRequestStatus) || undefined,
    search: searchQuery || undefined,
    page: currentPage,
    pageSize: 20,
  });

  // Supporting queries
  const { data: typesData } = useTimeOffTypes({ status: 'ACTIVE', pageSize: 50 });
  const { data: employeesData } = useEmployees(
    isHrOrAdmin ? { pageSize: 100, status: 'ACTIVE' } : undefined
  );

  // Mutations
  const createMutation = useCreateTimeOffRequestMutation();
  const approveMutation = useApproveTimeOffRequestMutation();
  const refuseMutation = useRefuseTimeOffRequestMutation();

  // Modal / Detail States
  const [isNewModalOpen, setIsNewModalOpen] = useState(Boolean(urlNew));
  const [selectedDetail, setSelectedDetail] = useState<TimeOffRequestListItemDto | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [targetEmployeeId, setTargetEmployeeId] = useState<string>(
    user?.employeeId || ''
  );
  const [targetTypeId, setTargetTypeId] = useState<string>('');
  const [targetAllocationId, setTargetAllocationId] = useState<string>('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTimeStr, setStartTimeStr] = useState('09:00');
  const [endTimeStr, setEndTimeStr] = useState('13:00');
  const [reason, setReason] = useState('');

  // Selected Type definition
  const selectedType = useMemo(() => {
    return typesData?.items?.find((t) => t.id === targetTypeId);
  }, [typesData, targetTypeId]);

  // Query usable allocations for the target employee and target type
  const { data: userAllocationsData, isLoading: isLoadingAllocations } = useAllocations(
    targetEmployeeId && targetTypeId && selectedType?.requiresAllocation
      ? {
          employeeId: targetEmployeeId,
          timeOffTypeId: targetTypeId,
          status: 'APPROVED',
          pageSize: 20,
        }
      : undefined
  );

  // Auto select active type on modal open
  useEffect(() => {
    if (typesData?.items?.length && !targetTypeId) {
      setTargetTypeId(typesData.items[0].id);
    }
  }, [typesData, targetTypeId]);

  // Auto select best allocation when allocations load
  useEffect(() => {
    if (userAllocationsData?.items?.length) {
      // Find currently usable allocation or first one
      const usable = userAllocationsData.items.find((a) => a.isCurrentlyUsable);
      setTargetAllocationId(usable ? usable.id : userAllocationsData.items[0].id);
    } else {
      setTargetAllocationId('');
    }
  }, [userAllocationsData]);

  // Decision Modal State
  const [decisionModal, setDecisionModal] = useState<{
    open: boolean;
    request: TimeOffRequestListItemDto | null;
    action: 'APPROVE' | 'REFUSE';
    note: string;
    error: string | null;
  }>({
    open: false,
    request: null,
    action: 'APPROVE',
    note: '',
    error: null,
  });

  const handleOpenCreate = () => {
    setTargetEmployeeId(user?.employeeId || (employeesData?.items?.[0]?.id ?? ''));
    if (typesData?.items?.length) {
      setTargetTypeId(typesData.items[0].id);
    }
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate(new Date().toISOString().split('T')[0]);
    setStartTimeStr('09:00');
    setEndTimeStr('13:00');
    setReason('');
    setFormError(null);
    setIsNewModalOpen(true);
  };

  const handleSaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!targetTypeId) {
      setFormError('Please select a time off type');
      return;
    }

    if (!reason.trim() || reason.trim().length < 5) {
      setFormError('Reason must be at least 5 characters');
      return;
    }

    if (selectedType?.requiresAllocation && !targetAllocationId) {
      setFormError('An approved allocation balance is required for this leave type');
      return;
    }

    const payload: TimeOffRequestInput = {
      timeOffTypeId: targetTypeId,
      employeeId: isHrOrAdmin && targetEmployeeId ? targetEmployeeId : undefined,
      allocationId: selectedType?.requiresAllocation ? targetAllocationId : null,
      startDate,
      endDate: selectedType?.unit === 'HOUR' ? startDate : endDate,
      reason: reason.trim(),
    };

    if (selectedType?.unit === 'HOUR') {
      const startMin = timeToMinutes(startTimeStr);
      const endMin = timeToMinutes(endTimeStr);

      if (startMin % 15 !== 0 || endMin % 15 !== 0) {
        setFormError('Hour requests must be aligned to 15-minute intervals');
        return;
      }

      if (endMin <= startMin) {
        setFormError('End time must be later than start time');
        return;
      }

      payload.startMinute = startMin;
      payload.endMinute = endMin;
    }

    try {
      await createMutation.mutateAsync(payload);
      setIsNewModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit time off request');
    }
  };

  const handleOpenDecision = (
    request: TimeOffRequestListItemDto,
    action: 'APPROVE' | 'REFUSE'
  ) => {
    setDecisionModal({
      open: true,
      request,
      action,
      note: '',
      error: null,
    });
  };

  const handleConfirmDecision = async () => {
    if (!decisionModal.request) return;

    if (
      decisionModal.action === 'REFUSE' &&
      (!decisionModal.note || decisionModal.note.trim().length < 3)
    ) {
      setDecisionModal((prev) => ({
        ...prev,
        error: 'Refusal note is required (minimum 3 characters)',
      }));
      return;
    }

    try {
      if (decisionModal.action === 'APPROVE') {
        await approveMutation.mutateAsync({
          id: decisionModal.request.id,
          note: decisionModal.note || undefined,
        });
      } else {
        await refuseMutation.mutateAsync({
          id: decisionModal.request.id,
          note: decisionModal.note.trim(),
        });
      }
      setDecisionModal((prev) => ({ ...prev, open: false }));
    } catch (err: any) {
      setDecisionModal((prev) => ({
        ...prev,
        error: err.message || 'Failed to record decision',
      }));
    }
  };

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col bg-surface/30 p-6 md:p-8 animate-in fade-in duration-500">
        <div className="max-w-6xl mx-auto w-full space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold text-navy tracking-tight">
                Time Off Requests
              </h1>
              <p className="text-slate mt-1 text-base">
                Review submitted leaves, schedule overlap checks, and balance consumption.
              </p>
            </div>

            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-accent hover:bg-accent/90 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-2"
            >
              <Plus size={16} />
              <span>New Request</span>
            </button>
          </div>

          {/* Scope and Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-border shadow-xs flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              {/* Scope buttons */}
              <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-border">
                {isHrOrAdmin && (
                  <button
                    onClick={() => {
                      setScope('all');
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      scope === 'all'
                        ? 'bg-white text-navy shadow-xs'
                        : 'text-slate hover:text-navy'
                    }`}
                  >
                    All Organization
                  </button>
                )}
                <button
                  onClick={() => {
                    setScope('team');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    scope === 'team'
                      ? 'bg-white text-navy shadow-xs'
                      : 'text-slate hover:text-navy'
                  }`}
                >
                  My Team
                </button>
                <button
                  onClick={() => {
                    setScope('mine');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    scope === 'mine'
                      ? 'bg-white text-navy shadow-xs'
                      : 'text-slate hover:text-navy'
                  }`}
                >
                  My Requests
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate/60 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by employee, type, or reason..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-surface/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
              {isHrOrAdmin && scope === 'all' && (
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => {
                    setSelectedEmployeeId(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-1.5 bg-surface/50 border border-border rounded-xl text-xs font-semibold text-navy focus:outline-none max-w-[200px]"
                >
                  <option value="">All Employees</option>
                  {employeesData?.items?.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName}
                    </option>
                  ))}
                </select>
              )}

              <select
                value={selectedTypeId}
                onChange={(e) => {
                  setSelectedTypeId(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 bg-surface/50 border border-border rounded-xl text-xs font-semibold text-navy focus:outline-none"
              >
                <option value="">All Leave Types</option>
                {typesData?.items?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 bg-surface/50 border border-border rounded-xl text-xs font-semibold text-navy focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="REFUSED">Refused</option>
              </select>
            </div>
          </div>

          {/* Requests Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
              <span className="ml-3 text-slate font-medium text-sm">Loading requests...</span>
            </div>
          ) : error ? (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 flex items-center gap-3">
              <AlertCircle size={20} className="shrink-0" />
              <div>
                <p className="font-semibold text-sm">Failed to load time off requests</p>
                <p className="text-xs opacity-90">{(error as any)?.message || 'An unexpected error occurred'}</p>
              </div>
            </div>
          ) : !data?.items?.length ? (
            <div className="bg-white rounded-2xl border border-border p-12 text-center text-slate shadow-xs">
              <Calendar className="w-12 h-12 mx-auto text-slate/30 mb-3" />
              <h3 className="text-base font-bold text-navy">No Requests Found</h3>
              <p className="text-xs text-slate mt-1 max-w-sm mx-auto">
                No leave requests match your search criteria. Click "New Request" to create one.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-border shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface/50 border-b border-border text-xs text-slate uppercase font-semibold tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Employee</th>
                      <th className="px-6 py-3.5">Leave Type</th>
                      <th className="px-6 py-3.5">Dates / Schedule</th>
                      <th className="px-6 py-3.5">Duration</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.items.map((req) => (
                      <tr key={req.id} className="hover:bg-surface/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-navy">{req.employee.fullName}</div>
                          <div className="text-xs text-slate font-mono">
                            {req.employee.employeeNumber}
                            {req.employee.departmentName ? ` · ${req.employee.departmentName}` : ''}
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="font-semibold text-navy">{req.timeOffType.name}</div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-surface text-slate border border-border/80">
                              {req.unitSnapshot}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-medium ${
                                req.payrollTreatmentSnapshot === 'PAID'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {req.payrollTreatmentSnapshot}
                            </span>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          {req.unitSnapshot === 'DAY' ? (
                            <div className="font-mono text-xs text-navy font-semibold">
                              {req.startDate === req.endDate
                                ? req.startDate
                                : `${req.startDate} to ${req.endDate}`}
                            </div>
                          ) : (
                            <div>
                              <div className="font-mono text-xs text-navy font-semibold">
                                {req.startDate}
                              </div>
                              <div className="text-[11px] text-slate font-mono flex items-center gap-1 mt-0.5">
                                <Clock size={11} />
                                <span>
                                  {req.startMinute !== null ? minutesToTime(req.startMinute) : ''} -{' '}
                                  {req.endMinute !== null ? minutesToTime(req.endMinute) : ''}
                                </span>
                              </div>
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <div className="font-bold text-navy font-mono text-sm">
                            {req.requestedUnits}{' '}
                            <span className="text-xs font-normal text-slate">
                              {req.unitSnapshot === 'DAY' ? 'days' : 'hours'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate mt-0.5 truncate max-w-[150px]" title={req.reason}>
                            {req.reason}
                          </p>
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              req.status === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : req.status === 'PENDING'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {req.status === 'APPROVED' && <CheckCircle2 size={12} />}
                            {req.status === 'PENDING' && <Clock size={12} />}
                            {req.status === 'REFUSED' && <XCircle size={12} />}
                            <span>{req.status}</span>
                          </span>

                          {req.decisionNote && (
                            <p
                              className="text-[11px] text-slate mt-1 italic max-w-[180px] truncate"
                              title={req.decisionNote}
                            >
                              Note: {req.decisionNote}
                            </p>
                          )}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedDetail(req)}
                              title="View details"
                              className="p-1.5 rounded-lg border border-border hover:bg-surface text-slate transition-colors"
                            >
                              <Eye size={14} />
                            </button>

                            {isHrOrAdmin && req.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => handleOpenDecision(req, 'APPROVE')}
                                  title="Approve request"
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors flex items-center gap-1"
                                >
                                  <Check size={13} />
                                  <span>Approve</span>
                                </button>
                                <button
                                  onClick={() => handleOpenDecision(req, 'REFUSE')}
                                  title="Refuse request"
                                  className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors flex items-center gap-1"
                                >
                                  <X size={13} />
                                  <span>Refuse</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data.pagination.totalPages > 1 && (
                <div className="p-4 border-t border-border flex items-center justify-between text-xs text-slate">
                  <span>
                    Page {data.pagination.page} of {data.pagination.totalPages} (
                    {data.pagination.totalItems} total requests)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 border border-border rounded-lg hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      disabled={currentPage >= data.pagination.totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                      className="px-3 py-1.5 border border-border rounded-lg hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* New Request Modal */}
        {isNewModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white w-full max-w-lg rounded-2xl border border-border shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-navy">Submit Time Off Request</h3>
                  <p className="text-xs text-slate mt-0.5">
                    Select leave type and enter schedule details.
                  </p>
                </div>
                <button
                  onClick={() => setIsNewModalOpen(false)}
                  className="p-1 rounded-lg text-slate hover:bg-surface transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveRequest} className="p-6 space-y-4 overflow-y-auto flex-1">
                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Employee Selector (HR only) */}
                {isHrOrAdmin && (
                  <div>
                    <label className="block text-xs font-semibold text-navy mb-1">
                      Requesting For Employee <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={targetEmployeeId}
                      onChange={(e) => setTargetEmployeeId(e.target.value)}
                      className="w-full px-3 py-2 bg-surface/40 border border-border rounded-xl text-sm font-semibold text-navy focus:outline-none"
                    >
                      {employeesData?.items?.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.firstName} {emp.lastName} ({emp.employeeNumber})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Leave Type Selector */}
                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">
                    Time Off Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={targetTypeId}
                    onChange={(e) => setTargetTypeId(e.target.value)}
                    className="w-full px-3 py-2 bg-surface/40 border border-border rounded-xl text-sm font-semibold text-navy focus:outline-none"
                  >
                    {typesData?.items?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.unit}) - {t.requiresAllocation ? 'Requires Allocation' : 'No Allocation Needed'}
                      </option>
                    ))}
                  </select>

                  {selectedType?.approvalMode === 'NO_APPROVAL' && (
                    <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                      <CheckCircle2 size={15} className="shrink-0" />
                      <span>Auto-Approval Policy: This request will be approved immediately upon submission.</span>
                    </div>
                  )}
                </div>

                {/* Allocation balance selection if required */}
                {selectedType?.requiresAllocation && (
                  <div>
                    <label className="block text-xs font-semibold text-navy mb-1">
                      Allocation Balance <span className="text-rose-500">*</span>
                    </label>
                    {isLoadingAllocations ? (
                      <div className="py-2 text-xs text-slate flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                        <span>Checking available balances...</span>
                      </div>
                    ) : userAllocationsData?.items?.length ? (
                      <select
                        value={targetAllocationId}
                        onChange={(e) => setTargetAllocationId(e.target.value)}
                        className="w-full px-3 py-2 bg-surface/40 border border-border rounded-xl text-sm font-semibold text-navy focus:outline-none"
                      >
                        {userAllocationsData.items.map((alloc) => (
                          <option key={alloc.id} value={alloc.id}>
                            {alloc.description || 'General Balance'} - {alloc.remainingUnits} {alloc.unitSnapshot} remaining (Valid: {alloc.validFrom} to {alloc.validTo})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs space-y-1">
                        <p className="font-semibold flex items-center gap-1.5">
                          <AlertCircle size={14} /> No approved allocations found
                        </p>
                        <p>
                          This employee does not have an approved balance for {selectedType.name}. An allocation must be granted and approved first.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* DAY vs HOUR Date Inputs */}
                {selectedType?.unit === 'DAY' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-navy mb-1">
                        Start Date <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2 bg-surface/40 border border-border rounded-xl text-sm font-mono focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-navy mb-1">
                        End Date <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={endDate}
                        min={startDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-3 py-2 bg-surface/40 border border-border rounded-xl text-sm font-mono focus:outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-navy mb-1">
                        Date <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2 bg-surface/40 border border-border rounded-xl text-sm font-mono focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-navy mb-1">
                          Start Time (15m step) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="time"
                          step={900}
                          required
                          value={startTimeStr}
                          onChange={(e) => setStartTimeStr(e.target.value)}
                          className="w-full px-3 py-2 bg-surface/40 border border-border rounded-xl text-sm font-mono focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-navy mb-1">
                          End Time (15m step) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="time"
                          step={900}
                          required
                          value={endTimeStr}
                          onChange={(e) => setEndTimeStr(e.target.value)}
                          className="w-full px-3 py-2 bg-surface/40 border border-border rounded-xl text-sm font-mono focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Reason */}
                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">
                    Reason <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Provide a detailed reason for the leave request (at least 5 characters)..."
                    className="w-full px-3 py-2 bg-surface/40 border border-border rounded-xl text-sm focus:outline-none resize-none"
                  />
                </div>

                <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsNewModalOpen(false)}
                    className="px-4 py-2 border border-border rounded-xl text-xs font-semibold text-slate hover:bg-surface transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      createMutation.isPending ||
                      Boolean(selectedType?.requiresAllocation && !targetAllocationId)
                    }
                    className="px-5 py-2 bg-accent hover:bg-accent/90 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Submit Request</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* View Details Modal */}
        {selectedDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white w-full max-w-md rounded-2xl border border-border shadow-xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-base font-bold text-navy">Time Off Request Details</h3>
                <button
                  onClick={() => setSelectedDetail(null)}
                  className="p-1 text-slate hover:bg-surface rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate">Employee:</span>
                  <span className="font-semibold text-navy">
                    {selectedDetail.employee.fullName} ({selectedDetail.employee.employeeNumber})
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate">Type:</span>
                  <span className="font-semibold text-navy">{selectedDetail.timeOffType.name}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate">Unit & Treatment:</span>
                  <span className="font-semibold text-navy">
                    {selectedDetail.unitSnapshot} · {selectedDetail.payrollTreatmentSnapshot}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate">Dates:</span>
                  <span className="font-mono font-semibold text-navy">
                    {selectedDetail.startDate}
                    {selectedDetail.startDate !== selectedDetail.endDate
                      ? ` to ${selectedDetail.endDate}`
                      : ''}
                  </span>
                </div>

                {selectedDetail.unitSnapshot === 'HOUR' && (
                  <div className="flex justify-between">
                    <span className="text-slate">Time Window:</span>
                    <span className="font-mono font-semibold text-navy">
                      {selectedDetail.startMinute !== null
                        ? minutesToTime(selectedDetail.startMinute)
                        : ''}{' '}
                      -{' '}
                      {selectedDetail.endMinute !== null
                        ? minutesToTime(selectedDetail.endMinute)
                        : ''}
                    </span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-slate">Duration Calculated:</span>
                  <span className="font-mono font-bold text-navy">
                    {selectedDetail.requestedUnits}{' '}
                    {selectedDetail.unitSnapshot === 'DAY' ? 'Days' : 'Hours'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate">Status:</span>
                  <span
                    className={`font-semibold px-2 py-0.5 rounded-full text-[11px] ${
                      selectedDetail.status === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-700'
                        : selectedDetail.status === 'PENDING'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {selectedDetail.status}
                  </span>
                </div>

                {selectedDetail.decidedBy && (
                  <div className="flex justify-between">
                    <span className="text-slate">Decided By:</span>
                    <span className="font-medium text-navy">{selectedDetail.decidedBy.email}</span>
                  </div>
                )}

                {selectedDetail.decisionNote && (
                  <div className="p-2.5 bg-surface/60 rounded-xl">
                    <span className="text-slate block text-[11px] font-medium">Decision Note:</span>
                    <p className="text-navy mt-0.5 italic">{selectedDetail.decisionNote}</p>
                  </div>
                )}

                <div className="p-2.5 bg-surface/60 rounded-xl">
                  <span className="text-slate block text-[11px] font-medium">Reason:</span>
                  <p className="text-navy mt-0.5">{selectedDetail.reason}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-border flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedDetail(null)}
                  className="px-4 py-2 bg-surface text-navy rounded-xl text-xs font-semibold hover:bg-surface/80"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Approve / Refuse Decision Modal */}
        {decisionModal.open && decisionModal.request && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white w-full max-w-md rounded-2xl border border-border shadow-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-navy flex items-center gap-2">
                  {decisionModal.action === 'APPROVE' ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span>Approve Leave Request</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-rose-600" />
                      <span>Refuse Leave Request</span>
                    </>
                  )}
                </h3>
                <button
                  onClick={() => setDecisionModal((p) => ({ ...p, open: false }))}
                  className="p-1 text-slate hover:bg-surface rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-3 bg-surface/50 rounded-xl text-xs space-y-1">
                <div>
                  <span className="text-slate">Employee: </span>
                  <span className="font-semibold text-navy">
                    {decisionModal.request.employee.fullName}
                  </span>
                </div>
                <div>
                  <span className="text-slate">Type: </span>
                  <span className="font-semibold text-navy">
                    {decisionModal.request.timeOffType.name}
                  </span>
                </div>
                <div>
                  <span className="text-slate">Requested Units: </span>
                  <span className="font-mono font-semibold text-navy">
                    {decisionModal.request.requestedUnits} {decisionModal.request.unitSnapshot}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate">
                {decisionModal.action === 'APPROVE'
                  ? 'Approving will atomically deduct the requested units from the linked allocation (if required). Approved decisions are final.'
                  : 'Refusing will mark this request as refused without balance deduction. A note explaining the refusal reason is required. Refused decisions are final.'}
              </p>

              {decisionModal.error && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                  {decisionModal.error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-navy mb-1">
                  Decision Note{' '}
                  {decisionModal.action === 'REFUSE' ? (
                    <span className="text-rose-500">* (required)</span>
                  ) : (
                    <span className="text-slate font-normal">(optional)</span>
                  )}
                </label>
                <textarea
                  rows={2}
                  value={decisionModal.note}
                  onChange={(e) =>
                    setDecisionModal((p) => ({ ...p, note: e.target.value, error: null }))
                  }
                  placeholder={
                    decisionModal.action === 'REFUSE'
                      ? 'State the reason for refusal...'
                      : 'Optional approval comments...'
                  }
                  className="w-full px-3 py-2 bg-surface/50 border border-border rounded-xl text-xs focus:outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDecisionModal((p) => ({ ...p, open: false }))}
                  className="px-4 py-2 border border-border rounded-xl text-xs font-semibold text-slate hover:bg-surface"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={approveMutation.isPending || refuseMutation.isPending}
                  onClick={handleConfirmDecision}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition-colors flex items-center gap-1.5 ${
                    decisionModal.action === 'APPROVE'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {(approveMutation.isPending || refuseMutation.isPending) && (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  )}
                  <span>Confirm {decisionModal.action === 'APPROVE' ? 'Approval' : 'Refusal'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
