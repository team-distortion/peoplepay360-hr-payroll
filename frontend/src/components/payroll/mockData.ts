// ── Types ──────────────────────────────────────────────────────

export type RuleCategory = 'Basic' | 'Allowance' | 'Deduction' | 'Gross' | 'Net';
export type ComputationType = 'fixed' | 'percentage' | 'formula';

export interface SalaryRule {
  id: string;
  name: string;
  code: string;
  category: RuleCategory;
  sequence: number;
  active: boolean;
  computationType: ComputationType;
  fixedAmount?: number;
  percentage?: number;
  percentageOfRuleId?: string;
  formula?: string;
}

export interface StructureRule {
  ruleId: string;
  sequence: number;
}

export interface SalaryStructure {
  id: string;
  name: string;
  active: boolean;
  rules: StructureRule[];
  employeeCount: number;
}

export type PayrunStatus = 'Draft' | 'Validated' | 'Paid';
export type PayslipStatus = 'Draft' | 'Done' | 'Paid';

export interface PayslipLine {
  ruleId: string;
  ruleName: string;
  ruleCode: string;
  category: RuleCategory;
  amount: number;
}

export interface Payslip {
  id: string;
  payrunId: string;
  employeeId: string;
  employeeName: string;
  structureId: string;
  structureName: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  status: PayslipStatus;
  warnings: string[];
  workedDays: number;
  lines: PayslipLine[];
  basic: number;
  gross: number;
  net: number;
}

export interface Payrun {
  id: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  structureId: string;
  structureName: string;
  status: PayrunStatus;
  employeeCount: number;
  warningCount: number;
}

export interface MockEmployee {
  id: string;
  name: string;
  workingHours: string;
  startDate: string;
  wage: number;
}

// ── Helpers ────────────────────────────────────────────────────

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ── Seed Data ──────────────────────────────────────────────────

export const MOCK_RULES: SalaryRule[] = [
  {
    id: 'rule-1',
    name: 'Basic Salary',
    code: 'BASIC',
    category: 'Basic',
    sequence: 1,
    active: true,
    computationType: 'fixed',
    fixedAmount: 950000,
  },
  {
    id: 'rule-2',
    name: 'House Rent Allowance',
    code: 'HRA',
    category: 'Allowance',
    sequence: 2,
    active: true,
    computationType: 'percentage',
    percentage: 40,
    percentageOfRuleId: 'rule-1',
  },
  {
    id: 'rule-3',
    name: 'Standard Allowance',
    code: 'STD',
    category: 'Allowance',
    sequence: 3,
    active: true,
    computationType: 'fixed',
    fixedAmount: 50000,
  },
  {
    id: 'rule-4',
    name: 'Transport Allowance',
    code: 'TA',
    category: 'Allowance',
    sequence: 4,
    active: true,
    computationType: 'fixed',
    fixedAmount: 19200,
  },
  {
    id: 'rule-5',
    name: 'Gross Salary',
    code: 'GROSS',
    category: 'Gross',
    sequence: 5,
    active: true,
    computationType: 'formula',
    formula: 'BASIC + HRA + STD + TA',
  },
  {
    id: 'rule-6',
    name: 'Provident Fund',
    code: 'PF',
    category: 'Deduction',
    sequence: 6,
    active: true,
    computationType: 'percentage',
    percentage: 12,
    percentageOfRuleId: 'rule-1',
  },
  {
    id: 'rule-7',
    name: 'Professional Tax',
    code: 'PT',
    category: 'Deduction',
    sequence: 7,
    active: true,
    computationType: 'fixed',
    fixedAmount: 2500,
  },
  {
    id: 'rule-8',
    name: 'Net Salary',
    code: 'NET',
    category: 'Net',
    sequence: 8,
    active: true,
    computationType: 'formula',
    formula: 'GROSS - PF - PT',
  },
];

export const MOCK_STRUCTURES: SalaryStructure[] = [
  {
    id: 'struct-1',
    name: 'United States: Regular Pay',
    active: true,
    rules: [
      { ruleId: 'rule-1', sequence: 1 },
      { ruleId: 'rule-2', sequence: 2 },
      { ruleId: 'rule-3', sequence: 3 },
      { ruleId: 'rule-4', sequence: 4 },
      { ruleId: 'rule-5', sequence: 5 },
      { ruleId: 'rule-6', sequence: 6 },
      { ruleId: 'rule-7', sequence: 7 },
      { ruleId: 'rule-8', sequence: 8 },
    ],
    employeeCount: 42,
  },
  {
    id: 'struct-2',
    name: 'Contractor: Hourly',
    active: true,
    rules: [
      { ruleId: 'rule-1', sequence: 1 },
      { ruleId: 'rule-5', sequence: 2 },
      { ruleId: 'rule-8', sequence: 3 },
    ],
    employeeCount: 8,
  },
  {
    id: 'struct-3',
    name: 'Intern Stipend',
    active: false,
    rules: [
      { ruleId: 'rule-1', sequence: 1 },
    ],
    employeeCount: 0,
  },
];

