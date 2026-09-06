# Phase 7 - Time Off

## Metadata

- **Status:** APPROVED FOR IMPLEMENTATION
- **Target branch:** `feature/phase07-time-off`
- **Assumed baseline:** Phases 2, 3, 5, and 6 are merged and verified
- **PRD coverage:** A4 Time Off Type and Allocation Setup; B4 Time Off Requests; Employee balances; payroll leave inputs
- **Depends on:** Authentication/RBAC, Employee hierarchy, Working Schedules, Contract date resolution, company timezone, and AuditLog
- **Blocks:** Payroll worked-day calculation, paid/unpaid leave handling, missing-attendance warning suppression, and Time Off reporting
- **Implementation ownership:** Prisma, shared Time Off contracts, Time Off APIs, existing Time Off frontend, Employee smart counts, seeds, and tests

## 1. Goal

Implement the complete Time Off lifecycle using PostgreSQL-backed records:

1. HR configures active Time Off Types.
2. HR creates and approves Employee Allocations when a Type requires balance.
3. Employees submit Time Off Requests.
4. Authorized HR users approve or refuse pending Requests.
5. Approval consumes the selected Allocation exactly once.
6. Approved Requests retain the unit and paid/unpaid policy used at approval so
   later Type edits cannot change payroll history.

This phase provides authoritative approved leave data for future payroll. It
does not create Payruns, Payslips, payroll warnings, or salary lines.

## 2. Source Priority

1. Attached PeoplePay360 PRD.
2. `context/architecture.md`, especially Attendance/Time Off/Worked Days and transaction invariants.
3. `context/project-overview.md` vocabulary, workflows, and role definitions.
4. This specification.
5. Existing Time Off frontend prototype for visual guidance.
6. Existing design system.

If prototype labels or behavior conflict with the first four sources, follow
this specification.

## 3. Scope

### In scope

- Time Off Type persistence and configuration.
- DAY and HOUR units.
- Optional Allocation requirement.
- HR approval or automatic approval policies.
- PAID and UNPAID payroll treatment.
- Allocation creation, approval, refusal, validity, balance, and expiry display.
- Employee and HR-created Time Off Requests.
- Request edit while Pending.
- Request approval/refusal.
- Transactional, exactly-once Allocation consumption.
- Prevention of overlapping Pending/Approved Requests.
- Employee own balances and request history.
- HR global and My Team filters.
- Real Time Off dashboard summary.
- Employee smart-button counts for Requests and Allocations.
- Transactional audit events.
- Representative idempotent seeds and automated tests.

### Out of scope

- Request cancellation, withdrawal, or reverting an Approved Request.
- Multi-level or sequential approvals.
- Manager-specific approval routing beyond the My Team filter.
- Accrual schedules, carry-forward, encashment, negative balance, or expiry jobs.
- Public holidays or company shutdown calendars.
- Half-day DAY requests; use an HOUR Type when partial time is needed.
- Time Off attachments or comments/conversations.
- Automatic Attendance creation or modification.
- Partial-hour payroll proration.
- Hard deletion of Types, Allocations, or Requests.
- Payroll and dashboard chart implementation.

## 4. Canonical Values

```text
Time Off unit: DAY | HOUR
Approval mode: NO_APPROVAL | HR_APPROVAL
Payroll treatment: PAID | UNPAID
Time Off Type status: ACTIVE | INACTIVE
Allocation stored decision: PENDING | APPROVED | REFUSED
Allocation displayed status: PENDING | APPROVED | REFUSED | EXPIRED
Time Off Request status: PENDING | APPROVED | REFUSED
```

Use the user-facing labels `Days`, `Hours`, `No Approval`, `HR Approval`,
`Paid`, `Unpaid`, `Pending`, `Approved`, `Refused`, and `Expired`.

Do not use prototype labels such as `To Approve`, `Validated`, `On Leave`, or
`Cancelled`.

## 5. Locked Business Decisions

### Time Off Types

1. A Type defines its unit, whether an Allocation is required, its approval
   mode, payroll treatment, and active status.
2. Type names are unique case-insensitively through normalized `nameKey`.
3. Only active Types may be selected for new Allocations or Requests.
4. Types are never deleted. Inactivation blocks new Allocations/Requests and
   preserves every existing record. Existing pending Requests may still be
   approved/refused from their snapshots. Pending Allocations may be refused
   but not approved after Type inactivation.
5. Existing Requests snapshot unit, Allocation requirement, and payroll
   treatment. Editing a Type never rewrites those snapshots.
6. Unit cannot change while the Type has a Pending Request, a Pending
   Allocation, or an approved unexpired Allocation with remaining balance.
   Other policy edits apply only to future Requests.

### Allocations

