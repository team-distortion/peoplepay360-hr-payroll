export const BUILTIN_IDENTIFIERS = [
  'WAGE',
  'PRORATED_BASIC',
  'WORKED_DAYS',
  'EXPECTED_DAYS',
  'WORKED_HOURS',
  'EXPECTED_HOURS',
  'OVERTIME_HOURS',
] as const;

export type SalaryFormulaBuiltin = (typeof BUILTIN_IDENTIFIERS)[number];

export const BUILTIN_IDENTIFIERS_SET: ReadonlySet<string> = new Set(BUILTIN_IDENTIFIERS);

export const IDENTIFIER_REGEX = /^[A-Z][A-Z0-9_]{0,39}$/;

export const DECIMAL_LITERAL_REGEX = /^(?:0|[1-9][0-9]{0,17})(?:\.[0-9]{1,8})?$/;

export const DEFAULT_MAX_EXPRESSION_LENGTH = 1000;
export const DEFAULT_MAX_AST_NODES = 200;
export const DEFAULT_MAX_DEPTH = 32;

// Absolute final value must be strictly less than 10^16 before currency rounding
export const MAX_RESULT_MAGNITUDE_STR = '10000000000000000'; // 10^16
export const DECIMAL_PRECISION = 28;
