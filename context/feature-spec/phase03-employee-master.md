# Phase 3 - Employee Master End-to-End

## Metadata

- **Status:** APPROVED FOR IMPLEMENTATION
- **Target branch:** `feature/phase03-employee-master`
- **Assumed baseline:** Phase 2 Working Schedule is merged and verified
- **PRD coverage:** A1 Employee Master Management; B1 Main Navigation and Employee Views; B2 Employee Form and Related Record Navigation; User Roles; Complete Flow
- **Depends on:** Phase 1 authentication/RBAC and Phase 2 Working Schedule
- **Blocks:** User Management linkage, Contracts, Attendance, Time Off, Payrun eligibility, and Dashboard headcount filters

## 1. Goal

Replace the static Employee prototype with a real Employee Master backed by
PostgreSQL. Authorized HR users must be able to create, list, search, filter,
open, update, activate, and deactivate Employees. Employee users must be able
to read only their own Employee record through the existing User-to-Employee
link.

This phase also introduces Department reference data and converts the temporary
`User.employeeId` string into a real optional one-to-one foreign key.

## 2. Source Priority

Resolve conflicts in this order:

1. Attached PeoplePay360 PRD.
2. `context/architecture.md` invariants.
3. `context/project-overview.md` vocabulary and product flow.
4. This feature spec.
5. `context/feature-spec/03_adding_employee_ui.md` visual guidance.
6. Existing Employee UI prototype.

## 3. Current Repository Baseline

- `User.employeeId` is nullable and unique but has no foreign key.
- The development seed writes placeholder `emp_dev_001` into the Employee-role
  User Account.
- Auth tests create Users with placeholder Employee IDs.
- Phase 2 provides real Working Schedules and schedule list/detail APIs.
- `frontend/src/pages/Employees.tsx` reads `mockEmployees` and keeps the selected
  Employee in local state instead of using `/employees/:id`.
- `EmployeeProfile.tsx` does not persist changes and contains mock private data
  and hardcoded smart-button counts.
- Department, Employee, Employee API, and Employee tests do not exist.

## 4. Scope

### In scope

- Department persistence and minimal reference-data APIs.
- Employee work identity, contact, reporting relationship, employment type,
  Department, default Working Schedule, status, private contact information,
  and optional bank details.
- Employee list/search/filter/sort/pagination.
- Employee create/detail/full update/status operations.
- Real User-to-Employee one-to-one foreign key.
- Record-level Employee ownership enforcement.
- Kanban and List views backed by the same API dataset.
- Real `/employees/new` and `/employees/:id` profile routes.
- Removal of Employee and private-information mock data.
- Idempotent representative Department/Employee seed data.

### Out of scope

- Admin User Management UI/API. Existing auth User records are only relinked to
  real Employees in the seed.
- Department management page; only APIs and Employee-form selectors are built.
- Contracts, Attendance, Time Off, Allocations, or payroll models.
- Smart-button counts from domains that do not yet exist.
- Employee photos/file uploads; initials remain the avatar.
- Employee bulk actions/import/export.
- Organizational charts.
- User invitations, password reset, or Employee self-registration.
- Hard deletion.

## 5. Decisions Locked by This Spec

1. `User Account` and `Employee` remain separate records.
2. One User may link to zero or one Employee; one Employee may link to zero or
   one User.
3. A User can still exist without an Employee link for Admin/system access.
4. Employee names are stored as `firstName` and `lastName`; `fullName` is derived
   in API responses and never persisted.
5. Employee Number is required, supplied by HR, trimmed, uppercased, and unique.
6. Work email is required, trimmed, lowercased, and unique.
7. Employee status values are only `ACTIVE` and `INACTIVE`. `On Leave` is not an
   Employee status; approved Time Off represents leave later.
8. Employee Types are `FULL_TIME`, `PART_TIME`, `CONTRACT`, and `INTERN`, matching
   the PRD Dashboard filter requirement.
9. An ACTIVE Employee must reference an ACTIVE Department and ACTIVE Working
   Schedule. The database fields remain nullable to permit controlled migration
   and inactive historical records; the service enforces this rule.
10. An INACTIVE Employee may retain existing Department, Schedule, manager, and
    User links for history.