7. Allocations exist only for Types where `requiresAllocation = true`.
8. Only HR/Admin roles create Allocations. Employees can view their own.
9. An Allocation has an inclusive validity period and positive allocated units.
10. A Pending Allocation has no usable balance.
11. Approval makes its balance usable during its validity dates.
12. Refusal is final and never creates usable balance.
13. Display status is derived as `EXPIRED` when an approved Allocation's
    `validTo` is earlier than the company business date. No cron job mutates it.
14. `consumedUnits` starts at zero and changes only when a Request is approved.
15. Remaining balance is always:

    ```text
    remainingUnits = allocatedUnits - consumedUnits
    ```

16. Allocation units are Decimal values and cross HTTP as strings. DAY
    allocations use whole positive units. HOUR allocations use multiples of
    `0.25` hours.
17. Pending Allocations may be edited. Approved, Refused, or derived Expired
    Allocations are immutable; issue a new Allocation for adjustments.

### Requests

18. Employees create Requests for themselves. HR/Admin may create on behalf of
    any active Employee.
19. DAY Requests include an inclusive start/end date and no clock minutes.
20. HOUR Requests use one business date plus start/end minute-of-day and cannot
    cross a date boundary.
21. DAY duration equals the number of expected working dates in the range,
    resolving Contract Schedule override then Employee Schedule fallback for
    each date. Non-working dates do not consume units.
22. DAY Requests must contain at least one expected working date and cannot
    exceed 366 calendar days.
23. HOUR Requests must occur on an expected working date, use 15-minute
    boundaries, remain inside the expected start/end interval, and satisfy
    `endMinute > startMinute`.
24. HOUR duration is exact Decimal hours:

    ```text
    requestedUnits = (endMinute - startMinute) / 60
    ```

25. A Request requiring Allocation must explicitly reference one Allocation.
    The UI may preselect the only eligible Allocation, but the API never picks
    one silently.
26. The Allocation must belong to the same Employee and Type, have the same
    unit, be Approved, cover the entire Request period, and have sufficient
    remaining balance at approval.
27. A Type not requiring Allocation must have `allocationId = null`.
28. `HR_APPROVAL` creates a Pending Request. `NO_APPROVAL` creates and approves
    it transactionally; required balance is consumed in that same transaction.
29. Only Pending Requests may be edited. Type and Employee are immutable;
    dates/times, Allocation, and reason may change and duration is recalculated.
30. Approval/refusal is final. There is no cancellation or reversal in scope.
31. Repeating the same decision is idempotent and returns the existing result
    without another deduction. Attempting the opposite decision returns a
    conflict.
32. Pending and Approved Requests for one Employee must not overlap. Refused
    Requests do not block a new Request.
33. Request creation/update and decisions serialize per Employee so concurrent
    writes cannot bypass overlap or balance checks.

### Attendance and Payroll Semantics

34. Time Off never creates or edits Attendance records.
35. A future payroll calculation handles an expected date as follows when no
    Attendance exists:

    ```text
    Approved PAID Time Off   -> worked-day contribution 1; no missing warning
    Approved UNPAID Time Off -> worked-day contribution 0; no missing warning
    Pending/Refused Time Off -> no contribution; does not suppress warning
    ```

36. Both DAY and HOUR Approved Requests suppress the missing-Attendance warning
    for a covered date. Payroll remains day-granular: any approved HOUR request
    on that date uses the Type's full-day PAID/UNPAID treatment when Attendance
    is absent. Partial-hour salary proration is explicitly out of scope.
37. If Attendance exists, its PRESENT/LATE/ABSENT status remains authoritative
    for worked-day contribution; Time Off does not overwrite it. A later
    payroll spec must surface conflicting Attendance plus Time Off as a warning.

## 6. Prisma Schema

Add:

