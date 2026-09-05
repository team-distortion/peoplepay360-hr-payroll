import { useState, useRef, useEffect } from 'react';
import { Clock, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  useAttendanceToday,
  useCheckInMutation,
  useCheckOutMutation,
} from '@/features/attendance/attendance.queries';

function formatMinutesToHhMm(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

export default function AttendanceWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localElapsedMinutes, setLocalElapsedMinutes] = useState<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const isLinked = Boolean(user?.employeeId);

  const {
    data: todayData,
    isLoading,
    error: queryError,
    refetch,
  } = useAttendanceToday(isLinked);

  const checkInMutation = useCheckInMutation();
  const checkOutMutation = useCheckOutMutation();

  const isPending = checkInMutation.isPending || checkOutMutation.isPending;

  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setErrorMessage(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Refetch when dropdown opens
  useEffect(() => {
    if (isOpen && isLinked) {
      refetch();
    }
  }, [isOpen, isLinked, refetch]);

  // Advance elapsed timer locally from server baseline when checked in
  useEffect(() => {
    if (!todayData || todayData.state !== 'CHECKED_IN') {
      setLocalElapsedMinutes(todayData?.elapsedMinutes ?? 0);
      return;
    }

    const baselineElapsed = todayData.elapsedMinutes;
    const serverBaselineTime = new Date(todayData.serverNow).getTime();
    setLocalElapsedMinutes(baselineElapsed);

    const interval = window.setInterval(() => {
      const nowTime = Date.now();
      const diffMinutes = Math.floor((nowTime - serverBaselineTime) / 60000);
      setLocalElapsedMinutes(Math.max(0, baselineElapsed + diffMinutes));
    }, 30000); // Check every 30s

    return () => clearInterval(interval);
  }, [todayData]);

  const handleCheckIn = async () => {
    setErrorMessage(null);
    try {
      await checkInMutation.mutateAsync();
      setIsOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Check-in failed. Please retry.');
    }
  };

  const handleCheckOut = async () => {
    setErrorMessage(null);
    try {
      await checkOutMutation.mutateAsync();
      setIsOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Check-out failed. Please retry.');
    }
  };

  // Indicator color
  const isCheckedIn = todayData?.state === 'CHECKED_IN';
  const statusColor = isCheckedIn
    ? 'bg-emerald-500 ring-2 ring-emerald-300'
    : 'bg-slate-300';

  // Format punch times for display
  const checkInDisplay = todayData?.attendance?.checkInAt
    ? new Date(todayData.attendance.checkInAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const checkOutDisplay = todayData?.attendance?.checkOutAt
    ? new Date(todayData.attendance.checkOutAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate hover:bg-surface rounded-full transition-colors flex items-center justify-center focus:outline-none"
        title="Attendance Quick Punch"
      >
        <Clock className="w-5 h-5 transition-transform hover:scale-105 duration-100" />
        <span
          className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full border border-white transition-colors duration-250 ${statusColor}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-border overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
          {/* Header */}
          <div className="px-5 py-4 border-b border-border bg-surface/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-navy uppercase tracking-wider">
                Attendance Widget
              </span>
              <div className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${statusColor}`} />
                <span className="text-xs font-semibold text-slate">
                  {isCheckedIn ? 'Active' : 'Offline'}
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted">Signed in as</p>
              <h3 className="text-base font-bold text-navy truncate">{user?.email}</h3>
              {todayData?.businessDate && (
                <p className="text-[11px] text-slate/80 font-mono mt-0.5">
                  Business Date: {todayData.businessDate}
                </p>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-3">
            {!isLinked ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  Your account is not linked to an employee profile. Punching attendance requires a linked employee profile.
                </p>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-6 gap-2 text-slate text-sm">
                <Loader2 className="w-4 h-4 animate-spin text-accent" />
                <span>Loading attendance...</span>
              </div>
            ) : queryError ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start justify-between gap-2">
                <p>{(queryError as Error).message || 'Failed to load status'}</p>
                <button
                  onClick={() => refetch()}
                  className="text-accent underline font-semibold shrink-0"
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm py-1 border-b border-slate-100">
                  <span className="text-slate text-xs font-medium">Session</span>
                  <span className="text-xs font-semibold text-navy">
                    {isCheckedIn && checkInDisplay
                      ? `${checkInDisplay} — Running`
                      : todayData?.state === 'CHECKED_OUT' && checkInDisplay && checkOutDisplay
                      ? `${checkInDisplay} — ${checkOutDisplay}`
                      : todayData?.state === 'ABSENT'
                      ? 'Marked Absent'
                      : 'Not checked in'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm py-1 border-b border-slate-100">
                  <span className="text-slate text-xs font-medium">
                    {isCheckedIn ? 'Elapsed Time' : 'Worked Time'}
                  </span>
                  <span className="text-sm font-bold text-navy tabular-nums">
                    {isCheckedIn
                      ? formatMinutesToHhMm(localElapsedMinutes)
                      : todayData?.attendance
                      ? formatMinutesToHhMm(todayData.attendance.workedMinutes)
                      : '0h00'}
                  </span>
                </div>

                {todayData?.attendance && todayData.attendance.overtimeMinutes > 0 && (
                  <div className="flex items-center justify-between text-sm py-1 border-b border-slate-100">
                    <span className="text-slate text-xs font-medium">Overtime</span>
                    <span className="text-xs font-bold text-accent tabular-nums">
                      +{formatMinutesToHhMm(todayData.attendance.overtimeMinutes)}
                    </span>
                  </div>
                )}
              </>
            )}

            {errorMessage && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                {errorMessage}
              </div>
            )}
          </div>

          {/* Action Footer */}
          {isLinked && todayData && (
            <div className="px-5 pb-4">
              {todayData.state === 'NOT_CHECKED_IN' && (
                <button
                  onClick={handleCheckIn}
                  disabled={isPending}
                  className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm text-white bg-accent hover:bg-accent/90 transition-all duration-150 shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Check In</span>
                  )}
                </button>
              )}

              {todayData.state === 'CHECKED_IN' && (
                <button
                  onClick={handleCheckOut}
                  disabled={isPending}
                  className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm text-white bg-navy hover:bg-navy/90 transition-all duration-150 shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Check Out</span>
                  )}
                </button>
              )}

              {todayData.state === 'CHECKED_OUT' && (
                <div className="w-full py-2 px-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs font-semibold flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Attendance completed for today</span>
                </div>
              )}

              {todayData.state === 'ABSENT' && (
                <div className="w-full py-2 px-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center justify-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  <span>Marked absent by HR for today</span>
                </div>
              )}
            </div>
          )}

          <div className="px-5 py-2.5 bg-surface/40 border-t border-border">
            <p className="text-[10px] text-muted leading-tight">
              Punches use server clock. Worked hours & overtime are calculated against your schedule.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
