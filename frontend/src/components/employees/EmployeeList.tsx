import type { EmployeeListItemDto } from '@peoplepay360/shared';
import { ArrowUpDown } from 'lucide-react';

interface EmployeeListProps {
  employees: EmployeeListItemDto[];
  onSelectEmployee: (id: string) => void;
  sortBy?: 'name' | 'employeeNumber' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  onSort?: (column: 'name' | 'employeeNumber' | 'createdAt') => void;
}

export default function EmployeeList({
  employees,
  onSelectEmployee,
  sortBy,
  sortOrder,
  onSort,
}: EmployeeListProps) {
  return (
    <div className="p-8 animate-in fade-in duration-300">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-semibold text-navy">Employees</h1>
        <p className="text-sm text-mutedText mt-1">List view for sort, filter and bulk scanning</p>
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-surface/50 text-slate border-b border-border text-xs uppercase tracking-wider">
              <tr>
                <th
                  className="px-6 py-3.5 font-medium cursor-pointer hover:text-navy transition-colors select-none"
                  onClick={() => onSort?.('name')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Employee</span>
                    <ArrowUpDown className={`w-3 h-3 ${sortBy === 'name' ? 'text-accent' : 'text-mutedText'}`} />
                    {sortBy === 'name' && (
                      <span className="text-[10px] text-accent font-bold">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3.5 font-medium cursor-pointer hover:text-navy transition-colors select-none"
                  onClick={() => onSort?.('employeeNumber')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Number</span>
                    <ArrowUpDown className={`w-3 h-3 ${sortBy === 'employeeNumber' ? 'text-accent' : 'text-mutedText'}`} />
                    {sortBy === 'employeeNumber' && (
                      <span className="text-[10px] text-accent font-bold">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3.5 font-medium">Work Email</th>
                <th className="px-6 py-3.5 font-medium">Job Position</th>
                <th className="px-6 py-3.5 font-medium">Department</th>
                <th className="px-6 py-3.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {employees.map((employee, idx) => (
                <tr
                  key={employee.id}
                  onClick={() => onSelectEmployee(employee.id)}
                  className="hover:bg-surface/50 cursor-pointer transition-colors duration-100"
                  style={{ animationDelay: `${idx * 25}ms`, animationFillMode: 'both' }}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent font-semibold text-xs tracking-wider flex-shrink-0">
                        {employee.initials}
                      </div>
                      <div>
                        <span className="font-medium text-navy block hover:text-accent transition-colors">
                          {employee.fullName}
                        </span>
                        <span className="text-[11px] text-mutedText">
                          {employee.employeeType.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate">
                    {employee.employeeNumber}
                  </td>
                  <td className="px-6 py-4 text-slate">{employee.workEmail}</td>
                  <td className="px-6 py-4 text-slate">{employee.jobPosition}</td>
                  <td className="px-6 py-4 text-slate">
                    {employee.department?.name || '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={
                        employee.status === 'ACTIVE'
                          ? 'text-green-600 font-medium'
                          : 'text-slate-400 font-medium'
                      }
                    >
                      {employee.status === 'ACTIVE' ? 'Active' : 'Inactive'}
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
