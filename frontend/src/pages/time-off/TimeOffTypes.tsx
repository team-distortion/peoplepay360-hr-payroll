import { useState } from 'react';
import {
  Plus,
  Search,
  X,
  Layers,
  Edit2,
  Power,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '@/context/AuthContext';
import {
  useTimeOffTypes,
  useCreateTimeOffTypeMutation,
  useUpdateTimeOffTypeMutation,
  useToggleTimeOffTypeStatusMutation,
} from '../../features/time-off/time-off.queries';
import type {
  TimeOffTypeListItemDto,
  TimeOffTypeInput,
  TimeOffUnit,
  TimeOffApprovalMode,
  TimeOffPayrollTreatment,
} from '@peoplepay360/shared';

export default function TimeOffTypes() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [unitFilter, setUnitFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [allocationFilter, setAllocationFilter] = useState<string>('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<TimeOffTypeListItemDto | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<TimeOffTypeInput>({
    name: '',
    description: null,
    unit: 'DAY',
    requiresAllocation: true,
    approvalMode: 'HR_APPROVAL',
    payrollTreatment: 'PAID',
    status: 'ACTIVE',
  });

  const isHrOrAdmin =
    user?.role === 'ADMIN' ||
    user?.role === 'HR_MANAGER' ||
    user?.role === 'HR_PAYROLL_MANAGER' ||
    user?.role === 'HR_PAYROLL_USER';

  const { data, isLoading, error } = useTimeOffTypes({
    search: searchQuery || undefined,
    unit: (unitFilter as TimeOffUnit) || undefined,
    status: (statusFilter as 'ACTIVE' | 'INACTIVE') || undefined,
    requiresAllocation: allocationFilter ? allocationFilter === 'true' : undefined,
    pageSize: 50,
  });

  const createMutation = useCreateTimeOffTypeMutation();
  const updateMutation = useUpdateTimeOffTypeMutation();
  const toggleStatusMutation = useToggleTimeOffTypeStatusMutation();

  const handleOpenCreate = () => {
    setEditingType(null);
    setFormData({
      name: '',
      description: null,
      unit: 'DAY',
      requiresAllocation: true,
      approvalMode: 'HR_APPROVAL',
      payrollTreatment: 'PAID',
      status: 'ACTIVE',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (type: TimeOffTypeListItemDto) => {
    setEditingType(type);
    setFormData({
      name: type.name,
      description: type.description,
      unit: type.unit,
      requiresAllocation: type.requiresAllocation,
      approvalMode: type.approvalMode,
      payrollTreatment: type.payrollTreatment,
      status: type.status as 'ACTIVE' | 'INACTIVE',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('Type name is required');
      return;
    }

    try {
      if (editingType) {
        await updateMutation.mutateAsync({
          id: editingType.id,
          input: formData,
        });
      } else {
        await createMutation.mutateAsync(formData);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save time off type');
    }
  };

  const handleToggleStatus = async (type: TimeOffTypeListItemDto) => {
    const newStatus = type.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await toggleStatusMutation.mutateAsync({
        id: type.id,
        status: newStatus,
      });
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
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
                Time Off Types
              </h1>
              <p className="text-slate mt-1 text-base">
                Configure leave policies, unit accounting, and approval requirements.
              </p>
            </div>

            {isHrOrAdmin && (
              <button
                onClick={handleOpenCreate}
                className="px-4 py-2 bg-accent hover:bg-accent/90 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-2"
              >
                <Plus size={16} />
                <span>New Type</span>
              </button>
            )}
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-border shadow-xs flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate/60 w-4 h-4" />
              <input
                type="text"
                placeholder="Search types by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-surface/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value)}
                className="px-3 py-2 bg-surface/50 border border-border rounded-xl text-xs font-semibold text-navy focus:outline-none"
              >
                <option value="">All Units</option>
                <option value="DAY">Days</option>
                <option value="HOUR">Hours</option>
              </select>

              <select
                value={allocationFilter}
                onChange={(e) => setAllocationFilter(e.target.value)}
                className="px-3 py-2 bg-surface/50 border border-border rounded-xl text-xs font-semibold text-navy focus:outline-none"
              >
                <option value="">All Allocation Rules</option>
                <option value="true">Requires Allocation</option>
                <option value="false">No Allocation Needed</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-surface/50 border border-border rounded-xl text-xs font-semibold text-navy focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          {/* Main Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
              <span className="ml-3 text-slate font-medium text-sm">Loading types...</span>
            </div>
          ) : error ? (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 flex items-center gap-3">
              <AlertCircle size={20} className="shrink-0" />
              <div>
                <p className="font-semibold text-sm">Failed to load time off types</p>
                <p className="text-xs opacity-90">{(error as any)?.message || 'An unexpected error occurred'}</p>
              </div>
            </div>
          ) : !data?.items?.length ? (
            <div className="bg-white rounded-2xl border border-border p-12 text-center text-slate shadow-xs">
              <Layers className="w-12 h-12 mx-auto text-slate/30 mb-3" />
              <h3 className="text-base font-bold text-navy">No Time Off Types Found</h3>
              <p className="text-xs text-slate mt-1 max-w-sm mx-auto">
                No leave types match your current search criteria. Click "New Type" to create one.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {data.items.map((type) => (
                <div
                  key={type.id}
                  className="bg-white rounded-2xl border border-border shadow-xs hover:border-accent/40 hover:shadow-md transition-all p-5 flex flex-col justify-between"
                >
                  <div>
                    {/* Card Top */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-navy truncate" title={type.name}>
                          {type.name}
                        </h3>
                        <span
                          className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                            type.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {type.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-2 py-1 text-xs font-mono font-bold rounded-lg bg-surface border border-border text-navy">
                          {type.unit}
                        </span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate line-clamp-2 mt-2 min-h-[32px]">
                      {type.description || 'No description provided.'}
                    </p>

                    {/* Meta Badges */}
                    <div className="mt-4 space-y-2 pt-3 border-t border-border/60">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate">Allocation:</span>
                        <span
                          className={`font-semibold ${
                            type.requiresAllocation ? 'text-navy' : 'text-slate-500'
                          }`}
                        >
                          {type.requiresAllocation ? 'Required' : 'Optional / None'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate">Approval Mode:</span>
                        <span className="font-semibold text-navy">
                          {type.approvalMode === 'NO_APPROVAL' ? 'Auto Approved' : 'HR Approval'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate">Payroll Treatment:</span>
                        <span
                          className={`font-semibold ${
                            type.payrollTreatment === 'PAID' ? 'text-emerald-600' : 'text-amber-600'
                          }`}
                        >
                          {type.payrollTreatment === 'PAID' ? 'Paid Leave' : 'Unpaid Leave'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-slate">Usage:</span>
                        <span className="font-mono text-[11px] text-slate font-medium">
                          {type.activeAllocationsCount} alloc · {type.activeRequestsCount} req
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {isHrOrAdmin && (
                    <div className="mt-5 pt-3 border-t border-border flex items-center justify-between">
                      <button
                        onClick={() => handleToggleStatus(type)}
                        disabled={toggleStatusMutation.isPending}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
                          type.status === 'ACTIVE'
                            ? 'border-red-200 text-red-600 hover:bg-red-50'
                            : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        <Power size={13} />
                        <span>{type.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</span>
                      </button>

                      <button
                        onClick={() => handleOpenEdit(type)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-surface text-navy hover:bg-surface/80 border border-border transition-colors flex items-center gap-1.5"
                      >
                        <Edit2 size={13} />
                        <span>Edit</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal for Create/Edit */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white w-full max-w-lg rounded-2xl border border-border shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-navy">
                    {editingType ? 'Edit Time Off Type' : 'Create Time Off Type'}
                  </h3>
                  <p className="text-xs text-slate mt-0.5">
                    Define leave calculation, unit, and approval mode.
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg text-slate hover:bg-surface transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1">
                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">
                    Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Annual Leave, Sick Leave"
                    className="w-full px-3 py-2 bg-surface/40 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={formData.description || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value || null })
                    }
                    placeholder="Explain the policy and guidelines..."
                    className="w-full px-3 py-2 bg-surface/40 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-navy mb-1">
                      Unit <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.unit}
                      disabled={Boolean(editingType && editingType.activeAllocationsCount > 0)}
                      onChange={(e) =>
                        setFormData({ ...formData, unit: e.target.value as TimeOffUnit })
                      }
                      className="w-full px-3 py-2 bg-surface/40 border border-border rounded-xl text-sm font-semibold text-navy focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <option value="DAY">DAY (Whole Days)</option>
                      <option value="HOUR">HOUR (15-min increments)</option>
                    </select>
                    {editingType && editingType.activeAllocationsCount > 0 && (
                      <p className="text-[11px] text-amber-600 mt-1">
                        Unit locked: allocations exist for this type.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-navy mb-1">
                      Payroll Treatment
                    </label>
                    <select
                      value={formData.payrollTreatment}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          payrollTreatment: e.target.value as TimeOffPayrollTreatment,
                        })
                      }
                      className="w-full px-3 py-2 bg-surface/40 border border-border rounded-xl text-sm font-semibold text-navy focus:outline-none"
                    >
                      <option value="PAID">PAID (Standard Pay)</option>
                      <option value="UNPAID">UNPAID (Leave Without Pay)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-navy mb-1">
                      Approval Mode
                    </label>
                    <select
                      value={formData.approvalMode}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          approvalMode: e.target.value as TimeOffApprovalMode,
                        })
                      }
                      className="w-full px-3 py-2 bg-surface/40 border border-border rounded-xl text-sm font-semibold text-navy focus:outline-none"
                    >
                      <option value="HR_APPROVAL">HR Approval Required</option>
                      <option value="NO_APPROVAL">No Approval (Auto Approved)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-navy mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          status: e.target.value as 'ACTIVE' | 'INACTIVE',
                        })
                      }
                      className="w-full px-3 py-2 bg-surface/40 border border-border rounded-xl text-sm font-semibold text-navy focus:outline-none"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.requiresAllocation}
                      onChange={(e) =>
                        setFormData({ ...formData, requiresAllocation: e.target.checked })
                      }
                      className="rounded border-border text-accent focus:ring-accent w-4 h-4"
                    />
                    <div>
                      <span className="text-xs font-semibold text-navy block">
                        Requires Allocation
                      </span>
                      <span className="text-[11px] text-slate block">
                        If checked, employees must have an approved, active balance allocation
                        before requesting this leave.
                      </span>
                    </div>
                  </label>
                </div>

                <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
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
                    <span>{editingType ? 'Save Changes' : 'Create Type'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
