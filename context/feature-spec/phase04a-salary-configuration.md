# Phase 4A - Salary Structures and Salary Rules

## Metadata

- **Status:** APPROVED FOR IMPLEMENTATION
- **Target branch:** `feature/phase04-salary-configuration`
- **Assumed baseline:** Phase 3 Employee Master is merged and verified
- **PRD coverage:** A5 Salary Structure Setup; A6 Salary Rule Setup; B7 Salary Computation presentation; User Roles; Technical Guidelines
- **Depends on:** Phase 1 RBAC, Phase 3 shared `RecordStatus`, and the Phase 4B Formula Engine contract
- **Blocks:** Contract Salary Structure assignment and all Payrun/Payslip computation
- **Parallel ownership:** This branch owns Prisma, APIs, shared contracts, and salary-configuration UI. It must not edit the Formula Engine files owned by Phase 4B.

## 1. Goal

Implement real Salary Structure and Salary Rule configuration. Payroll managers
and Admins must be able to configure ordered rules using Fixed Amount,
Percentage, or Formula methods. HR Payroll Users must have read-only access.
All data must persist in PostgreSQL and be ready for Contract assignment and
Payrun computation in later phases.

This phase configures and validates rules; it does not calculate or persist
Payslips.

## 2. Source Priority

1. Attached PeoplePay360 PRD.
2. `context/architecture.md`, especially Salary Rule Engine invariants.
3. `context/project-overview.md` vocabulary and role definitions.
4. This spec.
5. Existing UI design system in `context/ui-context.md` and `frontend/`.

## 3. Scope

### In scope

- Salary Structure persistence, list, detail, create, update, and status.
- Salary Rule persistence and ordered configuration per Structure.
- Fixed, Percentage, and Formula method-specific fields.
- Category, code, sequence, and dependency validation.
- Atomic full-Structure rule configuration update.
- Global Salary Rule list/detail plus Structure-scoped rule management.
- Read/write role separation.
- Salary Structure and Salary Rule frontend screens.
- Representative Salary Structure/Rule seed data.

### Out of scope

- Contracts and assigning Employees to Structures.
- Payrun/Payslip models or actual salary computation.
- Attendance/overtime/Time Off aggregation.
- Tax slabs, statutory compliance, currency conversion, or country-specific law.
- Versioning or cloning Structures.
- Rule drag-and-drop if accessible move controls are provided.
- Hard deletion.
- Employee count on Structure cards; Contracts do not exist yet.

## 4. Locked Decisions

1. A Salary Structure directly owns its Salary Rules; Rules are not shared
   between Structures.
2. Structure status and Rule status are `ACTIVE` or `INACTIVE` using the shared
   `RecordStatus` enum from Phase 3.
3. Structure names are unique case-insensitively through normalized `nameKey`.
4. Rule codes are uppercase identifiers and unique inside one Structure.
5. Rule sequence is a positive integer and unique inside one Structure. Gaps
   are allowed; Rules execute in ascending sequence, then ID only for stable
   display. A tie is always invalid and never resolved by ID.
6. Inactive Rules remain historical configuration but do not execute and cannot
   be referenced by active later Rules.
7. Fixed Amount stores one Decimal amount.
8. Percentage stores a Decimal rate and one base identifier.
9. Formula stores one expression validated by the Phase 4B Formula Engine.
10. Exactly the fields for the selected method may be non-null.
11. Rule inputs and results are not signed by category automatically. A
    Deduction such as `PF` normally produces a positive value; a later `NET`
    formula subtracts it explicitly.
12. Intermediate formula values are never converted to JavaScript `number`.
13. Changing a code/sequence/method/status must revalidate the complete active
    Structure dependency graph.
14. The atomic configuration endpoint is the authoritative way to rename codes,
    reorder several Rules, or update dependent formulas together.
15. Individual Rule update is allowed only when the resulting complete
    Structure remains valid.
16. A Structure may be saved as INACTIVE with zero active Rules. Activating a
    Structure requires at least one active Rule and a valid dependency graph.
17. Phase 4 does not enforce the presence of particular categories. Payrun
    eligibility/computation will later require a usable final result and surface
    configuration errors. This avoids inventing a statutory salary template.
18. No API accepts precomputed totals or evaluated Rule amounts.
19. Currency comes from `COMPANY_CURRENCY`; Structure/Rule records do not store
    a separate currency.

## 5. Prisma Schema

