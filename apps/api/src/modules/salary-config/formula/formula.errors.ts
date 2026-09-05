export type SalaryFormulaErrorCode =
  | 'FORMULA_SYNTAX_ERROR'
  | 'FORMULA_TOO_COMPLEX'
  | 'FORMULA_UNSUPPORTED_SYNTAX'
  | 'FORMULA_INVALID_LITERAL'
  | 'FORMULA_INVALID_IDENTIFIER'
  | 'FORMULA_UNKNOWN_IDENTIFIER'
  | 'FORMULA_MISSING_VARIABLE'
  | 'FORMULA_DIVISION_BY_ZERO'
  | 'FORMULA_RESULT_OUT_OF_RANGE'
  | 'RULE_CODE_DUPLICATE'
  | 'RULE_SEQUENCE_DUPLICATE'
  | 'RULE_DEPENDENCY_FORWARD_REFERENCE'
  | 'RULE_DEPENDENCY_INACTIVE_REFERENCE';

export class SalaryFormulaError extends Error {
  public readonly code: SalaryFormulaErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(code: SalaryFormulaErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
