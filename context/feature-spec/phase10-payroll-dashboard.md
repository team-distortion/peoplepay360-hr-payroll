# Phase 10 - Payroll Dashboard and Reporting

## Metadata

- **Status:** APPROVED FOR IMPLEMENTATION
- **Target branch:** `feature/phase10-payroll-dashboard`
- **Assumed baseline:** Phases 1-9 are merged and verified
- **PRD coverage:** A7 Reporting and Dashboard Configuration; B9 Payroll Dashboard
- **Depends on:** Employees, Contracts, Attendance, Time Off, Payruns, Payslips,
  Payroll Warnings, delivery history, RBAC, and historical Payslip snapshots
- **Blocks:** Final data generation, end-to-end demo, and release hardening
- **Implementation ownership:** Reporting queries/API, shared dashboard DTOs,
  `/dashboard` UI, report indexes, minimal seed fixtures, and tests

## 1. Goal

Replace any dashboard placeholder with a live Payroll Dashboard derived from
PostgreSQL. Authorized HR users see workforce, Attendance, and Time Off data;
authorized Payroll users and Admin additionally see salary, Payrun, Payslip,
warning, and delivery information.

Every card, chart, breakdown, and alert must respond to the selected Period,
Department, and Employee Type filters. The browser must never calculate
authoritative totals from downloaded record lists.

## 2. Source Priority

1. PeoplePay360 PRD, especially A7 and B9.
2. `context/architecture.md` report and historical-snapshot rules.
3. `context/project-overview.md` dashboard requirements.
4. This specification.
5. Phase 3, 5, 6, 7, 8, and 9 contracts.
6. Existing UI context and components.

## 3. Scope

### In scope

- `/dashboard` protected route and navigation entry.
- Period, Department, and Employee Type filters stored in URL query parameters.
- Workforce, Attendance, and Time Off KPIs/overviews.
- Payroll KPIs, monthly Net salary trend, and Department salary cost.
- Department headcount and paid salary breakdown.
- Operational alerts for Payroll, Attendance, Contract, and delivery issues.
- Role-aware APIs that do not expose payroll values to HR Manager.
- Server-side Decimal-safe aggregation and stable empty responses.
- Query/index review, loading/error/empty states, and automated tests.
- At most the minimum additional seed rows needed to exercise empty and
  non-empty dashboard states.

### Out of scope

- CSV/Excel/PDF report export.
- Custom report builder, saved filters, scheduled reports, or email reports.
- Forecasting, budgeting, benchmarking, or predictive analytics.
- Drill-down mutation actions inside charts.
- Redis, materialized views, queues, background aggregation, or a data warehouse.
- Company filter unless a later approved schema provides an immutable Company
  identifier/snapshot; `WorkingSchedule.companyName` alone is not historical authority.
- Refactoring `seed.ts` or generating the final 200-Employee dataset.

## 4. Locked Reporting Semantics

1. The default Period is the current company-calendar month. The API receives
   strict inclusive `periodStart` and `periodEnd` dates and rejects ranges over
   366 days.
2. Payroll records are included when their complete payroll Period is contained
   within the selected Period. Attendance and Time Off are clipped to dates
   inside the selected Period.
3. Department and Employee Type filtering uses immutable Payslip reporting
   snapshots for historical payroll and the Employee record for current HR data.
4. All money uses Prisma Decimal/database `NUMERIC`. Decimal values cross HTTP
   as fixed two-decimal strings. Never aggregate money in JavaScript `number`.
5. `totalNetSalaryPaid`, monthly salary trend, and Department salary cost include
   only `PAID` Payslips.
6. `payslipsGenerated` counts `COMPUTED`, `VALIDATED`, and `PAID` Payslips;
   Draft is excluded.
7. `averagePaidSalary = total paid Net / distinct paid Payslips`; return `"0.00"`
   when there are no paid Payslips.
8. Approved Time Off is returned separately as Request count, DAY units, and
   HOUR units. DAY and HOUR values are never added together.
9. Attendance status totals count persisted Attendance records. Attendance
   coverage compares expected working employee-days with covered records and
   excludes approved full-day Time Off. Reuse the schedule/contract Period
   resolvers; do not invent client-side approximations.
10. Attendance health is a percentage string with four decimal places:
    `covered expected days / eligible expected days * 100`. When the denominator
    is zero, return `"0.0000"` plus `hasCoverageData: false`.
11. Headcount means ACTIVE Employees matching the current Department/Employee
    Type filters. Historical salary totals must not be regrouped using an
    Employee's current Department.
12. Alerts are live query results, not persisted dashboard records. Return
    counts plus at most 10 newest/actionable examples per category.
13. All timestamps are UTC; date bucketing follows the configured company
    timezone and returns canonical `YYYY-MM` keys.
14. Read-only report requests create no AuditLog rows.
15. Each response is internally consistent from one request. Use one read-only
    transaction where supported; do not hold a transaction while rendering UI.

## 5. Historical Reporting Snapshot Gap

