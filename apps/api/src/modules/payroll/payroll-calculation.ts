import { Prisma } from '@prisma/client';
import { AppError } from '../../errors/app-error.js';
import { evaluateFormula } from '../salary-config/formula/index.js';
import type { DecimalVariables } from '../salary-config/formula/index.js';
import type { Weekday, SalaryRuleCategory, SalaryRuleMethod } from '@prisma/client';

export interface ScheduleDayPattern {
  dayOfWeek: Weekday;
  startMinute: number;
  endMinute: number;
  breakMinutes: number;
}

export interface AttendanceRecordInput {
  date: string; // YYYY-MM-DD
  status: 'PRESENT' | 'ABSENT' | 'LATE';
  checkIn: Date | null;
  checkOut: Date | null;
  workedMinutes: number;
  overtimeMinutes: number;
}

export interface TimeOffRecordInput {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  isPaid: boolean;
}

export interface RuleCalculationInput {
  id: string;
  name: string;
  code: string;
  category: SalaryRuleCategory;
  sequence: number;
  method: SalaryRuleMethod;
  fixedAmount: Prisma.Decimal | null;
  percentageRate: Prisma.Decimal | null;
  percentageBase: string | null;
  formula: string | null;
}

export interface CalculatedLine {
  salaryRuleId: string;
  name: string;
  code: string;
  category: SalaryRuleCategory;
  sequence: number;
  method: SalaryRuleMethod;
  amount: Prisma.Decimal; // 2 decimal places
}

export interface PayrollDayAggregationResult {
  expectedDays: number;
  workedDays: number;
  expectedMinutes: number;
  workedMinutes: number;
  overtimeMinutes: number;
  workedHours: Prisma.Decimal;
  expectedHours: Prisma.Decimal;
  overtimeHours: Prisma.Decimal;
  missingAttendanceDates: string[];
  openAttendanceDates: string[];
  attendanceTimeOffConflictDates: string[];
}

export interface PayrollCalculationResult {
  dayAggregation: PayrollDayAggregationResult;
  monthlyWage: Prisma.Decimal;
  proratedBasic: Prisma.Decimal;
  basicAmount: Prisma.Decimal;
  allowanceAmount: Prisma.Decimal;
  overtimeAmount: Prisma.Decimal;
  deductionAmount: Prisma.Decimal;
  contributionAmount: Prisma.Decimal;
  grossAmount: Prisma.Decimal;
  netAmount: Prisma.Decimal;
  lines: CalculatedLine[];
}

const WEEKDAY_NAMES: Weekday[] = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

export function getWeekdayFromDateString(dateStr: string): Weekday {
  // dateStr is YYYY-MM-DD
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return WEEKDAY_NAMES[d.getUTCDay()];
}

