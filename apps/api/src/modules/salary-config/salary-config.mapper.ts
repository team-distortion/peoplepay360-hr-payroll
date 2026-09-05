import { env } from '../../config/env.js';
import type {
  SalaryStructureListItemDto,
  SalaryStructureDetailDto,
  SalaryRuleDto,
} from '@peoplepay360/shared';
import type { SalaryStructure, SalaryRule } from '@prisma/client';
import jsep, { type Expression, type Identifier } from 'jsep';
import { IDENTIFIER_REGEX } from './formula/formula.constants.js';

export function extractFormulaIdentifiers(formula: string | null): string[] {
  if (!formula || typeof formula !== 'string') return [];
  const trimmed = formula.trim();
  if (trimmed.length === 0) return [];

  const identifiers: string[] = [];
  try {
    const ast = jsep(trimmed);
    const walk = (node: Expression | null | undefined) => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'Identifier') {
        const ident = node as Identifier;
        if (IDENTIFIER_REGEX.test(ident.name) && !identifiers.includes(ident.name)) {
          identifiers.push(ident.name);
        }
      } else if (node.type === 'UnaryExpression') {
        walk((node as any).argument);
      } else if (node.type === 'BinaryExpression') {
        walk((node as any).left);
        walk((node as any).right);
      }
    };
    walk(ast);
  } catch {
    // Return whatever could be extracted or empty
  }
  return identifiers;
}

export function toSalaryRuleDto(
  rule: SalaryRule & { salaryStructure?: { id: string; name: string } | null }
): SalaryRuleDto {
  let referencedIdentifiers: string[] = [];
  if (rule.method === 'PERCENTAGE' && rule.percentageBase) {
    referencedIdentifiers = [rule.percentageBase];
  } else if (rule.method === 'FORMULA' && rule.formula) {
    referencedIdentifiers = extractFormulaIdentifiers(rule.formula);
  }

  return {
    id: rule.id,
    salaryStructureId: rule.salaryStructureId,
    name: rule.name,
    code: rule.code,
    category: rule.category,
    sequence: rule.sequence,
    method: rule.method,
    fixedAmount: rule.fixedAmount !== null ? rule.fixedAmount.toFixed(2) : null,
    percentageRate:
      rule.percentageRate !== null ? rule.percentageRate.toFixed(4) : null,
    percentageBase: rule.percentageBase,
    formula: rule.formula,
    status: rule.status,
    salaryStructure: {
      id: rule.salaryStructure?.id ?? rule.salaryStructureId,
      name: rule.salaryStructure?.name ?? '',
    },
    referencedIdentifiers,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

export function toSalaryStructureListItemDto(
  structure: SalaryStructure & {
    rules?: Array<Pick<SalaryRule, 'id' | 'status'>>;
    _count?: { rules?: number };
  }
): SalaryStructureListItemDto {
  let activeRuleCount = 0;
  let totalRuleCount = 0;

  if (structure.rules) {
    totalRuleCount = structure.rules.length;
    activeRuleCount = structure.rules.filter((r) => r.status === 'ACTIVE').length;
  } else if (structure._count?.rules !== undefined) {
    totalRuleCount = structure._count.rules;
  }

  return {
    id: structure.id,
    name: structure.name,
    description: structure.description,
    status: structure.status,
    activeRuleCount,
    totalRuleCount,
    currency: env.COMPANY_CURRENCY,
    createdAt: structure.createdAt.toISOString(),
    updatedAt: structure.updatedAt.toISOString(),
  };
}

export function toSalaryStructureDetailDto(
  structure: SalaryStructure & {
    rules: (SalaryRule & { salaryStructure?: { id: string; name: string } | null })[];
  }
): SalaryStructureDetailDto {
  const base = toSalaryStructureListItemDto(structure);
  const rules = structure.rules.map((r) =>
    toSalaryRuleDto({
      ...r,
      salaryStructure: { id: structure.id, name: structure.name },
    })
  );

  return {
    ...base,
    activeRuleCount: rules.filter((r) => r.status === 'ACTIVE').length,
    totalRuleCount: rules.length,
    rules,
  };
}
