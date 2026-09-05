# Progress Tracker

Update this file after every meaningful implementation change.

Feature branches must only append uniquely identified bullets under `Branch
Updates`. The main-branch integrator owns all mutable summary sections. Git is
configured to union-merge this file, so additions from parallel branches are
retained automatically.

## Current Phase

- Backend: Phase 1 — Authentication & Authorization COMPLETE
- Frontend: Authentication Integration & UI Routes COMPLETE

## Current Goal

- Finalize repository/workflow alignment, then implement the Working Schedule
  foundation before Employee, Contract, Attendance, and Payroll features.

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
- Implemented Time Off UI (`/time-off`) with Dashboard, Requests, Allocations, and Types views

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

- Workflow alignment and project-wide schema sequencing.

## Next Up

- Write the dedicated Phase 2 Working Schedule feature spec.
- Implement and connect Working Schedule persistence/API/UI.
- Write the Employee Master feature spec after Working Schedule is stable.

## Open Questions

- Phase-specific schema choices are listed in `context/schema-roadmap.md` and
  must be resolved in the relevant feature spec before its migration.

## Architecture Decisions

- Used npm workspaces for monorepo package isolation (`apps/api`, `packages/shared`, `frontend`).
- Decoupled Express app creation (`src/app.ts`) from server execution (`src/server.ts`) to enable clean testing via Supertest.
- Enforced strict Zod schema parsing at application startup for environment variables.
- Standardized API response format `{ data: ..., error: ... }` across all endpoints.
- Enforced session regeneration (`req.session.regenerate`) on successful login to prevent session fixation attacks.
- Returned identical generic 401 `INVALID_CREDENTIALS` error code and message for both missing user and invalid password to prevent account enumeration.
- Enforced `credentials: 'include'` on frontend HTTP client so session cookie `connect.sid` is passed seamlessly.
- Kept the established `frontend/` workspace as the canonical React boundary
  instead of moving working code to the outdated documented `apps/web/` path.
- Adopted incremental domain migrations guided by `context/schema-roadmap.md`;
  the current User-only Prisma schema is the completed auth slice, not the final
  product schema.
- Configured union merging plus append-only feature-branch updates for the
  progress tracker; the main-branch integrator owns its summary sections.

## Session Notes

- All Phase 1 backend tasks and integration tests completed and verified with `npm run typecheck`, `npm run build`, and `npm test` (23/23 tests passing, zero compilation errors).
- Express API authentication & authorization endpoints active on port 4000.
- Frontend dev server configured to proxy `/api` requests to backend API.
- Repository path alignment, schema sequencing, and parallel-branch progress
  rules were documented before Phase 2 implementation.

## Branch Updates

Append only; format:

`- [YYYY-MM-DD] [branch] [owner] summary; verification: command/result`
