# Phase 6 - Attendance

## Metadata

- **Status:** APPROVED FOR IMPLEMENTATION
- **Target branch:** `feature/phase06-attendance`
- **Assumed baseline:** Phases 2, 3, and 5 are merged and verified
- **PRD coverage:** B3 Attendance List and Form; Employee attendance actions; Attendance reporting inputs
- **Depends on:** Authentication/RBAC, Employee, Working Schedule, Contract date resolution, and AuditLog
- **Blocks:** Payroll worked-day inputs, overtime calculation, missing-attendance warnings, and Attendance Dashboard metrics
- **Implementation ownership:** Prisma, shared Attendance contracts, Attendance API, existing Attendance UI, navbar widget, Employee smart count, seeds, and tests

## 1. Goal

Replace the Attendance prototype with a PostgreSQL-backed operational feature.
Linked users must be able to check themselves in and out from the global widget.
Authorized HR roles must be able to review, create, and correct Attendance
records. Worked time, lateness, overtime, and flags must be derived by the
server from timestamps and the applicable Working Schedule.

Attendance created in this phase must be usable later by payroll and reporting
without reparsing display strings or recalculating history from a schedule that
may have changed.

## 2. Source Priority

1. Attached PeoplePay360 PRD.
2. `context/architecture.md`, especially Attendance/Time Off/Worked Days invariants.
3. `context/project-overview.md` vocabulary and role permissions.
4. This specification.
5. `context/feature-spec/06_attendance_ui.md` for visual guidance.
6. Existing frontend prototype.

If the old UI prototype or UI spec conflicts with the first four sources,
follow this specification.

## 3. Scope

### In scope

- Attendance Prisma model, migration, indexes, and database checks.
- One record per Employee and business date.
- Self-service Check In and Check Out actions using server time.
- Attendance list/detail APIs with ownership and role enforcement.
- Authorized manual creation and correction.
- Derived worked minutes, overtime minutes, status, and flags.
- Contract Schedule override followed by Employee Schedule fallback.
- Snapshot of expected schedule values on Attendance creation.
- Global Attendance list and Employee-filtered list.
- Attendance detail/create/correction UI.
- Functional navbar Attendance Widget with live elapsed time.
- Real Employee Attendance smart-button count.
- Append-only Attendance audit events.
- Representative idempotent seed records.

### Out of scope

- Multiple work sessions or breaks recorded as separate punches in one day.
- Overnight/split shifts.
- Geolocation, biometrics, IP restrictions, device fingerprinting, or kiosks.
- Automatic Absent records.
- Time Off models or approval behavior.
- Payroll warnings, Payruns, Payslips, or salary computation.
- Attendance approval workflow.
- Bulk CSV import/export.
- Destructive deletion.
- Editing an Attendance record's Employee or business date after creation.

## 4. Locked Business Rules

1. One Attendance record exists per Employee and `attendanceDate`.
2. `attendanceDate` is a PostgreSQL `DATE`. Check-in/out values are UTC
   `timestamptz` instants.
3. Widget actions use the API server's clock. The client must never submit the
   authoritative check-in or check-out time.
4. Company-local date and time are derived using `COMPANY_TIMEZONE`, an IANA
   timezone configured on the API. Add it to environment validation and
   `.env.example`; use `Asia/Kolkata` for local development/seed examples.
5. A record supports one Check In and one Check Out. Repeated punches do not
   create extra records or overwrite stored timestamps.
6. Automatic Check In creates a `PRESENT` or `LATE` open record. Automatic
   Check Out completes that same record.
7. `ABSENT` is created only by an authorized manual action. Missing Attendance
   must remain missing; it is never auto-converted to Absent.
8. Status values are exactly `PRESENT`, `LATE`, and `ABSENT`. Time Off is not an
   Attendance status.
9. `LATE` means check-in occurred after the snapshotted expected start minute.
   There is no grace period in current scope. A non-expected workday has no
   late threshold and a check-in is `PRESENT`.
10. Worked minutes are computed only after Check Out:

    ```text
    elapsedMinutes = floor((checkOutAt - checkInAt) / 60 seconds)
    workedMinutes = max(elapsedMinutes - expectedBreakMinutes, 0)
    ```

11. An open record stores `workedMinutes = 0`. The widget may display live
    elapsed time, but that value is not persisted until Check Out.
