# Phase 11 - Admin User Management

## Metadata

- **Status:** APPROVED FOR IMPLEMENTATION
- **Target branch:** `feature/phase11-admin-user-management`
- **Assumed baseline:** Phase 3 Employee linkage, Phase 1 authentication, and
  AuditLog are merged and verified
- **PRD coverage:** Admin user management, role assignment, permission updates,
  and system administration
- **Depends on:** Local auth, PostgreSQL sessions, Employee master, AuditLog,
  shared Role values, and the existing `/admin/users` UI
- **Blocks:** Final seed generation and release hardening
- **Implementation ownership:** User-management API, session invalidation,
  Admin UI integration, audit events, minimal seed adjustment, and tests

## 1. Goal

Replace the mock `/admin/users` page with Admin-only management of real login
accounts. An Admin can create an account for an Employee, assign exactly one
PeoplePay360 Role, change its login email/Employee link/Role, activate or
deactivate it, and reset its password.

`User` remains the authentication identity and `Employee` remains the HR
profile. Editing one must not silently overwrite fields owned by the other.

This phase has no dependency on Phase 10 reporting and may be implemented in
parallel from a shared baseline containing the dependencies above. Only one
branch should own shared auth/session files at a time.

## 2. Source Priority

1. PeoplePay360 PRD role definitions and Admin responsibilities.
2. `context/architecture.md` authentication, RBAC, and audit rules.
3. `context/project-overview.md` User/Employee terminology.
4. This specification.
5. Phase 1 auth and Phase 3 Employee contracts.
6. Existing `/admin/users` layout.

## 3. Scope

### In scope

- Admin-only paginated User list, search, filters, and detail.
- Create User linked one-to-one to an ACTIVE Employee.
- Exactly one Role per User using the existing `Role` enum.
- Update login email, linked Employee, and Role.
- Explicit activate, deactivate, and password-reset actions.
- Immediate authorization/session-version enforcement after sensitive changes.
- Protection against removing/deactivating the final active Admin.
- Replace dummy frontend data and non-functional controls.
- Audit events without password/hash leakage.
- Minimal idempotent seed adjustment and comprehensive tests.

### Out of scope

- Self-registration, invitations, email verification, forgot-password flow,
  password-reset links, or outbound account emails.
- Multiple Roles per User, custom Roles, permission editor, or RBAC redesign.
- Deleting User or Employee records.
- Editing Employee HR/work/private fields from `/admin/users`.
- Bulk import/export, bulk role changes, impersonation, or SSO/OAuth.
- Refactoring `seed.ts` or generating 200 Employees.

## 4. Locked Account Rules

1. The database continues to store one `User.role`; the existing role
   checkboxes must be replaced by one select/radio control.
2. Every newly created User must link to exactly one ACTIVE Employee. Existing
   legacy unlinked accounts remain readable but must be linked before any other
   account edit except deactivation.
3. `User.employeeId` remains unique: one Employee can own at most one login.
4. User login email is independent after creation. Default the create form from
   `Employee.workEmail`, but require the Admin to submit/confirm it. Later
   Employee email changes do not silently change login credentials.
5. Normalize login email with trim + lowercase; uniqueness is case-insensitive
   at the service boundary. Maximum length is 254.
6. Create/reset password is 12-128 characters and is hashed with the existing
   Argon2 configuration. Passwords and hashes are never returned, logged, or
   audited.
7. No User DELETE endpoint exists. Deactivation preserves historical relations.
8. Deactivation takes effect on the next authenticated request. Role and link
   changes also become database-authoritative immediately.
9. Password reset, deactivation, Employee-link change, and Role change increment
   `sessionVersion`, invalidating prior sessions for that User.
10. Reactivation does not restore invalidated sessions; the User signs in again.
11. An Admin cannot deactivate their own current account or change their own
    Role/Employee link through this UI. Another active Admin must perform it.
