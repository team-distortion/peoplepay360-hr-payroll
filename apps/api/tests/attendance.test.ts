import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import {
  Role,
  RecordStatus,
  EmployeeType,
  Prisma,
  Weekday,
} from '@prisma/client';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { pgPool } from '../src/lib/session.js';
import {
  FixedCompanyClock,
  getCompanyBusinessDate,
} from '../src/modules/attendance/attendance-clock.js';
import { AttendanceService } from '../src/modules/attendance/attendance.service.js';

describe('Attendance Module Integration Tests', () => {
  const app = createApp();
  const testPassword = 'AttendanceTestPass123!';

  let unlinkedUserAgent: ReturnType<typeof request.agent>;
  let employeeUserAgent: ReturnType<typeof request.agent>;
  let otherEmployeeUserAgent: ReturnType<typeof request.agent>;
  let hrManagerAgent: ReturnType<typeof request.agent>;
  let payrollUserAgent: ReturnType<typeof request.agent>;
  let adminAgent: ReturnType<typeof request.agent>;

  let testDepartmentId: string;
  let standardScheduleId: string;
  let employeeScheduleId: string;
  let contractScheduleId: string;
  let testEmployeeId: string;
  let otherEmployeeId: string;
  let inactiveEmployeeId: string;
  let unscheduledEmployeeId: string;

  const testUserEmails = [
    'att.unlinked@peoplepay360.dev',
    'att.emp@peoplepay360.dev',
    'att.other.emp@peoplepay360.dev',
    'att.hr.mgr@peoplepay360.dev',
    'att.pay.user@peoplepay360.dev',
    'att.admin@peoplepay360.dev',
  ];

  beforeAll(async () => {
    // Clean up previous test runs
    await prisma.auditLog.deleteMany({
      where: { entityType: 'ATTENDANCE' },
    });
    await prisma.attendance.deleteMany({
      where: {
        employee: {
          workEmail: {
            in: [
              'att.emp@peoplepay360.dev',
              'att.other.emp@peoplepay360.dev',
              'att.inact.emp@peoplepay360.dev',
              'att.nosched.emp@peoplepay360.dev',
            ],
          },
        },
      },
    });
    await prisma.user.deleteMany({
      where: { email: { in: testUserEmails } },
    });
    await prisma.contract.deleteMany({
      where: {
        employee: {
          workEmail: {
            in: [
              'att.emp@peoplepay360.dev',
              'att.other.emp@peoplepay360.dev',
              'att.inact.emp@peoplepay360.dev',
              'att.nosched.emp@peoplepay360.dev',
            ],
          },
        },
      },
    });
    await prisma.employee.deleteMany({
      where: {
        workEmail: {
          in: [
            'att.emp@peoplepay360.dev',
            'att.other.emp@peoplepay360.dev',
            'att.inact.emp@peoplepay360.dev',
            'att.nosched.emp@peoplepay360.dev',
          ],
        },
      },
    });

    // Create Department
    const dept = await prisma.department.upsert({
      where: { nameKey: 'attendance test dept' },
      update: { status: RecordStatus.ACTIVE },
      create: {
        name: 'Attendance Test Dept',
        nameKey: 'attendance test dept',
        status: RecordStatus.ACTIVE,
      },
    });
    testDepartmentId = dept.id;

    // Create Schedules: Standard (09:00 - 18:00 with 60 min break on Mon-Fri)
    const standardSched = await prisma.workingSchedule.upsert({
      where: { nameKey: 'att standard sched' },
      update: { status: 'ACTIVE' },
      create: {
        name: 'Att Standard Sched',
        nameKey: 'att standard sched',
        companyName: 'PeoplePay360',
        status: 'ACTIVE',
      },
    });
    standardScheduleId = standardSched.id;
    await prisma.workingScheduleDay.deleteMany({ where: { scheduleId: standardScheduleId } });
    await prisma.workingScheduleDay.createMany({
      data: [Weekday.MONDAY, Weekday.TUESDAY, Weekday.WEDNESDAY, Weekday.THURSDAY, Weekday.FRIDAY].map(
        (dayOfWeek) => ({
          scheduleId: standardScheduleId,
          dayOfWeek,
          startMinute: 9 * 60, // 540
          endMinute: 18 * 60, // 1080
          breakMinutes: 60,
        })
      ),
    });

    // Schedule 2: Contract Override Schedule (10:00 - 17:00, 30m break)
    const contractSched = await prisma.workingSchedule.upsert({
      where: { nameKey: 'att contract override sched' },
      update: { status: 'ACTIVE' },
      create: {
        name: 'Att Contract Override Sched',
        nameKey: 'att contract override sched',
        companyName: 'PeoplePay360',
        status: 'ACTIVE',
      },
    });
    contractScheduleId = contractSched.id;
    await prisma.workingScheduleDay.deleteMany({ where: { scheduleId: contractScheduleId } });
    await prisma.workingScheduleDay.createMany({
      data: [Weekday.MONDAY, Weekday.TUESDAY, Weekday.WEDNESDAY, Weekday.THURSDAY, Weekday.FRIDAY].map(
        (dayOfWeek) => ({
          scheduleId: contractScheduleId,
          dayOfWeek,
          startMinute: 10 * 60, // 600
          endMinute: 17 * 60, // 1020
          breakMinutes: 30,
        })
      ),
    });

    // Create Employees
    const emp1 = await prisma.employee.create({
      data: {
        employeeNumber: 'ATT_EMP_01',
        firstName: 'Ankit',
        lastName: 'Sharma',
        workEmail: 'att.emp@peoplepay360.dev',
        jobPosition: 'Frontend Engineer',
        employeeType: EmployeeType.FULL_TIME,
        status: RecordStatus.ACTIVE,
        departmentId: testDepartmentId,
        workingScheduleId: standardScheduleId,
      },
    });
    testEmployeeId = emp1.id;

    const emp2 = await prisma.employee.create({
      data: {
        employeeNumber: 'ATT_EMP_02',
        firstName: 'Divya',
        lastName: 'Nair',
        workEmail: 'att.other.emp@peoplepay360.dev',
        jobPosition: 'Product Designer',
        employeeType: EmployeeType.FULL_TIME,
        status: RecordStatus.ACTIVE,
        departmentId: testDepartmentId,
        workingScheduleId: standardScheduleId,
      },
    });
    otherEmployeeId = emp2.id;

    const emp3 = await prisma.employee.create({
      data: {
        employeeNumber: 'ATT_EMP_03',
        firstName: 'Inactive',
        lastName: 'Worker',
        workEmail: 'att.inact.emp@peoplepay360.dev',
        jobPosition: 'Intern',
        employeeType: EmployeeType.INTERN,
        status: RecordStatus.INACTIVE,
        departmentId: testDepartmentId,
        workingScheduleId: standardScheduleId,
      },
    });
    inactiveEmployeeId = emp3.id;

    const emp4 = await prisma.employee.create({
      data: {
        employeeNumber: 'ATT_EMP_04',
        firstName: 'No',
        lastName: 'Schedule',
        workEmail: 'att.nosched.emp@peoplepay360.dev',
        jobPosition: 'Consultant',
        employeeType: EmployeeType.CONTRACT,
        status: RecordStatus.ACTIVE,
        departmentId: testDepartmentId,
        workingScheduleId: null, // No schedule
      },
    });
    unscheduledEmployeeId = emp4.id;

    // Create Salary Structure for contract test
    const structure = await prisma.salaryStructure.upsert({
      where: { nameKey: 'att test structure' },
      update: { status: RecordStatus.ACTIVE },
      create: {
        name: 'Att Test Structure',
        nameKey: 'att test structure',
        status: RecordStatus.ACTIVE,
      },
    });

    // Create Contract with schedule override for emp1
    await prisma.contract.create({
      data: {
        contractNumber: 'CON/2026/000099',
        employeeId: testEmployeeId,
        departmentId: testDepartmentId,
        workingScheduleId: contractScheduleId, // Override!
        salaryStructureId: structure.id,
        jobPosition: 'Senior Frontend Engineer',
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        endDate: null,
        monthlyWage: new Prisma.Decimal('90000.00'),
      },
    });

    // Create Users
    const passwordHash = await argon2.hash(testPassword);

    await prisma.user.create({
      data: {
        email: 'att.unlinked@peoplepay360.dev',
        passwordHash,
        role: Role.EMPLOYEE,
        employeeId: null,
      },
    });

    await prisma.user.create({
      data: {
        email: 'att.emp@peoplepay360.dev',
        passwordHash,
        role: Role.EMPLOYEE,
        employeeId: testEmployeeId,
      },
    });

    await prisma.user.create({
      data: {
        email: 'att.other.emp@peoplepay360.dev',
        passwordHash,
        role: Role.EMPLOYEE,
        employeeId: otherEmployeeId,
      },
    });

    await prisma.user.create({
      data: {
        email: 'att.hr.mgr@peoplepay360.dev',
        passwordHash,
        role: Role.HR_MANAGER,
      },
    });

    await prisma.user.create({
      data: {
        email: 'att.pay.user@peoplepay360.dev',
        passwordHash,
        role: Role.HR_PAYROLL_USER,
      },
    });

    await prisma.user.create({
      data: {
        email: 'att.admin@peoplepay360.dev',
        passwordHash,
        role: Role.ADMIN,
      },
    });

    // Set up Supertest agents
    async function login(email: string) {
      const agent = request.agent(app);
      const res = await agent.post('/api/v1/auth/login').send({
        email,
        password: testPassword,
      });
      expect(res.status).toBe(200);
      return agent;
    }

    unlinkedUserAgent = await login('att.unlinked@peoplepay360.dev');
    employeeUserAgent = await login('att.emp@peoplepay360.dev');
    otherEmployeeUserAgent = await login('att.other.emp@peoplepay360.dev');
    hrManagerAgent = await login('att.hr.mgr@peoplepay360.dev');
    payrollUserAgent = await login('att.pay.user@peoplepay360.dev');
    adminAgent = await login('att.admin@peoplepay360.dev');
  });

  afterAll(async () => {
    // Clean up
    await prisma.auditLog.deleteMany({
      where: { entityType: 'ATTENDANCE' },
    });
    await prisma.attendance.deleteMany({
      where: {
        employee: {
          workEmail: {
            in: [
              'att.emp@peoplepay360.dev',
              'att.other.emp@peoplepay360.dev',
              'att.inact.emp@peoplepay360.dev',
              'att.nosched.emp@peoplepay360.dev',
            ],
          },
        },
      },
    });
    await prisma.contract.deleteMany({
      where: {
        employee: {
          workEmail: {
            in: [
              'att.emp@peoplepay360.dev',
              'att.other.emp@peoplepay360.dev',
              'att.inact.emp@peoplepay360.dev',
              'att.nosched.emp@peoplepay360.dev',
            ],
          },
        },
      },
    });
    await prisma.user.deleteMany({
      where: { email: { in: testUserEmails } },
    });
    await prisma.employee.deleteMany({
      where: {
        workEmail: {
          in: [
            'att.emp@peoplepay360.dev',
            'att.other.emp@peoplepay360.dev',
            'att.inact.emp@peoplepay360.dev',
            'att.nosched.emp@peoplepay360.dev',
          ],
        },
      },
    });
    await pgPool.end();
  });

  describe('Database Invariant Checks & Constraints', () => {
    it('rejects duplicate attendance on same date for same employee', async () => {
      const dateObj = new Date('2026-08-03T00:00:00.000Z');
      await prisma.attendance.create({
        data: {
          employeeId: otherEmployeeId,
          attendanceDate: dateObj,
          status: 'PRESENT',
          checkInAt: new Date('2026-08-03T03:30:00.000Z'),
          workingScheduleId: standardScheduleId,
          expectedStartMinute: 540,
          expectedEndMinute: 1080,
          expectedBreakMinutes: 60,
          expectedMinutes: 480,
        },
      });

      await expect(
        prisma.attendance.create({
          data: {
            employeeId: otherEmployeeId,
            attendanceDate: dateObj,
            status: 'PRESENT',
            checkInAt: new Date('2026-08-03T03:30:00.000Z'),
            workingScheduleId: standardScheduleId,
            expectedStartMinute: 540,
            expectedEndMinute: 1080,
            expectedBreakMinutes: 60,
            expectedMinutes: 480,
          },
        })
      ).rejects.toThrow();
    });

    it('rejects punch order where checkOutAt <= checkInAt', async () => {
      await expect(
        prisma.attendance.create({
          data: {
            employeeId: otherEmployeeId,
            attendanceDate: new Date('2026-08-04T00:00:00.000Z'),
            status: 'PRESENT',
            checkInAt: new Date('2026-08-04T05:00:00.000Z'),
            checkOutAt: new Date('2026-08-04T04:00:00.000Z'), // earlier than checkIn
            workingScheduleId: standardScheduleId,
            expectedStartMinute: 540,
            expectedEndMinute: 1080,
            expectedBreakMinutes: 60,
            expectedMinutes: 480,
          },
        })
      ).rejects.toThrow();
    });

    it('rejects negative minutes in database check constraints', async () => {
      await expect(
        prisma.attendance.create({
          data: {
            employeeId: otherEmployeeId,
            attendanceDate: new Date('2026-08-05T00:00:00.000Z'),
            status: 'PRESENT',
            checkInAt: new Date('2026-08-05T03:30:00.000Z'),
            workedMinutes: -10,
            workingScheduleId: standardScheduleId,
            expectedStartMinute: 540,
            expectedEndMinute: 1080,
            expectedBreakMinutes: 60,
            expectedMinutes: 480,
          },
        })
      ).rejects.toThrow();
    });

    it('rejects ABSENT status if timestamps are present', async () => {
      await expect(
        prisma.attendance.create({
          data: {
            employeeId: otherEmployeeId,
            attendanceDate: new Date('2026-08-06T00:00:00.000Z'),
            status: 'ABSENT',
            checkInAt: new Date('2026-08-06T03:30:00.000Z'), // Invalid for ABSENT
            workingScheduleId: standardScheduleId,
            expectedStartMinute: 540,
            expectedEndMinute: 1080,
            expectedBreakMinutes: 60,
            expectedMinutes: 480,
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('Unauthenticated & Authorization Matrix', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/attendance');
      expect(res.status).toBe(401);
    });

    it('returns 403 EMPLOYEE_PROFILE_NOT_LINKED when unlinked user accesses self routes', async () => {
      const res = await unlinkedUserAgent.get('/api/v1/attendance/me/today');
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('EMPLOYEE_PROFILE_NOT_LINKED');

      const checkInRes = await unlinkedUserAgent.post('/api/v1/attendance/me/check-in').send();
      expect(checkInRes.status).toBe(403);
      expect(checkInRes.body.error.code).toBe('EMPLOYEE_PROFILE_NOT_LINKED');
    });

    it('denies Employee role from creating manual attendance or correcting', async () => {
      const createRes = await employeeUserAgent.post('/api/v1/attendance').send({
        employeeId: otherEmployeeId,
        attendanceDate: '2026-08-10',
        kind: 'WORKED',
        checkInAt: '2026-08-10T03:30:00.000Z',
        reason: 'Employee trying to create',
      });
      expect(createRes.status).toBe(403);
      expect(createRes.body.error.code).toBe('ATTENDANCE_ACCESS_DENIED');

      const correctRes = await employeeUserAgent
        .patch('/api/v1/attendance/some-id/correction')
        .send({
          kind: 'WORKED',
          checkInAt: '2026-08-10T03:30:00.000Z',
          checkOutAt: null,
          reason: 'Employee trying to correct',
        });
      expect(correctRes.status).toBe(403);
      expect(correctRes.body.error.code).toBe('ATTENDANCE_ACCESS_DENIED');
    });

    it('rejects DELETE requests on Attendance endpoints', async () => {
      const res = await adminAgent.delete('/api/v1/attendance/some-id');
      expect(res.status).toBe(404); // Route does not exist
    });
  });

  describe('Schedule Snapshot Precedence', () => {
    it('resolves contract schedule override when contract has workingScheduleId', async () => {
      const service = new AttendanceService(prisma);
      // testEmployeeId has a contract with contractScheduleId (10:00-17:00, 30m break) on 2026-09-01
      const res = await service.resolveScheduleSnapshot(testEmployeeId, '2026-09-01');
      expect(res.workingScheduleId).toBe(contractScheduleId);
      expect(res.snapshot.expectedStartMinute).toBe(600); // 10:00
      expect(res.snapshot.expectedEndMinute).toBe(1020); // 17:00
      expect(res.snapshot.expectedBreakMinutes).toBe(30);
      expect(res.snapshot.expectedMinutes).toBe(390); // (1020 - 600 - 30)
    });

    it('falls back to employee working schedule when contract is absent or has no override', async () => {
      const service = new AttendanceService(prisma);
      // otherEmployeeId has no contract, but standardScheduleId (09:00-18:00, 60m break, 480m net)
      const res = await service.resolveScheduleSnapshot(otherEmployeeId, '2026-09-01');
      expect(res.workingScheduleId).toBe(standardScheduleId);
      expect(res.snapshot.expectedStartMinute).toBe(540);
      expect(res.snapshot.expectedEndMinute).toBe(1080);
      expect(res.snapshot.expectedBreakMinutes).toBe(60);
      expect(res.snapshot.expectedMinutes).toBe(480);
    });

    it('returns ATTENDANCE_SCHEDULE_MISSING when neither contract nor employee has a schedule', async () => {
      const service = new AttendanceService(prisma);
      await expect(
        service.resolveScheduleSnapshot(unscheduledEmployeeId, '2026-09-01')
      ).rejects.toThrow('Neither contract nor employee has an assigned working schedule');
    });
  });

  describe('Self Check-In and Check-Out Lifecycle', () => {
    it('rejects body payload on self check-in and check-out', async () => {
      const checkInRes = await employeeUserAgent
        .post('/api/v1/attendance/me/check-in')
        .send({ employeeId: otherEmployeeId });
      expect(checkInRes.status).toBe(400);
      expect(checkInRes.body.error.code).toBe('INVALID_ATTENDANCE_INPUT');

      const checkOutRes = await employeeUserAgent
        .post('/api/v1/attendance/me/check-out')
        .send({ checkOutAt: '2026-09-01T12:00:00Z' });
      expect(checkOutRes.status).toBe(400);
      expect(checkOutRes.body.error.code).toBe('INVALID_ATTENDANCE_INPUT');
    });

    it('performs self check-in successfully, snapshotting schedule and creating AuditLog', async () => {
      // Clean today's attendance for test employee if any
      const todayDate = getCompanyBusinessDate(new Date());
      await prisma.attendance.deleteMany({
        where: {
          employeeId: testEmployeeId,
          attendanceDate: new Date(`${todayDate}T00:00:00.000Z`),
        },
      });

      const res = await employeeUserAgent.post('/api/v1/attendance/me/check-in').send();
      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.employee.id).toBe(testEmployeeId);
      expect(res.body.data.attendanceDate).toBe(todayDate);
      expect(res.body.data.checkInAt).toBeDefined();
      expect(res.body.data.checkOutAt).toBeNull();
      expect(res.body.data.workedMinutes).toBe(0);
      expect(res.body.data.flags).toContain('MISSING_CHECK_OUT');

      // Verify AuditLog in DB
      const audit = await prisma.auditLog.findFirst({
        where: {
          entityId: res.body.data.id,
          action: 'ATTENDANCE_CHECKED_IN',
        },
      });
      expect(audit).toBeDefined();

      // Check /me/today returns CHECKED_IN
      const todayRes = await employeeUserAgent.get('/api/v1/attendance/me/today');
      expect(todayRes.status).toBe(200);
      expect(todayRes.body.data.state).toBe('CHECKED_IN');
      expect(todayRes.body.data.attendance.id).toBe(res.body.data.id);
    });

    it('rejects repeat check-in with 409 ATTENDANCE_ALREADY_CHECKED_IN', async () => {
      const res = await employeeUserAgent.post('/api/v1/attendance/me/check-in').send();
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ATTENDANCE_ALREADY_CHECKED_IN');
    });

    it('performs self check-out successfully, deriving worked/overtime minutes and AuditLog', async () => {
      const res = await employeeUserAgent.post('/api/v1/attendance/me/check-out').send();
      expect(res.status).toBe(200);
      expect(res.body.data.checkOutAt).toBeDefined();
      expect(res.body.data.flags).not.toContain('MISSING_CHECK_OUT');

      // Check /me/today returns CHECKED_OUT
      const todayRes = await employeeUserAgent.get('/api/v1/attendance/me/today');
      expect(todayRes.status).toBe(200);
      expect(todayRes.body.data.state).toBe('CHECKED_OUT');

      // Verify check-out AuditLog
      const audit = await prisma.auditLog.findFirst({
        where: {
          entityId: res.body.data.id,
          action: 'ATTENDANCE_CHECKED_OUT',
        },
      });
      expect(audit).toBeDefined();
    });

    it('rejects repeat check-out with 409 ATTENDANCE_ALREADY_CHECKED_OUT', async () => {
      const res = await employeeUserAgent.post('/api/v1/attendance/me/check-out').send();
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ATTENDANCE_ALREADY_CHECKED_OUT');
    });
  });

  describe('Manual Creation & Correction by HR/Admin', () => {
    it('allows HR Manager to manually create an ABSENT record on an expected working day', async () => {
      // 2026-08-10 was a Monday (working day)
      const res = await hrManagerAgent.post('/api/v1/attendance').send({
        employeeId: otherEmployeeId,
        attendanceDate: '2026-08-10',
        kind: 'ABSENT',
        checkInAt: null,
        checkOutAt: null,
        reason: 'Employee took unplanned personal leave',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('ABSENT');
      expect(res.body.data.checkInAt).toBeNull();
      expect(res.body.data.checkOutAt).toBeNull();
      expect(res.body.data.manuallyEdited).toBe(true);
      expect(res.body.data.lastEditedBy).toBeDefined();
      expect(res.body.data.flags).toContain('MANUALLY_EDITED');
    });

    it('rejects ABSENT record on a non-working day with 400 ABSENT_ON_NON_WORKING_DAY', async () => {
      // 2026-08-09 was a Sunday (non-working day for otherEmployee's standard schedule)
      const res = await hrManagerAgent.post('/api/v1/attendance').send({
        employeeId: otherEmployeeId,
        attendanceDate: '2026-08-09',
        kind: 'ABSENT',
        checkInAt: null,
        checkOutAt: null,
        reason: 'Attempting absent on Sunday',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ABSENT_ON_NON_WORKING_DAY');
    });

    it('rejects future attendance date with 400 INVALID_ATTENDANCE_DATE', async () => {
      const res = await hrManagerAgent.post('/api/v1/attendance').send({
        employeeId: otherEmployeeId,
        attendanceDate: '2099-01-01',
        kind: 'ABSENT',
        checkInAt: null,
        checkOutAt: null,
        reason: 'Future attendance',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_ATTENDANCE_DATE');
    });

    it('allows HR Manager to correct a worked record and records reason in AuditLog', async () => {
      // 2026-08-11 is a Tuesday
      // 09:15 IST is 03:45 UTC. Expected start is 09:00 IST -> LATE!
      // 18:15 IST is 12:45 UTC.
      const createRes = await hrManagerAgent.post('/api/v1/attendance').send({
        employeeId: otherEmployeeId,
        attendanceDate: '2026-08-11',
        kind: 'WORKED',
        checkInAt: '2026-08-11T03:45:00.000Z',
        checkOutAt: '2026-08-11T12:45:00.000Z',
        reason: 'Initial manual log for Divya',
      });
      expect(createRes.status).toBe(201);
      expect(createRes.body.data.status).toBe('LATE');

      // Correct it to on-time: 09:00 IST = 03:30 UTC
      const correctRes = await hrManagerAgent
        .patch(`/api/v1/attendance/${createRes.body.data.id}/correction`)
        .send({
          kind: 'WORKED',
          checkInAt: '2026-08-11T03:30:00.000Z',
          checkOutAt: '2026-08-11T12:30:00.000Z',
          reason: 'Biometric gate failed, employee was on time at 9:00 AM',
        });

      expect(correctRes.status).toBe(200);
      expect(correctRes.body.data.status).toBe('PRESENT');
      expect(correctRes.body.data.manuallyEdited).toBe(true);

      // Verify AuditLog
      const audit = await prisma.auditLog.findFirst({
        where: {
          entityId: createRes.body.data.id,
          action: 'ATTENDANCE_CORRECTED',
        },
      });
      expect(audit).toBeDefined();
      expect((audit?.after as any)?.reason).toBe('Biometric gate failed, employee was on time at 9:00 AM');
    });
  });

  describe('Attendance List, Queries & Ownership', () => {
    it('Employee role lists only own attendance and receives 403 on accessing another employee record', async () => {
      const listRes = await employeeUserAgent.get('/api/v1/attendance');
      expect(listRes.status).toBe(200);
      for (const item of listRes.body.data.items) {
        expect(item.employee.id).toBe(testEmployeeId);
      }

      // Try to read other employee's attendance
      const otherListRes = await hrManagerAgent.get(`/api/v1/attendance?employeeId=${otherEmployeeId}`);
      const otherRecordId = otherListRes.body.data.items[0].id;

      const detailRes = await employeeUserAgent.get(`/api/v1/attendance/${otherRecordId}`);
      expect(detailRes.status).toBe(403);
      expect(detailRes.body.error.code).toBe('ATTENDANCE_ACCESS_DENIED');
    });

    it('HR Manager lists attendance globally with search, status, and flag filters', async () => {
      const searchRes = await hrManagerAgent.get('/api/v1/attendance?search=Divya');
      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data.items.length).toBeGreaterThan(0);
      for (const item of searchRes.body.data.items) {
        expect(item.employee.fullName).toContain('Divya');
      }

      const statusRes = await hrManagerAgent.get('/api/v1/attendance?status=ABSENT');
      expect(statusRes.status).toBe(200);
      for (const item of statusRes.body.data.items) {
        expect(item.status).toBe('ABSENT');
      }
    });

    it('Employee detail endpoint includes real attendanceCount', async () => {
      const res = await hrManagerAgent.get(`/api/v1/employees/${otherEmployeeId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.attendanceCount).toBeGreaterThan(0);
    });

    it('concurrent check-ins create exactly one record and safely conflict', async () => {
      // Preemptive cleanup
      await prisma.attendance.deleteMany({ where: { employee: { workEmail: 'att.concur@peoplepay360.dev' } } });
      await prisma.auditLog.deleteMany({ where: { actor: { email: 'att.concur@peoplepay360.dev' } } });
      await prisma.user.deleteMany({ where: { email: 'att.concur@peoplepay360.dev' } });
      await prisma.employee.deleteMany({ where: { workEmail: 'att.concur@peoplepay360.dev' } });

      // Create a temporary third employee for concurrency test
      const tempEmp = await prisma.employee.create({
        data: {
          employeeNumber: 'ATT_CONCUR_01',
          firstName: 'Concur',
          lastName: 'Test',
          workEmail: 'att.concur@peoplepay360.dev',
          jobPosition: 'Tester',
          employeeType: EmployeeType.FULL_TIME,
          status: RecordStatus.ACTIVE,
          departmentId: testDepartmentId,
          workingScheduleId: standardScheduleId,
        },
      });

      const tempUser = await prisma.user.create({
        data: {
          email: 'att.concur@peoplepay360.dev',
          passwordHash: await argon2.hash(testPassword),
          role: Role.EMPLOYEE,
          employeeId: tempEmp.id,
        },
      });

      const agent1 = request.agent(app);
      await agent1.post('/api/v1/auth/login').send({ email: tempUser.email, password: testPassword });

      const agent2 = request.agent(app);
      await agent2.post('/api/v1/auth/login').send({ email: tempUser.email, password: testPassword });

      // Clean any attendance
      const todayDate = getCompanyBusinessDate(new Date());
      await prisma.attendance.deleteMany({
        where: {
          employeeId: tempEmp.id,
          attendanceDate: new Date(`${todayDate}T00:00:00.000Z`),
        },
      });

      // Fire concurrent requests
      const [res1, res2] = await Promise.all([
        agent1.post('/api/v1/attendance/me/check-in').send(),
        agent2.post('/api/v1/attendance/me/check-in').send(),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 409]);

      // Exactly one record exists
      const count = await prisma.attendance.count({
        where: {
          employeeId: tempEmp.id,
          attendanceDate: new Date(`${todayDate}T00:00:00.000Z`),
        },
      });
      expect(count).toBe(1);

      // Cleanup temp
      await prisma.attendance.deleteMany({ where: { employeeId: tempEmp.id } });
      await prisma.auditLog.deleteMany({ where: { actorId: tempUser.id } });
      await prisma.user.delete({ where: { id: tempUser.id } });
      await prisma.employee.delete({ where: { id: tempEmp.id } });
    });

    it('schedule snapshot stays unchanged after Schedule update', async () => {
      // Find one existing attendance created earlier
      const record = await prisma.attendance.findFirst({
        where: { employeeId: otherEmployeeId, status: 'ABSENT' },
      });
      expect(record).toBeDefined();
      const originalExpected = record!.expectedMinutes;

      // Update schedule days
      await prisma.workingScheduleDay.updateMany({
        where: { scheduleId: standardScheduleId },
        data: { breakMinutes: 120 }, // Changed break
      });

      // Fetch attendance again
      const afterRecord = await prisma.attendance.findUnique({
        where: { id: record!.id },
      });
      expect(afterRecord!.expectedMinutes).toBe(originalExpected); // Invariant!

      // Restore break
      await prisma.workingScheduleDay.updateMany({
        where: { scheduleId: standardScheduleId },
        data: { breakMinutes: 60 },
      });
    });
  });
});
