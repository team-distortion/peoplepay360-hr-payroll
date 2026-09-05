# Architecture Context

PeoplePay360 is a **modular monolith**: React SPA → Express REST API → PostgreSQL. Mailpit is local SMTP capture only.

```text
React/Vite ── /api/v1 + session cookie ──> Express
                                          ├─ auth / employees / contracts / schedules
                                          ├─ attendance / time-off / salary-config
                                          ├─ payroll / reports / audit / PDF / email
                                          └─ PostgreSQL ── sessions + data + PDF bytea
                                                └─ Nodemailer → Mailpit
```

## Stack

| Layer | Technology |
| --- | --- |
| Web | React + TypeScript strict + Vite + React Router |
| Data/forms | TanStack Query + React Hook Form + Zod |
| UI/charts | Tailwind + shadcn/ui + Recharts |
| API | Express + TypeScript strict, REST JSON under `/api/v1` |
| Auth | Local email/password, `argon2`, `express-session`, `connect-pg-simple` |
| Data | Prisma + PostgreSQL + Prisma `Decimal` |
| Formula | `jsep` + custom Decimal AST evaluator |
| PDF / mail | PDFKit + Nodemailer → Mailpit (`1025`, UI `8025`) |
| Tests | Vitest + dedicated test PostgreSQL |
| Repo/runtime | npm workspaces + Docker Compose |

System config is single-value, not per Employee: `currency=INR`, `timezone=Asia/Kolkata`.

## Date / Time Rules

- Payroll periods, contract dates, attendance dates, leave dates → PostgreSQL `DATE`.
- Login/approval/audit/email/created timestamps → PostgreSQL `timestamptz`, persisted in **UTC**.
- Interpret calendar-day boundaries with company timezone.
- Never convert payroll `DATE` boundaries through JS timestamps for comparison.

## Boundaries

- `apps/web/` — UI only; no payroll/business calculations.
- `apps/api/` — HTTP, auth, services, Prisma, transactions, PDF, email.
- `packages/shared/` — enums/types/Zod/API contracts; no React/Express/Prisma.
- `apps/api/prisma/` — schema, migrations, seeds, custom SQL constraints.
- `apps/api/src/modules/` — domain modules.
- `apps/api/src/lib/` — Prisma/session/config/mail/PDF/Decimal/formula/error infrastructure.

```text
route → validate → authenticate → authorize → service → Prisma/PostgreSQL
```

Business rules live in services. Client-calculated salary, worked totals, balances, dashboard totals, or payroll state are never authoritative.

## Domain Modules

`auth`, `employees`, `contracts`, `schedules`, `attendance`, `time-off`, `salary-config`, `payroll`, `reports`, `audit`.

## Storage / Integrity

PostgreSQL stores all business data, sessions, Audit Logs, and finalized Payslip PDFs (`bytea`). No Redis, queue, broker, object storage, or cache.

Hard constraints:

1. Money/balances/formula results use `NUMERIC/DECIMAL` + Prisma `Decimal`; durations use integer minutes where possible.
2. `Attendance`: `UNIQUE(employeeId, attendanceDate)`.
3. `Payslip`: `UNIQUE(employeeId, periodStart, periodEnd)`.
4. `SalaryRule`: `UNIQUE(salaryStructureId, sequence)` and unique Rule `code` per Structure.
5. Running Contracts for one Employee cannot overlap. Enforce in domain validation **and** PostgreSQL `EXCLUDE` via `btree_gist` + `daterange(...) WITH &&`.
6. Historically referenced records are archived/inactivated, not hard-deleted.
7. Leave approval and payroll mutations are transactional/idempotent.

## Auth / RBAC

Local auth only. Passwords use `argon2`. Sessions live in PostgreSQL. Cookie: `HttpOnly`, `SameSite=Lax`, `Secure=true` outside local HTTP. Regenerate session on login; destroy on logout.

- `EMPLOYEE` — own profile/attendance/balances; create own attendance/time-off requests.
- `HR_MANAGER` — HR CRUD + approve/refuse Time Off; no payroll.
- `HR_PAYROLL_USER` — HR Manager + Payrun/Payslip operations; Salary Config read-only.
- `HR_PAYROLL_MANAGER` — full HR/payroll + Salary Config CRUD.
- `ADMIN` — full system/user/role access.

