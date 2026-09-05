You are implementing PeoplePay360, an HR & Payroll platform.

This task is PHASE 0 — FOUNDATION ONLY.

Before changing code:
1. Read `architecture.md` completely.
2. Read `code-standards.md` completely.
3. If the PeoplePay360 problem specification/PDF exists in the repository, treat it as the product requirements source.
4. Inspect the existing repository before creating or deleting anything.
5. Preserve any existing frontend work. Another developer is building the UI independently.
6. If `apps/web/` already exists, DO NOT modify its application code, dependencies, components, routes, styling, or configuration in this task.
7. If `apps/web/` does not exist, DO NOT scaffold the frontend yet.

The architecture and code standards are authoritative. Do not substitute alternative technologies because you prefer them.

==================================================
GOAL
==================================================

Initialize the monorepo/backend development environment and implement only the backend foundation required for later PeoplePay360 features.

At the end of this phase I must be able to:

1. install dependencies with `npm install`
2. start PostgreSQL and Mailpit through Docker Compose
3. run the Express API in development mode
4. generate the Prisma client
5. verify PostgreSQL connectivity through a health endpoint
6. run Vitest successfully
7. run TypeScript typechecking successfully

Do NOT implement:
- authentication/login
- User model
- Employee model
- Departments
- Contracts
- Schedules
- Attendance
- Time Off
- Salary Structures
- Salary Rules
- Payruns
- Payslips
- Reports
- PDF generation logic
- email sending logic

Those are later phases.

==================================================
1. REPOSITORY STRUCTURE
==================================================

Use npm workspaces.

Target structure:

peoplepay360/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── src/
│   │   │   ├── config/
│   │   │   ├── errors/
│   │   │   ├── lib/
│   │   │   ├── middleware/
│   │   │   ├── routes/
│   │   │   ├── app.ts
│   │   │   └── server.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/
│       └── EXISTING FRONTEND — DO NOT MODIFY
│
├── packages/
│   └── shared/
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
│
├── architecture.md
├── code-standards.md
├── docker-compose.yml
├── .env.example
├── .gitignore
├── package.json
└── package-lock.json

Do not create unnecessary abstractions or folders that have no use in Phase 0.

==================================================
2. NODE / PACKAGE SETUP
==================================================

First inspect installed versions:

node --version
npm --version
docker --version
docker compose version

Do not automatically install system-level software such as Node or Docker.

If one is unavailable, report the missing prerequisite clearly.

Use the installed supported Node LTS/current stable environment.

Root `package.json` must:

- be private
- use npm workspaces
- include:
  - `apps/*`
  - `packages/*`

Add useful root scripts:

- `dev:api`
- `build`
- `typecheck`
- `test`
- `db:up`
- `db:down`
- `prisma:generate`
- `prisma:migrate`
- `prisma:studio`

Workspace scripts should do the actual work rather than duplicating commands at root.

==================================================
3. INSTALL BACKEND DEPENDENCIES
==================================================

Actually run npm installation. Do not merely write dependency names into package.json.

Use current stable mutually compatible package versions and commit the resulting `package-lock.json`.

Runtime dependencies for `apps/api`:

- express
- cors
- zod
- dotenv
- @prisma/client
- pg
- express-session
- connect-pg-simple
- argon2
- jsep
- pdfkit
- nodemailer

Some packages will not be used until later phases. Install them now because they are already fixed by the architecture.

Important future constraints:

- `jsep` will later parse Salary Rule formulas.
- Formula evaluation must NEVER use `eval()` or `Function()`.
- Arithmetic for payroll will use Prisma Decimal/custom Decimal evaluation.
- `pdfkit` will later generate Payslip PDFs.
- `nodemailer` will later communicate with Mailpit.
- `argon2`, `express-session`, `connect-pg-simple` will be used in the authentication phase.

Do NOT implement those features in Phase 0.

Development dependencies for `apps/api`:

- typescript
- tsx
- prisma
- vitest
- supertest
- @types/node
- @types/express
- @types/cors
- @types/express-session
- @types/pg
- @types/supertest

Add additional `@types/*` packages only when the installed library actually requires them.

Do not install Redux, Redis, queues, ORMs other than Prisma, authentication SaaS SDKs, or unnecessary infrastructure.

==================================================
4. TYPESCRIPT
==================================================

Enable strict TypeScript.

Requirements:

- `"strict": true`
- no `any` unless there is a documented unavoidable external typing boundary
- Node-compatible module configuration
- separate source and compiled output
- compile API to `dist/`

