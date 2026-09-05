# Phase 2 - Working Schedule End-to-End

## Metadata

- **Status:** APPROVED FOR IMPLEMENTATION
- **Target branch:** `feature/phase02-working-schedule`
- **Repository baseline:** `Harshdev` at `f540853`
- **PRD coverage:** A3 Working Schedule Setup; B1 navigation; Complete Flow; Technical Guidelines
- **Depends on:** Phase 0 foundation and Phase 1 authentication/authorization
- **Blocks:** Employee schedule assignment, Contract schedule override, Attendance expectations, payroll eligibility and calculations

## 1. Goal

Replace the static Working Schedule prototype with a real PostgreSQL-backed
feature. Authorized HR users must be able to list, search, create, open, update,
activate, and deactivate Working Schedules. Daily and weekly working minutes
must always be derived by the API from the weekly pattern.

This phase is complete only when the existing `/schedules` UI uses real API
data and contains no `DUMMY_SCHEDULES` or client-authoritative hour totals.

## 2. Source Priority

Resolve conflicts in this order:

1. Attached PeoplePay360 PRD.
2. `context/architecture.md` invariants.
3. `context/project-overview.md` product flow and vocabulary.
4. This feature spec.
5. `context/feature-spec/05-adding_schedule.md` visual guidance.
6. Existing UI prototype.

## 3. Current Repository Baseline

- Prisma currently has only `Role` and `User`.
- Express already has authentication, `authorize(...)`, centralized errors,
  Prisma access, and `/api/v1` routing.
- Shared API/auth contracts already exist in `@peoplepay360/shared`.
- `frontend/src/pages/Schedules.tsx` is a complete visual prototype, but it:
  - reads from `DUMMY_SCHEDULES`;
  - saves only to React state;
  - calculates decimal hours in the browser;
  - uses generated temporary IDs;
  - exposes an unfinished Calendar tab;
  - allows per-schedule timezone editing even though architecture defines one
    company timezone.
- No schedule API, database model, migration, service, or tests exist.

## 4. Scope

### In scope

- Working Schedule and weekly day-pattern persistence.
- List, search, status filter, pagination, detail, create, full update, and
  activate/deactivate operations.
- Server-derived shift and weekly durations using integer minutes.
- Standard, Shift, and Flexible schedule types.
- Same-day and overnight work periods.
- API role authorization.
- Seeded representative schedules.
- TanStack Query and React Hook Form/Zod integration.
- Real `/schedules`, `/schedules/new`, and `/schedules/:id` navigation.
- Removal of Schedule mock data and browser-authoritative calculations.

### Out of scope

- Employee or Contract assignment; those models do not exist yet.
- Attendance or payroll calculations.
- Split shifts or multiple work intervals on the same weekday.
- Date-specific holidays, exceptions, rotations, or schedule versions.
- Calendar/timeline view.
- Multi-company management or a Company model.
- Hard deletion.
- AuditLog implementation. Schedule changes become auditable when the shared
  AuditLog foundation is introduced with Employee/Contract mutations.

## 5. Decisions Locked by This Spec

1. One Working Schedule has zero or one interval for each weekday. A saved
   active schedule must contain at least one day.
2. Weekday is an enum; duplicate weekdays in one schedule are invalid.
3. API input/output time format is exactly 24-hour `HH:mm`.
4. Store start/end as minutes after local midnight, not timestamps.
5. `endMinute > startMinute` is a same-day interval.
6. `endMinute < startMinute` is an overnight interval ending the next day.
7. Equal start/end time is invalid; it is not interpreted as a 24-hour shift.
8. Break minutes are part of the interval and must be less than its duration.
9. A net working interval may not exceed 16 hours.
10. `dailyMinutes = intervalDuration - breakMinutes`.
11. `weeklyMinutes = sum(dailyMinutes)`; `daysPerWeek = number of day rows`.
12. Daily/weekly totals are returned by the API but never stored or accepted as
    input.
