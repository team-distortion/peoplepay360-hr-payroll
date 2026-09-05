import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import {
  ArrowLeft,
  Edit2,
  Save,
  X,
  Loader2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  useAttendanceDetail,
  useCreateAttendanceMutation,
  useCorrectAttendanceMutation,
} from '@/features/attendance/attendance.queries';
import { useEmployees } from '@/features/employees/employees.queries';

function toTimeInputString(isoStr: string | null): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d);
}

function toCompanyIsoTimestamp(dateStr: string, timeStr: string | null): string | null {
  if (!timeStr || !timeStr.trim()) return null;
  // Use Asia/Kolkata (+05:30) authoritative offset
  return `${dateStr}T${timeStr.trim()}:00+05:30`;
}

function formatMinutesToHhMm(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

export default function AttendanceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isNew = id === 'new';

  const canEdit =
    user?.role === 'ADMIN' ||
    user?.role === 'HR_MANAGER' ||
    user?.role === 'HR_PAYROLL_USER' ||
    user?.role === 'HR_PAYROLL_MANAGER';

  // Detail query
  const { data: record, isLoading, isError, error } = useAttendanceDetail(id);

  // Employees for create selector
  const { data: employeesData } = useEmployees({ pageSize: 100 });

  // Mutations
  const createMutation = useCreateAttendanceMutation();
  const correctMutation = useCorrectAttendanceMutation();

  // Form State
  const [isEditing, setIsEditing] = useState(isNew);
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formDate, setFormDate] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [formKind, setFormKind] = useState<'WORKED' | 'ABSENT'>('WORKED');
  const [formCheckInTime, setFormCheckInTime] = useState('09:00');
  const [formCheckOutTime, setFormCheckOutTime] = useState('18:00');
  const [formReason, setFormReason] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);

  // Sync form state when record loads or changes
  useEffect(() => {
    if (record) {
      setFormEmployeeId(record.employee.id);
      setFormDate(record.attendanceDate);
      setFormKind(record.status === 'ABSENT' ? 'ABSENT' : 'WORKED');
      setFormCheckInTime(toTimeInputString(record.checkInAt));
      setFormCheckOutTime(toTimeInputString(record.checkOutAt));
      setFormReason('');
      setServerError(null);
    }
  }, [record]);

  // If new, start in edit mode
  useEffect(() => {
    if (isNew) {
      setIsEditing(true);
      setFormKind('WORKED');
      setFormCheckInTime('09:00');
      setFormCheckOutTime('18:00');
      setFormReason('');
      setServerError(null);
    }
  }, [isNew]);

  const handleDiscard = () => {
    setServerError(null);
    if (isNew) {
      navigate('/attendance');
    } else if (record) {
      setIsEditing(false);
      setFormKind(record.status === 'ABSENT' ? 'ABSENT' : 'WORKED');
      setFormCheckInTime(toTimeInputString(record.checkInAt));
      setFormCheckOutTime(toTimeInputString(record.checkOutAt));
      setFormReason('');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (formReason.trim().length < 5) {
      setServerError('Reason must be at least 5 characters long explaining this action.');
      return;
    }

    try {
      if (isNew) {
        if (!formEmployeeId) {
          setServerError('Please select an employee.');
          return;
        }

        const checkInAt =
          formKind === 'WORKED' ? toCompanyIsoTimestamp(formDate, formCheckInTime) : null;
        const checkOutAt =
          formKind === 'WORKED' ? toCompanyIsoTimestamp(formDate, formCheckOutTime) : null;

        const created = await createMutation.mutateAsync({
          employeeId: formEmployeeId,
          attendanceDate: formDate,
          kind: formKind,
          checkInAt,
          checkOutAt,
          reason: formReason.trim(),
        });

        navigate(`/attendance/${created.id}`);
      } else if (record && id) {
        const checkInAt =
          formKind === 'WORKED' ? toCompanyIsoTimestamp(record.attendanceDate, formCheckInTime) : null;
        const checkOutAt =
          formKind === 'WORKED' ? toCompanyIsoTimestamp(record.attendanceDate, formCheckOutTime) : null;

        await correctMutation.mutateAsync({
          id,
          input: {
            kind: formKind,
            checkInAt,
            checkOutAt,
            reason: formReason.trim(),
          },
        });

        setIsEditing(false);
      }
    } catch (err: any) {
      setServerError(err.message || 'Failed to save attendance record.');
    }
  };

  if (!isNew && isLoading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
          <span className="text-sm font-medium text-slate">Loading attendance details...</span>
        </div>
      </AppLayout>
    );
  }

  if (!isNew && (isError || !record)) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto my-20 p-8 bg-white border border-border rounded-xl text-center shadow-sm">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-navy mb-2">Record Not Found</h2>
          <p className="text-sm text-slate mb-6">
            {(error as Error)?.message ||
              'This attendance record does not exist or you do not have permission to view it.'}
          </p>
          <button
            onClick={() => navigate('/attendance')}
            className="px-4 py-2 bg-accent text-white rounded-lg text-xs font-semibold hover:bg-accent/90 transition-colors"
          >
            Return to Attendance List
          </button>
        </div>
      </AppLayout>
    );
  }

  const isSubmitting = createMutation.isPending || correctMutation.isPending;

  return (
    <AppLayout>
      <div className="flex flex-col flex-1 bg-surface/30">
        {/* Top Header */}
        <div className="px-6 py-5 border-b border-border bg-white flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={() => navigate('/attendance')}
                className="text-muted hover:text-navy transition-colors"
                title="Back to attendance list"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-navy flex items-center gap-2">
                <span>Attendance</span>
                <span className="text-muted font-normal">/</span>
                <span>{isNew ? 'New Manual Entry' : record?.employee.fullName}</span>
                {!isNew && (
                  <>
                    <span className="text-muted font-normal">/</span>
                    <span className="font-mono text-sm font-normal text-slate">
                      {record?.attendanceDate}
                    </span>
                  </>
                )}
              </h1>
            </div>
            <p className="text-slate text-xs ml-7">
              {isNew
                ? 'Manual attendance entry by authorized HR'
                : 'Attendance record details with schedule expectations and corrections'}
            </p>
          </div>

          {/* Top Actions */}
          <div>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDiscard}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-md text-xs font-semibold text-slate hover:bg-surface transition-colors"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-accent hover:bg-accent/90 text-white rounded-md text-xs font-semibold transition-colors shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isNew ? 'Create Record' : 'Save Correction'}
                </button>
              </div>
            ) : (
              canEdit && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 border border-border rounded-md text-xs font-semibold hover:bg-surface transition-colors text-navy uppercase tracking-wider shadow-2xs"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Correct
                </button>
              )
            )}
          </div>
        </div>

        {/* Content Container */}
        <div className="p-6 max-w-5xl mx-auto w-full">
          {serverError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-3 animate-in fade-in">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold mb-0.5">Error processing request</h4>
                <p className="text-xs text-red-600">{serverError}</p>
              </div>
            </div>
          )}

          <div className="bg-white border border-border rounded-xl p-8 shadow-sm">
            <form onSubmit={handleSave}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Employee */}
                  <div>
                    <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">
                      Employee
                    </label>
                    {isNew ? (
                      <select
                        value={formEmployeeId}
                        onChange={(e) => setFormEmployeeId(e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded-md text-sm text-navy focus:outline-none focus:border-accent bg-white"
                        required
                      >
                        <option value="">Select Employee...</option>
                        {employeesData?.items.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.fullName} ({emp.employeeNumber})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div>
                        <div className="text-navy font-bold text-lg">
                          {record?.employee.fullName}
                        </div>
                        <div className="text-xs text-muted font-mono">
                          {record?.employee.employeeNumber}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Business Date */}
                  <div>
                    <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">
                      Attendance Date
                    </label>
                    {isNew ? (
                      <input
                        type="date"
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded-md text-sm text-navy focus:outline-none focus:border-accent"
                        required
                      />
                    ) : (
                      <div className="text-navy font-mono text-sm">{record?.attendanceDate}</div>
                    )}
                  </div>

                  {/* Mode / Kind */}
                  <div>
                    <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">
                      Record Type
                    </label>
                    {isEditing ? (
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm text-navy font-medium cursor-pointer">
                          <input
                            type="radio"
                            name="recordKind"
                            value="WORKED"
                            checked={formKind === 'WORKED'}
                            onChange={() => setFormKind('WORKED')}
                            className="text-accent focus:ring-accent"
                          />
                          Worked Punch
                        </label>
                        <label className="flex items-center gap-2 text-sm text-navy font-medium cursor-pointer">
                          <input
                            type="radio"
                            name="recordKind"
                            value="ABSENT"
                            checked={formKind === 'ABSENT'}
                            onChange={() => setFormKind('ABSENT')}
                            className="text-accent focus:ring-accent"
                          />
                          Mark Absent
                        </label>
                      </div>
                    ) : (
                      <span className="text-sm font-semibold text-navy">
                        {record?.status === 'ABSENT' ? 'Absent Record' : 'Worked Record'}
                      </span>
                    )}
                  </div>

                  {/* Check In / Out Inputs (if WORKED) */}
                  {formKind === 'WORKED' && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">
                          Check In Time
                        </label>
                        {isEditing ? (
                          <input
                            type="time"
                            value={formCheckInTime}
                            onChange={(e) => setFormCheckInTime(e.target.value)}
                            className="w-full px-3 py-2 border border-border rounded-md text-sm text-navy focus:outline-none focus:border-accent"
                            required
                          />
                        ) : (
                          <div className="text-navy font-medium text-sm">
                            {record?.checkInAt
                              ? new Date(record.checkInAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '—'}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">
                          Check Out Time (Optional if Open)
                        </label>
                        {isEditing ? (
                          <input
                            type="time"
                            value={formCheckOutTime}
                            onChange={(e) => setFormCheckOutTime(e.target.value)}
                            className="w-full px-3 py-2 border border-border rounded-md text-sm text-navy focus:outline-none focus:border-accent"
                          />
                        ) : (
                          <div className="text-navy font-medium text-sm">
                            {record?.checkOutAt
                              ? new Date(record.checkOutAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : record?.flags.includes('MISSING_CHECK_OUT')
                              ? 'Missing Check Out (In Progress)'
                              : '—'}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Mandatory Reason for HR create / correction */}
                  {isEditing && (
                    <div>
                      <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">
                        Correction / Creation Reason *
                      </label>
                      <textarea
                        rows={3}
                        value={formReason}
                        onChange={(e) => setFormReason(e.target.value)}
                        placeholder="Explain the reason for this manual record or correction (min 5 characters)..."
                        className="w-full px-3 py-2 border border-border rounded-md text-xs text-navy focus:outline-none focus:border-accent"
                        required
                      />
                      <p className="text-[10px] text-muted mt-1">
                        Recorded permanently in the transactional AuditLog.
                      </p>
                    </div>
                  )}
                </div>

                {/* Right Column: Schedule Expectation & Derived Outputs */}
                <div className="space-y-6">
                  {/* Department & Manager */}
                  <div>
                    <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">
                      Department & Manager
                    </label>
                    <div className="text-sm text-navy font-medium">
                      {record?.department?.name || '—'}
                    </div>
                    {record?.manager && (
                      <div className="text-xs text-muted">Manager: {record.manager.fullName}</div>
                    )}
                  </div>

                  {/* Working Schedule */}
                  <div>
                    <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">
                      Working Schedule Snapshot
                    </label>
                    <div className="text-sm font-semibold text-navy">
                      {record?.workingSchedule.name || 'Auto-resolved on creation'}
                    </div>
                    {record && (
                      <div className="text-xs text-muted mt-1">
                        Expected Net:{' '}
                        <span className="font-semibold text-navy">
                          {formatMinutesToHhMm(record.expectedMinutes)}
                        </span>{' '}
                        (Break: {record.expectedBreakMinutes}m)
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">
                      Status
                    </label>
                    <div className="text-sm font-semibold text-navy">
                      {record?.status || 'System-derived on save'}
                    </div>
                  </div>

                  {/* Worked Time & Overtime */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">
                        Worked Time
                      </label>
                      <div className="text-2xl font-bold text-navy tabular-nums">
                        {record ? formatMinutesToHhMm(record.workedMinutes) : '—'}
                      </div>
                      <span className="text-[10px] text-muted">System-derived</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">
                        Overtime
                      </label>
                      <div className="text-2xl font-bold text-accent tabular-nums">
                        {record ? `+${formatMinutesToHhMm(record.overtimeMinutes)}` : '—'}
                      </div>
                      <span className="text-[10px] text-muted">Excess over expected</span>
                    </div>
                  </div>

                  {/* Flags */}
                  {record && record.flags.length > 0 && (
                    <div>
                      <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">
                        Flags
                      </label>
                      <div className="flex items-center gap-2 flex-wrap">
                        {record.flags.map((flag) => (
                          <span
                            key={flag}
                            className="px-2.5 py-1 rounded-full text-xs font-semibold bg-surface border border-border text-navy"
                          >
                            {flag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Editor Metadata */}
                  {record?.manuallyEdited && (
                    <div className="p-3 bg-surface/50 border border-border rounded-lg text-xs text-slate space-y-1">
                      <div className="font-semibold text-navy flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-accent" />
                        <span>Manually Edited</span>
                      </div>
                      {record.lastEditedBy && <div>By: {record.lastEditedBy.email}</div>}
                      {record.lastEditedAt && (
                        <div>At: {new Date(record.lastEditedAt).toLocaleString()}</div>
                      )}
                      {record.lastEditReason && (
                        <div data-testid="last-edit-reason">Reason: {record.lastEditReason}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </form>

            {/* Invariant Note */}
            <div className="mt-10 p-4 border border-border rounded-lg bg-surface/30 text-xs text-slate flex items-start gap-3">
              <div className="w-1 h-5 bg-accent rounded-full shrink-0" />
              <p>
                Attendance timestamps and status are authoritative for payroll calculations.
                Modifications to Working Schedules after an attendance date will not alter
                historical schedule snapshots.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
