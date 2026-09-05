import React from 'react';
import { Employee } from '../../pages/Employees';

interface EmployeeListProps {
  employees: Employee[];
  onOpenProfile: (employee: Employee) => void;
}

export default function EmployeeList({ employees, onOpenProfile }: EmployeeListProps) {
  return (
    <div className="p-8 animate-in fade-in duration-300">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-semibold text-navy">Employees</h1>
        <p className="text-sm text-mutedText mt-1">List view for sort, filter and bulk scanning</p>
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-surface/50 text-slate border-b border-border">
              <tr>
                <th className="px-6 py-3 font-medium">Employee</th>
                <th className="px-6 py-3 font-medium">Work Email</th>
                <th className="px-6 py-3 font-medium">Job Position</th>
                <th className="px-6 py-3 font-medium">Department</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {employees.map((employee, idx) => (
                <tr
                  key={employee.id}
                  onClick={() => onOpenProfile(employee)}
                  className="hover:bg-surface/50 cursor-pointer transition-colors duration-100 animate-in fade-in slide-in-from-bottom-1"
                  style={{ animationDelay: `${idx * 30}ms`, animationFillMode: 'both' }}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent font-medium text-xs">
                        {employee.name.split(' ').map((n) => n[0]).join('')}
                      </div>
                      <span className="font-medium text-navy">{employee.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate">{employee.email}</td>
                  <td className="px-6 py-4 text-slate">{employee.jobTitle}</td>
                  <td className="px-6 py-4 text-slate">{employee.department}</td>
                  <td className="px-6 py-4">
                    <span className={employee.status === 'Active' ? 'text-green-600 font-medium' : 'text-slate-500'}>
                      {employee.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