13. Schedule timezone is the single validated `COMPANY_TIMEZONE` environment
    value. It is returned read-only and is not stored per schedule.
14. `companyName` is display metadata on the Schedule for the current single
    company. It does not introduce a Company relation or multi-company logic.
15. Schedule history is preserved by `ACTIVE`/`INACTIVE`; there is no DELETE.
16. Updating a schedule replaces its complete weekly day pattern in one
    database transaction.
17. Schedule names are unique case-insensitively after trimming. Enforce this
    through normalized `nameKey`, not PostgreSQL `citext`.
18. List ordering is name ascending, then ID ascending for stable pagination.

## 6. Prisma Data Model

Append these enums/models to `apps/api/prisma/schema.prisma`:

```prisma
enum WorkingScheduleType {
  STANDARD
  SHIFT
  FLEXIBLE
}

enum WorkingScheduleStatus {
  ACTIVE
  INACTIVE
}

enum Weekday {
  MONDAY
  TUESDAY
  WEDNESDAY
  THURSDAY
  FRIDAY
  SATURDAY
  SUNDAY
}

model WorkingSchedule {
  id          String                @id @default(uuid())
  name        String
  nameKey     String                @unique
  type        WorkingScheduleType   @default(STANDARD)
  companyName String
  status      WorkingScheduleStatus @default(ACTIVE)
  days        WorkingScheduleDay[]
  createdAt   DateTime              @default(now()) @db.Timestamptz(3)
  updatedAt   DateTime              @updatedAt @db.Timestamptz(3)

  @@index([status])
  @@index([type])
}

model WorkingScheduleDay {
  id            String          @id @default(uuid())
  scheduleId    String
  dayOfWeek     Weekday
  startMinute   Int
  endMinute     Int
  breakMinutes  Int             @default(0)
  schedule      WorkingSchedule @relation(fields: [scheduleId], references: [id], onDelete: Cascade)

  @@unique([scheduleId, dayOfWeek])
  @@index([scheduleId])
}
```

Create one migration named:

```text
phase02_working_schedules
```

After Prisma generates the migration, add SQL checks so invalid data cannot be
inserted outside the service:

```sql
ALTER TABLE "WorkingScheduleDay"
  ADD CONSTRAINT "WorkingScheduleDay_startMinute_check"
  CHECK ("startMinute" >= 0 AND "startMinute" <= 1439),
  ADD CONSTRAINT "WorkingScheduleDay_endMinute_check"
  CHECK ("endMinute" >= 0 AND "endMinute" <= 1439),
  ADD CONSTRAINT "WorkingScheduleDay_start_end_different_check"
  CHECK ("startMinute" <> "endMinute"),
  ADD CONSTRAINT "WorkingScheduleDay_breakMinutes_check"
  CHECK ("breakMinutes" >= 0 AND "breakMinutes" <= 720);
```

The service still validates break versus shift duration and the 16-hour limit;
those rules depend on overnight-duration calculation and must not rely only on
the basic SQL checks.

## 7. Shared Contracts

Create `packages/shared/src/types/schedules.ts` and export it from
`packages/shared/src/index.ts`.

Required values:

```ts
export const WorkingScheduleTypeValues = ['STANDARD', 'SHIFT', 'FLEXIBLE'] as const;
export const WorkingScheduleStatusValues = ['ACTIVE', 'INACTIVE'] as const;
export const WeekdayValues = [
  'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY',
  'FRIDAY', 'SATURDAY', 'SUNDAY',
] as const;
```

Input shape:

```ts
interface WorkingScheduleDayInput {
  dayOfWeek: Weekday;
  startTime: string;       // HH:mm
  endTime: string;         // HH:mm
  breakMinutes: number;    // integer
}

interface WorkingScheduleInput {
  name: string;
  type: WorkingScheduleType;
  companyName: string;
  status: WorkingScheduleStatus;
  days: WorkingScheduleDayInput[];
}
```

