import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Layers,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../context/AuthContext';
import { useSalaryStructures } from '../../features/salary-config/salary-config.queries';
import type { RecordStatus } from '@peoplepay360/shared';

export default function SalaryStructuresPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isManagerOrAdmin =
    user?.role === 'HR_PAYROLL_MANAGER' || user?.role === 'ADMIN';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RecordStatus | ''>('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const { data, isLoading, isError, error, refetch } = useSalaryStructures({
    search: search.trim() || undefined,
    status: statusFilter || undefined,
    page,
    pageSize,
  });

  return (
    <AppLayout>
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-6 h-6 text-navy" />
              <h1 className="text-2xl font-display font-bold text-navy">
                Salary Structures
              </h1>
            </div>
            <p className="text-slate text-sm mt-1">
              Configure ordered rule sets, allowances, and statutory deductions for payroll.
            </p>
          </div>

          {isManagerOrAdmin && (
            <Link
              to="/payroll/structures/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              New Structure
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white border border-border rounded-xl p-4 shadow-sm mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
            <input
              type="text"
              placeholder="Search structures..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <label className="text-xs font-semibold text-slate uppercase tracking-wider">
              Status:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as RecordStatus | '');
                setPage(1);
              }}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-white text-navy focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>

            <button
              onClick={() => refetch()}
              className="p-2 border border-border rounded-lg text-slate hover:text-navy hover:bg-surface transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content State */}
        {isLoading ? (
          <div className="bg-white border border-border rounded-xl p-12 text-center shadow-sm">
            <RefreshCw className="w-8 h-8 text-accent animate-spin mx-auto mb-3" />
            <p className="text-slate text-sm font-medium">Loading salary structures...</p>
          </div>
        ) : isError ? (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-8 text-center">
            <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-3" />
            <p className="text-rose-800 font-semibold mb-1">Failed to load structures</p>
            <p className="text-rose-600 text-sm mb-4">
              {(error as any)?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        ) : !data?.items.length ? (
          <div className="bg-white border border-dashed border-border rounded-xl p-12 text-center shadow-sm">
            <FileSpreadsheet className="w-12 h-12 text-slate/40 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-navy mb-1">No Salary Structures Found</h3>
            <p className="text-slate text-sm max-w-md mx-auto mb-6">
              {search || statusFilter
                ? 'No salary structures matched your filter criteria.'
                : 'Get started by creating your first salary structure with ordered rules.'}
            </p>
            {isManagerOrAdmin && (
              <Link
                to="/payroll/structures/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-navy hover:bg-navy/90 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Salary Structure
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col justify-between">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface/50 text-slate font-semibold text-xs tracking-wider uppercase">
                    <th className="py-3.5 px-6">Structure Name</th>
                    <th className="py-3.5 px-6">Description</th>
                    <th className="py-3.5 px-6">Rules (Active / Total)</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6">Currency</th>
                    <th className="py-3.5 px-6">Last Updated</th>
                    <th className="py-3.5 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.items.map((structure) => (
                    <tr
                      key={structure.id}
                      onClick={() => navigate(`/payroll/structures/${structure.id}`)}
                      className="hover:bg-surface/60 transition-colors cursor-pointer group"
                    >
                      <td className="py-4 px-6 font-semibold text-navy">
                        <div className="flex items-center gap-2">
                          <span>{structure.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate max-w-xs truncate">
                        {structure.description || '—'}
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-navy border border-slate-200">
                          {structure.activeRuleCount} / {structure.totalRuleCount} active
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            structure.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {structure.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate font-mono text-xs">
                        {structure.currency}
                      </td>
                      <td className="py-4 px-6 text-slate text-xs">
                        {new Date(structure.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <span className="inline-flex items-center text-slate group-hover:text-accent font-medium text-xs transition-colors">
                          View Rules
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-surface/30">
                <p className="text-xs text-slate">
                  Showing page <span className="font-semibold text-navy">{data.pagination.page}</span> of{' '}
                  <span className="font-semibold text-navy">{data.pagination.totalPages}</span> ({data.pagination.totalItems} total structures)
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 border border-border rounded-lg text-xs font-medium text-navy hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= data.pagination.totalPages}
                    onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                    className="px-3 py-1.5 border border-border rounded-lg text-xs font-medium text-navy hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
