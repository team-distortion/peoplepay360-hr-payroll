import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, GripVertical, X, Plus, Search } from 'lucide-react';
import type { SalaryStructure, SalaryRule, StructureRule } from './mockData';

interface Props {
  structures: SalaryStructure[];
  allRules: SalaryRule[];
  onSave: (updated: SalaryStructure) => void;
  onDelete: (id: string) => void;
}

export default function StructureForm({ structures, allRules, onSave, onDelete }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const existing = structures.find(s => s.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [active, setActive] = useState(existing?.active ?? true);
  const [rules, setRules] = useState<StructureRule[]>(existing?.rules ?? []);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const attachedRuleIds = new Set(rules.map(r => r.ruleId));

  const availableRules = useMemo(() => {
    const unattached = allRules.filter(r => !attachedRuleIds.has(r.id));
    if (!pickerSearch) return unattached;
    const q = pickerSearch.toLowerCase();
    return unattached.filter(r => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q));
  }, [allRules, attachedRuleIds, pickerSearch]);

  const handleRemoveRule = (ruleId: string) => {
    setRules(rules.filter(r => r.ruleId !== ruleId));
  };

  const handleAddRule = (ruleId: string) => {
    const nextSeq = rules.length > 0 ? Math.max(...rules.map(r => r.sequence)) + 1 : 1;
    setRules([...rules, { ruleId, sequence: nextSeq }]);
    setShowPicker(false);
    setPickerSearch('');
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const arr = [...rules];
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    setRules(arr.map((r, i) => ({ ...r, sequence: i + 1 })));
  };

  const handleMoveDown = (index: number) => {
    if (index >= rules.length - 1) return;
    const arr = [...rules];
    [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
    setRules(arr.map((r, i) => ({ ...r, sequence: i + 1 })));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const saved: SalaryStructure = {
      id: isNew ? `struct-${Date.now()}` : id!,
      name: name.trim(),
      active,
      rules: rules.map((r, i) => ({ ...r, sequence: i + 1 })),
      employeeCount: existing?.employeeCount ?? 0,
    };
    onSave(saved);
    navigate('/payroll/structures');
  };

  const canDelete = !isNew && (existing?.employeeCount ?? 0) === 0;

  const categoryColor: Record<string, string> = {
    Basic: 'bg-blue-100 text-blue-700',
    Allowance: 'bg-emerald-100 text-emerald-700',
    Deduction: 'bg-red-100 text-red-700',
    Gross: 'bg-purple-100 text-purple-700',
    Net: 'bg-amber-100 text-amber-800',
  };

  return (
    <div className="flex flex-col flex-1 bg-surface/30 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="px-8 py-5 bg-white border-b border-border sticky top-14 z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/payroll/structures')} className="p-2 hover:bg-surface rounded-full text-brandAccent transition-colors group">
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <span className="text-xs text-mutedText font-medium">Salary Structure</span>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Structure Name"
              className="block text-2xl font-display font-bold text-navy bg-transparent border-none outline-none focus:ring-0 placeholder:text-slate/40 w-96"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Active toggle */}
          <button
            onClick={() => setActive(!active)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
              active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'
            }`}
          >
            {active ? 'Active' : 'Inactive'}
          </button>

          {canDelete && (
            <button
              onClick={() => { onDelete(id!); navigate('/payroll/structures'); }}
              className="px-4 py-1.5 border border-error text-error text-sm font-medium rounded-md hover:bg-error/5 transition-colors"
            >
              Delete
            </button>
          )}
          <button onClick={() => navigate('/payroll/structures')} className="px-4 py-1.5 border border-border text-slate text-sm font-medium rounded-md hover:bg-surface transition-colors">
            Discard
          </button>
          <button onClick={handleSave} className="px-5 py-1.5 bg-accent text-white text-sm font-medium rounded-md hover:bg-[#4a42d8] hover:shadow-md transition-all active:scale-95">
            Save
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-8 max-w-4xl">
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-navy">Included Rules</h3>
              <p className="text-xs text-mutedText mt-0.5">Rules are evaluated top-to-bottom. Drag to reorder.</p>
            </div>
          </div>

          {/* Rules table */}
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface/40">
                <th className="py-2 px-3 w-10"></th>
                <th className="py-2 px-3 text-xs font-semibold text-slate uppercase tracking-wider w-12">#</th>
                <th className="py-2 px-3 text-xs font-semibold text-slate uppercase tracking-wider">Rule</th>
                <th className="py-2 px-3 text-xs font-semibold text-slate uppercase tracking-wider">Code</th>
                <th className="py-2 px-3 text-xs font-semibold text-slate uppercase tracking-wider">Category</th>
                <th className="py-2 px-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate text-sm">No rules added yet.</td>
                </tr>
              ) : (
                rules.map((sr, index) => {
                  const rule = allRules.find(r => r.id === sr.ruleId);
                  if (!rule) return null;
                  return (
                    <tr key={sr.ruleId} className="border-b border-border hover:bg-surface/50 transition-colors">
                      <td className="py-2 px-3">
                        <div className="flex flex-col items-center gap-0.5">
                          <button onClick={() => handleMoveUp(index)} disabled={index === 0} className="text-slate/40 hover:text-navy disabled:opacity-30 transition-colors text-xs">▲</button>
                          <GripVertical className="w-4 h-4 text-slate/30" />
                          <button onClick={() => handleMoveDown(index)} disabled={index === rules.length - 1} className="text-slate/40 hover:text-navy disabled:opacity-30 transition-colors text-xs">▼</button>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-sm font-medium text-slate">{index + 1}</td>
                      <td className="py-2 px-3 text-sm font-medium text-navy">{rule.name}</td>
                      <td className="py-2 px-3 text-sm font-mono text-slate">{rule.code}</td>
                      <td className="py-2 px-3 text-sm">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${categoryColor[rule.category] ?? 'bg-gray-100 text-gray-600'}`}>
                          {rule.category}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <button onClick={() => handleRemoveRule(sr.ruleId)} className="p-1 text-slate/40 hover:text-error hover:bg-error/5 rounded transition-colors">
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Add rule */}
          <div className="px-5 py-3 border-t border-border relative">
            <button
              onClick={() => setShowPicker(!showPicker)}
              className="flex items-center gap-1.5 text-sm text-accent hover:text-[#4a42d8] font-medium transition-colors"
            >
              <Plus size={16} /> Add Rule
            </button>

            {showPicker && (
              <div className="absolute left-4 bottom-full mb-1 w-80 bg-white border border-border rounded-lg shadow-lg z-20 animate-in fade-in slide-in-from-bottom-2 duration-150">
                <div className="p-2 border-b border-border">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate" />
                    <input
                      type="text"
                      value={pickerSearch}
                      onChange={e => setPickerSearch(e.target.value)}
                      placeholder="Search rules…"
                      className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-accent"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {availableRules.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-slate text-center">No rules available</div>
                  ) : (
                    availableRules.map(r => (
                      <button
                        key={r.id}
                        onClick={() => handleAddRule(r.id)}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-surface transition-colors flex items-center justify-between"
                      >
                        <span className="font-medium text-navy">{r.name}</span>
                        <span className="text-xs text-mutedText font-mono">{r.code}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