```prisma
enum SalaryRuleCategory {
  BASIC
  ALLOWANCE
  OVERTIME
  GROSS
  DEDUCTION
  CONTRIBUTION
  NET
}

enum SalaryRuleMethod {
  FIXED
  PERCENTAGE
  FORMULA
}

model SalaryStructure {
  id          String       @id @default(uuid())
  name        String
  nameKey     String       @unique
  description String?
  status      RecordStatus @default(ACTIVE)
  rules       SalaryRule[]
  createdAt   DateTime     @default(now()) @db.Timestamptz(3)
  updatedAt   DateTime     @updatedAt @db.Timestamptz(3)

  @@index([status])
}

model SalaryRule {
  id                String             @id @default(uuid())
  salaryStructureId String
  name              String
  code              String
  category          SalaryRuleCategory
  sequence          Int
  method            SalaryRuleMethod
  fixedAmount       Decimal?           @db.Decimal(18, 2)
  percentageRate    Decimal?           @db.Decimal(9, 4)
  percentageBase    String?
  formula           String?
  status            RecordStatus       @default(ACTIVE)
  salaryStructure   SalaryStructure    @relation(fields: [salaryStructureId], references: [id], onDelete: Restrict)
  createdAt         DateTime           @default(now()) @db.Timestamptz(3)
  updatedAt         DateTime           @updatedAt @db.Timestamptz(3)

  @@unique([salaryStructureId, code])
  @@unique([salaryStructureId, sequence])
  @@index([salaryStructureId, status, sequence])
  @@index([category])
  @@index([method])
}
```

Migration name:

```text
phase04_salary_configuration
```

Add SQL checks:

```sql
ALTER TABLE "SalaryRule"
  ADD CONSTRAINT "SalaryRule_code_check"
  CHECK ("code" ~ '^[A-Z][A-Z0-9_]{0,39}$'),
  ADD CONSTRAINT "SalaryRule_sequence_check"
  CHECK ("sequence" > 0 AND "sequence" <= 1000000),
  ADD CONSTRAINT "SalaryRule_fixedAmount_check"
  CHECK ("fixedAmount" IS NULL OR "fixedAmount" >= 0),
  ADD CONSTRAINT "SalaryRule_percentageRate_check"
  CHECK ("percentageRate" IS NULL OR ("percentageRate" >= 0 AND "percentageRate" <= 1000)),
  ADD CONSTRAINT "SalaryRule_method_fields_check"
  CHECK (
    ("method" = 'FIXED' AND "fixedAmount" IS NOT NULL AND "percentageRate" IS NULL AND "percentageBase" IS NULL AND "formula" IS NULL)
    OR
    ("method" = 'PERCENTAGE' AND "fixedAmount" IS NULL AND "percentageRate" IS NOT NULL AND "percentageBase" IS NOT NULL AND "formula" IS NULL)
    OR
    ("method" = 'FORMULA' AND "fixedAmount" IS NULL AND "percentageRate" IS NULL AND "percentageBase" IS NULL AND "formula" IS NOT NULL)
  );
```

The API must still validate all checks before Prisma writes. Translate unique
constraint races to safe 409 errors.

## 6. Shared Contracts

Create `packages/shared/src/types/salary-config.ts` and export it.

Value sets:

```ts
export const SalaryRuleCategoryValues = [
  'BASIC', 'ALLOWANCE', 'OVERTIME', 'GROSS',
  'DEDUCTION', 'CONTRIBUTION', 'NET',
] as const;

export const SalaryRuleMethodValues = ['FIXED', 'PERCENTAGE', 'FORMULA'] as const;

export const SalaryFormulaBuiltinValues = [
  'WAGE', 'PRORATED_BASIC', 'WORKED_DAYS', 'EXPECTED_DAYS',
  'WORKED_HOURS', 'EXPECTED_HOURS', 'OVERTIME_HOURS',
] as const;
```

Rule input:

```ts
interface SalaryRuleInput {
  name: string;
  code: string;
  category: SalaryRuleCategory;
  sequence: number;
  method: SalaryRuleMethod;
  fixedAmount: string | null;
  percentageRate: string | null;
  percentageBase: string | null;
  formula: string | null;
  status: RecordStatus;
}
```

Decimals cross HTTP as canonical decimal strings, never JSON numbers.

Structure input:

```ts
interface SalaryStructureInput {
  name: string;
  description: string | null;
  status: RecordStatus;
}
```

DTO requirements:

- Structure list: ID, name, description, status, activeRuleCount,
  totalRuleCount, currency, createdAt, updatedAt.
- Structure detail: list fields plus ordered Rule DTOs.
- Rule DTO: persisted fields, Structure summary, `referencedIdentifiers`, and
  timestamps. Decimal fields remain strings.