Before implementation, inspect the merged Phase 8 `Payslip` model. Historical
Department and Employee Type filters require immutable values captured during
Compute. If absent, add nullable snapshot fields:

```prisma
departmentIdSnapshot String?
employeeTypeSnapshot EmployeeType?
```

Populate them on Compute and never change them after Validation. Backfill
existing non-Draft rows once from the Employee/Department data available at
migration time; null remains an explicit `UNKNOWN` bucket if reconstruction is
impossible. Do not modify financial values, Lines, hashes, or stored PDFs.

Add indexes only when confirmed missing by the merged schema/query plan:

```prisma
@@index([status, periodStart, periodEnd])
@@index([departmentIdSnapshot, employeeTypeSnapshot, status])
```

Migration name when fields/indexes are required:

```text
phase10_reporting_snapshots
```

If the merged Phase 8 schema already has equivalent snapshots and indexes, this
phase owns no Prisma migration. Document that finding in the PR.

## 6. Shared Contracts

Create and export `packages/shared/src/types/dashboard.ts`.

```ts
interface DashboardFilters {
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD
  departmentId?: string;
  employeeType?: EmployeeType;
}

interface DashboardFilterOptionsDto {
  departments: Array<{ id: string; name: string }>;
  employeeTypes: EmployeeType[];
  minAvailableDate: string | null;
  maxAvailableDate: string | null;
}
```

HR response sections:

```text
headcount
attendance: expectedDays, coveredDays, coveragePercent, hasCoverageData,
            present, late, absent, overtimeMinutes, missingCheckOuts, manualEdits
timeOff: approvedRequestCount, approvedDayUnits, approvedHourUnits,
         pendingRequestCount, usableAllocationCount
departmentHeadcount[]
hrAlerts[]
```

Payroll response sections:

```text
totalNetSalaryPaid, payslipsGenerated, averagePaidSalary
salaryCostByDepartment[]
monthlyNetSalaryTrend[]
payrunStatusCounts[]
warningCounts by type/status/blocking
deliveryCounts by latest attempt status
payrollAlerts[]
```

All arrays use deterministic ordering and include explicit zero values where a
known category has no records. DTOs never contain Employee private/bank data,
PDF bytes, SMTP details, warning raw internals, or AuditLog JSON.

## 7. Authorization

| Capability | Employee | HR Manager | HR Payroll User | HR Payroll Manager | Admin |
| --- | --- | --- | --- | --- | --- |
| Open organization dashboard | Deny | Allow | Allow | Allow | Allow |
| Read HR/Attendance/Time Off sections | Deny | Allow | Allow | Allow | Allow |
| Read salary/Payrun/Payslip/warning/delivery sections | Deny | Deny | Allow | Allow | Allow |

The HR Manager frontend must not call the payroll endpoint. The payroll endpoint
must independently reject HR Manager even if the UI is bypassed.

## 8. API Contract

Mount under `/api/v1/reports/dashboard`.

### `GET /api/v1/reports/dashboard/filters`

Allowed organization-dashboard roles. Returns active Departments, Employee
Type values, and available data bounds. Options are ordered by display name/ID.

### `GET /api/v1/reports/dashboard/hr`

Allowed HR Manager, HR Payroll User, HR Payroll Manager, and Admin. Accepts
`DashboardFilters`. Returns only workforce, Attendance, Time Off, Department
headcount, and HR alerts.

### `GET /api/v1/reports/dashboard/payroll`

Allowed HR Payroll User, HR Payroll Manager, and Admin. Accepts the same
filters. Returns salary, Payslip, Payrun, warning, delivery, and payroll-alert
sections.

Validation rules:

- reject unknown query keys;
- require strict valid dates and `periodStart <= periodEnd`;
- maximum inclusive range is 366 days;
- Department must exist; inactive Departments remain selectable when matching
  historical data;
- Employee Type must be a supported enum;
- use standard `{ data, error }` envelopes.

Errors: `INVALID_DASHBOARD_FILTERS` (400), `DASHBOARD_ACCESS_DENIED` (403),
`DEPARTMENT_NOT_FOUND` (404), and sanitized `DASHBOARD_QUERY_FAILED` (500).

## 9. Alert Definitions

Return stable alert codes, severity, count, label, safe summary, and deep-link
route. Required categories:

- `DRAFT_PAYRUN`: Draft Payrun whose Period intersects the filter.
- `OPEN_BLOCKING_PAYROLL_WARNING`: open blocking Warning.
- `DUPLICATE_PAYSLIP_WARNING`: open duplicate warning.
- `INCOMPLETE_EMPLOYEE_PAYROLL_DATA`: existing missing-data warnings; do not
  rescan private fields differently from payroll validation.
- `CONTRACT_EXPIRING`: Contract end date within selected Period.
- `ATTENDANCE_MISSING_CHECKOUT`: open Attendance record in Period.
- `PENDING_TIME_OFF_REQUEST`: pending Request in Period.
- `PAYSLIP_DELIVERY_FAILED_OR_UNKNOWN`: latest attempt Failed or Unknown.

