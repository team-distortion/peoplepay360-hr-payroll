import { Employee } from '../../pages/Employees';

interface EmployeeKanbanProps {
  employees: Employee[];
  onOpenProfile: (employee: Employee) => void;
}

export default function EmployeeKanban({ employees, onOpenProfile }: EmployeeKanbanProps) {
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
            onClick={() => onOpenProfile(employee)}
            className="group cursor-pointer bg-white border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-150 ease-out hover:-translate-y-0.5"
            style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}
            // Apply stagger animation
            ref={(el) => {
               if (el) {
                 el.classList.add('animate-in', 'fade-in', 'slide-in-from-bottom-2');
               }
            }}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent font-medium text-lg flex-shrink-0">
                {employee.name.split(' ').map((n) => n[0]).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-navy truncate">{employee.name}</h3>
                <p className="text-sm text-slate truncate">{employee.jobTitle}</p>
                <p className="text-xs text-mutedText mt-0.5 truncate">{employee.department}</p>
                
                <div className="mt-4 flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${employee.status === 'Active' ? 'bg-green-500' : 'bg-slate-400'}`} />
                  <span className="text-xs font-medium text-slate">{employee.status}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
