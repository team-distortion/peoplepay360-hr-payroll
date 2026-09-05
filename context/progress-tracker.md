# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Backend: Phase 4A Salary Configuration & Phase 4B Safe Formula Engine COMPLETE
- Frontend: Phase 4A Salary Configuration COMPLETE
- Backend: Phase 1 — Authentication & Authorization COMPLETE
- Frontend: Payroll Dashboard (`/dashboard`) COMPLETE

## Current Goal

- Install `recharts` (`npm install` in `frontend/`), then connect remaining domain pages to backend APIs & implement Phase 2 Employee Management & Contracts.
- Backend: Phase 3 — Employee Master COMPLETE
- Frontend: Phase 3 — Employee Master COMPLETE

## Current Goal

- Proceeding to Phase 5 (Contract Management & Salary Structure Assignment).

## Completed

### Backend & Monorepo Foundation
- npm workspaces monorepo setup (`packages/*`, `apps/*`, `frontend`)
- Shared package `@peoplepay360/shared` with standardized API contracts
- API app `@peoplepay360/api` Express application structure (`app.ts`, `server.ts`)
- Environment configuration with Zod validation (`src/config/env.ts`)
- Prisma client foundation (`src/lib/prisma.ts`, `prisma/schema.prisma`)
- Centralized error handling (`AppError`, `error-handler.ts`) and 404 handler (`not-found.ts`)
- Health check feature endpoint (`GET /api/v1/health`)
- Docker Compose configuration for PostgreSQL and Mailpit (`docker-compose.yml`)
- Vitest and Supertest integration testing suite
- TypeScript strict compilation across all workspaces

### Frontend Setup & UI Routes
- Initialized frontend with Vite, React, TS, Tailwind, shadcn/ui, and `@xyflow/react`
- Implemented the HR Portal Login Screen (`/login` route)
- Implemented the Admin User Management UI (`/admin/users` route)
- Implemented the Employee Dashboard UI (`/employees` route) with Kanban, List, and Profile views
- Implemented the Contracts UI (`/contracts` route) with List and Detail views, including employee filtering
- Implemented the Working Schedules UI (`/schedules` route) with List and Form views
- Implemented the Attendance UI (`/attendance` route) with Global Widget, List, and Detail views
- Implemented the Time Off UI module (`/time-off` routes) with Dashboard, Requests, Allocations, and Types views
- Implemented the Payroll Dashboard UI (`/dashboard`) with Filter Bar, 5 KPI cards (animated count-up + stagger), Salary-by-Department bar chart, Monthly Salary Trend line chart, Payslip Status stacked bar + Payroll Alerts panel (deep-linked), Attendance Overview, Time Off Overview table, and Department Overview table — all panels with per-spec motion animations (§7)
- Added `recharts ^2.12.7` to `frontend/package.json` (run `npm install` in `frontend/` to activate)
- Added `/dashboard` route in `App.tsx` gated to `HR_PAYROLL_USER | HR_PAYROLL_MANAGER | ADMIN` roles; default wildcard redirect changed from `/employees` to `/dashboard`
- Updated `TopNav.tsx`: added standalone "Dashboard" link; Payroll nav item converted from placeholder to full Dropdown with links to Dashboard, Structures, Rules, Pay Runs, Payslips

### Authentication & Authorization (Backend Phase 1)
- Prisma `User` model and `Role` enum added to `apps/api/prisma/schema.prisma`
- PostgreSQL `session` table migration (`20260905133907_phase01_auth`) created and deployed to dev & test DBs
- Database seed script (`apps/api/prisma/seed.ts`) creating 5 users (1 for each role) with Argon2 password hashing
- Session management using `express-session` and `connect-pg-simple` store (`src/lib/session.ts`)
- Authentication middleware (`src/middleware/authenticate.ts`) loading active principal from PostgreSQL
- Role-based authorization middleware (`src/middleware/authorize.ts`) enforcing explicit role permissions
- Employee ownership authorization helper (`src/lib/ownership.ts`)
- Auth endpoints: `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, `POST /api/v1/auth/logout`
- Complete integration test suite in `apps/api/tests/auth.test.ts` (18 auth tests passing, 23/23 total suite)

### Frontend Integration & Auth Flow
- Connected frontend workspace (`frontend`) to `@peoplepay360/shared`
- API client wrapper (`frontend/src/lib/api.ts`) with `credentials: 'include'` for PostgreSQL session cookies
- Global `AuthContext` (`frontend/src/context/AuthContext.tsx`) managing `user`, `login`, `logout`, and auto-restoring sessions via `/api/v1/auth/me`
- `ProtectedRoute` guard protecting routes (`/employees`, `/contracts`, `/admin/users`, `/flow`, `/schedules`, `/attendance`, `/time-off`) and enforcing role permissions
- Connected `Login.tsx` form with validation, error handling, loading states, and redirect logic
- Updated `TopNav.tsx` displaying user email, role badge, working Sign Out functionality, and Attendance Widget
- Configured Vite dev server proxy for `/api` -> `http://localhost:4000`

