import { Search, X, Filter } from 'lucide-react';
import type { AttendanceStatus, AttendanceFlag } from '@peoplepay360/shared';

interface FilterChip {
  id: string;
  label: string;
}

interface AttendanceToolbarProps {
  onNew: () => void;
  canCreate: boolean;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  statusFilter?: AttendanceStatus | '';
  setStatusFilter: (val: AttendanceStatus | '') => void;
  flagFilter?: AttendanceFlag | '';
  setFlagFilter: (val: AttendanceFlag | '') => void;
  filterChips: FilterChip[];
  onRemoveFilterChip: (id: string) => void;
}

export default function AttendanceToolbar({
  onNew,
  canCreate,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  flagFilter,
  setFlagFilter,
  filterChips,
  onRemoveFilterChip,
}: AttendanceToolbarProps) {
  return (
    <div className="bg-white border-b border-border p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        {canCreate && (
          <button
            onClick={onNew}
            className="bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-md font-semibold text-xs tracking-wider uppercase transition-colors shadow-xs"
          >
            New Attendance
          </button>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search employee name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-1.5 border border-border rounded-md text-xs w-60 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-navy"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5 text-xs text-slate">
          <Filter className="w-3.5 h-3.5 text-muted" />
          <select
            value={statusFilter || ''}
            onChange={(e) => setStatusFilter((e.target.value as AttendanceStatus) || '')}
            className="border border-border rounded-md px-2.5 py-1.5 text-xs text-navy focus:outline-none focus:border-accent bg-white"
          >
            <option value="">All Statuses</option>
            <option value="PRESENT">Present</option>
            <option value="LATE">Late</option>
            <option value="ABSENT">Absent</option>
          </select>
        </div>

        {/* Flag Filter */}
        <div className="flex items-center gap-1.5 text-xs text-slate">
          <select
            value={flagFilter || ''}
            onChange={(e) => setFlagFilter((e.target.value as AttendanceFlag) || '')}
            className="border border-border rounded-md px-2.5 py-1.5 text-xs text-navy focus:outline-none focus:border-accent bg-white"
          >
            <option value="">All Flags</option>
            <option value="OVERTIME">Overtime</option>
            <option value="MISSING_CHECK_OUT">Missing Check Out</option>
            <option value="MANUALLY_EDITED">Manually Edited</option>
          </select>
        </div>
      </div>

      {/* Filter Chips */}
      {filterChips.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {filterChips.map((chip) => (
            <span
              key={chip.id}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border bg-surface text-xs font-semibold text-navy animate-in fade-in slide-in-from-left-2 duration-150 shadow-2xs"
            >
              {chip.label}
              <button
                onClick={() => onRemoveFilterChip(chip.id)}
                className="text-muted hover:text-navy transition-colors"
                title="Remove filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
