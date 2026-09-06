import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  aggregatePayrollDays,
  executeSalaryRules,
  generateDateRange,
  getWeekdayFromDateString,
  type ScheduleDayPattern,
  type RuleCalculationInput,
} from '../src/modules/payroll/payroll-calculation.js';

describe('Payroll Calculation Engine', () => {
  const standardScheduleDays: ScheduleDayPattern[] = [
    { dayOfWeek: 'MONDAY', startMinute: 540, endMinute: 1020, breakMinutes: 60 }, // 8 hrs = 480 min
    { dayOfWeek: 'TUESDAY', startMinute: 540, endMinute: 1020, breakMinutes: 60 },
    { dayOfWeek: 'WEDNESDAY', startMinute: 540, endMinute: 1020, breakMinutes: 60 },
    { dayOfWeek: 'THURSDAY', startMinute: 540, endMinute: 1020, breakMinutes: 60 },
    { dayOfWeek: 'FRIDAY', startMinute: 540, endMinute: 1020, breakMinutes: 60 },
  ];

  describe('Date range and weekday helper', () => {
    it('generates inclusive date range correctly', () => {
      const dates = generateDateRange('2026-03-01', '2026-03-05');
      expect(dates).toEqual([
        '2026-03-01',
        '2026-03-02',
        '2026-03-03',
        '2026-03-04',
        '2026-03-05',
      ]);
    });

    it('identifies weekdays accurately', () => {
      expect(getWeekdayFromDateString('2026-03-01')).toBe('SUNDAY');
      expect(getWeekdayFromDateString('2026-03-02')).toBe('MONDAY');
      expect(getWeekdayFromDateString('2026-03-06')).toBe('FRIDAY');
      expect(getWeekdayFromDateString('2026-03-07')).toBe('SATURDAY');
    });
  });

  describe('Payroll Day Aggregation', () => {
    it('calculates expected days and minutes for a 1-week period', () => {
      // 2026-03-02 (Mon) to 2026-03-08 (Sun) has 5 expected working days
      const result = aggregatePayrollDays({
        periodStart: '2026-03-02',
        periodEnd: '2026-03-08',
        scheduleDays: standardScheduleDays,
        attendances: [
          {
            date: '2026-03-02',
            status: 'PRESENT',
            checkIn: new Date(),
            checkOut: new Date(),
            workedMinutes: 480,
            overtimeMinutes: 60,
          },
          {
            date: '2026-03-03',
            status: 'LATE',
            checkIn: new Date(),
            checkOut: new Date(),
            workedMinutes: 450,
            overtimeMinutes: 0,
          },
        ],
        timeOffRequests: [
          {
            startDate: '2026-03-04',
            endDate: '2026-03-04',
            isPaid: true,
          },
          {
            startDate: '2026-03-05',
            endDate: '2026-03-05',
            isPaid: false,
          },
        ],
      });

      expect(result.expectedDays).toBe(5);
      expect(result.expectedMinutes).toBe(5 * 420); // 480 - 60 break = 420 min/day
      // Mon (Present: 1) + Tue (Late: 1) + Wed (Paid leave: 1) + Thu (Unpaid leave: 0) + Fri (Missing: 0)
      expect(result.workedDays).toBe(3);
      expect(result.workedMinutes).toBe(480 + 450);
      expect(result.overtimeMinutes).toBe(60);
      // Friday has no attendance and no leave -> missing attendance
      expect(result.missingAttendanceDates).toEqual(['2026-03-06']);
    });

    it('throws error when expected working days is zero', () => {
      // Saturday and Sunday only
      expect(() =>
        aggregatePayrollDays({
          periodStart: '2026-03-07',
          periodEnd: '2026-03-08',
          scheduleDays: standardScheduleDays, // Monday-Friday only
          attendances: [],
          timeOffRequests: [],
        })
      ).toThrowError(/zero expected working days/i);
    });

    it('detects open attendance records', () => {
      const result = aggregatePayrollDays({
        periodStart: '2026-03-02',
        periodEnd: '2026-03-02',
        scheduleDays: standardScheduleDays,
        attendances: [
          {
            date: '2026-03-02',
            status: 'PRESENT',
            checkIn: new Date(),
            checkOut: null, // open
            workedMinutes: 240,
            overtimeMinutes: 0,
          },
        ],
        timeOffRequests: [],
      });

      expect(result.openAttendanceDates).toEqual(['2026-03-02']);
    });
  });

  describe('Salary Rule Execution', () => {
    const rules: RuleCalculationInput[] = [
      {
        id: 'r1',
        name: 'Basic Salary',
        code: 'BASIC',
        category: 'BASIC',
        sequence: 10,
        method: 'PERCENTAGE',
        fixedAmount: null,
        percentageRate: new Prisma.Decimal(50),
        percentageBase: 'WAGE',
        formula: null,
      },
      {
        id: 'r2',
        name: 'House Rent Allowance',
        code: 'HRA',
        category: 'ALLOWANCE',
        sequence: 20,
        method: 'PERCENTAGE',
        fixedAmount: null,
        percentageRate: new Prisma.Decimal(40),
        percentageBase: 'BASIC',
        formula: null,
      },
      {
        id: 'r3',
        name: 'Conveyance',
        code: 'CONV',
        category: 'ALLOWANCE',
        sequence: 30,
        method: 'FIXED',
        fixedAmount: new Prisma.Decimal(3000),
        percentageRate: null,
        percentageBase: null,
        formula: null,
      },
      {
        id: 'r4',
        name: 'Gross Salary',
        code: 'GROSS',
        category: 'GROSS',
        sequence: 40,
        method: 'FORMULA',
        fixedAmount: null,
        percentageRate: null,
        percentageBase: null,
        formula: 'BASIC + HRA + CONV',
      },
      {
        id: 'r5',
        name: 'Provident Fund',
        code: 'PF',
        category: 'DEDUCTION',
        sequence: 50,
        method: 'PERCENTAGE',
        fixedAmount: null,
        percentageRate: new Prisma.Decimal(12),
        percentageBase: 'BASIC',
        formula: null,
      },
      {
        id: 'r6',
        name: 'Net Salary',
        code: 'NET',
        category: 'NET',
        sequence: 60,
        method: 'FORMULA',
        fixedAmount: null,
        percentageRate: null,
        percentageBase: null,
        formula: 'GROSS - PF',
      },
    ];

    it('calculates full payslip accurately with zero loss', () => {
      const dayAggregation = {
        expectedDays: 20,
        workedDays: 20,
        expectedMinutes: 20 * 480,
        workedMinutes: 20 * 480,
        overtimeMinutes: 0,
        workedHours: new Prisma.Decimal(160),
        expectedHours: new Prisma.Decimal(160),
        overtimeHours: new Prisma.Decimal(0),
        missingAttendanceDates: [],
        openAttendanceDates: [],
        attendanceTimeOffConflictDates: [],
      };

      const monthlyWage = new Prisma.Decimal(60000);

      const result = executeSalaryRules({
        monthlyWage,
        dayAggregation,
        rules,
      });

      // BASIC = 50% of 60,000 = 30,000
      expect(result.basicAmount.toString()).toBe('30000');
      // HRA = 40% of 30,000 = 12,000; CONV = 3,000; Total Allowance = 15,000
      expect(result.allowanceAmount.toString()).toBe('15000');
      // GROSS = 30,000 + 12,000 + 3,000 = 45,000
      expect(result.grossAmount.toString()).toBe('45000');
      // PF = 12% of 30,000 = 3,600
      expect(result.deductionAmount.toString()).toBe('3600');
      // NET = 45,000 - 3,600 = 41,400
      expect(result.netAmount.toString()).toBe('41400');
      expect(result.lines).toHaveLength(6);
    });

    it('prorates basic salary when worked days is less than expected days', () => {
      const dayAggregation = {
        expectedDays: 20,
        workedDays: 15, // 75%
        expectedMinutes: 20 * 480,
        workedMinutes: 15 * 480,
        overtimeMinutes: 0,
        workedHours: new Prisma.Decimal(120),
        expectedHours: new Prisma.Decimal(160),
        overtimeHours: new Prisma.Decimal(0),
        missingAttendanceDates: [],
        openAttendanceDates: [],
        attendanceTimeOffConflictDates: [],
      };

      const monthlyWage = new Prisma.Decimal(60000);

      const result = executeSalaryRules({
        monthlyWage,
        dayAggregation,
        rules,
      });

      // PRORATED_BASIC = 60,000 * 15 / 20 = 45,000
      expect(result.proratedBasic.toString()).toBe('45000');
    });

    it('rejects structures missing GROSS or NET rules', () => {
      const invalidRules = rules.filter((r) => r.category !== 'NET');
      const dayAggregation = {
        expectedDays: 20,
        workedDays: 20,
        expectedMinutes: 9600,
        workedMinutes: 9600,
        overtimeMinutes: 0,
        workedHours: new Prisma.Decimal(160),
        expectedHours: new Prisma.Decimal(160),
        overtimeHours: new Prisma.Decimal(0),
        missingAttendanceDates: [],
        openAttendanceDates: [],
        attendanceTimeOffConflictDates: [],
      };

      expect(() =>
        executeSalaryRules({
          monthlyWage: new Prisma.Decimal(50000),
          dayAggregation,
          rules: invalidRules,
        })
      ).toThrowError(/exactly one active NET rule/i);
    });
  });
});
