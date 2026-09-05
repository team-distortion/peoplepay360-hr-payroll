import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, Plus } from 'lucide-react';
import type { SalaryStructure } from './mockData';

interface Props {
  structures: SalaryStructure[];
  ruleCount?: (s: SalaryStructure) => number;
}

export default function StructuresList({
  structures,
  ruleCount = (s: SalaryStructure) => s.rules.length,
}: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return structures;
    const q = search.toLowerCase();
    return structures.filter(s => s.name.toLowerCase().includes(q));
  }, [structures, search]);

  return (
    <div className="flex flex-col flex-1 bg-surface/30">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 bg-white border-b border-border">
        <div className="flex items-center gap-4 flex-1">
          <button
            onClick={() => navigate('/payroll/payruns')}
            className="p-2 hover:bg-surface rounded-full text-brandAccent transition-colors group"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-display font-semibold text-navy">Salary Structures</h2>
            <span className="px-2 py-0.5 text-[11px] font-medium bg-surface text-slate border border-border rounded-full">
              Flow view
            </span>
          </div>

          <div className="relative w-64 ml-4 group">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate group-hover:text-navy transition-colors duration-200" />
            <input
              type="text"
              placeholder="Search structures…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-surface/50 border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent hover:border-slate/40 transition-all text-navy placeholder:text-mutedText"
            />
          </div>
        </div>

        <button
          onClick={() => navigate('/payroll/structures/new')}
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
                <th className="py-3 px-4 text-xs font-semibold text-slate uppercase tracking-wider">Structure Name</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate uppercase tracking-wider">Rules</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate uppercase tracking-wider">Employees</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate uppercase tracking-wider">Active</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate text-sm">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="w-8 h-8 text-slate/30" />
                      <span>No structures found</span>
                      {search && (
                        <button onClick={() => setSearch('')} className="text-accent text-xs hover:underline">
                          Clear search
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((s, i) => (
                  <tr
                    key={s.id}
                    onClick={() => navigate(`/payroll/structures/${s.id}`)}
                    className="border-b border-border hover:bg-surface/70 transition-all duration-200 cursor-pointer animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <td className="py-3 px-4 text-sm font-medium text-navy">{s.name}</td>
                    <td className="py-3 px-4 text-sm text-slate">{ruleCount(s)} rules</td>
                    <td className="py-3 px-4 text-sm text-slate">{s.employeeCount} employees</td>
                    <td className="py-3 px-4 text-sm">
                      <span className={s.active ? 'text-emerald-600 font-medium' : 'text-slate font-medium'}>
                        {s.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footnotes */}
        <div className="mt-4 px-2 space-y-1">
          <p className="text-xs text-mutedText italic">
            * Structures group salary rules; rules define the ordered salary computation used by a payslip. Both require List and Form views.
          </p>
          <p className="text-xs text-mutedText italic">
            * The Salary Structure selected on a Payrun determines which set of salary rules will compute pay.
          </p>
        </div>
      </div>
    </div>
  );
}
