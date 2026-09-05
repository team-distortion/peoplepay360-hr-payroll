import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Calendar, AlertTriangle, ChevronRight, Users } from 'lucide-react';
import StatusBadge from './StatusBadge';
import type { Payrun, PayrunStatus } from './mockData';

interface Props {
  payruns: Payrun[];
}

export default function PayrunList({ payruns }: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PayrunStatus | 'All'>('All');
  const [yearFilter, setYearFilter] = useState<string>('All');

  // Extract available years
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    payruns.forEach(p => {
      const match = p.periodLabel.match(/\d{4}/);
      if (match) years.add(match[0]);
    });
    return Array.from(years).sort().reverse();
  }, [payruns]);

  const filteredPayruns = useMemo(() => {
    return payruns.filter(p => {
      if (statusFilter !== 'All' && p.status !== statusFilter) return false;
      if (yearFilter !== 'All' && !p.periodLabel.includes(yearFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          p.periodLabel.toLowerCase().includes(q) ||
          p.structureName.toLowerCase().includes(q) ||
          p.periodStart.toLowerCase().includes(q) ||
          p.periodEnd.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [payruns, search, statusFilter, yearFilter]);

  return (
    <div className="flex flex-col flex-1 bg-surface/30 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between px-8 py-5 bg-white border-b border-border gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold text-navy">Payruns</h1>
          <p className="text-xs text-mutedText mt-0.5">
            Manage payroll batches, generate employee payslips, and process salary disbursements.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/payroll/payruns/new')}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-accent hover:bg-accent/90 rounded-md shadow-sm transition-all"
          >
            <Plus size={15} />
            New Payrun
          </button>
        </div>
      </div>

      {/* Toolbar / Filters */}
      <div className="px-8 py-4 bg-white/60 border-b border-border flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 max-w-lg">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
            <input
              type="text"
              placeholder="Search payruns by period or structure..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-surface/60 border border-border rounded-md text-sm text-navy placeholder:text-mutedText focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-surface p-1 rounded-md border border-border">
            {(['All', 'Draft', 'Validated', 'Paid'] as const).map(status => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
                  statusFilter === status
                    ? 'bg-white text-navy shadow-sm'
                    : 'text-slate hover:text-navy'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Year Filter */}
          {availableYears.length > 0 && (
            <select
              value={yearFilter}
              onChange={e => setYearFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-border rounded-md text-xs font-medium text-navy focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="All">All Years</option>
              {availableYears.map(year => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Payrun Cards / List */}
      <div className="px-8 py-6 space-y-3">
        {filteredPayruns.length === 0 ? (
          <div className="bg-white rounded-lg border border-border p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-surface mx-auto flex items-center justify-center text-slate mb-3">
              <Calendar size={22} />
            </div>
            <h3 className="text-sm font-semibold text-navy">No payruns found</h3>
            <p className="text-xs text-mutedText mt-1">
              {search || statusFilter !== 'All' || yearFilter !== 'All'
                ? 'Try adjusting your search criteria or filters.'
                : 'Get started by creating your first payrun.'}
            </p>
            {!search && statusFilter === 'All' && (
              <button
                type="button"
                onClick={() => navigate('/payroll/payruns/new')}
                className="mt-4 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent/90 rounded-md transition-colors"
              >
                <Plus size={14} />
                Create Payrun
              </button>
            )}
          </div>
        ) : (
          filteredPayruns.map(payrun => (
            <div
              key={payrun.id}
              onClick={() => navigate(`/payroll/payruns/${payrun.id}`)}
              className="group bg-white rounded-lg border border-border p-5 hover:border-accent/50 hover:shadow-sm transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              {/* Left Column: Period & Structure */}
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-semibold text-navy group-hover:text-accent transition-colors">
                    {payrun.periodLabel}
                  </h3>
                  <StatusBadge status={payrun.status} />
                  {payrun.warningCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                      <AlertTriangle size={12} className="text-amber-500" />
                      {payrun.warningCount} {payrun.warningCount === 1 ? 'warning' : 'warnings'}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-mutedText">
                  <span className="font-medium text-slate">{payrun.structureName}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar size={13} className="text-slate" />
                    {payrun.periodStart} to {payrun.periodEnd}
                  </span>
                </div>
              </div>

              {/* Right Column: Meta & Actions */}
              <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-3 md:pt-0 border-border/50">
                <div className="flex items-center gap-2 text-xs font-medium text-slate">
                  <Users size={15} className="text-mutedText" />
                  <span>
                    <strong className="text-navy">{payrun.employeeCount}</strong>{' '}
                    {payrun.employeeCount === 1 ? 'employee' : 'employees'}
                  </span>
                </div>

                <ChevronRight
                  size={18}
                  className="text-slate/60 group-hover:text-accent group-hover:translate-x-0.5 transition-all"
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