Use explicit types.

Treat:
- environment variables
- request input
- query parameters

as untrusted values until validated.

==================================================
5. ENVIRONMENT CONFIGURATION
==================================================

Create `.env.example`.

Required configuration:

NODE_ENV=development
API_PORT=4000

DATABASE_URL=postgresql://peoplepay360:peoplepay360@localhost:5432/peoplepay360?schema=public

TEST_DATABASE_URL=postgresql://peoplepay360:peoplepay360@localhost:5432/peoplepay360?schema=test

SESSION_SECRET=replace-with-a-long-development-secret

CLIENT_ORIGIN=http://localhost:5173

COMPANY_CURRENCY=INR
COMPANY_TIMEZONE=Asia/Kolkata

SMTP_HOST=localhost
SMTP_PORT=1025

Never commit the actual `.env`.

Implement:

apps/api/src/config/env.ts

Use Zod to parse and validate environment variables ONCE at application startup.

The rest of the application should import validated configuration from this module rather than reading `process.env` throughout the codebase.

Do not hardcode INR or Asia/Kolkata into future business logic. They are system configuration.

==================================================
6. DATE/TIME ARCHITECTURE RULE
==================================================

Document/preserve this rule in implementation comments only where useful:

Business dates such as:
- contract start/end
- attendance date
- leave date
- Payrun period
- Payslip period

will use PostgreSQL DATE.

Event timestamps such as:
- createdAt
- updatedAt
- approvedAt
- acknowledgedAt
- sentAt

will use PostgreSQL `timestamptz` and UTC storage.

Do not introduce date utility abstractions yet because Phase 0 contains no business models.

==================================================
7. PRISMA FOUNDATION
==================================================

Initialize Prisma inside:

apps/api/prisma/

Configure PostgreSQL.

Create a valid Prisma schema containing the generator and PostgreSQL datasource.

DO NOT invent placeholder business models just to make Prisma work.

Do not create:
- User
- Employee
- Contract
- Attendance
- Payrun
- any other domain model

during this phase.

Generate the Prisma Client.

Create:

apps/api/src/lib/prisma.ts

Expose one shared PrismaClient instance.

Do not instantiate PrismaClient separately in routes/services.

Implement graceful disconnect during process shutdown where appropriate.

Schema changes in later phases must be handled through Prisma migrations.

Never use `prisma db push` as the normal schema-management workflow.

==================================================
8. DOCKER COMPOSE
==================================================

Create/update root `docker-compose.yml`.

For Phase 0 it should contain only infrastructure:

1. PostgreSQL
2. Mailpit

PostgreSQL:

- use an official PostgreSQL image
- database: `peoplepay360`
- username: `peoplepay360`
- password: `peoplepay360`
- expose 5432
- use a named volume
- include a healthcheck

Mailpit:

- use the official Mailpit image
- SMTP: 1025
- Web UI: 8025

Do NOT add:
- Redis
- Kafka
- RabbitMQ
- object storage
- workers
- microservices

Do NOT containerize the frontend in this task.

The normal development workflow should keep React/Express running through npm for hot reload while PostgreSQL/Mailpit run in Docker.

==================================================
9. EXPRESS APPLICATION FOUNDATION
==================================================

Separate application creation from server startup.

Create:

src/app.ts
src/server.ts

`app.ts`:
- creates/configures Express
- JSON middleware
- CORS
- routes
- not-found handling
- centralized error handling
- does NOT call `listen()`

`server.ts`:
- imports validated env configuration
- starts the HTTP server
- handles graceful shutdown
- closes Prisma cleanly

Configure CORS from `CLIENT_ORIGIN`.

Do not use `*` origin with credentials.

==================================================
10. API BASE PATH
==================================================

All APIs use:

/api/v1

Create a central router:

src/routes/index.ts

Mount it at `/api/v1`.

==================================================
11. RESPONSE CONTRACT
==================================================

Establish one response format now so the frontend developer can depend on it.

Successful request:

{
  "data": ...,
  "error": null
}

Failed request:

{
  "data": null,
  "error": {
    "code": "SOME_MACHINE_READABLE_CODE",
    "message": "Human readable message"
  }
}

Optional validation details may be included under:

error.details

Do not expose:
- stack traces
- raw Prisma errors
- SQL errors
- secrets

in production API responses.

Put reusable API response types in `packages/shared`.

Do not put backend implementation logic in `packages/shared`.

==================================================
12. ERROR HANDLING
==================================================

Create a small application error abstraction, for example:

AppError

It should support at least:

- HTTP status
- machine-readable code
- safe public message

Create centralized Express error middleware.

Unexpected errors should become a generic 500 response.

Development may log the actual error server-side.

Do not scatter try/catch response handling across every route.

==================================================
13. HEALTH FEATURE
==================================================

Implement exactly one endpoint:

GET /api/v1/health

This is the ONLY feature endpoint in Phase 0.

It must verify that the API can communicate with PostgreSQL.

Use a lightweight query such as `SELECT 1` through Prisma.

Healthy response:

HTTP 200

{
  "data": {
    "status": "ok",
    "database": "ok"
  },
  "error": null
}

If PostgreSQL is unavailable:

HTTP 503

{
  "data": null,
  "error": {
    "code": "DATABASE_UNAVAILABLE",
    "message": "Database is unavailable"
  }
}

Do not expose connection strings or database exceptions.

Keep HTTP handling and DB-health logic separate enough that route code stays thin.

==================================================
14. SHARED PACKAGE
==================================================

Create:

packages/shared

Use it only for things intended to be shared between frontend and backend, initially:

- API success response type
- API error response type
- common API error shape

Do not place:
- Prisma
- Express middleware
- services
- repositories
- database models

inside shared.

Ensure TypeScript workspace imports work correctly.

==================================================
15. TEST FOUNDATION
==================================================

Configure Vitest.

Implement tests for the foundation.

At minimum:

1. health route returns the expected response shape
2. health route returns 200 when PostgreSQL is reachable
3. unknown API route returns a consistent 404 response
4. application error middleware produces the standard error shape
5. TypeScript compiles successfully

Use Supertest for HTTP-level integration tests.

The architecture requires later integration tests against PostgreSQL through Prisma, so prepare test configuration around `TEST_DATABASE_URL`.

Do not use SQLite.

Do not replace PostgreSQL with an in-memory database.

Do not build domain fixtures yet.

Tests must not depend on the frontend.

==================================================
16. GITIGNORE
==================================================

Ensure these are ignored:

node_modules/
dist/
.env
.env.*
!.env.example
coverage/
*.log

Do not ignore:
- package-lock.json
- Prisma migrations
- architecture.md
- code-standards.md

==================================================
17. CODE QUALITY RULES
==================================================

Follow these rules throughout:

- small single-purpose modules
- thin Express routes
- no business logic in HTTP handlers
- no database calls directly from arbitrary route files when a small service abstraction is appropriate
- no `any`
- no floating-point assumptions for future payroll code
- no hardcoded secrets
- no hardcoded environment-specific URLs in source
- no swallowed errors
- no raw internal errors exposed to clients
- no premature generic repository pattern
- no dependency injection framework
- no microservices
- no Redis
- no queues
- no frontend implementation

Avoid abstraction for abstraction's sake.

This is a hackathon system, but correctness of payroll-related architecture matters more than unnecessary enterprise complexity.

==================================================
18. NPM SCRIPTS
==================================================

Make these work from repository root:

npm run dev:api
npm run build
npm run typecheck
npm test
npm run db:up
npm run db:down
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio

API workspace should have appropriate underlying scripts such as:

dev
build
start
typecheck
test
test:watch
prisma:generate
prisma:migrate
prisma:studio

Do not create scripts that silently mutate the database during application startup.

==================================================
19. VERIFICATION
==================================================

After implementing, actually execute the setup.

Run, in sensible order:

npm install

docker compose config
docker compose up -d

npm run prisma:generate

npm run typecheck
npm run build
npm test

Start the API and verify:

GET http://localhost:4000/api/v1/health

Also verify Mailpit is reachable at:

http://localhost:8025

If any command fails:
- investigate the root cause
- fix it
- rerun the relevant verification

Do not report success for commands you did not run.

==================================================
20. SCOPE GUARD
==================================================

STOP after Phase 0.

Do not continue into Authentication.

In particular, DO NOT create a User table merely because auth dependencies are installed.

Do not create placeholder Employee/payroll models.

Do not generate mock UI.

Do not refactor the existing frontend.

Do not implement Salary Rules merely because `jsep` is installed.

==================================================
21. FINAL REPORT
==================================================

When finished, respond with:

1. files created
2. files modified
3. dependencies installed
4. Docker services configured
5. commands executed
6. tests executed and results
7. health endpoint result
8. any assumptions made
9. any unresolved issue

Then give me the exact repository tree for the files you created/modified.

Do not begin Phase 1 until I explicitly ask.