## In Progress

- Phase 2 — Employee Management & Contracts (Backend & Frontend)

## Next Up

- Run `npm install` in `frontend/` to activate the `recharts` dependency
- Implementation of Employee CRUD & Contract resolution backend APIs
- Connecting Employees & Contracts UI components to backend endpoints
- Phase 2 — Employee Management & Contracts (Backend)

## Open Questions

- None

## Architecture Decisions

- Used npm workspaces for monorepo package isolation (`apps/api`, `packages/shared`, `frontend`).
- Decoupled Express app creation (`src/app.ts`) from server execution (`src/server.ts`) to enable clean testing via Supertest.
- Enforced strict Zod schema parsing at application startup for environment variables.
- Standardized API response format `{ data: ..., error: ... }` across all endpoints.
- Enforced session regeneration (`req.session.regenerate`) on successful login to prevent session fixation attacks.
- Returned identical generic 401 `INVALID_CREDENTIALS` error code and message for both missing user and invalid password to prevent account enumeration.
- Enforced `credentials: 'include'` on frontend HTTP client so session cookie `connect.sid` is passed seamlessly.

## Session Notes

- All Phase 1 backend tasks and integration tests completed and verified with `npm run typecheck`, `npm run build`, and `npm test` (23/23 tests passing, zero compilation errors).
- Express API authentication & authorization endpoints active on port 4000.
- Frontend dev server configured to proxy `/api` requests to backend API.

## Branch Updates - Phase 2 Working Schedule (`feature/phase02-working-schedule`)

- Added shared Working Schedule types, Zod schemas, DTOs, and pure time calculation utilities (`packages/shared/src/types/schedules.ts`).
- Added Prisma `WorkingSchedule` and `WorkingScheduleDay` models, along with `WorkingScheduleType`, `WorkingScheduleStatus`, and `Weekday` enums (`apps/api/prisma/schema.prisma`).
- Created and executed migration `phase02_working_schedules` with PostgreSQL check constraints enforcing minute ranges (0-1439), distinct start/end times, and break minute limits (0-720) across development and test databases.
- Extended database seed script (`apps/api/prisma/seed.ts`) idempotently with standard `40 Hours / Week` and overnight `Night Shift` schedules deriving authoritative 2,400 weekly minutes.
- Implemented backend domain module `apps/api/src/modules/schedules` (`schedule-time.ts`, `schedules.schemas.ts`, `schedules.service.ts`, `schedules.controller.ts`, `schedules.routes.ts`) with strict RBAC (`HR_MANAGER`, `HR_PAYROLL_USER`, `HR_PAYROLL_MANAGER`, `ADMIN`) and mounted on `/api/v1/schedules`.
- Added unit tests (`schedule-time.test.ts`) and API integration test suite (`schedules.test.ts`), verifying 53/53 tests passing across the test suite.
- Integrated frontend with `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`, and `zod`.
- Connected `/schedules`, `/schedules/new`, and `/schedules/:id` to PostgreSQL API via TanStack Query and React Hook Form, replacing `DUMMY_SCHEDULES` and browser-authoritative duration calculations.
- Protected all schedule frontend routes with role restrictions matching the API matrix.

## Branch Updates - Phase 3 Employee Master (`feature/phase03-employee-master`)

- Added `COMPANY_NAME` configuration to `.env.example`, `apps/api/.env`, and validated environment configuration (`apps/api/src/config/env.ts`).
- Added shared Department and Employee types, DTOs, pure formatting helpers, and comprehensive Zod validation schemas (`packages/shared/src/types/employees.ts`) and exported from package barrel.
- Added Prisma `RecordStatus` and `EmployeeType` enums, `Department` model, `Employee` model with self-referential reporting manager hierarchy, and converted `User.employeeId` placeholder strings to a real optional one-to-one foreign key with `ON DELETE SET NULL`.
- Created and deployed migration `20260905183000_phase03_employee_master` with pre-FK placeholder cleanup, foreign keys, indexes, and PostgreSQL check constraints across development and test databases.
- Updated database seed script (`apps/api/prisma/seed.ts`) idempotently in foreign-key-safe order: upserting schedules, departments (`Finance`, `HR`, `Engineering`, `Operations`), representative employees (`EMP001` Aarav Mehta, `EMP002` Sara Khan, `EMP003` John Dsouza, `EMP004` Neha Patel [ACTIVE]), linking managers, and linking the seeded Employee-role user to Aarav Mehta's real record.
- Implemented backend Department module (`departments.service.ts`, `departments.controller.ts`, `departments.routes.ts`) with RBAC and active employee deactivation prevention.
- Implemented backend Employee module (`manager-cycle.ts`, `employee-mapper.ts`, `employees.service.ts`, `employees.controller.ts`, `employees.routes.ts`) with reporting cycle prevention, active reference validation, record-level ownership checks for `EMPLOYEE` role, and privacy field omissions in list queries.
- Updated auth test suite fixtures (`apps/api/tests/auth.test.ts`) to use real Department, Schedule, and Employee fixtures without weakening any assertions.
- Added automated integration test suites for Departments (`tests/departments.test.ts`) and Employees (`tests/employees.test.ts`), verifying 76/76 passing tests across the entire test suite.
- Implemented frontend TanStack Query API layers for departments and employees (`frontend/src/features/departments`, `frontend/src/features/employees`).
- Refactored `/employees` with URL query-param-backed view toggle (Kanban/List), search, department filter, employee type filter, status filter, and real DTO binding.
- Implemented `/employees/new` and `/employees/:id` with React Hook Form, live dropdown selectors, read-only/edit states, status confirmation toggle, disabled zero-state smart buttons (`Available after <module>`), and removed all mock employee and private data.
- Configured frontend route protection, top navigation, and login redirects to ensure `EMPLOYEE` role users navigate to their own profile and are restricted from global employee lists.
 