```prisma
enum TimeOffUnit {
  DAY
  HOUR
}

enum TimeOffApprovalMode {
  NO_APPROVAL
  HR_APPROVAL
}

enum TimeOffPayrollTreatment {
  PAID
  UNPAID
}

enum TimeOffDecisionStatus {
  PENDING
  APPROVED
  REFUSED
}

model TimeOffType {
  id                  String                  @id @default(uuid())
  name                String
  nameKey             String                  @unique
  description         String?
  unit                TimeOffUnit
  requiresAllocation  Boolean                 @default(true)
  approvalMode        TimeOffApprovalMode     @default(HR_APPROVAL)
  payrollTreatment    TimeOffPayrollTreatment @default(PAID)
  status              RecordStatus            @default(ACTIVE)
  allocations         TimeOffAllocation[]
  requests            TimeOffRequest[]
  createdAt           DateTime                @default(now()) @db.Timestamptz(3)
  updatedAt           DateTime                @updatedAt @db.Timestamptz(3)

  @@index([status])
  @@index([unit])
}

model TimeOffAllocation {
  id                  String                @id @default(uuid())
  employeeId          String
  timeOffTypeId       String
  unitSnapshot        TimeOffUnit
  allocatedUnits      Decimal               @db.Decimal(12, 4)
  consumedUnits       Decimal               @default(0) @db.Decimal(12, 4)
  validFrom           DateTime              @db.Date
  validTo             DateTime              @db.Date
  status              TimeOffDecisionStatus @default(PENDING)
  description         String?
  createdByUserId     String
  decidedByUserId     String?
  decidedAt           DateTime?             @db.Timestamptz(3)
  decisionNote        String?
  employee            Employee              @relation(fields: [employeeId], references: [id], onDelete: Restrict)
  timeOffType         TimeOffType           @relation(fields: [timeOffTypeId], references: [id], onDelete: Restrict)
  createdByUser       User                  @relation("AllocationCreator", fields: [createdByUserId], references: [id], onDelete: Restrict)
  decidedByUser       User?                 @relation("AllocationDecider", fields: [decidedByUserId], references: [id], onDelete: Restrict)
  requests            TimeOffRequest[]
  createdAt           DateTime              @default(now()) @db.Timestamptz(3)
  updatedAt           DateTime              @updatedAt @db.Timestamptz(3)

  @@index([employeeId, timeOffTypeId, validFrom, validTo])
  @@index([status, validTo])
}

model TimeOffRequest {
  id                          String                  @id @default(uuid())
  employeeId                  String
  timeOffTypeId               String
  allocationId                String?
  unitSnapshot                TimeOffUnit
  requiresAllocationSnapshot  Boolean
  payrollTreatmentSnapshot    TimeOffPayrollTreatment
  startDate                   DateTime                @db.Date
  endDate                     DateTime                @db.Date
  startMinute                 Int?
  endMinute                   Int?
  requestedUnits              Decimal                 @db.Decimal(12, 4)
  reason                      String
  status                      TimeOffDecisionStatus   @default(PENDING)
  createdByUserId             String
  decidedByUserId             String?
  decidedAt                   DateTime?               @db.Timestamptz(3)
  decisionNote                String?
  employee                    Employee                @relation(fields: [employeeId], references: [id], onDelete: Restrict)
  timeOffType                 TimeOffType             @relation(fields: [timeOffTypeId], references: [id], onDelete: Restrict)
  allocation                  TimeOffAllocation?      @relation(fields: [allocationId], references: [id], onDelete: Restrict)
  createdByUser               User                    @relation("TimeOffRequestCreator", fields: [createdByUserId], references: [id], onDelete: Restrict)
  decidedByUser               User?                   @relation("TimeOffRequestDecider", fields: [decidedByUserId], references: [id], onDelete: Restrict)
  createdAt                   DateTime                @default(now()) @db.Timestamptz(3)
  updatedAt                   DateTime                @updatedAt @db.Timestamptz(3)

  @@index([employeeId, startDate, endDate, status])
  @@index([timeOffTypeId, status])
  @@index([allocationId])
  @@index([status, startDate])
}
```

Add inverse relations on Employee and User with the exact relation names above.

Migration name:

```text
phase07_time_off
```

## 7. Database Checks

Customize the migration with equivalent checks.

### Time Off Type

- name and `nameKey` are non-empty trimmed values;
- description is null or trimmed 1-1000 characters.

### Allocation

```text
allocatedUnits > 0
consumedUnits >= 0
consumedUnits <= allocatedUnits
validTo >= validFrom
```

- DAY `allocatedUnits` must be a whole number.
- HOUR `allocatedUnits * 4` must be a whole number.
- Pending has no decider/time/note.
- Approved/Refused requires decider and decision timestamp.
- Refused must retain `consumedUnits = 0`.

### Request

- `requestedUnits > 0`.
- `endDate >= startDate`.
- DAY requires null start/end minutes and whole requested units.
- HOUR requires `startDate = endDate`, minutes within `0..1439`,
  `endMinute > startMinute`, both divisible by 15, and
  `requestedUnits = (endMinute - startMinute) / 60`.
- Allocation ID is non-null exactly when
  `requiresAllocationSnapshot = true`.
- Pending has no decider/time/note.
- Approved/Refused requires decider and decision timestamp.
- reason is trimmed 5-1000 characters.
- decision note is null or trimmed 3-500 characters.

Prisma/service validation remains required. Translate check/unique failures to
safe public errors.

## 8. Overlap and Concurrency

Before creating/updating/approving a Request, obtain a transaction-scoped lock
for the Employee. Use one documented PostgreSQL advisory-lock key derived from
the Employee UUID, or an equivalent row-lock strategy that serializes all Time
Off writes for that Employee.

Within the same transaction, reject overlaps against Pending/Approved Requests:

- DAY vs any Request: inclusive date ranges intersect.
- HOUR vs DAY: the DAY range contains the HOUR business date.
- HOUR vs HOUR: same date and half-open minute ranges overlap.
- Adjacent HOUR ranges such as `09:00-10:00` and `10:00-11:00` do not overlap.
- Exclude the current Request during a Pending edit.
- Refused Requests are ignored.