Response shape:

```ts
interface WorkingScheduleDayDto extends WorkingScheduleDayInput {
  id: string;
  dailyMinutes: number;
  overnight: boolean;
}

interface WorkingScheduleDto {
  id: string;
  name: string;
  type: WorkingScheduleType;
  companyName: string;
  timezone: string;
  status: WorkingScheduleStatus;
  days: WorkingScheduleDayDto[];
  daysPerWeek: number;
  weeklyMinutes: number;
  createdAt: string;
  updatedAt: string;
}
```

Also export Zod schemas for create/update input and list query. Backend and
frontend must import the shared schemas; do not define independent validation
copies.

Validation:

- `name`: trimmed, 2-100 characters.
- `companyName`: trimmed, 2-120 characters.
- `type` and `status`: exact enum values.
- `days`: 1-7 entries when status is ACTIVE; INACTIVE may still not be created
  with an empty pattern, so create/update always require 1-7 entries.
- unique `dayOfWeek` values.
- `startTime`/`endTime`: strict valid `HH:mm` from `00:00` through `23:59`.
- `breakMinutes`: integer 0-720.
- derived net interval: greater than 0 and no more than 960 minutes.

## 8. API Contract

All routes require `authenticate`.

Allowed roles for every Schedule route:

```text
HR_MANAGER
HR_PAYROLL_USER
HR_PAYROLL_MANAGER
ADMIN
```

`EMPLOYEE` receives `403 FORBIDDEN` for both reads and mutations. Employees will
later receive their own resolved schedule through the Employee profile API, not
through the global configuration module.

### GET `/api/v1/schedules`

Query:

```text
search?: string, trimmed, max 100
status?: ACTIVE | INACTIVE
type?: STANDARD | SHIFT | FLEXIBLE
page?: integer >= 1, default 1
pageSize?: integer 1-100, default 20
```

Response `200`:

```json
{
  "data": {
    "items": [],
    "page": 1,
    "pageSize": 20,
    "total": 0
  },
  "error": null
}
```

Search matches `name` or `companyName`, case-insensitively.

### GET `/api/v1/schedules/:id`

- `200`: `WorkingScheduleDto`.
- `404 SCHEDULE_NOT_FOUND`: `Working schedule not found`.

### POST `/api/v1/schedules`

- Body: `WorkingScheduleInput`.
- `201`: created `WorkingScheduleDto`.
- `400 VALIDATION_ERROR`: shared input validation failed.
- `409 SCHEDULE_NAME_EXISTS`: normalized name already exists.

### PUT `/api/v1/schedules/:id`

- Body: complete `WorkingScheduleInput`; this is not a partial patch.
- Replace the parent fields and all day rows in one Prisma transaction.
- `200`: updated `WorkingScheduleDto`.
- `400 VALIDATION_ERROR`.
- `404 SCHEDULE_NOT_FOUND`.
- `409 SCHEDULE_NAME_EXISTS`.

### PATCH `/api/v1/schedules/:id/status`

Body:

```json
{ "status": "ACTIVE" }
```

- `200`: updated `WorkingScheduleDto`.
- `404 SCHEDULE_NOT_FOUND`.
- Reactivation is allowed only when at least one valid day row exists.

No DELETE route is allowed.

## 9. Error Details

Use the existing `AppError` and centralized response envelope. Validation errors
must include field-addressable details. Use these codes exactly:

| Code | HTTP | Meaning |
| --- | ---: | --- |
| `VALIDATION_ERROR` | 400 | Invalid query/body/path input |
| `UNAUTHENTICATED` | 401 | Missing/invalid session |
| `FORBIDDEN` | 403 | Role cannot access Schedule configuration |
| `SCHEDULE_NOT_FOUND` | 404 | ID does not exist |
| `SCHEDULE_NAME_EXISTS` | 409 | Normalized name collision |