12. Daily overtime is:

    ```text
    overtimeMinutes = max(workedMinutes - expectedMinutes, 0)
    ```

    On a non-expected schedule day, `expectedMinutes = 0`, so all completed
    worked minutes are overtime. Short days never cancel overtime on other days.
13. `ABSENT` requires no timestamps, zero worked/overtime minutes, and an
    expected working day (`expectedMinutes > 0`).
14. `PRESENT`/`LATE` requires Check In. Check Out may be null while the record
    is open.
15. Check Out must be later than Check In and occur on the same company
    business date. Overnight attendance is rejected and requires HR correction.
16. Employee/date become immutable once created. A wrong record is corrected
    through timestamps/status, not reassigned to another Employee or date.
17. Schedule expectation is resolved and snapshotted when the record is
    created. Later Schedule/Contract edits do not rewrite historical Attendance.
18. No API accepts client-computed status, worked minutes, overtime, flags, or
    expected schedule values for a worked record.
19. Manual correction sets `manuallyEdited = true`, records editor/time, and
    writes an AuditLog event in the same transaction.
20. No Attendance endpoint hard-deletes data.

## 5. Schedule Resolution and Snapshot

For the Attendance business date:

1. Find the zero-or-one Contract whose inclusive range contains that single
   date. Phase 5 overlap protection guarantees no valid multiple match.
2. If that Contract has a Working Schedule override, use it.
3. Otherwise use the Employee's Working Schedule.
4. If neither exists, reject creation with `ATTENDANCE_SCHEDULE_MISSING`.
5. If the selected Schedule has a row for the date's weekday, snapshot its
   start, end, break, and net expected minutes.
6. If it has no row for that weekday, snapshot a non-working day:
   expected start/end null, break zero, and expected minutes zero.

Do not require a Contract merely to record Attendance. Contract absence still
allows Employee Schedule fallback. Contract Payroll eligibility remains a
later concern.

Snapshot fields are authoritative after creation. A correction recalculates
status/worked/overtime from the existing snapshot; it does not silently resolve
a newer Schedule.

## 6. Prisma Schema

Add:

```prisma
enum AttendanceStatus {
  PRESENT
  LATE
  ABSENT
}

model Attendance {
  id                       String           @id @default(uuid())
  employeeId               String
  attendanceDate           DateTime         @db.Date
  checkInAt                DateTime?        @db.Timestamptz(3)
  checkOutAt               DateTime?        @db.Timestamptz(3)
  status                   AttendanceStatus
  workedMinutes            Int              @default(0)
  overtimeMinutes          Int              @default(0)
  workingScheduleId        String
  expectedStartMinute      Int?
  expectedEndMinute        Int?
  expectedBreakMinutes     Int              @default(0)
  expectedMinutes          Int              @default(0)
  manuallyEdited           Boolean          @default(false)
  lastEditedByUserId       String?
  lastEditedAt             DateTime?         @db.Timestamptz(3)
  createdAt                DateTime          @default(now()) @db.Timestamptz(3)
  updatedAt                DateTime          @updatedAt @db.Timestamptz(3)

  employee         Employee        @relation(fields: [employeeId], references: [id], onDelete: Restrict)
  workingSchedule  WorkingSchedule @relation(fields: [workingScheduleId], references: [id], onDelete: Restrict)
  lastEditedByUser User?            @relation("AttendanceLastEditor", fields: [lastEditedByUserId], references: [id], onDelete: SetNull)

  @@unique([employeeId, attendanceDate])
  @@index([attendanceDate, status])
  @@index([employeeId, attendanceDate])
  @@index([workingScheduleId])
  @@index([manuallyEdited])
  @@index([overtimeMinutes])
}
```

Add inverse relations:

```prisma
model Employee {
  // existing fields
  attendances Attendance[]
}

model WorkingSchedule {
  // existing fields
  attendances Attendance[]
}

model User {
  // existing fields
  attendanceEdits Attendance[] @relation("AttendanceLastEditor")
}
```

Migration name:

```text
phase06_attendance
```

Customize the generated migration with database checks equivalent to:

```sql
ALTER TABLE "Attendance"
  ADD CONSTRAINT "Attendance_minutes_check"
    CHECK (
      "workedMinutes" >= 0
      AND "overtimeMinutes" >= 0
      AND "expectedMinutes" >= 0
      AND "expectedBreakMinutes" >= 0
    ),
  ADD CONSTRAINT "Attendance_expected_clock_check"
    CHECK (
      ("expectedStartMinute" IS NULL AND "expectedEndMinute" IS NULL
        AND "expectedMinutes" = 0 AND "expectedBreakMinutes" = 0)
      OR
      ("expectedStartMinute" BETWEEN 0 AND 1439
        AND "expectedEndMinute" BETWEEN 1 AND 1439
        AND "expectedEndMinute" > "expectedStartMinute"
        AND "expectedBreakMinutes" < ("expectedEndMinute" - "expectedStartMinute")
        AND "expectedMinutes" =
          "expectedEndMinute" - "expectedStartMinute" - "expectedBreakMinutes")
    ),
  ADD CONSTRAINT "Attendance_punch_order_check"
    CHECK ("checkOutAt" IS NULL OR ("checkInAt" IS NOT NULL AND "checkOutAt" > "checkInAt")),
  ADD CONSTRAINT "Attendance_derived_minutes_check"
    CHECK (
      ("checkOutAt" IS NOT NULL
        AND "overtimeMinutes" = GREATEST("workedMinutes" - "expectedMinutes", 0))
      OR
      ("checkOutAt" IS NULL
        AND "workedMinutes" = 0 AND "overtimeMinutes" = 0)
    ),
  ADD CONSTRAINT "Attendance_status_shape_check"
    CHECK (
      ("status" = 'ABSENT'
        AND "checkInAt" IS NULL AND "checkOutAt" IS NULL
        AND "workedMinutes" = 0 AND "overtimeMinutes" = 0
        AND "expectedMinutes" > 0)
      OR
      ("status" IN ('PRESENT', 'LATE') AND "checkInAt" IS NOT NULL)
    ),
  ADD CONSTRAINT "Attendance_manual_metadata_check"
    CHECK (
      ("manuallyEdited" = FALSE
        AND "lastEditedByUserId" IS NULL AND "lastEditedAt" IS NULL)
      OR
      ("manuallyEdited" = TRUE
        AND "lastEditedByUserId" IS NOT NULL AND "lastEditedAt" IS NOT NULL)
    );
```

The API still validates these invariants before writes. Translate unique/check
constraint races into stable public errors without exposing database details.

## 7. Shared Contracts and Validation

Create `packages/shared/src/types/attendance.ts` and export it.

```ts
export const AttendanceStatusValues = ['PRESENT', 'LATE', 'ABSENT'] as const;

export const AttendanceFlagValues = [
  'OVERTIME',
  'MISSING_CHECK_OUT',
  'MANUALLY_EDITED',
] as const;
```

Required write contracts:

```ts
export interface ManualAttendanceInput {
  employeeId: string;
  attendanceDate: string; // YYYY-MM-DD
  kind: 'WORKED' | 'ABSENT';
  checkInAt: string | null;  // required for WORKED
  checkOutAt: string | null; // optional open WORKED record
  reason: string;
}

export interface AttendanceCorrectionInput {
  kind: 'WORKED' | 'ABSENT';
  checkInAt: string | null;
  checkOutAt: string | null;
  reason: string;
}
```

Validation:

- IDs are valid non-empty UUID strings.
- `attendanceDate` is a real `YYYY-MM-DD` calendar date and cannot be future in
  `COMPANY_TIMEZONE`.
- Manual timestamps are ISO 8601 strings containing `Z` or an explicit offset.
- Both timestamps must map to `attendanceDate` in `COMPANY_TIMEZONE`.
- `WORKED` requires Check In; Check Out is null or later than Check In.
- `ABSENT` requires both timestamps null.
- Correction reason is trimmed, 5-500 characters.
- Empty optional timestamp input normalizes to null.
- Reject unknown keys and all derived fields.

DTO fields:

```text
id
employee: { id, employeeNumber, fullName }
department: { id, name } | null
manager: { id, fullName } | null
attendanceDate
checkInAt
checkOutAt
status
workedMinutes
overtimeMinutes
workingSchedule: { id, name }
expectedStartMinute
expectedEndMinute
expectedBreakMinutes
expectedMinutes
flags
manuallyEdited
lastEditedBy: { id, email } | null
lastEditedAt
createdAt
updatedAt
```

`flags` is derived in this order:

1. `OVERTIME` when `overtimeMinutes > 0`.
2. `MISSING_CHECK_OUT` when Check In exists and Check Out is null.
3. `MANUALLY_EDITED` when true.