- Do not return `employeeCount` or a fake zero; add it after Contracts exist.

Validation:

- Structure name: trimmed 2-100; description null or trimmed max 500.
- Rule name: trimmed 2-100.
- Code: trim and uppercase; `^[A-Z][A-Z0-9_]{0,39}$`.
- Sequence: integer 1-1,000,000.
- Fixed amount: canonical non-negative decimal, max 2 fractional digits, max
  16 integral digits.
- Percentage rate: canonical non-negative decimal, max 4 fractional digits,
  range 0-1000 inclusive. It represents percent, so `20` means 20 percent.
- Percentage base: one built-in or earlier active Rule code.
- Formula: trimmed 1-1000 characters and valid under Phase 4B.
- Reject empty strings for nullable method fields; normalize them to null before
  method validation.

## 7. Dependency Validation

For each active Rule in sequence order:

1. Begin with the seven built-ins.
2. Validate its Percentage base or Formula identifiers against built-ins plus
   codes from earlier active Rules.
3. Reject references to itself, later Rules, inactive Rules, unknown names, or
   another Structure.
4. After validation, expose this Rule's code to subsequent Rules.

Errors must identify the Rule ID/index, field, and invalid identifier. Duplicate
codes and sequences are detected before dependency traversal.

## 8. Authorization

| Action | Employee | HR Manager | HR Payroll User | HR Payroll Manager | Admin |
| --- | --- | --- | --- | --- | --- |
| List/read Structures | Deny | Deny | Allow | Allow | Allow |
| List/read Rules | Deny | Deny | Allow | Allow | Allow |
| Create/update/status Structure | Deny | Deny | Deny | Allow | Allow |
| Create/update/status/reorder Rules | Deny | Deny | Deny | Allow | Allow |

Every route uses `authenticate` plus explicit `authorize(...)`. UI hiding is not
authorization.

## 9. Structure API

Base path: `/api/v1/payroll/structures`.

### GET `/api/v1/payroll/structures`

Query:

```text
search?: trimmed <= 100
status?: ACTIVE | INACTIVE
page?: integer >= 1, default 1
pageSize?: integer 1-100, default 20
```

Search name/description case-insensitively. Order by name, then ID.

### GET `/api/v1/payroll/structures/:id`

Return Structure detail and all Rules ordered by sequence, including inactive
Rules unless `includeInactiveRules=false` is explicitly passed.

### POST `/api/v1/payroll/structures`

- Body: `SalaryStructureInput`.
- `201`: created Structure. ACTIVE creation with no Rules is allowed only as a
  configuration draft, but it cannot be selected by future Contract/Payrun
  eligibility until at least one valid active Rule exists.
- Duplicate normalized name returns 409.

### PUT `/api/v1/payroll/structures/:id`

Complete Structure input. Does not update Rules.

### PATCH `/api/v1/payroll/structures/:id/status`

Body `{ status }`. Activating validates the complete active Rule set and requires
at least one active Rule. Deactivation preserves Rules.

No DELETE route.

## 10. Rule API

### GET `/api/v1/payroll/rules`

Query:

```text
salaryStructureId?: UUID
search?: name or code, max 100
category?: SalaryRuleCategory
method?: SalaryRuleMethod
status?: ACTIVE | INACTIVE
page?: >= 1, default 1
pageSize?: 1-100, default 20
```

Order by Structure name, Rule sequence, Rule ID.

### GET `/api/v1/payroll/rules/:id`

Return one Rule DTO plus Structure summary and referenced identifiers.

### POST `/api/v1/payroll/structures/:structureId/rules`

- Body: `SalaryRuleInput`.
- Validate the prospective complete active Structure.
- `201`: created Rule.

### PUT `/api/v1/payroll/rules/:id`

- Complete Rule input.
- Structure cannot be changed.
- Validate the prospective complete active Structure before commit.
- Return 409 if code/sequence/dependency conflicts.

### PATCH `/api/v1/payroll/rules/:id/status`

Activation/deactivation must leave all remaining active dependencies valid.
Deactivating a Rule referenced by a later active Rule returns
`RULE_CODE_IN_USE`.

### PUT `/api/v1/payroll/structures/:structureId/rules/configuration`

Atomic multi-Rule update for reorder/code rename/dependent formula edits.

Body:

```ts
interface SalaryRuleConfigurationInput {
  rules: Array<SalaryRuleInput & { id: string | null }>;
}
```

- Existing IDs must belong to the path Structure.
- Every existing Rule must appear exactly once; omission is rejected, not
  interpreted as deletion.