Do not expose raw Prisma errors. Translate Prisma unique violations to the
specified conflict code.

## 10. Backend File Structure

Create:

```text
apps/api/src/modules/schedules/
  schedules.schemas.ts
  schedules.service.ts
  schedules.controller.ts
  schedules.routes.ts
  schedule-time.ts
```

Responsibilities:

- `schedule-time.ts`: pure `HH:mm` conversion, overnight duration, validation,
  and derived-minute helpers; no Express/Prisma imports.
- `schedules.schemas.ts`: import/re-export or narrowly wrap shared Zod schemas
  for path handling.
- `schedules.service.ts`: normalization, Prisma queries/transactions, DTO
  mapping, conflict translation, and authoritative derived totals.
- `schedules.controller.ts`: parse request, call service, return envelope.
- `schedules.routes.ts`: authentication and explicit role authorization.

Mount once in `apps/api/src/routes/index.ts`:

```ts
apiRouter.use('/schedules', schedulesRouter);
```

No business rule or Prisma query belongs in controllers/routes.

## 11. Seed Data

Extend `apps/api/prisma/seed.ts` idempotently with:

1. `40 Hours / Week`
   - STANDARD, ACTIVE, Monday-Friday
   - 09:00-18:00, 60-minute break
   - expected weekly result: 2,400 minutes
2. `Night Shift`
   - SHIFT, ACTIVE, Monday-Friday
   - 22:00-06:00, no break
   - expected weekly result: 2,400 minutes

Use `nameKey` for upsert identity. Do not delete user seed records.

## 12. Frontend Implementation

Install in the `frontend` workspace if absent:

```text
@tanstack/react-query
react-hook-form
@hookform/resolvers
zod
```

Add one `QueryClientProvider` in `frontend/src/main.tsx`.

Create:

```text
frontend/src/features/schedules/schedules.api.ts
frontend/src/features/schedules/schedules.queries.ts
```

- API module calls the existing `fetchApi` wrapper.
- Query module owns list/detail queries and create/update/status mutations.
- Mutations invalidate schedule list/detail keys as appropriate.

Refactor `frontend/src/pages/Schedules.tsx` instead of replacing its visual
design wholesale:

- Remove `DUMMY_SCHEDULES`, local persisted schedule array, temporary IDs, and
  `calculateDayHours`/`calculateTotalHours` as authoritative logic.
- Display `dailyMinutes` and `weeklyMinutes` returned by the API.
- The form may show a live preview using the same shared helper/schema, but the
  saved/list/detail values must always come from the API response.
- Use React Hook Form with the shared Zod schema and `useFieldArray` for days.
- Break input is integer minutes, labeled `Break (minutes)`, not decimal hours.
- Add Schedule Type select: Standard, Shift, Flexible.
- Show company timezone as read-only `Asia/Kolkata`/API-returned value.
- Keep Company Name editable as display metadata.
- Status maps `ACTIVE -> Active`, `INACTIVE -> Inactive`.
- Weekday labels are title-cased in Monday-Sunday order.
- Add Day must offer only weekdays not already present; disable it at seven.
- Save button is disabled while invalid or submitting.
- Display server field errors beside relevant controls.
- Remove/hide the Calendar tab; it is not part of the PRD MVP.

Routes:

```text
/schedules       -> list
/schedules/new   -> create form
/schedules/:id   -> edit form
```

All three frontend routes must allow only the same four HR/Admin roles as the
API. Do not rely on route visibility as authorization.

Required UI states:

- Initial list loading skeleton/spinner.
- Empty list: `No working schedules have been created.`
- Search with no results: `No schedules match your filters.`
- Load failure with Retry.
- Detail not found message with Back to list.
- Submit loading state.
- Successful create/update returns to list and refreshes it.
- Failed mutation keeps entered form values and shows the error.

## 13. Automated Tests

### Pure time-helper tests

