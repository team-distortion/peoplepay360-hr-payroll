import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Search,
  ArrowRight,
  Loader2,
  AlertTriangle,
  Users,
  ShieldAlert,
  Calendar,
} from 'lucide-react';
import { useSalaryStructures } from '../../features/salary-config/salary-config.queries';
import {
  useEvaluateEligibilityMutation,
  useCreatePayrunMutation,
} from '../../features/payroll/payroll.queries';
import type {
  EligibleEmployeeDto,
  IneligibleEmployeeDto,
  IneligibilityReason,
} from '@peoplepay360/shared';
import { formatCurrency } from './PayrunList';

const INELIGIBILITY_EXPLANATIONS: Record<IneligibilityReason, string> = {
  EMPLOYEE_INACTIVE: 'Employee record is currently inactive.',
  NO_APPLICABLE_CONTRACT: 'No contract found covering this pay period.',
  MULTIPLE_APPLICABLE_CONTRACTS: 'Multiple active contracts overlap this period (ambiguous).',
  SALARY_STRUCTURE_MISMATCH: 'Contract is assigned to a different salary structure.',
  WORKING_SCHEDULE_MISSING: 'Contract has no working schedule assigned.',
  SALARY_STRUCTURE_INACTIVE: 'Selected salary structure is inactive.',
  SALARY_STRUCTURE_INVALID: 'Salary structure has invalid formula configuration.',
  DUPLICATE_PAYSLIP: 'Employee already has a payslip covering this period.',
};

