import { Search, LayoutGrid, List as ListIcon, Filter } from 'lucide-react';
import { useDepartments } from '../../features/departments/departments.queries';
import { EmployeeTypeValues, RecordStatusValues } from '@peoplepay360/shared';

interface EmployeesToolbarProps {
  onNew: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  view: 'kanban' | 'list';
  setView: (view: 'kanban' | 'list') => void;
  statusFilter?: string;
  setStatusFilter: (status?: string) => void;
  departmentFilter?: string;
  setDepartmentFilter: (deptId?: string) => void;
  typeFilter?: string;
  setTypeFilter: (type?: string) => void;
}

export default function EmployeesToolbar({
  onNew,
  searchQuery,
  setSearchQuery,
  view,
  setView,
  statusFilter,
  setStatusFilter,
  departmentFilter,
  setDepartmentFilter,
  typeFilter,
  setTypeFilter,
}: EmployeesToolbarProps) {
  const { data: departments = [] } = useDepartments();

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-4 px-8 border-b border-border bg-white">
      <div className="flex items-center gap-3">
        <button
          onClick={onNew}
          className="px-5 py-2 bg-accent text-white text-xs font-semibold rounded-full hover:brightness-90 transition-all duration-200 ease-in-out active:scale-95 shadow-sm uppercase tracking-wider"
        >
          NEW
        </button>

        {/* Filter controls */}
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-mutedText ml-2" />
          {/* Department Filter */}
          <select
            value={departmentFilter || ''}
            onChange={(e) => setDepartmentFilter(e.target.value || undefined)}
            className="text-xs text-navy bg-surface border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-accent"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Employee Type Filter */}
          <select
            value={typeFilter || ''}
            onChange={(e) => setTypeFilter(e.target.value || undefined)}
            className="text-xs text-navy bg-surface border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-accent"
          >
            <option value="">All Employment Types</option>
            {EmployeeTypeValues.map((type) => (
              <option key={type} value={type}>
                {type.replace('_', ' ')}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter || ''}
            onChange={(e) => setStatusFilter(e.target.value || undefined)}
            className="text-xs text-navy bg-surface border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-accent"
          >
            <option value="">All Statuses</option>
            {RecordStatusValues.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative group">
          <Search className="w-4 h-4 text-mutedText absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-accent transition-colors" />
          <input
            type="text"
            placeholder="Search employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-1.5 text-sm rounded-full border border-border bg-surface w-64 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all placeholder:text-mutedText"
          />
        </div>

        <div className="flex items-center bg-surface p-1 rounded-full border border-border relative">
          {/* Animated background pill */}
          <div
            className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-full shadow-sm transition-transform duration-200 ease-in-out"
            style={{
              transform: view === 'kanban' ? 'translateX(0)' : 'translateX(100%)',
              left: '4px',
            }}
          />
          <button
            onClick={() => setView('kanban')}
            className={`relative z-10 px-3 py-1 flex items-center justify-center rounded-full transition-colors ${
              view === 'kanban' ? 'text-navy' : 'text-slate hover:text-navy'
            }`}
            aria-label="Kanban view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView('list')}
            className={`relative z-10 px-3 py-1 flex items-center justify-center rounded-full transition-colors ${
              view === 'list' ? 'text-navy' : 'text-slate hover:text-navy'
            }`}
            aria-label="List view"
          >
            <ListIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
