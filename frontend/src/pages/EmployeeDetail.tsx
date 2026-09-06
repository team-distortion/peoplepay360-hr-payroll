import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import AppLayout from '../components/layout/AppLayout';
import {
  EmployeeInputSchema,
  type EmployeeInput,
  EmployeeTypeValues,
} from '@peoplepay360/shared';
import {
  useEmployee,
  useCurrentEmployeeProfile,
  useCreateEmployee,
  useUpdateEmployee,
  useUpdateEmployeeStatus,
  useEmployees,
} from '../features/employees/employees.queries';
import { useDepartments } from '../features/departments/departments.queries';
import { useSchedules } from '../features/schedules/schedules.queries';
import { useAuth } from '../context/AuthContext';
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  Lock,
  Power,
} from 'lucide-react';

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isNew = location.pathname === '/employees/new' || !id || id === 'new';
  const isMe = location.pathname === '/employees/me' || id === 'me';

  // Permission checks
  const canEdit =
    user?.role === 'ADMIN' ||
    user?.role === 'HR_MANAGER' ||
    user?.role === 'HR_PAYROLL_USER' ||
    user?.role === 'HR_PAYROLL_MANAGER';

  // If role is EMPLOYEE and accessing /employees/me, use useCurrentEmployeeProfile
  const currentProfileQuery = useCurrentEmployeeProfile({
    enabled: isMe,
  });

  // Regular detail query - NEVER fetch if isNew or isMe or id is 'new'
  const shouldFetchEmployee = Boolean(!isNew && !isMe && id && id !== 'new' && id !== 'me');
  const employeeQuery = useEmployee(shouldFetchEmployee ? id : undefined);

  const employee = isMe ? currentProfileQuery.data : employeeQuery.data;
  const isLoading = isMe ? currentProfileQuery.isLoading : employeeQuery.isLoading;
  const isError = isMe ? currentProfileQuery.isError : employeeQuery.isError;
  const error = isMe ? currentProfileQuery.error : employeeQuery.error;

  const [isEditMode, setIsEditMode] = useState<boolean>(isNew);
  const [activeTab, setActiveTab] = useState<'work' | 'private'>('work');
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Queries for selectors
  const { data: departments = [] } = useDepartments();
  const { data: schedulesData } = useSchedules({ pageSize: 100 });
  const { data: managersData } = useEmployees({ pageSize: 100 });

  const schedules = schedulesData?.items || [];
  const candidateManagers = (managersData?.items || []).filter(
    (m) => !employee || m.id !== employee.id
  );

  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();
  const statusMutation = useUpdateEmployeeStatus();

  const defaultValues: EmployeeInput = {
    employeeNumber: '',
    firstName: '',
    lastName: '',
    workEmail: '',
    workPhone: null,
    jobPosition: '',
    employeeType: 'FULL_TIME',
    status: 'ACTIVE',
    workLocation: null,
    departmentId: null,
    managerId: null,
    workingScheduleId: null,
    personalEmail: null,
    personalPhone: null,
    dateOfBirth: null,
    personalAddress: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    bankAccountName: null,
    bankAccountNumber: null,
    bankName: null,
    bankIfsc: null,
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeInput>({
    resolver: zodResolver(EmployeeInputSchema) as any,
    defaultValues,
  });

  // Reset form when employee loads or when route mode changes
  useEffect(() => {
    if (isNew) {
      reset(defaultValues);
      setIsEditMode(true);
      setServerError(null);
    } else if (employee) {
      reset({
        employeeNumber: employee.employeeNumber,
        firstName: employee.firstName,
        lastName: employee.lastName,
        workEmail: employee.workEmail,
        workPhone: employee.workPhone,
        jobPosition: employee.jobPosition,
        employeeType: employee.employeeType,
        status: employee.status,
        workLocation: employee.workLocation,
        departmentId: employee.department?.id || null,
        managerId: employee.manager?.id || null,
        workingScheduleId: employee.workingSchedule?.id || null,
        personalEmail: employee.personalEmail,
        personalPhone: employee.personalPhone,
        dateOfBirth: employee.dateOfBirth,
        personalAddress: employee.personalAddress,
        emergencyContactName: employee.emergencyContactName,
        emergencyContactPhone: employee.emergencyContactPhone,
        bankAccountName: employee.bankAccountName,
        bankAccountNumber: employee.bankAccountNumber,
        bankName: employee.bankName,
        bankIfsc: employee.bankIfsc,
      });
      setIsEditMode(false);
      setServerError(null);
    }
  }, [employee, isNew, reset]);

  const onSubmit = async (data: EmployeeInput) => {
    setServerError(null);
    try {
      const cleanData: EmployeeInput = {
        ...data,
        workPhone: data.workPhone?.trim() ? data.workPhone.trim() : null,
        workLocation: data.workLocation?.trim() ? data.workLocation.trim() : null,
        departmentId: data.departmentId || null,
        managerId: data.managerId || null,
        workingScheduleId: data.workingScheduleId || null,
        personalEmail: data.personalEmail?.trim() ? data.personalEmail.trim() : null,
        personalPhone: data.personalPhone?.trim() ? data.personalPhone.trim() : null,
        dateOfBirth: data.dateOfBirth || null,
        personalAddress: data.personalAddress?.trim() ? data.personalAddress.trim() : null,
        emergencyContactName: data.emergencyContactName?.trim() ? data.emergencyContactName.trim() : null,
        emergencyContactPhone: data.emergencyContactPhone?.trim() ? data.emergencyContactPhone.trim() : null,
        bankAccountName: data.bankAccountName?.trim() ? data.bankAccountName.trim() : null,
        bankAccountNumber: data.bankAccountNumber?.trim() ? data.bankAccountNumber.trim() : null,
        bankName: data.bankName?.trim() ? data.bankName.trim() : null,
        bankIfsc: data.bankIfsc?.trim() ? data.bankIfsc.trim() : null,
      };

      if (isNew) {
        const created = await createMutation.mutateAsync(cleanData);
        navigate(`/employees/${created.id}`);
      } else if (employee) {
        await updateMutation.mutateAsync({ id: employee.id, input: cleanData });
        setIsEditMode(false);
      }
    } catch (err: any) {
      setServerError(err.message || 'Failed to save employee profile');
    }
  };

  const handleDiscard = () => {
    setServerError(null);
    if (isNew) {
      navigate('/employees');
    } else if (employee) {
      reset({
        employeeNumber: employee.employeeNumber,
        firstName: employee.firstName,
        lastName: employee.lastName,
        workEmail: employee.workEmail,
        workPhone: employee.workPhone,
        jobPosition: employee.jobPosition,
        employeeType: employee.employeeType,
        status: employee.status,
        workLocation: employee.workLocation,
        departmentId: employee.department?.id || null,
        managerId: employee.manager?.id || null,
        workingScheduleId: employee.workingSchedule?.id || null,
        personalEmail: employee.personalEmail,
        personalPhone: employee.personalPhone,
        dateOfBirth: employee.dateOfBirth,
        personalAddress: employee.personalAddress,
        emergencyContactName: employee.emergencyContactName,
        emergencyContactPhone: employee.emergencyContactPhone,
        bankAccountName: employee.bankAccountName,
        bankAccountNumber: employee.bankAccountNumber,
        bankName: employee.bankName,
        bankIfsc: employee.bankIfsc,
      });
      setIsEditMode(false);
    }
  };

  const handleStatusToggle = async () => {
    if (!employee) return;
    setServerError(null);
    const nextStatus = employee.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await statusMutation.mutateAsync({ id: employee.id, status: nextStatus });
      setShowStatusConfirm(false);
    } catch (err: any) {
      setServerError(err.message || 'Failed to update employee status');
      setShowStatusConfirm(false);
    }
  };

  if (!isNew && isLoading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
          <span className="text-sm font-medium text-slate">Loading employee profile...</span>
        </div>
      </AppLayout>
    );
  }

  if (!isNew && (isError || (!employee && !isLoading))) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto my-20 p-8 bg-white border border-border rounded-xl text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-navy mb-2">Employee Profile Not Found</h2>
          <p className="text-sm text-slate mb-6">
            {error instanceof Error
              ? error.message
              : 'The requested employee profile does not exist or you do not have permission to view it.'}
          </p>
          {canEdit && (
            <button
              onClick={() => navigate('/employees')}
              className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              Return to Employees
            </button>
          )}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto bg-surface/30">
        {/* Sticky Header */}
        <div className="px-8 py-5 border-b border-border bg-white sticky top-0 z-20 flex flex-col gap-3 shadow-xs">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-slate mb-1">
                {canEdit ? (
                  <Link to="/employees" className="hover:text-navy transition-colors flex items-center gap-1">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Employees</span>
                  </Link>
                ) : (
                  <span className="text-slate">Employee</span>
                )}
                <span>/</span>
                <span className="font-semibold text-navy">
                  {isNew ? 'New Employee' : employee?.fullName}
                </span>
              </div>
              <p className="text-xs text-mutedText">
                Main employee form with related HR actions
              </p>
            </div>

            {/* Smart Buttons (Disabled with explicit "Available after <module>" state) */}
            {!isNew && employee && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/time-off/requests?employeeId=${employee.id}`)}
                  className="px-3 py-1 bg-white hover:bg-accent/10 hover:border-accent/40 text-navy hover:text-accent text-xs font-semibold rounded-full border border-border transition-all flex items-center gap-1.5 shadow-2xs"
                  title="View time off requests for this employee"
                >
                  <span>Time Off</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-surface text-[11px] font-mono border border-border text-slate">
                    {employee.timeOffRequestCount ?? 0}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/time-off/allocations?employeeId=${employee.id}`)}
                  className="px-3 py-1 bg-white hover:bg-accent/10 hover:border-accent/40 text-navy hover:text-accent text-xs font-semibold rounded-full border border-border transition-all flex items-center gap-1.5 shadow-2xs"
                  title="View time off allocations for this employee"
                >
                  <span>Allocations</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-surface text-[11px] font-mono border border-border text-slate">
                    {employee.timeOffAllocationCount ?? 0}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/contracts?employeeId=${employee.id}`)}
                  className="px-3 py-1 bg-white hover:bg-accent/10 hover:border-accent/40 text-navy hover:text-accent text-xs font-semibold rounded-full border border-border transition-all flex items-center gap-1.5 shadow-2xs"
                  title="View contracts for this employee"
                >
                  <span>Contracts</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-surface text-[11px] font-mono border border-border text-slate">
                    {employee.contractCount ?? 0}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/attendance?employeeId=${employee.id}`)}
                  className="px-3 py-1 bg-white hover:bg-accent/10 hover:border-accent/40 text-navy hover:text-accent text-xs font-semibold rounded-full border border-border transition-all flex items-center gap-1.5 shadow-2xs"
                  title="View attendance records for this employee"
                >
                  <span>Attendance</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-surface text-[11px] font-mono border border-border text-slate">
                    {employee.attendanceCount ?? 0}
                  </span>
                </button>
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
                      className="px-4 py-1.5 border border-border text-navy text-xs font-semibold rounded-md hover:bg-surface transition-colors shadow-xs"
                    >
                      EDIT
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 animate-in fade-in">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-5 py-1.5 bg-accent text-white text-xs font-semibold rounded-md hover:bg-accent/90 transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
                        SAVE
                      </button>
                      <button
                        type="button"
                        onClick={handleDiscard}
                        className="px-4 py-1.5 border border-border text-navy text-xs font-semibold rounded-md hover:bg-surface transition-colors"
                      >
                        DISCARD
                      </button>
                    </div>
                  )}

                  {!isNew && employee && (
                    <button
                      type="button"
                      onClick={() => setShowStatusConfirm(true)}
                      className={`ml-2 px-3 py-1.5 text-xs font-semibold rounded-md border flex items-center gap-1.5 transition-colors ${
                        employee.status === 'ACTIVE'
                          ? 'border-red-200 text-red-600 hover:bg-red-50'
                          : 'border-green-200 text-green-600 hover:bg-green-50'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{employee.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</span>
                    </button>
                  )}
                </>
              )}
            </div>

            {!isNew && employee && (
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    employee.status === 'ACTIVE'
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      employee.status === 'ACTIVE' ? 'bg-green-500' : 'bg-slate-400'
                    }`}
                  />
                  {employee.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                </span>
              </div>
            )}
          </div>

          {/* Server error alert */}
          {serverError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{serverError}</span>
            </div>
          )}
        </div>

        {/* Form Body */}
        <div className="max-w-4xl mx-auto p-8">
          {/* Identity Block */}
          <div className="bg-white border border-border rounded-2xl p-6 mb-8 shadow-xs">
            <div className="flex items-start gap-6">
              <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-2xl flex-shrink-0 tracking-wider border border-accent/20">
                {isNew ? '+' : employee?.initials}
              </div>

              <div className="flex-1 min-w-0">
                {isEditMode ? (
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-xs font-semibold text-mutedText uppercase tracking-wider block mb-1">
                        First Name *
                      </label>
                      <input
                        {...register('firstName')}
                        placeholder="First Name"
                        className="text-lg font-bold text-navy w-full border border-border rounded-md px-3 py-1.5 focus:outline-none focus:border-accent"
                      />
                      {errors.firstName && (
                        <p className="text-xs text-red-500 mt-1">{errors.firstName.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-mutedText uppercase tracking-wider block mb-1">
                        Last Name *
                      </label>
                      <input
                        {...register('lastName')}
                        placeholder="Last Name"
                        className="text-lg font-bold text-navy w-full border border-border rounded-md px-3 py-1.5 focus:outline-none focus:border-accent"
                      />
                      {errors.lastName && (
                        <p className="text-xs text-red-500 mt-1">{errors.lastName.message}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <h2 className="text-3xl font-display font-bold text-navy mb-2">
                    {employee?.fullName}
                  </h2>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate">
                  <div>
                    <label className="text-[10px] font-semibold text-mutedText uppercase tracking-wider block mb-0.5">
                      Employee Number *
                    </label>
                    {isEditMode ? (
                      <div>
                        <input
                          {...register('employeeNumber')}
                          placeholder="e.g. EMP001"
                          className="w-full font-mono border border-border rounded px-2 py-1 text-xs text-navy focus:outline-none focus:border-accent uppercase"
                        />
                        {errors.employeeNumber && (
                          <p className="text-xs text-red-500 mt-0.5">{errors.employeeNumber.message}</p>
                        )}
                      </div>
                    ) : (
                      <span className="font-mono text-sm font-semibold text-navy">
                        {employee?.employeeNumber}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-mutedText uppercase tracking-wider block mb-0.5">
                      Job Position *
                    </label>
                    {isEditMode ? (
                      <div>
                        <input
                          {...register('jobPosition')}
                          placeholder="Job Position"
                          className="w-full border border-border rounded px-2 py-1 text-xs text-navy focus:outline-none focus:border-accent"
                        />
                        {errors.jobPosition && (
                          <p className="text-xs text-red-500 mt-0.5">{errors.jobPosition.message}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm font-medium text-navy">
                        {employee?.jobPosition}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-mutedText uppercase tracking-wider block mb-0.5">
                      Work Email *
                    </label>
                    {isEditMode ? (
                      <div>
                        <input
                          {...register('workEmail')}
                          placeholder="email@company.com"
                          className="w-full border border-border rounded px-2 py-1 text-xs text-navy focus:outline-none focus:border-accent"
                        />
                        {errors.workEmail && (
                          <p className="text-xs text-red-500 mt-0.5">{errors.workEmail.message}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-navy">{employee?.workEmail}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-border flex gap-8 mb-6">
            <button
              type="button"
              onClick={() => setActiveTab('work')}
              className={`pb-3 text-sm font-semibold transition-colors relative ${
                activeTab === 'work' ? 'text-accent' : 'text-slate hover:text-navy'
              }`}
            >
              Work Information
              {activeTab === 'work' && (
                <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-accent rounded-t-full" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('private')}
              className={`pb-3 text-sm font-semibold transition-colors relative ${
                activeTab === 'private' ? 'text-accent' : 'text-slate hover:text-navy'
              }`}
            >
              Private Information
              {activeTab === 'private' && (
                <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-accent rounded-t-full" />
              )}
            </button>
          </div>

          {/* Tab Content */}
          <div className="bg-white border border-border rounded-2xl p-8 shadow-xs animate-in fade-in duration-150">
            {activeTab === 'work' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                {/* Department Selector */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-mutedText uppercase tracking-wider">
                    Department {isEditMode && '*'}
                  </label>
                  {isEditMode ? (
                    <div>
                      <select
                        {...register('departmentId')}
                        className="w-full text-sm text-navy px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-accent"
                      >
                        <option value="">Select Department...</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} {d.status === 'INACTIVE' ? '(Inactive)' : ''}
                          </option>
                        ))}
                      </select>
                      {errors.departmentId && (
                        <p className="text-xs text-red-500 mt-1">{errors.departmentId.message}</p>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm font-medium text-navy py-1.5">
                      {employee?.department?.name || '—'}
                    </div>
                  )}
                </div>

                {/* Manager Selector */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-mutedText uppercase tracking-wider">
                    Manager
                  </label>
                  {isEditMode ? (
                    <div>
                      <select
                        {...register('managerId')}
                        className="w-full text-sm text-navy px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-accent"
                      >
                        <option value="">No Manager (Top-level)</option>
                        {candidateManagers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.fullName} ({m.jobPosition})
                          </option>
                        ))}
                      </select>
                      {errors.managerId && (
                        <p className="text-xs text-red-500 mt-1">{errors.managerId.message}</p>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm font-medium text-navy py-1.5">
                      {employee?.manager ? employee.manager.fullName : 'None (Top-level)'}
                    </div>
                  )}
                </div>

                {/* Working Schedule Selector */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-mutedText uppercase tracking-wider">
                    Working Schedule {isEditMode && '*'}
                  </label>
                  {isEditMode ? (
                    <div>
                      <select
                        {...register('workingScheduleId')}
                        className="w-full text-sm text-navy px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-accent"
                      >
                        <option value="">Select Working Schedule...</option>
                        {schedules.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({Math.round((s.weeklyMinutes || 2400) / 60)} hrs/week)
                          </option>
                        ))}
                      </select>
                      {errors.workingScheduleId && (
                        <p className="text-xs text-red-500 mt-1">{errors.workingScheduleId.message}</p>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm font-medium text-navy py-1.5">
                      {employee?.workingSchedule ? employee.workingSchedule.name : '—'}
                    </div>
                  )}
                </div>

                {/* Employment Type */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-mutedText uppercase tracking-wider">
                    Employment Type *
                  </label>
                  {isEditMode ? (
                    <div>
                      <select
                        {...register('employeeType')}
                        className="w-full text-sm text-navy px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-accent"
                      >
                        {EmployeeTypeValues.map((type) => (
                          <option key={type} value={type}>
                            {type.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                      {errors.employeeType && (
                        <p className="text-xs text-red-500 mt-1">{errors.employeeType.message}</p>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm font-medium text-navy py-1.5">
                      {employee?.employeeType.replace('_', ' ')}
                    </div>
                  )}
                </div>

                {/* Work Location */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-mutedText uppercase tracking-wider">
                    Work Location
                  </label>
                  {isEditMode ? (
                    <div>
                      <input
                        {...register('workLocation')}
                        placeholder="e.g. Mumbai, Remote"
                        className="w-full text-sm text-navy px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-accent"
                      />
                      {errors.workLocation && (
                        <p className="text-xs text-red-500 mt-1">{errors.workLocation.message}</p>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-navy py-1.5">
                      {employee?.workLocation || '—'}
                    </div>
                  )}
                </div>

                {/* Work Phone */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-mutedText uppercase tracking-wider">
                    Work Phone
                  </label>
                  {isEditMode ? (
                    <div>
                      <input
                        {...register('workPhone')}
                        placeholder="+91 98765 43210"
                        className="w-full text-sm text-navy px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-accent"
                      />
                      {errors.workPhone && (
                        <p className="text-xs text-red-500 mt-1">{errors.workPhone.message}</p>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-navy py-1.5">
                      {employee?.workPhone || '—'}
                    </div>
                  )}
                </div>

                {/* Company (Single-system, Read-only per spec) */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-mutedText uppercase tracking-wider flex items-center gap-1">
                    <span>Company</span>
                    <Lock className="w-3 h-3 text-mutedText" />
                  </label>
                  <div className="text-sm font-medium text-slate bg-surface px-3 py-2 rounded-lg border border-border/80">
                    {employee?.companyName || 'OXP Pvt Ltd'}
                  </div>
                </div>

                {/* Status (Read-only representation in form; modified via Action row) */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-mutedText uppercase tracking-wider">
                    Master Status
                  </label>
                  <div className="text-sm font-medium text-navy py-1.5 flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        (isNew ? 'ACTIVE' : employee?.status) === 'ACTIVE'
                          ? 'bg-green-500'
                          : 'bg-slate-400'
                      }`}
                    />
                    <span>{(isNew ? 'ACTIVE' : employee?.status) === 'ACTIVE' ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Private Information Tab */
              <div className="space-y-8">
                {/* Personal Identity & Contact */}
                <div>
                  <h3 className="text-xs font-bold text-navy uppercase tracking-wider mb-4 border-b border-border pb-2">
                    Personal Identity & Contact
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-mutedText uppercase tracking-wider">
                        Personal Email
                      </label>
                      {isEditMode ? (
                        <div>
                          <input
                            {...register('personalEmail')}
                            placeholder="personal@email.com"
                            className="w-full text-sm text-navy px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-accent"
                          />
                          {errors.personalEmail && (
                            <p className="text-xs text-red-500 mt-1">{errors.personalEmail.message}</p>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-navy py-1.5">
                          {employee?.personalEmail || '—'}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-mutedText uppercase tracking-wider">
                        Personal Phone
                      </label>
                      {isEditMode ? (
                        <div>
                          <input
                            {...register('personalPhone')}
                            placeholder="+91 98765 00000"
                            className="w-full text-sm text-navy px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-accent"
                          />
                          {errors.personalPhone && (
                            <p className="text-xs text-red-500 mt-1">{errors.personalPhone.message}</p>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-navy py-1.5">
                          {employee?.personalPhone || '—'}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-mutedText uppercase tracking-wider">
                        Date of Birth
                      </label>
                      {isEditMode ? (
                        <div>
                          <input
                            type="date"
                            {...register('dateOfBirth')}
                            className="w-full text-sm text-navy px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-accent"
                          />
                          {errors.dateOfBirth && (
                            <p className="text-xs text-red-500 mt-1">{errors.dateOfBirth.message}</p>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-navy py-1.5">
                          {employee?.dateOfBirth || '—'}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-mutedText uppercase tracking-wider">
                        Personal Address
                      </label>
                      {isEditMode ? (
                        <div>
                          <input
                            {...register('personalAddress')}
                            placeholder="Street, City, Postal Code"
                            className="w-full text-sm text-navy px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-accent"
                          />
                          {errors.personalAddress && (
                            <p className="text-xs text-red-500 mt-1">{errors.personalAddress.message}</p>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-navy py-1.5">
                          {employee?.personalAddress || '—'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Emergency Contact */}
                <div>
                  <h3 className="text-xs font-bold text-navy uppercase tracking-wider mb-4 border-b border-border pb-2">
                    Emergency Contact
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-mutedText uppercase tracking-wider">
                        Contact Name
                      </label>
                      {isEditMode ? (
                        <div>
                          <input
                            {...register('emergencyContactName')}
                            placeholder="Full Name"
                            className="w-full text-sm text-navy px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-accent"
                          />
                          {errors.emergencyContactName && (
                            <p className="text-xs text-red-500 mt-1">{errors.emergencyContactName.message}</p>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-navy py-1.5">
                          {employee?.emergencyContactName || '—'}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-mutedText uppercase tracking-wider">
                        Contact Phone
                      </label>
                      {isEditMode ? (
                        <div>
                          <input
                            {...register('emergencyContactPhone')}
                            placeholder="+91 98765 00000"
                            className="w-full text-sm text-navy px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-accent"
                          />
                          {errors.emergencyContactPhone && (
                            <p className="text-xs text-red-500 mt-1">{errors.emergencyContactPhone.message}</p>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-navy py-1.5">
                          {employee?.emergencyContactPhone || '—'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bank Account Details */}
                <div>
                  <h3 className="text-xs font-bold text-navy uppercase tracking-wider mb-4 border-b border-border pb-2">
                    Bank Account Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-mutedText uppercase tracking-wider">
                        Account Holder Name
                      </label>
                      {isEditMode ? (
                        <div>
                          <input
                            {...register('bankAccountName')}
                            placeholder="As per bank passbook"
                            className="w-full text-sm text-navy px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-accent"
                          />
                          {errors.bankAccountName && (
                            <p className="text-xs text-red-500 mt-1">{errors.bankAccountName.message}</p>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-navy py-1.5">
                          {employee?.bankAccountName || '—'}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-mutedText uppercase tracking-wider">
                        Bank Account Number
                      </label>
                      {isEditMode ? (
                        <div>
                          <input
                            {...register('bankAccountNumber')}
                            placeholder="Account Number"
                            className="w-full font-mono text-sm text-navy px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-accent"
                          />
                          {errors.bankAccountNumber && (
                            <p className="text-xs text-red-500 mt-1">{errors.bankAccountNumber.message}</p>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm font-mono text-navy py-1.5">
                          {employee?.bankAccountNumber || '—'}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-mutedText uppercase tracking-wider">
                        Bank Name
                      </label>
                      {isEditMode ? (
                        <div>
                          <input
                            {...register('bankName')}
                            placeholder="e.g. HDFC Bank"
                            className="w-full text-sm text-navy px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-accent"
                          />
                          {errors.bankName && (
                            <p className="text-xs text-red-500 mt-1">{errors.bankName.message}</p>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-navy py-1.5">
                          {employee?.bankName || '—'}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-mutedText uppercase tracking-wider">
                        Bank IFSC Code
                      </label>
                      {isEditMode ? (
                        <div>
                          <input
                            {...register('bankIfsc')}
                            placeholder="e.g. HDFC0001234"
                            className="w-full font-mono text-sm text-navy px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-accent uppercase"
                          />
                          {errors.bankIfsc && (
                            <p className="text-xs text-red-500 mt-1">{errors.bankIfsc.message}</p>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm font-mono text-navy py-1.5">
                          {employee?.bankIfsc || '—'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Confirmation Modal for Status Change */}
        {showStatusConfirm && employee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
              <h3 className="text-lg font-bold text-navy mb-2">
                {employee.status === 'ACTIVE' ? 'Deactivate Employee?' : 'Reactivate Employee?'}
              </h3>
              <p className="text-sm text-slate mb-6">
                {employee.status === 'ACTIVE'
                  ? `Are you sure you want to deactivate ${employee.fullName}? Historical records will be preserved.`
                  : `Are you sure you want to reactivate ${employee.fullName}? The employee must have an active Department and Working Schedule assigned.`}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowStatusConfirm(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate border border-border rounded-lg hover:bg-surface"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStatusToggle}
                  disabled={statusMutation.isPending}
                  className={`px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors flex items-center gap-1.5 ${
                    employee.status === 'ACTIVE'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {statusMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                  Confirm {employee.status === 'ACTIVE' ? 'Deactivation' : 'Reactivation'}
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
    </AppLayout>
  );
}
