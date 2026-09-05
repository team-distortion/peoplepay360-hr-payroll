import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, X, Plus, Search, Info, ExternalLink } from 'lucide-react';
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
    const maxSeq = rules.length > 0 ? Math.max(...rules.map(r => r.sequence)) : 0;
    const nextSeq = maxSeq + 10;
    setRules([...rules, { ruleId, sequence: nextSeq }]);
    setShowPicker(false);
    setPickerSearch('');
  };

  const handleSequenceChange = (ruleId: string, val: number) => {
    setRules(
      rules
        .map(r => (r.ruleId === ruleId ? { ...r, sequence: val } : r))
        .sort((a, b) => a.sequence - b.sequence)
    );
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const arr = [...rules];
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    // Renumber with gaps of 10
    const reordered = arr.map((r, i) => ({ ...r, sequence: (i + 1) * 10 }));
    setRules(reordered);
  };

  const handleMoveDown = (index: number) => {
    if (index >= rules.length - 1) return;
    const arr = [...rules];
    [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
    const reordered = arr.map((r, i) => ({ ...r, sequence: (i + 1) * 10 }));
    setRules(reordered);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const saved: SalaryStructure = {
      id: isNew ? `struct-${Date.now()}` : id!,
      name: name.trim(),
      active,
      rules: [...rules].sort((a, b) => a.sequence - b.sequence),
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
          <button
            onClick={() => navigate('/payroll/structures')}
            className="p-2 hover:bg-surface rounded-full text-brandAccent transition-colors group"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <h1 className="text-xl font-display font-semibold text-navy">
              {isNew ? 'New Salary Structure' : `Salary Structure / ${name || existing?.name}`}
            </h1>
            <p className="text-xs text-mutedText mt-0.5">Form view with its salary rules.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {canDelete && (
            <button
              onClick={() => {
                onDelete(id!);
                navigate('/payroll/structures');
              }}
              className="px-4 py-1.5 border border-error text-error text-sm font-medium rounded-md hover:bg-error/5 transition-colors"
            >
              Delete
            </button>
          )}
          <button
            onClick={() => navigate('/payroll/structures')}
            className="px-4 py-1.5 border border-border text-slate text-sm font-medium rounded-md hover:bg-surface transition-colors"
          >
            Discard
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-1.5 bg-accent text-white text-sm font-medium rounded-md hover:bg-[#4a42d8] hover:shadow-md transition-all active:scale-95 shadow-sm"
          >
            Save
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-8 max-w-5xl space-y-6">
        {/* Summary fields */}
        <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
          <h3 className="text-xs font-semibold text-slate uppercase tracking-wider mb-4">Summary Fields</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-medium text-slate mb-1">Structure Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Regular Salary"
                className="w-full px-3.5 py-2 bg-surface/50 border border-border rounded-md text-sm font-medium text-navy focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate mb-1">Active</label>
              <div className="flex items-center gap-3 mt-1.5">
                <button
                  type="button"
                  onClick={() => setActive(!active)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    active ? 'bg-emerald-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      active ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className={`text-sm font-semibold ${active ? 'text-emerald-600' : 'text-slate'}`}>
                  {active ? 'True' : 'False'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Salary Rules table */}
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-navy">Salary Rules</h3>
              <p className="text-xs text-mutedText mt-0.5">Rules included in this structure, in evaluation order.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowPicker(!showPicker)}
              className="px-3 py-1.5 bg-accent/10 text-accent hover:bg-accent hover:text-white text-xs font-semibold rounded-md transition-all flex items-center gap-1.5"
            >
              <Plus size={14} /> Add Rule
            </button>
          </div>

          {/* Add Rule searchable picker */}
          {showPicker && (
            <div className="p-4 bg-surface/40 border-b border-border animate-in fade-in duration-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
                  <input
                    type="text"
                    value={pickerSearch}
                    onChange={e => setPickerSearch(e.target.value)}
                    placeholder="Search existing rules to add..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-border rounded-md text-xs text-navy focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPicker(false)}
                  className="p-1.5 text-slate hover:text-navy rounded"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto divide-y divide-border border border-border rounded-md bg-white">
                {availableRules.length === 0 ? (
                  <p className="p-3 text-xs text-mutedText text-center">No available unattached rules found.</p>
                ) : (
                  availableRules.map(r => (
                    <div
                      key={r.id}
                      onClick={() => handleAddRule(r.id)}
                      className="p-2.5 px-3 flex items-center justify-between hover:bg-surface/80 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-medium text-navy">{r.name}</span>
                        <span className="text-[10px] font-mono text-slate px-1.5 py-0.5 bg-surface border border-border rounded">
                          {r.code}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            categoryColor[r.category] ?? 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {r.category}
                        </span>
                      </div>
                      <span className="text-xs text-accent font-semibold flex items-center gap-1">
                        <Plus size={12} /> Add
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-surface/50 text-[11px] font-semibold text-slate uppercase tracking-wider">
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-4">Rule Name</th>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 w-28 text-center">Sequence</th>
                  <th className="py-3 px-4 w-20 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rules.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-mutedText text-xs">
                      No rules attached to this structure yet. Click "Add Rule" above.
                    </td>
                  </tr>
                ) : (
                  rules.map((sr, idx) => {
                    const rule = allRules.find(r => r.id === sr.ruleId);
                    if (!rule) return null;
                    return (
                      <tr
                        key={sr.ruleId}
                        className="hover:bg-surface/50 transition-colors group cursor-pointer"
                        onClick={() => navigate(`/payroll/rules/${rule.id}`)}
                      >
                        <td className="py-3 px-3 text-center text-slate" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleMoveUp(idx)}
                              disabled={idx === 0}
                              className="p-1 text-slate hover:text-navy disabled:opacity-20"
                              title="Move up"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveDown(idx)}
                              disabled={idx === rules.length - 1}
                              className="p-1 text-slate hover:text-navy disabled:opacity-20"
                              title="Move down"
                            >
                              ▼
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium text-navy flex items-center gap-1.5 group-hover:text-accent">
                          {rule.name}
                          <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </td>
                        <td className="py-3 px-4 font-mono text-slate">{rule.code}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              categoryColor[rule.category] ?? 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {rule.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                          <input
                            type="number"
                            value={sr.sequence}
                            onChange={e => handleSequenceChange(sr.ruleId, parseInt(e.target.value, 10) || 0)}
                            className="w-16 text-center py-1 bg-surface/60 border border-border rounded text-xs font-mono font-medium focus:ring-1 focus:ring-accent"
                          />
                        </td>
                        <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleRemoveRule(sr.ruleId)}
                            className="p-1 text-slate hover:text-error hover:bg-error/10 rounded transition-colors"
                            title="Remove from structure"
                          >
                            <X size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Useful notes */}
        <div className="bg-blue-50/60 border border-blue-200/80 rounded-lg p-4 text-xs text-blue-900 space-y-1.5">
          <div className="flex items-start gap-2">
            <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>
                <strong>Rule order matters</strong> — keep sequence visible to participants to help them understand the calculation. Rules created here are just for reference. Rules are evaluated in ascending sequence order, so a rule that depends on another (e.g. "Gross Salary" summing Basic + Allowances) must have a higher sequence number than what it depends on.
              </p>
              <p className="text-blue-800">
                <em>Cross-reference:</em> Configured structure is selected when a Payrun is created.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
