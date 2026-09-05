# Code Standards

## General

- Keep modules small and single-purpose.
- Fix root causes; do not layer workarounds.
- Do not mix UI, HTTP, business, and database concerns in one module.
- Preserve PeoplePay360 business rules, role permissions, record history, and payroll state transitions.
- Never use floating-point arithmetic for salary, deductions, balances, or worked hours.

## TypeScript

- Use TypeScript in both the React app and Express API with strict mode enabled.
- Avoid `any`; use explicit types or narrowly scoped interfaces.
- Treat request bodies, query parameters, environment variables, and third-party responses as `unknown` until validated.
- Use shared enums and types for roles, statuses, salary-rule categories, and API contracts.

## React

- Keep components focused on rendering and user interaction; business rules belong in domain services.
- Use controlled forms with schema validation and display server validation errors beside the relevant fields.
- Keep server state in the data-fetching layer; do not duplicate it across component state.
- Enforce permissions in the API. Hiding an unauthorized action in the UI is not authorization.

## Express

- Organize routes by PeoplePay360 domain: employees, contracts, schedules, attendance, time off, payroll, salary configuration, and reports.
- Keep route handlers thin: validate input, authenticate, authorize, call a service, and return the response.
- Put payroll calculations, contract selection, leave balance updates, and state transitions in domain services.
- Pass errors to centralized error middleware; do not expose stack traces or internal database errors.

## Styling

- Use shared CSS tokens for colors, typography, spacing, borders, radii, and shadows.
- Do not hardcode repeated visual values inside components.
- Reuse shared form, table, status badge, card, dialog, and action components across modules.

## Authentication and Authorization

- Keep authentication local; do not depend on Clerk, Auth0, Firebase Auth, or another hosted authentication service.
- Hash passwords with `argon2`; never store or log plaintext passwords.
- Use `express-session` with `connect-pg-simple` so sessions are stored in PostgreSQL, not application memory.
- Send the session ID only through an `HttpOnly` and `SameSite` cookie; enable `Secure` cookies outside local HTTP development.
- Regenerate the session after login and destroy it completely on logout.
- Store each user's PeoplePay360 role in PostgreSQL and link the user to an employee record where applicable.
- Enforce the Employee, HR Manager, HR Payroll User, HR Payroll Manager, and Admin permissions on every protected API route.
- Verify record-level access: employees may read and create only records allowed for their own employee profile.

## API Routes

- Validate and parse request input before business logic runs.
- Authenticate the PostgreSQL-backed session and authorize the required role before every protected operation.
- Return consistent JSON response and error shapes with appropriate HTTP status codes.
- Use database transactions for multi-record operations such as leave approval, Payrun creation, payroll computation, and payment updates.
- Make payroll actions idempotent so retries cannot create duplicate Payruns, Payslips, deductions, or payments.

## Data and Storage

- Store PeoplePay360 records and relationships in PostgreSQL through Prisma ORM.
- Use Prisma migrations for schema changes; never modify the database schema manually.
- Store monetary values as PostgreSQL `DECIMAL` and handle them with Prisma `Decimal`.
- Preserve contract, attendance, leave, Payrun, and Payslip history; do not overwrite historical records with current values.
- Select contracts by employee and payroll period, and reject overlapping active contracts.
- Calculate total working hours and payroll totals from source records; do not accept client-calculated totals as authoritative.
- Process salary rules in their configured sequence and persist the resulting Payslip lines for auditability.

## Docker

- Run PostgreSQL through Docker Compose during development.
- Run the React and Express development servers through npm workspace scripts for fast hot reload and debugging.
- Provide Dockerfiles for the React app and Express API so the complete application can also run through Docker Compose for final verification.
- Configure services through environment variables and keep secrets out of source control and Docker images.
- Run Prisma migrations explicitly through npm scripts; do not generate schema changes automatically at container startup.

## File Organization

- `frontend/` - React application, pages, features, and reusable UI components.
- `apps/api/` - Express routes, middleware, domain services, and API configuration.
- `packages/shared/` - shared TypeScript types, enums, validation schemas, and API contracts.
- `apps/api/prisma/` - Prisma schema, migrations, and seed data.
- `apps/api/src/modules/` - domain modules for employees, contracts, schedules, attendance, time off, payroll, and reports.
- Name files after their responsibility, not merely the framework or technology used.