Never perform an unlocked read followed by a write. Add concurrency tests that
send simultaneous overlapping requests and simultaneous approvals against the
same Allocation.

## 9. Duration Calculation

Create pure helpers under the Time Off module.

### DAY

Iterate each calendar date inclusively, maximum 366 dates. For each date:

1. Resolve the Contract Schedule override for that date if present.
2. Otherwise use the Employee Schedule.
3. If no Schedule resolves, fail the Request; do not assume Monday-Friday.
4. Count one unit only when that Schedule contains the weekday.

The final count must be greater than zero. Store it as a canonical Decimal
string/Prisma Decimal without JavaScript floating-point arithmetic.

### HOUR

Validate the single date's expected Schedule row and minute boundaries. Compute
the difference in integer minutes, then convert exactly to Decimal hours. The
15-minute rule guarantees no repeating decimal.

Store `requestedUnits` at creation/update. Approval revalidates the stored
duration and Allocation conditions inside the decision transaction but does
not recalculate against later Schedule edits. This preserves the submitted
request snapshot.

## 10. Allocation Consumption

Approval of an Allocation-required Request must execute atomically:

1. Lock and reread the Request.
2. If already Approved, return it without changes.
3. If Refused, reject the transition.
4. Lock and reread the selected Allocation.
5. Verify Employee, Type, unit, Approved status, validity coverage, and current
   remaining balance.
6. Increment `consumedUnits` by `requestedUnits` using Decimal/database
   arithmetic with a conditional balance guard.
7. Mark the Request Approved with actor/time/note.
8. Write both Request and Allocation AuditLog events.
9. Commit once.

If any step fails, neither balance nor Request status changes and no audit event
is committed.

NO_APPROVAL Request creation uses the same locked validation/consumption path
inside its create transaction. Never implement a separate unchecked deduction.

Refusal changes Request status only and never consumes balance.

## 11. Shared Contracts

Create `packages/shared/src/types/time-off.ts` and export it.

Required values:

```ts
export const TimeOffUnitValues = ['DAY', 'HOUR'] as const;
export const TimeOffApprovalModeValues = ['NO_APPROVAL', 'HR_APPROVAL'] as const;
export const TimeOffPayrollTreatmentValues = ['PAID', 'UNPAID'] as const;
export const TimeOffRequestStatusValues = ['PENDING', 'APPROVED', 'REFUSED'] as const;
export const AllocationStatusValues = ['PENDING', 'APPROVED', 'REFUSED', 'EXPIRED'] as const;
```

Inputs:

```ts
export interface TimeOffTypeInput {
  name: string;
  description: string | null;
  unit: TimeOffUnit;
  requiresAllocation: boolean;
  approvalMode: TimeOffApprovalMode;
  payrollTreatment: TimeOffPayrollTreatment;
  status: RecordStatus;
}

export interface AllocationInput {
  employeeId: string;
  timeOffTypeId: string;
  allocatedUnits: string;
  validFrom: string;
  validTo: string;
  description: string | null;
}

export interface TimeOffRequestInput {
  employeeId?: string; // HR on-behalf creation only
  timeOffTypeId: string;
  allocationId: string | null;
  startDate: string;
  endDate: string;
  startMinute: number | null;
  endMinute: number | null;
  reason: string;
}

export interface DecisionInput {
  note: string | null;
}
```

Rules:

- Date strings are strict real `YYYY-MM-DD` company business dates.
- New Requests cannot start in the past. Same-day Requests are allowed.
- IDs are valid UUID strings.
- Names/descriptions/reasons/notes follow the database limits.
- Approval note is optional; refusal note is required and trimmed to 3-500
  characters for both Allocation and Request decisions.
- Decimal unit values cross HTTP as canonical strings, never JSON numbers.
- DAY Allocation units are whole; HOUR units use quarter-hour increments.
- Reject unknown fields and all client-supplied status, duration, balance,
  snapshot, creator, or decision metadata.

DTO requirements:

- Type: persisted fields plus active Allocation/Request counts for HR views.
- Allocation: Employee/Type summaries, unit snapshot, allocated/consumed/
  remaining strings, validity, derived status, `isCurrentlyUsable`, decisions,
  and timestamps.
- Request: Employee/Type/Allocation summaries, snapshots, period/minutes,
  requested units string, reason, status, decisions, and timestamps.
- Request list includes enough Allocation information to display `Allocation
  Used` without another per-row request.
- Never expose User password data or Employee private/bank fields.

## 12. Authorization

