import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Calendar, AlertTriangle, ChevronRight, Users, Loader2 } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { usePayrunsQuery } from '../../features/payroll/payroll.queries';
import type { PayrollStatus, PayrunListItemDto } from '@peoplepay360/shared';

export function formatCurrency(amount: number | string | null | undefined, currency = 'INR'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  if (isNaN(num)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    maximumFractionDigits: 2,
  }).format(num);
}

export default function PayrunList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PayrollStatus | 'ALL'>('ALL');

  const { data, isLoading, error } = usePayrunsQuery({
    search: search.trim() || undefined,
    status: statusFilter === 'ALL' ? undefined : statusFilter,
    pageSize: 50,
  });

  const payruns = data?.items ?? [];

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
              placeholder="Search payruns by name, number, or period..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-surface/60 border border-border rounded-md text-sm text-navy placeholder:text-mutedText focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-surface p-1 rounded-md border border-border">
            {(['ALL', 'DRAFT', 'COMPUTED', 'VALIDATED', 'PAID'] as const).map((status) => (
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
                {status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-8 flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center p-16">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="text-sm">{(error as Error).message || 'Failed to load payruns'}</span>
          </div>
        ) : payruns.length === 0 ? (
          <div className="bg-white rounded-xl border border-border p-12 text-center">
            <Calendar className="w-12 h-12 text-slate/40 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-navy">No payruns found</h3>
            <p className="text-xs text-mutedText mt-1 max-w-sm mx-auto">
              Get started by creating your first payrun to calculate and validate employee payroll.
            </p>
            <button
              type="button"
              onClick={() => navigate('/payroll/payruns/new')}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-accent hover:bg-accent/90 rounded-md shadow-sm transition-all"
            >
              <Plus size={15} />
              Create Payrun
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate">
                <thead className="bg-surface/50 border-b border-border text-xs uppercase font-medium text-slate">
                  <tr>
                    <th className="px-6 py-3.5">Payrun Number</th>
                    <th className="px-6 py-3.5">Period</th>
                    <th className="px-6 py-3.5">Salary Structure</th>
                    <th className="px-6 py-3.5">Employees</th>
                    <th className="px-6 py-3.5">Total Gross</th>
                    <th className="px-6 py-3.5">Total Net</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payruns.map((payrun: PayrunListItemDto) => (
                    <tr
                      key={payrun.id}
                      onClick={() => navigate(`/payroll/payruns/${payrun.id}`)}
                      className="hover:bg-surface/30 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 font-mono font-medium text-navy text-xs">
                        {payrun.payrunNumber}
                      </td>
                      <td className="px-6 py-4 font-medium text-navy">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={14} className="text-slate shrink-0" />
                          <span>
                            {payrun.periodStart} &rarr; {payrun.periodEnd}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate">
                        {payrun.salaryStructureName}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <div className="flex items-center gap-1.5 text-slate">
                          <Users size={14} className="text-slate" />
                          <span>{payrun.totalPayslips}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-navy">
                        {formatCurrency(payrun.grossTotal, payrun.currency)}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs font-semibold text-navy">
                        {formatCurrency(payrun.netTotal, payrun.currency)}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={payrun.status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-accent hover:text-accent/80 p-1 inline-flex items-center justify-center">
                          <ChevronRight size={18} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
