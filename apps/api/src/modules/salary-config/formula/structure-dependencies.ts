import {
  BUILTIN_IDENTIFIERS_SET,
  IDENTIFIER_REGEX,
} from './formula.constants.js';
import { SalaryFormulaError } from './formula.errors.js';
import { parseAndValidateFormula } from './formula-parser.js';
import type {
  StructureRuleDependencyInput,
  ValidatedStructureRule,
} from './formula.types.js';

export function validateStructureDependencies(
  rules: readonly StructureRuleDependencyInput[],
  builtins?: ReadonlySet<string>
): readonly ValidatedStructureRule[] {
  const seenCodes = new Set<string>();
  const seenSequences = new Set<number>();

  const activeRuleCodes = new Set<string>();
  const inactiveRuleCodes = new Set<string>();

  // 1. Initial pass: validate code/sequence syntax and uniqueness across all rules
  for (const rule of rules) {
    if (!rule.code || !IDENTIFIER_REGEX.test(rule.code)) {
      throw new SalaryFormulaError(
        'FORMULA_INVALID_IDENTIFIER',
        `Invalid rule code "${rule.code}". Must match uppercase alphanumeric pattern.`,
        { ruleId: rule.id, code: rule.code }
      );
    }

    if (
      !Number.isInteger(rule.sequence) ||
      rule.sequence <= 0 ||
      rule.sequence > 1_000_000
    ) {
      throw new SalaryFormulaError(
        'FORMULA_SYNTAX_ERROR',
        `Invalid sequence "${rule.sequence}" for rule "${rule.code}". Must be an integer between 1 and 1,000,000.`,
        { ruleId: rule.id, code: rule.code, sequence: rule.sequence }
      );
    }

    if (seenCodes.has(rule.code)) {
      throw new SalaryFormulaError(
        'RULE_CODE_DUPLICATE',
        `Duplicate rule code "${rule.code}" detected in salary structure`,
        { ruleId: rule.id, code: rule.code }
      );
    }
    seenCodes.add(rule.code);

    if (seenSequences.has(rule.sequence)) {
      throw new SalaryFormulaError(
        'RULE_SEQUENCE_DUPLICATE',
        `Duplicate rule sequence "${rule.sequence}" detected for code "${rule.code}"`,
        { ruleId: rule.id, code: rule.code, sequence: rule.sequence }
      );
    }
    seenSequences.add(rule.sequence);

    if (rule.status === 'ACTIVE') {
      activeRuleCodes.add(rule.code);
    } else {
      inactiveRuleCodes.add(rule.code);
    }
  }

  // 2. Sort a copied array by sequence ascending
  const sortedRules = [...rules].sort((a, b) => a.sequence - b.sequence);

  // 3. Initialize available identifiers with built-ins
  const available = new Set<string>(builtins ?? BUILTIN_IDENTIFIERS_SET);
  const validatedRules: ValidatedStructureRule[] = [];

  // 4. Validate dependencies in execution order
  for (const rule of sortedRules) {
    // Inactive rules are skipped and do not expose their code
    if (rule.status !== 'ACTIVE') {
      continue;
    }

    if (rule.method === 'FIXED') {
      validatedRules.push({
        code: rule.code,
        referencedIdentifiers: Object.freeze([]),
      });
      available.add(rule.code);
      continue;
    }

    if (rule.method === 'PERCENTAGE') {
      const base = rule.percentageBase?.trim();
      if (!base) {
        throw new SalaryFormulaError(
          'FORMULA_SYNTAX_ERROR',
          `Salary rule "${rule.code}" using PERCENTAGE method requires a percentageBase`,
          { ruleId: rule.id, code: rule.code, field: 'percentageBase' }
        );
      }

      if (!IDENTIFIER_REGEX.test(base)) {
        throw new SalaryFormulaError(
          'FORMULA_INVALID_IDENTIFIER',
          `Invalid percentage base identifier "${base}" for rule "${rule.code}"`,
          { ruleId: rule.id, code: rule.code, percentageBase: base, field: 'percentageBase' }
        );
      }

      if (!available.has(base)) {
        if (rule.code === base || activeRuleCodes.has(base)) {
          throw new SalaryFormulaError(
            'RULE_DEPENDENCY_FORWARD_REFERENCE',
            `Salary rule "${rule.code}" has a forward or self-reference to "${base}"`,
            {
              ruleId: rule.id,
              ruleCode: rule.code,
              referencedCode: base,
              field: 'percentageBase',
            }
          );
        }

        if (inactiveRuleCodes.has(base)) {
          throw new SalaryFormulaError(
            'RULE_DEPENDENCY_INACTIVE_REFERENCE',
            `Salary rule "${rule.code}" references inactive rule "${base}"`,
            {
              ruleId: rule.id,
              ruleCode: rule.code,
              referencedCode: base,
              field: 'percentageBase',
            }
          );
        }

        throw new SalaryFormulaError(
          'FORMULA_UNKNOWN_IDENTIFIER',
          `Salary rule "${rule.code}" references unknown base identifier "${base}"`,
          {
            ruleId: rule.id,
            ruleCode: rule.code,
            referencedCode: base,
            field: 'percentageBase',
          }
        );
      }

      validatedRules.push({
        code: rule.code,
        referencedIdentifiers: Object.freeze([base]),
      });
      available.add(rule.code);
      continue;
    }

    if (rule.method === 'FORMULA') {
      const formula = rule.formula?.trim();
      if (!formula) {
        throw new SalaryFormulaError(
          'FORMULA_SYNTAX_ERROR',
          `Salary rule "${rule.code}" using FORMULA method requires a formula expression`,
          { ruleId: rule.id, code: rule.code, field: 'formula' }
        );
      }

      // First validate expression syntax and AST with all possible known identifiers
      // so we can distinguish forward/inactive references from syntax or unknown identifiers
      const allKnownIdentifiers = new Set([
        ...available,
        ...activeRuleCodes,
        ...inactiveRuleCodes,
      ]);

      const initialParse = parseAndValidateFormula(formula, {
        allowedIdentifiers: allKnownIdentifiers,
      });

      // Check each referenced identifier against currently available identifiers
      for (const identifier of initialParse.referencedIdentifiers) {
        if (!available.has(identifier)) {
          if (rule.code === identifier || activeRuleCodes.has(identifier)) {
            throw new SalaryFormulaError(
              'RULE_DEPENDENCY_FORWARD_REFERENCE',
              `Salary rule "${rule.code}" formula has forward or self-reference to "${identifier}"`,
              {
                ruleId: rule.id,
                ruleCode: rule.code,
                referencedCode: identifier,
                field: 'formula',
              }
            );
          }

          if (inactiveRuleCodes.has(identifier)) {
            throw new SalaryFormulaError(
              'RULE_DEPENDENCY_INACTIVE_REFERENCE',
              `Salary rule "${rule.code}" formula references inactive rule "${identifier}"`,
              {
                ruleId: rule.id,
                ruleCode: rule.code,
                referencedCode: identifier,
                field: 'formula',
              }
            );
          }

          throw new SalaryFormulaError(
            'FORMULA_UNKNOWN_IDENTIFIER',
            `Salary rule "${rule.code}" formula references unknown identifier "${identifier}"`,
            {
              ruleId: rule.id,
              ruleCode: rule.code,
              referencedCode: identifier,
              field: 'formula',
            }
          );
        }
      }

      validatedRules.push({
        code: rule.code,
        referencedIdentifiers: initialParse.referencedIdentifiers,
      });
      available.add(rule.code);
      continue;
    }

    throw new SalaryFormulaError(
      'FORMULA_UNSUPPORTED_SYNTAX',
      `Unsupported rule method: "${rule.method}"`,
      { ruleId: rule.id, code: rule.code, method: rule.method }
    );
  }

  return Object.freeze(validatedRules);
}
