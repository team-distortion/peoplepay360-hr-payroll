// ── Types ──────────────────────────────────────────────────────

export type RuleCategory = 'Basic' | 'Allowance' | 'Deduction' | 'Gross' | 'Net';
export type ComputationMode = 'Fixed Amount' | 'Percentage of Wage' | 'Python Code';

export interface SalaryRule {
  id: string;
  name: string;
  code: string;
  category: RuleCategory;
  structureId: string;
  structureName: string;
  sequence: number;
  sortBy: number;
  active: boolean;
  computation: ComputationMode;
  amount?: number;
  percentage?: number;
  pythonCode?: string;
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
  net: number; // Also known as Alt / Alt Salary
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
  const isNeg = amount < 0;
  const absFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  return isNeg ? `-${absFormatted}` : absFormatted;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ── Seed Data ──────────────────────────────────────────────────

export const MOCK_STRUCTURES: SalaryStructure[] = [
  {
    id: 'struct-1',
    name: 'Regular Salary',
    active: true,
    rules: [
      { ruleId: 'rule-1', sequence: 10 },
      { ruleId: 'rule-2', sequence: 20 },
      { ruleId: 'rule-3', sequence: 30 },
      { ruleId: 'rule-4', sequence: 40 },
      { ruleId: 'rule-5', sequence: 50 },
      { ruleId: 'rule-6', sequence: 60 },
      { ruleId: 'rule-7', sequence: 70 },
      { ruleId: 'rule-8', sequence: 80 },
      { ruleId: 'rule-9', sequence: 90 },
      { ruleId: 'rule-10', sequence: 100 },
      { ruleId: 'rule-11', sequence: 110 },
    ],
    employeeCount: 6,
  },
  {
    id: 'struct-2',
    name: 'Sales Salary',
    active: true,
    rules: [
      { ruleId: 'rule-1', sequence: 10 },
      { ruleId: 'rule-4', sequence: 20 },
      { ruleId: 'rule-7', sequence: 30 },
      { ruleId: 'rule-10', sequence: 40 },
      { ruleId: 'rule-11', sequence: 50 },
    ],
    employeeCount: 4,
  },
  {
    id: 'struct-3',
    name: 'Contractor',
    active: true,
    rules: [
      { ruleId: 'rule-1', sequence: 10 },
      { ruleId: 'rule-7', sequence: 20 },
      { ruleId: 'rule-11', sequence: 30 },
    ],
    employeeCount: 2,
  },
  {
    id: 'struct-4',
    name: 'Intern Stipend',
    active: false,
    rules: [
      { ruleId: 'rule-1', sequence: 10 },
      { ruleId: 'rule-11', sequence: 20 },
    ],
    employeeCount: 0,
  },
];

export const MOCK_RULES: SalaryRule[] = [
  {
    id: 'rule-1',
    name: 'Basic Salary',
    code: 'BASIC',
    category: 'Basic',
    structureId: 'struct-1',
    structureName: 'Regular Salary',
    sequence: 10,
    sortBy: 1,
    active: true,
    computation: 'Fixed Amount',
    amount: 950000,
  },
  {
    id: 'rule-2',
    name: 'House Rent Allowance',
    code: 'HRA',
    category: 'Allowance',
    structureId: 'struct-1',
    structureName: 'Regular Salary',
    sequence: 20,
    sortBy: 2,
    active: true,
    computation: 'Percentage of Wage',
    percentage: 40,
  },
  {
    id: 'rule-3',
    name: 'Standard Allowance',
    code: 'STD',
    category: 'Allowance',
    structureId: 'struct-1',
    structureName: 'Regular Salary',
    sequence: 30,
    sortBy: 3,
    active: true,
    computation: 'Fixed Amount',
    amount: 50000,
  },
  {
    id: 'rule-4',
    name: 'Performance Bonus',
    code: 'PERF',
    category: 'Allowance',
    structureId: 'struct-1',
    structureName: 'Regular Salary',
    sequence: 40,
    sortBy: 4,
    active: true,
    computation: 'Fixed Amount',
    amount: 75000,
  },
  {
    id: 'rule-5',
    name: 'Leave Travel Allowance',
    code: 'LTA',
    category: 'Allowance',
    structureId: 'struct-1',
    structureName: 'Regular Salary',
    sequence: 50,
    sortBy: 5,
    active: true,
    computation: 'Fixed Amount',
    amount: 30000,
  },
  {
    id: 'rule-6',
    name: 'Fixed Allowance',
    code: 'FIX',
    category: 'Allowance',
    structureId: 'struct-1',
    structureName: 'Regular Salary',
    sequence: 60,
    sortBy: 6,
    active: true,
    computation: 'Fixed Amount',
    amount: 25000,
  },
  {
    id: 'rule-7',
    name: 'Gross Salary',
    code: 'GROSS',
    category: 'Gross',
    structureId: 'struct-1',
    structureName: 'Regular Salary',
    sequence: 70,
    sortBy: 7,
    active: true,
    computation: 'Python Code',
    pythonCode: "result = categories['BASIC'] + categories['ALW']",
  },
  {
    id: 'rule-8',
    name: 'Loan Fund',
    code: 'LF',
    category: 'Deduction',
    structureId: 'struct-1',
    structureName: 'Regular Salary',
    sequence: 80,
    sortBy: 8,
    active: true,
    computation: 'Fixed Amount',
    amount: 15000,
  },
  {
    id: 'rule-9',
    name: 'Provident Fund',
    code: 'PF',
    category: 'Deduction',
    structureId: 'struct-1',
    structureName: 'Regular Salary',
    sequence: 90,
    sortBy: 9,
    active: true,
    computation: 'Percentage of Wage',
    percentage: 12,
  },
  {
    id: 'rule-10',
    name: 'Professional Tax',
    code: 'PT',
    category: 'Deduction',
    structureId: 'struct-1',
    structureName: 'Regular Salary',
    sequence: 100,
    sortBy: 10,
    active: true,
    computation: 'Fixed Amount',
    amount: 2500,
  },
  {
    id: 'rule-11',
    name: 'Alt Salary',
    code: 'ALT',
    category: 'Net',
    structureId: 'struct-1',
    structureName: 'Regular Salary',
    sequence: 110,
    sortBy: 11,
    active: true,
    computation: 'Python Code',
    pythonCode: "result = categories['GROSS'] - categories['DED']",
  },
];

export const MOCK_EMPLOYEES: MockEmployee[] = [
  { id: 'emp-1', name: 'Aarav Mehta', workingHours: '40 hours/week', startDate: 'Jan 1', wage: 950000 },
  { id: 'emp-2', name: 'Sara Khan', workingHours: '40 hours/week', startDate: 'Jan 1', wage: 950000 },
  { id: 'emp-3', name: 'John Dsouza', workingHours: '40 hours/week', startDate: 'Jan 1', wage: 950000 },
  { id: 'emp-4', name: 'Priya Sharma', workingHours: '40 hours/week', startDate: 'Feb 1', wage: 950000 },
  { id: 'emp-5', name: 'Anita Oliver', workingHours: '40 hours/week', startDate: 'Jan 1', wage: 950000 },
  { id: 'emp-6', name: 'Raj Patel', workingHours: '32 hours/week', startDate: 'Mar 1', wage: 950000 },
];

export function buildStandardPayslipLines(): PayslipLine[] {
  return [
    { ruleId: 'rule-1', ruleName: 'Basic Salary', ruleCode: 'BASIC', category: 'Basic', amount: 950000 },
    { ruleId: 'rule-2', ruleName: 'House Rent Allowance', ruleCode: 'HRA', category: 'Allowance', amount: 380000 },
    { ruleId: 'rule-3', ruleName: 'Standard Allowance', ruleCode: 'STD', category: 'Allowance', amount: 50000 },
    { ruleId: 'rule-4', ruleName: 'Performance Bonus', ruleCode: 'PERF', category: 'Allowance', amount: 75000 },
    { ruleId: 'rule-5', ruleName: 'Leave Travel Allowance', ruleCode: 'LTA', category: 'Allowance', amount: 30000 },
    { ruleId: 'rule-6', ruleName: 'Fixed Allowance', ruleCode: 'FIX', category: 'Allowance', amount: 25000 },
    { ruleId: 'rule-7', ruleName: 'Gross Salary', ruleCode: 'GROSS', category: 'Gross', amount: 1510000 },
    { ruleId: 'rule-8', ruleName: 'Loan Fund', ruleCode: 'LF', category: 'Deduction', amount: -15000 },
    { ruleId: 'rule-9', ruleName: 'Provident Fund', ruleCode: 'PF', category: 'Deduction', amount: -114000 },
    { ruleId: 'rule-10', ruleName: 'Professional Tax', ruleCode: 'PT', category: 'Deduction', amount: -2500 },
    { ruleId: 'rule-11', ruleName: 'Alt Salary', ruleCode: 'ALT', category: 'Net', amount: 950000 },
  ];
}

const defaultLines = buildStandardPayslipLines();

export const MOCK_PAYSLIPS: Payslip[] = [
  {
    id: 'slip-1',
    payrunId: 'pr-1',
    employeeId: 'emp-1',
    employeeName: 'Aarav Mehta',
    structureId: 'struct-1',
    structureName: 'Regular Salary',
    periodStart: '01-Jan-2026',
    periodEnd: '31-Jan-2026',
    periodLabel: 'January 2026',
    status: 'Paid',
    warnings: [],
    workedDays: 22,
    lines: defaultLines,
    basic: 950000,
    gross: 950000,
    net: 950000,
  },
  {
    id: 'slip-2',
    payrunId: 'pr-1',
    employeeId: 'emp-2',
    employeeName: 'Sara Khan',
    structureId: 'struct-1',
    structureName: 'Regular Salary',
    periodStart: '01-Jan-2026',
    periodEnd: '31-Jan-2026',
    periodLabel: 'January 2026',
    status: 'Paid',
    warnings: ['Alt missing'],
    workedDays: 22,
    lines: defaultLines,
    basic: 950000,
    gross: 950000,
    net: 950000,
  },
  {
    id: 'slip-3',
    payrunId: 'pr-2',
    employeeId: 'emp-1',
    employeeName: 'Aarav Mehta',
    structureId: 'struct-1',
    structureName: 'Regular Salary',
    periodStart: '01-Feb-2026',
    periodEnd: '28-Feb-2026',
    periodLabel: 'February 2026',
    status: 'Draft',
    warnings: [],
    workedDays: 22,
    lines: defaultLines,
    basic: 950000,
    gross: 950000,
    net: 950000,
  },
  {
    id: 'slip-4',
    payrunId: 'pr-2',
    employeeId: 'emp-5',
    employeeName: 'Anita Oliver',
    structureId: 'struct-1',
    structureName: 'Regular Salary',
    periodStart: '01-Feb-2026',
    periodEnd: '28-Feb-2026',
    periodLabel: 'February 2026',
    status: 'Draft',
    warnings: ['Duplicate'],
    workedDays: 21,
    lines: defaultLines,
    basic: 950000,
    gross: 950000,
    net: 950000,
  },
  {
    id: 'slip-5',
    payrunId: 'pr-2',
    employeeId: 'emp-3',
    employeeName: 'John Dsouza',
    structureId: 'struct-1',
    structureName: 'Regular Salary',
    periodStart: '01-Feb-2026',
    periodEnd: '28-Feb-2026',
    periodLabel: 'February 2026',
    status: 'Done',
    warnings: [],
    workedDays: 22,
    lines: defaultLines,
    basic: 950000,
    gross: 950000,
    net: 950000,
  },
];

export const MOCK_PAYRUNS: Payrun[] = [
  {
    id: 'pr-1',
    periodLabel: 'January 2026',
    periodStart: '01-Jan-2026',
    periodEnd: '31-Jan-2026',
    structureId: 'struct-1',
    structureName: 'Regular Salary',
    status: 'Paid',
    employeeCount: 6,
    warningCount: 1,
  },
  {
    id: 'pr-2',
    periodLabel: 'February 2026',
    periodStart: '01-Feb-2026',
    periodEnd: '28-Feb-2026',
    structureId: 'struct-1',
    structureName: 'Regular Salary',
    status: 'Draft',
    employeeCount: 6,
    warningCount: 1,
  },
];
