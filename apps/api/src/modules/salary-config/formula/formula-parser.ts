import jsep, { type Expression } from 'jsep';
import {
  DEFAULT_MAX_AST_NODES,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_EXPRESSION_LENGTH,
} from './formula.constants.js';
import { SalaryFormulaError } from './formula.errors.js';
import type { FormulaValidationOptions, ParsedFormula } from './formula.types.js';
import { validateAstNode } from './formula-validator.js';

export function parseAndValidateFormula(
  expression: string,
  options: FormulaValidationOptions
): ParsedFormula {
  if (typeof expression !== 'string') {
    throw new SalaryFormulaError(
      'FORMULA_SYNTAX_ERROR',
      'Formula expression must be a string'
    );
  }

  const trimmed = expression.trim();
  const maxLength = options.maxExpressionLength ?? DEFAULT_MAX_EXPRESSION_LENGTH;

  if (trimmed.length === 0) {
    throw new SalaryFormulaError(
      'FORMULA_SYNTAX_ERROR',
      'Formula expression cannot be empty'
    );
  }

  if (trimmed.length > maxLength) {
    throw new SalaryFormulaError(
      'FORMULA_TOO_COMPLEX',
      `Formula expression length (${trimmed.length}) exceeds maximum limit (${maxLength})`,
      { length: trimmed.length, maxLength }
    );
  }

  let ast: Expression;
  try {
    ast = jsep(trimmed);
  } catch (error: any) {
    throw new SalaryFormulaError(
      'FORMULA_SYNTAX_ERROR',
      `Failed to parse formula: ${error?.message || 'Syntax error'}`,
      { originalError: error?.message }
    );
  }

  const state = {
    nodeCount: 0,
    maxNodes: options.maxAstNodes ?? DEFAULT_MAX_AST_NODES,
    maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
    allowedIdentifiers: options.allowedIdentifiers,
    referencedIdentifiers: [] as string[],
  };

  validateAstNode(ast, 1, state);

  return {
    expression: trimmed,
    ast,
    referencedIdentifiers: Object.freeze(state.referencedIdentifiers),
  };
}
