# Schema Roadmap

This file evaluates the current Prisma schema and defines the project-level
data-model direction. It is an architecture guide, not a migration or a feature
implementation spec.

## Current Schema Fitness

The current schema is correct for the completed authentication phase, but it is
not the schema for the whole PeoplePay360 product.

- `Role` contains the five PRD roles and can remain the shared authorization
  vocabulary.
- `User` correctly owns login credentials, one assigned role, active state, and
  timestamps.
- `User.employeeId` is currently a nullable unique string because Employee did
  not exist in Phase 1. During Employee implementation it must become a real
  optional one-to-one foreign-key relation.
- The PostgreSQL `session` table is migration-managed outside Prisma models and
  should remain that way.

Do not add every future model to `schema.prisma` in one migration. Add one
coherent domain at a time from a reviewed feature spec so constraints, test
fixtures, and rollback behavior are verified with the feature that needs them.

## Target Domain Model

| Domain | Planned records | Primary relationships |
| --- | --- | --- |
| Access | User, Role, session | User optionally links one-to-one to Employee |
| Core HR | Department, Employee | Employee belongs to Department, may reference a manager Employee and default Working Schedule |
| Scheduling | WorkingSchedule, WorkingScheduleDay | Schedule owns its weekly day/time pattern and is referenced by Employees or Contracts |
| Contracts | Contract | Employee owns Contract history; Contract references Salary Structure and may override Working Schedule |
| Attendance | Attendance | One record per Employee and business date; schedule supplies expected time |
| Time Off | TimeOffType, Allocation, TimeOffRequest | Allocation belongs to Employee and Type; Request references Employee, Type, and the consumed Allocation when required |
| Salary config | SalaryStructure, SalaryRule | Structure owns an ordered set of Rules |
| Payroll | Payrun, Payslip, PayslipLine, PayrollWarning | Payrun owns Payslips; Payslip stores calculated Lines and Warnings using resolved Contract/Structure context |
| Delivery | PayslipDeliveryAttempt | Records each email attempt for a finalized Payslip |
| Audit | AuditLog | Append-only record of sensitive actor/entity actions |

## Relationship and Integrity Direction

- Historical business records are archived/inactivated, not hard-deleted.
- Money and formula results use PostgreSQL `NUMERIC`/Prisma Decimal.
- Durations use integer minutes where practical.
- Contract, Attendance, Time Off, and payroll Period dates use PostgreSQL
  `DATE`; event timestamps use UTC `timestamptz`.
- One Attendance record exists per Employee/date.
- Running Contract ranges for one Employee cannot overlap.
- Salary Rule code and sequence are unique within a Salary Structure.
- One Payslip exists per Employee and exact Period.
- Multi-record Time Off and payroll transitions are transactional and
  idempotent.
- Finalized payroll records and stored Payslip PDFs are immutable snapshots.

## Migration Order

1. Working Schedule and its weekly pattern.
2. Department and Employee; replace `User.employeeId` with the real relation.
3. Salary Structure and Salary Rule.
4. Contract and database-level overlap protection.
5. Attendance.
6. Time Off Type, Allocation, and Time Off Request.
7. Payrun, Payslip, Payslip Line, and Payroll Warning.
8. Payslip delivery attempts and any remaining report-supporting indexes.

`AuditLog` should be introduced with the first sensitive domain mutation rather
than retrofitted after payroll is complete.

## Decisions to Resolve in Feature Specs

Resolve these before the relevant migration instead of guessing in Prisma:

- Employee status and Employee Type values.
- Supported Working Schedule types and overnight/split-shift behavior.
- Whether Contract status is stored, derived, or transition-controlled.
- Time Off approval modes, units, and paid/unpaid payroll behavior.
- Exact warning types and which warnings are acknowledgeable.
- Whether any snapshot fields beyond persisted Payslip Lines are required for
  historical reproduction and PDF rendering.

The PRD describes five role personas, and the current UI uses a single-select
role control. Keep one role per User unless a future product decision explicitly
introduces multi-role accounts and updates authorization, UI, seeds, and tests
together.
