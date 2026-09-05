import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calculator,
  CheckCircle,
  CreditCard,
  Send,
  AlertTriangle,
  Search,
  Printer,
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import type { Payrun, Payslip } from './mockData';
import { formatCurrency } from './mockData';

interface Props {
  payruns: Payrun[];
  payslips: Payslip[];
  onUpdatePayrun: (updatedPayrun: Payrun, updatedPayslips?: Payslip[]) => void;
}

export default function PayrunDetail({ payruns, payslips, onUpdatePayrun }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const payrun = payruns.find(p => p.id === id);
  const payrunPayslips = useMemo(() => payslips.filter(ps => ps.payrunId === id), [payslips, id]);

  const [search, setSearch] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const filteredPayslips = useMemo(() => {
    if (!search) return payrunPayslips;
    const q = search.toLowerCase();
    return payrunPayslips.filter(
      ps =>
        ps.employeeName.toLowerCase().includes(q) ||
        ps.structureName.toLowerCase().includes(q) ||
        ps.status.toLowerCase().includes(q)
    );
  }, [payrunPayslips, search]);

  if (!payrun) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center p-12 bg-surface/30 min-h-screen">
        <h2 className="text-lg font-semibold text-navy">Payrun not found</h2>
        <p className="text-xs text-mutedText mt-1">The requested payrun could not be located.</p>
        <button
          type="button"
          onClick={() => navigate('/payroll/payruns')}
          className="mt-4 px-4 py-2 text-xs font-medium text-white bg-accent rounded-md"
        >
          Back to Payruns
        </button>
      </div>
    );
  }

  // Action handlers
  const handleCompute = () => {
    // Recalculate payslips
    const updatedPayslips = payrunPayslips.map(ps => ({
      ...ps,
      basic: ps.basic || 950000,
      gross: ps.gross || 1399200,
      net: ps.net || 1282700,
    }));
    onUpdatePayrun(payrun, updatedPayslips);
    showToast('Computed payslip lines successfully.');
  };

  const handleValidate = () => {
    const updatedPayrun: Payrun = { ...payrun, status: 'Validated' };
    const updatedPayslips = payrunPayslips.map(ps => ({ ...ps, status: 'Done' as const }));
    onUpdatePayrun(updatedPayrun, updatedPayslips);
    showToast('Payrun validated. Payslips marked as Done.');
  };

  const handleMarkPaid = () => {
    const updatedPayrun: Payrun = { ...payrun, status: 'Paid' };
    const updatedPayslips = payrunPayslips.map(ps => ({ ...ps, status: 'Paid' as const }));
    onUpdatePayrun(updatedPayrun, updatedPayslips);
    showToast('Payrun marked as Paid. Disbursements finalized.');
  };

  const handleSendPayslips = () => {
    showToast(`Payslips dispatched to ${payrunPayslips.length} employees via email.`);
  };

  return (
    <div className="flex flex-col flex-1 bg-surface/30 min-h-screen relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-navy text-white text-xs font-medium px-4 py-3 rounded-lg shadow-lg border border-slate/30 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle size={15} className="text-emerald-400 shrink-0" />
          {toastMessage}
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between px-8 py-4 bg-white border-b border-border gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/payroll/payruns')}
            className="p-2 hover:bg-surface rounded-full text-brandAccent transition-colors group"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-display font-semibold text-navy">
                Payrun / {payrun.periodLabel}
              </h1>
              <StatusBadge status={payrun.status} />
            </div>
            <p className="text-xs text-mutedText mt-0.5">
              {payrun.structureName} • {payrun.periodStart} to {payrun.periodEnd}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {payrun.status === 'Draft' && (
            <>
              <button
                type="button"
                onClick={handleCompute}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-navy bg-surface hover:bg-surface/80 border border-border rounded-md transition-colors"
              >
                <Calculator size={14} className="text-slate" />
                Compute
              </button>
              <button
                type="button"
                onClick={handleValidate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent/90 rounded-md shadow-sm transition-colors"
              >
                <CheckCircle size={14} />
                Validate
              </button>
            </>
          )}

          {payrun.status === 'Validated' && (
            <button
              type="button"
              onClick={handleMarkPaid}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-sm transition-colors"
            >
              <CreditCard size={14} />
              Mark Paid
            </button>
          )}

          {payrun.status === 'Paid' && (
            <button
              type="button"
              onClick={handleSendPayslips}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-navy bg-white hover:bg-surface border border-border rounded-md shadow-sm transition-colors"
            >
              <Send size={14} className="text-accent" />
              Send Payslips
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl w-full mx-auto px-8 py-6 space-y-6">
        {/* Summary Info Card */}
        <div className="bg-white rounded-lg border border-border p-5 shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-xs">
            <div>
              <span className="text-mutedText block font-medium">Period</span>
              <span className="text-sm font-semibold text-navy mt-0.5 block">{payrun.periodLabel}</span>
              <span className="text-[11px] text-slate mt-0.5 block">
                {payrun.periodStart} – {payrun.periodEnd}
              </span>
            </div>

            <div>
              <span className="text-mutedText block font-medium">Salary Structure</span>
              <span className="text-sm font-semibold text-navy mt-0.5 block">{payrun.structureName}</span>
              <span className="text-[11px] text-slate mt-0.5 block">Standard monthly computation</span>
            </div>

            <div>
              <span className="text-mutedText block font-medium">Total Employees</span>
              <span className="text-sm font-semibold text-navy mt-0.5 block">
                {payrunPayslips.length} payslips
              </span>
              <span className="text-[11px] text-slate mt-0.5 block">Included in run</span>
            </div>

            <div>
              <span className="text-mutedText block font-medium">Status & Health</span>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={payrun.status} />
                {payrun.warningCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    <AlertTriangle size={11} className="text-amber-500" />
                    {payrun.warningCount} {payrun.warningCount === 1 ? 'alert' : 'alerts'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Payslips Section */}
        <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-border gap-4">
            <div>
              <h2 className="text-sm font-semibold text-navy uppercase tracking-wider">
                Payslips in this Payrun ({payrunPayslips.length})
              </h2>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
              <input
                type="text"
                placeholder="Search employee payslips..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-surface/60 border border-border rounded-md text-xs text-navy placeholder:text-mutedText focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface/70 border-b border-border text-[11px] font-semibold text-slate uppercase tracking-wider">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4 text-center">Worked</th>
                  <th className="py-3 px-4 text-right">Basic</th>
                  <th className="py-3 px-4 text-right">Gross</th>
                  <th className="py-3 px-4 text-right">Alt (Net)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPayslips.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-mutedText text-xs">
                      No payslips found in this payrun.
                    </td>
                  </tr>
                ) : (
                  filteredPayslips.map(ps => (
                    <tr
                      key={ps.id}
                      onClick={() => navigate(`/payroll/payslips/${ps.id}`)}
                      className="hover:bg-surface/50 cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-4 font-medium text-navy group-hover:text-accent transition-colors">
                        <div>
                          <span>{ps.employeeName}</span>
                          {ps.warnings.length > 0 && (
                            <div className="flex items-center gap-1 text-amber-700 text-[10px] mt-0.5">
                              <AlertTriangle size={11} className="text-amber-500 shrink-0" />
                              <span>{ps.warnings.join(', ')}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate">
                        {ps.workedDays || 22}
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
                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={ps.status} />
                      </td>
                      <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          title="Download/Print Payslip PDF"
                          onClick={() => window.print()}
                          className="p-1.5 hover:bg-surface rounded text-slate hover:text-accent transition-colors inline-flex items-center justify-center"
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
