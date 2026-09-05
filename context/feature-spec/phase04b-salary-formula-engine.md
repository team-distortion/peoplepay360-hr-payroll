# Phase 4B - Safe Salary Formula Engine

## Metadata

- **Status:** APPROVED FOR PARALLEL IMPLEMENTATION
- **Target branch:** `feature/salary-formula-engine`
- **Assumed baseline:** Phase 1 foundation dependencies (`jsep`, Prisma Decimal) are available
- **PRD coverage:** A6 Salary Rule Setup; salary sequencing and formula-driven computation requirements
- **Depends on:** Existing TypeScript/API workspace only; no domain migration
- **Blocks:** Phase 4A Formula Rule validation and Phase 8 Payslip computation
- **Parallel owner:** Recommended independent contributor task

## 1. Goal

Build a pure, deterministic, secure arithmetic Formula Engine for Salary Rules.
It must parse expressions with `jsep`, validate an allowlisted AST, validate
identifier dependencies, and evaluate with Prisma Decimal without executing
JavaScript or converting monetary arithmetic to `number`.

This feature contains no database, HTTP, React, or payroll-record logic.

## 2. File Ownership

This branch may create/edit only:

```text
apps/api/src/modules/salary-config/formula/
  formula.constants.ts
  formula.errors.ts
  formula.types.ts
  formula-parser.ts
  formula-validator.ts
  formula-evaluator.ts
  structure-dependencies.ts
  index.ts

apps/api/tests/salary-formula.test.ts
```

It must not edit:

```text
apps/api/prisma/**
apps/api/src/routes/index.ts
apps/api/src/modules/salary-config/*.controller.ts
apps/api/src/modules/salary-config/*.routes.ts
apps/api/src/modules/salary-config/*.service.ts
packages/shared/**
frontend/**
package.json
package-lock.json
```

`jsep` and `@prisma/client` are already installed. No dependency change is
allowed. The Phase 4A integrator imports the public exports after merge.

## 3. Supported Language

Allowed:

- unsigned decimal literals;
- identifiers;
- parentheses;
- unary `+` and `-`;
- binary `+`, `-`, `*`, and `/`.

Examples:

```text
PRORATED_BASIC
BASIC * 0.20
GROSS - PF
(WAGE / EXPECTED_DAYS) * WORKED_DAYS
-ADJUSTMENT + BASIC
```

Forbidden:

- function calls;
- member/property access;
- assignments;
- arrays or objects;
- strings, booleans, null;
- conditionals/ternaries;
- logical/comparison/bitwise operators;
- update operators;
- comma/compound expressions;
- template syntax;
- hexadecimal, binary, octal, `Infinity`, `NaN`, or scientific notation;
- implicit multiplication;
- arbitrary JavaScript identifiers outside the supplied allowlist.

## 4. Decimal Rules

1. Use `Prisma.Decimal` for literals, variables, and every intermediate result.
2. Never use `parseFloat`, `Number`, JS arithmetic, or `node.value` as the
   authoritative numeric literal.
3. Read numeric literal text from the AST `raw` field and validate the raw text
   before constructing Decimal.
4. Allowed literal syntax:

```regex
^(?:0|[1-9][0-9]{0,17})(?:\.[0-9]{1,8})?$
```

5. Unary minus creates negative Decimal values; the literal itself remains
   unsigned.
6. Configure Decimal precision once for this module to 28 significant digits
   and `ROUND_HALF_UP`.
7. Do not round intermediate operations to currency precision.
8. The Formula Engine returns Decimal. The later Payslip service owns final
   currency rounding/persistence to two decimal places.
9. Division by zero is a typed validation/evaluation error.
10. Reject a non-finite or out-of-range final value. Absolute final value must
    be less than `10^16` before currency rounding.

## 5. Identifiers

Built-ins:

```text
WAGE
PRORATED_BASIC
WORKED_DAYS
EXPECTED_DAYS
WORKED_HOURS
EXPECTED_HOURS
OVERTIME_HOURS
```

Rule codes and identifiers use:

```regex
^[A-Z][A-Z0-9_]{0,39}$
```

Identifiers are case-sensitive. Lowercase names are rejected; they are not
silently uppercased inside formulas.

A formula validation call receives the exact allowed identifier set. The parser
must not assume all Rule codes are valid merely because they match the pattern.

## 6. Public Types and API

`formula.types.ts`:

