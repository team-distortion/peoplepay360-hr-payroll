import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Printer,
  Calculator,
  CreditCard,
  CheckCircle,
  AlertTriangle,
  Building,
  User,
  Calendar,
  Clock,
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import type { Payslip, RuleCategory } from './mockData';
import { formatCurrency } from './mockData';

interface Props {
  payslips: Payslip[];
  onUpdatePayslip: (updated: Payslip) => void;
}

const categoryPillStyle: Record<RuleCategory, string> = {
  Basic: 'bg-blue-50 text-blue-700 border-blue-200',
  Allowance: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Deduction: 'bg-rose-50 text-rose-700 border-rose-200',
  Gross: 'bg-purple-50 text-purple-700 border-purple-200',
  Net: 'bg-amber-50 text-amber-800 border-amber-200',
};

export default function PayslipDetail({ payslips, onUpdatePayslip }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const payslip = payslips.find(p => p.id === id);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  if (!payslip) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center p-12 bg-surface/30 min-h-screen">
        <h2 className="text-lg font-semibold text-navy">Payslip not found</h2>
        <p className="text-xs text-mutedText mt-1">The requested payslip could not be located.</p>
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

  const handleCompute = () => {
    // Recompute values
    const updated: Payslip = {
      ...payslip,
      status: 'Done',
    };
    onUpdatePayslip(updated);
    showToast('Payslip recomputed successfully.');
  };

  const handleMarkPaid = () => {
    const updated: Payslip = {
      ...payslip,
      status: 'Paid',
    };
    onUpdatePayslip(updated);
    showToast('Payslip marked as Paid.');
  };

  return (
    <div className="flex flex-col flex-1 bg-surface/30 min-h-screen relative print:bg-white print:p-0">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-navy text-white text-xs font-medium px-4 py-3 rounded-lg shadow-lg border border-slate/30 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 print:hidden">
          <CheckCircle size={15} className="text-emerald-400 shrink-0" />
          {toastMessage}
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between px-8 py-4 bg-white border-b border-border gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-surface rounded-full text-brandAccent transition-colors group"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-display font-semibold text-navy">
                Payslip / {payslip.employeeName}
              </h1>
              <StatusBadge status={payslip.status} />
            </div>
            <p className="text-xs text-mutedText mt-0.5">
              Period: {payslip.periodLabel} ({payslip.periodStart} - {payslip.periodEnd})
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {payslip.status === 'Draft' && (
            <button
              type="button"
              onClick={handleCompute}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-navy bg-surface hover:bg-surface/80 border border-border rounded-md transition-colors"
            >
              <Calculator size={14} className="text-slate" />
              Compute
            </button>
          )}

          {payslip.status !== 'Paid' && (
            <button
              type="button"
              onClick={handleMarkPaid}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-sm transition-colors"
            >
              <CreditCard size={14} />
              Mark Paid
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate hover:text-navy hover:bg-surface border border-border rounded-md transition-colors"
          >
            <Printer size={14} />
            Print Payslip
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-4xl w-full mx-auto px-8 py-8 space-y-6 print:max-w-none print:px-0 print:py-0">
        {/* Warning banner if any */}
        {payslip.warnings.length > 0 && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3 print:hidden">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-amber-900">Attention Required</h4>
              <p className="text-xs text-amber-800 mt-0.5">
                {payslip.warnings.join(' • ')}
              </p>
            </div>
          </div>
        )}

        {/* Payslip Voucher Card */}
        <div className="bg-white rounded-lg border border-border shadow-sm p-8 print:border-none print:shadow-none print:p-4">
          {/* Organization Header for print/formal display */}
          <div className="border-b border-border pb-6 mb-6 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Building className="text-accent" size={24} />
                <span className="text-lg font-bold text-navy tracking-tight">PeoplePay 360</span>
              </div>
              <p className="text-xs text-mutedText mt-1">100 Enterprise Way, Suite 400 • San Francisco, CA</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-navy uppercase tracking-wider block">
                Official Pay Statement
              </span>
              <span className="text-sm font-bold text-accent mt-0.5 block">{payslip.periodLabel}</span>
              <span className="text-[11px] text-slate block">{payslip.id}</span>
            </div>
          </div>

          {/* Employee & Pay Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-border text-xs">
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <User size={15} className="text-slate shrink-0 mt-0.5" />
                <div>
                  <span className="text-mutedText block text-[11px]">Employee Name</span>
                  <span className="font-semibold text-navy text-sm">{payslip.employeeName}</span>
                  <span className="text-[11px] text-slate block mt-0.5">ID: {payslip.employeeId}</span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Calendar size={15} className="text-slate shrink-0 mt-0.5" />
                <div>
                  <span className="text-mutedText block text-[11px]">Pay Period</span>
                  <span className="font-medium text-navy">
                    {payslip.periodStart} to {payslip.periodEnd}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3 sm:border-l sm:border-border sm:pl-6">
              <div>
                <span className="text-mutedText block text-[11px]">Salary Structure</span>
                <span className="font-semibold text-navy">{payslip.structureName}</span>
              </div>

              <div className="flex items-center gap-6">
                <div>
                  <span className="text-mutedText block text-[11px]">Worked Days</span>
                  <span className="font-semibold text-navy flex items-center gap-1 mt-0.5">
                    <Clock size={13} className="text-slate" />
                    {payslip.workedDays} Days
                  </span>
                </div>
                <div>
                  <span className="text-mutedText block text-[11px]">Payment Status</span>
                  <div className="mt-1">
                    <StatusBadge status={payslip.status} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Salary Computation Breakdown */}
          <div className="mt-6">
            <h3 className="text-xs font-semibold text-navy uppercase tracking-wider mb-3">
              Salary Computation
            </h3>

            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-surface/70 border-b border-border text-[11px] font-semibold text-slate uppercase tracking-wider">
                    <th className="py-2.5 px-4">Rule Name</th>
                    <th className="py-2.5 px-4">Code</th>
                    <th className="py-2.5 px-4">Category</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payslip.lines.map((line, idx) => {
                    const isDeduction = line.category === 'Deduction';
                    return (
                      <tr
                        key={idx}
                        className={
                          line.category === 'Net'
                            ? 'bg-amber-50/40 font-bold'
                            : line.category === 'Gross'
                            ? 'bg-surface/40 font-semibold'
                            : 'hover:bg-surface/30'
                        }
                      >
                        <td className="py-2.5 px-4 font-medium text-navy">{line.ruleName}</td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate">{line.ruleCode}</td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              categoryPillStyle[line.category] || 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {line.category}
                          </span>
                        </td>
                        <td
                          className={`py-2.5 px-4 text-right font-mono font-medium ${
                            isDeduction ? 'text-rose-600' : 'text-navy'
                          }`}
                        >
                          {isDeduction
                            ? `- ${formatCurrency(Math.abs(line.amount))}`
                            : formatCurrency(line.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Net Salary Summary Callout */}
          <div className="mt-6 p-4 bg-surface rounded-lg border border-border/80 flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-slate uppercase tracking-wider block">
                Net Disbursable Salary
              </span>
              <span className="text-[11px] text-mutedText">Transferred via Direct Deposit to employee account</span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold font-mono text-accent">
                {formatCurrency(payslip.net)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
