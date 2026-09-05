import { useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { useAuth } from '../context/AuthContext';
import { useContracts, useSalaryStructuresSelector } from '../features/contracts/contracts.queries';
import { useDepartments } from '../features/departments/departments.queries';
import { useEmployees } from '../features/employees/employees.queries';
import type { ContractSortField, ContractStatus } from '@peoplepay360/shared';
import {
  Search,
  Plus,
  Loader2,
  AlertCircle,
  FileText,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export default function ContractsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const canCreate =
    user?.role === 'ADMIN' ||
    user?.role === 'HR_MANAGER' ||
    user?.role === 'HR_PAYROLL_USER' ||
    user?.role === 'HR_PAYROLL_MANAGER';

  // Read URL parameters
  const searchQuery = searchParams.get('search') || '';
  const employeeId = searchParams.get('employeeId') || '';
  const departmentId = searchParams.get('departmentId') || '';
  const salaryStructureId = searchParams.get('salaryStructureId') || '';
  const statusParam = (searchParams.get('status') as ContractStatus) || undefined;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
  const sort = (searchParams.get('sort') as ContractSortField) || 'startDate';
  const order = (searchParams.get('order') as 'asc' | 'desc') || 'desc';

  // Supporting queries for filters and labels
  const { data: departments = [] } = useDepartments();
  const { data: structures = [] } = useSalaryStructuresSelector();
  const { data: employeesData } = useEmployees({ pageSize: 100 });

  // Main contracts query
  const {
    data: contractsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useContracts({
    search: searchQuery || undefined,
    employeeId: employeeId || undefined,
    departmentId: departmentId || undefined,
    salaryStructureId: salaryStructureId || undefined,
    status: statusParam || undefined,
    page,
    pageSize,
    sort,
    order,
  });

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value && value.trim().length > 0) {
      next.set(key, value.trim());
    } else {
      next.delete(key);
    }
    next.set('page', '1'); // reset to first page on filter change
    setSearchParams(next);
  };

  const handleClearEmployeeFilter = () => {
    updateParam('employeeId', null);
  };

  // Find linked employee name for chip
  const filteredEmployeeName = useMemo(() => {
    if (!employeeId) return null;
    const found = employeesData?.items.find((e) => e.id === employeeId);
    return found ? found.fullName : 'Filtered Employee';
  }, [employeeId, employeesData]);

  const formatCurrency = (wageStr: string, currency: string) => {
    const num = parseFloat(wageStr);
    if (isNaN(num)) return wageStr;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <AppLayout>
      <div className="flex flex-col flex-1 bg-surface/30">
        {/* Top Header & Toolbar */}
        <div className="px-8 py-5 border-b border-border bg-white sticky top-0 z-10 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-display font-bold text-navy">Contracts</h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-surface text-slate font-medium border border-border">
                  {contractsData?.pagination.totalItems ?? 0} total
                </span>
              </div>
              <p className="text-xs text-mutedText mt-0.5">
                List view of employee contracts with period-specific wage and terms
              </p>
            </div>

            {canCreate && (
              <button
                onClick={() => navigate('/contracts/new')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent/90 shadow-sm transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>NEW</span>
              </button>
            )}
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate pointer-events-none" />
              <input
                type="text"
                placeholder="Search by contract, employee, position..."
                value={searchQuery}
                onChange={(e) => updateParam('search', e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-surface/50 border border-border rounded-lg text-sm text-navy placeholder:text-mutedText focus:outline-none focus:ring-1 focus:ring-accent focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => updateParam('search', null)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate hover:text-navy"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Department Filter */}
            <select
              value={departmentId}
              onChange={(e) => updateParam('departmentId', e.target.value)}
              className="px-3 py-1.5 bg-white border border-border rounded-lg text-sm text-navy focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            {/* Salary Structure Filter */}
            <select
              value={salaryStructureId}
              onChange={(e) => updateParam('salaryStructureId', e.target.value)}
              className="px-3 py-1.5 bg-white border border-border rounded-lg text-sm text-navy focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">All Salary Structures</option>
              {structures.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusParam || ''}
              onChange={(e) => updateParam('status', e.target.value)}
              className="px-3 py-1.5 bg-white border border-border rounded-lg text-sm text-navy focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">All Statuses</option>
              <option value="RUNNING">Running</option>
              <option value="EXPIRED">Expired</option>
            </select>

            {/* Removable Employee Filter Chip */}
            {employeeId && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-accent/10 text-accent border border-accent/30 rounded-full text-xs font-medium animate-in fade-in">
                <span>Employee: {filteredEmployeeName}</span>
                <button
                  onClick={handleClearEmployeeFilter}
                  className="hover:bg-accent/20 rounded-full p-0.5 transition-colors"
                  title="Clear employee filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-8 flex-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
              <span className="text-sm font-medium text-slate">Loading contracts...</span>
            </div>
          ) : isError ? (
            <div className="max-w-md mx-auto my-12 p-6 bg-white border border-red-200 rounded-xl text-center">
              <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
              <h3 className="text-base font-semibold text-navy mb-1">Failed to load contracts</h3>
              <p className="text-sm text-slate mb-4">
                {error instanceof Error ? error.message : 'An error occurred while fetching contracts'}
              </p>
              <button
                onClick={() => refetch()}
                className="px-4 py-1.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : contractsData?.items.length === 0 ? (
            <div className="bg-white rounded-xl border border-border p-12 text-center max-w-lg mx-auto my-8">
              <div className="w-12 h-12 rounded-full bg-surface border border-border flex items-center justify-center mx-auto mb-3 text-slate">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-navy mb-1">No contracts found</h3>
              <p className="text-sm text-slate mb-4">
                {searchQuery || employeeId || departmentId || statusParam
                  ? 'No contracts match your selected filters. Try clearing some filters.'
                  : 'Get started by creating the first employment contract.'}
              </p>
              {canCreate && !searchQuery && !employeeId && !departmentId && (
                <button
                  onClick={() => navigate('/contracts/new')}
                  className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Contract</span>
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-border shadow-xs overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface/40 text-xs font-semibold text-slate uppercase tracking-wider">
                    <th className="py-3 px-5">Contract</th>
                    <th className="py-3 px-5">Employee</th>
                    <th className="py-3 px-5">Start</th>
                    <th className="py-3 px-5">End</th>
                    <th className="py-3 px-5">Wage / Month</th>
                    <th className="py-3 px-5">Structure</th>
                    <th className="py-3 px-5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {contractsData?.items.map((contract) => (
                    <tr
                      key={contract.id}
                      onClick={() => navigate(`/contracts/${contract.id}`)}
                      className="hover:bg-surface/50 transition-colors cursor-pointer group text-sm"
                    >
                      <td className="py-3.5 px-5 font-semibold text-navy group-hover:text-accent transition-colors">
                        {contract.contractNumber}
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="font-medium text-navy">{contract.employee.fullName}</div>
                        <div className="text-xs text-mutedText">
                          {contract.employee.employeeNumber} • {contract.jobPosition}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-slate font-mono text-xs">
                        {contract.startDate}
                      </td>
                      <td className="py-3.5 px-5 text-slate font-mono text-xs">
                        {contract.endDate || '—'}
                      </td>
                      <td className="py-3.5 px-5 font-medium text-navy font-mono">
                        {formatCurrency(contract.monthlyWage, contract.currency)}
                      </td>
                      <td className="py-3.5 px-5 text-slate text-xs">
                        {contract.salaryStructure.name}
                      </td>
                      <td className="py-3.5 px-5">
                        {contract.status === 'RUNNING' ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 w-fit">
                              Running
                            </span>
                            {!contract.isEffectiveToday && (
                              <span className="text-[10px] text-mutedText">
                                Starts {contract.startDate}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 w-fit">
                            Expired
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination Bar */}
              {contractsData && contractsData.pagination.totalPages > 1 && (
                <div className="px-6 py-3.5 border-t border-border bg-surface/30 flex items-center justify-between text-xs text-slate">
                  <div>
                    Page <span className="font-semibold text-navy">{contractsData.pagination.page}</span> of{' '}
                    <span className="font-semibold text-navy">{contractsData.pagination.totalPages}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      disabled={contractsData.pagination.page <= 1}
                      onClick={() => updateParam('page', String(contractsData.pagination.page - 1))}
                      className="px-3 py-1.5 bg-white border border-border rounded-md hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center gap-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Previous</span>
                    </button>
                    <button
                      disabled={contractsData.pagination.page >= contractsData.pagination.totalPages}
                      onClick={() => updateParam('page', String(contractsData.pagination.page + 1))}
                      className="px-3 py-1.5 bg-white border border-border rounded-md hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center gap-1"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
