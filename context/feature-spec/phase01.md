# Phase 1 — Authentication & Authorization (Backend)

**Repo:** `team-distortion/peoplepay360-hr-payroll`
**Precondition:** Phase 0 (Foundation) is COMPLETE. This spec assumes the repo state as of that phase — do not re-scaffold anything listed under "Existing, do not touch" below.

---

## 1. Goal

Implement session-based authentication and role-based authorization on top of the existing Express + Prisma + PostgreSQL foundation. No new architectural patterns — extend what already exists.

## 2. Hard constraints

**Use:** `argon2`, `express-session`, `connect-pg-simple`, Prisma, PostgreSQL, Zod, the existing `AppError`/`errorHandler`, the existing Vitest + Supertest setup. All of these are already installed in `apps/api/package.json` — do not add new packages beyond `tsx`-based seed running.

**Never use:** JWT, `localStorage`-based auth, Passport, Clerk, Firebase, Auth0, Redis, any hosted auth provider, `express-session`'s default `MemoryStore`, runtime session-table auto-creation, numeric-hierarchy role checks, client-trusted `role`/`employeeId` values.

## 3. Existing, do not touch

These already exist and must be reused exactly as-is (import them, don't recreate them):

- `apps/api/src/lib/prisma.ts` → exports `prisma`, `disconnectPrisma()`
- `apps/api/src/errors/app-error.ts` → `new AppError(statusCode, code, message, details?)`
- `apps/api/src/errors/error-handler.ts` → already builds `{ data: null, error: { code, message, details? } }`. **The error field is `details`, not `fields`.** Throw `AppError`; never hand-construct an error JSON body in a route/controller.
- `apps/api/src/config/env.ts` → extend the existing `envSchema`, don't create a second env file
- `apps/api/src/app.ts` / `routes/index.ts` → mount new routers here, don't create a second Express app
- `packages/shared/src/types/api.ts` → `ApiResponse<T>`, `ApiSuccessResponse<T>`, `ApiErrorResponse` — reuse these generics for every new endpoint's response type

## 4. Repo conventions (follow exactly)

- ESM throughout; relative imports use an explicit `.js` extension (e.g. `from '../lib/prisma.js'`), even though source files are `.ts`.
- Routers: `export const xRouter = Router()` in `x.routes.ts`, mounted in `routes/index.ts` via `apiRouter.use('/path', xRouter)`.
- Services are plain exported async functions in `*.service.ts` — no classes, no DI containers.
- Controllers are thin: parse via Zod → call service → `res.json(...)` or `next(error)`. No business logic in controllers.
- Tests live in `apps/api/tests/*.test.ts`, run against `TEST_DATABASE_URL` via Vitest + `Supertest.agent()`.

## 5. Correction to apply first

`apps/api/src/config/env.ts` currently has:
```ts
SESSION_SECRET: z.string().default('replace-with-a-long-development-secret'),
```
This violates "startup must fail if `SESSION_SECRET` is missing." Replace with:
```ts
SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
```
Add to `.env.example`:
```
SESSION_SECRET=replace-with-a-random-64-char-string-before-running-locally
```
(a placeholder comment, never a real secret, never checked into `.env`).

## 6. Implementation order

```
1. Add Role + User to prisma/schema.prisma
2. Create migration (Prisma SQL + hand-added session table SQL)
3. Apply migration to dev DB, apply same migration to test DB
4. Write prisma/seed.ts, add db:seed scripts
5. Fix SESSION_SECRET in config/env.ts
6. lib/session.ts (express-session + connect-pg-simple config)
7. types/express-session.d.ts + types/express.d.ts (declaration merging)
8. modules/auth/* (schemas → service → controller → routes)
9. middleware/authenticate.ts
10. middleware/authorize.ts
11. lib/ownership.ts
12. packages/shared/src/types/auth.ts (+ export from index.ts)
13. Mount authRouter in routes/index.ts
14. apps/api/tests/auth.test.ts
15. Run typecheck/build/test
16. Update context/progress-tracker.md
```

Do not skip ahead — step *n* must compile/pass before step *n+1* begins.

## 7. Prisma schema — `apps/api/prisma/schema.prisma`

Current file has only the `generator`/`datasource` blocks. Append:

```prisma
enum Role {
  EMPLOYEE
  HR_MANAGER
  HR_PAYROLL_USER
  HR_PAYROLL_MANAGER
  ADMIN
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  role         Role
  employeeId   String?  @unique
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

Rules: lowercase-normalize email in application code before every write/read comparison — do not add a DB-level `citext` or check constraint for this. Do not create an `Employee` model in this phase. `employeeId` stays a bare nullable/unique string field (future FK target).

## 8. Migration

```bash
cd apps/api
npx prisma migrate dev --create-only --name phase01_auth
```

Open the generated `migration.sql` and append the session table SQL exactly:

```sql
CREATE TABLE "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);

ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX "IDX_session_expire" ON "session" ("expire");
```

Then:
```bash
npx prisma migrate dev
npx prisma generate
```

Apply the identical committed migration to `TEST_DATABASE_URL` — this is what the `db:test:prepare` script (§13) must do. Never run `prisma db push` as a workflow step; it's create-only + migrate dev only.

## 9. Seed — `apps/api/prisma/seed.ts`

One user per role: `EMPLOYEE`, `HR_MANAGER`, `HR_PAYROLL_USER`, `HR_PAYROLL_MANAGER`, `ADMIN`. Requirements:
- Hash every password with `argon2.hash(...)` (same call signature the login flow will use for verify) — never insert a plaintext password.
- Use `prisma.user.upsert` keyed on `email` so the seed is idempotent.
- Emails: `employee@peoplepay360.dev`, `hr.manager@peoplepay360.dev`, `payroll.user@peoplepay360.dev`, `payroll.manager@peoplepay360.dev`, `admin@peoplepay360.dev` — all same dev password, printed to console once on seed run (not committed anywhere else).
- Register `"prisma": { "seed": "tsx prisma/seed.ts" }` in `apps/api/package.json`.

## 10. Session config — `apps/api/src/lib/session.ts`

```ts
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { Pool } from 'pg';
import { env } from '../config/env.js';

const pgPool = new Pool({ connectionString: env.DATABASE_URL });
const PgSession = connectPgSimple(session);

export function createSessionMiddleware() {
  return session({
    store: new PgSession({
      pool: pgPool,
      tableName: 'session',
      createTableIfMissing: false, // table is migration-managed
    }),
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
    },
  });
}
```

Wire it into `app.ts` between `express.json()` and `apiRouter` mounting — this is the one edit to an "existing, do not touch" file, so do it as a minimal, isolated diff.

## 11. Type declarations

`apps/api/src/types/express-session.d.ts`:
```ts
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}
```

`apps/api/src/types/express.d.ts` — authenticated principal, attached by `authenticate` middleware:
```ts
import type { Role } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  employeeId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
```

## 12. Auth module — `apps/api/src/modules/auth/`

- **`auth.schemas.ts`** — `LoginRequestSchema = z.object({ email: z.string().email(), password: z.string().min(1) })`.
- **`auth.service.ts`** — exported functions, no classes:
  - `login(email: string, password: string): Promise<AuthenticatedUser>` — trims/lowercases email, loads user, throws `AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')` for both "no such user" and "bad password" (identical message/code/status — do not branch differently), throws same error if `!user.isActive`, verifies with `argon2.verify(user.passwordHash, password)`.
  - `toSafeUser(user): CurrentUser` — strips `passwordHash`, returns `{ id, email, role, employeeId }`.
