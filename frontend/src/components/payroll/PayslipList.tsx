import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, AlertTriangle, FileText, Printer, ArrowLeft } from 'lucide-react';
import StatusBadge from './StatusBadge';
import type { Payslip, PayslipStatus } from './mockData';
import { formatCurrency } from './mockData';

interface Props {
  payslips: Payslip[];
}

export default function PayslipList({ payslips }: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<PayslipStatus | 'All'>('All');

  // Collect distinct period labels
  const periods = useMemo(() => {
    const list = Array.from(new Set(payslips.map(p => p.periodLabel)));
    return list;
  }, [payslips]);

  const filteredPayslips = useMemo(() => {
    return payslips.filter(ps => {
      if (periodFilter !== 'All' && ps.periodLabel !== periodFilter) return false;
      if (statusFilter !== 'All' && ps.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          ps.employeeName.toLowerCase().includes(q) ||
          ps.structureName.toLowerCase().includes(q) ||
          ps.periodLabel.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [payslips, search, periodFilter, statusFilter]);

  return (
    <div className="flex flex-col flex-1 bg-surface/30 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between px-8 py-5 bg-white border-b border-border gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/payroll/payruns')}
            className="p-2 hover:bg-surface rounded-full text-brandAccent transition-colors group"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <h1 className="text-2xl font-display font-semibold text-navy">Payslips</h1>
            <p className="text-xs text-mutedText mt-0.5">
              Individual salary calculation slips for all employees across payruns.
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-8 py-4 bg-white/60 border-b border-border flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
            <input
              type="text"
              placeholder="Search by employee name or structure..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-surface/60 border border-border rounded-md text-xs text-navy placeholder:text-mutedText focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-surface p-1 rounded-md border border-border">
            {(['All', 'Draft', 'Done', 'Paid'] as const).map(status => (
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

          {/* Period Filter Dropdown */}
          <select
            value={periodFilter}
            onChange={e => setPeriodFilter(e.target.value)}
            className="px-3 py-1.5 bg-white border border-border rounded-md text-xs font-medium text-navy focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="All">All Periods</option>
            {periods.map(period => (
              <option key={period} value={period}>
                {period}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="px-8 py-6">
        <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface/70 border-b border-border text-[11px] font-semibold text-slate uppercase tracking-wider">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4">Structure</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Warnings</th>
                  <th className="py-3 px-4 text-right">Basic</th>
                  <th className="py-3 px-4 text-right">Gross</th>
                  <th className="py-3 px-4 text-right">Alt (Net)</th>
                  <th className="py-3 px-4 text-center">Print</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPayslips.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-mutedText text-xs">
                      <FileText size={28} className="mx-auto mb-2 text-slate/40" />
                      No payslips found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredPayslips.map(ps => (
                    <tr
                      key={ps.id}
                      onClick={() => navigate(`/payroll/payslips/${ps.id}`)}
                      className="hover:bg-surface/50 cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-4 font-semibold text-navy group-hover:text-accent transition-colors">
                        {ps.employeeName}
                      </td>
                      <td className="py-3 px-4 text-slate">{ps.periodLabel}</td>
                      <td className="py-3 px-4 text-slate">{ps.structureName}</td>
                      <td className="py-3 px-4">
                        <StatusBadge status={ps.status} />
                      </td>
                      <td className="py-3 px-4">
                        {ps.warnings.length > 0 ? (
                          <div className="flex items-center gap-1 text-amber-700 font-medium">
                            <AlertTriangle size={13} className="text-amber-500 shrink-0" />
                            <span>{ps.warnings.join(', ')}</span>
                          </div>
                        ) : (
                          <span className="text-slate/40">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate">
                        {formatCurrency(ps.basic)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate">
                        {formatCurrency(ps.gross)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-navy">
                        {formatCurrency(ps.net)}
                      </td>
                      <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => window.print()}
                          title="Print Payslip"
                          className="p-1 hover:bg-surface rounded text-slate hover:text-navy transition-colors"
                        >
                          <Printer size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