export function generateDateRange(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const [ey, em, ed] = endDateStr.split('-').map(Number);

  let current = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));

  while (current <= end) {
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, '0');
    const d = String(current.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

export function aggregatePayrollDays(input: {
  periodStart: string;
  periodEnd: string;
  scheduleDays: readonly ScheduleDayPattern[];
  attendances: readonly AttendanceRecordInput[];
  timeOffRequests: readonly TimeOffRecordInput[];
}): PayrollDayAggregationResult {
  const scheduleDayMap = new Map<Weekday, ScheduleDayPattern>();
  for (const day of input.scheduleDays) {
    scheduleDayMap.set(day.dayOfWeek, day);
  }

  const attendanceMap = new Map<string, AttendanceRecordInput>();
  for (const att of input.attendances) {
    attendanceMap.set(att.date, att);
  }

  const allDates = generateDateRange(input.periodStart, input.periodEnd);

  let expectedDays = 0;
  let expectedMinutes = 0;
  let workedDays = 0;
  let totalWorkedMinutes = 0;
  let totalOvertimeMinutes = 0;

  const missingAttendanceDates: string[] = [];
  const openAttendanceDates: string[] = [];
  const attendanceTimeOffConflictDates: string[] = [];

  for (const date of allDates) {
    const weekday = getWeekdayFromDateString(date);
    const scheduledDay = scheduleDayMap.get(weekday);
    const isExpected = !!scheduledDay;

    if (isExpected) {
      expectedDays++;
      const netScheduledMinutes = Math.max(
        0,
        scheduledDay.endMinute - scheduledDay.startMinute - scheduledDay.breakMinutes
      );
      expectedMinutes += netScheduledMinutes;
    }

    const att = attendanceMap.get(date);
    const hasAttendance = !!att;

    // Check if approved time off covers this date
    const timeOff = input.timeOffRequests.find(
      (to) => date >= to.startDate && date <= to.endDate
    );
    const hasTimeOff = !!timeOff;

    if (hasAttendance && hasTimeOff && isExpected) {
      attendanceTimeOffConflictDates.push(date);
    }

    if (hasAttendance) {
      // Accumulate worked and overtime minutes
      totalWorkedMinutes += att.workedMinutes;
      totalOvertimeMinutes += att.overtimeMinutes;

      // Check open attendance (has checkIn but no checkOut)
      if (att.checkIn && !att.checkOut) {
        openAttendanceDates.push(date);
      }

      if (isExpected) {
        if (att.status === 'PRESENT' || att.status === 'LATE') {
          workedDays += 1;
        } else if (att.status === 'ABSENT') {
          // Absent contributes 0
        }
      }
    } else if (hasTimeOff) {
      if (isExpected) {
        if (timeOff.isPaid) {
          workedDays += 1;
        }
      }
    } else {
      if (isExpected) {
        missingAttendanceDates.push(date);
      }
    }
  }

  if (expectedDays === 0) {
    throw new AppError(
      422,
      'PAYROLL_NO_EXPECTED_WORKING_DAYS',
      `Payroll period "${input.periodStart}" to "${input.periodEnd}" has zero expected working days for resolved schedule`
    );
  }

  const workedHours = new Prisma.Decimal(totalWorkedMinutes).dividedBy(60);
  const expectedHours = new Prisma.Decimal(expectedMinutes).dividedBy(60);
  const overtimeHours = new Prisma.Decimal(totalOvertimeMinutes).dividedBy(60);

  return {
    expectedDays,
    workedDays,
    expectedMinutes,
    workedMinutes: totalWorkedMinutes,
    overtimeMinutes: totalOvertimeMinutes,
    workedHours,
    expectedHours,
    overtimeHours,
    missingAttendanceDates,
    openAttendanceDates,
    attendanceTimeOffConflictDates,
  };
}

export function executeSalaryRules(input: {
  monthlyWage: Prisma.Decimal;
  dayAggregation: PayrollDayAggregationResult;
  rules: readonly RuleCalculationInput[];
}): {
  proratedBasic: Prisma.Decimal;
  lines: CalculatedLine[];
  basicAmount: Prisma.Decimal;
  allowanceAmount: Prisma.Decimal;
  overtimeAmount: Prisma.Decimal;
  deductionAmount: Prisma.Decimal;
  contributionAmount: Prisma.Decimal;
  grossAmount: Prisma.Decimal;
  netAmount: Prisma.Decimal;
} {
  const sortedRules = [...input.rules].sort((a, b) => a.sequence - b.sequence);

  // Validate required structure categories
  const basicRules = sortedRules.filter((r) => r.category === 'BASIC');
  const grossRules = sortedRules.filter((r) => r.category === 'GROSS');
  const netRules = sortedRules.filter((r) => r.category === 'NET');

  if (basicRules.length === 0) {
    throw new AppError(
      422,
      'PAYROLL_STRUCTURE_INVALID',
      'Salary structure must have at least one active BASIC rule'
    );
  }
  if (grossRules.length !== 1) {
    throw new AppError(
      422,
      'PAYROLL_STRUCTURE_INVALID',
      'Salary structure must have exactly one active GROSS rule'
    );
  }
  if (netRules.length !== 1) {
    throw new AppError(
      422,
      'PAYROLL_STRUCTURE_INVALID',
      'Salary structure must have exactly one active NET rule'
    );
  }

  // Calculate PRORATED_BASIC = WAGE * WORKED_DAYS / EXPECTED_DAYS
  const proratedBasic = input.monthlyWage
    .times(input.dayAggregation.workedDays)
    .dividedBy(input.dayAggregation.expectedDays);

  const variables: Record<string, Prisma.Decimal> = {
    WAGE: input.monthlyWage,
    PRORATED_BASIC: proratedBasic,
    WORKED_DAYS: new Prisma.Decimal(input.dayAggregation.workedDays),
    EXPECTED_DAYS: new Prisma.Decimal(input.dayAggregation.expectedDays),
    WORKED_HOURS: input.dayAggregation.workedHours,
    EXPECTED_HOURS: input.dayAggregation.expectedHours,
    OVERTIME_HOURS: input.dayAggregation.overtimeHours,
  };

  const calculatedLines: CalculatedLine[] = [];
  let basicSum = new Prisma.Decimal(0);
  let allowanceSum = new Prisma.Decimal(0);
  let overtimeSum = new Prisma.Decimal(0);
  let deductionSum = new Prisma.Decimal(0);
  let contributionSum = new Prisma.Decimal(0);
  let grossResult: Prisma.Decimal | null = null;
  let netResult: Prisma.Decimal | null = null;

  for (const rule of sortedRules) {
    let rawAmount: Prisma.Decimal;

    switch (rule.method) {
      case 'FIXED': {
        if (!rule.fixedAmount) {
          throw new AppError(
            422,
            'PAYROLL_FORMULA_FAILED',
            `Fixed amount missing for rule "${rule.code}"`
          );
        }
        rawAmount = rule.fixedAmount;
        break;
      }

      case 'PERCENTAGE': {
        if (!rule.percentageBase || !rule.percentageRate) {
          throw new AppError(
            422,
            'PAYROLL_FORMULA_FAILED',
            `Percentage base or rate missing for rule "${rule.code}"`
          );
        }
        const baseVal = variables[rule.percentageBase];
        if (!baseVal) {
          throw new AppError(
            422,
            'PAYROLL_FORMULA_FAILED',
            `Percentage base rule "${rule.percentageBase}" not evaluated yet for rule "${rule.code}"`
          );
        }
        rawAmount = baseVal.times(rule.percentageRate).dividedBy(100);
        break;
      }

      case 'FORMULA': {
        if (!rule.formula) {
          throw new AppError(
            422,
            'PAYROLL_FORMULA_FAILED',
            `Formula expression missing for rule "${rule.code}"`
          );
        }
        try {
          rawAmount = evaluateFormula(rule.formula, variables);
        } catch (err: any) {
          throw new AppError(
            422,
            'PAYROLL_FORMULA_FAILED',
            `Formula calculation failed for rule "${rule.code}": ${err.message}`,
            { ruleCode: rule.code, error: err.message }
          );
        }
        break;
      }

      default:
        throw new AppError(
          422,
          'PAYROLL_FORMULA_FAILED',
          `Unsupported calculation method for rule "${rule.code}"`
        );
    }

    // Round half-up to 2 decimal places at the rule boundary
    const roundedAmount = rawAmount.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    // Persist and register under rule code for subsequent rules
    variables[rule.code] = roundedAmount;

    calculatedLines.push({
      salaryRuleId: rule.id,
      name: rule.name,
      code: rule.code,
      category: rule.category,
      sequence: rule.sequence,
      method: rule.method,
      amount: roundedAmount,
    });

    // Categorize sums
    switch (rule.category) {
      case 'BASIC':
        basicSum = basicSum.plus(roundedAmount);
        break;
      case 'ALLOWANCE':
        allowanceSum = allowanceSum.plus(roundedAmount);
        break;
      case 'OVERTIME':
        overtimeSum = overtimeSum.plus(roundedAmount);
        break;
      case 'DEDUCTION':
        deductionSum = deductionSum.plus(roundedAmount);
        break;
      case 'CONTRIBUTION':
        contributionSum = contributionSum.plus(roundedAmount);
        break;
      case 'GROSS':
        grossResult = roundedAmount;
        break;
      case 'NET':
        netResult = roundedAmount;
        break;
    }
  }

  if (!grossResult || !netResult) {
    throw new AppError(
      422,
      'PAYROLL_STRUCTURE_INVALID',
      'GROSS or NET rule calculation was not produced'
    );
  }

  if (grossResult.isNegative() || netResult.isNegative()) {
    throw new AppError(
      422,
      'PAYROLL_NEGATIVE_TOTAL',
      `Calculated GROSS (${grossResult.toString()}) and NET (${netResult.toString()}) amounts cannot be negative`
    );
  }

  return {
    proratedBasic: proratedBasic.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
    lines: calculatedLines,
    basicAmount: basicSum,
    allowanceAmount: allowanceSum,
    overtimeAmount: overtimeSum,
    deductionAmount: deductionSum,
    contributionAmount: contributionSum,
    grossAmount: grossResult,
    netAmount: netResult,
  };
}