- **`auth.controller.ts`** — thin handlers calling the service, plus explicit session regeneration on login (see §14) and destroy on logout.
- **`auth.routes.ts`** — `export const authRouter = Router()`, three routes (§14).

## 13. Middleware

**`apps/api/src/middleware/authenticate.ts`**
```
read req.session.userId
  → missing → next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'))
  → query User by id from Postgres (never trust anything cached in session beyond userId)
  → missing or !isActive → next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'))
  → req.user = toSafeUser(user)
  → next()
```

**`apps/api/src/middleware/authorize.ts`**
```ts
export function authorize(...allowedRoles: Role[]) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action'));
    }
    next();
  };
}
```
No numeric role-hierarchy comparisons — every route lists its allowed roles explicitly.

## 14. Endpoints — mount at `apiRouter.use('/auth', authRouter)`

### `POST /api/v1/auth/login`
Flow: Zod-validate → `auth.service.login(...)` → **regenerate session** (`req.session.regenerate(...)`, never just mutate the existing anonymous session) → set `req.session.userId` → `req.session.save(...)` → respond `{ data: <CurrentUser>, error: null }`.

### `GET /api/v1/auth/me`
Behind `authenticate`. Responds `{ data: req.user, error: null }`. This is the frontend's source of truth after refresh — do not shortcut it by trusting a client-cached user object.

