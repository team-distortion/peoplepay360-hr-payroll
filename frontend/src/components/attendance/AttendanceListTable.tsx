import { useNavigate } from 'react-router-dom';
import { AlertCircle, Clock, AlertTriangle, ShieldCheck, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { AttendanceDto, AttendanceStatus, AttendanceFlag } from '@peoplepay360/shared';

function formatMinutesToHhMm(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

function formatTime(isoString: string | null): string {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface AttendanceListTableProps {
  records: AttendanceDto[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (newPage: number) => void;
}

export default function AttendanceListTable({
  records,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  page,
  pageSize,
  total,
  onPageChange,
}: AttendanceListTableProps) {
  const navigate = useNavigate();

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'PRESENT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Present
          </span>
        );
      case 'LATE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Late
          </span>
        );
      case 'ABSENT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Absent
          </span>
        );
      default:
        return null;
    }
  };

  const getFlagBadge = (flag: AttendanceFlag) => {
    switch (flag) {
      case 'OVERTIME':
        return (
          <span
            key={flag}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200"
            title="Overtime worked"
          >
            OT
          </span>
        );
      case 'MISSING_CHECK_OUT':
        return (
          <span
            key={flag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse"
            title="Open punch with missing check out"
          >
            <AlertTriangle className="w-3 h-3 text-amber-700" />
            Missing Out
          </span>
        );
      case 'MANUALLY_EDITED':
        return (
          <span
            key={flag}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-300"
            title="Manually edited/corrected by HR"
          >
            <ShieldCheck className="w-3 h-3 text-slate-500" />
            Edited
          </span>
        );
      default:
        return null;
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-border overflow-hidden mx-6 my-6 shadow-sm p-12 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <span className="text-sm font-medium text-slate">Loading attendance records...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-white rounded-xl border border-border overflow-hidden mx-6 my-6 shadow-sm p-12 flex flex-col items-center justify-center gap-3 text-center">
        <AlertCircle className="w-10 h-10 text-red-500" />
        <h3 className="text-base font-bold text-navy">Failed to load attendance records</h3>
        <p className="text-xs text-slate max-w-md">{errorMessage || 'An error occurred while fetching attendance data.'}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 px-4 py-1.5 bg-accent text-white text-xs font-semibold rounded-md hover:bg-accent/90 transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden mx-6 my-6 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface/50 text-xs font-semibold text-slate uppercase tracking-wider">
              <th className="px-6 py-3.5">Employee</th>
              <th className="px-6 py-3.5">Date</th>
              <th className="px-6 py-3.5">Check In</th>
              <th className="px-6 py-3.5">Check Out</th>
              <th className="px-6 py-3.5">Worked Time</th>
              <th className="px-6 py-3.5">Status</th>
              <th className="px-6 py-3.5">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {records.map((record) => {
              const isMissingOut = record.flags.includes('MISSING_CHECK_OUT');

              return (
                <tr
                  key={record.id}
                  onClick={() => navigate(`/attendance/${record.id}`)}
                  className="group hover:bg-surface/50 transition-colors cursor-pointer"
                >
                  {/* Employee */}
                  <td className="px-6 py-3.5">
                    <div className="font-semibold text-navy group-hover:text-accent transition-colors">
                      {record.employee.fullName}
                    </div>
                    <div className="text-xs text-muted flex items-center gap-2">
                      <span className="font-mono">{record.employee.employeeNumber}</span>
                      {record.department && <span>• {record.department.name}</span>}
                    </div>
                  </td>

                  {/* Date */}
                  <td className="px-6 py-3.5 text-navy font-mono text-xs">
                    {record.attendanceDate}
                  </td>

                  {/* Check In */}
                  <td className="px-6 py-3.5 text-navy tabular-nums">
                    {formatTime(record.checkInAt)}
                  </td>

                  {/* Check Out */}
                  <td className="px-6 py-3.5 tabular-nums">
                    {record.checkOutAt ? (
                      <span className="text-navy">{formatTime(record.checkOutAt)}</span>
                    ) : isMissingOut ? (
                      <span className="inline-flex items-center gap-1 text-amber-700 font-semibold text-xs bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                        In Progress
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>

                  {/* Worked Time */}
                  <td className="px-6 py-3.5">
                    <div className="font-semibold text-navy tabular-nums">
                      {formatMinutesToHhMm(record.workedMinutes)}
                    </div>
                    {record.overtimeMinutes > 0 && (
                      <div className="text-[11px] font-bold text-accent tabular-nums">
                        +{formatMinutesToHhMm(record.overtimeMinutes)} OT
                      </div>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-6 py-3.5">{getStatusBadge(record.status)}</td>

                  {/* Flags */}
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {record.flags.map((flag) => getFlagBadge(flag))}
                      {record.flags.length === 0 && <span className="text-muted text-xs">—</span>}
                    </div>
                  </td>
                </tr>
              );
            })}

            {records.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate">
                  No attendance records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-6 py-3 bg-surface/30 border-t border-border flex items-center justify-between text-xs text-slate">
        <span>
          Showing {records.length > 0 ? (page - 1) * pageSize + 1 : 0} to{' '}
          {Math.min(page * pageSize, total)} of {total} records
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="p-1 rounded border border-border bg-white hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-medium text-navy">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="p-1 rounded border border-border bg-white hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
