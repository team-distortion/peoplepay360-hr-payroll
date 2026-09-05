import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Search, ArrowRight } from 'lucide-react';
import type { SalaryStructure, Payrun, Payslip, SalaryRule, PayslipLine } from './mockData';
import { MOCK_EMPLOYEES, formatCurrency } from './mockData';

interface Props {
  structures: SalaryStructure[];
  rules: SalaryRule[];
  onCreatePayrun: (payrun: Payrun, payslips: Payslip[]) => void;
}

export default function NewPayrunWizard({ structures, rules, onCreatePayrun }: Props) {
  const navigate = useNavigate();

  // Wizard Step (1 or 2)
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: Configuration
  const [selectedStructureId, setSelectedStructureId] = useState(structures[0]?.id ?? '');
  const [periodLabel, setPeriodLabel] = useState('March 2026');
  const [periodStart, setPeriodStart] = useState('2026-03-01');
  const [periodEnd, setPeriodEnd] = useState('2026-03-31');

  // Step 2: Employee Selection
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>(
    MOCK_EMPLOYEES.map(e => e.id)
  );
  const [employeeSearch, setEmployeeSearch] = useState('');

  const selectedStructure = useMemo(
    () => structures.find(s => s.id === selectedStructureId),
    [structures, selectedStructureId]
  );

  const filteredEmployees = useMemo(() => {
    if (!employeeSearch) return MOCK_EMPLOYEES;
    const q = employeeSearch.toLowerCase();
    return MOCK_EMPLOYEES.filter(
      e => e.name.toLowerCase().includes(q) || e.workingHours.toLowerCase().includes(q)
    );
  }, [employeeSearch]);

  const allSelected = filteredEmployees.length > 0 && filteredEmployees.every(e => selectedEmployeeIds.includes(e.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      // Unselect all currently filtered
      const filteredIds = new Set(filteredEmployees.map(e => e.id));
      setSelectedEmployeeIds(prev => prev.filter(id => !filteredIds.has(id)));
    } else {
      // Select all currently filtered
      const newIds = new Set([...selectedEmployeeIds, ...filteredEmployees.map(e => e.id)]);
      setSelectedEmployeeIds(Array.from(newIds));
    }
  };

  const toggleEmployee = (id: string) => {
    setSelectedEmployeeIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Helper to generate payslips for the selected employees and structure
  const handleFinalize = () => {
    if (!selectedStructure || selectedEmployeeIds.length === 0) return;

    const newPayrunId = `pr-${Date.now()}`;

    // Generate payslip lines based on the structure's rules
    const structureRules = selectedStructure.rules
      .map(sr => rules.find(r => r.id === sr.ruleId))
      .filter(Boolean) as SalaryRule[];

    const generatedPayslips: Payslip[] = selectedEmployeeIds.map((empId, index) => {
      const emp = MOCK_EMPLOYEES.find(e => e.id === empId)!;
      const baseSalary = emp.wage * 100; // Realistic base scale

      const lines: PayslipLine[] = structureRules.map(rule => {
        let amount = 0;
        if (rule.computation === 'Fixed Amount') {
          amount = rule.amount ?? 0;
        } else if (rule.computation === 'Percentage of Wage') {
          amount = ((rule.percentage ?? 0) / 100) * baseSalary;
        } else if (rule.code === 'GROSS') {
          amount = baseSalary * 1.35;
        } else if (rule.code === 'NET' || rule.code === 'ALT') {
          amount = baseSalary * 1.15;
        }

        if (rule.category === 'Deduction') {
          amount = -Math.abs(amount);
        }

        return {
          ruleId: rule.id,
          ruleName: rule.name,
          ruleCode: rule.code,
          category: rule.category,
          amount,
        };
      });

      const basic = baseSalary;
      const gross = Math.round(baseSalary * 1.35);
      const net = Math.round(baseSalary * 1.15);

      // Add a simulated warning for demo realism on some employees
      const warnings: string[] = [];
      if (index === 1) warnings.push('Missing tax exemption form');

      return {
        id: `slip-${Date.now()}-${empId}`,
        payrunId: newPayrunId,
        employeeId: emp.id,
        employeeName: emp.name,
        structureId: selectedStructure.id,
        structureName: selectedStructure.name,
        periodStart,
        periodEnd,
        periodLabel,
        status: 'Draft',
        warnings,
        workedDays: 22,
        lines,
        basic,
        gross,
        net,
      };
    });

    const newPayrun: Payrun = {
      id: newPayrunId,
      periodLabel,
      periodStart,
      periodEnd,
      structureId: selectedStructure.id,
      structureName: selectedStructure.name,
      status: 'Draft',
      employeeCount: selectedEmployeeIds.length,
      warningCount: generatedPayslips.reduce((acc, p) => acc + p.warnings.length, 0),
    };

    onCreatePayrun(newPayrun, generatedPayslips);
    navigate(`/payroll/payruns/${newPayrunId}`);
  };

  return (
    <div className="flex flex-col flex-1 bg-surface/30 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 bg-white border-b border-border">
        <div className="flex items-center gap-4">
          <button
            onClick={() => (step === 2 ? setStep(1) : navigate('/payroll/payruns'))}
            className="p-2 hover:bg-surface rounded-full text-brandAccent transition-colors group"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <h2 className="text-xl font-display font-semibold text-navy">New Payrun</h2>
            <p className="text-xs text-mutedText mt-0.5">
              Step {step} of 2 — {step === 1 ? 'Configure Payrun Parameters' : 'Select Employees'}
            </p>
          </div>
        </div>

        {/* Step Indicators */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              step === 1 ? 'bg-accent text-white' : 'bg-surface text-navy'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
              1
            </span>
            Period & Structure
          </div>
          <span className="text-slate/40">›</span>
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              step === 2 ? 'bg-accent text-white' : 'bg-surface text-slate'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-black/10 flex items-center justify-center text-[10px]">
              2
            </span>
            Employees
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-4xl w-full mx-auto px-8 py-8">
        {step === 1 && (
          <div className="bg-white rounded-lg border border-border p-6 shadow-sm space-y-6">
            <h3 className="text-base font-semibold text-navy">Payrun Configuration</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate mb-1">
                  Salary Structure <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedStructureId}
                  onChange={e => setSelectedStructureId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface/40 border border-border rounded-md text-sm text-navy focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  {structures.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.rules.length} rules, {s.employeeCount} active)
                    </option>
                  ))}
                </select>
                <p className="text-xs text-mutedText mt-1">
                  The salary rules within this structure will be evaluated to generate payslips.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate mb-1">
                  Period Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={periodLabel}
                  onChange={e => setPeriodLabel(e.target.value)}
                  placeholder="e.g. March 2026"
                  className="w-full px-3 py-2 bg-surface/40 border border-border rounded-md text-sm text-navy focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate mb-1">Start Date</label>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={e => setPeriodStart(e.target.value)}
                    className="w-full px-3 py-2 bg-surface/40 border border-border rounded-md text-sm text-navy focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate mb-1">End Date</label>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={e => setPeriodEnd(e.target.value)}
                    className="w-full px-3 py-2 bg-surface/40 border border-border rounded-md text-sm text-navy focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => navigate('/payroll/payruns')}
                className="px-4 py-2 text-xs font-medium text-slate hover:text-navy hover:bg-surface border border-border rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!selectedStructureId || !periodLabel}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-accent hover:bg-accent/90 rounded-md shadow-sm transition-all disabled:opacity-50"
              >
                Continue to Employees
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden space-y-4 p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-navy">Select Employees</h3>
                <p className="text-xs text-mutedText mt-0.5">
                  Choose which employees to include in the {periodLabel} payrun.
                </p>
              </div>

              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={employeeSearch}
                  onChange={e => setEmployeeSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-surface/60 border border-border rounded-md text-xs text-navy placeholder:text-mutedText focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>

            {/* Selection Status Summary */}
            <div className="flex items-center justify-between py-2 px-3 bg-surface/60 rounded-md text-xs text-slate border border-border/70">
              <span className="font-medium">
                <strong className="text-navy">{selectedEmployeeIds.length}</strong> of{' '}
                {MOCK_EMPLOYEES.length} employees selected
              </span>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs font-medium text-accent hover:underline"
              >
                {allSelected ? 'Deselect All' : 'Select All Filtered'}
              </button>
            </div>

            {/* Employees Table */}
            <div className="border border-border rounded-md overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface/70 border-b border-border text-[11px] font-semibold text-slate uppercase tracking-wider">
                    <th className="py-2.5 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        className="rounded border-border text-accent focus:ring-accent"
                      />
                    </th>
                    <th className="py-2.5 px-4">Employee</th>
                    <th className="py-2.5 px-4">Schedule / Hours</th>
                    <th className="py-2.5 px-4">Start Date</th>
                    <th className="py-2.5 px-4 text-right">Standard Wage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {filteredEmployees.map(emp => {
                    const isChecked = selectedEmployeeIds.includes(emp.id);
                    return (
                      <tr
                        key={emp.id}
                        onClick={() => toggleEmployee(emp.id)}
                        className={`cursor-pointer transition-colors ${
                          isChecked ? 'bg-accent/5 hover:bg-accent/10' : 'hover:bg-surface/50'
                        }`}
                      >
                        <td className="py-2.5 px-4" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleEmployee(emp.id)}
                            className="rounded border-border text-accent focus:ring-accent"
                          />
                        </td>
                        <td className="py-2.5 px-4 font-medium text-navy">{emp.name}</td>
                        <td className="py-2.5 px-4 text-slate">{emp.workingHours}</td>
                        <td className="py-2.5 px-4 text-slate">{emp.startDate}</td>
                        <td className="py-2.5 px-4 text-right font-medium text-navy">
                          {formatCurrency(emp.wage)} / mo
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 text-xs font-medium text-slate hover:text-navy hover:bg-surface border border-border rounded-md transition-colors"
              >
                Back to Parameters
              </button>

              <button
                type="button"
                onClick={handleFinalize}
                disabled={selectedEmployeeIds.length === 0}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-accent hover:bg-accent/90 rounded-md shadow-sm transition-all disabled:opacity-50"
              >
                <Check size={14} />
                Generate Payrun ({selectedEmployeeIds.length})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
