import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Code2,
  Calculator,
  Percent,
  Coins,
  Sparkles,
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../context/AuthContext';
import {
  useSalaryRule,
  useSalaryStructures,
  useSalaryStructure,
  useCreateSalaryRule,
  useUpdateSalaryRule,
  useUpdateSalaryRuleStatus,
} from '../../features/salary-config/salary-config.queries';
import {
  SalaryFormulaBuiltinValues,
  SalaryRuleCategoryValues,
  type SalaryRuleCategory,
  type SalaryRuleMethod,
  type RecordStatus,
} from '@peoplepay360/shared';
import {
  CATEGORY_LABELS,
  METHOD_LABELS,
} from '../../features/salary-config/salary-config.format';

export default function SalaryRuleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isManagerOrAdmin =
    user?.role === 'HR_PAYROLL_MANAGER' || user?.role === 'ADMIN';

  const isNew = id === 'new' || !id;
  const initialStructureId = searchParams.get('salaryStructureId') || '';

  // Form states
  const [selectedStructureId, setSelectedStructureId] = useState(initialStructureId);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState<SalaryRuleCategory>('BASIC');
  const [sequence, setSequence] = useState(10);
  const [method, setMethod] = useState<SalaryRuleMethod>('FIXED');
  const [status, setStatus] = useState<RecordStatus>('ACTIVE');

  // Method specific fields
  const [fixedAmount, setFixedAmount] = useState('');
  const [percentageRate, setPercentageRate] = useState('');
  const [percentageBase, setPercentageBase] = useState('BASIC');
  const [formula, setFormula] = useState('');

  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  const formulaInputRef = useRef<HTMLTextAreaElement>(null);

  // Queries
  const { data: structuresData } = useSalaryStructures({ pageSize: 100 });
  const { data: existingRule, isLoading: isLoadingRule } = useSalaryRule(isNew ? '' : (id as string));

  // Load structure detail to know earlier rules for identifier recommendations
  const activeStructureId = isNew ? selectedStructureId : existingRule?.salaryStructureId;
  const { data: currentStructure } = useSalaryStructure(activeStructureId || '');

  // Mutations
  const createMutation = useCreateSalaryRule();
  const updateMutation = useUpdateSalaryRule();
  const statusMutation = useUpdateSalaryRuleStatus();

  // Populate data when editing
  useEffect(() => {
    if (existingRule) {
      setSelectedStructureId(existingRule.salaryStructureId);
      setName(existingRule.name);
      setCode(existingRule.code);
      setCategory(existingRule.category);
      setSequence(existingRule.sequence);
      setMethod(existingRule.method);
      setStatus(existingRule.status);
      setFixedAmount(existingRule.fixedAmount || '');
      setPercentageRate(existingRule.percentageRate || '');
      setPercentageBase(existingRule.percentageBase || 'BASIC');
      setFormula(existingRule.formula || '');
    } else if (isNew && initialStructureId) {
      setSelectedStructureId(initialStructureId);
    }
  }, [existingRule, isNew, initialStructureId]);

  // Set default next sequence when creating a new rule in a structure
  useEffect(() => {
    if (isNew && currentStructure?.rules?.length) {
      const maxSeq = Math.max(...currentStructure.rules.map((r) => r.sequence));
      setSequence(maxSeq + 10);
    }
  }, [isNew, currentStructure]);

  // Calculate available earlier active rule codes for base / formula selection
  const earlierActiveRules = (currentStructure?.rules || []).filter(
    (r) => r.status === 'ACTIVE' && r.sequence < sequence && r.code !== code
  );

  const availableIdentifiers = [
    ...SalaryFormulaBuiltinValues,
    ...earlierActiveRules.map((r) => r.code),
  ];

  const handleInsertIdentifier = (ident: string) => {
    if (!isManagerOrAdmin) return;
    if (formulaInputRef.current) {
      const input = formulaInputRef.current;
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const currentText = formula;
      const before = currentText.substring(0, start);
      const after = currentText.substring(end);
      const separator = before.length > 0 && !before.endsWith(' ') ? ' ' : '';
      const newText = `${before}${separator}${ident} ${after}`;
      setFormula(newText);
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(
          start + separator.length + ident.length + 1,
          start + separator.length + ident.length + 1
        );
      }, 0);
    } else {
      setFormula((prev) => (prev ? `${prev} + ${ident}` : ident));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackError(null);
    setFeedbackSuccess(null);

    if (!selectedStructureId) {
      setFeedbackError('Please select a Salary Structure');
      return;
    }

    const payload = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      category,
      sequence: Number(sequence),
      method,
      fixedAmount: method === 'FIXED' ? fixedAmount.trim() : null,
      percentageRate: method === 'PERCENTAGE' ? percentageRate.trim() : null,
      percentageBase: method === 'PERCENTAGE' ? percentageBase.trim().toUpperCase() : null,
      formula: method === 'FORMULA' ? formula.trim() : null,
      status,
    };

    try {
      if (isNew) {
        const created = await createMutation.mutateAsync({
          structureId: selectedStructureId,
          input: payload,
        });
        navigate(`/payroll/rules/${created.id}`);
      } else if (id) {
        await updateMutation.mutateAsync({
          id,
          input: payload,
        });
        setFeedbackSuccess('Salary rule updated successfully');
      }
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to save salary rule');
    }
  };

  const handleToggleStatus = async () => {
    if (!id || isNew || !existingRule) return;
    setFeedbackError(null);
    setFeedbackSuccess(null);
    const nextStatus: RecordStatus =
      existingRule.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await statusMutation.mutateAsync({ id, status: nextStatus });
      setFeedbackSuccess(`Rule marked as ${nextStatus}`);
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to update rule status');
    }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <Link
          to={
            selectedStructureId
              ? `/payroll/structures/${selectedStructureId}`
              : '/payroll/rules'
          }
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate hover:text-navy transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {selectedStructureId ? 'Back to Structure' : 'Back to Salary Rules'}
        </Link>

        {isLoadingRule ? (
          <div className="bg-white border border-border rounded-xl p-12 text-center shadow-sm">
            <RefreshCw className="w-8 h-8 text-accent animate-spin mx-auto mb-3" />
            <p className="text-slate text-sm font-medium">Loading rule details...</p>
          </div>
        ) : (
          <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-6 sm:p-8 border-b border-border bg-surface/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-navy/5 flex items-center justify-center text-navy">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl font-display font-bold text-navy">
                    {isNew ? 'Create Salary Rule' : `Rule: ${existingRule?.name || code}`}
                  </h1>
                  <p className="text-slate text-xs mt-0.5">
                    {isNew
                      ? 'Configure a new computation or fixed allowance rule for a salary structure.'
                      : `Configured under structure "${existingRule?.salaryStructure.name}".`}
                  </p>
                </div>
              </div>

              {!isNew && isManagerOrAdmin && (
                <button
                  type="button"
                  onClick={handleToggleStatus}
                  disabled={statusMutation.isPending}
                  className={`px-3.5 py-1.5 border rounded-lg text-xs font-semibold transition-colors ${
                    status === 'ACTIVE'
                      ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                      : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  {status === 'ACTIVE' ? 'Deactivate Rule' : 'Activate Rule'}
                </button>
              )}
            </div>

            {/* Feedback Alerts */}
            {feedbackError && (
              <div className="m-6 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-sm flex items-start gap-3 shadow-sm">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Error</p>
                  <p className="text-rose-700 text-xs mt-0.5">{feedbackError}</p>
                </div>
                <button
                  onClick={() => setFeedbackError(null)}
                  className="text-xs text-rose-500 hover:text-rose-700 font-semibold"
                >
                  Dismiss
                </button>
              </div>
            )}

            {feedbackSuccess && (
              <div className="m-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-start gap-3 shadow-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Success</p>
                  <p className="text-emerald-700 text-xs mt-0.5">{feedbackSuccess}</p>
                </div>
                <button
                  onClick={() => setFeedbackSuccess(null)}
                  className="text-xs text-emerald-500 hover:text-emerald-700 font-semibold"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
              {/* Structure Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                    Salary Structure <span className="text-rose-500">*</span>
                  </label>
                  {isNew ? (
                    <select
                      required
                      value={selectedStructureId}
                      onChange={(e) => setSelectedStructureId(e.target.value)}
                      className="w-full px-3.5 py-2 border border-border rounded-lg text-sm bg-white text-navy focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                    >
                      <option value="">Select Salary Structure...</option>
                      {structuresData?.items.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.status})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      disabled
                      value={existingRule?.salaryStructure.name || ''}
                      className="w-full px-3.5 py-2 border border-border rounded-lg text-sm bg-surface text-slate cursor-not-allowed"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                    Status
                  </label>
                  <select
                    disabled={!isManagerOrAdmin}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as RecordStatus)}
                    className="w-full px-3.5 py-2 border border-border rounded-lg text-sm bg-white text-navy focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent disabled:bg-surface disabled:cursor-not-allowed"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              {/* Name, Code, Category, Sequence */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                    Rule Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!isManagerOrAdmin}
                    placeholder="e.g. Basic Salary, House Rent Allowance"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2 border border-border rounded-lg text-sm text-navy focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent disabled:bg-surface"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                    Rule Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!isManagerOrAdmin}
                    placeholder="e.g. BASIC, HRA, PF"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2 border border-border rounded-lg font-mono text-sm text-navy uppercase focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent disabled:bg-surface"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                    Sequence <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={1000000}
                    disabled={!isManagerOrAdmin}
                    value={sequence}
                    onChange={(e) => setSequence(parseInt(e.target.value, 10) || 10)}
                    className="w-full px-3.5 py-2 border border-border rounded-lg text-sm text-navy focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent disabled:bg-surface"
                  />
                </div>
              </div>

              {/* Category & Computation Method */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border">
                <div>
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                    Category
                  </label>
                  <select
                    disabled={!isManagerOrAdmin}
                    value={category}
                    onChange={(e) => setCategory(e.target.value as SalaryRuleCategory)}
                    className="w-full px-3.5 py-2 border border-border rounded-lg text-sm bg-white text-navy focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent disabled:bg-surface"
                  >
                    {SalaryRuleCategoryValues.map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]} ({cat})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                    Computation Method <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['FIXED', 'PERCENTAGE', 'FORMULA'] as SalaryRuleMethod[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        disabled={!isManagerOrAdmin}
                        onClick={() => setMethod(m)}
                        className={`flex items-center justify-center gap-1.5 py-2 px-3 border rounded-lg text-xs font-semibold transition-colors ${
                          method === m
                            ? 'bg-navy text-white border-navy'
                            : 'bg-white text-slate hover:bg-surface border-border'
                        } disabled:cursor-not-allowed`}
                      >
                        {m === 'FIXED' && <Coins className="w-3.5 h-3.5" />}
                        {m === 'PERCENTAGE' && <Percent className="w-3.5 h-3.5" />}
                        {m === 'FORMULA' && <Calculator className="w-3.5 h-3.5" />}
                        {METHOD_LABELS[m]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Dynamic Method Configuration Section */}
              <div className="p-5 bg-surface/40 border border-border rounded-xl space-y-4">
                <h3 className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  Method Configuration: {METHOD_LABELS[method]}
                </h3>

                {method === 'FIXED' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">
                      Fixed Amount ({currentStructure?.currency || 'INR'}) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative max-w-xs">
                      <input
                        type="text"
                        required
                        disabled={!isManagerOrAdmin}
                        placeholder="e.g. 2000.00"
                        value={fixedAmount}
                        onChange={(e) => setFixedAmount(e.target.value)}
                        className="w-full px-3.5 py-2 border border-border rounded-lg font-mono text-sm text-navy focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent disabled:bg-surface"
                      />
                    </div>
                    <p className="text-xs text-slate mt-1">
                      Fixed monetary value stored as canonical decimal string (e.g. 2000.00).
                    </p>
                  </div>
                )}

                {method === 'PERCENTAGE' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">
                        Percentage Rate (%) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          disabled={!isManagerOrAdmin}
                          placeholder="e.g. 20 for 20%, 12 for 12%"
                          value={percentageRate}
                          onChange={(e) => setPercentageRate(e.target.value)}
                          className="w-full px-3.5 py-2 border border-border rounded-lg font-mono text-sm text-navy focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent disabled:bg-surface"
                        />
                      </div>
                      <p className="text-xs text-slate mt-1">
                        Enter a rate from 0 to 1000 with up to 4 decimal places.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">
                        Percentage Base <span className="text-rose-500">*</span>
                      </label>
                      <select
                        required
                        disabled={!isManagerOrAdmin}
                        value={percentageBase}
                        onChange={(e) => setPercentageBase(e.target.value)}
                        className="w-full px-3.5 py-2 border border-border rounded-lg font-mono text-sm bg-white text-navy focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent disabled:bg-surface"
                      >
                        <optgroup label="Built-in Identifiers">
                          {SalaryFormulaBuiltinValues.map((builtin) => (
                            <option key={builtin} value={builtin}>
                              {builtin}
                            </option>
                          ))}
                        </optgroup>
                        {earlierActiveRules.length > 0 && (
                          <optgroup label="Earlier Active Rules">
                            {earlierActiveRules.map((r) => (
                              <option key={r.code} value={r.code}>
                                {r.code} ({r.name})
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      <p className="text-xs text-slate mt-1">
                        Must reference a built-in variable or an earlier active rule code in this structure.
                      </p>
                    </div>
                  </div>
                )}

                {method === 'FORMULA' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">
                        Formula Expression <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        ref={formulaInputRef}
                        required
                        rows={3}
                        disabled={!isManagerOrAdmin}
                        placeholder="e.g. BASIC + HRA + MEAL + OT, or PRORATED_BASIC"
                        value={formula}
                        onChange={(e) => setFormula(e.target.value)}
                        className="w-full px-3.5 py-2 border border-border rounded-lg font-mono text-sm text-navy focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent disabled:bg-surface"
                      />
                    </div>

                    {/* Available Identifiers helper pills */}
                    <div>
                      <p className="text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                        Available Identifiers (click to insert):
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {availableIdentifiers.map((ident) => (
                          <button
                            key={ident}
                            type="button"
                            disabled={!isManagerOrAdmin}
                            onClick={() => handleInsertIdentifier(ident)}
                            className="px-2.5 py-1 bg-white hover:bg-navy/5 border border-border rounded-md font-mono text-xs text-navy hover:text-accent font-medium shadow-2xs transition-colors"
                          >
                            + {ident}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Form Action Buttons */}
              {isManagerOrAdmin && (
                <div className="flex items-center justify-end gap-3 pt-6 border-t border-border">
                  <Link
                    to={
                      selectedStructureId
                        ? `/payroll/structures/${selectedStructureId}`
                        : '/payroll/rules'
                    }
                    className="px-4 py-2 border border-border rounded-lg text-xs font-semibold text-slate hover:text-navy hover:bg-surface transition-colors"
                  >
                    Cancel
                  </Link>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-navy hover:bg-navy/90 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {createMutation.isPending || updateMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {isNew ? 'Create Salary Rule' : 'Save Changes'}
                  </button>
                </div>
              )}
            </form>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
