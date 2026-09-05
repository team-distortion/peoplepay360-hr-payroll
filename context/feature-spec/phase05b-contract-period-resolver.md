# Phase 5B - Contract Period and Schedule Resolver

## Metadata

- **Status:** APPROVED FOR PARALLEL IMPLEMENTATION
- **Target branch:** `feature/contract-period-resolver`
- **Assumed baseline:** TypeScript API workspace is available
- **PRD coverage:** Period-specific Contract selection and Working Schedule fallback used by Payrun/Payslip processing
- **Depends on:** No database migration, HTTP route, or UI feature
- **Blocks:** Phase 5A Contract service integration and Payrun eligibility
- **Parallel owner:** Recommended independent contributor task

## 1. Goal

Build a pure, deterministic module that resolves the one Contract covering an
entire payroll Period, verifies its Salary Structure, and chooses the effective
Working Schedule using Contract-over-Employee precedence.

The module receives plain values and returns plain values. It performs no
Prisma query, mutation, authorization, HTTP handling, logging, or UI work.

## 2. Strict File Ownership

This branch may create or edit only:

```text
apps/api/src/modules/contracts/resolution/
  contract-resolution.errors.ts
  contract-resolution.types.ts
  date-only.ts
  resolve-contract.ts
  resolve-schedule.ts
  evaluate-eligibility.ts
  index.ts

apps/api/tests/contract-resolution.test.ts
```

It must not edit:

```text
apps/api/prisma/**
apps/api/src/routes/**
apps/api/src/modules/contracts/*.controller.ts
apps/api/src/modules/contracts/*.routes.ts
apps/api/src/modules/contracts/*.schemas.ts
apps/api/src/modules/contracts/*.service.ts
packages/shared/**
frontend/**
package.json
package-lock.json
context/progress-tracker.md
```

Use only existing TypeScript/runtime dependencies. No dependency installation
is allowed.

## 3. Locked Rules

1. Period and Contract dates are inclusive calendar dates.
2. A Contract is applicable only when it covers the entire Period:

   ```text
   contract.startDate <= period.startDate
   AND (contract.endDate === null OR contract.endDate >= period.endDate)
   ```

3. A Contract that overlaps only part of the Period is not applicable.
4. Exactly one applicable Contract is required.
5. Zero matches is a normal eligibility failure; more than one is a hard data
   integrity failure.
6. Mid-period Contract splitting or combining two Contracts is forbidden.
7. The Payrun-selected Salary Structure must exactly equal the applicable
   Contract's `salaryStructureId`.
8. Schedule precedence is Contract override, then Employee default. Missing
   both is an eligibility failure.
9. Use `YYYY-MM-DD` strings and calendar validation. Do not compare local Date
   objects or timestamps.
10. Inputs are never mutated. Returned objects should be frozen in development
    where practical.
11. Resolution does not inspect derived `Running`/`Expired` display status;
    date coverage is authoritative.

## 4. Public Types

Create these public contracts in `contract-resolution.types.ts`:

```ts
export interface PayrollPeriod {
  startDate: string;
  endDate: string;
}

export interface ContractCandidate {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string | null;
  salaryStructureId: string;
  workingScheduleId: string | null;
}

export interface EmployeeScheduleContext {
  employeeId: string;
  workingScheduleId: string | null;
}

export interface ResolvedSchedule {
  workingScheduleId: string;
  source: 'CONTRACT' | 'EMPLOYEE';
}

export interface EligibleContractContext {
  contract: ContractCandidate;
  schedule: ResolvedSchedule;
}
```

Public functions exported from `index.ts`:

```ts
export function assertDateOnly(value: string, field: string): void;

export function assertValidPeriod(period: PayrollPeriod): void;

export function contractCoversPeriod(
  contract: ContractCandidate,
  period: PayrollPeriod,
): boolean;

export function resolveApplicableContract(
  contracts: readonly ContractCandidate[],
  employeeId: string,
  period: PayrollPeriod,
): ContractCandidate;

export function resolveEffectiveSchedule(
  contract: ContractCandidate,
  employee: EmployeeScheduleContext,
): ResolvedSchedule;

export function evaluateContractEligibility(input: {
  contracts: readonly ContractCandidate[];
  employee: EmployeeScheduleContext;
  period: PayrollPeriod;
  salaryStructureId: string;
}): EligibleContractContext;
```

`resolveApplicableContract` must filter by `employeeId` itself. Callers may pass
candidates for multiple Employees.

## 5. Typed Errors

Create `ContractResolutionError extends Error` with:

```ts
export type ContractResolutionErrorCode =
  | 'INVALID_DATE_ONLY'
  | 'INVALID_PAYROLL_PERIOD'
  | 'NO_APPLICABLE_CONTRACT'
  | 'MULTIPLE_APPLICABLE_CONTRACTS'
  | 'CONTRACT_EMPLOYEE_MISMATCH'
  | 'SALARY_STRUCTURE_MISMATCH'
  | 'WORKING_SCHEDULE_MISSING';
```

Required properties:

```ts
code: ContractResolutionErrorCode;
message: string;
details?: Record<string, unknown>;
```

Messages must be safe for API mapping. Do not include stack traces. Details may
contain Employee/Contract/Structure IDs supplied by trusted backend code; the
HTTP integration decides what is safe to expose.

## 6. Date-Only Validation

`assertDateOnly` must accept only real Gregorian dates formatted exactly as:

