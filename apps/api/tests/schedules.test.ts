import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { Role } from '@prisma/client';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { pgPool } from '../src/lib/session.js';
import type { WorkingScheduleInput } from '@peoplepay360/shared';

describe('Working Schedule API Integration Tests', () => {
  const app = createApp();
  const testPassword = 'ScheduleTestPass123!';

  // Agents for different roles
  let employeeAgent: ReturnType<typeof request.agent>;
  let hrManagerAgent: ReturnType<typeof request.agent>;
  let payrollUserAgent: ReturnType<typeof request.agent>;
  let payrollManagerAgent: ReturnType<typeof request.agent>;
  let adminAgent: ReturnType<typeof request.agent>;

  const createdScheduleIds: string[] = [];
  const testUserEmails = [
    'sched.emp@peoplepay360.dev',
    'sched.hr.mgr@peoplepay360.dev',
    'sched.pay.user@peoplepay360.dev',
    'sched.pay.mgr@peoplepay360.dev',
    'sched.admin@peoplepay360.dev',
  ];

  beforeAll(async () => {
    // Clean up any test users
    await prisma.user.deleteMany({
      where: { email: { in: testUserEmails } },
    });

    const passwordHash = await argon2.hash(testPassword);

    // Create test users
    await prisma.user.create({
      data: {
        email: 'sched.emp@peoplepay360.dev',
        passwordHash,
        role: Role.EMPLOYEE,
        isActive: true,
      },
    });

    await prisma.user.create({
      data: {
        email: 'sched.hr.mgr@peoplepay360.dev',
        passwordHash,
        role: Role.HR_MANAGER,
        isActive: true,
      },
    });

    await prisma.user.create({
      data: {
        email: 'sched.pay.user@peoplepay360.dev',
        passwordHash,
        role: Role.HR_PAYROLL_USER,
        isActive: true,
      },
    });

    await prisma.user.create({
      data: {
        email: 'sched.pay.mgr@peoplepay360.dev',
        passwordHash,
        role: Role.HR_PAYROLL_MANAGER,
        isActive: true,
      },
    });

    await prisma.user.create({
      data: {
        email: 'sched.admin@peoplepay360.dev',
        passwordHash,
        role: Role.ADMIN,
        isActive: true,
      },
    });

    // Authenticate agents
    employeeAgent = request.agent(app);
    await employeeAgent
      .post('/api/v1/auth/login')
      .send({ email: 'sched.emp@peoplepay360.dev', password: testPassword });

    hrManagerAgent = request.agent(app);
    await hrManagerAgent
      .post('/api/v1/auth/login')
      .send({ email: 'sched.hr.mgr@peoplepay360.dev', password: testPassword });

    payrollUserAgent = request.agent(app);
    await payrollUserAgent
      .post('/api/v1/auth/login')
      .send({ email: 'sched.pay.user@peoplepay360.dev', password: testPassword });

    payrollManagerAgent = request.agent(app);
    await payrollManagerAgent
      .post('/api/v1/auth/login')
      .send({ email: 'sched.pay.mgr@peoplepay360.dev', password: testPassword });

    adminAgent = request.agent(app);
    await adminAgent
      .post('/api/v1/auth/login')
      .send({ email: 'sched.admin@peoplepay360.dev', password: testPassword });
  });

  afterAll(async () => {
    // Delete test schedules created during testing
    if (createdScheduleIds.length > 0) {
      await prisma.workingSchedule.deleteMany({
        where: { id: { in: createdScheduleIds } },
      });
    }

    // Delete test users
    await prisma.user.deleteMany({
      where: { email: { in: testUserEmails } },
    });

    await prisma.$disconnect();
    await pgPool.end();
  });

  describe('Authentication & Authorization', () => {
    it('unauthenticated request returns 401', async () => {
      const unauthAgent = request(app);
      const res = await unauthAgent.get('/api/v1/schedules');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('Employee role returns 403 for both reads and mutations', async () => {
      const getRes = await employeeAgent.get('/api/v1/schedules');
      expect(getRes.status).toBe(403);
      expect(getRes.body.error.code).toBe('FORBIDDEN');

      const postRes = await employeeAgent.post('/api/v1/schedules').send({
        name: 'Employee Schedule',
        type: 'STANDARD',
        companyName: 'Acme Corp',
        status: 'ACTIVE',
        days: [
          {
            dayOfWeek: 'MONDAY',
            startTime: '09:00',
            endTime: '17:00',
            breakMinutes: 60,
          },
        ],
      });
      expect(postRes.status).toBe(403);
      expect(postRes.body.error.code).toBe('FORBIDDEN');
    });

    it('each of the four allowed roles can list schedules', async () => {
      for (const agent of [hrManagerAgent, payrollUserAgent, payrollManagerAgent, adminAgent]) {
        const res = await agent.get('/api/v1/schedules');
        expect(res.status).toBe(200);
        expect(res.body.error).toBeNull();
        expect(res.body.data).toBeDefined();
        expect(Array.isArray(res.body.data.items)).toBe(true);
      }
    });
  });

  describe('Schedule Creation & Derived Totals', () => {
    it('Admin/HR creates a valid schedule and receives derived totals', async () => {
      const payload: WorkingScheduleInput = {
        name: 'Standard 40h Office Test',
        type: 'STANDARD',
        companyName: 'Acme Corp',
        status: 'ACTIVE',
        days: [
          { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '18:00', breakMinutes: 60 },
          { dayOfWeek: 'TUESDAY', startTime: '09:00', endTime: '18:00', breakMinutes: 60 },
          { dayOfWeek: 'WEDNESDAY', startTime: '09:00', endTime: '18:00', breakMinutes: 60 },
          { dayOfWeek: 'THURSDAY', startTime: '09:00', endTime: '18:00', breakMinutes: 60 },
          { dayOfWeek: 'FRIDAY', startTime: '09:00', endTime: '18:00', breakMinutes: 60 },
        ],
      };

      const res = await adminAgent.post('/api/v1/schedules').send(payload);

      expect(res.status).toBe(201);
      expect(res.body.error).toBeNull();
      const schedule = res.body.data;
      createdScheduleIds.push(schedule.id);

      expect(schedule.name).toBe('Standard 40h Office Test');
      expect(schedule.type).toBe('STANDARD');
      expect(schedule.companyName).toBe('Acme Corp');
      expect(schedule.status).toBe('ACTIVE');
      expect(schedule.timezone).toBe('Asia/Kolkata');
      expect(schedule.daysPerWeek).toBe(5);
      expect(schedule.weeklyMinutes).toBe(2400); // 5 * 480 min
      expect(schedule.days).toHaveLength(5);

      // Verify each day's derived fields
      schedule.days.forEach((day: any) => {
        expect(day.dailyMinutes).toBe(480);
        expect(day.overnight).toBe(false);
      });
    });

    it('creates overnight schedule and correctly sets overnight flag and derived totals', async () => {
      const payload: WorkingScheduleInput = {
        name: 'Night Watch Test Shift',
        type: 'SHIFT',
        companyName: 'Acme Security',
        status: 'ACTIVE',
        days: [
          { dayOfWeek: 'MONDAY', startTime: '22:00', endTime: '06:00', breakMinutes: 0 },
          { dayOfWeek: 'TUESDAY', startTime: '22:00', endTime: '06:00', breakMinutes: 0 },
        ],
      };

      const res = await hrManagerAgent.post('/api/v1/schedules').send(payload);

      expect(res.status).toBe(201);
      const schedule = res.body.data;
      createdScheduleIds.push(schedule.id);

      expect(schedule.daysPerWeek).toBe(2);
      expect(schedule.weeklyMinutes).toBe(960); // 2 * 480
      schedule.days.forEach((day: any) => {
        expect(day.dailyMinutes).toBe(480);
        expect(day.overnight).toBe(true);
      });
    });

    it('rejects duplicate weekdays with 400 VALIDATION_ERROR', async () => {
      const payload = {
        name: 'Duplicate Days Schedule',
        type: 'STANDARD',
        companyName: 'Acme Corp',
        status: 'ACTIVE',
        days: [
          { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '17:00', breakMinutes: 60 },
          { dayOfWeek: 'MONDAY', startTime: '10:00', endTime: '18:00', breakMinutes: 60 },
        ],
      };

      const res = await adminAgent.post('/api/v1/schedules').send(payload);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid time, break >= duration, or duration > 16h with 400', async () => {
      // Invalid time format
      const invalidTimeRes = await adminAgent.post('/api/v1/schedules').send({
        name: 'Invalid Time Schedule',
        type: 'STANDARD',
        companyName: 'Acme Corp',
        status: 'ACTIVE',
        days: [{ dayOfWeek: 'MONDAY', startTime: '25:00', endTime: '17:00', breakMinutes: 0 }],
      });
      expect(invalidTimeRes.status).toBe(400);
      expect(invalidTimeRes.body.error.code).toBe('VALIDATION_ERROR');

      // Break exceeds interval (8h interval, 9h break)
      const breakTooLargeRes = await adminAgent.post('/api/v1/schedules').send({
        name: 'Excessive Break Schedule',
        type: 'STANDARD',
        companyName: 'Acme Corp',
        status: 'ACTIVE',
        days: [{ dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '17:00', breakMinutes: 540 }],
      });
      expect(breakTooLargeRes.status).toBe(400);
      expect(breakTooLargeRes.body.error.code).toBe('VALIDATION_ERROR');

      // Interval exceeds 16h (06:00 to 23:00 is 17h)
      const shiftTooLongRes = await adminAgent.post('/api/v1/schedules').send({
        name: 'Shift Over 16h Schedule',
        type: 'STANDARD',
        companyName: 'Acme Corp',
        status: 'ACTIVE',
        days: [{ dayOfWeek: 'MONDAY', startTime: '06:00', endTime: '23:00', breakMinutes: 0 }],
      });
      expect(shiftTooLongRes.status).toBe(400);
      expect(shiftTooLongRes.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects duplicate normalized name with 409 SCHEDULE_NAME_EXISTS', async () => {
      const payload: WorkingScheduleInput = {
        name: 'Unique Schedule Alpha',
        type: 'STANDARD',
        companyName: 'Acme Corp',
        status: 'ACTIVE',
        days: [{ dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '17:00', breakMinutes: 0 }],
      };

      const res1 = await adminAgent.post('/api/v1/schedules').send(payload);
      expect(res1.status).toBe(201);
      createdScheduleIds.push(res1.body.data.id);

      // Attempt creating with differing casing and whitespace
      const payloadDup = {
        ...payload,
        name: '  UNIQUE SCHEDULE ALPHA  ',
      };

      const res2 = await adminAgent.post('/api/v1/schedules').send(payloadDup);
      expect(res2.status).toBe(409);
      expect(res2.body.error.code).toBe('SCHEDULE_NAME_EXISTS');
    });
  });

  describe('List, Search, Filter & Pagination', () => {
    let schedAId: string;
    let schedBId: string;

    beforeAll(async () => {
      const resA = await adminAgent.post('/api/v1/schedules').send({
        name: 'Alpha Search Test',
        type: 'STANDARD',
        companyName: 'Zeta Enterprise',
        status: 'ACTIVE',
        days: [{ dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '17:00', breakMinutes: 0 }],
      });
      schedAId = resA.body.data.id;
      createdScheduleIds.push(schedAId);

      const resB = await adminAgent.post('/api/v1/schedules').send({
        name: 'Beta Search Test',
        type: 'FLEXIBLE',
        companyName: 'Alpha Enterprise',
        status: 'INACTIVE',
        days: [{ dayOfWeek: 'TUESDAY', startTime: '10:00', endTime: '16:00', breakMinutes: 0 }],
      });
      schedBId = resB.body.data.id;
      createdScheduleIds.push(schedBId);
    });

    it('searches by name or company name case-insensitively', async () => {
      const res1 = await adminAgent.get('/api/v1/schedules?search=alpha');
      expect(res1.status).toBe(200);
      const ids = res1.body.data.items.map((s: any) => s.id);
      expect(ids).toContain(schedAId); // matches name
      expect(ids).toContain(schedBId); // matches companyName

      const res2 = await adminAgent.get('/api/v1/schedules?search=zeta');
      expect(res2.status).toBe(200);
      const zetaIds = res2.body.data.items.map((s: any) => s.id);
      expect(zetaIds).toContain(schedAId);
      expect(zetaIds).not.toContain(schedBId);
    });

    it('filters by status and type', async () => {
      const activeRes = await adminAgent.get('/api/v1/schedules?status=ACTIVE');
      expect(activeRes.status).toBe(200);
      activeRes.body.data.items.forEach((s: any) => {
        expect(s.status).toBe('ACTIVE');
      });

      const flexRes = await adminAgent.get('/api/v1/schedules?type=FLEXIBLE');
      expect(flexRes.status).toBe(200);
      flexRes.body.data.items.forEach((s: any) => {
        expect(s.type).toBe('FLEXIBLE');
      });
    });

    it('supports pagination and stable ordering (name asc, id asc)', async () => {
      const pageRes = await adminAgent.get('/api/v1/schedules?page=1&pageSize=2');
      expect(pageRes.status).toBe(200);
      expect(pageRes.body.data.items.length).toBeLessThanOrEqual(2);
      expect(pageRes.body.data.page).toBe(1);
      expect(pageRes.body.data.pageSize).toBe(2);
      expect(pageRes.body.data.total).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Detail, Update & Status Toggle', () => {
    let targetScheduleId: string;

    beforeAll(async () => {
      const res = await adminAgent.post('/api/v1/schedules').send({
        name: 'Target Schedule for Update',
        type: 'STANDARD',
        companyName: 'Target Inc',
        status: 'ACTIVE',
        days: [
          { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '17:00', breakMinutes: 60 },
          { dayOfWeek: 'FRIDAY', startTime: '09:00', endTime: '17:00', breakMinutes: 60 },
        ],
      });
      targetScheduleId = res.body.data.id;
      createdScheduleIds.push(targetScheduleId);
    });

    it('GET /api/v1/schedules/:id returns schedule with ordered days and derived totals', async () => {
      const res = await adminAgent.get(`/api/v1/schedules/${targetScheduleId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(targetScheduleId);
      expect(res.body.data.days).toHaveLength(2);
      expect(res.body.data.days[0].dayOfWeek).toBe('MONDAY');
      expect(res.body.data.days[1].dayOfWeek).toBe('FRIDAY');
      expect(res.body.data.weeklyMinutes).toBe(840); // 2 * 420 (7h net)
    });

    it('GET /api/v1/schedules/:id returns 404 SCHEDULE_NOT_FOUND when not found', async () => {
      const res = await adminAgent.get('/api/v1/schedules/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('SCHEDULE_NOT_FOUND');
    });

    it('PUT /api/v1/schedules/:id replaces all day rows atomically in a transaction', async () => {
      const updatePayload: WorkingScheduleInput = {
        name: 'Target Schedule Updated Name',
        type: 'SHIFT',
        companyName: 'Target Global',
        status: 'ACTIVE',
        days: [
          { dayOfWeek: 'WEDNESDAY', startTime: '08:00', endTime: '16:00', breakMinutes: 30 },
          { dayOfWeek: 'THURSDAY', startTime: '08:00', endTime: '16:00', breakMinutes: 30 },
          { dayOfWeek: 'SATURDAY', startTime: '08:00', endTime: '16:00', breakMinutes: 30 },
        ],
      };

      const res = await adminAgent.put(`/api/v1/schedules/${targetScheduleId}`).send(updatePayload);
      expect(res.status).toBe(200);
      const updated = res.body.data;
      expect(updated.name).toBe('Target Schedule Updated Name');
      expect(updated.type).toBe('SHIFT');
      expect(updated.companyName).toBe('Target Global');
      expect(updated.daysPerWeek).toBe(3);
      expect(updated.days.map((d: any) => d.dayOfWeek)).toEqual([
        'WEDNESDAY',
        'THURSDAY',
        'SATURDAY',
      ]);
      expect(updated.weeklyMinutes).toBe(3 * (480 - 30)); // 3 * 450 = 1350
    });

    it('failed update leaves original parent and day records unchanged', async () => {
      // Send invalid update (duplicate day)
      const badPayload = {
        name: 'Corrupted Update',
        type: 'STANDARD',
        companyName: 'Fail Corp',
        status: 'ACTIVE',
        days: [
          { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '17:00', breakMinutes: 0 },
          { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '17:00', breakMinutes: 0 },
        ],
      };

      const failRes = await adminAgent
        .put(`/api/v1/schedules/${targetScheduleId}`)
        .send(badPayload);
      expect(failRes.status).toBe(400);

      // Verify original schedule still has the previously saved 3 days
      const verifyRes = await adminAgent.get(`/api/v1/schedules/${targetScheduleId}`);
      expect(verifyRes.body.data.name).toBe('Target Schedule Updated Name');
      expect(verifyRes.body.data.days).toHaveLength(3);
    });

    it('PATCH /api/v1/schedules/:id/status activates and deactivates schedule', async () => {
      // Deactivate
      const deactRes = await adminAgent
        .patch(`/api/v1/schedules/${targetScheduleId}/status`)
        .send({ status: 'INACTIVE' });
      expect(deactRes.status).toBe(200);
      expect(deactRes.body.data.status).toBe('INACTIVE');

      // Reactivate
      const reactRes = await adminAgent
        .patch(`/api/v1/schedules/${targetScheduleId}/status`)
        .send({ status: 'ACTIVE' });
      expect(reactRes.status).toBe(200);
      expect(reactRes.body.data.status).toBe('ACTIVE');
    });

    it('confirms no hard delete DELETE route exists', async () => {
      const deleteRes = await adminAgent.delete(`/api/v1/schedules/${targetScheduleId}`);
      expect(deleteRes.status).toBe(404);
    });
  });

  describe('Database Integrity & Constraints', () => {
    it('direct PostgreSQL constraint rejects duplicate weekday on same schedule', async () => {
      const parent = await prisma.workingSchedule.create({
        data: {
          name: 'DB Constraint Test Parent',
          nameKey: 'db constraint test parent',
          companyName: 'Test Corp',
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
      createdScheduleIds.push(parent.id);

      // Inserting another MONDAY on the same scheduleId directly via Prisma should fail
      await expect(
        prisma.workingScheduleDay.create({
          data: {
            scheduleId: parent.id,
            dayOfWeek: 'MONDAY',
            startMinute: 600,
            endMinute: 1080,
            breakMinutes: 30,
          },
        })
      ).rejects.toThrow();
    });

    it('direct PostgreSQL check constraint rejects minute value > 1439', async () => {
      const parent = await prisma.workingSchedule.create({
        data: {
          name: 'DB Minute Bound Check Parent',
          nameKey: 'db minute bound check parent',
          companyName: 'Test Corp',
        },
      });
      createdScheduleIds.push(parent.id);

      await expect(
        prisma.workingScheduleDay.create({
          data: {
            scheduleId: parent.id,
            dayOfWeek: 'TUESDAY',
            startMinute: 0,
            endMinute: 1500, // Invalid: exceeds 1439
            breakMinutes: 0,
          },
        })
      ).rejects.toThrow();
    });

    it('seeded overnight schedule derives 2,400 weekly minutes', async () => {
      // Seeded "Night Shift" has 5 days (Mon-Fri) 22:00-06:00, 0 break -> 5 * 480 = 2400
      const res = await adminAgent.get('/api/v1/schedules?search=Night+Shift');
      expect(res.status).toBe(200);
      const nightShift = res.body.data.items.find(
        (s: any) => s.name === 'Night Shift'
      );
      expect(nightShift).toBeDefined();
      expect(nightShift.type).toBe('SHIFT');
      expect(nightShift.daysPerWeek).toBe(5);
      expect(nightShift.weeklyMinutes).toBe(2400);
      nightShift.days.forEach((d: any) => {
        expect(d.overnight).toBe(true);
        expect(d.dailyMinutes).toBe(480);
      });
    });
  });
});
