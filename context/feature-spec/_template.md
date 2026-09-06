# Feature Spec - <Feature Name>

## Metadata

- **Status:** DRAFT
- **Owner:** <name>
- **Branch:** `feature/<branch-name>`
- **Roadmap phase:** <phase/unit>
- **PRD sections:** <exact sections>
- **Depends on:** <completed features/migrations>
- **Blocks:** <later features>

Implementation must not begin until `Status` is `APPROVED`.

## 1. Goal

State the single user-visible or system outcome this feature delivers.

## 2. Source Requirements

List the exact PRD and context requirements covered. Resolve conflicts using:

1. PRD PDF.
2. `context/architecture.md`.
3. `context/project-overview.md`.
4. This approved feature spec.
5. UI context/existing prototype.

## 3. Current Repository Baseline

Document the existing files, models, endpoints, UI, tests, and assumptions this
feature builds on. Identify mock/stub behavior that will be replaced.

## 4. Scope

### In scope

- <required behavior>

### Out of scope

- <related behavior intentionally deferred>

## 5. Decisions Locked by This Spec

Record every ambiguous product/architecture decision required for this feature.
Do not leave payroll, Time Off, permission, date, status, or lifecycle behavior
for the implementation agent to guess.

## 6. File Ownership

### May create or edit

- `<path>`

### Shared integration files

- `<path>` - <feature owner or main integrator, exact permitted change>

### Must not edit

- `<path>`

### Migration ownership

- **Owns Prisma schema/migration:** Yes/No
- **Migration name:** `<name or N/A>`

## 7. Data Model and Migration

Define models, fields, types, nullability, defaults, relations, delete/archive
behavior, unique/index/check/exclusion constraints, and data migration needs.
State Decimal, integer-minute, `DATE`, and UTC timestamp requirements.

If no database change is allowed, say so explicitly.

## 8. API Contract

For every endpoint define:

- method and `/api/v1` path;
- authentication and allowed roles;
- path/query/body Zod schema;
- success status and response data;
- error statuses, codes, and safe messages;
- pagination/filter/sort behavior;
- idempotency and transaction boundary.

Use the existing `{ data, error }` response envelope.

## 9. Business Rules

Specify calculations, invariants, derived values, transitions, concurrency
behavior, history/immutability, and retry handling. Identify which rules require
database constraints in addition to service validation.

## 10. Authorization Matrix

| Action | Employee | HR Manager | HR Payroll User | HR Payroll Manager | Admin |
| --- | --- | --- | --- | --- | --- |
| <action> | <own/deny/etc.> | <allow/deny> | <allow/deny> | <allow/deny> | <allow/deny> |

Include record-ownership checks, not only role checks.

## 11. Backend Implementation

List the exact implementation sequence and responsibilities for schemas,
services, controllers, routes, shared types, errors, and audit events. Keep
controllers thin and business logic in services.

### Seed-data policy for Phase 9 onward

While the Prisma schema is still evolving, extend the existing
`apps/api/prisma/seed.ts` only with the minimum idempotent fixtures required to
test the current feature. Preserve earlier fixtures and do not refactor the
seed architecture, add Faker, or implement the final 200-Employee generator.
Defer modular seed functions and comprehensive mock-data generation until the
remaining schema phases are stable. State explicitly when a feature requires
no seed change.

## 12. Frontend Implementation

Define routes, data hooks, forms, UI states, permission-driven visibility,
loading/empty/error states, mutations, cache invalidation, navigation/filter
preservation, and which mock data must be removed.

If frontend work is excluded, say so explicitly.

## 13. Tests

### Automated

- <unit/integration/RBAC/invariant/failure test>

### Manual verification

- <exact end-to-end steps and expected result>

Include regression coverage and real PostgreSQL tests where persistence or
transactions matter.

## 14. Implementation Order

1. <first independently verifiable step>
2. <next step>

Each step should compile or test before the next begins.

## 15. Verification Commands

```bash
npm run prisma:generate
npm run typecheck
npm run build
npm test
```

Add feature-specific database, test, curl, or UI verification commands.

## 16. Definition of Done

- [ ] All in-scope behavior is implemented.
- [ ] Out-of-scope behavior was not added.
- [ ] Required migrations work on development and test PostgreSQL.
- [ ] API authorization and ownership tests pass.
- [ ] Mock data for this feature is removed.
- [ ] Typecheck, build, and tests pass.
- [ ] Manual verification passes.
- [ ] Feature spec reflects any approved changes.
- [ ] One append-only Branch Updates entry was added.
- [ ] PR includes commands/results, assumptions, and unresolved issues.

## 17. Open Questions

All blocking questions must be resolved before changing `Status` to `APPROVED`.

- <question or `None`>