11. Manager is an optional self-reference to another Employee.
12. An Employee cannot manage themselves, and manager relationships cannot form
    a cycle.
13. A manager may be inactive historically, but assigning/changing a manager
    requires the selected manager to be ACTIVE.
14. Department and Employee records are never hard-deleted. Status changes are
    explicit.
15. Deactivating a Department is blocked while ACTIVE Employees reference it.
16. Deactivating a Working Schedule remains owned by Phase 2; Employee update
    cannot assign an inactive Schedule.
17. Company is single-system configuration. Add `COMPANY_NAME` to validated
    environment configuration and return it read-only; do not store it per
    Employee and do not create a Company model.
18. Bank fields are optional in Employee Master. Missing details will later
    create payroll warnings; this phase does not generate payroll warnings.
19. Employee list responses never include private or bank fields.
20. Full Employee detail may include private/bank fields only for the Employee
    themselves or an authorized HR/Admin role.
21. Existing invalid placeholder `User.employeeId` values are cleared during
    migration before the foreign key is added. The updated seed creates real
    Employees first and relinks the Employee User.
22. Smart buttons are hidden or disabled with an explicit `Not available yet`
    state until their backing domains exist. Do not display hardcoded counts.

## 6. Prisma Data Model

Add:

```prisma
enum RecordStatus {
  ACTIVE
  INACTIVE
}

enum EmployeeType {
  FULL_TIME
  PART_TIME
  CONTRACT
  INTERN
}

model Department {
  id        String       @id @default(uuid())
  name      String
  nameKey   String       @unique
  status    RecordStatus @default(ACTIVE)
  employees Employee[]
  createdAt DateTime     @default(now()) @db.Timestamptz(3)
  updatedAt DateTime     @updatedAt @db.Timestamptz(3)

  @@index([status])
}

model Employee {
  id                    String          @id @default(uuid())
  employeeNumber        String          @unique
  firstName             String
  lastName              String
  workEmail             String          @unique
  workPhone             String?
  jobPosition           String
  employeeType          EmployeeType
  status                RecordStatus    @default(ACTIVE)
  workLocation          String?
  departmentId          String?
  managerId             String?
  workingScheduleId     String?
  personalEmail         String?
  personalPhone         String?
  dateOfBirth           DateTime?       @db.Date
  personalAddress       String?
  emergencyContactName  String?
  emergencyContactPhone String?
  bankAccountName       String?
  bankAccountNumber     String?
  bankName              String?
  bankIfsc              String?
  createdAt             DateTime        @default(now()) @db.Timestamptz(3)
  updatedAt             DateTime        @updatedAt @db.Timestamptz(3)

  department      Department?       @relation(fields: [departmentId], references: [id], onDelete: Restrict)
  manager         Employee?         @relation("EmployeeManager", fields: [managerId], references: [id], onDelete: Restrict)
  directReports   Employee[]        @relation("EmployeeManager")
  workingSchedule WorkingSchedule?  @relation(fields: [workingScheduleId], references: [id], onDelete: Restrict)
  user             User?

  @@index([departmentId])
  @@index([managerId])
  @@index([workingScheduleId])
  @@index([status])
  @@index([employeeType])
  @@index([lastName, firstName, id])
}
```

Update existing models:

```prisma
model User {
  // retain all existing fields
  employeeId String?   @unique
  employee   Employee? @relation(fields: [employeeId], references: [id], onDelete: SetNull)
}

model WorkingSchedule {
  // retain Phase 2 fields/relations
  employees Employee[]
}
```

Create migration:

```text
phase03_employee_master
```

Before adding the User foreign key, the generated migration must include:

```sql
UPDATE "User" SET "employeeId" = NULL WHERE "employeeId" IS NOT NULL;
```

Then add the foreign key with `ON DELETE SET NULL ON UPDATE CASCADE`. This is an
intentional cleanup of Phase 1 placeholder identifiers, not silent production
data deletion. The project has no real Employee records before this migration.

Add database checks:

- trimmed names/job position cannot be empty;
- `employeeNumber` equals trimmed uppercase value;
- `workEmail` equals trimmed lowercase value;
- optional email/phone/text values cannot be an empty string; use `NULL` instead.

