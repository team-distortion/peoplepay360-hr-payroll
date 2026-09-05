import { useState, useMemo } from 'react';
import type React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Plus,
  Search,
  Briefcase,
  AlertCircle,
  Loader2,
  RefreshCw,
  Power,
} from 'lucide-react';
import type {
  WorkingScheduleStatus,
  WorkingScheduleType,
  WorkingScheduleDto,
} from '@peoplepay360/shared';
import AppLayout from '../components/layout/AppLayout';
import {
  useSchedules,
  useUpdateScheduleStatus,
} from '../features/schedules/schedules.queries';

export default function SchedulesPage() {
  const navigate = useNavigate();

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<WorkingScheduleStatus | 'ALL'>('ALL');
  const [selectedType, setSelectedType] = useState<WorkingScheduleType | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Query API
  const queryParams = useMemo(() => ({
    search: searchQuery.trim() || undefined,
    status: selectedStatus === 'ALL' ? undefined : selectedStatus,
    type: selectedType === 'ALL' ? undefined : selectedType,
    page,
    pageSize,
  }), [searchQuery, selectedStatus, selectedType, page, pageSize]);

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useSchedules(queryParams);

  const statusMutation = useUpdateScheduleStatus();
  const [statusActionId, setStatusActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const schedules = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize) || 1;

  const handleToggleStatus = async (
    e: React.MouseEvent,
    schedule: WorkingScheduleDto
  ) => {
    e.stopPropagation(); // prevent row navigation
    setActionError(null);
    setStatusActionId(schedule.id);

    const nextStatus: WorkingScheduleStatus =
      schedule.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    try {
      await statusMutation.mutateAsync({
        id: schedule.id,
        status: nextStatus,
      });
    } catch (err: any) {
      setActionError(err.message || 'Failed to update schedule status.');
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
            <Link
              to="/schedules/new"
              className="group flex items-center gap-2 px-5 py-2.5 bg-brandAccent hover:bg-[#4a44cc] text-white font-medium rounded-full transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 text-sm"
            >
              <Plus size={16} className="transition-transform duration-300 group-hover:rotate-90" />
              <span>New Schedule</span>
            </Link>
            <div>
              <h1 className="text-3xl font-display font-bold text-navy tracking-tight">
                Working Schedules
              </h1>
              <p className="text-xs text-mutedText mt-0.5">
                Manage organization-wide weekly shift patterns, durations, and status
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2.5 text-slate hover:text-navy hover:bg-surface rounded-full transition-colors border border-border"
              title="Refresh schedule list"
            >
              <RefreshCw size={16} className={isFetching ? 'animate-spin text-brandAccent' : ''} />
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
        <div className="p-8 flex-1 flex flex-col max-w-[1600px] w-full mx-auto">
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
                placeholder="Search by schedule or company..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 bg-white border border-border rounded-full focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all text-sm text-navy placeholder:text-mutedText shadow-xs"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center bg-white border border-border rounded-full px-3 py-1 text-xs shadow-xs">
              <span className="text-mutedText mr-2 font-medium">Status:</span>
              {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setSelectedStatus(st);
                    setPage(1);
                  }}
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

            {/* Type Filter */}
            <div className="flex items-center bg-white border border-border rounded-full px-3 py-1 text-xs shadow-xs">
              <span className="text-mutedText mr-2 font-medium">Type:</span>
              {(['ALL', 'STANDARD', 'SHIFT', 'FLEXIBLE'] as const).map((tp) => (
                <button
                  key={tp}
                  onClick={() => {
                    setSelectedType(tp);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-full font-medium transition-all ${
                    selectedType === tp
                      ? 'bg-brandAccent text-white shadow-xs'
                      : 'text-slate hover:text-navy'
                  }`}
                >
                  {tp === 'ALL'
                    ? 'All'
                    : tp.charAt(0) + tp.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            <div className="ml-auto text-xs text-mutedText font-medium">
              Showing {schedules.length} of {total} schedules
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col">
            {/* Loading State */}
            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-16">
                <Loader2 className="w-8 h-8 text-brandAccent animate-spin mb-3" />
                <span className="text-sm font-medium text-slate">Loading working schedules...</span>
              </div>
            ) : isError ? (
              /* Error State */
              <div className="flex-1 flex flex-col items-center justify-center p-16 text-center">
                <div className="w-12 h-12 rounded-full bg-error/10 text-error flex items-center justify-center mb-3">
                  <AlertCircle size={24} />
                </div>
                <h3 className="text-base font-bold text-navy mb-1">Failed to load schedules</h3>
                <p className="text-xs text-slate max-w-sm mb-4">
                  {(error as Error)?.message || 'An error occurred while connecting to the server.'}
                </p>
                <button
                  onClick={() => refetch()}
                  className="px-4 py-2 bg-brandAccent text-white rounded-full text-xs font-medium hover:bg-[#4a44cc] transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : schedules.length === 0 ? (
              /* Empty State */
              <div className="flex-1 flex flex-col items-center justify-center p-16 text-center">
                <div className="w-12 h-12 rounded-full bg-surface text-brandAccent flex items-center justify-center mb-3">
                  <Briefcase size={24} />
                </div>
                {searchQuery || selectedStatus !== 'ALL' || selectedType !== 'ALL' ? (
                  <>
                    <h3 className="text-base font-bold text-navy mb-1">No schedules match your filters</h3>
                    <p className="text-xs text-slate max-w-sm mb-4">
                      Try clearing or adjusting your search query or filter tags.
                    </p>
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedStatus('ALL');
                        setSelectedType('ALL');
                        setPage(1);
                      }}
                      className="px-4 py-2 border border-border text-navy rounded-full text-xs font-medium hover:bg-surface transition-colors"
                    >
                      Clear Filters
                    </button>
                  </>
                ) : (
                  <>
                    <h3 className="text-base font-bold text-navy mb-1">No working schedules have been created</h3>
                    <p className="text-xs text-slate max-w-sm mb-4">
                      Create your first working schedule to establish attendance expectations and weekly shift patterns.
                    </p>
                    <Link
                      to="/schedules/new"
                      className="px-5 py-2 bg-brandAccent text-white rounded-full text-xs font-medium hover:bg-[#4a44cc] transition-colors"
                    >
                      Create Working Schedule
                    </Link>
                  </>
                )}
              </div>
            ) : (
              /* Data Table */
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="border-b border-border bg-surface/70 text-xs uppercase tracking-wider text-mutedText font-semibold">
                      <th className="px-6 py-4 font-semibold">Schedule Name</th>
                      <th className="px-6 py-4 font-semibold">Type</th>
                      <th className="px-6 py-4 font-semibold">Days / Week</th>
                      <th className="px-6 py-4 font-semibold">Hours / Week</th>
                      <th className="px-6 py-4 font-semibold">Company</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-navy divide-y divide-border">
                    {schedules.map((schedule) => {
                      const weeklyHours = (schedule.weeklyMinutes / 60).toFixed(1);
                      const isPendingStatus = statusActionId === schedule.id;

                      return (
                        <tr
                          key={schedule.id}
                          onClick={() => navigate(`/schedules/${schedule.id}`)}
                          className="cursor-pointer transition-colors duration-150 hover:bg-surface/50 group"
                        >
                          {/* Schedule Name */}
                          <td className="px-6 py-4 font-medium group-hover:text-brandAccent transition-colors relative">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-brandAccent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <span>{schedule.name}</span>
                          </td>

                          {/* Type */}
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                schedule.type === 'STANDARD'
                                  ? 'border-blue-200 text-blue-700 bg-blue-50'
                                  : schedule.type === 'SHIFT'
                                  ? 'border-purple-200 text-purple-700 bg-purple-50'
                                  : 'border-amber-200 text-amber-700 bg-amber-50'
                              }`}
                            >
                              {schedule.type.charAt(0) + schedule.type.slice(1).toLowerCase()}
                            </span>
                          </td>

                          {/* Days / Week */}
                          <td className="px-6 py-4 text-slate">
                            {schedule.daysPerWeek} {schedule.daysPerWeek === 1 ? 'day' : 'days'}
                          </td>

                          {/* Hours / Week */}
                          <td className="px-6 py-4 text-slate font-semibold">
                            {weeklyHours}h
                          </td>

                          {/* Company */}
                          <td className="px-6 py-4 text-slate">
                            {schedule.companyName}
                          </td>

                          {/* Status Badge */}
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                schedule.status === 'ACTIVE'
                                  ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
                                  : 'border-slate-200 text-slate-600 bg-slate-100'
                              }`}
                            >
                              {schedule.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                            </span>
                          </td>

                          {/* Quick Actions */}
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={(e) => handleToggleStatus(e, schedule)}
                              disabled={isPendingStatus}
                              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors inline-flex items-center gap-1 ${
                                schedule.status === 'ACTIVE'
                                  ? 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                                  : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                              }`}
                              title={
                                schedule.status === 'ACTIVE'
                                  ? 'Deactivate this schedule'
                                  : 'Reactivate this schedule'
                              }
                            >
                              {isPendingStatus ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Power size={12} />
                              )}
                              <span>
                                {schedule.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                              </span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-border bg-surface/30 flex items-center justify-between text-xs text-slate">
                <span>
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 border border-border rounded-lg bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 border border-border rounded-lg bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          <p className="mt-4 text-xs text-mutedText text-center">
            Click any schedule row to edit its weekly shift pattern and break configurations.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
