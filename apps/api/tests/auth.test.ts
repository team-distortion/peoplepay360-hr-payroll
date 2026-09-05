import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { Role } from '@peoplepay360/shared';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { canAccessEmployee } from '../src/lib/ownership.js';
import { AuthenticatedUser } from '../src/types/express.js';

describe('Auth Module & Authorization Integration Tests', () => {
  const app = createApp();
  const DEV_PASSWORD = 'TestPassword123!';
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await argon2.hash(DEV_PASSWORD);
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({});

    await prisma.user.createMany({
      data: [
        {
          email: 'employee@peoplepay360.dev',
          passwordHash,
          role: 'EMPLOYEE',
          employeeId: 'emp_001',
          isActive: true,
        },
        {
          email: 'no_employee_id@peoplepay360.dev',
          passwordHash,
          role: 'EMPLOYEE',
          employeeId: null,
          isActive: true,
        },
        {
          email: 'inactive@peoplepay360.dev',
          passwordHash,
          role: 'EMPLOYEE',
          employeeId: 'emp_002',
          isActive: false,
        },
        {
          email: 'hr.manager@peoplepay360.dev',
          passwordHash,
          role: 'HR_MANAGER',
          employeeId: null,
          isActive: true,
        },
        {
          email: 'admin@peoplepay360.dev',
          passwordHash,
          role: 'ADMIN',
          employeeId: null,
          isActive: true,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('valid login returns safe user with no passwordHash', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/v1/auth/login').send({
      email: 'employee@peoplepay360.dev',
      password: DEV_PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data).toEqual({
      id: expect.any(String),
      email: 'employee@peoplepay360.dev',
      role: 'EMPLOYEE',
      employeeId: 'emp_001',
    });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('email is normalized (mixed-case input still matches lowercase-stored user)', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/v1/auth/login').send({
      email: '  EmPlOyEe@PeOpLePaY360.DeV  ',
      password: DEV_PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('employee@peoplepay360.dev');
  });

  it('wrong password returns 401 INVALID_CREDENTIALS', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/v1/auth/login').send({
      email: 'employee@peoplepay360.dev',
      password: 'WrongPassword123!',
    });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      data: null,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      },
    });
  });

  it('unknown email returns 401 INVALID_CREDENTIALS identical to wrong-password response', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/v1/auth/login').send({
      email: 'nonexistent@peoplepay360.dev',
      password: DEV_PASSWORD,
    });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      data: null,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      },
    });
  });

  it('inactive user returns 401 on login, and loses access mid-session if deactivated after login', async () => {
    const agent = request.agent(app);

    // Login fails for inactive user
    const loginRes = await agent.post('/api/v1/auth/login').send({
      email: 'inactive@peoplepay360.dev',
      password: DEV_PASSWORD,
    });
    expect(loginRes.status).toBe(401);
    expect(loginRes.body.error.code).toBe('INVALID_CREDENTIALS');

    // Login active user first
    const activeLoginRes = await agent.post('/api/v1/auth/login').send({
      email: 'employee@peoplepay360.dev',
      password: DEV_PASSWORD,
    });
    expect(activeLoginRes.status).toBe(200);

    const activeUserId = activeLoginRes.body.data.id;

    // Verify /auth/me works
    const meRes1 = await agent.get('/api/v1/auth/me');
    expect(meRes1.status).toBe(200);

    // Deactivate user mid-session in DB
    await prisma.user.update({
      where: { id: activeUserId },
      data: { isActive: false },
    });

    // Next request to /auth/me fails with 401 UNAUTHENTICATED
    const meRes2 = await agent.get('/api/v1/auth/me');
    expect(meRes2.status).toBe(401);
    expect(meRes2.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('successful login persists a session usable by /auth/me', async () => {
    const agent = request.agent(app);

    await agent.post('/api/v1/auth/login').send({
      email: 'hr.manager@peoplepay360.dev',
      password: DEV_PASSWORD,
    });

    const meRes = await agent.get('/api/v1/auth/me');
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.email).toBe('hr.manager@peoplepay360.dev');
    expect(meRes.body.data.role).toBe('HR_MANAGER');
  });

  it('/auth/me without a session returns 401 UNAUTHENTICATED', async () => {
    const agent = request.agent(app);
    const res = await agent.get('/api/v1/auth/me');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      data: null,
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication required',
      },
    });
  });

  it('logout destroys the session and cookie; old cookie can no longer reach /auth/me', async () => {
    const agent = request.agent(app);

    await agent.post('/api/v1/auth/login').send({
      email: 'admin@peoplepay360.dev',
      password: DEV_PASSWORD,
    });

    const meBefore = await agent.get('/api/v1/auth/me');
    expect(meBefore.status).toBe(200);

    const logoutRes = await agent.post('/api/v1/auth/logout');
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.data).toEqual({ success: true });

    const meAfter = await agent.get('/api/v1/auth/me');
    expect(meAfter.status).toBe(401);
  });

  it('logout is safe to call twice (idempotent)', async () => {
    const agent = request.agent(app);
    const res1 = await agent.post('/api/v1/auth/logout');
    expect(res1.status).toBe(200);

    const res2 = await agent.post('/api/v1/auth/logout');
    expect(res2.status).toBe(200);
  });

  it('canAccessEmployee helper correctly validates role bypass and employee ownership', () => {
    const employeeUser: AuthenticatedUser = {
      id: 'usr_1',
      email: 'emp@dev.com',
      role: 'EMPLOYEE',
      employeeId: 'emp_001',
    };

    const nullEmpUser: AuthenticatedUser = {
      id: 'usr_2',
      email: 'noemp@dev.com',
      role: 'EMPLOYEE',
      employeeId: null,
    };

    const hrUser: AuthenticatedUser = {
      id: 'usr_3',
      email: 'hr@dev.com',
      role: 'HR_MANAGER',
      employeeId: null,
    };

    // Employee accesses own record
    expect(canAccessEmployee(employeeUser, 'emp_001')).toBe(true);

    // Employee tries to access someone else's record
    expect(canAccessEmployee(employeeUser, 'emp_002')).toBe(false);

    // Employee with null employeeId tries to access a record
    expect(canAccessEmployee(nullEmpUser, 'emp_001')).toBe(false);

    // HR Manager bypasses record checks
    expect(canAccessEmployee(hrUser, 'emp_001')).toBe(true);
    expect(canAccessEmployee(hrUser, 'emp_999')).toBe(true);
  });
});