- 09:00-18:00 with 60-minute break = 480 minutes.
- 22:00-06:00 with no break = 480 minutes and `overnight=true`.
- equal start/end rejected.
- invalid `HH:mm` rejected.
- break equal to/exceeding interval rejected.
- net duration over 16 hours rejected.
- weekly total sums integer minutes exactly.

### API/PostgreSQL integration tests

- unauthenticated request returns 401.
- Employee role returns 403.
- each of the four allowed roles can list.
- Admin/HR creates a valid schedule and receives derived totals.
- invalid/duplicate weekdays return 400.
- invalid time/break/duration return 400.
- normalized duplicate name returns 409.
- list search/status/type/pagination return correct metadata/order.
- detail returns ordered days and derived values.
- update replaces all day rows atomically.
- failed update leaves original parent/days unchanged.
- deactivate/reactivate works; no hard delete endpoint exists.
- direct database constraint rejects duplicate weekday and invalid minute range.
- seeded overnight schedule derives 2,400 weekly minutes.

Tests use dedicated PostgreSQL through the existing Vitest setup; do not mock
Prisma for persistence/integrity tests.

## 14. Exact Implementation Order

1. Add shared Schedule values, schemas, DTOs, and exports; typecheck shared.
2. Add Prisma enums/models.
3. Create `phase02_working_schedules` migration with SQL checks.
4. Apply migration to development and test databases; generate Prisma client.
5. Implement/test `schedule-time.ts` pure helpers.
6. Implement Schedule service and DTO mapper.
7. Implement controllers/routes and mount the router.
8. Add API integration tests and make the backend suite pass.
9. Extend seed and verify both representative schedules.
10. Install frontend data/form dependencies and add QueryClientProvider.
11. Add Schedule API/query modules.
12. Refactor Schedule list to real queries.
13. Refactor create/edit form to routes, RHF/Zod, and mutations.
14. Remove Calendar scaffold and all Schedule mock data.
15. Run full verification and manually complete create/edit/deactivate/search.
16. Append one Branch Updates entry to `context/progress-tracker.md`; do not edit
    its summary sections on the feature branch.

## 15. Verification Commands

Run from repository root:

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

1. Sign in as Admin.
2. Open `/schedules`; confirm seeded Standard and Night schedules come from API.
3. Search for `Night`; confirm one result and 40.0 displayed hours/week.
4. Create a Flexible weekend schedule and save.
5. Reopen it via `/schedules/:id`, change a day, save, and confirm totals update.
6. Deactivate it and confirm status filtering.
7. Sign in as Employee and confirm Schedule configuration returns 403/is hidden.
8. Restart the API and confirm saved data persists.

## 16. Definition of Done

- [ ] Prisma migration applies cleanly to development and test PostgreSQL.
- [ ] Shared types/schemas are used by API and frontend.
- [ ] All Schedule routes implement the exact contract and RBAC matrix.
- [ ] Server returns authoritative derived integer-minute totals.
- [ ] Same-day and overnight schedules work.
- [ ] Database and service constraints reject invalid records.
- [ ] Existing Schedule UI is connected to PostgreSQL.
- [ ] `DUMMY_SCHEDULES` and local-only saving are removed.
- [ ] Calendar scaffold is removed/deferred.
- [ ] Seed contains Standard and Night examples.
- [ ] Typecheck, build, and all tests pass.
- [ ] Manual verification passes.
- [ ] Progress tracker receives only the permitted append-only branch entry.

## 17. Explicit Non-Negotiables

- Do not create Employee, Contract, Attendance, Time Off, or Payroll models.
- Do not store calculated daily/weekly hours.
- Do not accept calculated totals from the client.
- Do not use floating-point hours as persistence values.
- Do not add a Company model or per-Schedule timezone.
- Do not implement a Calendar view.
- Do not add DELETE or hard-delete schedules.
- Do not weaken API authorization because the frontend hides the page.
- Do not modify unrelated mock screens.