12. The final active Admin cannot be deactivated or changed to another Role.
    Serialize this check transactionally to prevent concurrent last-Admin races.
13. An Employee-role User must always have an ACTIVE linked Employee. Privileged
    accounts also require an Employee link for new accounts under this spec.
14. Deactivating an Employee does not automatically deactivate its User because
    Phase 3 deliberately separates those states; Admin User Management displays
    the mismatch and lets Admin deactivate the account explicitly.
15. User management never changes `Employee.status`, work email, or other HR data.

## 5. Prisma and Session Changes

Extend `User`:

```prisma
sessionVersion Int @default(1)
```

Add a database check that `sessionVersion >= 1`. Migration name:

```text
phase11_user_session_version
```

Update session typing to store:

```ts
userId: string;
sessionVersion: number;
```

On login, store the current database version after session regeneration. On
every authenticated request, load the User from PostgreSQL and require:

```text
User.isActive = true
session.sessionVersion = User.sessionVersion
```

Mismatch destroys/clears the session and returns the existing unauthenticated
response. Do not trust a Role or Employee ID stored in the session.

For final-active-Admin protection, use a transaction-scoped PostgreSQL advisory
lock with one documented constant key before counting active Admin accounts and
performing the mutation. Do not use a process-local lock.

## 6. Shared Contracts

Create and export `packages/shared/src/types/admin-users.ts`.

```ts
interface AdminUserListQuery {
  search?: string;
  role?: Role;
  status?: 'ACTIVE' | 'INACTIVE';
  linked?: boolean;
  page?: number;
  pageSize?: number;
  sort?: 'email' | 'employeeName' | 'role' | 'status' | 'createdAt';
  order?: 'asc' | 'desc';
}

interface CreateAdminUserInput {
  employeeId: string;
  email: string;
  role: Role;
  password: string;
}

interface UpdateAdminUserInput {
  employeeId: string;
  email: string;
  role: Role;
}

interface ResetUserPasswordInput {
  newPassword: string;
}
```

User DTO:

```text
id, normalized email, role, isActive
employee: id, employeeNumber, fullName, workEmail, status
createdAt, updatedAt
```

Never expose `passwordHash`, `sessionVersion`, Employee private/bank fields, or
session rows.

## 7. Authorization

| Capability | Employee | HR Manager | HR Payroll User | HR Payroll Manager | Admin |
| --- | --- | --- | --- | --- | --- |
| List/read Users | Deny | Deny | Deny | Deny | Allow |
| Create/update User | Deny | Deny | Deny | Deny | Allow |
| Activate/deactivate User | Deny | Deny | Deny | Deny | Allow |
| Reset password | Deny | Deny | Deny | Deny | Allow |

Every API route authenticates first and checks Admin explicitly. UI route
protection is supplementary only.

## 8. API Contract

Mount under `/api/v1/admin/users`.

### `GET /api/v1/admin/users`

Accept the list query. Search normalized email, Employee name, Employee number,
and work email. Default sort is email ascending then ID. `pageSize` default 25,
maximum 100. Return pagination metadata and User summaries.

### `GET /api/v1/admin/users/:id`

Return one safe User detail or `USER_NOT_FOUND`.

### `GET /api/v1/admin/users/eligible-employees`

Register before `/:id`. Query `search` and optional `includeEmployeeId` for the
currently edited User. Return ACTIVE Employees without a linked User, plus the
current linked Employee when editing. Limit 20, stable name/number ordering.

### `POST /api/v1/admin/users`

Validate `CreateAdminUserInput`. In one transaction:

1. Resolve the ACTIVE Employee.
2. Recheck that it has no User.
3. Normalize and check email uniqueness.
4. Hash the password outside the transaction, then revalidate inside it.
5. Create User with `sessionVersion = 1`.
6. Write `USER_ACCOUNT_CREATED` AuditLog.

Return 201 with safe detail. Translate uniqueness races to stable conflicts.

### `PUT /api/v1/admin/users/:id`

