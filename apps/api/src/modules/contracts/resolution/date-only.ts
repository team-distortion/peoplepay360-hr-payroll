import { ContractResolutionError } from './contract-resolution.errors.js';
import type { PayrollPeriod } from './contract-resolution.types.js';

const DATE_ONLY_REGEX = /^[0-9]{4}-(0[1-9]|1[0-2])-([0-2][0-9]|3[0-1])$/;

export function isValidDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_ONLY_REGEX.test(value)) {
    return false;
  }

  const parts = value.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  // Leap year calculation in Gregorian calendar
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [
    31, // January
    isLeapYear ? 29 : 28, // February
    31, // March
    30, // April
    31, // May
    30, // June
    31, // July
    31, // August
    30, // September
    31, // October
    30, // November
    31, // December
  ];

  const maxDay = daysInMonth[month - 1];
  return day >= 1 && day <= maxDay;
}

export function assertDateOnly(value: string, field: string): void {
  if (!isValidDateOnly(value)) {
    throw new ContractResolutionError(
      'INVALID_DATE_ONLY',
      `Field '${field}' must be a valid calendar date formatted as YYYY-MM-DD, received: ${String(value)}`,
      { field, value }
    );
  }
}

export function assertValidPeriod(period: PayrollPeriod): void {
  if (!period || typeof period !== 'object') {
    throw new ContractResolutionError(
      'INVALID_PAYROLL_PERIOD',
      'Payroll period must be an object with startDate and endDate'
    );
  }

  assertDateOnly(period.startDate, 'startDate');
  assertDateOnly(period.endDate, 'endDate');

  // Lexicographical comparison is guaranteed valid on YYYY-MM-DD strings
  if (period.startDate > period.endDate) {
    throw new ContractResolutionError(
      'INVALID_PAYROLL_PERIOD',
      `Payroll period startDate (${period.startDate}) must be on or before endDate (${period.endDate})`,
      { startDate: period.startDate, endDate: period.endDate }
    );
  }
}
