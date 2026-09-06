import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, AlertTriangle, FileText, Printer, ArrowLeft, Loader2, ChevronRight } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { usePayslipsQuery } from '../../features/payroll/payroll.queries';
import { downloadPayslipPdf } from '../../features/payroll/payroll.api';
import { formatCurrency } from './PayrunList';
import type { PayrollStatus, PayslipListItemDto } from '@peoplepay360/shared';

export default function PayslipList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PayrollStatus | 'ALL'>('ALL');
  const [pdfError, setPdfError] = useState<string | null>(null);

  const { data, isLoading, error } = usePayslipsQuery({
    search: search.trim() || undefined,
    status: statusFilter === 'ALL' ? undefined : statusFilter,
    pageSize: 50,
  });

  const payslips = data?.items ?? [];

  const handleDownloadPdf = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    setPdfError(null);
    try {
      await downloadPayslipPdf(id, name);
    } catch (err) {
      setPdfError((err as Error).message || 'Failed to download payslip PDF');
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-surface/30 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between px-8 py-5 bg-white border-b border-border gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/payroll/payruns')}
            className="p-2 hover:bg-surface rounded-full text-slate hover:text-navy transition-colors"
          >
            <ArrowLeft size={18} />
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
              placeholder="Search by employee name, number, or structure..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-surface/60 border border-border rounded-md text-xs text-navy placeholder:text-mutedText focus:outline-none focus:ring-1 focus:ring-accent"
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

      {/* Main Table */}
      <div className="p-8 flex-1">
        {pdfError && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{pdfError}</span>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center p-16">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="text-sm">{(error as Error).message || 'Failed to load payslips'}</span>
          </div>
        ) : payslips.length === 0 ? (
          <div className="bg-white rounded-xl border border-border p-12 text-center">
            <FileText className="w-12 h-12 text-slate/40 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-navy">No payslips found</h3>
            <p className="text-xs text-mutedText mt-1 max-w-sm mx-auto">
              Generated payslips from computed and validated payruns will be listed here.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate">
                <thead className="bg-surface/50 border-b border-border uppercase font-medium text-slate">
                  <tr>
                    <th className="px-6 py-3.5">Employee</th>
                    <th className="px-6 py-3.5">Period</th>
                    <th className="px-6 py-3.5">Payrun</th>
                    <th className="px-6 py-3.5">Department</th>
                    <th className="px-6 py-3.5 font-mono text-right">Gross Pay</th>
                    <th className="px-6 py-3.5 font-mono text-right">Net Pay</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payslips.map((ps: PayslipListItemDto) => (
                    <tr
                      key={ps.id}
                      onClick={() => navigate(`/payroll/payslips/${ps.id}`)}
                      className="hover:bg-surface/30 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-3.5">
                        <div className="font-semibold text-navy">{ps.employeeName}</div>
                        <div className="font-mono text-slate text-[11px]">
                          {ps.employeeNumber}
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-navy font-mono text-[11px]">
                        {ps.periodStart} &rarr; {ps.periodEnd}
                      </td>
                      <td className="px-6 py-3.5 font-mono text-xs text-navy">{ps.payrunNumber}</td>
                      <td className="px-6 py-3.5 text-slate">{ps.departmentName || '—'}</td>
                      <td className="px-6 py-3.5 font-mono text-right text-navy">
                        {formatCurrency(ps.grossAmount, ps.currency)}
                      </td>
                      <td className="px-6 py-3.5 font-mono text-right font-semibold text-navy">
                        {formatCurrency(ps.netAmount, ps.currency)}
                      </td>
                      <td className="px-6 py-3.5">
                        <StatusBadge status={ps.status} />
                      </td>
                      <td className="px-6 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) =>
                              handleDownloadPdf(e, ps.id, ps.employeeName)
                            }
                            title="Download Payslip PDF"
                            className="p-1.5 text-slate hover:text-navy hover:bg-surface rounded border border-border transition-colors"
                          >
                            <Printer size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/payroll/payslips/${ps.id}`)}
                            className="p-1.5 text-accent hover:text-accent/80 rounded transition-colors"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
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
