import { useState, useRef, useEffect } from 'react';
import { Clock } from 'lucide-react';

export default function AttendanceWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);
  const [elapsedString, setElapsedString] = useState('0h00');
  const [totalToday, setTotalToday] = useState('0h00');

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update elapsed time every minute if checked in
  useEffect(() => {
    let interval: number;
    if (isCheckedIn && checkInTime) {
      const updateElapsed = () => {
        const now = new Date();
        const diffMs = now.getTime() - checkInTime.getTime();
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const formatted = `${diffHrs}h${diffMins.toString().padStart(2, '0')}`;
        setElapsedString(formatted);
        setTotalToday(formatted); // Simplifying for mock: total today = this session
      };
      
      updateElapsed(); // initial call
      interval = window.setInterval(updateElapsed, 60000);
    } else {
      setElapsedString('0h00');
    }
    return () => clearInterval(interval);
  }, [isCheckedIn, checkInTime]);

  const handleAction = () => {
    if (isCheckedIn) {
      setIsCheckedIn(false);
      setCheckInTime(null);
    } else {
      setIsCheckedIn(true);
      setCheckInTime(new Date());
    }
    // Spec: "whether closed by clicking outside, the icon again, or after a successful action."
    setIsOpen(false);
  };

  const statusColor = isCheckedIn ? 'bg-green-500' : 'bg-red-500';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate hover:bg-surface rounded-full transition-colors flex items-center justify-center"
      >
        <Clock className="w-5 h-5 transition-transform hover:scale-105 duration-100" />
        <span className={`absolute top-2 right-2 w-2 h-2 rounded-full border border-white transition-colors duration-250 ${statusColor}`}></span>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-border overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
          
          {/* Header */}
          <div className="px-5 py-4 border-b border-border bg-surface/50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-navy uppercase tracking-wider">Attendance Widget</span>
              <span className={`w-2.5 h-2.5 rounded-full ${statusColor} shadow-sm transition-colors duration-250`}></span>
            </div>
            <div>
              <p className="text-sm text-muted">Welcome back</p>
              <h3 className="text-xl font-bold text-navy">Admin User!</h3>
            </div>
          </div>

          {/* Body */}
          <div className="px-5 py-5 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate">
                {isCheckedIn && checkInTime ? `${checkInTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} — Now` : 'Not checked in'}
              </span>
              <span className="font-semibold text-navy tabular-nums transition-opacity duration-150">{elapsedString}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate font-medium">Today</span>
              <span className="font-bold text-navy tabular-nums">{totalToday}</span>
            </div>
          </div>

          {/* Action */}
          <div className="px-5 pb-5">
            <button
              onClick={handleAction}
              className={`w-full py-2.5 px-4 rounded-xl font-medium text-white transition-all duration-150 active:scale-95 ${
                isCheckedIn ? 'bg-navy hover:bg-navy/90' : 'bg-accent hover:bg-accent/90'
              }`}
            >
              <span className="animate-in fade-in duration-150">
                {isCheckedIn ? 'Check Out' : 'Check In'}
              </span>
            </button>
          </div>
          
          <div className="px-5 py-3 bg-surface/30 border-t border-border">
            <p className="text-[11px] text-muted leading-tight">
              Employees can mark attendance from the quick widget and review records from the Attendance module.
            </p>
          </div>

        </div>
      )}
    </div>
  );
}