```ts
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
  maxAstNodes?: number;         // default 200
  maxDepth?: number;            // default 32
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
```

Public functions exported from `index.ts`:

```ts
export function parseAndValidateFormula(
  expression: string,
  options: FormulaValidationOptions,
): ParsedFormula;

export function evaluateParsedFormula(
  parsed: ParsedFormula,
  variables: DecimalVariables,
): Prisma.Decimal;

export function evaluateFormula(
  expression: string,
  variables: DecimalVariables,
): Prisma.Decimal;

export function validateStructureDependencies(
  rules: readonly StructureRuleDependencyInput[],
  builtins?: ReadonlySet<string>,
): readonly ValidatedStructureRule[];
```

`evaluateFormula` derives its allowed identifiers from `Object.keys(variables)`,
parses/validates, then evaluates. It must not accept missing variables.

## 7. Typed Errors

Create `SalaryFormulaError extends Error` with:

```ts
type SalaryFormulaErrorCode =
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
```

Properties:

```ts
code: SalaryFormulaErrorCode;
message: string;
details?: Record<string, unknown>;
```

Do not include a raw parser stack trace in messages. Phase 4A maps these errors
to the public `AppError` contract.

## 8. Parsing

`parseAndValidateFormula` must:

1. Require a string after trimming, length 1-1000.
2. Parse once with `jsep` inside try/catch.
3. Convert parser failure to `FORMULA_SYNTAX_ERROR`.
4. Walk the AST recursively with explicit node-type handling.
5. Track node count and depth; reject more than 200 nodes or depth over 32.
6. Collect identifiers in first-appearance order, without duplicates.
7. Return the trimmed original expression, AST, and frozen identifier list.

Do not register custom jsep operators. Use its standard parser, then reject
every operator/node outside the allowlist.

## 9. AST Allowlist

Accepted node types:

### `Literal`

- `raw` must exist and be a string matching the decimal-literal regex.
- `value` must be a number only as a parser sanity check; never use it to create
  Decimal.
- Reject string/boolean/null literals.

### `Identifier`

- Name must match the uppercase identifier pattern.
- Name must be in `allowedIdentifiers`.

### `UnaryExpression`

- Operator only `+` or `-`.
- Prefix form only.
- Recursively validate argument.

### `BinaryExpression`

- Operator only `+`, `-`, `*`, or `/`.
- Recursively validate left and right.

Reject all other node types, including `CallExpression`, `MemberExpression`,
`ArrayExpression`, `ConditionalExpression`, `Compound`, and any jsep extension
node. Never attempt partial evaluation of a rejected tree.

## 10. Evaluation

Evaluation is a custom recursive switch over the already validated AST:

- Literal: `new Prisma.Decimal(node.raw)`.
- Identifier: retrieve own property from `variables`; inherited/prototype values
  are forbidden.
- Unary plus: return operand.
- Unary minus: `operand.negated()`.
- Addition: `left.plus(right)`.
- Subtraction: `left.minus(right)`.
- Multiplication: `left.times(right)`.
- Division: reject zero right operand, otherwise `left.dividedBy(right)`.

Even though validation runs first, evaluation must use exhaustive switches and
throw `FORMULA_UNSUPPORTED_SYNTAX` for impossible/unrecognized nodes/operators.
Do not use dynamic property lookup to select an operation.

After evaluation, enforce the final absolute-value bound.

## 11. Structure Dependency Validation

`validateStructureDependencies` validates configuration without evaluating
money.

Algorithm:

1. Validate every code pattern and positive integer sequence.
2. Reject duplicate codes among all Rules, including inactive Rules.
3. Reject duplicate sequences among all Rules, including inactive Rules.
4. Sort a copied array by sequence ascending; do not mutate caller input.
5. Initialize `available` with the seven built-ins.
6. Skip dependency validation/exposure for INACTIVE Rules.
7. FIXED active Rule references nothing.
8. PERCENTAGE active Rule requires one `percentageBase`; it must be in
   `available`.
9. FORMULA active Rule uses `parseAndValidateFormula` with `available`.
10. If an identifier matches a known later active Rule code, throw forward
    reference.
11. If it matches a known inactive Rule code, throw inactive reference.
12. Otherwise throw unknown identifier.
13. After an active Rule validates, add its code to `available`.
14. Return active validated Rules in execution order with identifier lists.

Self-reference is classified as forward reference because the current Rule code
is not exposed until validation completes. Error details must still identify
the same current Rule as both owner and reference.

