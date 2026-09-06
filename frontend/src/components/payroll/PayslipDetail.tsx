import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Printer,
  CreditCard,
  CheckCircle,
  AlertTriangle,
  User,
  Clock,
  Loader2,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import { usePayslipQuery } from '../../features/payroll/payroll.queries';
import { downloadPayslipPdf } from '../../features/payroll/payroll.api';
import { formatCurrency } from './PayrunList';
import type { SalaryRuleCategory } from '@peoplepay360/shared';

const categoryPillStyle: Record<SalaryRuleCategory, string> = {
  BASIC: 'bg-blue-50 text-blue-700 border-blue-200',
  ALLOWANCE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  OVERTIME: 'bg-amber-50 text-amber-800 border-amber-200',
  DEDUCTION: 'bg-rose-50 text-rose-700 border-rose-200',
  CONTRIBUTION: 'bg-teal-50 text-teal-700 border-teal-200',
  GROSS: 'bg-purple-50 text-purple-700 border-purple-200',
  NET: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

export default function PayslipDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: payslip, isLoading, error } = usePayslipQuery(id || '');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDownload = async () => {
    if (!payslip) return;
    setPdfLoading(true);
    setErrorMessage(null);
    try {
      await downloadPayslipPdf(payslip.id, payslip.employeeNameSnapshot || 'payslip');
      showToast('Payslip PDF downloaded successfully.');
    } catch (err) {
      setErrorMessage((err as Error).message || 'Failed to download PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface/30">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (error || !payslip) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center p-12 bg-surface/30 min-h-screen">
        <h2 className="text-lg font-semibold text-navy">Payslip not found</h2>
        <p className="text-xs text-mutedText mt-1">
          {(error as Error)?.message || 'The requested payslip could not be located.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/payroll/payslips')}
          className="mt-4 px-4 py-2 text-xs font-medium text-white bg-accent rounded-md"
        >
          Back to Payslips
        </button>
      </div>
    );
  }

  const lines = payslip.lines ?? [];
  const warnings = payslip.warnings ?? [];

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
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-surface rounded-full text-slate hover:text-navy transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-display font-semibold text-navy">
                Payslip: {payslip.employeeNameSnapshot || 'Employee'}
              </h1>
              <StatusBadge status={payslip.status} />
              <span className="font-mono text-xs text-slate bg-surface px-2 py-0.5 rounded border border-border">
                {payslip.employeeNumberSnapshot}
              </span>
            </div>
            <p className="text-xs text-mutedText mt-0.5">
              Period:{' '}
              <span className="font-mono text-navy font-medium">
                {payslip.periodStart} &rarr; {payslip.periodEnd}
              </span>{' '}
              &bull; Structure:{' '}
              <span className="font-semibold text-navy">{payslip.structureNameSnapshot}</span>
              {payslip.payrunNumber && (
                <>
                  {' '}
                  &bull; Payrun:{' '}
                  <button
                    type="button"
                    onClick={() => navigate(`/payroll/payruns/${payslip.payrunId}`)}
                    className="text-accent hover:underline font-mono"
                  >
                    {payslip.payrunNumber}
                  </button>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pdfLoading}
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-navy bg-white hover:bg-surface border border-border rounded-md shadow-sm transition-all"
          >
            {pdfLoading ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
            Download PDF
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-8 space-y-6 flex-1 max-w-6xl mx-auto w-full">
        {errorMessage && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-3 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Snapshot Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Employee & Bank Info */}
          <div className="bg-white p-5 rounded-xl border border-border shadow-sm space-y-3">
            <h3 className="text-xs font-semibold text-navy uppercase tracking-wider flex items-center gap-2">
              <User size={14} className="text-accent" />
              Employee & Bank Profile
            </h3>
            <div className="space-y-1.5 text-xs text-slate">
              <div className="flex justify-between">
                <span>Position:</span>
                <span className="text-navy font-medium">{payslip.jobPositionSnapshot || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span>Department:</span>
                <span className="text-navy font-medium">
                  {payslip.departmentNameSnapshot || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Contract No:</span>
                <span className="font-mono text-navy">{payslip.contractNumberSnapshot}</span>
              </div>
              <div className="flex justify-between">
                <span>Bank Name:</span>
                <span className="text-navy font-medium">{payslip.bankNameSnapshot || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span>Account Mask:</span>
                <span className="font-mono text-navy">
                  {payslip.bankAccountMaskSnapshot || payslip.bankAccountNameSnapshot || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>IFSC Code:</span>
                <span className="font-mono text-navy">{payslip.bankIfscSnapshot || '—'}</span>
              </div>
            </div>
          </div>

          {/* Attendance & Working Time */}
          <div className="bg-white p-5 rounded-xl border border-border shadow-sm space-y-3">
            <h3 className="text-xs font-semibold text-navy uppercase tracking-wider flex items-center gap-2">
              <Clock size={14} className="text-accent" />
              Attendance & Worked Time
            </h3>
            <div className="space-y-1.5 text-xs text-slate">
              <div className="flex justify-between">
                <span>Working Schedule:</span>
                <span className="text-navy font-medium">
                  {payslip.scheduleNameSnapshot || 'Standard'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Expected Working Days:</span>
                <span className="font-mono text-navy font-medium">
                  {payslip.expectedDays != null ? `${payslip.expectedDays} days` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Attended Days:</span>
                <span className="font-mono text-navy font-medium">
                  {payslip.workedDays != null ? `${payslip.workedDays} days` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Worked Hours:</span>
                <span className="font-mono text-navy font-medium">
                  {payslip.workedMinutes != null
                    ? `${(payslip.workedMinutes / 60).toFixed(1)} hrs`
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Overtime Hours:</span>
                <span className="font-mono text-navy font-medium">
                  {payslip.overtimeMinutes != null
                    ? `${(payslip.overtimeMinutes / 60).toFixed(1)} hrs`
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Totals KPI */}
          <div className="bg-white p-5 rounded-xl border border-border shadow-sm space-y-3 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-semibold text-navy uppercase tracking-wider flex items-center gap-2">
                <CreditCard size={14} className="text-accent" />
                Salary Summary
              </h3>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between text-slate">
                  <span>Base Monthly Wage:</span>
                  <span className="font-mono font-medium text-navy">
                    {formatCurrency(payslip.monthlyWage, payslip.currency)}
                  </span>
                </div>
                <div className="flex justify-between text-slate">
                  <span>Prorated Basic:</span>
                  <span className="font-mono font-medium text-navy">
                    {formatCurrency(payslip.proratedBasic ?? payslip.basicAmount, payslip.currency)}
                  </span>
                </div>
                <div className="flex justify-between text-slate">
                  <span>Gross Earnings:</span>
                  <span className="font-mono font-medium text-navy">
                    {formatCurrency(payslip.grossAmount, payslip.currency)}
                  </span>
                </div>
                <div className="flex justify-between text-rose-600">
                  <span>Total Deductions:</span>
                  <span className="font-mono font-medium">
                    {formatCurrency(payslip.deductionAmount, payslip.currency)}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-between">
              <span className="text-xs font-semibold text-navy">Net Disbursement:</span>
              <span className="text-lg font-mono font-semibold text-emerald-700">
                {formatCurrency(payslip.netAmount, payslip.currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Warnings on Payslip */}
        {warnings.length > 0 && (
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4">
            <h4 className="text-xs font-semibold text-amber-900 flex items-center gap-2 mb-2">
              <ShieldAlert size={15} className="text-amber-700" />
              Warnings Attached to This Payslip ({warnings.length})
            </h4>
            <div className="space-y-1.5 text-xs">
              {warnings.map((w) => (
                <div key={w.id} className="flex items-center justify-between">
                  <span className="text-amber-800">
                    <strong className="font-mono">{w.type}</strong>: {w.message}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      w.status === 'OPEN'
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {w.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Salary Rules Breakdown Table */}
        <div className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-navy flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent" />
              Salary Rule Breakdown ({lines.length} lines)
            </h3>
          </div>

          <table className="w-full text-left text-xs text-slate">
            <thead className="bg-surface/50 border-b border-border uppercase font-medium text-slate">
              <tr>
                <th className="px-6 py-3.5">Code</th>
                <th className="px-6 py-3.5">Salary Rule</th>
                <th className="px-6 py-3.5">Category</th>
                <th className="px-6 py-3.5">Computation Method</th>
                <th className="px-6 py-3.5 font-mono text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate">
                    No salary lines computed yet. Run calculation from the payrun.
                  </td>
                </tr>
              ) : (
                lines.map((line) => (
                  <tr key={line.id} className="hover:bg-surface/30 transition-colors">
                    <td className="px-6 py-3.5 font-mono font-medium text-navy">{line.code}</td>
                    <td className="px-6 py-3.5 font-medium text-navy">{line.name}</td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-semibold ${
                          categoryPillStyle[line.category] ||
                          'bg-surface text-slate border-border'
                        }`}
                      >
                        {line.category}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate font-mono text-[11px]">
                      {line.method}
                    </td>
                    <td
                      className={`px-6 py-3.5 font-mono font-medium text-right ${
                        line.category === 'DEDUCTION'
                          ? 'text-rose-600'
                          : line.category === 'NET'
                          ? 'text-emerald-700 font-semibold'
                          : 'text-navy'
                      }`}
                    >
                      {formatCurrency(line.amount, payslip.currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
