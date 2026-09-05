import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import {
  parseAndValidateFormula,
  evaluateParsedFormula,
  evaluateFormula,
  validateStructureDependencies,
  SalaryFormulaError,
  BUILTIN_IDENTIFIERS,
  type StructureRuleDependencyInput,
} from '../src/modules/salary-config/formula/index.js';

describe('Salary Formula Engine (Phase 4B)', () => {
  describe('Valid Parsing and Evaluation', () => {
    it('evaluates built-in identifiers', () => {
      const vars: Record<string, Prisma.Decimal> = {};
      for (const id of BUILTIN_IDENTIFIERS) {
        vars[id] = new Prisma.Decimal('100.50');
      }

      for (const id of BUILTIN_IDENTIFIERS) {
        const result = evaluateFormula(id, vars);
        expect(result.toString()).toBe('100.5');
      }
    });

    it('evaluates integer and decimal literals with correct operator precedence', () => {
      const result = evaluateFormula('2 + 3 * 4', {});
      expect(result.toString()).toBe('14');
    });

    it('evaluates expressions respecting parentheses', () => {
      const result = evaluateFormula('(2 + 3) * 4', {});
      expect(result.toString()).toBe('20');
    });

    it('handles unary plus and unary minus correctly', () => {
      const vars = {
        BASE: new Prisma.Decimal('50'),
      };
      const result1 = evaluateFormula('+BASE + 10', vars);
      expect(result1.toString()).toBe('60');

      const result2 = evaluateFormula('-BASE + 100', vars);
      expect(result2.toString()).toBe('50');

      const result3 = evaluateFormula('-(BASE * 2)', vars);
      expect(result3.toString()).toBe('-100');
    });

    it('performs exact decimal arithmetic without JS floating-point precision loss (0.1 + 0.2 = 0.3)', () => {
      const result = evaluateFormula('0.1 + 0.2', {});
      expect(result.toString()).toBe('0.3');
    });

    it('evaluates division using high precision Decimal math', () => {
      const result = evaluateFormula('10 / 3', {});
      // With precision 28, 10 / 3 gives 3.333333333333333333333333333
      expect(result.toString().startsWith('3.33333333333333333333333333')).toBe(true);
    });

    it('evaluates chained rule code variables and PRD formulas (BASIC, HRA, MEAL, OT, GROSS, PF, NET)', () => {
      const vars = {
        PRORATED_BASIC: new Prisma.Decimal('50000.00'),
        BASIC: new Prisma.Decimal('50000.00'),
        HRA: new Prisma.Decimal('10000.00'),
        MEAL: new Prisma.Decimal('2000.00'),
        OVERTIME_HOURS: new Prisma.Decimal('10'),
      };

      // Basic
      const basic = evaluateFormula('PRORATED_BASIC', vars);
      expect(basic.toString()).toBe('50000');

      // HRA = 20% of BASIC = BASIC * 0.20
      const hra = evaluateFormula('BASIC * 0.20', vars);
      expect(hra.toString()).toBe('10000');

      // OT = OVERTIME_HOURS * 250
      const ot = evaluateFormula('OVERTIME_HOURS * 250', vars);
      expect(ot.toString()).toBe('2500');

      // GROSS = BASIC + HRA + MEAL + OT
      const grossVars = {
        ...vars,
        HRA: hra,
        OT: ot,
      };
      const gross = evaluateFormula('BASIC + HRA + MEAL + OT', grossVars);
      expect(gross.toString()).toBe('64500');

      // PF = 12% of BASIC = BASIC * 0.12
      const pf = evaluateFormula('BASIC * 0.12', vars);
      expect(pf.toString()).toBe('6000');

      // NET = GROSS - PF
      const netVars = {
        ...grossVars,
        GROSS: gross,
        PF: pf,
      };
      const net = evaluateFormula('GROSS - PF', netVars);
      expect(net.toString()).toBe('58500');
    });

    it('extracts unique referenced identifiers in appearance order', () => {
      const parsed = parseAndValidateFormula('GROSS - (PF + GROSS) + BASIC', {
        allowedIdentifiers: new Set(['GROSS', 'PF', 'BASIC']),
      });
      expect(parsed.referencedIdentifiers).toEqual(['GROSS', 'PF', 'BASIC']);
    });
  });

  describe('Invalid Syntax and Security Restrictions', () => {
    it('rejects empty and whitespace-only expressions', () => {
      expect(() => parseAndValidateFormula('', { allowedIdentifiers: new Set() })).toThrowError(
        SalaryFormulaError
      );
      expect(() => parseAndValidateFormula('   ', { allowedIdentifiers: new Set() })).toThrowError(
        SalaryFormulaError
      );
    });

    it('rejects expressions exceeding maximum length', () => {
      const longExpr = '1 + ' + '1 + '.repeat(350) + '1';
      expect(() =>
        parseAndValidateFormula(longExpr, {
          allowedIdentifiers: new Set(),
          maxExpressionLength: 1000,
        })
      ).toThrowError(SalaryFormulaError);
    });

    it('rejects malformed syntax and unclosed parentheses', () => {
      expect(() => parseAndValidateFormula('(1 + 2', { allowedIdentifiers: new Set() })).toThrow(
        SalaryFormulaError
      );
      expect(() => parseAndValidateFormula('1 + * 2', { allowedIdentifiers: new Set() })).toThrow(
        SalaryFormulaError
      );
    });

    it('rejects function calls (e.g. fn(1))', () => {
      expect(() =>
        parseAndValidateFormula('SUM(1, 2)', { allowedIdentifiers: new Set(['SUM']) })
      ).toThrowError(SalaryFormulaError);
    });

    it('rejects member access (e.g. obj.prop, A[B], constructor)', () => {
      expect(() =>
        parseAndValidateFormula('A.constructor', { allowedIdentifiers: new Set(['A']) })
      ).toThrowError(SalaryFormulaError);
      expect(() =>
        parseAndValidateFormula('A["b"]', { allowedIdentifiers: new Set(['A']) })
      ).toThrowError(SalaryFormulaError);
    });

    it('rejects arrays, strings, booleans, null, conditionals', () => {
      expect(() =>
        parseAndValidateFormula('"hello" + 1', { allowedIdentifiers: new Set() })
      ).toThrowError(SalaryFormulaError);
      expect(() =>
        parseAndValidateFormula('true ? 1 : 2', { allowedIdentifiers: new Set() })
      ).toThrowError(SalaryFormulaError);
      expect(() =>
        parseAndValidateFormula('[1, 2]', { allowedIdentifiers: new Set() })
      ).toThrowError(SalaryFormulaError);
    });

    it('rejects comparison, logical, bitwise, and assignment operators', () => {
      expect(() => parseAndValidateFormula('1 == 1', { allowedIdentifiers: new Set() })).toThrow(
        SalaryFormulaError
      );
      expect(() => parseAndValidateFormula('1 > 2', { allowedIdentifiers: new Set() })).toThrow(
        SalaryFormulaError
      );
      expect(() => parseAndValidateFormula('1 && 2', { allowedIdentifiers: new Set() })).toThrow(
        SalaryFormulaError
      );
      expect(() => parseAndValidateFormula('1 | 2', { allowedIdentifiers: new Set() })).toThrow(
        SalaryFormulaError
      );
      expect(() => parseAndValidateFormula('A = 5', { allowedIdentifiers: new Set(['A']) })).toThrow(
        SalaryFormulaError
      );
    });

    it('rejects lowercase identifiers', () => {
      expect(() =>
        parseAndValidateFormula('basic * 2', { allowedIdentifiers: new Set(['basic']) })
      ).toThrowError(SalaryFormulaError);
    });

    it('rejects unknown identifiers not in the allowed set', () => {
      expect(() =>
        parseAndValidateFormula('BASIC + BONUS', { allowedIdentifiers: new Set(['BASIC']) })
      ).toThrowError(SalaryFormulaError);
    });

    it('rejects scientific, hex, octal, binary literals', () => {
      expect(() => parseAndValidateFormula('1e5', { allowedIdentifiers: new Set() })).toThrow(
        SalaryFormulaError
      );
      expect(() => parseAndValidateFormula('0x1F', { allowedIdentifiers: new Set() })).toThrow(
        SalaryFormulaError
      );
    });

    it('rejects division by zero during evaluation', () => {
      expect(() => evaluateFormula('100 / 0', {})).toThrowError(SalaryFormulaError);
      expect(() => evaluateFormula('100 / (5 - 5)', {})).toThrowError(SalaryFormulaError);
    });

    it('rejects missing variables during evaluation', () => {
      const parsed = parseAndValidateFormula('BASIC + 100', {
        allowedIdentifiers: new Set(['BASIC']),
      });
      expect(() => evaluateParsedFormula(parsed, {})).toThrowError(SalaryFormulaError);
    });

    it('rejects prototype/inherited property lookups in variables', () => {
      const vars = Object.create({
        INHERITED: new Prisma.Decimal('100'),
      });
      const parsed = parseAndValidateFormula('INHERITED + 10', {
        allowedIdentifiers: new Set(['INHERITED']),
      });
      expect(() => evaluateParsedFormula(parsed, vars)).toThrowError(SalaryFormulaError);
    });

    it('rejects result exceeding magnitude limit (>= 10^16)', () => {
      const vars = {
        HUGE: new Prisma.Decimal('9999999999999999'), // 10^16 - 1
      };
      expect(() => evaluateFormula('HUGE * 2', vars)).toThrowError(SalaryFormulaError);
    });
  });

  describe('Structure Dependency Validation', () => {
    it('validates a standard valid structure rule set and returns ordered rules', () => {
      const rules: StructureRuleDependencyInput[] = [
        {
          id: '1',
          code: 'BASIC',
          sequence: 10,
          status: 'ACTIVE',
          method: 'FORMULA',
          percentageBase: null,
          formula: 'PRORATED_BASIC',
        },
        {
          id: '2',
          code: 'HRA',
          sequence: 20,
          status: 'ACTIVE',
          method: 'PERCENTAGE',
          percentageBase: 'BASIC',
          formula: null,
        },
        {
          id: '3',
          code: 'MEAL',
          sequence: 30,
          status: 'ACTIVE',
          method: 'FIXED',
          percentageBase: null,
          formula: null,
        },
        {
          id: '4',
          code: 'GROSS',
          sequence: 40,
          status: 'ACTIVE',
          method: 'FORMULA',
          percentageBase: null,
          formula: 'BASIC + HRA + MEAL',
        },
      ];

      const validated = validateStructureDependencies(rules);
      expect(validated.map((v) => v.code)).toEqual(['BASIC', 'HRA', 'MEAL', 'GROSS']);
      expect(validated[0].referencedIdentifiers).toEqual(['PRORATED_BASIC']);
      expect(validated[1].referencedIdentifiers).toEqual(['BASIC']);
      expect(validated[2].referencedIdentifiers).toEqual([]);
      expect(validated[3].referencedIdentifiers).toEqual(['BASIC', 'HRA', 'MEAL']);
    });

    it('does not mutate caller input array', () => {
      const rules: StructureRuleDependencyInput[] = [
        {
          id: '2',
          code: 'HRA',
          sequence: 20,
          status: 'ACTIVE',
          method: 'FIXED',
          percentageBase: null,
          formula: null,
        },
        {
          id: '1',
          code: 'BASIC',
          sequence: 10,
          status: 'ACTIVE',
          method: 'FIXED',
          percentageBase: null,
          formula: null,
        },
      ];
      const copy = [...rules];
      validateStructureDependencies(rules);
      expect(rules[0].code).toBe(copy[0].code);
      expect(rules[1].code).toBe(copy[1].code);
    });

    it('rejects duplicate rule codes across all rules', () => {
      const rules: StructureRuleDependencyInput[] = [
        {
          id: '1',
          code: 'BASIC',
          sequence: 10,
          status: 'ACTIVE',
          method: 'FIXED',
          percentageBase: null,
          formula: null,
        },
        {
          id: '2',
          code: 'BASIC',
          sequence: 20,
          status: 'INACTIVE',
          method: 'FIXED',
          percentageBase: null,
          formula: null,
        },
      ];
      expect(() => validateStructureDependencies(rules)).toThrowError(
        /Duplicate rule code "BASIC"/
      );
    });

    it('rejects duplicate rule sequences across all rules', () => {
      const rules: StructureRuleDependencyInput[] = [
        {
          id: '1',
          code: 'BASIC',
          sequence: 10,
          status: 'ACTIVE',
          method: 'FIXED',
          percentageBase: null,
          formula: null,
        },
        {
          id: '2',
          code: 'HRA',
          sequence: 10,
          status: 'ACTIVE',
          method: 'FIXED',
          percentageBase: null,
          formula: null,
        },
      ];
      expect(() => validateStructureDependencies(rules)).toThrowError(
        /Duplicate rule sequence "10"/
      );
    });

    it('rejects self-references in formulas and percentage base', () => {
      const rules1: StructureRuleDependencyInput[] = [
        {
          id: '1',
          code: 'BASIC',
          sequence: 10,
          status: 'ACTIVE',
          method: 'PERCENTAGE',
          percentageBase: 'BASIC',
          formula: null,
        },
      ];
      expect(() => validateStructureDependencies(rules1)).toThrowError(
        /forward or self-reference/
      );

      const rules2: StructureRuleDependencyInput[] = [
        {
          id: '1',
          code: 'BASIC',
          sequence: 10,
          status: 'ACTIVE',
          method: 'FORMULA',
          percentageBase: null,
          formula: 'BASIC + 100',
        },
      ];
      expect(() => validateStructureDependencies(rules2)).toThrowError(
        /forward or self-reference/
      );
    });

    it('rejects forward references to later rules in sequence', () => {
      const rules: StructureRuleDependencyInput[] = [
        {
          id: '1',
          code: 'NET',
          sequence: 10,
          status: 'ACTIVE',
          method: 'FORMULA',
          percentageBase: null,
          formula: 'GROSS - 1000',
        },
        {
          id: '2',
          code: 'GROSS',
          sequence: 20,
          status: 'ACTIVE',
          method: 'FIXED',
          percentageBase: null,
          formula: null,
        },
      ];
      expect(() => validateStructureDependencies(rules)).toThrowError(
        /forward or self-reference to "GROSS"/
      );
    });

    it('rejects references to inactive rules', () => {
      const rules: StructureRuleDependencyInput[] = [
        {
          id: '1',
          code: 'OLD_ALLOWANCE',
          sequence: 10,
          status: 'INACTIVE',
          method: 'FIXED',
          percentageBase: null,
          formula: null,
        },
        {
          id: '2',
          code: 'GROSS',
          sequence: 20,
          status: 'ACTIVE',
          method: 'FORMULA',
          percentageBase: null,
          formula: 'OLD_ALLOWANCE + 5000',
        },
      ];
      expect(() => validateStructureDependencies(rules)).toThrowError(
        /references inactive rule "OLD_ALLOWANCE"/
      );
    });

    it('rejects references to completely unknown identifiers', () => {
      const rules: StructureRuleDependencyInput[] = [
        {
          id: '1',
          code: 'GROSS',
          sequence: 10,
          status: 'ACTIVE',
          method: 'FORMULA',
          percentageBase: null,
          formula: 'UNKNOWN_VAR * 2',
        },
      ];
      expect(() => validateStructureDependencies(rules)).toThrowError(
        /unknown identifier:? "UNKNOWN_VAR"/i
      );
    });
  });

  describe('Static Safety Assertion', () => {
    it('confirms source files do not contain eval, Function, parseFloat, or Number conversions', () => {
      const formulaDir = path.resolve(__dirname, '../src/modules/salary-config/formula');
      const files = fs.readdirSync(formulaDir);

      const forbiddenTerms = [
        /\beval\s*\(/,
        /\bnew\s+Function\s*\(/,
        /\bparseFloat\s*\(/,
        /\bNumber\s*\(/,
      ];

      for (const file of files) {
        if (!file.endsWith('.ts')) continue;
        const filePath = path.join(formulaDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        // Allow Number.isFinite and Number.isInteger for integer/numeric validation
        const sanitizedContent = content
          .replace(/Number\.isFinite/g, '')
          .replace(/Number\.isInteger/g, '');

        for (const term of forbiddenTerms) {
          const match = sanitizedContent.match(term);
          expect(
            match,
            `Forbidden conversion or execution construct ${term} found in ${file}`
          ).toBeNull();
        }
      }
    });
  });
});
