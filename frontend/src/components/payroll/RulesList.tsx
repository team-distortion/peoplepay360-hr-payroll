import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, Plus } from 'lucide-react';
import type { SalaryRule, SalaryStructure } from './mockData';

interface Props {
  rules: SalaryRule[];
  structures?: SalaryStructure[];
}

const categoryColor: Record<string, string> = {
  Basic: 'bg-blue-100 text-blue-700',
  Allowance: 'bg-emerald-100 text-emerald-700',
  Deduction: 'bg-red-100 text-red-700',
  Gross: 'bg-purple-100 text-purple-700',
  Net: 'bg-amber-100 text-amber-800',
};

export default function RulesList({ rules, structures = [] }: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [structureFilter, setStructureFilter] = useState<string>('All');

  // Derive unique structure names from rules or structures prop
  const structureOptions = useMemo(() => {
    const set = new Set<string>();
    structures.forEach(s => set.add(s.name));
    rules.forEach(r => {
      if (r.structureName) set.add(r.structureName);
    });
    return Array.from(set);
  }, [rules, structures]);

  const filtered = useMemo(() => {
    let result = rules;
    if (structureFilter !== 'All') {
      result = result.filter(r => r.structureName === structureFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        r =>
          r.name.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          r.structureName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [rules, search, structureFilter]);

  return (
    <div className="flex flex-col flex-1 bg-surface/30 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 bg-white border-b border-border">
        <div className="flex items-center gap-4 flex-1">
          <button
            onClick={() => navigate('/payroll/payruns')}
            className="p-2 hover:bg-surface rounded-full text-brandAccent transition-colors group"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-display font-semibold text-navy">Salary Rules</h2>
              <span className="text-xs text-mutedText font-normal">List view</span>
            </div>
            <p className="text-xs text-mutedText mt-0.5">
              Computation building blocks used by salary structures.
            </p>
          </div>

          <div className="relative w-64 ml-4 group">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate group-hover:text-navy transition-colors duration-200" />
            <input
              type="text"
              placeholder="Search salary rules…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-surface/50 border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent hover:border-slate/40 transition-all text-navy placeholder:text-mutedText"
            />
          </div>

          {/* Structure filter dropdown */}
          <div className="flex items-center gap-2 ml-3">
            <span className="text-xs font-medium text-slate">Structure:</span>
            <select
              value={structureFilter}
              onChange={e => setStructureFilter(e.target.value)}
              className="px-3 py-1.5 bg-surface/50 border border-border rounded-md text-xs font-medium text-navy focus:outline-none focus:ring-1 focus:ring-accent hover:border-slate/40"
            >
              <option value="All">All Structures</option>
              {structureOptions.map(name => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={() => navigate('/payroll/rules/new')}
          className="px-4 py-1.5 bg-accent text-white text-sm font-medium rounded-md hover:bg-[#4a42d8] hover:shadow-md transition-all duration-200 active:scale-95 transform flex items-center gap-1.5 shadow-sm"
        >
          <Plus size={16} /> New
        </button>
      </div>

      {/* Table */}
      <div className="p-8">
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface/50">
                <th className="py-3 px-4 text-xs font-semibold text-slate uppercase tracking-wider">Rule Name</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate uppercase tracking-wider">Code</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate uppercase tracking-wider">Category</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate uppercase tracking-wider">Structure</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate uppercase tracking-wider text-right">
                  Sequence
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate text-sm">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="w-8 h-8 text-slate/30" />
                      <span>No rules found</span>
                      {search && (
                        <button onClick={() => setSearch('')} className="text-accent text-xs hover:underline">
                          Clear search
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((r, i) => (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/payroll/rules/${r.id}`)}
                    className="border-b border-border hover:bg-surface/70 transition-all duration-200 cursor-pointer animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <td className="py-3 px-4 text-sm font-medium text-navy">{r.name}</td>
                    <td className="py-3 px-4 text-sm font-mono text-slate">{r.code}</td>
                    <td className="py-3 px-4 text-sm">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                          categoryColor[r.category] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {r.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate">{r.structureName || '—'}</td>
                    <td className="py-3 px-4 text-sm font-mono text-slate text-right">{r.sequence}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footnote */}
        <div className="mt-4 px-2">
          <p className="text-xs text-mutedText italic">
            * List view should expose name, code, category, structure and sequence — the fields needed to understand a payroll rule quickly.
          </p>
        </div>
      </div>
    </div>
  );
}