Every permission is enforced in Express; Employee routes also verify record ownership.

## Contract / Schedule / Eligibility

Payroll requires exactly one `RUNNING` Contract covering the **entire** period:

```text
startDate <= periodStart
AND (endDate IS NULL OR endDate >= periodEnd)
```

Zero matches block payroll; multiple matches are an integrity failure. Mid-period Contract splitting is out of scope.

Schedule precedence:

```text
Contract.scheduleId → Employee.scheduleId → missing (blocking)
```

A Payrun selects one Salary Structure. An Employee is eligible only when:

```text
applicableContract.salaryStructureId === payrun.salaryStructureId
```

No implicit Structure substitution.

## Attendance / Time Off / Worked Days

One Attendance record per Employee/date. Basic pay is **day-status based**, not exact-hour based.

| Expected day | Basic contribution | Warning |
| --- | ---: | --- |
| `PRESENT` / `LATE` | 1 | No |
| `ABSENT` | 0 | No |
| Approved Paid Time Off, no Attendance | 1 | No |
| Approved Unpaid Time Off, no Attendance | 0 | No |
| No Attendance / no approved Time Off | 0 until corrected | Yes |

- Missing expected Attendance is never auto-converted to Absent.
- Warning must be corrected or acknowledged before Validation; acknowledgement stores reason, actor, timestamp and does not create Attendance.
- Paid and Unpaid approved Time Off both suppress the warning.
- Allocation-required Time Off deducts balance exactly once on approval.
- DAY/HOUR leave may exist for HR; payroll proration remains day-granular. Partial-hour salary proration is out of scope.

```text
expectedWorkingDays = schedule-expected dates in period
workedDays = Present + Late + ApprovedPaidLeave
proratedBasic = contract.wage * workedDays / expectedWorkingDays
```

`expectedWorkingDays = 0` blocks computation.

Worked minutes are server-derived and used only for reporting/overtime:

```text
dailyOT = max(workedMinutes - expectedMinutesForDate, 0)
periodOT = sum(dailyOT)
OVERTIME_HOURS = periodOT / 60
```

Short days never cancel overtime from another day.

## Salary Rule Engine

Rules execute in ascending `sequence`. **Same-sequence ties within one Salary Structure are invalid**; enforce both API validation and `UNIQUE(salaryStructureId, sequence)`.

Categories:

```text
BASIC | ALLOWANCE | OVERTIME | GROSS | DEDUCTION | CONTRIBUTION | NET
```

Methods: `FIXED`, `PERCENTAGE`, `FORMULA`.

### Safe formulas

Salary formulas are user-configurable data and must never execute JavaScript.

```text
formula → jsep AST → allowlist validation → custom recursive Prisma Decimal evaluator
```

Allowed: numeric literals, identifiers, parentheses, unary `+/-`, binary `+ - * /`.

Forbidden: `eval`, `Function`, calls, property/member access, assignments, arrays/objects, conditionals, loops, logical operators, arbitrary JS.

Built-ins:

```text
WAGE PRORATED_BASIC WORKED_DAYS EXPECTED_DAYS
WORKED_HOURS EXPECTED_HOURS OVERTIME_HOURS
```

Each completed Rule exposes its `code` as a Decimal variable to later Rules.

```text
BASIC = PRORATED_BASIC
HRA   = BASIC * 0.20
OT    = OVERTIME_HOURS * 250
GROSS = BASIC + HRA + OT
PF    = BASIC * 0.12
NET   = GROSS - PF
```

Reject unknown identifiers, forward references, division by zero, duplicate codes, and duplicate sequences. Persist each evaluated Rule as a Payslip Line with name/code/category/sequence/amount.

## Payroll Lifecycle

```text
DRAFT ─Compute→ COMPUTED ─Validate→ VALIDATED ─Mark Paid→ PAID
  ^                  |
  └──── Recompute ───┘
```

Payrun creation:

1. Select Structure + period.
2. Query eligible Employees: full-period Contract + matching Structure + resolvable Schedule.
3. User selects Employees.
4. Create Payrun + selected Payslips transactionally.