- `id: null` creates a new Rule.
- Validate the entire prospective set before any write.
- Upsert all Rules in one transaction.
- Handle sequence swaps without transient uniqueness failures by using a safe
  two-stage temporary-sequence update inside the transaction.
- Response is the complete ordered Structure detail.

No Rule DELETE route.

## 11. Errors

| Code | HTTP | Meaning |
| --- | ---: | --- |
| `VALIDATION_ERROR` | 400 | Invalid path/query/body/method fields |
| `UNAUTHENTICATED` | 401 | Missing/invalid session |
| `FORBIDDEN` | 403 | Role cannot perform action |
| `SALARY_STRUCTURE_NOT_FOUND` | 404 | Structure absent |
| `SALARY_RULE_NOT_FOUND` | 404 | Rule absent |
| `SALARY_STRUCTURE_NAME_EXISTS` | 409 | Normalized duplicate name |
| `SALARY_RULE_CODE_EXISTS` | 409 | Duplicate code in Structure |
| `SALARY_RULE_SEQUENCE_EXISTS` | 409 | Duplicate sequence in Structure |
| `SALARY_RULE_DEPENDENCY_INVALID` | 409 | Unknown/self/forward/inactive reference |
| `SALARY_RULE_CODE_IN_USE` | 409 | Active dependents block change/deactivation |
| `SALARY_STRUCTURE_INVALID` | 409 | Activation/configuration graph invalid |

Return field-addressable details. Never expose raw Prisma/parser errors.

## 12. Backend Files

Create:

```text
apps/api/src/modules/salary-config/
  salary-config.schemas.ts
  salary-structures.controller.ts
  salary-structures.routes.ts
  salary-structures.service.ts
  salary-rules.controller.ts
  salary-rules.routes.ts
  salary-rules.service.ts
  salary-rule-dependencies.ts
  salary-config.mapper.ts
```

Phase 4B exclusively owns:

```text
apps/api/src/modules/salary-config/formula/**
apps/api/tests/salary-formula.test.ts
```

Phase 4A may import Phase 4B's public exports but must not modify its files.

Mount both routers beneath `/payroll`. Do not create a second Express app or
duplicate the `/api/v1` prefix.

## 13. Seed

Create one idempotent ACTIVE `Regular Salary` Structure with these active Rules:

| Seq | Name | Code | Category | Method | Configuration |
| ---: | --- | --- | --- | --- | --- |
| 10 | Basic Salary | BASIC | BASIC | FORMULA | `PRORATED_BASIC` |
| 20 | House Rent Allowance | HRA | ALLOWANCE | PERCENTAGE | 20% of `BASIC` |
| 30 | Meal Allowance | MEAL | ALLOWANCE | FIXED | 2000.00 |
| 40 | Overtime | OT | OVERTIME | FORMULA | `OVERTIME_HOURS * 250` |
| 50 | Gross Salary | GROSS | GROSS | FORMULA | `BASIC + HRA + MEAL + OT` |
| 60 | Provident Fund | PF | DEDUCTION | PERCENTAGE | 12% of `BASIC` |
| 70 | Net Salary | NET | NET | FORMULA | `GROSS - PF` |

Upsert the Structure by `nameKey`, then Rules by `(structureId, code)`. A second
seed run must not duplicate or reorder records unexpectedly.

## 14. Frontend Routes and Navigation

Add:

```text
/payroll/structures
/payroll/structures/new
/payroll/structures/:id
/payroll/rules
/payroll/rules/new?salaryStructureId=<id>
/payroll/rules/:id
```

Payroll navigation becomes a dropdown containing Salary Structures and Salary
Rules. Payruns/Payslips remain disabled or absent until their phases.

Route visibility:

- HR Payroll User: pages visible, all mutation actions hidden/disabled.
- HR Payroll Manager/Admin: full configuration actions.
- Employee/HR Manager: routes hidden and guarded.

## 15. Frontend Files and Behavior

Create feature API/query modules using the existing `fetchApi` and TanStack
Query conventions established earlier.

Suggested structure:

```text
frontend/src/features/salary-config/
  salary-config.api.ts
  salary-config.queries.ts
  salary-config.format.ts

frontend/src/pages/payroll/
  SalaryStructures.tsx
  SalaryStructureDetail.tsx
  SalaryRules.tsx
  SalaryRuleDetail.tsx
```

Structure list:

- New action, search, status filter, pagination.
- Columns: name, active/total Rule count, status, updated time.
- Do not show Employee count before Contracts exist.
- Clicking a row opens Structure detail.