Case-insensitive Department uniqueness uses normalized `nameKey`. Do not add
`citext`.

## 7. Shared Contracts and Validation

Create `packages/shared/src/types/employees.ts` and export it from the shared
barrel.

Required value sets:

```ts
export const RecordStatusValues = ['ACTIVE', 'INACTIVE'] as const;
export const EmployeeTypeValues = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'] as const;
```

Employee write input:

```ts
interface EmployeeInput {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  workPhone: string | null;
  jobPosition: string;
  employeeType: EmployeeType;
  status: RecordStatus;
  workLocation: string | null;
  departmentId: string | null;
  managerId: string | null;
  workingScheduleId: string | null;
  personalEmail: string | null;
  personalPhone: string | null;
  dateOfBirth: string | null; // YYYY-MM-DD
  personalAddress: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  bankIfsc: string | null;
}
```

List item DTO contains only:

```ts
interface EmployeeListItemDto {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  initials: string;
  workEmail: string;
  jobPosition: string;
  employeeType: EmployeeType;
  status: RecordStatus;
  workLocation: string | null;
  department: { id: string; name: string } | null;
  manager: { id: string; fullName: string } | null;
  workingSchedule: {
    id: string;
    name: string;
    weeklyMinutes: number;
  } | null;
}
```

Detail DTO extends the list item with work phone, private fields, bank fields,
read-only `companyName`, linked User summary (`id`, `email`, `role`, `isActive`)
or null, and created/updated timestamps. Never include `passwordHash`.

Validation rules:

- Employee Number: trimmed uppercase, 2-30 characters, pattern
  `^[A-Z0-9][A-Z0-9_-]*$`.
- First/last name: trimmed, 1-80 characters each.
- Work email: trimmed lowercase valid email, max 254.
- Optional personal email: valid email when present.
- Job position: trimmed, 2-120 characters.
- Work location/address/name fields: trimmed with explicit maximums; empty
  strings normalize to null.
- Phones: 7-20 characters, allow digits, spaces, `+`, `-`, and parentheses.
- Date of birth: strict `YYYY-MM-DD`, valid date, earlier than current company
  date; no age/employment eligibility rule is introduced.
- Bank IFSC: optional trimmed uppercase, `^[A-Z]{4}0[A-Z0-9]{6}$` when present.
- Bank account number: optional 4-34 alphanumeric characters; never coerce to a
  number or remove leading zeroes.
- ACTIVE Employee requires non-null Department and Working Schedule.
- Create/update schemas are shared by frontend and backend.

Department input:

- name: trimmed 2-100 characters;
- status: ACTIVE or INACTIVE.

## 8. Authorization Matrix

| Action | Employee | HR Manager | HR Payroll User | HR Payroll Manager | Admin |
| --- | --- | --- | --- | --- | --- |
| Global Employee list/filter | Deny | Allow | Allow | Allow | Allow |
| Read Employee detail | Own only | All | All | All | All |
| Create Employee | Deny | Allow | Allow | Allow | Allow |
| Update Employee | Deny | Allow | Allow | Allow | Allow |
| Activate/deactivate Employee | Deny | Allow | Allow | Allow | Allow |
| List Departments/Schedules for form | Deny globally | Allow | Allow | Allow | Allow |
| Manage Departments | Deny | Allow | Allow | Allow | Allow |

Employee ownership must use the database-authoritative `req.user.employeeId`
loaded by `authenticate`; never trust an Employee ID sent by the client.

An Employee User requesting another Employee ID receives `403 FORBIDDEN`, not
`404`, because the record exists but is not authorized. An unlinked Employee
User receives `403 EMPLOYEE_PROFILE_NOT_LINKED` for profile access.

## 9. API Contract - Departments

Every route uses `authenticate` and explicit allowed-role authorization.

### GET `/api/v1/departments`

Query:

```text
search?: trimmed string <= 100
status?: ACTIVE | INACTIVE
```

Return all matching Departments ordered by name, then ID. No pagination is
needed for this reference selector in the MVP.

### POST `/api/v1/departments`

- Body: `{ name, status }`.
- `201`: created Department.
- `409 DEPARTMENT_NAME_EXISTS` on normalized-name collision.

