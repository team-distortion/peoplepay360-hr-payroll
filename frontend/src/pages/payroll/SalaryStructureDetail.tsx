import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  ArrowUp,
  ArrowDown,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Layers,
  Settings2,
  Edit2,
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../context/AuthContext';
import {
  useSalaryStructure,
  useCreateSalaryStructure,
  useUpdateSalaryStructure,
  useUpdateSalaryStructureStatus,
  useUpdateSalaryRuleConfiguration,
} from '../../features/salary-config/salary-config.queries';
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  METHOD_LABELS,
  METHOD_COLORS,
  formatRuleConfiguration,
} from '../../features/salary-config/salary-config.format';
import type { SalaryRuleDto, RecordStatus } from '@peoplepay360/shared';

export default function SalaryStructureDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isManagerOrAdmin =
    user?.role === 'HR_PAYROLL_MANAGER' || user?.role === 'ADMIN';

  const isNew = id === 'new' || !id;

  // New Structure Form State
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newStatus, setNewStatus] = useState<RecordStatus>('ACTIVE');

  // Existing Structure Edit State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rulesOrder, setRulesOrder] = useState<SalaryRuleDto[]>([]);
  const [hasReordered, setHasReordered] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  const { data: structure, isLoading, isError, error } = useSalaryStructure(
    isNew ? '' : (id as string)
  );

  const createMutation = useCreateSalaryStructure();
  const updateMutation = useUpdateSalaryStructure();
  const statusMutation = useUpdateSalaryStructureStatus();
  const reorderMutation = useUpdateSalaryRuleConfiguration();

  useEffect(() => {
    if (structure) {
      setName(structure.name);
      setDescription(structure.description || '');
      setRulesOrder(structure.rules || []);
      setHasReordered(false);
    }
  }, [structure]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackError(null);
    try {
      const created = await createMutation.mutateAsync({
        name: newName.trim(),
        description: newDescription.trim() || null,
        status: newStatus,
      });
      navigate(`/payroll/structures/${created.id}`);
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to create structure');
    }
  };

  const handleUpdateDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || isNew) return;
    setFeedbackError(null);
    setFeedbackSuccess(null);
    try {
      await updateMutation.mutateAsync({
        id,
        input: {
          name: name.trim(),
          description: description.trim() || null,
          status: structure?.status || 'ACTIVE',
        },
      });
      setFeedbackSuccess('Structure details updated successfully');
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to update structure');
    }
  };

  const handleToggleStatus = async () => {
    if (!id || !structure) return;
    setFeedbackError(null);
    setFeedbackSuccess(null);
    const nextStatus: RecordStatus =
      structure.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await statusMutation.mutateAsync({ id, status: nextStatus });
      setFeedbackSuccess(`Structure marked as ${nextStatus}`);
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to update structure status');
    }
  };

  const handleMoveRule = (index: number, direction: 'up' | 'down') => {
    if (!isManagerOrAdmin) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rulesOrder.length) return;

    const newRules = [...rulesOrder];
    const item = newRules[index];
    const targetItem = newRules[targetIndex];

    // Swap sequence numbers to maintain ascending order
    const tempSeq = item.sequence;
    item.sequence = targetItem.sequence;
    targetItem.sequence = tempSeq;

    newRules[index] = targetItem;
    newRules[targetIndex] = item;

    // Ensure sorted by sequence
    newRules.sort((a, b) => a.sequence - b.sequence);

    setRulesOrder(newRules);
    setHasReordered(true);
  };

  const handleSaveOrder = async () => {
    if (!id || !isManagerOrAdmin) return;
    setFeedbackError(null);
    setFeedbackSuccess(null);
    try {
      await reorderMutation.mutateAsync({
        structureId: id,
        input: {
          rules: rulesOrder.map((r) => ({
            id: r.id,
            name: r.name,
            code: r.code,
            category: r.category,
            sequence: r.sequence,
            method: r.method,
            fixedAmount: r.fixedAmount,
            percentageRate: r.percentageRate,
            percentageBase: r.percentageBase,
            formula: r.formula,
            status: r.status,
          })),
        },
      });
      setHasReordered(false);
      setFeedbackSuccess('Rule configuration and order saved successfully');
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to save rule ordering');
    }
  };

  const handleResetOrder = () => {
    if (structure?.rules) {
      setRulesOrder([...structure.rules]);
      setHasReordered(false);
    }
  };

  if (isNew) {
    return (
      <AppLayout>
        <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            to="/payroll/structures"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate hover:text-navy transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Salary Structures
          </Link>

          <div className="bg-white border border-border rounded-xl shadow-sm p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-border">
              <div className="w-10 h-10 rounded-lg bg-navy/5 flex items-center justify-center text-navy">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-display font-bold text-navy">
                  Create Salary Structure
                </h1>
                <p className="text-slate text-xs mt-0.5">
                  Define a new salary structure draft. You can add and order rules after creating it.
                </p>
              </div>
            </div>

            {feedbackError && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Creation Error</p>
                  <p>{feedbackError}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                  Structure Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Regular Salary, Executive Structure, Part-time"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-lg text-sm text-navy focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Brief description of who this structure applies to..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-lg text-sm text-navy focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                  Initial Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as RecordStatus)}
                  className="px-4 py-2.5 border border-border rounded-lg text-sm bg-white text-navy focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                >
                  <option value="ACTIVE">ACTIVE (Draft)</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
                <p className="text-xs text-slate mt-1">
                  Note: A structure created as ACTIVE with 0 rules is allowed as a draft, but must have valid active rules before assignment.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <Link
                  to="/payroll/structures"
                  className="px-4 py-2 border border-border rounded-lg text-xs font-semibold text-slate hover:text-navy hover:bg-surface transition-colors"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={createMutation.isPending || !newName.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-navy hover:bg-navy/90 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {createMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Create Structure
                </button>
              </div>
            </form>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col">
        {/* Navigation / Header */}
        <Link
          to="/payroll/structures"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate hover:text-navy transition-colors mb-6 self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Salary Structures
        </Link>

        {isLoading ? (
          <div className="bg-white border border-border rounded-xl p-12 text-center shadow-sm">
            <RefreshCw className="w-8 h-8 text-accent animate-spin mx-auto mb-3" />
            <p className="text-slate text-sm font-medium">Loading structure details...</p>
          </div>
        ) : isError || !structure ? (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-8 text-center">
            <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-3" />
            <p className="text-rose-800 font-semibold mb-1">Failed to load structure</p>
            <p className="text-rose-600 text-sm mb-4">
              {(error as any)?.message || 'Salary structure was not found'}
            </p>
            <Link
              to="/payroll/structures"
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg inline-block transition-colors"
            >
              Return to Structures
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Feedback Alerts */}
            {feedbackError && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-start gap-3 shadow-sm">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Operation Error</p>
                  <p className="text-rose-700 mt-0.5">{feedbackError}</p>
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
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-start gap-3 shadow-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Success</p>
                  <p className="text-emerald-700 mt-0.5">{feedbackSuccess}</p>
                </div>
                <button
                  onClick={() => setFeedbackSuccess(null)}
                  className="text-xs text-emerald-500 hover:text-emerald-700 font-semibold"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Structure Metadata Card */}
            <div className="bg-white border border-border rounded-xl shadow-sm p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-display font-bold text-navy">
                      {structure.name}
                    </h1>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        structure.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {structure.status}
                    </span>
                  </div>
                  <p className="text-slate text-sm mt-1">
                    {structure.description || 'No description provided.'}
                  </p>
                </div>

                {isManagerOrAdmin && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleToggleStatus}
                      disabled={statusMutation.isPending}
                      className={`px-4 py-2 border rounded-lg text-xs font-semibold transition-colors ${
                        structure.status === 'ACTIVE'
                          ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                          : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      {structure.status === 'ACTIVE' ? 'Deactivate Structure' : 'Activate Structure'}
                    </button>
                  </div>
                )}
              </div>

              {/* Edit Structure Details */}
              {isManagerOrAdmin && (
                <form onSubmit={handleUpdateDetails} className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">
                      Structure Name
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3.5 py-2 border border-border rounded-lg text-sm text-navy focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                    />
                  </div>
                  <div className="md:col-span-2 flex items-end gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">
                        Description
                      </label>
                      <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full px-3.5 py-2 border border-border rounded-lg text-sm text-navy focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={updateMutation.isPending || !name.trim()}
                      className="px-4 py-2 bg-surface hover:bg-surface/80 border border-border text-navy text-xs font-semibold rounded-lg transition-colors shrink-0"
                    >
                      {updateMutation.isPending ? 'Saving...' : 'Update Details'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Reorder Unsaves Notice */}
            {hasReordered && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in fade-in duration-200">
                <div className="flex items-center gap-3 text-amber-800 text-sm">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <p className="font-semibold">Unsaved rule reordering</p>
                    <p className="text-xs text-amber-700">
                      You have modified the sequence of rules. Click Save Configuration to atomically persist changes.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={handleResetOrder}
                    className="px-3 py-1.5 border border-amber-300 text-amber-800 hover:bg-amber-100 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Discard
                  </button>
                  <button
                    onClick={handleSaveOrder}
                    disabled={reorderMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                  >
                    {reorderMutation.isPending ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    Save Configuration
                  </button>
                </div>
              </div>
            )}

            {/* Ordered Rules Section */}
            <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface/30">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-navy" />
                  <h2 className="text-base font-semibold text-navy">
                    Ordered Salary Rules ({rulesOrder.length})
                  </h2>
                </div>

                {isManagerOrAdmin && (
                  <Link
                    to={`/payroll/rules/new?salaryStructureId=${id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-navy hover:bg-navy/90 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Rule
                  </Link>
                )}
              </div>

              {rulesOrder.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-slate text-sm font-medium mb-4">
                    No rules have been added to this salary structure yet.
                  </p>
                  {isManagerOrAdmin && (
                    <Link
                      to={`/payroll/rules/new?salaryStructureId=${id}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent/90 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add First Rule
                    </Link>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface/50 text-slate font-semibold text-xs tracking-wider uppercase">
                        <th className="py-3 px-4 w-16 text-center">Seq</th>
                        <th className="py-3 px-6">Rule Code</th>
                        <th className="py-3 px-6">Name</th>
                        <th className="py-3 px-6">Category</th>
                        <th className="py-3 px-6">Method</th>
                        <th className="py-3 px-6">Computation / Value</th>
                        <th className="py-3 px-6">Status</th>
                        {isManagerOrAdmin && (
                          <th className="py-3 px-6 text-right">Reorder & Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-sans">
                      {rulesOrder.map((rule, idx) => {
                        const catStyle = CATEGORY_COLORS[rule.category];
                        const methodStyle = METHOD_COLORS[rule.method];

                        return (
                          <tr
                            key={rule.id}
                            className="hover:bg-surface/50 transition-colors group"
                          >
                            <td className="py-3.5 px-4 text-center font-mono font-semibold text-xs text-slate">
                              {rule.sequence}
                            </td>
                            <td className="py-3.5 px-6 font-mono font-bold text-xs text-navy">
                              {rule.code}
                            </td>
                            <td className="py-3.5 px-6 font-medium text-navy">
                              <Link
                                to={`/payroll/rules/${rule.id}`}
                                className="hover:text-accent hover:underline"
                              >
                                {rule.name}
                              </Link>
                            </td>
                            <td className="py-3.5 px-6">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                              >
                                {CATEGORY_LABELS[rule.category]}
                              </span>
                            </td>
                            <td className="py-3.5 px-6">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${methodStyle.bg} ${methodStyle.text} ${methodStyle.border}`}
                              >
                                {METHOD_LABELS[rule.method]}
                              </span>
                            </td>
                            <td className="py-3.5 px-6 font-mono text-xs text-navy max-w-xs truncate">
                              {formatRuleConfiguration(rule, structure.currency)}
                            </td>
                            <td className="py-3.5 px-6">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  rule.status === 'ACTIVE'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {rule.status}
                              </span>
                            </td>
                            {isManagerOrAdmin && (
                              <td className="py-3.5 px-6 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleMoveRule(idx, 'up')}
                                    disabled={idx === 0}
                                    className="p-1 border border-border rounded text-slate hover:text-navy hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    title="Move Up"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveRule(idx, 'down')}
                                    disabled={idx === rulesOrder.length - 1}
                                    className="p-1 border border-border rounded text-slate hover:text-navy hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    title="Move Down"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                  </button>
                                  <Link
                                    to={`/payroll/rules/${rule.id}`}
                                    className="p-1 border border-border rounded text-slate hover:text-navy hover:bg-surface transition-colors"
                                    title="Edit Rule"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </Link>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
