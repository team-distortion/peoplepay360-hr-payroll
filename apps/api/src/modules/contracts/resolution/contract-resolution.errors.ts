export type ContractResolutionErrorCode =
  | 'INVALID_DATE_ONLY'
  | 'INVALID_PAYROLL_PERIOD'
  | 'NO_APPLICABLE_CONTRACT'
  | 'MULTIPLE_APPLICABLE_CONTRACTS'
  | 'CONTRACT_EMPLOYEE_MISMATCH'
  | 'SALARY_STRUCTURE_MISMATCH'
  | 'WORKING_SCHEDULE_MISSING';

export class ContractResolutionError extends Error {
  readonly code: ContractResolutionErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ContractResolutionErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ContractResolutionError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ContractResolutionError.prototype);
  }
}