### PUT `/api/v1/departments/:id`

- Complete body `{ name, status }`.
- `200`: updated Department.
- `404 DEPARTMENT_NOT_FOUND`.
- `409 DEPARTMENT_NAME_EXISTS`.
- `409 DEPARTMENT_IN_USE` if changing ACTIVE to INACTIVE while ACTIVE Employees
  reference it.

There is no DELETE route.

## 10. API Contract - Employees

### GET `/api/v1/employees`

Allowed only for the four HR/Admin roles.

Query:

```text
search?: matches number, full name, work email, job position; max 100
status?: ACTIVE | INACTIVE
employeeType?: FULL_TIME | PART_TIME | CONTRACT | INTERN
departmentId?: UUID
managerId?: UUID
workingScheduleId?: UUID
sortBy?: name | employeeNumber | createdAt; default name
sortOrder?: asc | desc; default asc
page?: integer >= 1; default 1
pageSize?: integer 1-100; default 20
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

Kanban and List consume this same response. No separate Kanban endpoint.

### GET `/api/v1/employees/me`

Allowed for every authenticated role with a linked Employee. It resolves the
Employee exclusively from `req.user.employeeId`; there is no request-supplied
Employee ID.

- `200`: full Employee detail.
- `403 EMPLOYEE_PROFILE_NOT_LINKED` if the User has no link.

Declare `/me` before `/:id` in the router.

### GET `/api/v1/employees/:id`

- Employee role: own ID only.
- HR/Admin roles: any ID.
- `200`: full Employee detail.
- `403 FORBIDDEN` for another Employee's record.
- `404 EMPLOYEE_NOT_FOUND` for an authorized requester when ID is absent.

### POST `/api/v1/employees`

- Allowed for HR/Admin roles.
- Body: complete `EmployeeInput`.
- `201`: full Employee detail.
- Validate referenced Department/Schedule/manager inside the service.
- Errors include duplicate number/email and inactive/missing references.

### PUT `/api/v1/employees/:id`

- Allowed for HR/Admin roles.
- Complete replacement body; no partial updates.
- `200`: updated detail.
- Re-check manager cycle, active Department/Schedule, normalized uniqueness, and
  current database state in the transaction.

### PATCH `/api/v1/employees/:id/status`

Body: `{ "status": "ACTIVE" | "INACTIVE" }`.

- Reactivation requires valid ACTIVE Department and Working Schedule.
- Deactivation preserves all relations and does not deactivate the User Account.
  Account status remains an Admin User Management responsibility.
- `200`: updated detail.

There is no Employee DELETE route.

## 11. Error Contract

Use `AppError` and the existing `{ data, error }` envelope.

| Code | HTTP | Meaning |
| --- | ---: | --- |
| `VALIDATION_ERROR` | 400 | Invalid path/query/body |
| `UNAUTHENTICATED` | 401 | Missing/invalid session |
| `FORBIDDEN` | 403 | Role/ownership denied |
| `EMPLOYEE_PROFILE_NOT_LINKED` | 403 | User has no Employee relation |
| `DEPARTMENT_NOT_FOUND` | 404 | Department ID absent |
| `EMPLOYEE_NOT_FOUND` | 404 | Employee ID absent |
| `SCHEDULE_NOT_FOUND` | 404 | Schedule ID absent |
| `MANAGER_NOT_FOUND` | 404 | Manager ID absent |
| `EMPLOYEE_NUMBER_EXISTS` | 409 | Duplicate normalized Employee Number |
| `EMPLOYEE_EMAIL_EXISTS` | 409 | Duplicate normalized work email |
| `DEPARTMENT_NAME_EXISTS` | 409 | Duplicate normalized Department name |
| `DEPARTMENT_IN_USE` | 409 | Active Employees block deactivation |
| `INACTIVE_DEPARTMENT` | 409 | Cannot assign to ACTIVE Employee |
| `INACTIVE_SCHEDULE` | 409 | Cannot assign to ACTIVE Employee |
| `INACTIVE_MANAGER` | 409 | Cannot assign new inactive manager |
| `INVALID_MANAGER_RELATIONSHIP` | 409 | Self-manager or cycle |

Translate Prisma constraint errors; never expose raw database errors.

## 12. Backend Structure

Create:

```text
apps/api/src/modules/departments/
  departments.controller.ts
  departments.routes.ts
  departments.service.ts

