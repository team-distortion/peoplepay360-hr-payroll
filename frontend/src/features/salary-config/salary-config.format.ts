import type {
  SalaryRuleCategory,
  SalaryRuleDto,
  SalaryRuleMethod,
} from '@peoplepay360/shared';

export const CATEGORY_LABELS: Record<SalaryRuleCategory, string> = {
  BASIC: 'Basic',
  ALLOWANCE: 'Allowance',
  OVERTIME: 'Overtime',
  GROSS: 'Gross',
  DEDUCTION: 'Deduction',
  CONTRIBUTION: 'Contribution',
  NET: 'Net',
};

export const CATEGORY_COLORS: Record<SalaryRuleCategory, { bg: string; text: string; border: string }> = {
  BASIC: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  ALLOWANCE: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  OVERTIME: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  GROSS: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  DEDUCTION: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  CONTRIBUTION: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  NET: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
};

export const METHOD_LABELS: Record<SalaryRuleMethod, string> = {
  FIXED: 'Fixed Amount',
  PERCENTAGE: 'Percentage',
  FORMULA: 'Formula',
};

export const METHOD_COLORS: Record<SalaryRuleMethod, { bg: string; text: string; border: string }> = {
  FIXED: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
  PERCENTAGE: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  FORMULA: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
};

export function formatRuleConfiguration(rule: Pick<SalaryRuleDto, 'method' | 'fixedAmount' | 'percentageRate' | 'percentageBase' | 'formula'>, currency = 'INR'): string {
  if (rule.method === 'FIXED') {
    const amount = rule.fixedAmount ?? '0.00';
    return `${currency} ${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (rule.method === 'PERCENTAGE') {
    const rate = rule.percentageRate ? parseFloat(rule.percentageRate).toString() : '0';
    return `${rate}% of ${rule.percentageBase || '—'}`;
  }
  if (rule.method === 'FORMULA') {
    return rule.formula || '—';
  }
  return '—';
}
