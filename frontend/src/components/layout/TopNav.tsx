import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Bell } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import AttendanceWidget from '../attendance/AttendanceWidget';

const Dropdown = ({ label, items, active, defaultPath }: { label: string, items: {label: string, path: string}[], active: boolean, defaultPath?: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
          active ? 'bg-surface text-navy' : 'text-slate hover:bg-surface/50 hover:text-navy'
        }`}
      >
        {label}
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-border py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {items.map((item) => (
            <Link
              key={item.label}
              to={item.path}
              onClick={() => setIsOpen(false)}
              className={`block px-4 py-2 text-sm ${
                active && item.label === label // Mocking active state for submenu
                  ? 'bg-accent/10 text-accent font-medium'
                  : 'text-slate hover:bg-surface hover:text-navy'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default function TopNav() {
  const location = useLocation();

  const isEmployeesActive = location.pathname.startsWith('/employees');
  const isSchedulesActive = location.pathname.startsWith('/schedules');
  const isContractsActive = location.pathname.startsWith('/contracts');
  const isAttendanceActive = location.pathname.startsWith('/attendance');
  const isTimeOffActive = location.pathname.startsWith('/time-off');

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-white px-6 h-14 flex items-center justify-between">
      <div className="flex items-center gap-6">
        {/* Logo Mark */}
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-navy rounded-md flex items-center justify-center">
            <span className="text-white font-bold text-sm">HR</span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="flex items-center gap-1">
          <Dropdown
            label="Employees"
            active={isEmployeesActive || isSchedulesActive}
            items={[
              { label: 'Employees', path: '/employees' },
              { label: 'Contracts', path: '/contracts' },
              { label: 'Departments', path: '#' },
              { label: 'Working Schedule', path: '/schedules' },
            ]}
          />
          <Dropdown
            label="Contracts"
            active={isContractsActive}
            items={[
              { label: 'All Contracts', path: '/contracts' },
            ]}
          />
          <Link
            to="/attendance"
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              isAttendanceActive ? 'bg-surface text-navy' : 'text-slate hover:bg-surface/50 hover:text-navy'
            }`}
          >
            Attendance
          </Link>
          <Dropdown
            label="Time Off"
            active={isTimeOffActive}
            items={[
              { label: 'Dashboard', path: '/time-off' },
              { label: 'Time offs', path: '/time-off/requests' },
              { label: 'Time off Types', path: '/time-off/types' },
              { label: 'Allocations', path: '/time-off/allocations' },
            ]}
          />
          <Link
            to="#"
            className="px-3 py-2 text-sm font-medium text-slate hover:bg-surface/50 hover:text-navy rounded-md transition-colors"
          >
            Payroll
          </Link>
        </nav>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        <AttendanceWidget />
        <button className="relative p-2 text-slate hover:bg-surface rounded-full transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
        </button>
      </div>
    </header>
  );
}
