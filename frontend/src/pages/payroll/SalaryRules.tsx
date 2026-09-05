import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Sliders,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  FileCode2,
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../context/AuthContext';
import {
  useSalaryRules,
  useSalaryStructures,
} from '../../features/salary-config/salary-config.queries';
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  METHOD_LABELS,
  METHOD_COLORS,
  formatRuleConfiguration,
} from '../../features/salary-config/salary-config.format';
import type {
  SalaryRuleCategory,
  SalaryRuleMethod,
  RecordStatus,
} from '@peoplepay360/shared';

export default function SalaryRulesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isManagerOrAdmin =
    user?.role === 'HR_PAYROLL_MANAGER' || user?.role === 'ADMIN';

  const [structureId, setStructureId] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<SalaryRuleCategory | ''>('');
  const [method, setMethod] = useState<SalaryRuleMethod | ''>('');
  const [status, setStatus] = useState<RecordStatus | ''>('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: structuresData } = useSalaryStructures({ pageSize: 100 });
  const { data, isLoading, isError, error, refetch } = useSalaryRules({
    salaryStructureId: structureId || undefined,
    search: search.trim() || undefined,
    category: category || undefined,
    method: method || undefined,
    status: status || undefined,
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
              <Sliders className="w-6 h-6 text-navy" />
              <h1 className="text-2xl font-display font-bold text-navy">
                Salary Rules
              </h1>
            </div>
            <p className="text-slate text-sm mt-1">
              Global directory of computational, allowance, and deduction salary rules.
            </p>
          </div>

          {isManagerOrAdmin && (
            <Link
              to={
                structureId
                  ? `/payroll/rules/new?salaryStructureId=${structureId}`
                  : '/payroll/rules/new'
              }
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              New Rule
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white border border-border rounded-xl p-4 shadow-sm mb-6 flex flex-col lg:flex-row gap-3 items-center justify-between">
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Structure Filter */}
            <select
              value={structureId}
              onChange={(e) => {
                setStructureId(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-white text-navy focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            >
              <option value="">All Salary Structures</option>
              {structuresData?.items.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* Category Filter */}
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as SalaryRuleCategory | '');
                setPage(1);
              }}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-white text-navy focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            >
              <option value="">All Categories</option>
              <option value="BASIC">Basic</option>
              <option value="ALLOWANCE">Allowance</option>
              <option value="OVERTIME">Overtime</option>
              <option value="GROSS">Gross</option>
              <option value="DEDUCTION">Deduction</option>
              <option value="CONTRIBUTION">Contribution</option>
              <option value="NET">Net</option>
            </select>

            {/* Method Filter */}
            <select
              value={method}
              onChange={(e) => {
                setMethod(e.target.value as SalaryRuleMethod | '');
                setPage(1);
              }}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-white text-navy focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            >
              <option value="">All Methods</option>
              <option value="FIXED">Fixed Amount</option>
              <option value="PERCENTAGE">Percentage</option>
              <option value="FORMULA">Formula</option>
            </select>

            {/* Status Filter */}
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as RecordStatus | '');
                setPage(1);
              }}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-white text-navy focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
              <input
                type="text"
                placeholder="Search rule name or code..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              />
            </div>
            <button
              onClick={() => refetch()}
              className="p-2 border border-border rounded-lg text-slate hover:text-navy hover:bg-surface transition-colors shrink-0"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="bg-white border border-border rounded-xl p-12 text-center shadow-sm">
            <RefreshCw className="w-8 h-8 text-accent animate-spin mx-auto mb-3" />
            <p className="text-slate text-sm font-medium">Loading salary rules...</p>
          </div>
        ) : isError ? (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-8 text-center">
            <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-3" />
            <p className="text-rose-800 font-semibold mb-1">Failed to load rules</p>
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
            <FileCode2 className="w-12 h-12 text-slate/40 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-navy mb-1">No Salary Rules Found</h3>
            <p className="text-slate text-sm max-w-md mx-auto mb-6">
              {search || structureId || category || method || status
                ? 'No salary rules match the current filters.'
                : 'Get started by creating a rule in a salary structure.'}
            </p>
            {isManagerOrAdmin && (
              <Link
                to="/payroll/rules/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-navy hover:bg-navy/90 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Salary Rule
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col justify-between">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface/50 text-slate font-semibold text-xs tracking-wider uppercase">
                    <th className="py-3.5 px-6">Structure</th>
                    <th className="py-3.5 px-4 w-16 text-center">Seq</th>
                    <th className="py-3.5 px-6">Rule Code</th>
                    <th className="py-3.5 px-6">Name</th>
                    <th className="py-3.5 px-6">Category</th>
                    <th className="py-3.5 px-6">Method</th>
                    <th className="py-3.5 px-6">Configuration</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.items.map((rule) => {
                    const catStyle = CATEGORY_COLORS[rule.category];
                    const methodStyle = METHOD_COLORS[rule.method];

                    return (
                      <tr
                        key={rule.id}
                        onClick={() => navigate(`/payroll/rules/${rule.id}`)}
                        className="hover:bg-surface/60 transition-colors cursor-pointer group"
                      >
                        <td className="py-4 px-6 font-medium text-navy text-xs">
                          {rule.salaryStructure.name}
                        </td>
                        <td className="py-4 px-4 text-center font-mono font-semibold text-xs text-slate">
                          {rule.sequence}
                        </td>
                        <td className="py-4 px-6 font-mono font-bold text-xs text-navy">
                          {rule.code}
                        </td>
                        <td className="py-4 px-6 font-semibold text-navy">
                          {rule.name}
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                          >
                            {CATEGORY_LABELS[rule.category]}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${methodStyle.bg} ${methodStyle.text} ${methodStyle.border}`}
                          >
                            {METHOD_LABELS[rule.method]}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-mono text-xs text-navy max-w-xs truncate">
                          {formatRuleConfiguration(rule)}
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              rule.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {rule.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span className="inline-flex items-center text-slate group-hover:text-accent font-medium text-xs transition-colors">
                            {isManagerOrAdmin ? 'Edit' : 'View'}
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-surface/30">
                <p className="text-xs text-slate">
                  Showing page <span className="font-semibold text-navy">{data.pagination.page}</span> of{' '}
                  <span className="font-semibold text-navy">{data.pagination.totalPages}</span> ({data.pagination.totalItems} total rules)
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