Do not return decimal-hour strings as data. The frontend formats integer
minutes as `Hh Mm` or decimal hours for display only.

## 8. Timezone Utility

Create a single reusable server utility for:

- validating `COMPANY_TIMEZONE` at application startup;
- converting a UTC instant to company `YYYY-MM-DD`;
- extracting company-local weekday and minute-of-day;
- verifying an instant belongs to a supplied business date.

Use `Intl.DateTimeFormat` with an explicit `timeZone`; never rely on the host
machine timezone. Tests inject the clock and timezone. Do not call `new Date()`
throughout controllers/services directly.

This utility is the authoritative boundary for widget and manual timestamp
logic. Store only UTC instants and date-only values in PostgreSQL.

After this utility exists, update earlier request-scoped "today" calculations
(including derived Contract status and Employee date validation) to use the
same company business date. This supersedes Phase 5's temporary UTC-today
fallback and prevents adjacent modules from disagreeing near midnight.

## 9. Status and Duration Derivation

Create pure calculation helpers receiving timestamps plus the persisted
snapshot.

### Status

```text
ABSENT input -> ABSENT
non-working day -> PRESENT
check-in local minute > expectedStartMinute -> LATE
otherwise -> PRESENT
```

### Completed duration

- Difference uses exact UTC instants, then floors to complete minutes.
- Subtract the snapshotted break once.
- Never produce negative minutes.
- Recalculate both worked and overtime minutes on manual correction.
- Open record remains zero worked/overtime minutes.
- Do not round through decimal hours.

### Flags

Flags are derived from stored facts when mapping the response; do not store a
comma-separated string or mutable array column.

## 10. Authorization

| Capability | Employee | HR Manager | HR Payroll User | HR Payroll Manager | Admin |
| --- | --- | --- | --- | --- | --- |
| View own Attendance | Allow | Allow | Allow | Allow | Allow |
| Global list/detail | Deny | Allow | Allow | Allow | Allow |
| Self Check In/Out | Allow | Allow when linked | Allow when linked | Allow when linked | Allow when linked |
| Manual create/correct | Deny | Allow | Allow | Allow | Allow |
| Delete | Deny | Deny | Deny | Deny | Deny |

Rules:

- Self actions always use `req.user.employeeId`; never accept Employee ID from
  the request body.
- Employee role sees only its own records and receives 403 for explicit access
  to another Employee.
- Unlinked users receive `EMPLOYEE_PROFILE_NOT_LINKED` for self/widget routes.
- HR roles can use global routes regardless of whether their own User Account
  is Employee-linked, but an unlinked account cannot use the widget.
- Permissions are enforced in Express, not only through hidden buttons.

## 11. API Contract

Mount under `/api/v1/attendance`.

### `GET /api/v1/attendance`

Query parameters:

```text
search
employeeId
departmentId
status=PRESENT|LATE|ABSENT
flag=OVERTIME|MISSING_CHECK_OUT|MANUALLY_EDITED
date
dateFrom
dateTo
page=1
pageSize=20 (max 100)
sort=employee|attendanceDate|checkInAt|checkOutAt|workedMinutes|overtimeMinutes|status
order=asc|desc
```

Rules:

- `date` is mutually exclusive with `dateFrom`/`dateTo`.
- Require `dateFrom <= dateTo`; cap ranges at 366 days.
- Search Employee name or Employee number.
- Employee role is always restricted to own `employeeId`.
- Default sort is `attendanceDate desc, employee lastName asc, employee
  firstName asc, id asc`.
- Return stable pagination with total count.
- List items include all DTO fields except editor email may be omitted if the
  requester lacks global HR access.

### `GET /api/v1/attendance/:id`

- HR roles can read any record.
- Employee can read only own record.
- Return `ATTENDANCE_NOT_FOUND` for missing IDs and the established ownership
  error behavior for another Employee's existing record.

### `GET /api/v1/attendance/me/today`

This static route must be registered before `/:id`.

Return widget state:

```ts
interface AttendanceTodayDto {
  businessDate: string;
  serverNow: string;
  state: 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'CHECKED_OUT' | 'ABSENT';
  attendance: AttendanceDto | null;
  elapsedMinutes: number;
}
```

- `elapsedMinutes` is the floored raw difference between Check In and
  `serverNow` for an open record, or Check In and Check Out for a completed
  record. It is display-only and does not subtract the scheduled break.