Structure detail:

- Edit name/description/status.
- Ordered Rule table with name, code, category, sequence, method, concise
  configuration, and status.
- Add Rule and open Rule detail.
- Reorder using accessible Move Up/Move Down plus editable sequence; drag/drop
  is optional.
- Save multi-Rule changes through the atomic configuration endpoint.
- Show dependency errors on the exact Rule/field.

Rule list/detail:

- Global filters for Structure/category/method/status and search.
- Structure is required when creating a Rule and immutable after creation.
- Show only fields relevant to selected method:
  - FIXED: amount.
  - PERCENTAGE: rate and base select.
  - FORMULA: expression editor and available-identifier list.
- Base/identifier choices contain built-ins plus earlier active Rule codes only.
- Decimal input stays a string; never parse with `Number` for submission.
- Read-only users can inspect configuration but cannot mutate it.

Required states: loading, empty, filtered-empty, retryable API failure, not
found, validation errors, conflict errors, submit pending, and successful
refresh/navigation.

## 16. Tests

Automated coverage:

- RBAC read/write matrix for all five roles.
- Structure name normalization/uniqueness and status behavior.
- Rule code/sequence uniqueness at API and database layers.
- Method-field exclusivity and decimal validation.
- Percentage base built-in/earlier-code acceptance.
- Unknown/self/forward/inactive/cross-Structure references rejected.
- Rule updates revalidate downstream dependencies.
- Deactivation blocked when active dependents exist.
- Atomic configuration validates before write and rolls back fully on failure.
- Atomic sequence swap avoids uniqueness failure.
- Inactive Structure activation requires valid active Rules.
- List filtering, pagination, ordering, and Decimal string serialization.
- Seed idempotency and expected Rule order.
- Phase 4B Formula Engine suite passes unchanged.
- All auth/Schedule/Employee regression tests pass.

Manual verification:

1. Payroll Manager opens seeded Regular Salary and sees ordered Rules.
2. Add a Fixed Rule, reorder it, and persist.
3. Attempt duplicate sequence/code and confirm field error.
4. Attempt `NET = FUTURE_CODE` and confirm forward-reference error.
5. Rename a code and update dependents atomically.
6. Payroll User can read but cannot see/execute mutation actions.
7. HR Manager and Employee cannot access the routes/API.
8. Refresh/restart and confirm persistence.

## 17. Exact Implementation Order

1. Merge/verify Phase 4B public Formula Engine contract or provide its stubbed
   typed interface without duplicating implementation.
2. Add shared value sets, Zod schemas, DTOs, and exports.
3. Add Prisma models and migration SQL checks.
4. Apply dev/test migrations and generate Prisma Client.
5. Implement DTO Decimal-string mapper and dependency graph validator.
6. Implement Structure service/API/tests.
7. Implement Rule service/API/tests.
8. Implement atomic configuration update and transaction tests.
9. Add idempotent seed configuration.
10. Add frontend API/query modules and routes.
11. Build Structure list/detail and ordered Rule editor.
12. Build global Rule list/detail method-specific form.
13. Add Payroll navigation and RBAC visibility.
14. Run full automated/manual verification.
15. Append one Branch Updates entry only.

## 18. Verification

```bash
npm install
npm run db:up
npm run prisma:generate
npm run prisma:migrate
npm run db:test:prepare
npm run db:seed
npm run typecheck
npm run build
npm test
```

## 19. Definition of Done

- [ ] Migration and SQL checks pass on dev/test PostgreSQL.
- [ ] Salary Structures/Rules persist with exact uniqueness/method constraints.
- [ ] Complete dependency graph is validated on every relevant mutation.
- [ ] Read/write RBAC matches the PRD.
- [ ] Decimal values cross API as strings and never use JS floating point.
- [ ] Atomic configuration update fully rolls back invalid changes.
- [ ] Structure and Rule list/form screens use real API data.
- [ ] Representative Regular Salary seed is idempotent.
- [ ] No Employee count or payroll results are fabricated.
- [ ] Typecheck, build, all tests, and manual verification pass.

## 20. Non-Negotiables

- Never use `eval`, `Function`, or JavaScript arithmetic for formulas/money.
- Do not create Contract, Payrun, Payslip, Attendance, or Time Off models.
- Do not hardcode Payslip amounts.
- Do not permit HR Payroll User to mutate configuration.
- Do not share one SalaryRule row between Structures.
- Do not silently resolve duplicate sequence values.
- Do not hard-delete Structures or Rules.
