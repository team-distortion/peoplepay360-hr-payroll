import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2, Check } from 'lucide-react';
import type { SalaryRule, RuleCategory, ComputationMode, SalaryStructure } from './mockData';

interface Props {
  rules: SalaryRule[];
  structures?: SalaryStructure[];
  onSave: (rule: SalaryRule) => void;
  onDelete: (id: string) => void;
}

const CATEGORIES: RuleCategory[] = ['Basic', 'Allowance', 'Deduction', 'Gross', 'Net'];
const COMPUTATION_MODES: ComputationMode[] = ['Fixed Amount', 'Percentage of Wage', 'Python Code'];

export default function RuleForm({ rules, structures = [], onSave, onDelete }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const existing = rules.find(r => r.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [code, setCode] = useState(existing?.code ?? '');
  const [category, setCategory] = useState<RuleCategory>(existing?.category ?? 'Basic');
  const [sequence, setSequence] = useState<number | ''>(existing?.sequence ?? 10);
  const [sortBy, setSortBy] = useState<number | ''>(existing?.sortBy ?? 1);
  const [structureName, setStructureName] = useState(existing?.structureName ?? (structures[0]?.name || 'Regular Salary'));
  const [computation, setComputation] = useState<ComputationMode>(existing?.computation ?? 'Fixed Amount');
  const [amount, setAmount] = useState<number | ''>(existing?.amount ?? 0);
  const [percentage, setPercentage] = useState<number | ''>(existing?.percentage ?? 10);
  const [pythonCode, setPythonCode] = useState(
    existing?.pythonCode ?? "result = categories['BASIC']"
  );
  const [active, setActive] = useState(existing?.active ?? true);

  // Derive numeric ID chip (e.g. #317 or #1)
  const recordChip = isNew
    ? '#NEW'
    : `#${id?.replace(/\D/g, '') || Math.floor(Math.random() * 800 + 100)}`;

  const handleSave = () => {
    if (!name.trim() || !code.trim()) return;

    const matchedStruct = structures.find(s => s.name === structureName);

    const saved: SalaryRule = {
      id: isNew ? `rule-${Date.now()}` : id!,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      category,
      structureId: matchedStruct?.id ?? (existing?.structureId || 'struct-1'),
      structureName,
      sequence: Number(sequence) || 10,
      sortBy: Number(sortBy) || 1,
      active,
      computation,
      amount: computation === 'Fixed Amount' ? Number(amount) || 0 : undefined,
      percentage: computation === 'Percentage of Wage' ? Number(percentage) || 0 : undefined,
      pythonCode: computation === 'Python Code' ? pythonCode.trim() : undefined,
    };

    onSave(saved);
    navigate('/payroll/rules');
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this salary rule?')) {
      if (id) onDelete(id);
      navigate('/payroll/rules');
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-surface/30 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 bg-white border-b border-border sticky top-14 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/payroll/rules')}
            className="p-2 hover:bg-surface rounded-full text-brandAccent transition-colors group"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-surface text-slate border border-border rounded">
                {recordChip}
              </span>
              <h1 className="text-xl font-display font-semibold text-navy">
                {isNew ? 'New Salary Rule' : `Salary Rule / ${name || existing?.name}`}
              </h1>
            </div>
            <p className="text-xs text-mutedText mt-0.5">Form view</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActive(!active)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
              active
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-gray-50 text-gray-500 border-gray-200'
            }`}
          >
            {active ? 'Active' : 'Inactive'}
          </button>
          {!isNew && (
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 rounded-md transition-colors"
            >
              <Trash2 size={14} />
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/payroll/rules')}
            className="px-4 py-1.5 text-xs font-medium text-slate hover:text-navy hover:bg-surface border border-border rounded-md transition-colors"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim() || !code.trim()}
            className="px-5 py-1.5 text-xs font-medium text-white bg-accent hover:bg-[#4a42d8] rounded-md shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl w-full mx-auto px-8 py-8 space-y-6">
        {/* Two-Column Form Layout */}
        <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
          <h2 className="text-xs font-semibold text-slate uppercase tracking-wider mb-5">Rule Properties</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate mb-1">
                  Rule Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Basic Salary"
                  className="w-full px-3.5 py-2 bg-surface/40 border border-border rounded-md text-sm text-navy focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate mb-1">
                  Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. BASIC01"
                  className="w-full px-3.5 py-2 bg-surface/40 border border-border rounded-md text-sm font-mono text-navy focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate mb-1">Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as RuleCategory)}
                  className="w-full px-3.5 py-2 bg-surface/40 border border-border rounded-md text-sm text-navy focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate mb-1">Sequence</label>
                <input
                  type="number"
                  value={sequence}
                  onChange={e => setSequence(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  placeholder="e.g. 1"
                  className="w-full px-3.5 py-2 bg-surface/40 border border-border rounded-md text-sm font-mono text-navy focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                />
                <span className="text-[11px] text-mutedText mt-0.5 block">Order within the parent Structure</span>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate mb-1">Salary Structure</label>
                <select
                  value={structureName}
                  onChange={e => setStructureName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-surface/40 border border-border rounded-md text-sm text-navy focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                >
                  {structures.length > 0 ? (
                    structures.map(s => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Regular Salary">Regular Salary</option>
                      <option value="Sales Salary">Sales Salary</option>
                      <option value="Contractor">Contractor</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate mb-1">Computation</label>
                <select
                  value={computation}
                  onChange={e => setComputation(e.target.value as ComputationMode)}
                  className="w-full px-3.5 py-2 bg-surface/40 border border-border rounded-md text-sm text-navy font-medium focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                >
                  {COMPUTATION_MODES.map(mode => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate mb-1">Sort By</label>
                <input
                  type="number"
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  placeholder="e.g. 1"
                  className="w-full px-3.5 py-2 bg-surface/40 border border-border rounded-md text-sm font-mono text-navy focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                />
                <span className="text-[11px] text-mutedText mt-0.5 block">Display ordering in rules lists</span>
              </div>
            </div>
          </div>
        </div>

        {/* Computation options from the source section */}
        <div className="bg-white rounded-xl border border-border p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-xs font-semibold text-slate uppercase tracking-wider">
              Computation options from the source
            </h2>
            <p className="text-xs text-mutedText mt-0.5">
              The active mode corresponds to the Computation selection above.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Panel 1: Fixed Amount */}
            <div
              onClick={() => setComputation('Fixed Amount')}
              className={`p-4 rounded-lg border cursor-pointer transition-all ${
                computation === 'Fixed Amount'
                  ? 'border-accent bg-accent/5 ring-1 ring-accent'
                  : 'border-border bg-surface/30 hover:border-slate/40 opacity-70'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-navy">1. Fixed Amount</span>
                {computation === 'Fixed Amount' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-accent">
                    <Check size={12} /> Active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-mutedText mb-3">
                Flat value applied every payrun regardless of wage.
              </p>
              <div>
                <label className="block text-[11px] font-medium text-slate mb-1">Amount ($)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  disabled={computation !== 'Fixed Amount'}
                  placeholder="e.g. 950000"
                  className="w-full px-3 py-1.5 bg-white border border-border rounded text-xs font-mono text-navy focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-gray-100 disabled:text-gray-400"
                />
              </div>
            </div>

            {/* Panel 2: Percentage of Wage */}
            <div
              onClick={() => setComputation('Percentage of Wage')}
              className={`p-4 rounded-lg border cursor-pointer transition-all ${
                computation === 'Percentage of Wage'
                  ? 'border-accent bg-accent/5 ring-1 ring-accent'
                  : 'border-border bg-surface/30 hover:border-slate/40 opacity-70'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-navy">2. Percentage of Wage</span>
                {computation === 'Percentage of Wage' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-accent">
                    <Check size={12} /> Active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-mutedText mb-3">
                Computed against the employee's wage (or referenced base rule).
              </p>
              <div>
                <label className="block text-[11px] font-medium text-slate mb-1">Percentage (%)</label>
                <input
                  type="number"
                  value={percentage}
                  onChange={e => setPercentage(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  disabled={computation !== 'Percentage of Wage'}
                  placeholder="e.g. 10"
                  className="w-full px-3 py-1.5 bg-white border border-border rounded text-xs font-mono text-navy focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-gray-100 disabled:text-gray-400"
                />
              </div>
            </div>

            {/* Panel 3: Python Code */}
            <div
              onClick={() => setComputation('Python Code')}
              className={`p-4 rounded-lg border cursor-pointer transition-all ${
                computation === 'Python Code'
                  ? 'border-accent bg-accent/5 ring-1 ring-accent'
                  : 'border-border bg-surface/30 hover:border-slate/40 opacity-70'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-navy">3. Python Code</span>
                {computation === 'Python Code' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-accent">
                    <Check size={12} /> Active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-mutedText mb-3">
                Expression referencing other rules via <code>categories</code> dict.
              </p>
              <div>
                <label className="block text-[11px] font-medium text-slate mb-1">Python Expression</label>
                <textarea
                  rows={2}
                  value={pythonCode}
                  onChange={e => setPythonCode(e.target.value)}
                  disabled={computation !== 'Python Code'}
                  placeholder="result = categories['BASIC']"
                  className="w-full px-2.5 py-1.5 bg-white border border-border rounded text-xs font-mono text-navy focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-gray-100 disabled:text-gray-400 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Footnote */}
          <div className="pt-2">
            <p className="text-xs text-mutedText italic">
              * A Salary Rule needs a clear computation method and category because these drive the final payslip.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
