import type { EmployeeListItemDto } from '@peoplepay360/shared';

interface EmployeeKanbanProps {
  employees: EmployeeListItemDto[];
  onSelectEmployee: (id: string) => void;
}

export default function EmployeeKanban({
  employees,
  onSelectEmployee,
}: EmployeeKanbanProps) {
  return (
    <div className="p-8 animate-in fade-in duration-300">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-semibold text-navy">Employees</h1>
        <p className="text-sm text-mutedText mt-1">Default view: Kanban</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {employees.map((employee, idx) => (
          <div
            key={employee.id}
            onClick={() => onSelectEmployee(employee.id)}
            className="group cursor-pointer bg-white border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-150 ease-out hover:-translate-y-0.5"
            style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'both' }}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent font-semibold text-base flex-shrink-0 tracking-wider">
                {employee.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-navy truncate text-base group-hover:text-accent transition-colors">
                    {employee.fullName}
                  </h3>
                  <span className="text-[10px] uppercase font-bold text-slate bg-surface px-1.5 py-0.5 rounded border border-border flex-shrink-0">
                    {employee.employeeType.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-slate truncate mt-0.5">{employee.jobPosition}</p>
                <p className="text-xs text-mutedText mt-0.5 truncate">
                  {employee.department?.name || 'No Department'}
                </p>

                {employee.manager && (
                  <p className="text-[11px] text-mutedText/80 mt-1 truncate">
                    Reports to: <span className="text-slate font-medium">{employee.manager.fullName}</span>
                  </p>
                )}

                <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        employee.status === 'ACTIVE' ? 'bg-green-500' : 'bg-slate-400'
                      }`}
                    />
                    <span className="text-xs font-medium text-slate">
                      {employee.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <span className="text-[11px] text-mutedText font-mono">
                    {employee.employeeNumber}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