apps/api/src/modules/employees/
  employees.controller.ts
  employees.routes.ts
  employees.service.ts
  employee-mapper.ts
  manager-cycle.ts
```

Use shared Zod schemas directly or through thin backend wrappers. Controllers
only parse, call services, and return responses. Services own normalization,
relations, transactions, conflict translation, and business validation.

Mount:

```ts
apiRouter.use('/departments', departmentsRouter);
apiRouter.use('/employees', employeesRouter);
```

## 13. Migration, Seed, and Existing Auth Tests

### Seed order

1. Upsert Working Schedules from Phase 2.
2. Upsert Departments: Finance, HR, Engineering, Operations.
3. Upsert representative Employees by Employee Number.
4. Add manager links only after all Employees exist.
5. Upsert User Accounts and link the Employee-role User to its real Employee ID.

Seed at least the four existing UI examples, but convert Neha Patel from mock
`On Leave` to ACTIVE; Time Off will later represent absence.

### Auth-test migration

Update auth integration setup so it no longer inserts fake Employee IDs. Create
the minimum Department, Working Schedule, and Employee fixture, link the test
Employee User to that real Employee, and clean up in foreign-key-safe order.
Pure `canAccessEmployee` unit cases may continue to use string fixture IDs.

Do not weaken or remove any Phase 1 auth assertion.

## 14. Frontend Implementation

Assume Phase 2 already installed TanStack Query, React Hook Form, resolvers, and
Zod. Reuse the same QueryClient and API wrapper.

Create:

```text
frontend/src/features/departments/departments.api.ts
frontend/src/features/departments/departments.queries.ts
frontend/src/features/employees/employees.api.ts
frontend/src/features/employees/employees.queries.ts
```

Refactor the existing Employee components rather than discarding their styling.

Routes:

```text
/employees       -> Kanban/List
/employees/new   -> create form
/employees/:id   -> detail/edit form
```

Route permissions:

- `/employees`: HR Manager, HR Payroll User, HR Payroll Manager, Admin.
- `/employees/new`: same four roles.
- `/employees/:id`: same four roles, plus Employee only when ID is their own.
- After Employee login, default Employee navigation should use `/employees/me`
  or redirect to the resolved own profile; never expose the global list.

List/Kanban requirements:

- Remove `mockEmployees` and the page-local Employee interface.
- Use shared DTOs and one paginated Employee query.
- Preserve search, status, Department, Employee Type, sort, page, and view in
  URL query parameters so switching Kanban/List does not lose state.
- Kanban/List row/card opens `/employees/:id` by ID.
- Show status as Active/Inactive only.
- Use API-provided initials/full name/relationship display values.
- Provide loading, API error with Retry, empty dataset, and no-filter-results
  states.

Employee form requirements:

- Use React Hook Form with the shared Employee schema.
- Create mode posts to API and navigates to the created `/employees/:id`.
- Detail starts read-only; Edit switches to inputs; Save uses full PUT; Discard
  restores the last server response.
- Department, manager, and Working Schedule are searchable selectors using real
  IDs, never free text.
- Manager choices exclude the current Employee.
- Company is read-only from `companyName`.
- Work Information fields cover every required work field.
- Private Information fields use real private/bank values; remove all mock text.
- Server field errors appear beside corresponding inputs.
- Mutation failure preserves unsaved values.
- Status change requires confirmation and uses the status endpoint.
- Smart buttons must not show fake `3`, `2`, or `14` counts. Hide them until the
  related modules are implemented, or show disabled zero-state buttons labeled
  `Available after <module>`.
- Future related links must use `employeeId`, not encoded Employee name.

## 15. Automated Tests

### Department/API tests

- allowed roles can list/manage; Employee role denied.
- normalized duplicate name rejected.
- inactive Department excluded/included correctly by filter.
- Department with active Employees cannot be deactivated.
- no DELETE route.

### Employee/API tests

- unauthenticated access returns 401.
- Employee cannot access global list or mutations.
- Employee can read own detail and `/me`.
- Employee cannot read another Employee.
- unlinked User receives `EMPLOYEE_PROFILE_NOT_LINKED`.
- all four HR/Admin roles can list/create/update/status-change.
- active Employee requires active Department and Schedule.
- duplicate number and case-insensitive work email return correct conflicts.
- list search/filter/sort/pagination is stable and excludes private/bank fields.
- detail returns relations/private fields but never `passwordHash`.
- self-manager and direct/indirect manager cycles are rejected.
- assigning inactive manager is rejected.
- full update and status operations preserve history/relations.
- reactivation validates Department and Schedule again.
- invalid dates, phones, email, IFSC, and empty normalized fields are rejected.
- `User.employeeId` foreign key rejects nonexistent Employee IDs.
- Employee cannot be hard-deleted through API.

### Regression tests

- all existing auth tests still pass with real Employee fixtures.
- session principal returns the linked real Employee ID.
- Phase 2 Working Schedule tests remain unchanged and pass.

## 16. Exact Implementation Order

1. Confirm Phase 2 migration/tests are merged and passing.
2. Add `COMPANY_NAME` to `.env.example` and validated environment config.
3. Add shared Department/Employee enums, schemas, DTOs, and exports.
4. Add Prisma models/relations.
5. Generate `phase03_employee_master`; add placeholder cleanup, FK, and checks.
6. Apply migration to development/test databases; generate Prisma Client.
7. Implement Department service/API/tests.
8. Implement Employee mapper, manager-cycle helper, service, and tests.
9. Implement Employee controllers/routes and RBAC/ownership tests.
10. Update auth tests to use real Employee fixture IDs.
11. Update seed in foreign-key-safe order and verify idempotency.
12. Add frontend Department/Employee data modules.
13. Refactor list/Kanban to API data and URL-backed state.
14. Refactor profile/create/edit to real routes, selectors, validation, and
    mutations.
15. Remove Employee/private mocks and fake smart counts.
16. Run complete verification and manual role checks.
17. Append one Branch Updates entry; do not edit tracker summary sections on the
    feature branch.

## 17. Verification Commands

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

1. Sign in as Admin and open `/employees`; confirm seeded Employees come from
   the API in Kanban and List.
2. Search/filter by Department, Employee Type, and status; switch views without
   losing filters.
3. Create an ACTIVE Employee using a real Department and Working Schedule.
4. Open `/employees/:id`, edit work/private data, save, refresh, and confirm
   persistence.
5. Attempt self/cyclic manager assignment and confirm readable rejection.
6. Deactivate/reactivate the Employee and verify status behavior.
7. Sign in as the linked Employee User; confirm own profile access and denial of
   global/another-Employee access.
8. Restart API and confirm data and User link persist.

## 18. Definition of Done

- [ ] Department and Employee migrations apply cleanly to dev/test PostgreSQL.
- [ ] Temporary User Employee IDs are cleared and replaced by a real FK.
- [ ] Seeds create real related records idempotently.
- [ ] Department/Employee APIs match the exact schemas/errors/RBAC above.
- [ ] Manager cycles and inactive reference assignment are rejected.
- [ ] Employee list responses exclude private/bank data.
- [ ] Employee ownership is enforced from the authenticated session.
- [ ] Kanban/List/Profile/Create/Edit use PostgreSQL-backed API data.
- [ ] Employee UI mocks, private mocks, and fake smart counts are removed.
- [ ] Existing auth and Working Schedule tests still pass.
- [ ] Typecheck, build, complete tests, and manual verification pass.
- [ ] Only an append-only Branch Updates entry is added to the tracker.

## 19. Non-Negotiables

- Do not implement Admin User Management in this phase.
- Do not create Contract, Attendance, Time Off, or Payroll models.
- Do not preserve placeholder `employeeId` strings after adding the FK.
- Do not combine User Account and Employee into one model.
- Do not trust client-supplied names for Department, manager, or Schedule links;
  use IDs and validate them in PostgreSQL.
- Do not expose private/bank fields in list responses.
- Do not use Employee `On Leave` as a master status.
- Do not show hardcoded smart-button counts.
- Do not hard-delete Employee/Department records.
