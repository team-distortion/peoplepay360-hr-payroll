import React from 'react';
import { Search, X } from 'lucide-react';

interface AttendanceToolbarProps {
  onNew: () => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  filters: string[];
  onRemoveFilter: (filter: string) => void;
}

export default function AttendanceToolbar({
  onNew,
  searchQuery,
  setSearchQuery,
  filters,
  onRemoveFilter
}: AttendanceToolbarProps) {
  return (
    <div className="bg-white border-b border-border p-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button
          onClick={onNew}
          className="bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors uppercase tracking-wide"
        >
          New
        </button>

        <div className="relative">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search attendance..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 border border-border rounded-md text-sm w-64 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
          />
        </div>

        {/* Filter Chips */}
        {filters.length > 0 && (
          <div className="flex items-center gap-2">
            {filters.map((filter) => (
              <span 
                key={filter} 
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border bg-surface text-sm font-medium text-navy animate-in fade-in slide-in-from-left-2 duration-150"
              >
                {filter}
                <button 
                  onClick={() => onRemoveFilter(filter)}
                  className="text-muted hover:text-navy transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
