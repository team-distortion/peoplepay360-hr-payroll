import { AppError } from '../../errors/app-error.js';
import {
  SalaryFormulaError,
  validateStructureDependencies,
  type StructureRuleDependencyInput,
  type ValidatedStructureRule,
} from './formula/index.js';

export function mapFormulaErrorToAppError(err: unknown): AppError {
  if (err instanceof SalaryFormulaError) {
    switch (err.code) {
      case 'RULE_CODE_DUPLICATE':
        return new AppError(409, 'SALARY_RULE_CODE_EXISTS', err.message, err.details);
      case 'RULE_SEQUENCE_DUPLICATE':
        return new AppError(409, 'SALARY_RULE_SEQUENCE_EXISTS', err.message, err.details);
      case 'RULE_DEPENDENCY_FORWARD_REFERENCE':
      case 'RULE_DEPENDENCY_INACTIVE_REFERENCE':
      case 'FORMULA_UNKNOWN_IDENTIFIER':
        return new AppError(
          409,
          'SALARY_RULE_DEPENDENCY_INVALID',
          err.message,
          err.details
        );
      case 'FORMULA_SYNTAX_ERROR':
      case 'FORMULA_INVALID_LITERAL':
      case 'FORMULA_INVALID_IDENTIFIER':
      case 'FORMULA_TOO_COMPLEX':
      case 'FORMULA_UNSUPPORTED_SYNTAX':
        return new AppError(400, 'VALIDATION_ERROR', err.message, err.details);
      default:
        return new AppError(400, 'VALIDATION_ERROR', err.message, err.details);
    }
  }

  if (err instanceof AppError) {
    return err;
  }

  return new AppError(
    400,
    'VALIDATION_ERROR',
    err instanceof Error ? err.message : 'Invalid rule configuration'
  );
}

export function validateProspectiveStructureRules(
  rules: readonly StructureRuleDependencyInput[]
): readonly ValidatedStructureRule[] {
  try {
    return validateStructureDependencies(rules);
  } catch (error) {
    throw mapFormulaErrorToAppError(error);
  }
}
