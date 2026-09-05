import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { useAuth } from '../context/AuthContext';
import {
  useContract,
  useCreateContract,
  useUpdateContract,
  useSalaryStructuresSelector,
} from '../features/contracts/contracts.queries';
import { useEmployees } from '../features/employees/employees.queries';
import { useDepartments } from '../features/departments/departments.queries';
import { useSchedules } from '../features/schedules/schedules.queries';
import type { ContractInput } from '@peoplepay360/shared';
import { MONTHLY_WAGE_REGEX } from '@peoplepay360/shared';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Clock,
  FileText,
} from 'lucide-react';

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isNew = location.pathname === '/contracts/new' || !id || id === 'new';

  const canEdit =
    user?.role === 'ADMIN' ||
    user?.role === 'HR_MANAGER' ||
    user?.role === 'HR_PAYROLL_USER' ||
    user?.role === 'HR_PAYROLL_MANAGER';

  const {
    data: contract,
    isLoading: isContractLoading,
    isError: isContractError,
    error: contractFetchError,
  } = useContract(isNew ? undefined : id);

  // Selector data
  const { data: employeesData } = useEmployees({ pageSize: 100 });
  const { data: departments = [] } = useDepartments();
  const { data: schedulesData } = useSchedules({ pageSize: 100 });
  const { data: structures = [] } = useSalaryStructuresSelector();

  const employees = employeesData?.items || [];
  const schedules = schedulesData?.items || [];

  const [isEditMode, setIsEditMode] = useState<boolean>(isNew);
  const [serverError, setServerError] = useState<string | null>(null);
  const [periodError, setPeriodError] = useState<string | null>(null);

  // Tracks if user manually edited department/job/schedule after selecting employee
  const [userTouchedDept, setUserTouchedDept] = useState(false);
  const [userTouchedJob, setUserTouchedJob] = useState(false);
  const [userTouchedSchedule, setUserTouchedSchedule] = useState(false);

  const [formData, setFormData] = useState<ContractInput>({
    employeeId: '',
    departmentId: '',
    workingScheduleId: null,
    salaryStructureId: '',
    jobPosition: '',
    startDate: '',
    endDate: null,
    monthlyWage: '',
    notes: null,
  });

  // Populate form when contract data arrives (detail mode)
  useEffect(() => {
    if (contract && !isNew) {
      setFormData({
        employeeId: contract.employee.id,
        departmentId: contract.department.id,
        workingScheduleId: contract.workingSchedule?.id || null,
        salaryStructureId: contract.salaryStructure.id,
        jobPosition: contract.jobPosition,
        startDate: contract.startDate,
        endDate: contract.endDate,
        monthlyWage: contract.monthlyWage,
        notes: contract.notes,
      });
    }
  }, [contract, isNew]);

  // When Employee is selected in create mode, default suggestions without overwriting user changes
  const handleEmployeeChange = (newEmployeeId: string) => {
    const selectedEmp = employees.find((e) => e.id === newEmployeeId);
    setFormData((prev) => ({
      ...prev,
      employeeId: newEmployeeId,
      departmentId:
        !userTouchedDept && selectedEmp?.department
          ? selectedEmp.department.id
          : prev.departmentId,
      jobPosition:
        !userTouchedJob && selectedEmp?.jobPosition
          ? selectedEmp.jobPosition
          : prev.jobPosition,
      workingScheduleId:
        !userTouchedSchedule && selectedEmp?.workingSchedule
          ? selectedEmp.workingSchedule.id
          : prev.workingScheduleId,
    }));
    setServerError(null);
    setPeriodError(null);
  };

  const createMutation = useCreateContract();
  const updateMutation = useUpdateContract();

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleDiscard = () => {
    if (isNew) {
      navigate('/contracts');
    } else if (contract) {
      setFormData({
        employeeId: contract.employee.id,
        departmentId: contract.department.id,
        workingScheduleId: contract.workingSchedule?.id || null,
        salaryStructureId: contract.salaryStructure.id,
        jobPosition: contract.jobPosition,
        startDate: contract.startDate,
        endDate: contract.endDate,
        monthlyWage: contract.monthlyWage,
        notes: contract.notes,
      });
      setIsEditMode(false);
      setServerError(null);
      setPeriodError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setPeriodError(null);

    // Front-end sanity checks
    if (!formData.employeeId) {
      setServerError('Please select an employee');
      return;
    }
    if (!formData.departmentId) {
      setServerError('Please select a department');
      return;
    }
    if (!formData.salaryStructureId) {
      setServerError('Please select a salary structure');
      return;
    }
    if (!formData.jobPosition.trim()) {
      setServerError('Job position is required');
      return;
    }
    if (!formData.startDate) {
      setServerError('Start date is required');
      return;
    }
    if (formData.endDate && formData.endDate < formData.startDate) {
      setPeriodError('End date cannot be earlier than start date');
      return;
    }
    if (!formData.monthlyWage || !MONTHLY_WAGE_REGEX.test(formData.monthlyWage)) {
      setServerError('Monthly wage must be a non-negative decimal string (e.g. 75000 or 75000.00)');
      return;
    }

    try {
      if (isNew) {
        const created = await createMutation.mutateAsync(formData);
        navigate(`/contracts/${created.id}`);
      } else if (id) {
        await updateMutation.mutateAsync({ id, input: formData });
        setIsEditMode(false);
      }
    } catch (err: any) {
      if (err.code === 'CONTRACT_PERIOD_OVERLAP') {
        const conflictMsg =
          err.details?.fields?.period ||
          err.message ||
          'The contract period overlaps with an existing contract for this employee.';
        setPeriodError(conflictMsg);
      } else if (err.code === 'INVALID_CONTRACT_PERIOD') {
        setPeriodError(err.message || 'Invalid contract period');
      } else {
        setServerError(err.message || 'Failed to save contract');
      }
    }
  };

  if (!isNew && isContractLoading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
          <span className="text-sm font-medium text-slate">Loading contract details...</span>
        </div>
      </AppLayout>
    );
  }

  if (!isNew && (isContractError || (!contract && !isContractLoading))) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto my-20 p-8 bg-white border border-border rounded-xl text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-navy mb-2">Contract Not Found</h2>
          <p className="text-sm text-slate mb-6">
            {contractFetchError instanceof Error
              ? contractFetchError.message
              : 'The requested contract does not exist or you do not have permission to view it.'}
          </p>
          <button
            onClick={() => navigate('/contracts')}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            Return to Contracts
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 bg-surface/30">
        {/* Sticky Header */}
        <div className="px-8 py-5 border-b border-border bg-white sticky top-0 z-20 flex flex-col gap-3 shadow-xs">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-slate mb-1">
                <Link to="/contracts" className="hover:text-navy transition-colors flex items-center gap-1">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Contracts</span>
                </Link>
                <span>/</span>
                <span className="font-semibold text-navy">
                  {isNew ? 'New Contract' : contract?.contractNumber}
                </span>
              </div>
              <p className="text-xs text-mutedText">
                {isNew ? 'Create a new employee employment contract' : 'Form view and terms of employment contract'}
              </p>
            </div>

            {/* Status Pill on Detail */}
            {!isNew && contract && (
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                    contract.status === 'RUNNING'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {contract.status === 'RUNNING' ? 'Running' : 'Expired'}
                </span>
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              {canEdit && (
                <>
                  {!isEditMode ? (
                    <button
                      type="button"
                      onClick={() => setIsEditMode(true)}
                      className="px-4 py-1.5 bg-accent text-white rounded-md text-xs font-semibold hover:bg-accent/90 shadow-sm transition-all"
                    >
                      EDIT
                    </button>
                  ) : (
                    <>
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="px-4 py-1.5 bg-accent text-white rounded-md text-xs font-semibold hover:bg-accent/90 shadow-sm transition-all disabled:opacity-50 inline-flex items-center gap-1.5"
                      >
                        {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>SAVE</span>
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={handleDiscard}
                        className="px-4 py-1.5 bg-white border border-border text-slate rounded-md text-xs font-semibold hover:bg-surface transition-all"
                      >
                        DISCARD
                      </button>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Schedule Source Indicator (Detail view) */}
            {!isNew && contract && (
              <div className="text-xs text-slate flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate" />
                <span>Effective Schedule Source:</span>
                <span className="font-semibold text-navy">
                  {contract.effectiveScheduleSource === 'CONTRACT'
                    ? 'Contract Override'
                    : contract.effectiveScheduleSource === 'EMPLOYEE'
                    ? 'Employee Default'
                    : 'Missing Schedule'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Form Container */}
        <div className="p-8 max-w-5xl">
          {/* General Server Error Banner */}
          {serverError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm animate-in fade-in">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Main Card */}
          <div className="bg-white rounded-xl border border-border shadow-xs p-8 flex flex-col gap-8">
            {/* Two Column Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
              {/* LEFT COLUMN */}
              <div className="flex flex-col gap-6">
                {/* Contract Number (Read-only) */}
                <div>
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">
                    Contract Number
                  </label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={isNew ? 'Generated automatically upon save' : contract?.contractNumber || ''}
                    className="w-full px-3 py-2 bg-surface/50 border border-border rounded-lg text-sm text-slate font-mono cursor-not-allowed"
                  />
                  <p className="text-[11px] text-mutedText mt-1">
                    Immutable server-generated contract reference
                  </p>
                </div>

                {/* Employee Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">
                    Employee <span className="text-red-500">*</span>
                  </label>
                  {isEditMode && isNew ? (
                    <select
                      value={formData.employeeId}
                      onChange={(e) => handleEmployeeChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm text-navy focus:outline-none focus:ring-1 focus:ring-accent"
                      required
                    >
                      <option value="">Select an employee...</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.fullName} ({emp.employeeNumber})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 bg-surface/30 border border-border rounded-lg text-sm">
                      <div className="font-semibold text-navy">{contract?.employee.fullName}</div>
                      <div className="text-xs text-mutedText mt-0.5 font-mono">
                        {contract?.employee.employeeNumber}
                      </div>
                    </div>
                  )}
                </div>

                {/* Start Date & End Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">
                      Start Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      disabled={!isEditMode}
                      value={formData.startDate}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, startDate: e.target.value }));
                        setPeriodError(null);
                      }}
                      className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm text-navy disabled:bg-surface/50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-accent font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">
                      End Date <span className="text-mutedText font-normal">(Optional)</span>
                    </label>
                    <input
                      type="date"
                      disabled={!isEditMode}
                      value={formData.endDate || ''}
                      onChange={(e) => {
                        setFormData((prev) => ({
                          ...prev,
                          endDate: e.target.value || null,
                        }));
                        setPeriodError(null);
                      }}
                      placeholder="Open-ended"
                      className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm text-navy disabled:bg-surface/50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-accent font-mono"
                    />
                  </div>
                </div>

                {/* Overlap Error Alert beside dates */}
                {periodError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-red-700 text-xs animate-in fade-in">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-semibold block">Date Overlap Conflict</span>
                      <span>{periodError}</span>
                    </div>
                  </div>
                )}

                {/* Monthly Wage */}
                <div>
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">
                    Monthly Wage (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    disabled={!isEditMode}
                    value={formData.monthlyWage}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, monthlyWage: e.target.value }));
                      setServerError(null);
                    }}
                    placeholder="e.g. 85000.00"
                    className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm text-navy font-mono disabled:bg-surface/50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-accent"
                    required
                  />
                  <p className="text-[11px] text-mutedText mt-1">
                    Canonical non-negative decimal string (up to 16 digits, 2 decimal places)
                  </p>
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="flex flex-col gap-6">
                {/* Department */}
                <div>
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">
                    Department <span className="text-red-500">*</span>
                  </label>
                  {isEditMode ? (
                    <select
                      value={formData.departmentId}
                      onChange={(e) => {
                        setUserTouchedDept(true);
                        setFormData((prev) => ({ ...prev, departmentId: e.target.value }));
                      }}
                      className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm text-navy focus:outline-none focus:ring-1 focus:ring-accent"
                      required
                    >
                      <option value="">Select department...</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 bg-surface/30 border border-border rounded-lg text-sm text-navy">
                      {contract?.department.name}
                    </div>
                  )}
                  <p className="text-[11px] text-mutedText mt-1">
                    Period-specific department recorded on this contract
                  </p>
                </div>

                {/* Job Position */}
                <div>
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">
                    Job Position <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    disabled={!isEditMode}
                    value={formData.jobPosition}
                    onChange={(e) => {
                      setUserTouchedJob(true);
                      setFormData((prev) => ({ ...prev, jobPosition: e.target.value }));
                    }}
                    placeholder="e.g. Senior Payroll Specialist"
                    className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm text-navy disabled:bg-surface/50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-accent"
                    required
                  />
                  <p className="text-[11px] text-mutedText mt-1">
                    Period-specific position recorded on this contract
                  </p>
                </div>

                {/* Working Schedule */}
                <div>
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">
                    Working Schedule <span className="text-mutedText font-normal">(Optional Override)</span>
                  </label>
                  {isEditMode ? (
                    <select
                      value={formData.workingScheduleId || ''}
                      onChange={(e) => {
                        setUserTouchedSchedule(true);
                        setFormData((prev) => ({
                          ...prev,
                          workingScheduleId: e.target.value || null,
                        }));
                      }}
                      className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm text-navy focus:outline-none focus:ring-1 focus:ring-accent"
                    >
                      <option value="">Use employee default schedule</option>
                      {schedules.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.type})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 bg-surface/30 border border-border rounded-lg text-sm flex items-center justify-between">
                      <span className="text-navy font-medium">
                        {contract?.workingSchedule?.name || 'Use employee default schedule'}
                      </span>
                      {contract?.workingSchedule && (
                        <span className="text-xs px-2 py-0.5 rounded bg-surface text-slate border border-border">
                          Override
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-[11px] text-mutedText mt-1">
                    Schedule precedence: Contract override &rarr; Employee default &rarr; Missing
                  </p>
                </div>

                {/* Salary Structure */}
                <div>
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">
                    Salary Structure <span className="text-red-500">*</span>
                  </label>
                  {isEditMode ? (
                    <select
                      value={formData.salaryStructureId}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, salaryStructureId: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm text-navy focus:outline-none focus:ring-1 focus:ring-accent"
                      required
                    >
                      <option value="">Select salary structure...</option>
                      {structures.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 bg-surface/30 border border-border rounded-lg text-sm text-navy flex items-center justify-between">
                      <span className="font-semibold">{contract?.salaryStructure.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {contract?.salaryStructure.status}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Salary Structure / Notes Box */}
            <div className="p-6 bg-surface/30 border border-border rounded-xl flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-bold text-navy">Salary Structure & Payroll Notes</h3>
              </div>

              <div className="text-xs text-slate space-y-1.5">
                <p>
                  <strong className="text-navy">Payroll Rule:</strong> Exactly one Contract must cover the entire
                  payroll period (<code className="bg-white px-1.5 py-0.5 rounded border border-border font-mono">startDate &le; periodStart AND (endDate IS NULL OR endDate &ge; periodEnd)</code>).
                </p>
                <p>
                  <strong className="text-navy">Integrity Invariant:</strong> Contract date ranges for one employee are
                  enforced in PostgreSQL via exclusion constraint and cannot overlap.
                </p>
              </div>

              {/* Notes Text Area */}
              <div>
                <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">
                  Internal Notes
                </label>
                <textarea
                  rows={3}
                  disabled={!isEditMode}
                  value={formData.notes || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      notes: e.target.value || null,
                    }))
                  }
                  placeholder="Add optional internal notes regarding this contract..."
                  className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm text-navy disabled:bg-surface/50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                />
              </div>
            </div>
          </div>
        </div>
      </form>
    </AppLayout>
  );
}
