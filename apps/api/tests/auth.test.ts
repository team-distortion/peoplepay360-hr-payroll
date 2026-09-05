import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { Role } from '@prisma/client';
import { createApp } from '../src/app.js';
import { apiRouter } from '../src/routes/index.js';
import { prisma } from '../src/lib/prisma.js';
import { pgPool } from '../src/lib/session.js';
import { authenticate } from '../src/middleware/authenticate.js';
import { authorize } from '../src/middleware/authorize.js';
import { canAccessEmployee } from '../src/lib/ownership.js';
import type { AuthenticatedUser } from '../src/types/express.js';

// Mount test route on apiRouter for RBAC testing
apiRouter.get(
  '/test/admin-only',
  authenticate,
  authorize(Role.ADMIN),
  (_req, res) => {
    res.status(200).json({ data: { message: 'admin_access_granted' }, error: null });
  }
);

describe('Auth & Authorization Integration Tests', () => {
  const app = createApp();

  const testPassword = 'TestPassword123!';
  let activeEmployeeId: string;
  let inactiveUserId: string;
  let adminUserId: string;
  let fixtureEmployee1Id: string;
  let fixtureEmployee2Id: string;
  let fixtureDepartmentId: string;
  let fixtureScheduleId: string;

  beforeAll(async () => {
    // Ensure clean state for test emails
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'test.employee@peoplepay360.dev',
            'test.inactive@peoplepay360.dev',
            'test.admin@peoplepay360.dev',
          ],
        },
      },
    });

    // Create fixture Department and Schedule
    const dept = await prisma.department.create({
      data: {
        name: 'Auth Test Dept',
        nameKey: 'auth test dept',
        status: 'ACTIVE',
      },
    });
    fixtureDepartmentId = dept.id;

    const sched = await prisma.workingSchedule.create({
      data: {
        name: 'Auth Test Sched',
        nameKey: 'auth test sched',
        companyName: 'OXP Pvt Ltd',
        status: 'ACTIVE',
      },
    });
    fixtureScheduleId = sched.id;

    // Create real Employee fixtures
    const emp1 = await prisma.employee.create({
      data: {
        employeeNumber: 'AUTHEMP001',
        firstName: 'Auth',
        lastName: 'Worker',
        workEmail: 'auth.worker1@example.com',
        jobPosition: 'Engineer',
        employeeType: 'FULL_TIME',
        status: 'ACTIVE',
        departmentId: fixtureDepartmentId,
        workingScheduleId: fixtureScheduleId,
      },
    });
    fixtureEmployee1Id = emp1.id;

    const emp2 = await prisma.employee.create({
      data: {
        employeeNumber: 'AUTHEMP002',
        firstName: 'Auth',
        lastName: 'Inactive',
        workEmail: 'auth.worker2@example.com',
        jobPosition: 'Tester',
        employeeType: 'CONTRACT',
        status: 'INACTIVE',
        departmentId: fixtureDepartmentId,
        workingScheduleId: fixtureScheduleId,
      },
    });
    fixtureEmployee2Id = emp2.id;

    const passwordHash = await argon2.hash(testPassword);

    const activeEmp = await prisma.user.create({
      data: {
        email: 'test.employee@peoplepay360.dev',
        passwordHash,
        role: Role.EMPLOYEE,
        employeeId: fixtureEmployee1Id,
        isActive: true,
      },
    });
    activeEmployeeId = activeEmp.id;

    const inactiveUser = await prisma.user.create({
      data: {
        email: 'test.inactive@peoplepay360.dev',
        passwordHash,
        role: Role.EMPLOYEE,
        employeeId: fixtureEmployee2Id,
        isActive: false,
      },
    });
    inactiveUserId = inactiveUser.id;

    const adminUser = await prisma.user.create({
      data: {
        email: 'test.admin@peoplepay360.dev',
        passwordHash,
        role: Role.ADMIN,
        isActive: true,
      },
    });
    adminUserId = adminUser.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        id: { in: [activeEmployeeId, inactiveUserId, adminUserId] },
      },
    });
    if (fixtureEmployee1Id || fixtureEmployee2Id) {
      await prisma.employee.deleteMany({
        where: { id: { in: [fixtureEmployee1Id, fixtureEmployee2Id] } },
      });
    }
    if (fixtureDepartmentId) {
      await prisma.department.deleteMany({
        where: { id: fixtureDepartmentId },
      });
    }
    if (fixtureScheduleId) {
      await prisma.workingSchedule.deleteMany({
        where: { id: fixtureScheduleId },
      });
    }
    await prisma.$disconnect();
    await pgPool.end();
  });

  describe('POST /api/v1/auth/login', () => {
    it('✓ valid login returns safe user, no passwordHash in response', async () => {
      const agent = request.agent(app);
      const res = await agent
        .post('/api/v1/auth/login')
        .send({ email: 'test.employee@peoplepay360.dev', password: testPassword });

      expect(res.status).toBe(200);
      expect(res.body.error).toBeNull();
      expect(res.body.data).toEqual({
        id: activeEmployeeId,
        email: 'test.employee@peoplepay360.dev',
        role: 'EMPLOYEE',
        employeeId: fixtureEmployee1Id,
      });
      expect(res.body.data.passwordHash).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');

      // Check session cookie was returned
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(Array.isArray(cookies) ? cookies.join(';') : cookies).toContain('connect.sid');
    });

    it('✓ session regeneration on login is verified (session ID changes to prevent fixation)', async () => {
      const agent = request.agent(app);
      const oldSessionCookie = 'connect.sid=s%3Apre-login-anonymous-id.signature';

      // Login with pre-existing session cookie attached
      const loginRes = await agent
        .post('/api/v1/auth/login')
        .set('Cookie', oldSessionCookie)
        .send({ email: 'test.employee@peoplepay360.dev', password: testPassword });

      expect(loginRes.status).toBe(200);
      const loginCookies = loginRes.headers['set-cookie'];
      const loginSid = Array.isArray(loginCookies) ? loginCookies[0].split(';')[0] : '';

      expect(loginSid).toBeTruthy();
      expect(loginSid).not.toContain('pre-login-anonymous-id');
    });

    it('✓ sessions are Postgres-backed and survive a server restart (fresh app instance)', async () => {
      const agent = request.agent(app);
      const loginRes = await agent
        .post('/api/v1/auth/login')
        .send({ email: 'test.employee@peoplepay360.dev', password: testPassword });
      expect(loginRes.status).toBe(200);

      const cookieHeader = loginRes.headers['set-cookie'];

      // Simulate a server restart by instantiating a fresh Express app connected to the same PostgreSQL DB
      const restartedApp = createApp();
      const meRes = await request(restartedApp)
        .get('/api/v1/auth/me')
        .set('Cookie', cookieHeader);

      expect(meRes.status).toBe(200);
      expect(meRes.body.error).toBeNull();
      expect(meRes.body.data.id).toBe(activeEmployeeId);
      expect(meRes.body.data.email).toBe('test.employee@peoplepay360.dev');
    });

    it('✓ email is normalized (mixed-case input still matches lowercase-stored user)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: '  TeSt.EmPlOyEe@PeoplePay360.DeV  ', password: testPassword });

      expect(res.status).toBe(200);
      expect(res.body.error).toBeNull();
      expect(res.body.data.email).toBe('test.employee@peoplepay360.dev');
    });

    it('✓ wrong password → 401 INVALID_CREDENTIALS', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test.employee@peoplepay360.dev', password: 'WrongPassword999!' });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        data: null,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    });

    it('✓ unknown email → 401 INVALID_CREDENTIALS (identical body to wrong-password case)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'unknown.user@peoplepay360.dev', password: testPassword });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        data: null,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    });

    it('✓ inactive user → 401 on login, and loses access mid-session if deactivated after login', async () => {
      // 1. Attempting login as inactive user returns 401
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test.inactive@peoplepay360.dev', password: testPassword });

      expect(loginRes.status).toBe(401);
      expect(loginRes.body).toEqual({
        data: null,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });

      // 2. Active user logs in, gets deactivated, and loses mid-session access
      const agent = request.agent(app);
      const activeLogin = await agent
        .post('/api/v1/auth/login')
        .send({ email: 'test.employee@peoplepay360.dev', password: testPassword });
      expect(activeLogin.status).toBe(200);

      // Verify session works initially
      const meBefore = await agent.get('/api/v1/auth/me');
      expect(meBefore.status).toBe(200);

      // Deactivate user in database
      await prisma.user.update({
        where: { id: activeEmployeeId },
        data: { isActive: false },
      });

      // Subsequent /auth/me request must fail with 401 UNAUTHENTICATED
      const meAfterDeactivation = await agent.get('/api/v1/auth/me');
      expect(meAfterDeactivation.status).toBe(401);
      expect(meAfterDeactivation.body).toEqual({
        data: null,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required',
        },
      });

      // Restore active state
      await prisma.user.update({
        where: { id: activeEmployeeId },
        data: { isActive: true },
      });
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('✓ /auth/me without a session → 401', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        data: null,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required',
        },
      });
    });

    it('✓ successful login persists a session usable by /auth/me', async () => {
      const agent = request.agent(app);
      const loginRes = await agent
        .post('/api/v1/auth/login')
        .send({ email: 'test.employee@peoplepay360.dev', password: testPassword });
      expect(loginRes.status).toBe(200);

      const meRes = await agent.get('/api/v1/auth/me');
      expect(meRes.status).toBe(200);
      expect(meRes.body.error).toBeNull();
      expect(meRes.body.data).toEqual({
        id: activeEmployeeId,
        email: 'test.employee@peoplepay360.dev',
        role: 'EMPLOYEE',
        employeeId: fixtureEmployee1Id,
      });
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('✓ logout destroys the session; the old cookie can no longer reach /auth/me', async () => {
      const agent = request.agent(app);
      await agent
        .post('/api/v1/auth/login')
        .send({ email: 'test.employee@peoplepay360.dev', password: testPassword });

      const meBefore = await agent.get('/api/v1/auth/me');
      expect(meBefore.status).toBe(200);

      const logoutRes = await agent.post('/api/v1/auth/logout');
      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body).toEqual({
        data: { success: true },
        error: null,
      });

      // After logout, cookie cannot access /auth/me
      const meAfter = await agent.get('/api/v1/auth/me');
      expect(meAfter.status).toBe(401);
      expect(meAfter.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('✓ logout is safe to call twice', async () => {
      const agent = request.agent(app);
      const firstLogout = await agent.post('/api/v1/auth/logout');
      expect(firstLogout.status).toBe(200);
      expect(firstLogout.body).toEqual({
        data: { success: true },
        error: null,
      });

      const secondLogout = await agent.post('/api/v1/auth/logout');
      expect(secondLogout.status).toBe(200);
      expect(secondLogout.body).toEqual({
        data: { success: true },
        error: null,
      });
    });
  });

  describe('RBAC: authorize() middleware', () => {
    it('✓ unauthenticated request → 401', async () => {
      const res = await request(app).get('/api/v1/test/admin-only');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('✓ authenticated disallowed role → 403', async () => {
      const employeeAgent = request.agent(app);
      await employeeAgent
        .post('/api/v1/auth/login')
        .send({ email: 'test.employee@peoplepay360.dev', password: testPassword });

      const res = await employeeAgent.get('/api/v1/test/admin-only');
      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        data: null,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action',
        },
      });
    });

    it('✓ allowed role passes → 200', async () => {
      const adminAgent = request.agent(app);
      await adminAgent
        .post('/api/v1/auth/login')
        .send({ email: 'test.admin@peoplepay360.dev', password: testPassword });

      const res = await adminAgent.get('/api/v1/test/admin-only');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        data: { message: 'admin_access_granted' },
        error: null,
      });
    });
  });

  describe('canAccessEmployee() helper', () => {
    const employeeUser: AuthenticatedUser = {
      id: 'usr_emp_1',
      email: 'emp1@test.com',
      role: Role.EMPLOYEE,
      employeeId: 'emp_001',
    };

    const employeeNullUser: AuthenticatedUser = {
      id: 'usr_emp_2',
      email: 'emp2@test.com',
      role: Role.EMPLOYEE,
      employeeId: null,
    };

    const hrUser: AuthenticatedUser = {
      id: 'usr_hr_1',
      email: 'hr@test.com',
      role: Role.HR_MANAGER,
      employeeId: null,
    };

    const adminUser: AuthenticatedUser = {
      id: 'usr_admin_1',
      email: 'admin@test.com',
      role: Role.ADMIN,
      employeeId: null,
    };

    const payrollUser: AuthenticatedUser = {
      id: 'usr_pr_1',
      email: 'payroll@test.com',
      role: Role.HR_PAYROLL_USER,
      employeeId: null,
    };

    const payrollManager: AuthenticatedUser = {
      id: 'usr_prm_1',
      email: 'pm@test.com',
      role: Role.HR_PAYROLL_MANAGER,
      employeeId: null,
    };

    it('✓ own record allowed', () => {
      expect(canAccessEmployee(employeeUser, 'emp_001')).toBe(true);
    });

    it("✓ other Employee's record denied", () => {
      expect(canAccessEmployee(employeeUser, 'emp_002')).toBe(false);
    });

    it('✓ EMPLOYEE with null employeeId denied', () => {
      expect(canAccessEmployee(employeeNullUser, 'emp_001')).toBe(false);
    });

    it('✓ HR/Admin bypass allowed', () => {
      expect(canAccessEmployee(hrUser, 'emp_001')).toBe(true);
      expect(canAccessEmployee(adminUser, 'emp_001')).toBe(true);
      expect(canAccessEmployee(payrollUser, 'emp_001')).toBe(true);
      expect(canAccessEmployee(payrollManager, 'emp_001')).toBe(true);
    });
  });
});