## 12. Security Requirements

- No `eval`, `Function`, dynamic import, VM, code generation, or expression
  interpolation.
- No property/member access, including constructor/prototype paths.
- No object spread from untrusted variables.
- Check variables with `Object.prototype.hasOwnProperty.call`.
- Do not log formulas with variable values from real payroll data.
- Complexity limits must apply before evaluation.
- Parser/AST objects are never persisted by this feature.
- No network, database, filesystem, clock, randomness, locale, or environment
  access inside parse/validate/evaluate functions.
- Same expression and variables must always produce the same Decimal result.

## 13. Test Matrix

### Valid parsing/evaluation

- each built-in identifier;
- integer and decimal literals;
- precedence: `2 + 3 * 4 = 14`;
- parentheses: `(2 + 3) * 4 = 20`;
- unary plus/minus;
- chained Rule-code variables;
- decimal precision: `0.1 + 0.2 = 0.3` exactly;
- division result uses configured Decimal precision;
- PRD examples BASIC/HRA/OT/GROSS/PF/NET.

### Invalid syntax/security

- empty/whitespace and over-1000 expression;
- malformed parentheses/operators;
- calls: `fn(1)`;
- member access: `A.constructor`, `A[B]`;
- arrays, strings, booleans, null, conditionals;
- logical/comparison/bitwise operators;
- assignment/update/comma expressions;
- lowercase or invalid identifier;
- unknown identifier;
- scientific/hex/binary/octal literal;
- literal exceeding digit/fraction limits;
- AST over node/depth limit;
- division by positive/negative zero;
- missing variable at evaluation;
- inherited/prototype variable lookup;
- final result outside allowed magnitude.

### Dependency validation

- valid built-in base;
- valid earlier Rule-code base/reference;
- duplicate code and duplicate sequence;
- self-reference;
- forward reference;
- unknown reference;
- inactive reference;
- inactive Rule is not exposed to later Rules;
- fixed Rule has no references;
- input array is not mutated;
- output is ordered and deterministic.

### Static safety assertion

Test/source scan must confirm Formula Engine source contains no calls to
`eval`, `Function`, `parseFloat`, or `Number` for arithmetic conversion.

## 14. Exact Implementation Order

1. Create error codes/class and public types.
2. Define built-ins, identifier/literal patterns, and complexity defaults.
3. Implement parser plus exhaustive AST validator.
4. Add parsing/security/complexity tests.
5. Implement recursive Decimal evaluator.
6. Add arithmetic/precision/division/range tests.
7. Implement Structure dependency validator.
8. Add duplicate/ordering/forward/inactive dependency tests.
9. Export only the documented public API from `index.ts`.
10. Run API typecheck/build and the complete test suite.
11. Append one Branch Updates entry only; do not edit tracker summaries.

## 15. Verification

```bash
npm run typecheck --workspace=apps/api
npm run build --workspace=apps/api
npm test --workspace=apps/api -- salary-formula.test.ts
npm test
```

No database or Docker command is required for this pure feature, though the
full repository test command may require the existing test PostgreSQL setup.

## 16. Handoff to Phase 4A

The contributor must report:

- exact exported functions/types;
- test cases and results;
- Decimal import/configuration choice;
- any jsep AST typing limitation encountered;
- confirmation that no forbidden file was modified.

Phase 4A integrates the public exports and maps `SalaryFormulaError` to API
errors. Phase 4B must not add HTTP or Prisma persistence behavior itself.

## 17. Definition of Done

- [ ] Public API exactly matches this spec.
- [ ] Only owned files were changed.
- [ ] Every AST node/operator is allowlisted explicitly.
- [ ] Numeric literals preserve raw decimal text.
- [ ] All arithmetic uses Prisma Decimal.
- [ ] Unknown/self/forward/inactive dependencies are distinguished.
- [ ] Division by zero, complexity, and result bounds are enforced.
- [ ] Security and precision test matrices pass.
- [ ] API typecheck/build and relevant full tests pass.
- [ ] No database, route, shared-contract, or frontend change was made.

## 18. Non-Negotiables

- Never execute formula text as JavaScript.
- Never use JS floating-point arithmetic for evaluated values.
- Never accept identifiers outside the supplied allowlist.
- Never permit member access or function calls.
- Never let this parallel branch touch Prisma schema/migrations or integration
  files.