Compute per Payslip:

```text
Contract → Schedule → Worked Days/Hours/OT → PRORATED_BASIC
→ ordered Salary Rules → Payslip Lines + Warnings
```

Recompute is pre-Validation only and **replaces** generated lines/warnings.

Persist warnings with `type`, `message`, `blocking`, `OPEN|ACKNOWLEDGED|RESOLVED`, acknowledgement actor/time/reason. Open blocking warnings prevent Validation; hard integrity failures cannot be acknowledged away.

`VALIDATED`/`PAID` financial data is immutable.

### PDF / Email

- `DRAFT`/`COMPUTED`: live PDF preview may be generated but not stored.
- `Validate`: generate final PDF once and persist `bytea`.
- `VALIDATED`/`PAID`: print/email stored bytes only; never regenerate from current HR/config data.
- `Mark Paid` changes state only.
- Send Payslips only for `VALIDATED`/`PAID`; Nodemailer uses Mailpit. Persist each delivery attempt and error.

## Audit / Reports

Append-only `AuditLog`: actor, entity type/id, action, optional before/after JSON, UTC timestamp. Audit role changes, Attendance corrections, Contract mutations, Time Off decisions, allocation changes, warning acknowledgement, payroll transitions, Mark Paid.

Reports query live PostgreSQL only. Support `Period`, `Department`, `Employee Type` filters and payroll totals, salary trends/department costs, attendance/overtime, leave, warnings, headcount.

## Transactions / Errors

Validate external input with Zod. Do not expose raw Prisma/SQL errors or stack traces.

```json
{ "data": {}, "error": null }
```

or

```json
{ "data": null, "error": { "code": "ERROR_CODE", "message": "Readable message", "fields": {} } }
```

Transactions required for Time Off approval/allocation deduction, Payrun/Payslip creation, compute/recompute, Validation+PDF persistence, and payment transitions. Retry-sensitive operations re-check DB state inside the transaction.

## Testing Contract

Vitest + dedicated test PostgreSQL. Required coverage:

1. Contract-period resolution + overlap constraint.
2. Salary Structure eligibility match.
3. Rule sequence uniqueness/order/dependencies.
4. Safe formula AST validation/evaluation, forbidden syntax, division by zero.
5. Worked Days from Schedule + Attendance + Paid/Unpaid Time Off.
6. Allocation deduction exactly once.
7. Duplicate Payslip prevention.
8. Payroll lifecycle/immutability.
9. Role authorization allow/deny matrix.
10. `DATE` vs UTC `timestamptz` boundary behavior.

Full browser E2E automation is not required; verify UI flows manually.

## Runtime

Development: npm workspace web/API servers + Docker Compose `postgres` and `mailpit`. Final verification may containerize all four services. Prisma migrations run explicitly; schema is never mutated automatically on startup. Secrets/config stay outside source control.

## Invariants

1. Modular monolith; PostgreSQL is authoritative.
2. Decimal for money/formulas; integer minutes for durations where possible.
3. Business dates use `DATE`; event timestamps use UTC `timestamptz`.
4. Running Contracts cannot overlap; one must cover the full payroll period.
5. Payrun Structure must match Contract Structure.
6. Schedule precedence is Contract → Employee; missing Schedule blocks payroll.
7. Basic proration is status/day based; Worked Hours affect reporting/overtime only.
8. Missing expected Attendance creates a warning, never implicit Absent.
9. Approved Paid/Unpaid leave suppresses that warning; Paid=1, Unpaid=0.
10. Allocation deduction occurs exactly once on approval.
11. Salary Rule sequence is unique within a Structure; ties are rejected.
12. Formula execution is `jsep` + restricted custom Decimal AST evaluation only; never `eval`/`Function`.
13. Formulas may reference only built-ins and already-executed Rule codes.
14. Overtime is daily excess, not net period excess.
15. One Payslip per Employee/exact period.
16. Recompute only before Validation; finalized payroll and PDFs are immutable snapshots.
17. Authorization is server-side; sensitive mutations are auditable.
18. Dashboard values derive from persisted application data.