- The widget reads net worked time from `attendance.workedMinutes`; do not
  confuse it with raw elapsed time.
- For Absent/no record, elapsed time is zero.
- Response includes `serverNow` so the client can advance a display timer from
  a trusted baseline and periodically refetch.

### `POST /api/v1/attendance/me/check-in`

- Empty body only.
- Resolve linked active Employee, server time, business date, and Schedule
  snapshot.
- Create the row transactionally and return 201.
- Unique `(employeeId, attendanceDate)` prevents duplicate/concurrent Check In.
- If an open record exists, return `ATTENDANCE_ALREADY_CHECKED_IN`.
- If a completed or Absent record exists, return
  `ATTENDANCE_ALREADY_RECORDED`.
- Write `ATTENDANCE_CHECKED_IN` AuditLog in the same transaction.

### `POST /api/v1/attendance/me/check-out`

- Empty body only.
- Find today's own record under transaction/row-safe update logic.
- Require an open worked record.
- Use server time, require the same business date, calculate final status,
  worked minutes, and overtime minutes from its snapshot.
- Return 200 and write `ATTENDANCE_CHECKED_OUT` in the same transaction.
- Repeated Check Out returns `ATTENDANCE_ALREADY_CHECKED_OUT` without mutation.

### `POST /api/v1/attendance`

- HR/Admin only.
- Accept `ManualAttendanceInput`.
- Resolve and persist the Schedule snapshot for the Employee/date.
- Derive all output fields. `ABSENT` is valid only on an expected working day.
- Mark the record manually edited and store current actor/time.
- Return 201 and write `ATTENDANCE_MANUALLY_CREATED` with the supplied business
  reason.

### `PATCH /api/v1/attendance/:id/correction`

- HR/Admin only.
- Accept `AttendanceCorrectionInput`.
- Employee and attendance date are immutable.
- Recalculate status/worked/overtime using the stored Schedule snapshot.
- Set manual editor/time and preserve earlier corrections in AuditLog.
- Return 200 and write `ATTENDANCE_CORRECTED` with safe before/after values and
  the required reason in the same transaction.

No general PUT, status endpoint, or DELETE endpoint is allowed.

## 12. Public Errors

Use the standard response envelope and stable codes:

| HTTP | Code | Meaning |
| ---: | --- | --- |
| 400 | `INVALID_ATTENDANCE_INPUT` | Body/query validation failed |
| 400 | `INVALID_ATTENDANCE_DATE` | Invalid/future business date |
| 400 | `INVALID_ATTENDANCE_TIMES` | Timestamp/order/business-date mismatch |
| 400 | `ABSENT_ON_NON_WORKING_DAY` | Absent used where no work was expected |
| 401 | existing auth code | Not signed in |
| 403 | `ATTENDANCE_ACCESS_DENIED` | Role/ownership denied |
| 403 | `EMPLOYEE_PROFILE_NOT_LINKED` | Self action has no Employee |
| 404 | `ATTENDANCE_NOT_FOUND` | Record does not exist |
| 409 | `ATTENDANCE_ALREADY_CHECKED_IN` | Today's record is already open |
| 409 | `ATTENDANCE_ALREADY_CHECKED_OUT` | Today's record is already complete |
| 409 | `ATTENDANCE_ALREADY_RECORDED` | Another Attendance state exists for date |
| 409 | `ATTENDANCE_DATE_CONFLICT` | Manual/concurrent duplicate Employee/date |
| 422 | `ATTENDANCE_EMPLOYEE_INACTIVE` | Self/manual current action uses inactive Employee |
| 422 | `ATTENDANCE_SCHEDULE_MISSING` | Neither Contract nor Employee resolves a Schedule |
| 422 | `ATTENDANCE_SCHEDULE_INVALID` | Resolved Schedule/snapshot is inconsistent |
| 422 | `ATTENDANCE_OVERNIGHT_UNSUPPORTED` | Automatic Check Out crossed business date |

Map Prisma errors safely. Never expose SQL, constraint names, raw timestamps
from inaccessible records, or stack traces.

## 13. Backend Organization

Create:

```text
apps/api/src/modules/attendance/
  attendance-calculation.ts
  attendance-clock.ts
  attendance.controller.ts
  attendance.mapper.ts
  attendance.routes.ts
  attendance.schemas.ts
  attendance.service.ts
  attendance.types.ts
  index.ts
```