| Capability | Employee | HR Manager | HR Payroll User | HR Payroll Manager | Admin |
| --- | --- | --- | --- | --- | --- |
| Read active Types for request form | Allow | Allow | Allow | Allow | Allow |
| Manage Types | Deny | Allow | Allow | Allow | Allow |
| Read own Allocations/balance | Allow | Allow | Allow | Allow | Allow |
| Global Allocation list/detail | Deny | Allow | Allow | Allow | Allow |
| Create/edit/decide Allocation | Deny | Allow | Allow | Allow | Allow |
| Create own Request | Allow | Allow when linked | Allow when linked | Allow when linked | Allow when linked |
| Read/edit own Pending Request | Allow | Allow | Allow | Allow | Allow |
| Global/on-behalf Request access | Deny | Allow | Allow | Allow | Allow |
| Approve/refuse Request | Deny | Allow | Allow | Allow | Allow |
| Hard delete | Deny | Deny | Deny | Deny | Deny |

Rules:

- Employee ownership comes only from authenticated `req.user.employeeId`.
- Employee cannot inject `employeeId` to act for someone else.
- Unlinked Users receive `EMPLOYEE_PROFILE_NOT_LINKED` for own actions.
- HR My Team scope requires the current User to be linked to an Employee and
  returns direct reports where `employee.managerId` equals that ID.
- Unlinked HR can use global HR views but receives a clear unavailable state
  for My Team and own-request actions.
- Express enforces every permission independently of frontend visibility.

## 13. API Contract - Types

Mount the module under `/api/v1/time-off`.

### `GET /api/v1/time-off/types`

Supports `search`, `unit`, `status`, `requiresAllocation`, `page`, and
`pageSize`. Employee role receives active Types only; HR can include inactive.

### `GET /api/v1/time-off/types/:id`

Return detail. Employee role may read active Types only.

### `POST /api/v1/time-off/types`

HR/Admin only. Validate normalized unique name and return 201.

### `PUT /api/v1/time-off/types/:id`

HR/Admin only, full replacement. Enforce the unit-change restriction and
revalidate current references.

### `PATCH /api/v1/time-off/types/:id/status`

HR/Admin only. Inactivation is allowed without rewriting historical records.
Reactivation requires a valid configuration.

No DELETE route.

## 14. API Contract - Allocations

### `GET /api/v1/time-off/allocations`

Queries:

```text
search
employeeId
timeOffTypeId
status=PENDING|APPROVED|REFUSED|EXPIRED
validOn=YYYY-MM-DD
page
pageSize
sort=employee|type|allocatedUnits|remainingUnits|validFrom|validTo|status
order
```

Employee role is restricted to own records. Default sort is
`validFrom desc, createdAt desc, id asc`.

### `GET /api/v1/time-off/allocations/:id`

HR reads any; Employee reads own only.

### `POST /api/v1/time-off/allocations`

HR/Admin only. Require active Employee and active allocation-required Type.
Snapshot Type unit, create Pending, and write `ALLOCATION_CREATED` AuditLog.

### `PUT /api/v1/time-off/allocations/:id`

HR/Admin only. Full replacement is allowed only while Pending. Revalidate all
references/units and write `ALLOCATION_UPDATED`.

### `POST /api/v1/time-off/allocations/:id/approve`

HR/Admin only. Pending -> Approved. Same action is idempotent. Require the Type
to remain active and write `ALLOCATION_APPROVED`.

### `POST /api/v1/time-off/allocations/:id/refuse`

HR/Admin only. Pending -> Refused. Same action is idempotent. Write
`ALLOCATION_REFUSED`. Opposite/final transitions return conflict.

No balance-edit, generic status, or DELETE route.

## 15. API Contract - Requests

### `GET /api/v1/time-off/requests`

Queries:

```text
scope=mine|team|all
search
employeeId
timeOffTypeId
status=PENDING|APPROVED|REFUSED
payrollTreatment=PAID|UNPAID
date
dateFrom
dateTo
page
pageSize
sort=employee|type|startDate|endDate|requestedUnits|status|createdAt
order
```

- Employee is forced to `scope=mine`.
- HR default is `all`; `team` uses direct reports.
- Date filter matches Requests overlapping the supplied date/range.
- Default sort: Pending first, then `startDate asc`, `createdAt asc`, `id asc`.
- Range filters are capped at 366 days.

### `GET /api/v1/time-off/requests/:id`

Employee reads own; HR reads any. Do not reveal inaccessible records through
error detail.

### `POST /api/v1/time-off/requests`

- Employee creates own; HR may include `employeeId` for on-behalf creation.
- Require active Employee and Type.
- Derive duration and snapshots; validate overlap and Allocation.
- HR_APPROVAL returns 201 Pending without consuming balance.
- NO_APPROVAL returns 201 Approved and consumes required balance atomically.
- Write `TIME_OFF_REQUEST_CREATED` and, when auto-approved,
  `TIME_OFF_REQUEST_APPROVED` plus Allocation balance audit.

### `PUT /api/v1/time-off/requests/:id`

