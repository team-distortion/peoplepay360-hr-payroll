# AI Workflow Rules

## Approach
Build PeoplePay360 incrementally using a spec-driven workflow.
The files in `context/` — `project-overview.md`, `architecture.md`,
`ui-context.md`, `code-standards.md`, and `progress-tracker.md` —
define what to build, how to build it, and the current state of
progress. Always implement against these specs; do not infer or
invent HR/payroll behavior (pay calculations, leave rules, role
permissions, etc.) from scratch. If a spec doesn't cover a case,
resolve it in the spec first (see "Handling Missing Requirements"
below) rather than guessing.

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

## Before Moving to the Next Unit
1. The current unit works end to end within its defined scope
2. No invariant defined in `context/architecture.md` was violated
3. `context/progress-tracker.md` reflects the completed work
4. `npm run build` passes