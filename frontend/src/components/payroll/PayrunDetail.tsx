import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calculator,
  CheckCircle,
  CreditCard,
  AlertTriangle,
  Search,
  Printer,
  Loader2,
  Trash2,
  RefreshCw,
  FileText,
  ShieldAlert,
  ChevronRight,
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import {
  usePayrunQuery,
  useComputePayrunMutation,
  useRecomputePayrunMutation,
  useValidatePayrunMutation,
  useMarkPayrunPaidMutation,
  useDiscardPayrunMutation,
  useAcknowledgeWarningMutation,
} from '../../features/payroll/payroll.queries';
import { downloadPayslipPdf } from '../../features/payroll/payroll.api';
import { formatCurrency } from './PayrunList';
import type { PayrollWarningDto } from '@peoplepay360/shared';

export default function PayrunDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: payrun, isLoading, error } = usePayrunQuery(id || '');

  const [search, setSearch] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeWarning, setActiveWarning] = useState<PayrollWarningDto | null>(null);
  const [ackReason, setAckReason] = useState('');
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Mutations
  const computeMutation = useComputePayrunMutation();
  const recomputeMutation = useRecomputePayrunMutation();
  const validateMutation = useValidatePayrunMutation();
  const markPaidMutation = useMarkPayrunPaidMutation();
  const discardMutation = useDiscardPayrunMutation();
  const acknowledgeMutation = useAcknowledgeWarningMutation();

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const payslips = payrun?.payslips ?? [];

  // Filtered payslips
  const filteredPayslips = useMemo(() => {
    if (!search.trim()) return payslips;
    const q = search.toLowerCase();
    return payslips.filter(
      (ps) =>
        ps.employeeName.toLowerCase().includes(q) ||
        ps.employeeNumber.toLowerCase().includes(q) ||
        (ps.departmentName && ps.departmentName.toLowerCase().includes(q))
    );
  }, [payslips, search]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface/30">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (error || !payrun) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center p-12 bg-surface/30 min-h-screen">
        <h2 className="text-lg font-semibold text-navy">Payrun not found</h2>
        <p className="text-xs text-mutedText mt-1">
          {(error as Error)?.message || 'The requested payrun could not be located.'}
        </p>
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

  // Count open warnings
  const allWarnings: PayrollWarningDto[] = payrun.warnings || [];
  const openWarnings = allWarnings.filter((w) => w.status === 'OPEN');

  // Handlers
  const handleCompute = async () => {
    setActionError(null);
    try {
      await computeMutation.mutateAsync(payrun.id);
      showToast('Computed payslip lines and attendance calculations successfully.');
    } catch (err) {
      setActionError((err as Error).message || 'Failed to compute payrun');
    }
  };

  const handleRecompute = async () => {
    setActionError(null);
    try {
      await recomputeMutation.mutateAsync(payrun.id);
      showToast('Recomputed payrun successfully.');
    } catch (err) {
      setActionError((err as Error).message || 'Failed to recompute payrun');
    }
  };

  const handleValidate = async () => {
    setActionError(null);
    if (openWarnings.length > 0) {
      setActionError(
        `Cannot validate payrun: There are ${openWarnings.length} unacknowledged warning(s). Please review and acknowledge them first.`
      );
      return;
    }
    try {
      await validateMutation.mutateAsync(payrun.id);
      showToast('Payrun validated successfully. Payslips locked as immutable.');
    } catch (err) {
      setActionError((err as Error).message || 'Failed to validate payrun');
    }
  };

  const handleMarkPaid = async () => {
    setActionError(null);
    try {
      await markPaidMutation.mutateAsync(payrun.id);
      showToast('Payrun marked as Paid. Disbursements finalized.');
    } catch (err) {
      setActionError((err as Error).message || 'Failed to mark payrun paid');
    }
  };

  const handleDiscard = async () => {
    setActionError(null);
    try {
      await discardMutation.mutateAsync(payrun.id);
      navigate('/payroll/payruns');
    } catch (err) {
      setActionError((err as Error).message || 'Failed to discard payrun');
    }
  };

  const handleAcknowledgeWarning = async () => {
    if (!activeWarning || !ackReason.trim()) return;
    setActionError(null);
    try {
      await acknowledgeMutation.mutateAsync({
        warningId: activeWarning.id,
        input: { reason: ackReason.trim() },
      });
      setActiveWarning(null);
      setAckReason('');
      showToast('Warning acknowledged successfully.');
    } catch (err) {
      setActionError((err as Error).message || 'Failed to acknowledge warning');
    }
  };

  const handleDownloadPdf = async (e: React.MouseEvent, payslipId: string, empName: string) => {
    e.stopPropagation();
    try {
      await downloadPayslipPdf(payslipId, empName);
    } catch (err) {
      setActionError((err as Error).message || 'Failed to download PDF');
    }
  };

  const isPending =
    computeMutation.isPending ||
    recomputeMutation.isPending ||
    validateMutation.isPending ||
    markPaidMutation.isPending ||
    discardMutation.isPending;

  return (
    <div className="flex flex-col flex-1 bg-surface/30 min-h-screen relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-navy text-white text-xs font-medium px-4 py-3 rounded-lg shadow-lg border border-slate/30 flex items-center gap-2">
          <CheckCircle size={15} className="text-emerald-400 shrink-0" />
          {toastMessage}
        </div>
      )}

      {/* Top Header */}
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
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-display font-semibold text-navy">{payrun.name}</h1>
              <StatusBadge status={payrun.status} />
              <span className="font-mono text-xs text-slate bg-surface px-2 py-0.5 rounded border border-border">
                {payrun.payrunNumber}
              </span>
            </div>
            <p className="text-xs text-mutedText mt-0.5">
              Structure: <span className="font-semibold text-navy">{payrun.salaryStructureName}</span>{' '}
              &bull; Period:{' '}
              <span className="font-mono font-medium text-navy">
                {payrun.periodStart} &rarr; {payrun.periodEnd}
              </span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {payrun.status === 'DRAFT' && (
            <>
              <button
                type="button"
                disabled={isPending}
                onClick={handleCompute}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-accent hover:bg-accent/90 disabled:opacity-50 rounded-md shadow-sm transition-all"
              >
                {computeMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Calculator size={14} />
                )}
                Compute Payrun
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => setShowDiscardConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-md transition-all"
              >
                <Trash2 size={14} />
                Discard
              </button>
            </>
          )}

          {payrun.status === 'COMPUTED' && (
            <>
              <button
                type="button"
                disabled={isPending}
                onClick={handleRecompute}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-navy bg-surface hover:bg-slate/10 border border-border rounded-md transition-all"
              >
                {recomputeMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                Recompute
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleValidate}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md shadow-sm transition-all"
              >
                {validateMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCircle size={14} />
                )}
                Validate & Lock
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => setShowDiscardConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-md transition-all"
              >
                <Trash2 size={14} />
                Discard
              </button>
            </>
          )}

          {payrun.status === 'VALIDATED' && (
            <button
              type="button"
              disabled={isPending}
              onClick={handleMarkPaid}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-md shadow-sm transition-all"
            >
              {markPaidMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CreditCard size={14} />
              )}
              Mark as Paid
            </button>
          )}

          {payrun.status === 'PAID' && (
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-md">
              <CheckCircle size={14} />
              Disbursed & Finalized
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-8 space-y-6 flex-1">
        {actionError && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-3 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Discard confirmation banner */}
        {showDiscardConfirm && (
          <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
              <div>
                <h4 className="text-xs font-semibold text-amber-900">
                  Discard draft payrun {payrun.payrunNumber}?
                </h4>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  This will permanently delete the draft payrun and all associated draft payslips.
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate bg-white border border-border rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={discardMutation.isPending}
                onClick={handleDiscard}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md"
              >
                {discardMutation.isPending ? 'Discarding...' : 'Yes, Discard'}
              </button>
            </div>
          </div>
        )}

        {/* Payrun KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-border shadow-sm">
            <div className="text-xs font-medium text-mutedText uppercase tracking-wider">
              Total Payslips
            </div>
            <div className="text-2xl font-display font-semibold text-navy mt-1">
              {payrun.totalPayslips}
            </div>
            <div className="text-[11px] text-slate mt-1">Active employee contracts</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-border shadow-sm">
            <div className="text-xs font-medium text-mutedText uppercase tracking-wider">
              Total Gross Pay
            </div>
            <div className="text-2xl font-display font-semibold text-navy mt-1 font-mono">
              {formatCurrency(payrun.grossTotal, payrun.currency)}
            </div>
            <div className="text-[11px] text-slate mt-1">Earnings & allowances</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-border shadow-sm">
            <div className="text-xs font-medium text-mutedText uppercase tracking-wider">
              Total Net Disbursement
            </div>
            <div className="text-2xl font-display font-semibold text-emerald-700 mt-1 font-mono">
              {formatCurrency(payrun.netTotal, payrun.currency)}
            </div>
            <div className="text-[11px] text-slate mt-1">After statutory deductions</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-border shadow-sm">
            <div className="text-xs font-medium text-mutedText uppercase tracking-wider">
              Warnings
            </div>
            <div
              className={`text-2xl font-display font-semibold mt-1 ${
                openWarnings.length > 0 ? 'text-amber-600' : 'text-slate'
              }`}
            >
              {allWarnings.length}{' '}
              <span className="text-xs font-normal text-mutedText">
                ({openWarnings.length} open)
              </span>
            </div>
            <div className="text-[11px] text-slate mt-1">
              {openWarnings.length > 0 ? 'Action required prior to validation' : 'All clear'}
            </div>
          </div>
        </div>

        {/* Warnings Section (if any exist) */}
        {allWarnings.length > 0 && (
          <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-navy flex items-center gap-2 mb-3">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              Payroll Warnings & Anomalies ({allWarnings.length})
            </h3>
            <div className="divide-y divide-border border border-border rounded-lg overflow-hidden text-xs">
              {allWarnings.map((w) => (
                <div
                  key={w.id}
                  className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-surface/20"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        {w.type}
                      </span>
                      {w.details?.employeeName && (
                        <span className="font-semibold text-navy">{w.details.employeeName}</span>
                      )}
                      {w.details?.employeeNumber && (
                        <span className="font-mono text-slate text-[11px]">
                          ({w.details.employeeNumber})
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                          w.status === 'OPEN'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {w.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate mt-1">{w.message}</p>
                    {w.acknowledgementReason && (
                      <p className="text-[11px] text-emerald-700 italic mt-0.5">
                        Acknowledged: &ldquo;{w.acknowledgementReason}&rdquo;
                      </p>
                    )}
                  </div>

                  {w.status === 'OPEN' && payrun.status !== 'PAID' && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveWarning(w);
                        setAckReason('');
                      }}
                      className="shrink-0 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10 border border-accent/30 rounded-md transition-colors"
                    >
                      Acknowledge Warning
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payslips Table Card */}
        <div className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
          <div className="p-5 border-b border-border flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-sm font-semibold text-navy flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent" />
              Generated Payslips ({payslips.length})
            </h3>

            <div className="relative max-w-xs w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
              <input
                type="text"
                placeholder="Search employee payslips..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-surface/60 border border-border rounded-md text-xs text-navy placeholder:text-mutedText focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate">
              <thead className="bg-surface/50 border-b border-border uppercase font-medium text-slate">
                <tr>
                  <th className="px-6 py-3.5">Employee</th>
                  <th className="px-6 py-3.5">Department</th>
                  <th className="px-6 py-3.5 font-mono text-right">Basic Wage</th>
                  <th className="px-6 py-3.5 font-mono text-right">Gross Pay</th>
                  <th className="px-6 py-3.5 font-mono text-right">Net Pay</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPayslips.map((ps) => (
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
                    <td className="px-6 py-3.5 text-navy">
                      {ps.departmentName || 'General'}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-right text-navy">
                      {ps.periodStart} &rarr; {ps.periodEnd}
                    </td>
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
      </div>

      {/* Warning Acknowledgement Modal */}
      {activeWarning && (
        <div className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-border shadow-xl max-w-md w-full p-6">
            <h3 className="text-base font-semibold text-navy flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              Acknowledge Payroll Warning
            </h3>
            <p className="text-xs text-slate mt-2">
              <span className="font-semibold text-navy">
                {activeWarning.details?.employeeName || 'Employee'}
              </span>:{' '}
              {activeWarning.message}
            </p>

            <div className="mt-4">
              <label className="block text-xs font-medium text-slate mb-1">
                Reason for Acknowledgement *
              </label>
              <textarea
                value={ackReason}
                onChange={(e) => setAckReason(e.target.value)}
                placeholder="Explain why this payroll anomaly is acceptable for validation..."
                rows={3}
                className="w-full p-2.5 text-xs bg-surface/40 border border-border rounded-lg text-navy focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveWarning(null)}
                className="px-4 py-2 text-xs font-medium text-slate hover:text-navy border border-border rounded-lg bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={ackReason.trim().length < 5 || acknowledgeMutation.isPending}
                onClick={handleAcknowledgeWarning}
                className="px-4 py-2 text-xs font-semibold text-white bg-accent hover:bg-accent/90 disabled:opacity-50 rounded-lg shadow-sm"
              >
                {acknowledgeMutation.isPending ? 'Saving...' : 'Confirm Acknowledgement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