## Branch Updates - Phase 4 Salary Configuration (`feature/phase04-salary-configuration`)

- Implemented pure, deterministic, safe arithmetic Formula Engine (`apps/api/src/modules/salary-config/formula/`) with `jsep` AST parsing, allowlisted operators, Prisma `Decimal` evaluation (28-digit precision, `ROUND_HALF_UP`), division-by-zero detection, complexity limits (max 1,000 chars, 200 nodes, 32 depth), magnitude bounds (< 10^16), and zero conversion to JS `number` or `eval`.
- Added structure dependency validator (`structure-dependencies.ts`) verifying code/sequence uniqueness across all rules, stepwise dependency accumulation for active rules, and distinguishing forward references, self-references, inactive references, and unknown identifiers.
- Added shared salary configuration types, DTOs, value sets (`SalaryRuleCategoryValues`, `SalaryRuleMethodValues`, `SalaryFormulaBuiltinValues`), and comprehensive Zod validation schemas (`packages/shared/src/types/salary-config.ts`) exported from `@peoplepay360/shared`.
- Extended Prisma schema (`schema.prisma`) with `SalaryRuleCategory` and `SalaryRuleMethod` enums, `SalaryStructure` and `SalaryRule` models with unique constraints and performance indexes.
- Created and executed migration `20260906000000_phase04_salary_configuration` with PostgreSQL check constraints enforcing uppercase alphanumeric codes (`^[A-Z][A-Z0-9_]{0,39}$`), sequences (1-1,000,000), non-negative fixed amounts, percentage rates (0-1000 with up to 4 decimal places), name normalization, and strict mutual exclusivity of method configuration fields across dev and test databases.
- Extended database seed script (`seed.ts`) idempotently with the canonical `Regular Salary` structure and its 7 ordered rules (`BASIC`, `HRA`, `MEAL`, `OT`, `GROSS`, `PF`, `NET`).
- Implemented backend salary configuration modules (`apps/api/src/modules/salary-config/`) with strict RBAC (`HR_PAYROLL_USER` read-only, `HR_PAYROLL_MANAGER` and `ADMIN` read-write, `EMPLOYEE` and `HR_MANAGER` denied), prospective dependency graph validation, downstream deactivation protection (`SALARY_RULE_CODE_IN_USE`), and an atomic multi-rule reordering endpoint (`updateSalaryRuleConfiguration`) utilizing a two-stage collision-free temporary sequence update.
- Mounted payroll endpoints under `/api/v1/payroll/structures` and `/api/v1/payroll/rules`.
- Added comprehensive unit and integration test suites:
  - `apps/api/tests/salary-formula.test.ts` (31 tests passing) verifying formula parsing, operator precedence, parentheses, decimal precision (`0.1 + 0.2 = 0.3`), division by zero, AST complexity limits, security rejections, dependency validation, and static safety assertions.
  - `apps/api/tests/salary-config.test.ts` (17 tests passing) verifying full 5-role RBAC matrix, structure uniqueness, activation requirements (>= 1 active rule), rule method exclusivity, dependency errors, deactivation locks, atomic sequence swaps, and seed correctness.
  - Full test suite passing across all domains (124/124 tests passing).
- Created frontend TanStack Query API and query hook layer (`frontend/src/features/salary-config/`).
- Built frontend Salary Structures list page (`SalaryStructures.tsx`), Structure Detail page (`SalaryStructureDetail.tsx`) with accessible Move Up / Move Down controls and atomic configuration saving, global Salary Rules list page (`SalaryRules.tsx`) with multi-facet filters, and Salary Rule form (`SalaryRuleDetail.tsx`) with dynamic method fields and interactive available-identifier insert chips.
- Updated `TopNav.tsx` to conditionally display the Payroll dropdown only to authorized payroll roles (`HR_PAYROLL_USER`, `HR_PAYROLL_MANAGER`, `ADMIN`) and updated `App.tsx` routes with role-based `ProtectedRoute` guards.