- Owner or HR may fully update only a Pending Request.
- Employee and Type are immutable.
- Recalculate duration and revalidate overlap/Allocation.
- Write `TIME_OFF_REQUEST_UPDATED`.

### `POST /api/v1/time-off/requests/:id/approve`

HR/Admin only. Follow the exact locked consumption algorithm. Same decision is
idempotent; opposite/final decision conflicts.

### `POST /api/v1/time-off/requests/:id/refuse`

HR/Admin only. Pending -> Refused without balance change. Same decision is
idempotent; opposite/final decision conflicts.

No cancel, generic status, or DELETE route.

### `GET /api/v1/time-off/summary`

Return live summary values for the authenticated scope:

```text
pendingRequestCount
approvedRequestCountInCurrentYear
pendingAllocationCount
usableAllocationCount
balancesByType[]
```

Employee receives own summary. HR may provide `employeeId`; without it, return
authorized organization totals. Never hardcode dashboard values.

## 16. Public Errors

Use the standard envelope and stable codes:

| HTTP | Code | Meaning |
| ---: | --- | --- |
| 400 | `INVALID_TIME_OFF_INPUT` | Invalid body/query/path |
| 400 | `INVALID_TIME_OFF_PERIOD` | Dates/minutes/range invalid |
| 400 | `TIME_OFF_NO_WORKING_TIME` | DAY has no expected day or HOUR is outside schedule |
| 401 | existing auth code | Not authenticated |
| 403 | `TIME_OFF_ACCESS_DENIED` | Role/ownership denied |
| 403 | `EMPLOYEE_PROFILE_NOT_LINKED` | Own/team action lacks Employee link |
| 404 | `TIME_OFF_TYPE_NOT_FOUND` | Type unavailable/missing |
| 404 | `ALLOCATION_NOT_FOUND` | Allocation unavailable/missing |
| 404 | `TIME_OFF_REQUEST_NOT_FOUND` | Request unavailable/missing |
| 409 | `TIME_OFF_TYPE_NAME_EXISTS` | Normalized Type name conflict |
| 409 | `TIME_OFF_REQUEST_OVERLAP` | Pending/Approved Request overlaps |
| 409 | `ALLOCATION_DECISION_FINAL` | Opposite/final Allocation transition |
| 409 | `TIME_OFF_REQUEST_DECISION_FINAL` | Opposite/final Request transition |
| 409 | `ALLOCATION_IMMUTABLE` | Attempt to edit non-Pending Allocation |
| 409 | `TIME_OFF_REQUEST_IMMUTABLE` | Attempt to edit non-Pending Request |
| 422 | `TIME_OFF_EMPLOYEE_INACTIVE` | Employee unavailable for new action |
| 422 | `TIME_OFF_TYPE_INACTIVE` | Inactive Type used for new action |
| 422 | `ALLOCATION_NOT_REQUIRED` | Allocation created/used for non-allocation Type |
| 422 | `ALLOCATION_NOT_APPROVED` | Selected Allocation is not usable |
| 422 | `ALLOCATION_EXPIRED_OR_NOT_STARTED` | Validity does not cover Request |
| 422 | `ALLOCATION_MISMATCH` | Employee/Type/unit mismatch |
| 422 | `ALLOCATION_BALANCE_INSUFFICIENT` | Remaining units are too small |
| 422 | `TIME_OFF_SCHEDULE_MISSING` | Expected Schedule cannot resolve |

Return field-addressable validation errors. Never expose Prisma/SQL errors,
lock keys, constraint names, private Employee data, or stack traces.

## 17. Backend Organization

Create:

```text
apps/api/src/modules/time-off/
  time-off-calculation.ts
  time-off-overlap.ts
  time-off.mapper.ts
  time-off.schemas.ts
  time-off.routes.ts
  time-off-type.controller.ts
  time-off-type.service.ts
  allocation.controller.ts
  allocation.service.ts
  request.controller.ts
  request.service.ts
  summary.service.ts
  index.ts
```

Tests:

```text
apps/api/tests/time-off-calculation.test.ts
apps/api/tests/time-off.test.ts
```

Reuse company-timezone, date-only, Schedule, Contract resolution, authorization,
and AuditLog utilities. Do not copy them or create Payroll dependencies.

## 18. Audit Requirements

Required actions:

```text
TIME_OFF_TYPE_CREATED
TIME_OFF_TYPE_UPDATED
TIME_OFF_TYPE_STATUS_CHANGED
ALLOCATION_CREATED
ALLOCATION_UPDATED
ALLOCATION_APPROVED
ALLOCATION_REFUSED
ALLOCATION_BALANCE_CONSUMED
TIME_OFF_REQUEST_CREATED
TIME_OFF_REQUEST_UPDATED
TIME_OFF_REQUEST_APPROVED
TIME_OFF_REQUEST_REFUSED
```