Add tests in:

```text
apps/api/tests/attendance.test.ts
apps/api/tests/attendance-calculation.test.ts
```

Reuse Phase 5 date/Contract helpers where applicable. Do not duplicate
full-period Payroll eligibility logic or make Attendance depend on future
Payrun models.

## 14. Audit Requirements

Required actions:

```text
ATTENDANCE_CHECKED_IN
ATTENDANCE_CHECKED_OUT
ATTENDANCE_MANUALLY_CREATED
ATTENDANCE_CORRECTED
```

Audit payload includes actor User ID, Attendance ID, Employee ID, business
date, action, safe before/after values, correction reason where applicable, and
UTC timestamp. Do not store Employee private/bank data.

Attendance mutation and AuditLog insertion must share one transaction. A
rejected action must not write an audit event.

## 15. Frontend Requirements

Routes:

```text
/attendance
/attendance/new
/attendance/:id
```

Register `/attendance/new` before `/attendance/:id` so `new` is never treated
as a record ID.

### Attendance list

- Replace all sample rows and page-local Attendance interfaces.
- Use shared DTOs and a paginated query.
- Preserve search, Employee, Department, status, flag, date range, sort, and
  page in URL parameters.
- Employee smart-button navigation uses
  `/attendance?employeeId=<employee-id>` and shows a removable filter chip.
- Columns: Employee, Check In, Check Out, Worked Time, Status, Flags.
- Make missing Check Out visually obvious.
- Show loading, API error with Retry, empty dataset, and no-results states.
- New is visible only to HR/Admin roles.
- Rows open `/attendance/:id`.

### Create/detail/correction form

- `/attendance/new` is manual-create mode, not a fake `:id`.
- Create uses a real Employee selector, date, Worked/Absent mode, timestamps,
  and required reason.
- Detail is read-only by default.
- HR/Admin sees Correct; Employee never sees editing controls.
- Employee and date stay read-only during correction.
- Worked time, overtime, status, flags, Schedule, and expected time are
  read-only derived values.
- Save correction calls only the correction endpoint.
- Discard restores the latest server response.
- Mutation errors preserve unsaved values and render field errors nearby.
- No Delete button.

### Attendance Widget

- Keep it available globally, but disable self actions with a clear explanation
  when the User Account is not Employee-linked.
- Opening fetches `/attendance/me/today`.
- Show trusted business date, Check In time, current state, and elapsed time.
- Display Check In only for `NOT_CHECKED_IN` and Check Out only for
  `CHECKED_IN`; completed/Absent states are read-only.
- Disable the action while pending to prevent double submission.
- After success, replace local state from the API response and refetch relevant
  Attendance queries.
- For an open record, advance elapsed display locally from `serverNow`, then
  refetch periodically/on focus. The UI timer is display-only.
- Status indicator becomes green only while checked in.
- API failures keep the previous state and show a retryable message.

### Employee smart button

- Replace the fake count with the real total Attendance count.
- Clicking uses Employee ID, never encoded name.
- Employee profile API may expose `attendanceCount`, or the UI may request a
  count-only filtered Attendance query. Do not load all records to count them.

## 16. Seed Data

Extend the seed after Employees, Schedules, and Contracts.

Create idempotent records covering:

- Present, on-time completed day;
- Late completed day;
- open record with Missing Check-Out;
- completed Overtime day;
- manually created Absent expected day;
- manually corrected worked record;
- multiple Employees and Departments;
- one non-working-day worked record.

Use stable Employee/date unique keys and dates relative to a documented fixed
demo week, not `today`, so reruns remain deterministic. Generate the same
schedule snapshot and calculated values the service would produce; do not
insert inconsistent derived fixtures.

Never seed two records for one Employee/date. Never seed future Attendance.

## 17. Automated Tests

### Calculation tests

- on-time and exact-start Check In are Present;
- one minute after expected start is Late;
- non-working-day Check In is Present;
- completed duration floors partial minutes and subtracts break once;
- duration never becomes negative;
- overtime is daily excess only;
- open records stay at zero persisted worked/overtime minutes;
- flags appear in the locked order;
- calculations are independent of host timezone.

### Persistence and concurrency

- database rejects duplicate Employee/date directly;
- database rejects invalid timestamp order/status shapes/minutes;
- two concurrent Check Ins create one record;
- two concurrent Check Outs cannot overwrite completion;
- schedule snapshot stays unchanged after Schedule or Contract update;
- Attendance cannot be hard-deleted through API.