HR Manager receives only Contract, Attendance, and Time Off categories.

## 10. Backend Organization

```text
apps/api/src/modules/reports/
  dashboard.schemas.ts
  dashboard.types.ts
  dashboard.mapper.ts
  dashboard-date.service.ts
  dashboard-hr.service.ts
  dashboard-payroll.service.ts
  dashboard.controller.ts
  dashboard.routes.ts
  index.ts
```

Use explicit aggregate queries or `$queryRaw` with parameterized Prisma SQL.
Never concatenate filter values into SQL. Keep controllers thin. Add only
indexes supported by `EXPLAIN`/test evidence; do not persist duplicated totals.

## 11. Frontend Behavior

- Replace the current root/fallback behavior with `/dashboard` for authorized
  organization roles; Employee may continue to its own Employee page.
- Store all filters in URL query parameters so refresh/back navigation preserves
  state.
- Fetch HR and payroll sections independently so one failure does not erase the
  other section.
- HR Manager sees no salary cards, salary charts, warning details, or delivery
  data—not zeroed or masked placeholders.
- KPI cards show labels, exact values, Period context, and skeleton/error states.
- Use accessible chart components. Adding `recharts` is allowed; do not add D3
  or a second charting library.
- Charts need legends, tooltips, textual summaries, and non-color-only series
  distinction. Money tooltips format the Decimal strings for display only.
- Empty results show `No data for this period`, not fake sample values.
- Alert items navigate to existing filtered detail/list routes.
- Debounce non-date filter changes briefly and cancel stale requests.

## 12. Seed Policy

Do not refactor the evolving seed architecture. Reuse existing Phase 3-9 data.
Only if required for verification, append a minimal fixed prior-month Paid
Payrun/Payslip and one alert-producing record to the current `seed.ts`. Preserve
all earlier fixtures, keep reruns idempotent, and do not add the final
200-Employee generator or Faker.

## 13. Tests

Automated coverage must verify:

- Period boundaries and 366-day rejection;
- Department/Employee Type filters affect every relevant section;
- paid totals exclude Draft/Computed/Validated Payslips;
- generated count excludes Draft;
- Decimal sums/averages are exact and serialized as strings;
- DAY/HOUR Time Off is never combined;
- attendance coverage, full-day approved Time Off exclusion, and zero denominator;
- historical payroll remains grouped by snapshot after Employee changes Department;
- monthly and Department ordering is deterministic;
- alert codes/counts/deep links reconcile with source rows;
- HR Manager receives HR data and is denied payroll endpoint;
- Employee is denied; Payroll roles/Admin receive permitted sections;
- no private, bank, PDF, SMTP, or raw warning data leaks;
- empty database/filter returns stable zero/empty DTOs;
- dashboard rendering covers loading, partial error, empty, and populated states;
- earlier tests continue passing.

## 14. Implementation Order

1. Verify merged Phase 3-9 schemas and snapshot availability.
2. Add only required snapshot fields/index migration and Compute population.
3. Add shared filter/response contracts and validation.
4. Implement HR aggregates and tests.
5. Implement Payroll aggregates and exact Decimal tests.
6. Implement alerts, RBAC, and leak tests.
7. Register report routes.
8. Build `/dashboard`, URL filters, KPIs, charts, overviews, and alerts.
9. Add only minimal seed fixtures if current fixtures cannot demonstrate charts.
10. Run query-plan, regression, build, and manual verification.
11. Append one Branch Updates tracker entry only.

## 15. Verification

```bash
npm run db:up
npm run prisma:generate
npm run prisma:migrate
npm run db:test:prepare
npm run db:seed
npm run typecheck
npm run build
npm test
```

Manual checks:

1. Open `/dashboard` as HR Manager and verify HR-only sections.
2. Open as Payroll User and verify salary/reporting sections.
3. Change every filter and confirm URL plus all visible totals update.
4. Open chart/alert drill-down links and verify matching filtered records.
5. Use an empty Period and verify honest empty states.
6. Modify an Employee's current Department and verify finalized historical
   salary remains in its snapshot Department.

## 16. Definition of Done

- [ ] Dashboard uses live PostgreSQL data with exact locked calculations.
- [ ] Required PRD KPIs, charts, overviews, filters, and alerts are present.
- [ ] HR Manager cannot access payroll-sensitive reporting.
- [ ] Historical payroll grouping uses immutable snapshots.
- [ ] Empty/loading/partial-error states contain no hardcoded business data.
- [ ] No duplicated dashboard totals are persisted.
- [ ] Current seed is preserved and only minimally extended if necessary.
- [ ] Typecheck, build, migrations, tests, and manual checks pass.

## 17. Non-Negotiables

- Do not aggregate money using floating point.
- Do not calculate authoritative dashboard totals in React.
- Do not regroup historical payroll using mutable current Employee data.
- Do not expose salary data to HR Manager or Employee.
- Do not hardcode KPI/chart/alert values.
- Do not add export, forecasting, caching infrastructure, or custom reports.
- Do not refactor seed architecture or generate 200 Employees in this phase.

