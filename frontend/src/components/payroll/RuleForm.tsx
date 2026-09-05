import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2, HelpCircle } from 'lucide-react';
import type { SalaryRule, RuleCategory, ComputationType } from './mockData';

interface Props {
  rules: SalaryRule[];
  onSave: (rule: SalaryRule) => void;
  onDelete: (id: string) => void;
}

const CATEGORIES: RuleCategory[] = ['Basic', 'Allowance', 'Deduction', 'Gross', 'Net'];

export default function RuleForm({ rules, onSave, onDelete }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const existing = rules.find(r => r.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [code, setCode] = useState(existing?.code ?? '');
  const [category, setCategory] = useState<RuleCategory>(existing?.category ?? 'Basic');
  const [sequence, setSequence] = useState(existing?.sequence ?? (rules.length + 1));
  const [active, setActive] = useState(existing?.active ?? true);
  const [computationType, setComputationType] = useState<ComputationType>(existing?.computationType ?? 'fixed');
  const [fixedAmount, setFixedAmount] = useState<number | ''>(existing?.fixedAmount ?? 0);
  const [percentage, setPercentage] = useState<number | ''>(existing?.percentage ?? 10);
  const [percentageOfRuleId, setPercentageOfRuleId] = useState(existing?.percentageOfRuleId ?? (rules[0]?.id || ''));
  const [formula, setFormula] = useState(existing?.formula ?? 'BASIC * 0.10');

  const otherRules = rules.filter(r => r.id !== id);

  const handleSave = () => {
    if (!name.trim() || !code.trim()) return;

    const saved: SalaryRule = {
      id: isNew ? `rule-${Date.now()}` : id!,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      category,
      sequence: Number(sequence) || 1,
      active,
      computationType,
      fixedAmount: computationType === 'fixed' ? Number(fixedAmount) || 0 : undefined,
      percentage: computationType === 'percentage' ? Number(percentage) || 0 : undefined,
      percentageOfRuleId: computationType === 'percentage' ? percentageOfRuleId : undefined,
      formula: computationType === 'formula' ? formula.trim() : undefined,
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
      <div className="flex items-center justify-between px-8 py-4 bg-white border-b border-border">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/payroll/rules')}
            className="p-2 hover:bg-surface rounded-full text-brandAccent transition-colors group"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <h2 className="text-xl font-display font-semibold text-navy">
              {isNew ? 'New Salary Rule' : `Salary Rule / ${name || existing?.name}`}
            </h2>
            <p className="text-xs text-mutedText mt-0.5">
              {isNew ? 'Configure a new computation rule for salary structures.' : `Rule Code: ${code}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isNew && (
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 rounded-md transition-colors"
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
            className="px-4 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent/90 rounded-md shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>

      {/* Form Content */}
      <div className="max-w-4xl w-full mx-auto px-8 py-8 space-y-6">
        {/* Main Details Card */}
        <div className="bg-white rounded-lg border border-border p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-navy mb-4 uppercase tracking-wider">General Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-medium text-slate mb-1">
                Rule Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Basic Salary"
                className="w-full px-3 py-2 bg-surface/40 border border-border rounded-md text-sm text-navy focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate mb-1">
                Rule Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. BASIC"
                className="w-full px-3 py-2 bg-surface/40 border border-border rounded-md text-sm font-mono text-navy focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate mb-1">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as RuleCategory)}
                className="w-full px-3 py-2 bg-surface/40 border border-border rounded-md text-sm text-navy focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate mb-1">Sequence Order</label>
              <input
                type="number"
                value={sequence}
                onChange={e => setSequence(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface/40 border border-border rounded-md text-sm text-navy focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              />
            </div>

            <div className="md:col-span-2 flex items-center justify-between pt-2 border-t border-border/50">
              <div>
                <span className="text-sm font-medium text-navy">Active Status</span>
                <p className="text-xs text-mutedText">Inactive rules will not be included in calculations.</p>
              </div>
              <button
                type="button"
                onClick={() => setActive(!active)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  active ? 'bg-accent' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    active ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Computation Method Card */}
        <div className="bg-white rounded-lg border border-border p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-navy mb-4 uppercase tracking-wider">Computation Method</h3>

          {/* Segmented Type Control */}
          <div className="flex p-1 bg-surface rounded-lg border border-border/70 max-w-md mb-6">
            <button
              type="button"
              onClick={() => setComputationType('fixed')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                computationType === 'fixed'
                  ? 'bg-white text-navy shadow-sm border border-border/60'
                  : 'text-slate hover:text-navy'
              }`}
            >
              Fixed Amount
            </button>
            <button
              type="button"
              onClick={() => setComputationType('percentage')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                computationType === 'percentage'
                  ? 'bg-white text-navy shadow-sm border border-border/60'
                  : 'text-slate hover:text-navy'
              }`}
            >
              Percentage (%)
            </button>
            <button
              type="button"
              onClick={() => setComputationType('formula')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                computationType === 'formula'
                  ? 'bg-white text-navy shadow-sm border border-border/60'
                  : 'text-slate hover:text-navy'
              }`}
            >
              Formula / Expression
            </button>
          </div>

          {/* Type: Fixed */}
          {computationType === 'fixed' && (
            <div className="max-w-md">
              <label className="block text-xs font-medium text-slate mb-1">Fixed Amount ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate text-sm">$</span>
                <input
                  type="number"
                  step="any"
                  value={fixedAmount}
                  onChange={e => setFixedAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full pl-8 pr-3 py-2 bg-surface/40 border border-border rounded-md text-sm text-navy focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent font-mono"
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-mutedText mt-1">This exact amount will be applied to the salary slip.</p>
            </div>
          )}

          {/* Type: Percentage */}
          {computationType === 'percentage' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
              <div>
                <label className="block text-xs font-medium text-slate mb-1">Percentage (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    value={percentage}
                    onChange={e => setPercentage(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full pr-8 pl-3 py-2 bg-surface/40 border border-border rounded-md text-sm text-navy focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent font-mono"
                    placeholder="10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate text-sm">%</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate mb-1">% of Rule</label>
                <select
                  value={percentageOfRuleId}
                  onChange={e => setPercentageOfRuleId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface/40 border border-border rounded-md text-sm text-navy focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                >
                  {otherRules.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Type: Formula */}
          {computationType === 'formula' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate mb-1">Python / Math Expression</label>
                <textarea
                  rows={4}
                  value={formula}
                  onChange={e => setFormula(e.target.value)}
                  className="w-full px-3 py-2 bg-surface/50 font-mono text-sm border border-border rounded-md text-navy focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                  placeholder="e.g. BASIC + HRA + STD - PF"
                />
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-md flex items-start gap-2.5 text-xs text-amber-900">
                <HelpCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Available variables in formula:</span>
                  <p className="mt-0.5 text-amber-800">
                    Use rule codes such as <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">BASIC</code>,{' '}
                    <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">HRA</code>,{' '}
                    <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">GROSS</code>, or contract/attendance
                    variables like <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">worked_days</code>.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
