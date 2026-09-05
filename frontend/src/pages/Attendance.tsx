import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import AttendanceToolbar from '../components/attendance/AttendanceToolbar';
import AttendanceListTable, { AttendanceRecord } from '../components/attendance/AttendanceListTable';

export const mockAttendanceRecords: AttendanceRecord[] = [
  { id: '1', employeeName: 'Aarav Mehta', date: '02-Sep-2026', checkIn: '09:05', checkOut: '18:10', workedHours: 9.08, status: 'Present', department: 'Finance', manager: 'Sara Khan', overtime: 1.08 },
  { id: '2', employeeName: 'Sara Khan', date: '02-Sep-2026', checkIn: '09:15', checkOut: '18:02', workedHours: 8.78, status: 'Present', department: 'HR', manager: 'John Dsouza', overtime: 0.78 },
  { id: '3', employeeName: 'John Dsouza', date: '02-Sep-2026', checkIn: '09:32', checkOut: '17:58', workedHours: 8.43, status: 'Present', department: 'Engineering', manager: 'Tech Lead', overtime: 0.43 },
  { id: '4', employeeName: 'Neha Patel', date: '02-Sep-2026', checkIn: null, checkOut: null, workedHours: 0.00, status: 'Absent', department: 'HR', manager: 'Sara Khan', overtime: 0 },
  { id: '5', employeeName: 'Aarav Mehta', date: '01-Sep-2026', checkIn: '09:30', checkOut: null, workedHours: 4.5, status: 'Half Day', department: 'Finance', manager: 'Sara Khan', overtime: 0 },
  { id: '6', employeeName: 'Neha Patel', date: '01-Sep-2026', checkIn: null, checkOut: null, workedHours: 0.00, status: 'On Leave', department: 'HR', manager: 'Sara Khan', overtime: 0 },
];

export default function AttendancePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<string[]>([]);
  const navigate = useNavigate();
  const location = useLocation();

  // If navigated from employee profile, it might pass state
  useEffect(() => {
    if (location.state && location.state.employeeName) {
      const empFilter = `Employee: ${location.state.employeeName}`;
      if (!filters.includes(empFilter)) {
        setFilters(prev => [...prev, empFilter]);
      }
    }
  }, [location.state]);

  const handleRemoveFilter = (filterToRemove: string) => {
    setFilters(filters.filter(f => f !== filterToRemove));
  };

  const filteredRecords = useMemo(() => {
    return mockAttendanceRecords.filter(record => {
      // Apply Search
      const matchesSearch = record.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            record.status.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // Apply Filters
      for (const filter of filters) {
        if (filter.startsWith('Employee: ')) {
          const empName = filter.replace('Employee: ', '');
          if (record.employeeName !== empName) return false;
        }
        if (filter === 'Today') {
          if (record.date !== '02-Sep-2026') return false; // mock today
        }
      }
      return true;
    });
  }, [searchQuery, filters]);

  return (
    <AppLayout>
      <div className="flex flex-col flex-1 bg-surface/30">
        <div className="px-6 py-8 pb-4">
          <h1 className="text-2xl font-bold text-navy">Attendance</h1>
          <p className="text-slate text-sm">List view of employee attendance records</p>
        </div>
        <AttendanceToolbar
          onNew={() => navigate('/attendance/new')}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filters={filters}
          onRemoveFilter={handleRemoveFilter}
        />
        <div className="flex-1">
          <AttendanceListTable records={filteredRecords} />
        </div>
      </div>
    </AppLayout>
  );
}
