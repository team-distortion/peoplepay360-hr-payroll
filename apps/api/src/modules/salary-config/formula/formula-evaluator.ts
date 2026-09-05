import { Prisma } from '@prisma/client';
import type { Expression, Literal, Identifier, UnaryExpression, BinaryExpression } from 'jsep';
import {
  DECIMAL_PRECISION,
  MAX_RESULT_MAGNITUDE_STR,
} from './formula.constants.js';
import { SalaryFormulaError } from './formula.errors.js';
import type { DecimalVariables, ParsedFormula } from './formula.types.js';
import { parseAndValidateFormula } from './formula-parser.js';

// Configure Prisma.Decimal globally for formula evaluation
Prisma.Decimal.set({
  precision: DECIMAL_PRECISION,
  rounding: Prisma.Decimal.ROUND_HALF_UP,
});

const MAX_MAGNITUDE = new Prisma.Decimal(MAX_RESULT_MAGNITUDE_STR);

function evaluateNode(node: Expression, variables: DecimalVariables): Prisma.Decimal {
  switch (node.type) {
    case 'Literal': {
      const lit = node as Literal;
      if (typeof lit.raw !== 'string') {
        throw new SalaryFormulaError(
          'FORMULA_INVALID_LITERAL',
          'Missing raw numeric literal during evaluation'
        );
      }
      return new Prisma.Decimal(lit.raw);
    }

    case 'Identifier': {
      const ident = node as Identifier;
      const name = ident.name;

      if (!Object.prototype.hasOwnProperty.call(variables, name)) {
        throw new SalaryFormulaError(
          'FORMULA_MISSING_VARIABLE',
          `Missing variable value for identifier: "${name}"`,
          { identifier: name }
        );
      }

      const val = variables[name];
      if (val === undefined || val === null) {
        throw new SalaryFormulaError(
          'FORMULA_MISSING_VARIABLE',
          `Variable "${name}" has null or undefined value`,
          { identifier: name }
        );
      }

      if (val instanceof Prisma.Decimal) {
        return val;
      }

      try {
        return new Prisma.Decimal(val as any);
      } catch {
        throw new SalaryFormulaError(
          'FORMULA_MISSING_VARIABLE',
          `Variable "${name}" cannot be converted to Decimal`,
          { identifier: name }
        );
      }
    }

    case 'UnaryExpression': {
      const unary = node as UnaryExpression;
      const operand = evaluateNode(unary.argument, variables);

      if (unary.operator === '+') {
        return operand;
      }
      if (unary.operator === '-') {
        return operand.negated();
      }

      throw new SalaryFormulaError(
        'FORMULA_UNSUPPORTED_SYNTAX',
        `Unsupported unary operator: "${unary.operator}"`
      );
    }

    case 'BinaryExpression': {
      const binary = node as BinaryExpression;
      const left = evaluateNode(binary.left, variables);
      const right = evaluateNode(binary.right, variables);

      switch (binary.operator) {
        case '+':
          return left.plus(right);
        case '-':
          return left.minus(right);
        case '*':
          return left.times(right);
        case '/': {
          if (right.isZero()) {
            throw new SalaryFormulaError(
              'FORMULA_DIVISION_BY_ZERO',
              'Division by zero in formula evaluation'
            );
          }
          return left.dividedBy(right);
        }
        default:
          throw new SalaryFormulaError(
            'FORMULA_UNSUPPORTED_SYNTAX',
            `Unsupported binary operator: "${binary.operator}"`
          );
      }
    }

    default:
      throw new SalaryFormulaError(
        'FORMULA_UNSUPPORTED_SYNTAX',
        `Cannot evaluate unsupported AST node: "${node.type}"`
      );
  }
}

export function evaluateParsedFormula(
  parsed: ParsedFormula,
  variables: DecimalVariables
): Prisma.Decimal {
  const result = evaluateNode(parsed.ast, variables);

  if (!result.isFinite() || result.abs().greaterThanOrEqualTo(MAX_MAGNITUDE)) {
    throw new SalaryFormulaError(
      'FORMULA_RESULT_OUT_OF_RANGE',
      `Formula result (${result.toString()}) is non-finite or exceeds maximum allowed magnitude (< 10^16)`,
      { result: result.toString() }
    );
  }

  return result;
}

export function evaluateFormula(
  expression: string,
  variables: DecimalVariables
): Prisma.Decimal {
  // Derive allowed identifiers from own properties of variables
  const allowedKeys = Object.keys(variables).filter((key) =>
    Object.prototype.hasOwnProperty.call(variables, key)
  );

  const parsed = parseAndValidateFormula(expression, {
    allowedIdentifiers: new Set(allowedKeys),
  });

  return evaluateParsedFormula(parsed, variables);
}
