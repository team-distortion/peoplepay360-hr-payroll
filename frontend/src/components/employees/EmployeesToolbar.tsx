import { Search, LayoutGrid, List as ListIcon } from 'lucide-react';

interface EmployeesToolbarProps {
  onNew: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  view: 'kanban' | 'list';
  setView: (view: 'kanban' | 'list') => void;
}

export default function EmployeesToolbar({
  onNew,
  searchQuery,
  setSearchQuery,
  view,
  setView,
}: EmployeesToolbarProps) {
  return (
    <div className="flex items-center justify-between py-4 px-8 border-b border-border bg-white">
      <div className="flex items-center gap-4">
        <button
          onClick={onNew}
          className="px-4 py-1.5 bg-accent text-white text-sm font-medium rounded-full hover:brightness-90 transition-all duration-200 ease-in-out active:scale-95 shadow-sm"
        >
          NEW
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative group">
          <Search className="w-4 h-4 text-mutedText absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-accent transition-colors" />
          <input
            type="text"
            placeholder="Search employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-1.5 text-sm rounded-full border border-border bg-surface w-64 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
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
