import React from 'react';
import { Search } from 'lucide-react';

interface ContractsToolbarProps {
  onNew: () => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  filterEmployee: string | null;
  onClearFilter: () => void;
}

export default function ContractsToolbar({ onNew, searchQuery, setSearchQuery, filterEmployee, onClearFilter }: ContractsToolbarProps) {
  return (
    <div className="flex items-center justify-between px-8 py-4 bg-white border-b border-border">
      <div className="flex items-center gap-4 flex-1">
        <h2 className="text-xl font-display font-semibold text-navy">Contracts</h2>
        
        <div className="relative w-64 ml-4 group">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate group-hover:text-navy transition-colors duration-200" />
          <input
            type="text"
            placeholder="Search contracts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-surface/50 border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent hover:border-slate/40 transition-all text-navy placeholder:text-mutedText"
          />
        </div>

        {filterEmployee && (
          <div className="flex items-center gap-2 px-3 py-1 bg-surface border border-border rounded-full animate-in fade-in slide-in-from-left-2 duration-150 hover:bg-surface/80 hover:shadow-sm transition-all cursor-default">
            <span className="text-xs text-navy font-medium">Employee: {filterEmployee}</span>
            <button onClick={onClearFilter} className="text-slate hover:text-navy hover:scale-110 text-xs font-bold leading-none transition-transform">&times;</button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onNew}
          className="px-4 py-1.5 bg-accent text-white text-sm font-medium rounded-md hover:bg-[#4a42d8] hover:shadow-md transition-all duration-200 active:scale-95 transform"
        >
          NEW
        </button>
      </div>
    </div>
  );
}