Complete replacement of email, Employee link, and Role. Reject unknown keys.
Lock target User, enforce self/final-Admin rules, validate the ACTIVE Employee,
and update plus audit in one transaction. Increment `sessionVersion` only when
Role or Employee link changes; email-only change keeps active sessions valid.

### `POST /api/v1/admin/users/:id/activate`

Require inactive target and valid ACTIVE Employee link. Set active, increment
`sessionVersion`, and audit. Repeating Activate on active target is idempotent
and creates no extra AuditLog.

### `POST /api/v1/admin/users/:id/deactivate`

Enforce self/final-Admin rules. Set inactive, increment `sessionVersion`, and
audit transactionally. Repeating Deactivate on inactive target is idempotent.

### `POST /api/v1/admin/users/:id/reset-password`

Hash `newPassword`, lock/recheck target, update hash, increment
`sessionVersion`, and write `USER_PASSWORD_RESET` without password data.
Return `{ success: true }` only.

No generic PATCH, DELETE, bulk, session-list, or password-read endpoint.

## 9. Errors

| HTTP | Code | Meaning |
| ---: | --- | --- |
| 400 | `INVALID_USER_INPUT` | Invalid query/body/path |
| 401 | existing auth code | Missing, expired, or invalidated session |
| 403 | `USER_MANAGEMENT_ACCESS_DENIED` | Non-Admin |
| 404 | `USER_NOT_FOUND` | Target User missing |
| 404 | `EMPLOYEE_NOT_FOUND` | Selected Employee missing |
| 409 | `USER_EMAIL_EXISTS` | Normalized login email already used |
| 409 | `EMPLOYEE_ACCOUNT_EXISTS` | Employee already linked to another User |
| 409 | `USER_SELF_ACCESS_CHANGE_FORBIDDEN` | Current Admin self role/link/deactivation |
| 409 | `LAST_ACTIVE_ADMIN_REQUIRED` | Mutation would remove final active Admin |
| 422 | `EMPLOYEE_INACTIVE` | Selected Employee is inactive |
| 422 | `USER_EMPLOYEE_LINK_REQUIRED` | Legacy unlinked account must be linked |

Never expose whether arbitrary public email addresses exist outside an
authenticated Admin request, Prisma errors, SQL constraints, hashes, or stacks.

## 10. Audit Requirements

Required actions:

```text
USER_ACCOUNT_CREATED
USER_ACCOUNT_ACCESS_UPDATED
USER_ACCOUNT_ACTIVATED
USER_ACCOUNT_DEACTIVATED
USER_PASSWORD_RESET
```

Audit the actor ID, target User ID, safe before/after email/Role/Employee ID and
active status, plus UTC time. Never store password, hash, sessionVersion,
session cookie, private Employee data, or full request body.

## 11. Backend Organization

```text
apps/api/src/modules/admin-users/
  admin-users.schemas.ts
  admin-users.mapper.ts
  admin-users.errors.ts
  admin-users.service.ts
  admin-users.controller.ts
  admin-users.routes.ts
  index.ts
```

Reuse the existing auth password helper/Argon2 configuration rather than
duplicating hashing settings. Keep final-Admin locking and state transitions in
the service, not the controller.

## 12. Frontend Behavior

Refactor `frontend/src/pages/AdminUsers.tsx`:

- remove `DUMMY_USERS` and all local fake filtering/saving;
- fetch paginated Users from the API;
- preserve search, Role, status, page, sort, and selected User in URL state;
- replace multi-role checkboxes with exactly one Role select/radio group;
- use a searchable eligible-Employee selector keyed by Employee ID;
- default new login email from selected Employee work email but keep it editable;
- add password + confirmation only on Create and Reset Password dialog;
- use explicit Activate/Deactivate controls with confirmation;
- disable forbidden self-access changes and explain why;
- show legacy missing link and inactive-Employee mismatch clearly;
- preserve unsaved input on API validation errors;
- refresh current User/session state after an allowed edit involving the current
  Admin's email only;