### API/RBAC

- unauthenticated routes return 401;
- Employee lists/reads only own records;
- HR/Admin roles list/read/create/correct globally;
- unlinked User cannot use widget routes;
- self endpoints ignore/reject Employee identifiers in body;
- inactive Employee cannot Check In;
- missing Schedule and invalid Schedule return typed errors;
- Check In uses injected server clock and derives correct company date/status;
- Check Out derives exact worked/overtime minutes;
- repeat Check In/Out produces safe conflict without mutation;
- manual timestamps require timezone and matching business date;
- Absent on non-working day is rejected;
- manual correction requires reason and writes editor metadata;
- each successful mutation writes one transactional AuditLog;
- rejected mutations write none;
- list filters, flag filters, search, sorting, and pagination are correct.

### Regression

- all Auth, Schedule, Employee, Salary Config, and Contract tests pass;
- Employee smart count and filtered link use real data;
- frontend contains no Attendance sample rows or fake counts.

## 18. Exact Implementation Order

1. Confirm Phases 2, 3, and 5 migrations/tests are merged and passing.
2. Add/validate `COMPANY_TIMEZONE` and implement the tested timezone utility.
3. Add shared Attendance schemas, types, DTOs, and exports.
4. Add Prisma enum/model/relations and generate `phase06_attendance`.
5. Add migration checks and apply to development/test databases.
6. Implement pure calculation, flag, and snapshot mapping helpers with tests.
7. Implement Schedule resolution for a business date using Contract override
   and Employee fallback.
8. Implement list/detail and self-today services.
9. Implement transactional Check In/Out plus concurrency/audit tests.
10. Implement manual create/correction plus RBAC/audit tests.
11. Register static self routes before `/:id` and mount the module.
12. Extend seed data idempotently.
13. Replace Attendance frontend mocks and connect list/detail/create/correction.
14. Connect the navbar widget and trusted elapsed timer behavior.
15. Enable the Employee smart count and filtered link.
16. Run full verification and manual timezone/role checks.
17. Append one Branch Updates tracker entry; do not edit tracker summaries.

## 19. Verification

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

1. Sign in as a linked Employee and Check In from the navbar widget.
2. Refresh/open another page and confirm the open state and elapsed display
   restore from the API.
3. Check Out and verify worked/overtime values persist after refresh.
4. Attempt repeated punches and confirm no duplicate/overwrite occurs.
5. Open the own Attendance list and confirm no other Employee is visible.
6. Sign in as HR Manager, manually create Absent and correct a worked record.
7. Confirm corrected fields, flag, editor, reason-backed audit, and derived
   values are visible after refresh.
8. Open Attendance from an Employee smart button and confirm the visible
   Employee filter and real count.
9. Verify an Employee cannot open another Employee's Attendance or correction
   controls.
10. Verify a Contract Schedule override and Employee Schedule fallback produce
    the expected snapshots.

## 20. Definition of Done

- [ ] Migration, unique key, relations, indexes, and checks apply cleanly.
- [ ] Company timezone and injected server clock control business-date logic.
- [ ] Self Check In/Out is functional, concurrency-safe, and server-timed.
- [ ] Status, worked minutes, overtime, snapshots, and flags are server-derived.
- [ ] Missing Attendance is not converted to Absent.
- [ ] Manual creation/correction is restricted and transactionally audited.
- [ ] Ownership and all five roles follow the authorization matrix.
- [ ] List/detail/create/correction and widget use real APIs with no mocks.
- [ ] Employee Attendance count and filtered navigation use real data/IDs.
- [ ] Seed covers required states without duplicates.
- [ ] Earlier regression tests, typecheck, build, and complete test suite pass.

## 21. Non-Negotiables

- Do not trust client timestamps for widget actions.
- Do not trust client-computed status, duration, overtime, flags, or snapshots.
- Do not use floating-point hours as stored business data.
- Do not create automatic Absent rows for missing Attendance.
- Do not use Time Off as an Attendance status.
- Do not recompute historical expectations from a changed Schedule.
- Do not let Check Out cross the configured business-date boundary.
- Do not permit multiple daily sessions in this phase.
- Do not let Employees create manual records or corrections.
- Do not hard-delete Attendance.
- Do not create Time Off or Payroll models in this phase.