Audit includes actor User ID, entity type/ID, Employee ID where relevant,
action, safe before/after JSON, decision note/reason, and UTC timestamp.

Request approval and balance consumption audit events must commit in the same
transaction as both mutations. Rejected/idempotent no-op requests create no new
audit event.

## 19. Frontend Routes and Behavior

```text
/time-off
/time-off/requests
/time-off/requests/new
/time-off/requests/:id
/time-off/allocations
/time-off/allocations/new
/time-off/allocations/:id
/time-off/types
/time-off/types/new
/time-off/types/:id
```

Register every static `/new` route before its `/:id` route. Requests,
Allocations, and Types remain under the Time Off dropdown; do not create
separate top-level navigation items.

### Shared requirements

- Replace `INITIAL_*`, sample rows, page-local interfaces, and local-only
  mutation state with shared DTOs and API queries.
- Preserve filters, scope, sort, and pagination in URL query parameters.
- Provide loading, error with Retry, empty dataset, and filtered-empty states.
- Use real ID-backed selectors; never send display names as relationships.
- Decimal units remain strings in form/API state. Format only for display.
- Render server field errors beside their controls and preserve unsaved values.
- Do not show Delete or unsupported Cancel actions.

### Time Off dashboard

- Populate all cards/balances from `/time-off/summary`.
- Employee sees own balances and request totals.
- HR may switch to organization or Employee scope.
- Remove all hardcoded metrics.

### Requests

- Employee default scope is Mine; HR receives Mine, My Team, and All when
  applicable.
- List columns: Employee, Type, Dates/Hours, Duration, Allocation Used, Payroll
  Treatment, Status, actions.
- New form dynamically shows DAY dates or HOUR date/time inputs.
- Show Allocation selector only when required, with remaining balance and
  validity. Store selected ID.
- Display API-derived duration before final submission through a validation/
  preview request or deterministic shared helper confirmed by the server.
- Detail displays immutable snapshots and decision information.
- Owner/HR Edit appears only while Pending.
- HR Approve/Refuse buttons appear only while Pending, including inline list
  actions. Disable during mutation and require confirmation.
- Approved balance changes must update Request, Allocation, summary, and
  Employee smart-count queries.

### Allocations

- List columns: Employee, Type, Allocated, Taken, Remaining, Validity, Status.
- Employee sees read-only own balances; HR sees New and decision actions.
- New/edit form uses active Employee and allocation-required Type selectors.
- Units and labels change according to DAY/HOUR.
- Approved/Refused/Expired detail is read-only.
- Do not calculate balance with JavaScript floating point; render API strings.

### Types

- Employee request flow may use active Type options but the configuration page
  is HR-only.
- List/form covers Name, Unit, Allocation requirement, Approval mode, Payroll
  treatment, and Active/Inactive status.
- Status changes require confirmation.

### Employee smart buttons

- Enable real Time Off Request and Allocation counts on Employee detail.
- Buttons navigate using `employeeId` query parameter and show a removable
  Employee filter chip.
- Do not load full result sets merely to count them.

## 20. Seed Data

Extend seeds after Employees, Schedules, Contracts, and Attendance.

Create Types:

- Paid Annual Leave: DAY, allocation required, HR approval, Paid.
- Sick Leave: DAY, no allocation, no approval, Paid.
- Unpaid Leave: DAY, no allocation, HR approval, Unpaid.
- Short Permission: HOUR, allocation required, HR approval, Paid.
- one inactive historical Type.

Create idempotent Allocations/Requests covering:

- Pending, Approved, Refused, and derived Expired Allocations.
- DAY and HOUR balances with non-zero consumed/remaining values produced through
  consistent approved Request fixtures.
- Pending Request awaiting decision.
- Approved paid Request with allocation consumption.
- Approved unpaid Request without allocation.
- Refused Request with no consumption.
- NO_APPROVAL auto-approved Request.
- My Team data across at least two managers.

Use fixed IDs or stable unique fixture identifiers/dates. Dates must be based on
a documented demo year and remain internally valid. Do not invoke live approval
logic in a way that increments consumption on every seed rerun; use upserts and
set consistent final balances deterministically.

## 21. Automated Tests

### Type and Allocation

- normalized duplicate Type name rejected;
- Employee sees active Type options but cannot manage Types;
- inactive Type blocked for new Request/Allocation;
- Allocation forbidden for a non-allocation Type;
- DAY whole units and HOUR quarter units enforced;
- Pending has no usable balance;
- approval/refusal transitions and idempotent repeats work;
- opposite/final transitions conflict;
- derived expiry uses company business date;
- consumed/remaining Decimal values round-trip as strings;
- non-Pending Allocation edit rejected.

### Duration and overlap

- DAY counts expected dates only across weekends;
- Contract Schedule override and Employee fallback are honored per date;
- missing Schedule and zero expected days reject;
- HOUR boundaries, 15-minute increments, same-date, and schedule containment
  are enforced;
