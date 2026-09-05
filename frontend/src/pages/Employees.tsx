import { useState, useMemo } from 'react';
import AppLayout from '../components/layout/AppLayout';
import EmployeesToolbar from '../components/employees/EmployeesToolbar';
import EmployeeKanban from '../components/employees/EmployeeKanban';
import EmployeeList from '../components/employees/EmployeeList';
import EmployeeProfile from '../components/employees/EmployeeProfile';

export interface Employee {
  id: string;
  name: string;
  jobTitle: string;
  department: string;
  status: string;
  email: string;
  phone: string;
  manager: string;
  workLocation: string;
  schedule: string;
  company: string;
}

const mockEmployees: Employee[] = [
  {
    id: '1',
    name: 'Aarav Mehta',
    jobTitle: 'Payroll Specialist',
    department: 'Finance',
    status: 'Active',
    email: 'aarav@oxp.com',
    phone: '+91 98765 43210',
    manager: 'Sara Khan',
    workLocation: 'Mumbai',
    schedule: '40 Hours / Week',
    company: 'OXP Pvt Ltd'
  },
  {
    id: '2',
    name: 'Sara Khan',
    jobTitle: 'HR Officer',
    department: 'HR',
    status: 'Active',
    email: 'sara@oxp.com',
    phone: '+91 98765 43211',
    manager: 'John Dsouza',
    workLocation: 'Mumbai',
    schedule: '40 Hours / Week',
    company: 'OXP Pvt Ltd'
  },
  {
    id: '3',
    name: 'John Dsouza',
    jobTitle: 'Developer',
    department: 'Engineering',
    status: 'Active',
    email: 'john@oxp.com',
    phone: '+91 98765 43212',
    manager: 'Tech Lead',
    workLocation: 'Remote',
    schedule: '40 Hours / Week',
    company: 'OXP Pvt Ltd'
  },
  {
    id: '4',
    name: 'Neha Patel',
    jobTitle: 'Recruiter',
    department: 'HR',
    status: 'On Leave',
    email: 'neha@oxp.com',
    phone: '+91 98765 43213',
    manager: 'Sara Khan',
    workLocation: 'Mumbai',
    schedule: '40 Hours / Week',
    company: 'OXP Pvt Ltd'
  }
];

export default function EmployeesPage() {
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null | undefined>(undefined);
  
  // undefined = Profile closed (showing Kanban/List)
  // null = Profile open in Create mode
  // Employee = Profile open in Edit/View mode

  const filteredEmployees = useMemo(() => {
    return mockEmployees.filter(emp => 
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.jobTitle.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const handleOpenProfile = (employee: Employee | null) => {
    setSelectedEmployee(employee);
  };

  const handleCloseProfile = () => {
    setSelectedEmployee(undefined);
  };

  return (
    <AppLayout>
      {selectedEmployee !== undefined ? (
        <EmployeeProfile employee={selectedEmployee} onClose={handleCloseProfile} />
      ) : (
        <div className="flex flex-col flex-1 bg-surface/30">
          <EmployeesToolbar 
            onNew={() => handleOpenProfile(null)}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            view={view}
            setView={setView}
          />
          {view === 'kanban' ? (
            <EmployeeKanban employees={filteredEmployees} onOpenProfile={handleOpenProfile} />
          ) : (
            <EmployeeList employees={filteredEmployees} onOpenProfile={handleOpenProfile} />
          )}
        </div>
      )}
    </AppLayout>
  );
}
