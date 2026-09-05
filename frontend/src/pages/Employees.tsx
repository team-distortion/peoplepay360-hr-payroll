import { useSearchParams, useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import EmployeesToolbar from '../components/employees/EmployeesToolbar';
import EmployeeKanban from '../components/employees/EmployeeKanban';
import EmployeeList from '../components/employees/EmployeeList';
import { useEmployees } from '../features/employees/employees.queries';
import type { EmployeeType, RecordStatus } from '@peoplepay360/shared';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function EmployeesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Read URL query params
  const view = (searchParams.get('view') as 'kanban' | 'list') || 'kanban';
  const search = searchParams.get('search') || '';
  const status = (searchParams.get('status') as RecordStatus) || undefined;
  const employeeType = (searchParams.get('type') as EmployeeType) || undefined;
  const departmentId = searchParams.get('departmentId') || undefined;
  const sortBy =
    (searchParams.get('sortBy') as 'name' | 'employeeNumber' | 'createdAt') ||
    'name';
  const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc';
  const page = parseInt(searchParams.get('page') || '1', 10);

  // Helper to update searchParams
  const updateParams = (updates: Record<string, string | undefined>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, val]) => {
        if (val === undefined || val === '') {
          next.delete(key);
        } else {
          next.set(key, val);
        }
      });
      return next;
    });
  };

  const { data, isLoading, isError, error, refetch } = useEmployees({
    search: search || undefined,
    status,
    employeeType,
    departmentId,
    sortBy,
    sortOrder,
    page,
    pageSize: 50,
  });

  const employees = data?.items || [];

  const handleOpenProfile = (id: string) => {
    navigate(`/employees/${id}`);
  };

  const handleNew = () => {
    navigate('/employees/new');
  };

  const handleSort = (column: 'name' | 'employeeNumber' | 'createdAt') => {
    if (sortBy === column) {
      updateParams({ sortOrder: sortOrder === 'asc' ? 'desc' : 'asc' });
    } else {
      updateParams({ sortBy: column, sortOrder: 'asc' });
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-surface/30">
        <EmployeesToolbar
          onNew={handleNew}
          searchQuery={search}
          setSearchQuery={(query) => updateParams({ search: query, page: '1' })}
          view={view}
          setView={(newView) => updateParams({ view: newView })}
          statusFilter={status}
          setStatusFilter={(newStatus) => updateParams({ status: newStatus, page: '1' })}
          departmentFilter={departmentId}
          setDepartmentFilter={(deptId) => updateParams({ departmentId: deptId, page: '1' })}
          typeFilter={employeeType}
          setTypeFilter={(type) => updateParams({ type, page: '1' })}
        />

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex flex-col items-center justify-center p-16 gap-3">
              <div className="w-8 h-8 border-3 border-accent border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium text-slate">Loading employees...</span>
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center justify-center p-16 text-center max-w-md mx-auto">
              <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
              <h3 className="text-lg font-semibold text-navy mb-1">Failed to load employees</h3>
              <p className="text-sm text-slate mb-4">
                {error instanceof Error ? error.message : 'An unexpected error occurred.'}
              </p>
              <button
                onClick={() => refetch()}
                className="flex items-center gap-2 px-4 py-2 bg-accent text-white text-xs font-semibold rounded-lg hover:bg-accent/90 transition-colors shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            </div>
          )}

          {!isLoading && !isError && employees.length === 0 && (
            <div className="flex flex-col items-center justify-center p-16 text-center max-w-md mx-auto">
              <div className="w-14 h-14 bg-surface rounded-full flex items-center justify-center text-mutedText mb-3 border border-border">
                👥
              </div>
              <h3 className="text-lg font-semibold text-navy mb-1">No employees found</h3>
              <p className="text-sm text-slate mb-5">
                {search || status || departmentId || employeeType
                  ? 'No employees match your current search and filter criteria.'
                  : 'Get started by creating your first employee in the system.'}
              </p>
              <button
                onClick={handleNew}
                className="px-4 py-2 bg-accent text-white text-xs font-semibold rounded-lg hover:bg-accent/90 transition-colors shadow-sm uppercase tracking-wider"
              >
                Create Employee
              </button>
            </div>
          )}

          {!isLoading && !isError && employees.length > 0 && (
            <>
              {view === 'kanban' ? (
                <EmployeeKanban
                  employees={employees}
                  onSelectEmployee={handleOpenProfile}
                />
              ) : (
                <EmployeeList
                  employees={employees}
                  onSelectEmployee={handleOpenProfile}
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                />
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