```regex
^[0-9]{4}-(0[1-9]|1[0-2])-([0-2][0-9]|3[0-1])$
```

Regex alone is insufficient. Reject impossible dates such as:

```text
2026-02-29
2026-04-31
2026-00-10
```

Accept valid leap dates such as `2028-02-29`.

Implementation may validate year/month/day mathematically or by UTC calendar
round-trip, but it must not depend on process timezone or locale. After
validation, lexicographic comparison is valid because the format is fixed.

`assertValidPeriod` validates both dates and requires:

```text
period.startDate <= period.endDate
```

A one-day Period is valid.

## 7. Applicable Contract Algorithm

`resolveApplicableContract` must:

1. Validate non-empty `employeeId` and the Period.
2. Inspect only candidates with matching `employeeId`.
3. Validate every inspected candidate's start/end date and require its own
   `endDate >= startDate` when end is present.
4. Keep candidates covering the complete Period.
5. Return the candidate when exactly one matches.
6. Throw `NO_APPLICABLE_CONTRACT` when none match.
7. Throw `MULTIPLE_APPLICABLE_CONTRACTS` when more than one matches, including
   the matching Contract IDs in `details`.

Do not pick the newest, oldest, longest, shortest, or first candidate to hide
multiple matches.

`contractCoversPeriod` validates its Contract dates and Period, then returns a
boolean for coverage. It does not check Employee ID or Salary Structure.

## 8. Schedule Resolution

`resolveEffectiveSchedule` must:

1. Require `contract.employeeId === employee.employeeId`; otherwise throw
   `CONTRACT_EMPLOYEE_MISMATCH`.
2. Return the Contract schedule with source `CONTRACT` when non-null/non-empty.
3. Otherwise return the Employee schedule with source `EMPLOYEE` when
   non-null/non-empty.
4. Otherwise throw `WORKING_SCHEDULE_MISSING`.

Never substitute an arbitrary/default company Schedule.

## 9. Eligibility Composition

`evaluateContractEligibility` executes in this exact order:

1. Resolve the applicable Contract.
2. Compare its `salaryStructureId` with the selected
   `input.salaryStructureId`.
3. On mismatch, throw `SALARY_STRUCTURE_MISMATCH`; no implicit substitution.
4. Resolve the effective Schedule.
5. Return `{ contract, schedule }`.

This ordering ensures a missing Contract is reported before Structure or
Schedule errors and a Structure mismatch is reported before missing Schedule.

The function does not check whether referenced database records are active;
the caller owns persistence checks.

## 10. Required Tests

### Date validation

- valid normal, leap-day, and one-day Periods;
- malformed, locale-style, timestamp, impossible date, invalid leap date;
- Period end before start;
- behavior is identical under at least two `TZ` values if test infrastructure
  permits subprocess execution.

### Coverage

- exact Contract/Period boundary match;
- open-ended Contract;
- Contract starts before and ends after Period;
- Contract starts inside Period: false;
- Contract ends inside Period: false;
- Contract ends one day before Period end: false;
- Contract starts one day after Period start: false;
- one-day Contract and Period exact match: true.

### Resolution

- ignores candidates for other Employees;
- returns the only full-period match;
- throws for zero matches;
- throws instead of choosing when two candidates match;
- catches invalid candidate ranges and dates;
- does not mutate the input array or candidate objects.

### Schedule and Structure

- Contract Schedule overrides Employee Schedule;
- Employee Schedule is used when Contract Schedule is null;
- both missing throws;
- Employee mismatch throws;
- exact Structure match succeeds;
- Structure mismatch throws before Schedule resolution;
- complete eligibility result includes correct Contract and source.

Assert error codes, not only messages.

## 11. Implementation Constraints

- Keep the module pure and synchronous.
- No Prisma imports or queries.
- No Express imports, status codes, or API envelopes.
- No Zod requirement; validate locally without adding dependencies.
- No JavaScript timestamp comparison for business dates.
- No `Date.parse`, locale conversion, or current-date dependency.
- No sorting is required and input order must not decide correctness.
- Avoid `any`, non-null assertions, and unsafe casts.
- Export only the public types/functions/errors listed by this spec.

## 12. Handoff to Phase 5A

Before handoff:

```bash
npm run typecheck --workspace=apps/api
npm run test --workspace=apps/api -- contract-resolution.test.ts
```

Provide the Phase 5A owner:

- commit hash;
- test output;
- exact public exports;
- confirmation that only the allowed files changed.

The Phase 5A owner will map typed errors to public API errors and supply
database records as candidates. Do not modify their service to perform the
integration from this branch.

## 13. Definition of Done

- [ ] Exact Gregorian date-only validation is timezone-independent.
- [ ] Full-period Contract coverage is enforced.
- [ ] Zero and multiple matches produce distinct typed failures.
- [ ] Structure equality and Contract-over-Employee Schedule precedence work.
- [ ] All required boundary/error tests pass.
- [ ] API workspace typecheck passes.
- [ ] No file outside the ownership list changed.

## 14. Non-Negotiables

- Do not select a partial-period Contract.
- Do not combine multiple Contracts to cover one Period.
- Do not silently select one of multiple applicable Contracts.
- Do not substitute Salary Structures or Schedules.
- Do not query PostgreSQL or Prisma from this module.
- Do not use the host timezone for business-date comparison.
- Do not edit Phase 5A, shared, Prisma, frontend, dependency, or tracker files.

