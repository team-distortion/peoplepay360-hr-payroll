import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { Role } from '@prisma/client';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { pgPool } from '../src/lib/session.js';
import type { EmployeeInput } from '@peoplepay360/shared';

describe('Employee API Integration Tests', () => {
  const app = createApp();
  const testPassword = 'EmployeeTestPass123!';

  let employeeAgent: ReturnType<typeof request.agent>;
  let otherEmployeeAgent: ReturnType<typeof request.agent>;
  let unlinkedEmployeeAgent: ReturnType<typeof request.agent>;
  let hrManagerAgent: ReturnType<typeof request.agent>;
  let adminAgent: ReturnType<typeof request.agent>;

  let activeDepartmentId: string;
  let inactiveDepartmentId: string;
  let activeScheduleId: string;
  let inactiveScheduleId: string;

  let linkedEmployeeId: string;
  let otherEmployeeId: string;

  const createdEmployeeIds: string[] = [];
  const testUserEmails = [
    'emp.test.user1@peoplepay360.dev',
    'emp.test.user2@peoplepay360.dev',
    'emp.test.unlinked@peoplepay360.dev',
    'emp.test.hr@peoplepay360.dev',
    'emp.test.admin@peoplepay360.dev',
  ];

  beforeAll(async () => {
    // Clean up test users
    await prisma.user.deleteMany({
      where: { email: { in: testUserEmails } },
    });

    const passwordHash = await argon2.hash(testPassword);

    // Create Departments
    const activeDept = await prisma.department.create({
      data: {
        name: 'Employee Test Dept Active',
        nameKey: 'employee test dept active',
        status: 'ACTIVE',
      },
    });
    activeDepartmentId = activeDept.id;

    const inactiveDept = await prisma.department.create({
      data: {
        name: 'Employee Test Dept Inactive',
        nameKey: 'employee test dept inactive',
        status: 'INACTIVE',
      },
    });
    inactiveDepartmentId = inactiveDept.id;

    // Create Schedules
    const activeSched = await prisma.workingSchedule.create({
      data: {
        name: 'Employee Test Schedule Active',
        nameKey: 'employee test schedule active',
        companyName: 'OXP Pvt Ltd',
        status: 'ACTIVE',
        days: {
          create: [
            {
              dayOfWeek: 'MONDAY',
              startMinute: 540,
              endMinute: 1020,
              breakMinutes: 60,
            },
          ],
        },
      },
    });
    activeScheduleId = activeSched.id;

    const inactiveSched = await prisma.workingSchedule.create({
      data: {
        name: 'Employee Test Schedule Inactive',
        nameKey: 'employee test schedule inactive',
        companyName: 'OXP Pvt Ltd',
        status: 'INACTIVE',
      },
    });
    inactiveScheduleId = inactiveSched.id;

    // Create initial employees for tests
    const emp1 = await prisma.employee.create({
      data: {
        employeeNumber: 'EMPTEST001',
        firstName: 'Primary',
        lastName: 'Worker',
        workEmail: 'primary.worker@example.com',
        jobPosition: 'Software Engineer',
        employeeType: 'FULL_TIME',
        status: 'ACTIVE',
        departmentId: activeDepartmentId,
        workingScheduleId: activeScheduleId,
        personalEmail: 'primary.personal@example.com',
        bankAccountName: 'Primary Worker',
        bankAccountNumber: '987654321012',
      },
    });
    linkedEmployeeId = emp1.id;
    createdEmployeeIds.push(emp1.id);

    const emp2 = await prisma.employee.create({
      data: {
        employeeNumber: 'EMPTEST002',
        firstName: 'Secondary',
        lastName: 'Staff',
        workEmail: 'secondary.staff@example.com',
        jobPosition: 'QA Engineer',
        employeeType: 'CONTRACT',
        status: 'ACTIVE',
        departmentId: activeDepartmentId,
        workingScheduleId: activeScheduleId,
      },
    });
    otherEmployeeId = emp2.id;
    createdEmployeeIds.push(emp2.id);

    // Create Users
    await prisma.user.create({
      data: {
        email: 'emp.test.user1@peoplepay360.dev',
        passwordHash,
        role: Role.EMPLOYEE,
        employeeId: linkedEmployeeId,
        isActive: true,
      },
    });

    await prisma.user.create({
      data: {
        email: 'emp.test.user2@peoplepay360.dev',
        passwordHash,
        role: Role.EMPLOYEE,
        employeeId: otherEmployeeId,
        isActive: true,
      },
    });

    await prisma.user.create({
      data: {
        email: 'emp.test.unlinked@peoplepay360.dev',
        passwordHash,
        role: Role.EMPLOYEE,
        isActive: true,
      },
    });

    await prisma.user.create({
      data: {
        email: 'emp.test.hr@peoplepay360.dev',
        passwordHash,
        role: Role.HR_MANAGER,
        isActive: true,
      },
    });

    await prisma.user.create({
      data: {
        email: 'emp.test.admin@peoplepay360.dev',
        passwordHash,
        role: Role.ADMIN,
        isActive: true,
      },
    });

    // Login agents
    employeeAgent = request.agent(app);
    await employeeAgent
      .post('/api/v1/auth/login')
      .send({ email: 'emp.test.user1@peoplepay360.dev', password: testPassword });

    otherEmployeeAgent = request.agent(app);
    await otherEmployeeAgent
      .post('/api/v1/auth/login')
      .send({ email: 'emp.test.user2@peoplepay360.dev', password: testPassword });

    unlinkedEmployeeAgent = request.agent(app);
    await unlinkedEmployeeAgent
      .post('/api/v1/auth/login')
      .send({ email: 'emp.test.unlinked@peoplepay360.dev', password: testPassword });

    hrManagerAgent = request.agent(app);
    await hrManagerAgent
      .post('/api/v1/auth/login')
      .send({ email: 'emp.test.hr@peoplepay360.dev', password: testPassword });

    adminAgent = request.agent(app);
    await adminAgent
      .post('/api/v1/auth/login')
      .send({ email: 'emp.test.admin@peoplepay360.dev', password: testPassword });
  });

  afterAll(async () => {
    // Unlink users first
    await prisma.user.deleteMany({
      where: { email: { in: testUserEmails } },
    });

    // Delete created employees
    if (createdEmployeeIds.length > 0) {
      await prisma.employee.deleteMany({
        where: { id: { in: createdEmployeeIds } },
      });
    }

    // Delete departments
    await prisma.department.deleteMany({
      where: { id: { in: [activeDepartmentId, inactiveDepartmentId] } },
    });

    // Delete schedules
    await prisma.workingScheduleDay.deleteMany({
      where: { scheduleId: { in: [activeScheduleId, inactiveScheduleId] } },
    });
    await prisma.workingSchedule.deleteMany({
      where: { id: { in: [activeScheduleId, inactiveScheduleId] } },
    });

    await pgPool.end();
    await prisma.$disconnect();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/employees');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('denies Employee role from listing employees with 403', async () => {
    const res = await employeeAgent.get('/api/v1/employees');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows Employee role to fetch own profile via /me', async () => {
    const res = await employeeAgent.get('/api/v1/employees/me');
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(linkedEmployeeId);
    expect(res.body.data.fullName).toBe('Primary Worker');
    expect(res.body.data.companyName).toBeDefined();
    expect(res.body.data.bankAccountNumber).toBe('987654321012');
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('allows Employee role to fetch own profile via /:id', async () => {
    const res = await employeeAgent.get(`/api/v1/employees/${linkedEmployeeId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(linkedEmployeeId);
  });

  it('denies Employee role from reading another employee with 403', async () => {
    const res = await employeeAgent.get(`/api/v1/employees/${otherEmployeeId}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 403 EMPLOYEE_PROFILE_NOT_LINKED for unlinked user on /me', async () => {
    const res = await unlinkedEmployeeAgent.get('/api/v1/employees/me');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('EMPLOYEE_PROFILE_NOT_LINKED');
  });

  it('allows HR Manager to list employees, excluding private/bank fields', async () => {
    const res = await hrManagerAgent.get('/api/v1/employees');
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data.total).toBeGreaterThanOrEqual(2);

    const first = res.body.data.items.find((i: any) => i.id === linkedEmployeeId);
    expect(first).toBeDefined();
    expect(first.fullName).toBe('Primary Worker');
    expect(first.initials).toBe('PW');
    // Ensure private fields are excluded
    expect(first.bankAccountNumber).toBeUndefined();
    expect(first.bankAccountName).toBeUndefined();
    expect(first.personalEmail).toBeUndefined();
    expect(first.dateOfBirth).toBeUndefined();
  });

  it('allows creating an employee with valid data', async () => {
    const input: EmployeeInput = {
      employeeNumber: 'EMPTESTNEW01',
      firstName: 'Rohan',
      lastName: 'Sharma',
      workEmail: 'rohan.sharma@example.com',
      workPhone: '+91 99887 76655',
      jobPosition: 'Product Designer',
      employeeType: 'FULL_TIME',
      status: 'ACTIVE',
      workLocation: 'Bengaluru',
      departmentId: activeDepartmentId,
      managerId: linkedEmployeeId,
      workingScheduleId: activeScheduleId,
      personalEmail: 'rohan.personal@example.com',
      personalPhone: '+91 99887 76654',
      dateOfBirth: '1995-05-12',
      personalAddress: '123 Tech Park Road',
      emergencyContactName: 'Anita Sharma',
      emergencyContactPhone: '+91 99887 76650',
      bankAccountName: 'Rohan Sharma',
      bankAccountNumber: '123456789012',
      bankName: 'HDFC Bank',
      bankIfsc: 'HDFC0001234',
    };

    const res = await hrManagerAgent.post('/api/v1/employees').send(input);
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.employeeNumber).toBe('EMPTESTNEW01');
    expect(res.body.data.fullName).toBe('Rohan Sharma');
    expect(res.body.data.manager.id).toBe(linkedEmployeeId);
    expect(res.body.data.bankIfsc).toBe('HDFC0001234');

    createdEmployeeIds.push(res.body.data.id);
  });

  it('rejects duplicate employee number with 409', async () => {
    const input: EmployeeInput = {
      employeeNumber: 'EMPTEST001',
      firstName: 'Duplicate',
      lastName: 'Number',
      workEmail: 'dup.number@example.com',
      workPhone: null,
      jobPosition: 'QA',
      employeeType: 'FULL_TIME',
      status: 'ACTIVE',
      workLocation: null,
      departmentId: activeDepartmentId,
      managerId: null,
      workingScheduleId: activeScheduleId,
      personalEmail: null,
      personalPhone: null,
      dateOfBirth: null,
      personalAddress: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
      bankAccountName: null,
      bankAccountNumber: null,
      bankName: null,
      bankIfsc: null,
    };

    const res = await hrManagerAgent.post('/api/v1/employees').send(input);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMPLOYEE_NUMBER_EXISTS');
  });

  it('rejects duplicate work email case-insensitively with 409', async () => {
    const input: EmployeeInput = {
      employeeNumber: 'EMPTESTNEW02',
      firstName: 'Duplicate',
      lastName: 'Email',
      workEmail: '  PRIMARY.WORKER@EXAMPLE.COM  ',
      workPhone: null,
      jobPosition: 'QA',
      employeeType: 'FULL_TIME',
      status: 'ACTIVE',
      workLocation: null,
      departmentId: activeDepartmentId,
      managerId: null,
      workingScheduleId: activeScheduleId,
      personalEmail: null,
      personalPhone: null,
      dateOfBirth: null,
      personalAddress: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
      bankAccountName: null,
      bankAccountNumber: null,
      bankName: null,
      bankIfsc: null,
    };

    const res = await hrManagerAgent.post('/api/v1/employees').send(input);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMPLOYEE_EMAIL_EXISTS');
  });

  it('rejects active employee with inactive department with 409', async () => {
    const input: EmployeeInput = {
      employeeNumber: 'EMPTESTNEW03',
      firstName: 'Inactive',
      lastName: 'Dept',
      workEmail: 'inactive.dept@example.com',
      workPhone: null,
      jobPosition: 'QA',
      employeeType: 'FULL_TIME',
      status: 'ACTIVE',
      workLocation: null,
      departmentId: inactiveDepartmentId,
      managerId: null,
      workingScheduleId: activeScheduleId,
      personalEmail: null,
      personalPhone: null,
      dateOfBirth: null,
      personalAddress: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
      bankAccountName: null,
      bankAccountNumber: null,
      bankName: null,
      bankIfsc: null,
    };

    const res = await hrManagerAgent.post('/api/v1/employees').send(input);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INACTIVE_DEPARTMENT');
  });

  it('rejects active employee with inactive schedule with 409', async () => {
    const input: EmployeeInput = {
      employeeNumber: 'EMPTESTNEW04',
      firstName: 'Inactive',
      lastName: 'Schedule',
      workEmail: 'inactive.sched@example.com',
      workPhone: null,
      jobPosition: 'QA',
      employeeType: 'FULL_TIME',
      status: 'ACTIVE',
      workLocation: null,
      departmentId: activeDepartmentId,
      managerId: null,
      workingScheduleId: inactiveScheduleId,
      personalEmail: null,
      personalPhone: null,
      dateOfBirth: null,
      personalAddress: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
      bankAccountName: null,
      bankAccountNumber: null,
      bankName: null,
      bankIfsc: null,
    };

    const res = await hrManagerAgent.post('/api/v1/employees').send(input);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INACTIVE_SCHEDULE');
  });

  it('rejects self-manager and cyclical manager relationships with 409', async () => {
    // 1. Self manager
    const updateSelf = await hrManagerAgent
      .put(`/api/v1/employees/${linkedEmployeeId}`)
      .send({
        employeeNumber: 'EMPTEST001',
        firstName: 'Primary',
        lastName: 'Worker',
        workEmail: 'primary.worker@example.com',
        workPhone: null,
        jobPosition: 'Software Engineer',
        employeeType: 'FULL_TIME',
        status: 'ACTIVE',
        workLocation: null,
        departmentId: activeDepartmentId,
        managerId: linkedEmployeeId,
        workingScheduleId: activeScheduleId,
        personalEmail: null,
        personalPhone: null,
        dateOfBirth: null,
        personalAddress: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        bankAccountName: null,
        bankAccountNumber: null,
        bankName: null,
        bankIfsc: null,
      });

    expect(updateSelf.status).toBe(409);
    expect(updateSelf.body.error.code).toBe('INVALID_MANAGER_RELATIONSHIP');

    // 2. Direct cycle: set otherEmployee's manager to linkedEmployee, then set linkedEmployee's manager to otherEmployee
    await hrManagerAgent
      .put(`/api/v1/employees/${otherEmployeeId}`)
      .send({
        employeeNumber: 'EMPTEST002',
        firstName: 'Secondary',
        lastName: 'Staff',
        workEmail: 'secondary.staff@example.com',
        workPhone: null,
        jobPosition: 'QA Engineer',
        employeeType: 'CONTRACT',
        status: 'ACTIVE',
        workLocation: null,
        departmentId: activeDepartmentId,
        managerId: linkedEmployeeId,
        workingScheduleId: activeScheduleId,
        personalEmail: null,
        personalPhone: null,
        dateOfBirth: null,
        personalAddress: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        bankAccountName: null,
        bankAccountNumber: null,
        bankName: null,
        bankIfsc: null,
      });

    // Now try to set linkedEmployee's manager to otherEmployee
    const cycleRes = await hrManagerAgent
      .put(`/api/v1/employees/${linkedEmployeeId}`)
      .send({
        employeeNumber: 'EMPTEST001',
        firstName: 'Primary',
        lastName: 'Worker',
        workEmail: 'primary.worker@example.com',
        workPhone: null,
        jobPosition: 'Software Engineer',
        employeeType: 'FULL_TIME',
        status: 'ACTIVE',
        workLocation: null,
        departmentId: activeDepartmentId,
        managerId: otherEmployeeId,
        workingScheduleId: activeScheduleId,
        personalEmail: null,
        personalPhone: null,
        dateOfBirth: null,
        personalAddress: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        bankAccountName: null,
        bankAccountNumber: null,
        bankName: null,
        bankIfsc: null,
      });

    expect(cycleRes.status).toBe(409);
    expect(cycleRes.body.error.code).toBe('INVALID_MANAGER_RELATIONSHIP');
  });

  it('allows deactivating and reactivating employee status', async () => {
    // Deactivate
    const deactRes = await hrManagerAgent
      .patch(`/api/v1/employees/${linkedEmployeeId}/status`)
      .send({ status: 'INACTIVE' });

    expect(deactRes.status).toBe(200);
    expect(deactRes.body.data.status).toBe('INACTIVE');

    // Reactivate
    const reactRes = await hrManagerAgent
      .patch(`/api/v1/employees/${linkedEmployeeId}/status`)
      .send({ status: 'ACTIVE' });

    expect(reactRes.status).toBe(200);
    expect(reactRes.body.data.status).toBe('ACTIVE');
  });

  it('returns 404 for DELETE route on employees', async () => {
    const res = await adminAgent.delete(`/api/v1/employees/${linkedEmployeeId}`);
    expect(res.status).toBe(404);
  });
});