export const MOCK_EMPLOYEES: MockEmployee[] = [
  { id: 'emp-1', name: 'Aarav Mehta', workingHours: '40 hours/week', startDate: 'Jan 1', wage: 4500 },
  { id: 'emp-2', name: 'Sara Khan', workingHours: '40 hours/week', startDate: 'Jan 1', wage: 5200 },
  { id: 'emp-3', name: 'John Dsouza', workingHours: '40 hours/week', startDate: 'Jan 1', wage: 4800 },
  { id: 'emp-4', name: 'Priya Sharma', workingHours: '40 hours/week', startDate: 'Feb 1', wage: 6100 },
  { id: 'emp-5', name: 'Anita Oliver', workingHours: '40 hours/week', startDate: 'Jan 1', wage: 4500 },
  { id: 'emp-6', name: 'Raj Patel', workingHours: '32 hours/week', startDate: 'Mar 1', wage: 3800 },
  { id: 'emp-7', name: 'Maya Chen', workingHours: '40 hours/week', startDate: 'Jan 1', wage: 5500 },
  { id: 'emp-8', name: 'David Kim', workingHours: '40 hours/week', startDate: 'Jan 1', wage: 4900 },
];

function buildPayslipLines(structureId: string): PayslipLine[] {
  const structure = MOCK_STRUCTURES.find(s => s.id === structureId);
  if (!structure) return [];
  return structure.rules.map(sr => {
    const rule = MOCK_RULES.find(r => r.id === sr.ruleId)!;
    let amount = 0;
    if (rule.computationType === 'fixed') {
      amount = rule.fixedAmount ?? 0;
    } else if (rule.computationType === 'percentage') {
      const base = MOCK_RULES.find(r => r.id === rule.percentageOfRuleId);
      amount = ((rule.percentage ?? 0) / 100) * (base?.fixedAmount ?? 0);
    } else if (rule.code === 'GROSS') {
      amount = 950000 + 380000 + 50000 + 19200;
    } else if (rule.code === 'NET') {
      amount = (950000 + 380000 + 50000 + 19200) - 114000 - 2500;
    }
    if (rule.category === 'Deduction') amount = -Math.abs(amount);
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      ruleCode: rule.code,
      category: rule.category,
      amount,
    };
  });
}

const januaryLines = buildPayslipLines('struct-1');
const janBasic = Math.abs(januaryLines.find(l => l.ruleCode === 'BASIC')?.amount ?? 0);
const janGross = Math.abs(januaryLines.find(l => l.ruleCode === 'GROSS')?.amount ?? 0);
const janNet = Math.abs(januaryLines.find(l => l.ruleCode === 'NET')?.amount ?? 0);

export const MOCK_PAYSLIPS: Payslip[] = [
  {
    id: 'slip-1',
    payrunId: 'pr-1',
    employeeId: 'emp-1',
    employeeName: 'Aarav Mehta',
    structureId: 'struct-1',
    structureName: 'Regular',
    periodStart: '01-Jan-2026',
    periodEnd: '31-Jan-2026',
    periodLabel: 'January 2026',
    status: 'Paid',
    warnings: [],
    workedDays: 22,
    lines: januaryLines,
    basic: janBasic,
    gross: janGross,
    net: janNet,
  },
  {
    id: 'slip-2',
    payrunId: 'pr-1',
    employeeId: 'emp-2',
    employeeName: 'Sara Khan',
    structureId: 'struct-1',
    structureName: 'Regular',
    periodStart: '01-Jan-2026',
    periodEnd: '31-Jan-2026',
    periodLabel: 'January 2026',
    status: 'Paid',
    warnings: ['Alt missing'],
    workedDays: 22,
    lines: januaryLines,
    basic: janBasic,
    gross: janGross,
    net: janNet,
  },
  {
    id: 'slip-3',
    payrunId: 'pr-2',
    employeeId: 'emp-1',
    employeeName: 'Aarav Mehta',
    structureId: 'struct-1',
    structureName: 'Regular',
    periodStart: '01-Feb-2026',
    periodEnd: '28-Feb-2026',
    periodLabel: 'February 2026',
    status: 'Draft',
    warnings: [],
    workedDays: 20,
    lines: januaryLines,
    basic: janBasic,
    gross: janGross,
    net: janNet,
  },
  {
    id: 'slip-4',
    payrunId: 'pr-2',
    employeeId: 'emp-5',
    employeeName: 'Anita Oliver',
    structureId: 'struct-1',
    structureName: 'Regular',
    periodStart: '01-Feb-2026',
    periodEnd: '28-Feb-2026',
    periodLabel: 'February 2026',
    status: 'Draft',
    warnings: ['Duplicate'],
    workedDays: 20,
    lines: januaryLines,
    basic: janBasic,
    gross: janGross,
    net: janNet,
  },
  {
    id: 'slip-5',
    payrunId: 'pr-2',
    employeeId: 'emp-3',
    employeeName: 'John Dsouza',
    structureId: 'struct-1',
    structureName: 'Regular',
    periodStart: '01-Feb-2026',
    periodEnd: '28-Feb-2026',
    periodLabel: 'February 2026',
    status: 'Done',
    warnings: [],
    workedDays: 20,
    lines: januaryLines,
    basic: janBasic,
    gross: janGross,
    net: janNet,
  },
];

export const MOCK_PAYRUNS: Payrun[] = [
  {
    id: 'pr-1',
    periodLabel: 'January 2026',
    periodStart: '01-Jan-2026',
    periodEnd: '31-Jan-2026',
    structureId: 'struct-1',
    structureName: 'United States: Regular Pay',
    status: 'Paid',
    employeeCount: 2,
    warningCount: 1,
  },
  {
    id: 'pr-2',
    periodLabel: 'February 2026',
    periodStart: '01-Feb-2026',
    periodEnd: '28-Feb-2026',
    structureId: 'struct-1',
    structureName: 'United States: Regular Pay',
    status: 'Draft',
    employeeCount: 3,
    warningCount: 1,
  },
];