export default function NewPayrunWizard() {
  const navigate = useNavigate();

  // Wizard Step
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: Configuration
  const { data: structuresData, isLoading: structuresLoading } = useSalaryStructures({
    status: 'ACTIVE',
  });
  const structures = structuresData?.items ?? [];

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();

  const [selectedStructureId, setSelectedStructureId] = useState('');
  const [periodStart, setPeriodStart] = useState(`${year}-${month}-01`);
  const [periodEnd, setPeriodEnd] = useState(`${year}-${month}-${String(lastDay).padStart(2, '0')}`);
  const [payrunName, setPayrunName] = useState('');

  // Set default structure when loaded
  useEffect(() => {
    if (!selectedStructureId && structures.length > 0) {
      setSelectedStructureId(structures[0].id);
    }
  }, [structures, selectedStructureId]);

  // Set default payrun name
  useEffect(() => {
    const selectedStructure = structures.find((s) => s.id === selectedStructureId);
    const structName = selectedStructure ? selectedStructure.name : 'Payrun';
    setPayrunName(`${structName} - ${periodStart} to ${periodEnd}`);
  }, [selectedStructureId, periodStart, periodEnd, structures]);

  // Step 2 State
  const [eligibleEmployees, setEligibleEmployees] = useState<EligibleEmployeeDto[]>([]);
  const [ineligibleEmployees, setIneligibleEmployees] = useState<IneligibleEmployeeDto[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'eligible' | 'ineligible'>('eligible');
  const [apiError, setApiError] = useState<string | null>(null);

  const evaluateMutation = useEvaluateEligibilityMutation();
  const createMutation = useCreatePayrunMutation();

  // Step 1 -> Step 2 evaluation
  const handleContinueToStep2 = async () => {
    if (!selectedStructureId || !periodStart || !periodEnd) return;
    setApiError(null);

    try {
      const evaluation = await evaluateMutation.mutateAsync({
        salaryStructureId: selectedStructureId,
        periodStart,
        periodEnd,
        page: 1,
        pageSize: 500,
      });

      const eligible = evaluation.items.filter((i): i is EligibleEmployeeDto => i.eligible);
      const ineligible = evaluation.items.filter((i): i is IneligibleEmployeeDto => !i.eligible);
      setEligibleEmployees(eligible);
      setIneligibleEmployees(ineligible);
      // Default to selecting all eligible employees
      setSelectedEmployeeIds(eligible.map((e) => e.employeeId));
      setStep(2);
    } catch (err) {
      setApiError((err as Error).message || 'Failed to evaluate employee eligibility');
    }
  };

  // Filtered employees for Step 2
  const filteredEligible = useMemo(() => {
    if (!employeeSearch.trim()) return eligibleEmployees;
    const q = employeeSearch.toLowerCase();
    return eligibleEmployees.filter(
      (e) =>
        e.employeeName.toLowerCase().includes(q) ||
        e.employeeNumber.toLowerCase().includes(q) ||
        (e.departmentName && e.departmentName.toLowerCase().includes(q))
    );
  }, [eligibleEmployees, employeeSearch]);

  const filteredIneligible = useMemo(() => {
    if (!employeeSearch.trim()) return ineligibleEmployees;
    const q = employeeSearch.toLowerCase();
    return ineligibleEmployees.filter(
      (e) =>
        e.employeeName.toLowerCase().includes(q) ||
        e.employeeNumber.toLowerCase().includes(q) ||
        (e.departmentName && e.departmentName.toLowerCase().includes(q))
    );
  }, [ineligibleEmployees, employeeSearch]);

  const allEligibleSelected =
    filteredEligible.length > 0 &&
    filteredEligible.every((e) => selectedEmployeeIds.includes(e.employeeId));

  const toggleSelectAllEligible = () => {
    if (allEligibleSelected) {
      const filteredIds = new Set(filteredEligible.map((e) => e.employeeId));
      setSelectedEmployeeIds((prev) => prev.filter((id) => !filteredIds.has(id)));
    } else {
      const newIds = new Set([
        ...selectedEmployeeIds,
        ...filteredEligible.map((e) => e.employeeId),
      ]);
      setSelectedEmployeeIds(Array.from(newIds));
    }
  };

  const toggleEmployee = (id: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Finalize Creation
  const handleCreatePayrun = async () => {
    if (!selectedStructureId || selectedEmployeeIds.length === 0) return;
    setApiError(null);

    try {
      const res = await createMutation.mutateAsync({
        salaryStructureId: selectedStructureId,
        periodStart,
        periodEnd,
        employeeIds: selectedEmployeeIds,
      });

      navigate(`/payroll/payruns/${res.id}`);
    } catch (err) {
      setApiError((err as Error).message || 'Failed to create payrun');
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-surface/30 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 bg-white border-b border-border">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => (step === 2 ? setStep(1) : navigate('/payroll/payruns'))}
            className="p-2 hover:bg-surface rounded-full text-slate hover:text-navy transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-display font-semibold text-navy">New Payrun Wizard</h1>
            <p className="text-xs text-mutedText">
              {step === 1
                ? 'Step 1: Define structure and pay period'
                : 'Step 2: Review eligible candidates and confirm batch creation'}
            </p>
          </div>
        </div>

        {/* Progress indicators */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${
              step === 1 ? 'bg-accent text-white' : 'bg-emerald-600 text-white'
            }`}
          >
            {step === 2 ? <Check size={14} /> : '1'}
          </div>
          <div className={`w-8 h-0.5 ${step === 2 ? 'bg-emerald-600' : 'bg-border'}`} />
          <div
            className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${
              step === 2 ? 'bg-accent text-white' : 'bg-surface text-slate border border-border'
            }`}
          >
            2
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="p-8 max-w-5xl mx-auto w-full flex-1">
        {apiError && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-3 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{apiError}</span>
          </div>
        )}

        {step === 1 ? (
          /* STEP 1: PARAMETERS */
          <div className="bg-white rounded-xl border border-border p-8 shadow-sm">
            <h2 className="text-base font-semibold text-navy mb-6 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-accent" />
              Payrun Period & Salary Structure
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-medium text-slate uppercase tracking-wider mb-2">
                  Salary Structure *
                </label>
                {structuresLoading ? (
                  <div className="flex items-center gap-2 text-xs text-slate py-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading active structures...
                  </div>
                ) : structures.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                    No active salary structures found. Please create and activate a salary structure
                    before starting a payrun.
                  </div>
                ) : (
                  <select
                    value={selectedStructureId}
                    onChange={(e) => setSelectedStructureId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface/40 border border-border rounded-lg text-sm text-navy focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                  >
                    {structures.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-medium text-slate uppercase tracking-wider mb-2">
                    Period Start *
                  </label>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface/40 border border-border rounded-lg text-sm text-navy focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate uppercase tracking-wider mb-2">
                    Period End *
                  </label>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface/40 border border-border rounded-lg text-sm text-navy focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate uppercase tracking-wider mb-2">
                  Payrun Name (Optional)
                </label>
                <input
                  type="text"
                  value={payrunName}
                  onChange={(e) => setPayrunName(e.target.value)}
                  placeholder="e.g. Regular Staff - March 2026"
                  className="w-full px-3.5 py-2.5 bg-surface/40 border border-border rounded-lg text-sm text-navy focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                />
              </div>

              <div className="pt-6 border-t border-border flex justify-end">
                <button
                  type="button"
                  disabled={
                    !selectedStructureId ||
                    !periodStart ||
                    !periodEnd ||
                    evaluateMutation.isPending
                  }
                  onClick={handleContinueToStep2}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-accent hover:bg-accent/90 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
                >
                  {evaluateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Evaluating Candidates...
                    </>
                  ) : (
                    <>
                      Continue to Employee Selection
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* STEP 2: CANDIDATE SELECTION & INELIGIBILITY REVIEW */
          <div className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
            {/* Step 2 summary bar */}
            <div className="p-6 bg-surface/40 border-b border-border flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-navy">{payrunName}</h2>
                <p className="text-xs text-mutedText mt-0.5">
                  Period: <span className="font-mono text-navy">{periodStart}</span> &rarr;{' '}
                  <span className="font-mono text-navy">{periodEnd}</span>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex bg-white rounded-lg p-1 border border-border">
                  <button
                    type="button"
                    onClick={() => setActiveTab('eligible')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2 ${
                      activeTab === 'eligible'
                        ? 'bg-accent text-white shadow-sm'
                        : 'text-slate hover:text-navy'
                    }`}
                  >
                    <Users size={14} />
                    Eligible ({eligibleEmployees.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('ineligible')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2 ${
                      activeTab === 'ineligible'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-slate hover:text-navy'
                    }`}
                  >
                    <ShieldAlert size={14} />
                    Ineligible ({ineligibleEmployees.length})
                  </button>
                </div>
              </div>
            </div>

            {/* Filter search */}
            <div className="p-4 border-b border-border bg-white flex items-center justify-between gap-4">
              <div className="relative max-w-sm w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
                <input
                  type="text"
                  placeholder="Search candidates by name, ID, department..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-surface/60 border border-border rounded-md text-xs text-navy placeholder:text-mutedText focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              {activeTab === 'eligible' && (
                <div className="text-xs text-slate">
                  <span className="font-semibold text-navy">{selectedEmployeeIds.length}</span> of{' '}
                  {eligibleEmployees.length} selected
                </div>
              )}
            </div>

            {/* Candidate Tables */}
            <div className="max-h-[420px] overflow-y-auto">
              {activeTab === 'eligible' ? (
                eligibleEmployees.length === 0 ? (
                  <div className="p-12 text-center text-slate text-xs">
                    No eligible employees found for this structure and period.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs text-slate">
                    <thead className="bg-surface/50 border-b border-border uppercase font-medium text-slate sticky top-0">
                      <tr>
                        <th className="px-6 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={allEligibleSelected}
                            onChange={toggleSelectAllEligible}
                            className="rounded border-border text-accent focus:ring-accent"
                          />
                        </th>
                        <th className="px-6 py-3">Employee</th>
                        <th className="px-6 py-3">Department & Position</th>
                        <th className="px-6 py-3">Contract</th>
                        <th className="px-6 py-3 text-right">Monthly Wage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredEligible.map((emp) => {
                        const isChecked = selectedEmployeeIds.includes(emp.employeeId);
                        return (
                          <tr
                            key={emp.employeeId}
                            onClick={() => toggleEmployee(emp.employeeId)}
                            className={`hover:bg-surface/30 cursor-pointer transition-colors ${
                              isChecked ? 'bg-blue-50/20' : ''
                            }`}
                          >
                            <td className="px-6 py-3.5" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleEmployee(emp.employeeId)}
                                className="rounded border-border text-accent focus:ring-accent"
                              />
                            </td>
                            <td className="px-6 py-3.5">
                              <div className="font-semibold text-navy">{emp.employeeName}</div>
                              <div className="font-mono text-slate text-[11px]">
                                {emp.employeeNumber}
                              </div>
                            </td>
                            <td className="px-6 py-3.5">
                              <div className="text-navy">{emp.departmentName || '—'}</div>
                              <div className="text-slate text-[11px]">{emp.employeeType}</div>
                            </td>
                            <td className="px-6 py-3.5">
                              <div className="font-mono text-xs text-navy">
                                {emp.contractNumber}
                              </div>
                              <div className="text-slate text-[11px]">
                                {emp.effectiveScheduleName || 'Standard'}
                              </div>
                            </td>
                            <td className="px-6 py-3.5 text-right font-mono font-medium text-navy">
                              {formatCurrency(emp.monthlyWage)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
              ) : (
                /* INELIGIBLE TABLE */
                ineligibleEmployees.length === 0 ? (
                  <div className="p-12 text-center text-slate text-xs">
                    All employees are eligible. No exclusions detected!
                  </div>
                ) : (
                  <table className="w-full text-left text-xs text-slate">
                    <thead className="bg-surface/50 border-b border-border uppercase font-medium text-slate sticky top-0">
                      <tr>
                        <th className="px-6 py-3">Employee</th>
                        <th className="px-6 py-3">Department</th>
                        <th className="px-6 py-3">Reason Code</th>
                        <th className="px-6 py-3">Explanation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredIneligible.map((inelig) => (
                        <tr key={inelig.employeeId} className="bg-rose-50/10">
                          <td className="px-6 py-3.5">
                            <div className="font-semibold text-navy">{inelig.employeeName}</div>
                            <div className="font-mono text-slate text-[11px]">
                              {inelig.employeeNumber}
                            </div>
                          </td>
                          <td className="px-6 py-3.5 text-navy">
                            {inelig.departmentName || '—'}
                          </td>
                          <td className="px-6 py-3.5">
                            <div className="flex flex-wrap gap-1">
                              {inelig.ineligibilityReasons.map((reason) => (
                                <span
                                  key={reason}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-rose-100 text-rose-800 border border-rose-200"
                                >
                                  {reason}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-3.5 text-xs text-rose-700">
                            {inelig.ineligibilityReasons
                              .map((r) => INELIGIBILITY_EXPLANATIONS[r] || r)
                              .join('; ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </div>

            {/* Footer actions */}
            <div className="p-6 bg-surface/20 border-t border-border flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 text-xs font-semibold text-slate hover:text-navy border border-border rounded-lg bg-white shadow-sm transition-all"
              >
                Back to Parameters
              </button>

              <button
                type="button"
                disabled={selectedEmployeeIds.length === 0 || createMutation.isPending}
                onClick={handleCreatePayrun}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-accent hover:bg-accent/90 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating Payrun...
                  </>
                ) : (
                  <>
                    Generate Payrun ({selectedEmployeeIds.length} Employees)
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
