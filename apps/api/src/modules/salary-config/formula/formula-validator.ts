import type { Expression, Literal, Identifier, UnaryExpression, BinaryExpression } from 'jsep';
import {
  DECIMAL_LITERAL_REGEX,
  IDENTIFIER_REGEX,
} from './formula.constants.js';
import { SalaryFormulaError } from './formula.errors.js';

interface ValidationState {
  nodeCount: number;
  maxNodes: number;
  maxDepth: number;
  allowedIdentifiers: ReadonlySet<string>;
  referencedIdentifiers: string[];
}

export function validateAstNode(
  node: Expression,
  depth: number,
  state: ValidationState
): void {
  state.nodeCount += 1;

  if (state.nodeCount > state.maxNodes) {
    throw new SalaryFormulaError(
      'FORMULA_TOO_COMPLEX',
      `Formula exceeds maximum allowed AST node count (${state.maxNodes})`,
      { maxNodes: state.maxNodes, currentCount: state.nodeCount }
    );
  }

  if (depth > state.maxDepth) {
    throw new SalaryFormulaError(
      'FORMULA_TOO_COMPLEX',
      `Formula exceeds maximum allowed AST depth (${state.maxDepth})`,
      { maxDepth: state.maxDepth, currentDepth: depth }
    );
  }

  if (!node || typeof node !== 'object' || typeof node.type !== 'string') {
    throw new SalaryFormulaError(
      'FORMULA_UNSUPPORTED_SYNTAX',
      'Invalid AST node encountered'
    );
  }

  switch (node.type) {
    case 'Literal': {
      const lit = node as Literal;
      if (typeof lit.raw !== 'string' || typeof lit.value !== 'number' || !Number.isFinite(lit.value)) {
        throw new SalaryFormulaError(
          'FORMULA_INVALID_LITERAL',
          `Invalid literal in formula: only non-negative decimal numbers are allowed`,
          { literal: lit.raw ?? String(lit.value) }
        );
      }

      if (!DECIMAL_LITERAL_REGEX.test(lit.raw)) {
        throw new SalaryFormulaError(
          'FORMULA_INVALID_LITERAL',
          `Invalid numeric literal syntax: "${lit.raw}". Must match standard decimal format without scientific or alternate notations.`,
          { raw: lit.raw }
        );
      }
      break;
    }

    case 'Identifier': {
      const ident = node as Identifier;
      const name = ident.name;

      if (!IDENTIFIER_REGEX.test(name)) {
        throw new SalaryFormulaError(
          'FORMULA_INVALID_IDENTIFIER',
          `Invalid identifier format: "${name}". Identifiers must be uppercase alphanumeric starting with a letter.`,
          { identifier: name }
        );
      }

      if (!state.allowedIdentifiers.has(name)) {
        throw new SalaryFormulaError(
          'FORMULA_UNKNOWN_IDENTIFIER',
          `Unknown identifier: "${name}". It is not in the list of allowed identifiers for this formula.`,
          { identifier: name }
        );
      }

      if (!state.referencedIdentifiers.includes(name)) {
        state.referencedIdentifiers.push(name);
      }
      break;
    }

    case 'UnaryExpression': {
      const unary = node as UnaryExpression;
      if (unary.operator !== '+' && unary.operator !== '-') {
        throw new SalaryFormulaError(
          'FORMULA_UNSUPPORTED_SYNTAX',
          `Unsupported unary operator: "${unary.operator}". Only unary "+" and "-" are allowed.`,
          { operator: unary.operator }
        );
      }

      if (unary.prefix !== true) {
        throw new SalaryFormulaError(
          'FORMULA_UNSUPPORTED_SYNTAX',
          'Only prefix unary expressions are supported'
        );
      }

      validateAstNode(unary.argument, depth + 1, state);
      break;
    }

    case 'BinaryExpression': {
      const binary = node as BinaryExpression;
      const allowedOps = ['+', '-', '*', '/'];
      if (!allowedOps.includes(binary.operator)) {
        throw new SalaryFormulaError(
          'FORMULA_UNSUPPORTED_SYNTAX',
          `Unsupported binary operator: "${binary.operator}". Only "+", "-", "*", and "/" are allowed.`,
          { operator: binary.operator }
        );
      }

      validateAstNode(binary.left, depth + 1, state);
      validateAstNode(binary.right, depth + 1, state);
      break;
    }

    default: {
      throw new SalaryFormulaError(
        'FORMULA_UNSUPPORTED_SYNTAX',
        `Unsupported expression syntax: node type "${node.type}" is forbidden`,
        { nodeType: node.type }
      );
    }
  }
}
