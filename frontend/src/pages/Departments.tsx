import { useState } from 'react';
import {
  Plus,
  Search,
  Building2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Power,
  Check,
  X,
  Pencil,
} from 'lucide-react';
import type { RecordStatus, DepartmentDto } from '@peoplepay360/shared';
import AppLayout from '../components/layout/AppLayout';
import {
  useDepartments,
  useCreateDepartment,
  useUpdateDepartment,
} from '../features/departments/departments.queries';

export default function DepartmentsPage() {
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<RecordStatus | 'ALL'>('ALL');

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Action state
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusActionId, setStatusActionId] = useState<string | null>(null);

  // Queries & Mutations
  const queryParams = {
    search: searchQuery.trim() || undefined,
    status: selectedStatus === 'ALL' ? undefined : selectedStatus,
  };

  const {
    data: departments = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useDepartments(queryParams);

  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment();

  const handleCreate = async () => {
    const trimmed = newDeptName.trim();
    if (!trimmed) {
      setCreateError('Department name is required.');
      return;
    }
    setCreateError(null);
    try {
      await createMutation.mutateAsync({ name: trimmed, status: 'ACTIVE' });
      setNewDeptName('');
      setShowCreateForm(false);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create department.');
    }
  };

  const startEdit = (dept: DepartmentDto) => {
    setEditingId(dept.id);
    setEditName(dept.name);
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditError(null);
  };

  const handleSaveEdit = async (dept: DepartmentDto) => {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditError('Department name is required.');
      return;
    }
    setEditError(null);
    try {
      await updateMutation.mutateAsync({
        id: dept.id,
        input: { name: trimmed, status: dept.status },
      });
      cancelEdit();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update department.');
    }
  };

  const handleToggleStatus = async (
    e: React.MouseEvent,
    dept: DepartmentDto
  ) => {
    e.stopPropagation();
    setActionError(null);
    setStatusActionId(dept.id);

    const nextStatus: RecordStatus =
      dept.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    try {
      await updateMutation.mutateAsync({
        id: dept.id,
        input: { name: dept.name, status: nextStatus },
      });
    } catch (err: any) {
      setActionError(err.message || 'Failed to update department status.');
    } finally {
      setStatusActionId(null);
    }
  };

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col bg-surface/30">
        {/* Top Header */}
        <div className="px-8 py-6 bg-white border-b border-border flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setShowCreateForm(true);
                setCreateError(null);
                setNewDeptName('');
              }}
              className="group flex items-center gap-2 px-5 py-2.5 bg-brandAccent hover:bg-[#4a44cc] text-white font-medium rounded-full transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 text-sm"
            >
              <Plus
                size={16}
                className="transition-transform duration-300 group-hover:rotate-90"
              />
              <span>New Department</span>
            </button>
            <div>
              <h1 className="text-3xl font-display font-bold text-navy tracking-tight">
                Departments
              </h1>
              <p className="text-xs text-mutedText mt-0.5">
                Manage organizational departments and their status
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2.5 text-slate hover:text-navy hover:bg-surface rounded-full transition-colors border border-border"
              title="Refresh department list"
            >
              <RefreshCw
                size={16}
                className={
                  isFetching ? 'animate-spin text-brandAccent' : ''
                }
              />
            </button>
          </div>
        </div>

        {/* Action Error Alert */}
        {actionError && (
          <div className="mx-8 mt-4 p-3.5 bg-error/10 border border-error/20 rounded-xl flex items-center justify-between text-error text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{actionError}</span>
            </div>
            <button
              onClick={() => setActionError(null)}
              className="text-xs font-semibold hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="p-8 flex-1 flex flex-col max-w-[1200px] w-full mx-auto">
          {/* Filters & Search Toolbar */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            {/* Search Input */}
            <div className="relative w-80">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mutedText"
                size={16}
              />
              <input
                type="text"
                placeholder="Search departments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-border rounded-full focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all text-sm text-navy placeholder:text-mutedText shadow-xs"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center bg-white border border-border rounded-full px-3 py-1 text-xs shadow-xs">
              <span className="text-mutedText mr-2 font-medium">Status:</span>
              {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className={`px-2.5 py-1 rounded-full font-medium transition-all ${
                    selectedStatus === st
                      ? 'bg-brandAccent text-white shadow-xs'
                      : 'text-slate hover:text-navy'
                  }`}
                >
                  {st === 'ALL' ? 'All' : st === 'ACTIVE' ? 'Active' : 'Inactive'}
                </button>
              ))}
            </div>

            <div className="ml-auto text-xs text-mutedText font-medium">
              {departments.length} department{departments.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col">
            {/* Loading State */}
            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-16">
                <Loader2 className="w-8 h-8 text-brandAccent animate-spin mb-3" />
                <span className="text-sm font-medium text-slate">
                  Loading departments...
                </span>
              </div>
            ) : isError ? (
              /* Error State */
              <div className="flex-1 flex flex-col items-center justify-center p-16 text-center">
                <div className="w-12 h-12 rounded-full bg-error/10 text-error flex items-center justify-center mb-3">
                  <AlertCircle size={24} />
                </div>
                <h3 className="text-base font-bold text-navy mb-1">
                  Failed to load departments
                </h3>
                <p className="text-xs text-slate max-w-sm mb-4">
                  {(error as Error)?.message ||
                    'An error occurred while connecting to the server.'}
                </p>
                <button
                  onClick={() => refetch()}
                  className="px-4 py-2 bg-brandAccent text-white rounded-full text-xs font-medium hover:bg-[#4a44cc] transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : departments.length === 0 && !showCreateForm ? (
              /* Empty State */
              <div className="flex-1 flex flex-col items-center justify-center p-16 text-center">
                <div className="w-12 h-12 rounded-full bg-surface text-brandAccent flex items-center justify-center mb-3">
                  <Building2 size={24} />
                </div>
                {searchQuery || selectedStatus !== 'ALL' ? (
                  <>
                    <h3 className="text-base font-bold text-navy mb-1">
                      No departments match your filters
                    </h3>
                    <p className="text-xs text-slate max-w-sm mb-4">
                      Try clearing or adjusting your search query or filter.
                    </p>
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedStatus('ALL');
                      }}
                      className="px-4 py-2 border border-border text-navy rounded-full text-xs font-medium hover:bg-surface transition-colors"
                    >
                      Clear Filters
                    </button>
                  </>
                ) : (
                  <>
                    <h3 className="text-base font-bold text-navy mb-1">
                      No departments have been created
                    </h3>
                    <p className="text-xs text-slate max-w-sm mb-4">
                      Create your first department to organize employees into
                      teams and business units.
                    </p>
                    <button
                      onClick={() => {
                        setShowCreateForm(true);
                        setNewDeptName('');
                        setCreateError(null);
                      }}
                      className="px-5 py-2 bg-brandAccent text-white rounded-full text-xs font-medium hover:bg-[#4a44cc] transition-colors"
                    >
                      Create Department
                    </button>
                  </>
                )}
              </div>
            ) : (
              /* Data Table */
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-surface/70 text-xs uppercase tracking-wider text-mutedText font-semibold">
                      <th className="px-6 py-4 font-semibold">
                        Department Name
                      </th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">Created</th>
                      <th className="px-6 py-4 font-semibold text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-navy divide-y divide-border">
                    {/* Inline Create Row */}
                    {showCreateForm && (
                      <tr className="bg-brandAccent/5 border-b border-brandAccent/20">
                        <td className="px-6 py-3" colSpan={1}>
                          <div className="flex flex-col gap-1">
                            <input
                              type="text"
                              value={newDeptName}
                              onChange={(e) => setNewDeptName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreate();
                                if (e.key === 'Escape') {
                                  setShowCreateForm(false);
                                  setCreateError(null);
                                }
                              }}
                              placeholder="Department name..."
                              autoFocus
                              className="w-full px-3 py-2 text-sm text-navy border border-border rounded-lg bg-white focus:outline-none focus:border-brandAccent focus:ring-1 focus:ring-brandAccent/20 placeholder:text-mutedText"
                            />
                            {createError && (
                              <p className="text-xs text-error">{createError}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-emerald-200 text-emerald-700 bg-emerald-50">
                            Active
                          </span>
                        </td>
                        <td className="px-6 py-3 text-slate text-xs">Now</td>
                        <td className="px-6 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={handleCreate}
                              disabled={createMutation.isPending}
                              className="px-3 py-1.5 rounded-full text-xs font-medium bg-brandAccent text-white hover:bg-[#4a44cc] transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                            >
                              {createMutation.isPending ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Check size={12} />
                              )}
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setShowCreateForm(false);
                                setCreateError(null);
                              }}
                              className="px-3 py-1.5 rounded-full text-xs font-medium border border-border text-slate hover:bg-surface transition-colors inline-flex items-center gap-1"
                            >
                              <X size={12} />
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Department Rows */}
                    {departments.map((dept) => {
                      const isEditing = editingId === dept.id;
                      const isPendingStatus = statusActionId === dept.id;

                      return (
                        <tr
                          key={dept.id}
                          className="cursor-default transition-colors duration-150 hover:bg-surface/50 group"
                        >
                          {/* Department Name */}
                          <td className="px-6 py-4 font-medium relative">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-brandAccent opacity-0 group-hover:opacity-100 transition-opacity" />
                            {isEditing ? (
                              <div className="flex flex-col gap-1">
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveEdit(dept);
                                    if (e.key === 'Escape') cancelEdit();
                                  }}
                                  autoFocus
                                  className="w-full px-3 py-1.5 text-sm text-navy border border-border rounded-lg bg-white focus:outline-none focus:border-brandAccent focus:ring-1 focus:ring-brandAccent/20"
                                />
                                {editError && (
                                  <p className="text-xs text-error">
                                    {editError}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Building2
                                  size={16}
                                  className="text-brandAccent/60 flex-shrink-0"
                                />
                                <span className="group-hover:text-brandAccent transition-colors">
                                  {dept.name}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Status Badge */}
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                dept.status === 'ACTIVE'
                                  ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
                                  : 'border-slate-200 text-slate-600 bg-slate-100'
                              }`}
                            >
                              {dept.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                            </span>
                          </td>

                          {/* Created Date */}
                          <td className="px-6 py-4 text-slate text-xs">
                            {new Date(dept.createdAt).toLocaleDateString(
                              'en-IN',
                              {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              }
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4 text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleSaveEdit(dept)}
                                  disabled={updateMutation.isPending}
                                  className="px-3 py-1 rounded-full text-xs font-medium bg-brandAccent text-white hover:bg-[#4a44cc] transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                                >
                                  {updateMutation.isPending ? (
                                    <Loader2
                                      size={12}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <Check size={12} />
                                  )}
                                  Save
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="px-3 py-1 rounded-full text-xs font-medium border border-border text-slate hover:bg-surface transition-colors inline-flex items-center gap-1"
                                >
                                  <X size={12} />
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => startEdit(dept)}
                                  className="px-3 py-1 rounded-full text-xs font-medium border border-border text-slate hover:bg-surface hover:text-navy transition-colors inline-flex items-center gap-1"
                                  title="Rename department"
                                >
                                  <Pencil size={12} />
                                  Rename
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleToggleStatus(e, dept)}
                                  disabled={isPendingStatus}
                                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors inline-flex items-center gap-1 ${
                                    dept.status === 'ACTIVE'
                                      ? 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                                      : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                  }`}
                                  title={
                                    dept.status === 'ACTIVE'
                                      ? 'Deactivate this department'
                                      : 'Reactivate this department'
                                  }
                                >
                                  {isPendingStatus ? (
                                    <Loader2
                                      size={12}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <Power size={12} />
                                  )}
                                  <span>
                                    {dept.status === 'ACTIVE'
                                      ? 'Deactivate'
                                      : 'Activate'}
                                  </span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="mt-4 text-xs text-mutedText text-center">
            Departments organize employees into logical groups. Use the Employees
            page to assign employees to departments.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