- provide loading, empty, no-results, retry, and mutation-progress states;
- never optimistically display a successful access change.

Use the existing visual system. Do not expose or display password hashes or a
stored password. Do not offer User deletion.

## 13. Seed Policy

Continue working with the current long `apps/api/prisma/seed.ts`. Ensure the
existing Admin and Employee-role accounts are linked to real ACTIVE Employees
and have valid `sessionVersion`. Add at most one inactive User if needed to test
reactivation. Preserve all phase fixtures, use idempotent upserts, and do not
refactor the seed or generate 200 Employees.

## 14. Tests

Automated coverage must verify:

- all endpoints deny every non-Admin role;
- list search/filter/pagination/sort are stable;
- DTO never contains hash, version, private/bank fields, or sessions;
- create normalizes email and hashes password;
- duplicate normalized email and Employee link races return stable conflicts;
- inactive/missing Employee cannot be selected;
- exactly one Role is accepted; arrays/unknown Roles are rejected;
- role/link changes invalidate prior sessions on their next request;
- deactivate invalidates session and blocks future login;
- activate requires valid Employee link and does not restore sessions;
- password reset invalidates existing sessions and old password fails;
- email-only update changes login email but does not alter Employee.workEmail;
- Employee work-email edit does not silently change User.email;
- self role/link/deactivation is blocked;
- final active Admin is protected under concurrent mutations;
- repeated activate/deactivate is idempotent without duplicate audit;
- audits contain safe exact changes and no password/hash;
- frontend has no dummy data and handles all UI states;
- all earlier authentication/Employee tests continue passing.

## 15. Implementation Order

1. Verify merged User/Employee/Auth/Audit schema and current session behavior.
2. Add `sessionVersion` migration/check and update session typing/login/authenticate.
3. Add regression tests for old/missing and mismatched session versions.
4. Add shared Admin User contracts.
5. Implement safe mapper, list/detail, and eligible-Employee endpoint.
6. Implement create/update with uniqueness and final-Admin locking.
7. Implement activate/deactivate/password reset and audit.
8. Register Admin-only routes and run backend tests.
9. Replace mock `/admin/users` data and multi-role UI.
10. Minimally update existing seeds and verify rerun behavior.
11. Run full regression and manual role/session checks.
12. Append one Branch Updates tracker entry only.

## 16. Verification

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

1. Create an account for an unlinked active Employee and sign in with it.
2. Change its Role while signed in elsewhere; confirm the old session stops.
3. Reset its password; verify old password/session fail and new login succeeds.
4. Deactivate it and verify immediate denial; reactivate and sign in again.
5. Attempt duplicate Employee/email, self-deactivation, and final-Admin removal.
6. Confirm Employee HR data did not change during account management.

## 17. Definition of Done

- [ ] `/admin/users` contains no dummy data or multi-role behavior.
- [ ] Admin can safely create, update, activate/deactivate, and reset accounts.
- [ ] Every new User links one-to-one to an ACTIVE Employee.
- [ ] Sensitive access changes invalidate old sessions.
- [ ] Self and final-active-Admin protections are concurrency safe.
- [ ] All account mutations are safely audited.
- [ ] No password, hash, session, or private Employee data leaks.
- [ ] Existing seed is minimally adjusted without refactoring.
- [ ] Migrations, typecheck, build, tests, and manual verification pass.

## 18. Non-Negotiables

- Do not implement multiple Roles or change the Role model.
- Do not permit User deletion or Employee editing from this module.
- Do not trust frontend route guards as authorization.
- Do not store Role/Employee authority only in session state.
- Do not allow stale sessions after role/link/password/status changes.
- Do not expose passwords, hashes, session rows, or private Employee fields.
- Do not allow self-deactivation or removal of the final active Admin.
- Do not refactor seed architecture or generate 200 Employees in this phase.