- DAY/HOUR duration never uses JavaScript floating point;
- every DAY/DAY, DAY/HOUR, and HOUR/HOUR overlap direction is tested;
- adjacent HOUR Requests succeed;
- Refused Requests do not block;
- concurrent overlapping Requests yield one success and one conflict.

### Requests and balance

- Employee creates/reads/edits only own Pending Request;
- HR creates on behalf and lists Mine/My Team/All correctly;
- Allocation employee/type/unit/validity mismatch rejected;
- insufficient balance rejected without partial mutation;
- approval consumes exact units once;
- repeated and concurrent approval never double-deducts;
- refusal never deducts;
- NO_APPROVAL creation approves/deducts atomically;
- failed audit insert rolls back Request and balance;
- Type edits do not rewrite Request snapshots;
- future payroll query can select Approved paid/unpaid coverage by Employee/date.

### RBAC/UI regression

- all five roles follow the matrix;
- unlinked User own/team actions fail safely;
- summary and smart counts use real scoped data;
- no Time Off mocks or fake balances remain;
- all earlier Auth, Schedule, Employee, Salary Config, Contract, and Attendance
  tests still pass.

## 22. Exact Implementation Order

1. Verify prerequisite migrations and full test suite.
2. Add shared enums, input schemas, DTOs, and exports.
3. Add Prisma models/relations and generate `phase07_time_off`.
4. Add migration checks; apply to development/test databases.
5. Implement Decimal duration, status, and balance mappers with unit tests.
6. Implement per-date Schedule resolution and overlap helpers.
7. Implement Type service/routes/RBAC/tests.
8. Implement Allocation CRUD/decisions/derived expiry/audit/tests.
9. Implement Request create/update and Employee/HR ownership tests.
10. Implement locked approval/refusal and exactly-once balance tests.
11. Implement summary endpoint and Employee smart counts.
12. Extend seeds idempotently.
13. Replace Type UI mocks and connect routes/forms.
14. Replace Allocation UI mocks and connect balance/decision flows.
15. Replace Request UI mocks and connect Mine/My Team/All flows.
16. Connect dashboard summary and Employee smart buttons.
17. Run full verification and manual role/balance tests.
18. Append one Branch Updates tracker entry; do not edit tracker summaries.

## 23. Verification

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

Manual verification:

1. As HR, create and approve an Annual Leave Allocation.
2. As its Employee, submit an overlapping-free Request using that Allocation.
3. As HR, approve it and confirm consumed/remaining balance changes once.
4. Repeat approval and refresh; confirm no second deduction.
5. Attempt a Request exceeding remaining balance and confirm no partial change.
6. Submit Sick Leave and confirm NO_APPROVAL immediately produces Approved.
7. Submit Unpaid Leave and confirm its snapshot displays Unpaid.
8. Verify Mine, My Team, and All scopes under linked/unlinked HR accounts.
9. Verify Employee cannot see another Employee's Requests/Allocations or any HR
   configuration/decision controls.
10. Confirm Employee smart buttons use real counts and ID filters.
11. Confirm existing Attendance records are unchanged by Time Off decisions.

## 24. Definition of Done

- [ ] Types, Allocations, and Requests persist with migration checks/indexes.
- [ ] DAY/HOUR duration and overlap rules are deterministic and tested.
- [ ] Allocation statuses/balances/expiry are accurate Decimal strings.
- [ ] Approval and Allocation consumption are atomic and exactly once.
- [ ] NO_APPROVAL uses the same safe approval path.
- [ ] Paid/unpaid and other Type settings are snapshotted on Requests.
- [ ] Ownership, Mine/My Team/All scopes, and all roles are enforced server-side.
- [ ] Dashboard, Types, Allocations, Requests, and smart buttons use real APIs.
- [ ] All Time Off mocks, fake balances, and unsupported labels/actions are gone.
- [ ] Idempotent seeds cover all required states.
- [ ] Earlier tests, typecheck, build, migrations, seed, and manual checks pass.

## 25. Non-Negotiables

- Do not deduct Allocation balance before Request approval.
- Do not deduct more than once, including retries/concurrent approvals.
- Do not approve with insufficient, mismatched, pending, refused, or expired
  Allocation.
- Do not use JavaScript floating point for units or balances.
- Do not trust client-computed duration, remaining balance, status, or snapshots.
- Do not silently choose an Allocation.
- Do not allow overlapping Pending/Approved Requests.
- Do not auto-create or modify Attendance.
- Do not treat Pending/Refused Time Off as payroll leave.
- Do not apply edited Type policy retroactively to existing Requests.
- Do not permit Employee access to another Employee's records.
- Do not add cancellation/reversal without a separate feature spec.
- Do not hard-delete Time Off records.
- Do not create Payroll models in this phase.
