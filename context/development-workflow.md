# Development Workflow

This is the standard workflow for implementing PeoplePay360 features with a
human developer, an AI agent, or a parallel contributor.

## Core Rule

One branch implements one approved feature spec. Do not ask an agent to
implement directly from the PRD, project roadmap, UI mockup, or a verbal
description.

```text
Choose feature -> create branch -> write spec -> approve/freeze spec
-> implement -> verify -> open PR -> review -> merge -> reconcile progress
```

## Branch Model

- `main` is the stable integration branch and the only PR target.
- Do not implement features directly on `main`.
- Use one owner per feature branch. Do not have two people push to the same
  feature branch.
- Use lowercase branch names:
  - `feature/phase02-working-schedule`
  - `feature/salary-formula-engine`
  - `fix/attendance-timezone`
  - `docs/schema-decision`
- Prefer squash merge so one completed feature becomes one coherent commit on
  `main`.

Start a feature from the latest `main`:

```bash
git switch main
git pull --ff-only origin main
git switch -c feature/<feature-name>
```

Before opening or updating the PR:

```bash
git fetch origin
git rebase origin/main
```

Only rebase a branch owned by you. Do not rewrite a branch another contributor
is using.

## Step 1 - Select One Feature Unit

Choose the next item from `context/progress-tracker.md` and the project roadmap.
The unit must be small enough to implement and verify independently.

Split work when it combines unrelated domains or when a backend rule and a
large UI integration cannot be verified safely together. Examples:

- Working Schedule persistence/API and Working Schedule frontend integration
  may be separate specs.
- Salary Formula Engine is separate from Salary Structure CRUD.
- Payrun creation, computation, validation, PDF generation, and email delivery
  are separate specs.

## Step 2 - Create and Approve the Feature Spec

Copy `context/feature-spec/_template.md` to a uniquely named file such as:

```text
context/feature-spec/phase02-working-schedule-backend.md
```

The first commit on the branch should contain the feature spec only:

```bash
git add context/feature-spec/<spec-name>.md
git commit -m "docs: specify <feature name>"
```

Review the spec before implementation. Change `Status` from `DRAFT` to
`APPROVED` only when business rules, schema/API boundaries, permissions, tests,
and file ownership are clear. An implementation agent must stop if the named
spec is not approved.

After approval, do not silently change behavior in code. Update the spec first
and call out the change in the PR.

## Step 3 - Declare File Ownership

Every feature spec must list:

- files/directories the branch may create or edit;
- shared integration files reserved for the main-branch integrator;
- explicitly protected files;
- whether the branch owns a Prisma migration.

Only one active branch may edit `apps/api/prisma/schema.prisma` or create Prisma
migrations at a time. Parallel work should be chosen so the other branch needs
no schema change.

Common shared integration files include:

- `apps/api/src/routes/index.ts`
- `packages/shared/src/index.ts`
- `frontend/src/App.tsx`
- `frontend/src/components/layout/TopNav.tsx`
- root `package.json` and `package-lock.json`
- mutable summary sections in `context/progress-tracker.md`

If a feature needs one of these, the spec should state whether the feature owner
may make the minimal integration edit or whether the integrator will add it
after merge. Do not leave this implicit.

## Step 4 - Implement in Verifiable Slices

Use this order when applicable:

1. Shared enums, Zod schemas, and API types.
2. Prisma schema and one reviewed migration.
3. Domain service and pure business rules.
4. Thin controller and route.
5. Backend integration/unit tests.
6. Frontend data hooks and forms.
7. Existing UI conversion from mock state to API state.
8. Manual end-to-end verification.
9. Documentation and branch progress entry.

Do not start the frontend against an invented API shape. Freeze the shared API
contract first. Do not calculate money, balances, worked time, or payroll state
in React.

Suggested commit boundaries:

```text
docs: specify working schedule backend
feat(db): add working schedule models
feat(api): implement working schedule service and routes
test(api): cover working schedule rules
feat(web): connect working schedule screens
docs: record working schedule completion
```

These are boundaries, not a requirement to manufacture empty commits.

## Step 5 - Verify Before PR

Run from the repository root:

```bash
npm run prisma:generate
npm run typecheck
npm run build
npm test
```

For a migration-bearing feature, also apply the committed migration to both the
development and dedicated test PostgreSQL databases. Manually verify the exact
UI/API flow named in the spec.

Record commands and results in the PR. Do not claim checks that were not run.

## Step 6 - Update Progress Without Conflicts

On a feature branch, only append one entry under `Branch Updates` in
`context/progress-tracker.md`:

```text
- [2026-09-05] [feature/phase02-working-schedule] [Harsh] implemented schedule API; verification: typecheck, build, 12 tests passed
```

Do not edit the tracker summary sections on a feature branch. The union merge
driver preserves append-only entries from parallel branches.

After merging, the main-branch integrator:

1. verifies the merged state;
2. moves the result into `Completed`;
3. updates Current Phase/Goal, In Progress, Next Up, and decisions;
4. removes only the Branch Update entries already incorporated.

## Step 7 - Open and Merge the PR

Open the PR against `main` and complete the repository PR template. Review in
this order:

1. Feature spec compliance.
2. Business-rule and authorization correctness.
3. Migration/integrity safety.
4. Tests and failure behavior.
5. UI/API integration.
6. Scope control and unrelated changes.

Use squash merge after approval and passing checks. Delete the remote feature
branch after merging.

## Parallel Work Rules

Safe parallel pairings:

- One schema/API feature plus one pure library with unit tests.
- Backend implementation plus a UI-only prototype that uses an already frozen
  API contract and owns separate files.
- Feature implementation plus documentation/demo preparation.

Unsafe parallel pairings:

- Two branches creating Prisma migrations.
- Two branches changing the same shared enums/API contracts.
- Two branches editing `App.tsx`, `TopNav.tsx`, or route registries.
- Payroll computation and Attendance/Time Off rule changes at the same time.
- Two contributors sharing one feature branch.

Recommended current split:

- Primary branch: Phase 2 Working Schedule feature spec and implementation.
- Parallel branch: pure Salary Formula Engine plus unit tests. It must not touch
  Prisma, routes, frontend, or shared integration files.

## Agent Handoff Prompt

Use this short wrapper after the feature spec is approved:

```text
Implement only the approved feature spec at:
context/feature-spec/<spec-file>.md

Before coding, read Agent.md and every context file it requires. Inspect the
current repository and confirm the spec's assumptions and file-ownership rules.
Do not expand scope or invent missing behavior. If the spec conflicts with the
PRD/architecture or a required decision is missing, stop and report it.

Implement in the order defined by the spec. Run every required migration,
typecheck, build, test, and manual verification step. Append only the permitted
Branch Updates entry to the progress tracker. Finish with changed files,
commands/results, assumptions, and unresolved issues.
```

## Emergency Fixes

Use a `fix/*` branch and a focused spec or issue description. Do not bypass
tests, authorization, transaction rules, or migrations because a fix is urgent.
After merging, add a regression test and reconcile the progress tracker.
