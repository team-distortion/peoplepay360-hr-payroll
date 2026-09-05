# AI Workflow Rules

## Approach
Build PeoplePay360 incrementally using a spec-driven workflow.
The files in `context/` — `project-overview.md`, `architecture.md`,
`schema-roadmap.md`, `ui-context.md`, `code-standards.md`, and
`progress-tracker.md` —
define what to build, how to build it, and the current state of
progress. Always implement against these specs; do not infer or
invent HR/payroll behavior (pay calculations, leave rules, role
permissions, etc.) from scratch. If a spec doesn't cover a case,
resolve it in the spec first (see "Handling Missing Requirements"
below) rather than guessing.

Follow `context/development-workflow.md` for branch creation, feature-spec
approval, file ownership, verification, PR review, merge, and parallel work.
Implementation may begin only from an explicitly named feature spec whose
status is `APPROVED`.

## Scoping Rules
- Work on one feature unit at a time (e.g. one payroll operation,
  one employee-record workflow, one attendance rule — not several
  at once)
- Prefer small, verifiable increments over large speculative changes
- Do not combine unrelated system boundaries in a single
  implementation step — e.g. employee management, payroll
  processing, attendance/leave, and auth/roles are separate
  boundaries and should not be touched together unless the spec
  explicitly ties them

## When to Split Work
Split an implementation step if it combines:
- UI changes and backend/payroll-calculation logic changes
- Multiple unrelated API routes or modules (e.g. an employee
  CRUD endpoint and a payroll run endpoint)
- Behavior not clearly defined in the context files (e.g. tax
  rules, overtime rules, or approval flows not specified in
  `project-overview.md` or `architecture.md`)
- Changes that touch both sensitive payroll/financial data paths
  and unrelated features (e.g. reporting, notifications)

If a change cannot be verified end to end quickly, the scope is
too broad — split it.

## Handling Missing Requirements
- Do not invent product behavior not defined in the context files
  — this is especially important for payroll math, statutory
  rules, and role-based access, where a wrong guess has real
  financial or compliance impact
- If a requirement is ambiguous, resolve it in the relevant
  context file (`project-overview.md` for scope/behavior,
  `architecture.md` for structure/invariants) before implementing
- If a requirement is missing, add it as an open question in
  `context/progress-tracker.md` before continuing, rather than
  shipping an assumption silently

## Protected Files
Do not modify the following unless explicitly instructed:
- Any shared/generated UI component library (e.g. `components/ui/*`)
  — confirm the actual path against `context/ui-context.md`
- Any third-party library internals or vendored code
- Payroll calculation and compliance logic that has already been
  reviewed/signed off, unless the change is the explicit task at hand
- `context/architecture.md` invariants — these should only change
  as a deliberate, called-out step, not as a side effect of a
  feature change

_Note: this list is a starting point — update it once the actual
`architecture.md` / `code-standards.md` contents are available, to
name the real protected paths for this codebase._

## Keeping Docs in Sync
Update the relevant context file whenever implementation changes:
- System architecture or boundaries → `context/architecture.md`
- Storage model decisions → `context/architecture.md`
- Code conventions or standards → `context/code-standards.md`
- Feature scope → `context/project-overview.md`
- UI/theme/component conventions → `context/ui-context.md`

## Parallel Branches

- Give each branch one bounded feature unit and explicit file ownership.
- Parallel branches must not edit the same Prisma schema/migration, shared route
  registry, navigation file, shared package barrel, or feature spec.
- If a branch needs a shared integration-file change, leave that change to the
  main-branch integrator after the feature branch is merged.
- Pure domain libraries with unit tests are preferred parallel tasks because
  they can be integrated without depending on unfinished database or UI work.
- Do not merge two independently created Prisma migrations until their order
  and generated SQL have been reviewed together.

## Progress Tracking Across Branches

`context/progress-tracker.md` uses Git's union merge driver through
`.gitattributes`. To keep the result meaningful:

- On feature branches, do not edit `Current Phase`, `Current Goal`, `Completed`,
  `In Progress`, `Next Up`, `Open Questions`, or `Architecture Decisions`.
- Append one unique bullet under `Branch Updates` after a meaningful change.
- Use: `- [YYYY-MM-DD] [branch] [owner] summary; verification: command/result`.
- Never reorder, rewrite, or delete another branch's update.
- After merging to `main`, the integrator moves/reconciles relevant updates into
  the summary sections and may remove incorporated branch-update bullets.
- Union merging prevents textual conflicts; it does not replace the integrator's
  semantic review for duplicates, contradictions, or incomplete work.

## Before Moving to the Next Unit
1. The current unit works end to end within its defined scope
2. No invariant defined in `context/architecture.md` was violated
3. The feature branch appended its verified `Branch Updates` entry; after merge,
   `context/progress-tracker.md` reflects the completed work
4. `npm run build` passes