### `POST /api/v1/auth/logout`
`req.session.destroy(...)` → clear the cookie (`res.clearCookie(...)` with matching name/path) → respond `{ data: { success: true }, error: null }`. Must be idempotent — calling it with no session, or twice, still returns success, never an error.

## 15. Ownership helper — `apps/api/src/lib/ownership.ts`

```ts
export function canAccessEmployee(
  user: AuthenticatedUser,
  targetEmployeeId: string,
  bypassRoles: Role[] = ['HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN']
): boolean {
  if (bypassRoles.includes(user.role)) return true;
  if (user.role === 'EMPLOYEE') {
    return user.employeeId !== null && user.employeeId === targetEmployeeId;
  }
  return false;
}
```
Not wired into any route yet — no Employee feature exists this phase. This is reusable scaffolding only.

## 16. Shared contracts — `packages/shared/src/types/auth.ts`

Add `zod` as a dependency of `packages/shared` (it currently has none beyond TypeScript). Export:
```ts
import { z } from 'zod';

export const RoleValues = [
  'EMPLOYEE', 'HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN',
] as const;
export type Role = (typeof RoleValues)[number];

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export interface CurrentUser {
  id: string;
  email: string;
  role: Role;
  employeeId: string | null;
}
```
Add `export * from './types/auth.js';` to `packages/shared/src/index.ts`. This package must not import Express, Prisma, or connect-pg-simple — the `Role` union above is a hand-mirrored string type, not imported from `@prisma/client`.

## 17. Script additions

Root `package.json`, add:
```json
"db:seed": "npm run db:seed --workspace=apps/api",
"db:test:prepare": "npm run db:test:prepare --workspace=apps/api"
```
`apps/api/package.json`, add:
```json
"db:seed": "tsx prisma/seed.ts",
"db:test:prepare": "dotenv -e .env.test -- prisma migrate deploy"
```
(introduce `dotenv-cli` as a new devDependency only if needed to point `db:test:prepare` at `TEST_DATABASE_URL` — do not repoint `DATABASE_URL` itself).

## 18. Tests — `apps/api/tests/auth.test.ts`

Real Postgres via `TEST_DATABASE_URL`, no mocked Prisma, `Supertest.agent()` to retain cookies. Must cover:
```
✓ valid login returns safe user, no passwordHash in response
✓ email is normalized (mixed-case input still matches lowercase-stored user)
✓ wrong password → 401 INVALID_CREDENTIALS
✓ unknown email → 401 INVALID_CREDENTIALS (identical body to wrong-password case)
✓ inactive user → 401 on login, and loses access mid-session if deactivated after login
✓ successful login persists a session usable by /auth/me
✓ /auth/me without a session → 401
✓ logout destroys the session; the old cookie can no longer reach /auth/me
✓ logout is safe to call twice
✓ authorize(): allowed role passes, disallowed role → 403, unauthenticated → 401
✓ canAccessEmployee(): own record allowed, other Employee's record denied, EMPLOYEE with null employeeId denied, HR/Admin bypass allowed
```

## 19. Definition of done

```bash
npm run db:up
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
npm run db:test:prepare
npm run typecheck
npm run build
npm test
```
All must pass, Phase 0 tests (`health.test.ts`, `error-handler.test.ts`) must still pass unmodified, and:
- login / logout / me work end-to-end via curl or Supertest
- sessions are Postgres-backed and survive a server restart
- session regeneration on login is verified (not just implemented)
- RBAC and ownership-helper checks pass
- inactive users are blocked at both login and mid-session
- `passwordHash` never appears in any HTTP response
- `SESSION_SECRET` missing → server fails to start (verify this manually once)

Then update `context/progress-tracker.md`:
- Change `Backend: Phase 0 — Foundation COMPLETE` → `Backend: Phase 1 — Authentication & Authorization COMPLETE`
- Move the Phase 1 bullet out of "Next Up" into "Completed", under a new "### Authentication & Authorization" subheading
- Add a line to "Architecture Decisions" documenting the session-regeneration-on-login and identical-401 decisions, since both are security-relevant and non-obvious to a future reader

## 20. Explicitly out of scope this phase

Do not touch: frontend `Login.tsx` wiring, Employee CRUD, payroll features, the Canvas/React Flow UI work. This phase is `apps/api` and `packages/shared` only.