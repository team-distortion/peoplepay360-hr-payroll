import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import {
  Role,
  RecordStatus,
  EmployeeType,
  Prisma,
} from '@prisma/client';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { pgPool } from '../src/lib/session.js';
import { getCompanyTodayString } from '../src/modules/time-off/time-off.mapper.js';

describe('Time Off Module Integration Tests', () => {
  const app = createApp();
  const testPassword = 'TimeOffTestPass123!';

  let unlinkedAgent: ReturnType<typeof request.agent>;
  let employeeAgent: ReturnType<typeof request.agent>;
  let managerAgent: ReturnType<typeof request.agent>;
  let otherEmployeeAgent: ReturnType<typeof request.agent>;
  let hrManagerAgent: ReturnType<typeof request.agent>;

  let testDepartmentId: string;
  let standardScheduleId: string;
  let managerEmployeeId: string;
  let employeeId: string;
  let otherEmployeeId: string;
  let inactiveEmployeeId: string;

  let annualLeaveTypeId: string;
  let sickLeaveTypeId: string;
  let unpaidLeaveTypeId: string;
  let shortPermissionTypeId: string;
  let inactiveTypeId: string;

  const testUserEmails = [
    'to.unlinked@peoplepay360.dev',
    'to.emp@peoplepay360.dev',
    'to.mgr@peoplepay360.dev',
    'to.other@peoplepay360.dev',
    'to.hr@peoplepay360.dev',
  ];

  beforeAll(async () => {
    // Cleanup prior test artifacts
    await prisma.auditLog.deleteMany({
      where: {
        entityType: { in: ['TimeOffType', 'TimeOffAllocation', 'TimeOffRequest'] },
      },
    });
    await prisma.timeOffRequest.deleteMany({
      where: {
        employee: {
          workEmail: {
            in: [
              'to.emp@peoplepay360.dev',
              'to.mgr@peoplepay360.dev',
              'to.other@peoplepay360.dev',
              'to.inact@peoplepay360.dev',
            ],
          },
        },
      },
    });
    await prisma.timeOffAllocation.deleteMany({
      where: {
        employee: {
          workEmail: {
            in: [
              'to.emp@peoplepay360.dev',
              'to.mgr@peoplepay360.dev',
              'to.other@peoplepay360.dev',
              'to.inact@peoplepay360.dev',
            ],
          },
        },
      },
    });
    await prisma.timeOffType.deleteMany({
      where: {
        nameKey: {
          in: [
            'to test annual leave',
            'to test sick leave',
            'to test unpaid leave',
            'to test short permission',
            'to test inactive leave',
          ],
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
            'to.emp@peoplepay360.dev',
            'to.mgr@peoplepay360.dev',
            'to.other@peoplepay360.dev',
            'to.inact@peoplepay360.dev',
          ],
        },
      },
    });

    // Create Department
    const dept = await prisma.department.upsert({
      where: { nameKey: 'time off test dept' },
      update: { status: RecordStatus.ACTIVE },
      create: {
        name: 'Time Off Test Dept',
        nameKey: 'time off test dept',
        status: RecordStatus.ACTIVE,
      },
    });
    testDepartmentId = dept.id;

    // Create standard schedule (Mon-Fri 09:00 - 18:00, 540 - 1080)
    const schedule = await prisma.workingSchedule.upsert({
      where: { nameKey: 'to test standard sched' },
      update: { status: 'ACTIVE' },
      create: {
        name: 'TO Test Standard Sched',
        nameKey: 'to test standard sched',
        companyName: 'PeoplePay360',
        status: 'ACTIVE',
        days: {
          create: [
            { dayOfWeek: 'MONDAY', startMinute: 540, endMinute: 1080, breakMinutes: 60 },
            { dayOfWeek: 'TUESDAY', startMinute: 540, endMinute: 1080, breakMinutes: 60 },
            { dayOfWeek: 'WEDNESDAY', startMinute: 540, endMinute: 1080, breakMinutes: 60 },
            { dayOfWeek: 'THURSDAY', startMinute: 540, endMinute: 1080, breakMinutes: 60 },
            { dayOfWeek: 'FRIDAY', startMinute: 540, endMinute: 1080, breakMinutes: 60 },
          ],
        },
      },
    });
    standardScheduleId = schedule.id;

    // Create Manager Employee
    const mgrEmp = await prisma.employee.create({
      data: {
        employeeNumber: 'TO-MGR-01',
        firstName: 'Vikram',
        lastName: 'Manager',
        workEmail: 'to.mgr@peoplepay360.dev',
        jobPosition: 'Engineering Manager',
        employeeType: EmployeeType.FULL_TIME,
        status: RecordStatus.ACTIVE,
        departmentId: testDepartmentId,
        workingScheduleId: standardScheduleId,
      },
    });
    managerEmployeeId = mgrEmp.id;

    // Create Test Employee (reports to Vikram)
    const emp = await prisma.employee.create({
      data: {
        employeeNumber: 'TO-EMP-01',
        firstName: 'Ananya',
        lastName: 'Engineer',
        workEmail: 'to.emp@peoplepay360.dev',
        jobPosition: 'Software Engineer',
        employeeType: EmployeeType.FULL_TIME,
        status: RecordStatus.ACTIVE,
        departmentId: testDepartmentId,
        managerId: managerEmployeeId,
        workingScheduleId: standardScheduleId,
      },
    });
    employeeId = emp.id;

    // Create Other Employee (not reporting to Vikram)
    const otherEmp = await prisma.employee.create({
      data: {
        employeeNumber: 'TO-OTHER-01',
        firstName: 'Rohan',
        lastName: 'Sales',
        workEmail: 'to.other@peoplepay360.dev',
        jobPosition: 'Sales Executive',
        employeeType: EmployeeType.FULL_TIME,
        status: RecordStatus.ACTIVE,
        departmentId: testDepartmentId,
        workingScheduleId: standardScheduleId,
      },
    });
    otherEmployeeId = otherEmp.id;

    // Create Inactive Employee
    const inactEmp = await prisma.employee.create({
      data: {
        employeeNumber: 'TO-INACT-01',
        firstName: 'Siddharth',
        lastName: 'Former',
        workEmail: 'to.inact@peoplepay360.dev',
        jobPosition: 'Former Tech',
        employeeType: EmployeeType.FULL_TIME,
        status: RecordStatus.INACTIVE,
        departmentId: testDepartmentId,
        workingScheduleId: standardScheduleId,
      },
    });
    inactiveEmployeeId = inactEmp.id;

    // Users
    const passwordHash = await argon2.hash(testPassword);

    await prisma.user.create({
      data: {
        email: 'to.unlinked@peoplepay360.dev',
        passwordHash,
        role: Role.HR_MANAGER,
        employeeId: null,
      },
    });

    await prisma.user.create({
      data: {
        email: 'to.emp@peoplepay360.dev',
        passwordHash,
        role: Role.EMPLOYEE,
        employeeId,
      },
    });

    await prisma.user.create({
      data: {
        email: 'to.mgr@peoplepay360.dev',
        passwordHash,
        role: Role.HR_MANAGER,
        employeeId: managerEmployeeId,
      },
    });

    await prisma.user.create({
      data: {
        email: 'to.other@peoplepay360.dev',
        passwordHash,
        role: Role.EMPLOYEE,
        employeeId: otherEmployeeId,
      },
    });

    await prisma.user.create({
      data: {
        email: 'to.hr@peoplepay360.dev',
        passwordHash,
        role: Role.ADMIN,
        employeeId: null,
      },
    });

    // Create Seed Types
    const annualType = await prisma.timeOffType.create({
      data: {
        name: 'TO Test Annual Leave',
        nameKey: 'to test annual leave',
        unit: 'DAY',
        requiresAllocation: true,
        approvalMode: 'HR_APPROVAL',
        payrollTreatment: 'PAID',
        status: 'ACTIVE',
      },
    });
    annualLeaveTypeId = annualType.id;

    const sickType = await prisma.timeOffType.create({
      data: {
        name: 'TO Test Sick Leave',
        nameKey: 'to test sick leave',
        unit: 'DAY',
        requiresAllocation: false,
        approvalMode: 'NO_APPROVAL',
        payrollTreatment: 'PAID',
        status: 'ACTIVE',
      },
    });
    sickLeaveTypeId = sickType.id;

    const unpaidType = await prisma.timeOffType.create({
      data: {
        name: 'TO Test Unpaid Leave',
        nameKey: 'to test unpaid leave',
        unit: 'DAY',
        requiresAllocation: false,
        approvalMode: 'HR_APPROVAL',
        payrollTreatment: 'UNPAID',
        status: 'ACTIVE',
      },
    });
    unpaidLeaveTypeId = unpaidType.id;

    const shortPermType = await prisma.timeOffType.create({
      data: {
        name: 'TO Test Short Permission',
        nameKey: 'to test short permission',
        unit: 'HOUR',
        requiresAllocation: true,
        approvalMode: 'HR_APPROVAL',
        payrollTreatment: 'PAID',
        status: 'ACTIVE',
      },
    });
    shortPermissionTypeId = shortPermType.id;

    const inactType = await prisma.timeOffType.create({
      data: {
        name: 'TO Test Inactive Leave',
        nameKey: 'to test inactive leave',
        unit: 'DAY',
        requiresAllocation: true,
        approvalMode: 'HR_APPROVAL',
        payrollTreatment: 'PAID',
        status: 'INACTIVE',
      },
    });
    inactiveTypeId = inactType.id;

    // Login agents
    unlinkedAgent = request.agent(app);
    await unlinkedAgent.post('/api/v1/auth/login').send({
      email: 'to.unlinked@peoplepay360.dev',
      password: testPassword,
    });

    employeeAgent = request.agent(app);
    await employeeAgent.post('/api/v1/auth/login').send({
      email: 'to.emp@peoplepay360.dev',
      password: testPassword,
    });

    managerAgent = request.agent(app);
    await managerAgent.post('/api/v1/auth/login').send({
      email: 'to.mgr@peoplepay360.dev',
      password: testPassword,
    });

    otherEmployeeAgent = request.agent(app);
    await otherEmployeeAgent.post('/api/v1/auth/login').send({
      email: 'to.other@peoplepay360.dev',
      password: testPassword,
    });

    hrManagerAgent = request.agent(app);
    await hrManagerAgent.post('/api/v1/auth/login').send({
      email: 'to.hr@peoplepay360.dev',
      password: testPassword,
    });
  });

  afterAll(async () => {
    await pgPool.end();
  });

  describe('Time Off Types Management & RBAC', () => {
    it('allows Employee to list active Types, hiding inactive', async () => {
      const res = await employeeAgent.get('/api/v1/time-off/types');
      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeInstanceOf(Array);
      const items = res.body.data.items;
      expect(items.some((t: any) => t.id === annualLeaveTypeId)).toBe(true);
      expect(items.some((t: any) => t.id === inactiveTypeId)).toBe(false);
    });

    it('denies Employee from creating or updating Types', async () => {
      const createRes = await employeeAgent.post('/api/v1/time-off/types').send({
        name: 'Employee Custom Leave',
        unit: 'DAY',
        requiresAllocation: false,
        approvalMode: 'NO_APPROVAL',
        payrollTreatment: 'PAID',
      });
      expect(createRes.status).toBe(403);
      expect(createRes.body.error.code).toBe('TIME_OFF_ACCESS_DENIED');
    });

    it('rejects duplicate normalized Type name for HR', async () => {
      const res = await hrManagerAgent.post('/api/v1/time-off/types').send({
        name: '  TO TEST ANNUAL LEAVE  ',
        unit: 'DAY',
        requiresAllocation: true,
        approvalMode: 'HR_APPROVAL',
        payrollTreatment: 'PAID',
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('TIME_OFF_TYPE_NAME_EXISTS');
    });
  });

  describe('Allocations Lifecycle & Decisions', () => {
    let createdAllocId: string;

    it('rejects Allocation for inactive employee or inactive type', async () => {
      const res = await hrManagerAgent.post('/api/v1/time-off/allocations').send({
        employeeId: inactiveEmployeeId,
        timeOffTypeId: annualLeaveTypeId,
        allocatedUnits: '10.0000',
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('TIME_OFF_EMPLOYEE_INACTIVE');

      const res2 = await hrManagerAgent.post('/api/v1/time-off/allocations').send({
        employeeId,
        timeOffTypeId: inactiveTypeId,
        allocatedUnits: '10.0000',
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      });
      expect(res2.status).toBe(422);
      expect(res2.body.error.code).toBe('TIME_OFF_TYPE_INACTIVE');
    });

    it('rejects Allocation for a Type where requiresAllocation = false', async () => {
      const res = await hrManagerAgent.post('/api/v1/time-off/allocations').send({
        employeeId,
        timeOffTypeId: sickLeaveTypeId,
        allocatedUnits: '5.0000',
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('ALLOCATION_NOT_REQUIRED');
    });

    it('enforces whole units for DAY and quarter increments for HOUR', async () => {
      // Fraction for DAY
      const res = await hrManagerAgent.post('/api/v1/time-off/allocations').send({
        employeeId,
        timeOffTypeId: annualLeaveTypeId,
        allocatedUnits: '5.5000',
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      });
      expect(res.status).toBe(400);

      // Non-quarter fraction for HOUR
      const res2 = await hrManagerAgent.post('/api/v1/time-off/allocations').send({
        employeeId,
        timeOffTypeId: shortPermissionTypeId,
        allocatedUnits: '2.1000',
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      });
      expect(res2.status).toBe(400);
    });

    it('creates PENDING Allocation and verifies pending has no usable balance', async () => {
      const res = await hrManagerAgent.post('/api/v1/time-off/allocations').send({
        employeeId,
        timeOffTypeId: annualLeaveTypeId,
        allocatedUnits: '15.0000',
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
        description: 'Annual leave quota 2026',
      });
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.isCurrentlyUsable).toBe(false);
      createdAllocId = res.body.data.id;
    });

    it('allows editing only while PENDING', async () => {
      const res = await hrManagerAgent.put(`/api/v1/time-off/allocations/${createdAllocId}`).send({
        employeeId,
        timeOffTypeId: annualLeaveTypeId,
        allocatedUnits: '20.0000',
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
        description: 'Updated quota to 20 days',
      });
      expect(res.status).toBe(200);
      expect(res.body.data.allocatedUnits).toBe('20.0000');
    });

    it('approves Allocation and verifies idempotent repeat and immutable transition', async () => {
      const approveRes = await hrManagerAgent.post(`/api/v1/time-off/allocations/${createdAllocId}/approve`).send({
        note: 'Approved for 2026',
      });
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.status).toBe('APPROVED');
      expect(approveRes.body.data.isCurrentlyUsable).toBe(true);

      // Idempotent repeat
      const repeatRes = await hrManagerAgent.post(`/api/v1/time-off/allocations/${createdAllocId}/approve`).send({
        note: 'Repeating approval',
      });
      expect(repeatRes.status).toBe(200);
      expect(repeatRes.body.data.status).toBe('APPROVED');

      // Attempt opposite decision -> 409 conflict
      const refuseRes = await hrManagerAgent.post(`/api/v1/time-off/allocations/${createdAllocId}/refuse`).send({
        note: 'Attempting conflict refusal',
      });
      expect(refuseRes.status).toBe(409);
      expect(refuseRes.body.error.code).toBe('ALLOCATION_DECISION_FINAL');

      // Attempt to edit approved allocation -> 409 immutable
      const editRes = await hrManagerAgent.put(`/api/v1/time-off/allocations/${createdAllocId}`).send({
        employeeId,
        timeOffTypeId: annualLeaveTypeId,
        allocatedUnits: '25.0000',
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      });
      expect(editRes.status).toBe(409);
      expect(editRes.body.error.code).toBe('ALLOCATION_IMMUTABLE');
    });

    it('Employee reads own Allocations and is forbidden from reading others', async () => {
      const listRes = await employeeAgent.get('/api/v1/time-off/allocations');
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.items.length).toBeGreaterThan(0);

      // Other employee gets 404 when reading Ananya's allocation
      const detailRes = await otherEmployeeAgent.get(`/api/v1/time-off/allocations/${createdAllocId}`);
      expect(detailRes.status).toBe(404);
    });
  });

  describe('Time Off Requests & Atomic Balance Deduction', () => {
    let activeAllocId: string;
    let pendingReqId: string;

    beforeAll(async () => {
      // Create and approve a 10-day allocation for Ananya
      const alloc = await prisma.timeOffAllocation.create({
        data: {
          employeeId,
          timeOffTypeId: annualLeaveTypeId,
          unitSnapshot: 'DAY',
          allocatedUnits: new Prisma.Decimal('10.0000'),
          consumedUnits: new Prisma.Decimal('0.0000'),
          validFrom: new Date('2026-01-01T00:00:00.000Z'),
          validTo: new Date('2026-12-31T00:00:00.000Z'),
          status: 'APPROVED',
          createdByUserId: (await prisma.user.findFirst({ where: { email: 'to.hr@peoplepay360.dev' } }))!.id,
          decidedByUserId: (await prisma.user.findFirst({ where: { email: 'to.hr@peoplepay360.dev' } }))!.id,
          decidedAt: new Date(),
        },
      });
      activeAllocId = alloc.id;
    });

    it('Employee creates own PENDING request using Allocation', async () => {
      // Monday 2026-10-05 to Wednesday 2026-10-07 = 3 working days
      const res = await employeeAgent.post('/api/v1/time-off/requests').send({
        timeOffTypeId: annualLeaveTypeId,
        allocationId: activeAllocId,
        startDate: '2026-10-05',
        endDate: '2026-10-07',
        reason: 'Personal vacation trip',
      });
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.requestedUnits).toBe('3.0000');
      pendingReqId = res.body.data.id;

      // Allocation consumedUnits must NOT change while request is PENDING
      const allocCheck = await prisma.timeOffAllocation.findUnique({ where: { id: activeAllocId } });
      expect(allocCheck?.consumedUnits.toString()).toBe('0');
    });

    it('rejects overlapping request while first is PENDING', async () => {
      // Overlaps 2026-10-06 to 2026-10-08
      const res = await employeeAgent.post('/api/v1/time-off/requests').send({
        timeOffTypeId: annualLeaveTypeId,
        allocationId: activeAllocId,
        startDate: '2026-10-06',
        endDate: '2026-10-08',
        reason: 'Overlapping request attempt',
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('TIME_OFF_REQUEST_OVERLAP');
    });

    it('allows editing request while PENDING', async () => {
      // Change to 2026-10-05 to 2026-10-06 (2 days)
      const res = await employeeAgent.put(`/api/v1/time-off/requests/${pendingReqId}`).send({
        timeOffTypeId: annualLeaveTypeId,
        allocationId: activeAllocId,
        startDate: '2026-10-05',
        endDate: '2026-10-06',
        reason: 'Updated vacation dates',
      });
      expect(res.status).toBe(200);
      expect(res.body.data.requestedUnits).toBe('2.0000');
    });

    it('HR approves request and exactly-once deduces allocation balance', async () => {
      const res = await hrManagerAgent.post(`/api/v1/time-off/requests/${pendingReqId}/approve`).send({
        note: 'Have a good trip',
      });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('APPROVED');

      // Balance consumed must be exactly 2.0000
      const allocCheck = await prisma.timeOffAllocation.findUnique({ where: { id: activeAllocId } });
      expect(allocCheck?.consumedUnits.toString()).toBe('2');

      // Repeated approval is idempotent and does not deduct again
      const repeatRes = await hrManagerAgent.post(`/api/v1/time-off/requests/${pendingReqId}/approve`).send({
        note: 'Repeat approval',
      });
      expect(repeatRes.status).toBe(200);
      const allocCheckRepeat = await prisma.timeOffAllocation.findUnique({ where: { id: activeAllocId } });
      expect(allocCheckRepeat?.consumedUnits.toString()).toBe('2');
    });

    it('rejects opposite decision on Approved request', async () => {
      const res = await hrManagerAgent.post(`/api/v1/time-off/requests/${pendingReqId}/refuse`).send({
        note: 'Attempting conflict refusal',
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('TIME_OFF_REQUEST_DECISION_FINAL');
    });

    it('NO_APPROVAL request auto-approves and immediately deducts balance atomically', async () => {
      // Sick leave: NO_APPROVAL, no allocation
      // Monday 2026-11-02 (1 day)
      const res = await employeeAgent.post('/api/v1/time-off/requests').send({
        timeOffTypeId: sickLeaveTypeId,
        startDate: '2026-11-02',
        endDate: '2026-11-02',
        reason: 'Doctor appointment for fever',
      });
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('APPROVED');
      expect(res.body.data.requestedUnits).toBe('1.0000');
    });

    it('refusal requires 3-500 char note and does not consume balance', async () => {
      // Create another request
      const reqRes = await employeeAgent.post('/api/v1/time-off/requests').send({
        timeOffTypeId: annualLeaveTypeId,
        allocationId: activeAllocId,
        startDate: '2026-11-09',
        endDate: '2026-11-10',
        reason: 'Long weekend request',
      });
      const reqId = reqRes.body.data.id;

      // Refusal without note -> 400
      const badRefuse = await hrManagerAgent.post(`/api/v1/time-off/requests/${reqId}/refuse`).send({
        note: 'no',
      });
      expect(badRefuse.status).toBe(400);

      // Valid refusal
      const refuseRes = await hrManagerAgent.post(`/api/v1/time-off/requests/${reqId}/refuse`).send({
        note: 'Team coverage is unavailable on those dates',
      });
      expect(refuseRes.status).toBe(200);
      expect(refuseRes.body.data.status).toBe('REFUSED');

      // Allocation balance remains 2
      const allocCheck = await prisma.timeOffAllocation.findUnique({ where: { id: activeAllocId } });
      expect(allocCheck?.consumedUnits.toString()).toBe('2');

      // Refused request does not block new request on the same dates
      const newReqRes = await employeeAgent.post('/api/v1/time-off/requests').send({
        timeOffTypeId: annualLeaveTypeId,
        allocationId: activeAllocId,
        startDate: '2026-11-09',
        endDate: '2026-11-10',
        reason: 'Trying again for long weekend',
      });
      expect(newReqRes.status).toBe(201);
    });

    it('rejects request exceeding allocation balance', async () => {
      // Remaining units: 8. Request 9 days: Monday 2026-11-16 to Thursday 2026-11-26 (9 weekdays)
      const res = await employeeAgent.post('/api/v1/time-off/requests').send({
        timeOffTypeId: annualLeaveTypeId,
        allocationId: activeAllocId,
        startDate: '2026-11-16',
        endDate: '2026-11-26',
        reason: 'Extended leave exceeding remaining quota',
      });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('ALLOCATION_BALANCE_INSUFFICIENT');
    });
  });

  describe('Summary & Scope Rules', () => {
    it('returns live scoped summary for Employee', async () => {
      const res = await employeeAgent.get('/api/v1/time-off/summary');
      expect(res.status).toBe(200);
      expect(res.body.data.pendingRequestCount).toBeDefined();
      expect(res.body.data.usableAllocationCount).toBeDefined();
      expect(res.body.data.balancesByType).toBeInstanceOf(Array);
    });

    it('supports team scope for Manager and returns direct reports only', async () => {
      // Manager is Vikram, Ananya reports to Vikram, Rohan does not
      const res = await managerAgent.get('/api/v1/time-off/requests?scope=team');
      expect(res.status).toBe(200);
      const items = res.body.data.items;
      expect(items.every((r: any) => r.employee.id === employeeId)).toBe(true);
    });

    it('fails safely with EMPLOYEE_PROFILE_NOT_LINKED for unlinked HR team scope', async () => {
      const res = await unlinkedAgent.get('/api/v1/time-off/requests?scope=team');
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('EMPLOYEE_PROFILE_NOT_LINKED');
    });

    it('Employee detail returns accurate smart counts', async () => {
      const res = await hrManagerAgent.get(`/api/v1/employees/${employeeId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.timeOffRequestCount).toBeGreaterThan(0);
      expect(res.body.data.timeOffAllocationCount).toBeGreaterThan(0);
    });
  });
});
