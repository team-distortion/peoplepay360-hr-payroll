import type { Expression } from 'jsep';
import type { Prisma } from '@prisma/client';

export interface ParsedFormula {
  expression: string;
  ast: Expression;
  referencedIdentifiers: readonly string[];
}

export interface FormulaValidationOptions {
  allowedIdentifiers: ReadonlySet<string>;
  maxExpressionLength?: number; // default 1000
  maxAstNodes?: number; // default 200
  maxDepth?: number; // default 32
}

export type DecimalVariables = Readonly<Record<string, Prisma.Decimal>>;

export interface StructureRuleDependencyInput {
  id: string | null;
  code: string;
  sequence: number;
  status: 'ACTIVE' | 'INACTIVE';
  method: 'FIXED' | 'PERCENTAGE' | 'FORMULA';
  percentageBase: string | null;
  formula: string | null;
}

export interface ValidatedStructureRule {
  code: string;
  referencedIdentifiers: readonly string[];
}
