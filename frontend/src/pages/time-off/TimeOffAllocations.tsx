import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Check,
  X,
  Layers,
  Edit2,
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '@/context/AuthContext';
import {
  useAllocations,
  useTimeOffTypes,
  useCreateAllocationMutation,
  useUpdateAllocationMutation,
  useApproveAllocationMutation,
  useRefuseAllocationMutation,
} from '../../features/time-off/time-off.queries';
import { useEmployees } from '../../features/employees/employees.queries';
import type {
  AllocationListItemDto,
  AllocationInput,
  AllocationStatus,
} from '@peoplepay360/shared';

export default function TimeOffAllocations() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const urlEmployeeId = searchParams.get('employeeId') || '';
  const urlStatus = searchParams.get('status') || '';
  const urlAction = searchParams.get('new');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(urlEmployeeId);
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>(urlStatus);
  const [currentPage, setCurrentPage] = useState(1);

  // Sync state with URL params
  useEffect(() => {
    if (urlEmployeeId) setSelectedEmployeeId(urlEmployeeId);
    if (urlStatus) setSelectedStatus(urlStatus);
  }, [urlEmployeeId, urlStatus]);

  const isHrOrAdmin =
    user?.role === 'ADMIN' ||
    user?.role === 'HR_MANAGER' ||
    user?.role === 'HR_PAYROLL_MANAGER' ||
    user?.role === 'HR_PAYROLL_USER';

  // Allocations Query
  const { data, isLoading, error } = useAllocations({
    employeeId: selectedEmployeeId || undefined,
    timeOffTypeId: selectedTypeId || undefined,
    status: (selectedStatus as AllocationStatus) || undefined,
    search: searchQuery || undefined,
    page: currentPage,
    pageSize: 20,
  });

  // Supporting queries
  const { data: employeesData } = useEmployees(
    isHrOrAdmin ? { pageSize: 100, status: 'ACTIVE' } : undefined
  );
  const { data: typesData } = useTimeOffTypes({ status: 'ACTIVE', pageSize: 50 });

  // Mutations
  const createMutation = useCreateAllocationMutation();
  const updateMutation = useUpdateAllocationMutation();
  const approveMutation = useApproveAllocationMutation();
  const refuseMutation = useRefuseAllocationMutation();

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(Boolean(urlAction));
  const [editingAllocation, setEditingAllocation] = useState<AllocationListItemDto | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form input
  const [formData, setFormData] = useState<AllocationInput>({
    employeeId: '',
    timeOffTypeId: '',
    allocatedUnits: '10',
    validFrom: new Date().toISOString().split('T')[0],
    validTo: `${new Date().getFullYear()}-12-31`,
    description: null,
  });

  // Decision Modal State
  const [decisionModal, setDecisionModal] = useState<{
    open: boolean;
    allocation: AllocationListItemDto | null;
    action: 'APPROVE' | 'REFUSE';
    note: string;
    error: string | null;
  }>({
    open: false,
    allocation: null,
    action: 'APPROVE',
    note: '',
    error: null,
  });

  const handleOpenCreate = () => {
    setEditingAllocation(null);
    setFormData({
      employeeId: selectedEmployeeId || (employeesData?.items?.[0]?.id ?? ''),
      timeOffTypeId: typesData?.items?.find((t) => t.requiresAllocation)?.id ?? '',
      allocatedUnits: '10',
      validFrom: new Date().toISOString().split('T')[0],
      validTo: `${new Date().getFullYear()}-12-31`,
      description: null,
    });
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (alloc: AllocationListItemDto) => {
    setEditingAllocation(alloc);
    setFormData({
      employeeId: alloc.employee.id,
      timeOffTypeId: alloc.timeOffType.id,
      allocatedUnits: alloc.allocatedUnits,
      validFrom: alloc.validFrom,
      validTo: alloc.validTo,
      description: alloc.description,
    });
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.employeeId) {
      setFormError('Employee is required');
      return;
    }
    if (!formData.timeOffTypeId) {
      setFormError('Time off type is required');
      return;
    }
    if (parseFloat(formData.allocatedUnits) <= 0) {
      setFormError('Allocated units must be greater than zero');
      return;
    }

    try {
      if (editingAllocation) {
        await updateMutation.mutateAsync({
          id: editingAllocation.id,
          input: formData,
        });
      } else {
        await createMutation.mutateAsync(formData);
      }
      setIsFormModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save allocation');
    }
  };

  const handleOpenDecision = (
    allocation: AllocationListItemDto,
    action: 'APPROVE' | 'REFUSE'
  ) => {
    setDecisionModal({
      open: true,
      allocation,
      action,
      note: '',
      error: null,
    });
  };

  const handleConfirmDecision = async () => {
    if (!decisionModal.allocation) return;

    if (decisionModal.action === 'REFUSE' && (!decisionModal.note || decisionModal.note.trim().length < 3)) {
      setDecisionModal((prev) => ({
        ...prev,
        error: 'Refusal note must be at least 3 characters long',
      }));
      return;
    }

    try {
      if (decisionModal.action === 'APPROVE') {
        await approveMutation.mutateAsync({
          id: decisionModal.allocation.id,
          note: decisionModal.note || undefined,
        });
      } else {
        await refuseMutation.mutateAsync({
          id: decisionModal.allocation.id,
          note: decisionModal.note.trim(),
        });
      }
      setDecisionModal((prev) => ({ ...prev, open: false }));
    } catch (err: any) {
      setDecisionModal((prev) => ({
        ...prev,
        error: err.message || 'Failed to process decision',
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
                Leave Allocations
              </h1>
              <p className="text-slate mt-1 text-base">
                Manage balances, entitlement periods, and allocation approvals.
              </p>
            </div>

            {isHrOrAdmin && (
              <button
                onClick={handleOpenCreate}
                className="px-4 py-2 bg-accent hover:bg-accent/90 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-2"
              >
                <Plus size={16} />
                <span>New Allocation</span>
              </button>
            )}
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-border shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate/60 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by employee or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-surface/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isHrOrAdmin && (
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => {
                    setSelectedEmployeeId(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 bg-surface/50 border border-border rounded-xl text-xs font-semibold text-navy focus:outline-none max-w-[200px]"
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
                className="px-3 py-2 bg-surface/50 border border-border rounded-xl text-xs font-semibold text-navy focus:outline-none"
              >
                <option value="">All Types</option>
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
                className="px-3 py-2 bg-surface/50 border border-border rounded-xl text-xs font-semibold text-navy focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REFUSED">Refused</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>
          </div>

          {/* Allocations Table/List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
              <span className="ml-3 text-slate font-medium text-sm">Loading allocations...</span>
            </div>
          ) : error ? (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 flex items-center gap-3">
              <AlertCircle size={20} className="shrink-0" />
              <div>
                <p className="font-semibold text-sm">Failed to load allocations</p>
                <p className="text-xs opacity-90">{(error as any)?.message || 'An unexpected error occurred'}</p>
              </div>
            </div>
          ) : !data?.items?.length ? (
            <div className="bg-white rounded-2xl border border-border p-12 text-center text-slate shadow-xs">
              <Layers className="w-12 h-12 mx-auto text-slate/30 mb-3" />
              <h3 className="text-base font-bold text-navy">No Allocations Found</h3>
              <p className="text-xs text-slate mt-1 max-w-sm mx-auto">
                No leave allocations match your selected filters.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-border shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface/50 border-b border-border text-xs text-slate uppercase font-semibold tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Employee</th>
                      <th className="px-6 py-3.5">Type & Unit</th>
                      <th className="px-6 py-3.5">Balance</th>
                      <th className="px-6 py-3.5">Validity Period</th>
                      <th className="px-6 py-3.5">Status</th>
                      {isHrOrAdmin && <th className="px-6 py-3.5 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.items.map((alloc) => {
                      const allocated = parseFloat(alloc.allocatedUnits) || 0;
                      const consumed = parseFloat(alloc.consumedUnits) || 0;
                      const pct =
                        allocated > 0 ? Math.min(100, Math.round((consumed / allocated) * 100)) : 0;

                      return (
                        <tr key={alloc.id} className="hover:bg-surface/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-navy">{alloc.employee.fullName}</div>
                            <div className="text-xs text-slate font-mono">
                              {alloc.employee.employeeNumber}
                              {alloc.employee.departmentName
                                ? ` · ${alloc.employee.departmentName}`
                                : ''}
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="font-semibold text-navy">{alloc.timeOffType.name}</div>
                            <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-bold rounded-md bg-surface text-slate border border-border/80">
                              {alloc.unitSnapshot}
                            </span>
                          </td>

                          <td className="px-6 py-4 min-w-[170px]">
                            <div className="flex items-baseline gap-1.5 font-mono">
                              <span className="font-bold text-navy text-base">
                                {alloc.remainingUnits}
                              </span>
                              <span className="text-xs text-slate">
                                rem / {alloc.allocatedUnits}
                              </span>
                            </div>
                            <div className="w-full max-w-[130px] bg-slate/10 rounded-full h-1.5 mt-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  pct > 80 ? 'bg-rose-500' : 'bg-accent'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="text-xs font-mono text-navy font-medium">
                              {alloc.validFrom} to {alloc.validTo}
                            </div>
                            {alloc.status === 'APPROVED' && (
                              <span
                                className={`inline-block mt-1 px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                                  alloc.isCurrentlyUsable
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-amber-50 text-amber-700'
                                }`}
                              >
                                {alloc.isCurrentlyUsable ? 'Currently Valid' : 'Outside Validity'}
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                alloc.status === 'APPROVED'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : alloc.status === 'PENDING'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : alloc.status === 'REFUSED'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {alloc.status === 'APPROVED' && <CheckCircle2 size={12} />}
                              {alloc.status === 'PENDING' && <Clock size={12} />}
                              {alloc.status === 'REFUSED' && <XCircle size={12} />}
                              <span>{alloc.status}</span>
                            </span>

                            {alloc.decisionNote && (
                              <p className="text-[11px] text-slate mt-1 italic max-w-[200px] truncate" title={alloc.decisionNote}>
                                Note: {alloc.decisionNote}
                              </p>
                            )}
                          </td>

                          {isHrOrAdmin && (
                            <td className="px-6 py-4 text-right">
                              {alloc.status === 'PENDING' ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleOpenEdit(alloc)}
                                    title="Edit allocation"
                                    className="p-1.5 rounded-lg border border-border hover:bg-surface text-slate transition-colors"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleOpenDecision(alloc, 'APPROVE')}
                                    title="Approve allocation"
                                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors flex items-center gap-1"
                                  >
                                    <Check size={13} />
                                    <span>Approve</span>
                                  </button>
                                  <button
                                    onClick={() => handleOpenDecision(alloc, 'REFUSE')}
                                    title="Refuse allocation"
                                    className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors flex items-center gap-1"
                                  >
                                    <X size={13} />
                                    <span>Refuse</span>
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-slate/60 font-mono">Decision final</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data.pagination.totalPages > 1 && (
                <div className="p-4 border-t border-border flex items-center justify-between text-xs text-slate">
                  <span>
                    Showing page {data.pagination.page} of {data.pagination.totalPages} (
                    {data.pagination.totalItems} total)
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

        {/* Create / Edit Modal */}
        {isFormModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white w-full max-w-lg rounded-2xl border border-border shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-navy">
                    {editingAllocation ? 'Edit Allocation' : 'Create Leave Allocation'}
                  </h3>
                  <p className="text-xs text-slate mt-0.5">
                    Assign entitlement balance units to an employee.
                  </p>
                </div>
                <button
                  onClick={() => setIsFormModalOpen(false)}
                  className="p-1 rounded-lg text-slate hover:bg-surface transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveForm} className="p-6 space-y-4 overflow-y-auto flex-1">
                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">
                    Employee <span className="text-rose-500">*</span>
                  </label>
                  <select
                    disabled={Boolean(editingAllocation)}
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    className="w-full px-3 py-2 bg-surface/40 border border-border rounded-xl text-sm font-semibold text-navy focus:outline-none disabled:opacity-60"
                  >
                    <option value="">Select an employee...</option>
                    {employeesData?.items?.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.employeeNumber})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">
                    Time Off Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    disabled={Boolean(editingAllocation)}
                    value={formData.timeOffTypeId}
                    onChange={(e) => setFormData({ ...formData, timeOffTypeId: e.target.value })}
                    className="w-full px-3 py-2 bg-surface/40 border border-border rounded-xl text-sm font-semibold text-navy focus:outline-none disabled:opacity-60"
                  >
                    <option value="">Select type...</option>
                    {typesData?.items?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.unit}) {t.requiresAllocation ? '' : '- [No Alloc Needed]'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">
                    Allocated Units <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.allocatedUnits}
                    onChange={(e) => setFormData({ ...formData, allocatedUnits: e.target.value })}
                    placeholder="e.g. 10 or 15.5"
                    className="w-full px-3 py-2 bg-surface/40 border border-border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  />
                  <p className="text-[11px] text-slate mt-1">
                    Whole numbers for DAY types (e.g. 10), multiples of 0.25 for HOUR types (e.g. 8.5).
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-navy mb-1">
                      Valid From <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.validFrom}
                      onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                      className="w-full px-3 py-2 bg-surface/40 border border-border rounded-xl text-sm font-mono focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-navy mb-1">
                      Valid To <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.validTo}
                      onChange={(e) => setFormData({ ...formData, validTo: e.target.value })}
                      className="w-full px-3 py-2 bg-surface/40 border border-border rounded-xl text-sm font-mono focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={formData.description || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value || null })
                    }
                    placeholder="e.g. 2026 Annual Leave Balance granted"
                    className="w-full px-3 py-2 bg-surface/40 border border-border rounded-xl text-sm focus:outline-none resize-none"
                  />
                </div>

                <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsFormModalOpen(false)}
                    className="px-4 py-2 border border-border rounded-xl text-xs font-semibold text-slate hover:bg-surface transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="px-5 py-2 bg-accent hover:bg-accent/90 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    <span>{editingAllocation ? 'Save Changes' : 'Create Allocation'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Decision Confirmation Modal */}
        {decisionModal.open && decisionModal.allocation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white w-full max-w-md rounded-2xl border border-border shadow-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-navy flex items-center gap-2">
                  {decisionModal.action === 'APPROVE' ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span>Approve Allocation</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-rose-600" />
                      <span>Refuse Allocation</span>
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
                    {decisionModal.allocation.employee.fullName}
                  </span>
                </div>
                <div>
                  <span className="text-slate">Type: </span>
                  <span className="font-semibold text-navy">
                    {decisionModal.allocation.timeOffType.name}
                  </span>
                </div>
                <div>
                  <span className="text-slate">Units: </span>
                  <span className="font-mono font-semibold text-navy">
                    {decisionModal.allocation.allocatedUnits} {decisionModal.allocation.unitSnapshot}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate">
                {decisionModal.action === 'APPROVE'
                  ? 'Approving will make this balance available for the employee during the validity period. Decisions are final.'
                  : 'Refusing will mark this allocation as refused. A note explaining the refusal reason is required. Decisions are final.'}
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
                      ? 'Reason for refusal...'
                      : 'Add optional approval comments...'
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
