import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { Role } from '@prisma/client';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { pgPool } from '../src/lib/session.js';

describe('Department API Integration Tests', () => {
  const app = createApp();
  const testPassword = 'DeptTestPass123!';

  let employeeAgent: ReturnType<typeof request.agent>;
  let hrManagerAgent: ReturnType<typeof request.agent>;
  let adminAgent: ReturnType<typeof request.agent>;

  const createdDepartmentIds: string[] = [];
  const createdEmployeeIds: string[] = [];
  const createdScheduleIds: string[] = [];

  const testUserEmails = [
    'dept.emp@peoplepay360.dev',
    'dept.hr.mgr@peoplepay360.dev',
    'dept.admin@peoplepay360.dev',
  ];

  beforeAll(async () => {
    // Clean up test users
    await prisma.user.deleteMany({
      where: { email: { in: testUserEmails } },
    });

    const passwordHash = await argon2.hash(testPassword);

    await prisma.user.create({
      data: {
        email: 'dept.emp@peoplepay360.dev',
        passwordHash,
        role: Role.EMPLOYEE,
        isActive: true,
      },
    });

    await prisma.user.create({
      data: {
        email: 'dept.hr.mgr@peoplepay360.dev',
        passwordHash,
        role: Role.HR_MANAGER,
        isActive: true,
      },
    });

    await prisma.user.create({
      data: {
        email: 'dept.admin@peoplepay360.dev',
        passwordHash,
        role: Role.ADMIN,
        isActive: true,
      },
    });

    // Authenticate agents
    employeeAgent = request.agent(app);
    await employeeAgent
      .post('/api/v1/auth/login')
      .send({ email: 'dept.emp@peoplepay360.dev', password: testPassword });

    hrManagerAgent = request.agent(app);
    await hrManagerAgent
      .post('/api/v1/auth/login')
      .send({ email: 'dept.hr.mgr@peoplepay360.dev', password: testPassword });

    adminAgent = request.agent(app);
    await adminAgent
      .post('/api/v1/auth/login')
      .send({ email: 'dept.admin@peoplepay360.dev', password: testPassword });
  });

  afterAll(async () => {
    // Clean up employees
    if (createdEmployeeIds.length > 0) {
      await prisma.employee.deleteMany({
        where: { id: { in: createdEmployeeIds } },
      });
    }

    // Clean up departments
    if (createdDepartmentIds.length > 0) {
      await prisma.department.deleteMany({
        where: { id: { in: createdDepartmentIds } },
      });
    }

    // Clean up schedules
    if (createdScheduleIds.length > 0) {
      await prisma.workingScheduleDay.deleteMany({
        where: { scheduleId: { in: createdScheduleIds } },
      });
      await prisma.workingSchedule.deleteMany({
        where: { id: { in: createdScheduleIds } },
      });
    }

    // Clean up test users
    await prisma.user.deleteMany({
      where: { email: { in: testUserEmails } },
    });

    await pgPool.end();
    await prisma.$disconnect();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/departments');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('denies Employee role with 403', async () => {
    const res = await employeeAgent.get('/api/v1/departments');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows HR Manager to create a department', async () => {
    const res = await hrManagerAgent.post('/api/v1/departments').send({
      name: 'Human Resources Test',
      status: 'ACTIVE',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Human Resources Test');
    expect(res.body.data.status).toBe('ACTIVE');
    expect(res.body.data.id).toBeDefined();

    createdDepartmentIds.push(res.body.data.id);
  });

  it('rejects duplicate department name case-insensitively with 409', async () => {
    const res = await hrManagerAgent.post('/api/v1/departments').send({
      name: '  human resources test  ',
      status: 'ACTIVE',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DEPARTMENT_NAME_EXISTS');
  });

  it('allows listing and searching departments', async () => {
    // Create an inactive department as well
    const inactiveRes = await adminAgent.post('/api/v1/departments').send({
      name: 'Legacy Dept Test',
      status: 'INACTIVE',
    });
    createdDepartmentIds.push(inactiveRes.body.data.id);

    // List all
    const allRes = await hrManagerAgent.get('/api/v1/departments');
    expect(allRes.status).toBe(200);
    expect(Array.isArray(allRes.body.data)).toBe(true);

    // Filter by status=ACTIVE
    const activeRes = await hrManagerAgent
      .get('/api/v1/departments')
      .query({ status: 'ACTIVE' });
    expect(activeRes.status).toBe(200);
    expect(activeRes.body.data.every((d: any) => d.status === 'ACTIVE')).toBe(true);

    // Filter by search
    const searchRes = await hrManagerAgent
      .get('/api/v1/departments')
      .query({ search: 'Human Resources' });
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.some((d: any) => d.name === 'Human Resources Test')).toBe(true);
  });

  it('allows updating department name and status', async () => {
    const created = await hrManagerAgent.post('/api/v1/departments').send({
      name: 'R&D Department',
      status: 'ACTIVE',
    });
    createdDepartmentIds.push(created.body.data.id);

    const updateRes = await hrManagerAgent
      .put(`/api/v1/departments/${created.body.data.id}`)
      .send({
        name: 'Research & Development',
        status: 'INACTIVE',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.name).toBe('Research & Development');
    expect(updateRes.body.data.status).toBe('INACTIVE');
  });

  it('blocks deactivating a department when active employees reference it with 409', async () => {
    // Create department
    const dept = await prisma.department.create({
      data: {
        name: 'Active Employees Dept',
        nameKey: 'active employees dept',
        status: 'ACTIVE',
      },
    });
    createdDepartmentIds.push(dept.id);

    // Create schedule
    const sched = await prisma.workingSchedule.create({
      data: {
        name: 'Dept Test Schedule',
        nameKey: 'dept test schedule',
        companyName: 'OXP Pvt Ltd',
        status: 'ACTIVE',
      },
    });
    createdScheduleIds.push(sched.id);

    // Create active employee in this department
    const emp = await prisma.employee.create({
      data: {
        employeeNumber: 'DEPTEST01',
        firstName: 'Dept',
        lastName: 'Worker',
        workEmail: 'dept.worker@example.com',
        jobPosition: 'Tester',
        employeeType: 'FULL_TIME',
        status: 'ACTIVE',
        departmentId: dept.id,
        workingScheduleId: sched.id,
      },
    });
    createdEmployeeIds.push(emp.id);

    // Attempt deactivation
    const res = await hrManagerAgent
      .put(`/api/v1/departments/${dept.id}`)
      .send({
        name: 'Active Employees Dept',
        status: 'INACTIVE',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DEPARTMENT_IN_USE');
  });

  it('returns 404 for DELETE route on departments', async () => {
    const res = await adminAgent.delete(`/api/v1/departments/${createdDepartmentIds[0]}`);
    expect(res.status).toBe(404);
  });
});
