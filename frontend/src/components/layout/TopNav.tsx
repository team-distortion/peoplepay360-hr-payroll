import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Bell, LogOut } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import AttendanceWidget from '../attendance/AttendanceWidget';

const Dropdown = ({ label, items, active }: { label: string; items: { label: string; path: string }[]; active: boolean }) => {
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
                active && item.label === label
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
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const isDashboardActive = location.pathname === '/dashboard';
  const isEmployeesActive = location.pathname.startsWith('/employees');
  const isSchedulesActive = location.pathname.startsWith('/schedules');
  const isContractsActive = location.pathname.startsWith('/contracts');
  const isAttendanceActive = location.pathname.startsWith('/attendance');
  const isTimeOffActive = location.pathname.startsWith('/time-off');
  const isPayrollActive = location.pathname.startsWith('/payroll') || isDashboardActive;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-white px-6 h-14 flex items-center justify-between">
      <div className="flex items-center gap-6">
        {/* Logo Mark */}
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-navy rounded-md flex items-center justify-center">
            <span className="text-white font-bold text-sm">HR</span>
          </div>
          <span className="font-display font-bold text-navy hidden sm:inline text-lg">
            PeoplePay360
          </span>
        </Link>

        {/* Navigation Links */}
        <nav className="flex items-center gap-1">
          {user?.role !== 'EMPLOYEE' && (
            <Link
              to="/dashboard"
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                isDashboardActive ? 'bg-surface text-navy' : 'text-slate hover:bg-surface/50 hover:text-navy'
              }`}
            >
              Dashboard
            </Link>
          )}
          <Dropdown
            label="Employees"
            active={isEmployeesActive || isSchedulesActive}
            items={[
              {
                label: 'Employees',
                path:
                  user?.role === 'EMPLOYEE'
                    ? user?.employeeId
                      ? `/employees/${user.employeeId}`
                      : '/employees/me'
                    : '/employees',
              },
              { label: 'Contracts', path: '/contracts' },
              { label: 'Departments', path: '/departments' },
              { label: 'Working Schedule', path: '/schedules' },
            ]}
          />
          <Dropdown
            label="Contracts"
            active={isContractsActive}
            items={[{ label: 'All Contracts', path: '/contracts' }]}
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
          {(user?.role === 'ADMIN' ||
            user?.role === 'HR_PAYROLL_MANAGER' ||
            user?.role === 'HR_PAYROLL_USER') && (
            <Dropdown
              label="Payroll"
              active={isPayrollActive}
              items={[
                { label: 'Payroll Dashboard', path: '/dashboard' },
                { label: 'Salary Structures', path: '/payroll/structures' },
                { label: 'Salary Rules', path: '/payroll/rules' },
                { label: 'Pay Runs', path: '/payroll/payruns' },
                { label: 'Payslips', path: '/payroll/payslips' },
              ]}
            />
          )}
          {user?.role === 'ADMIN' && (
            <Link
              to="/admin/users"
              className="px-3 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
            >
              Admin Users
            </Link>
          )}
        </nav>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <AttendanceWidget />
        <button className="relative p-2 text-slate hover:bg-surface rounded-full transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
        </button>

        {/* User Profile & Role Badge */}
        {user && (
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface border border-transparent hover:border-border transition-colors"
            >
              <div className="w-7 h-7 bg-navy/10 text-navy rounded-full flex items-center justify-center font-bold text-xs">
                {user.email.charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:flex flex-col items-start text-xs">
                <span className="font-semibold text-navy max-w-[120px] truncate">{user.email}</span>
                <span className="text-[10px] uppercase font-bold text-accent tracking-wider">
                  {user.role}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate" />
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-border py-2 z-50">
                <div className="px-4 py-2 border-b border-border">
                  <p className="text-xs text-slate">Signed in as</p>
                  <p className="text-sm font-medium text-navy truncate">{user.email}</p>
                  <span className="inline-block mt-1 text-[10px] font-bold uppercase px-2 py-0.5 bg-accent/10 text-accent rounded">
                    {user.role}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
