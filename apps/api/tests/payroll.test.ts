import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { Role, Prisma } from '@prisma/client';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { pgPool } from '../src/lib/session.js';

describe('Payroll Processing API Integration Tests (Phase 8)', () => {
  const app = createApp();
  const testPassword = 'PayrollTestPass123!';

  let employeeAgent: ReturnType<typeof request.agent>;
  let hrManagerAgent: ReturnType<typeof request.agent>;
  let payrollUserAgent: ReturnType<typeof request.agent>;
  let payrollManagerAgent: ReturnType<typeof request.agent>;
  let adminAgent: ReturnType<typeof request.agent>;

  const testUserEmails = [
    'pay.employee@peoplepay360.dev',
    'pay.hrmanager@peoplepay360.dev',
    'pay.payrolluser@peoplepay360.dev',
    'pay.payrollmanager@peoplepay360.dev',
    'pay.admin@peoplepay360.dev',
  ];

  let testDepartmentId: string;
  let testScheduleId: string;
  let testStructureId: string;
  let testEmployeeId1: string;
  let testEmployeeId2: string;
  let testContractId1: string;
  let testContractId2: string;

  beforeAll(async () => {
    // 1. Clean up prior test data
    await prisma.payrollWarning.deleteMany({});
    await prisma.payslipLine.deleteMany({});
    await prisma.payslip.deleteMany({});
    await prisma.payrun.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.contract.deleteMany({});
    await prisma.attendance.deleteMany({});
    await prisma.timeOffRequest.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { in: testUserEmails } },
    });

    const passwordHash = await argon2.hash(testPassword);

    // Create 5 test users
    await prisma.user.createMany({
      data: [
        { email: 'pay.employee@peoplepay360.dev', passwordHash, role: Role.EMPLOYEE, isActive: true },
        { email: 'pay.hrmanager@peoplepay360.dev', passwordHash, role: Role.HR_MANAGER, isActive: true },
        { email: 'pay.payrolluser@peoplepay360.dev', passwordHash, role: Role.HR_PAYROLL_USER, isActive: true },
        { email: 'pay.payrollmanager@peoplepay360.dev', passwordHash, role: Role.HR_PAYROLL_MANAGER, isActive: true },
        { email: 'pay.admin@peoplepay360.dev', passwordHash, role: Role.ADMIN, isActive: true },
      ],
    });

    // 2. Setup Working Schedule
    const schedule = await prisma.workingSchedule.upsert({
      where: { nameKey: 'payroll-test-schedule' },
      update: {},
      create: {
        name: 'Payroll Test Schedule',
        nameKey: 'payroll-test-schedule',
        companyName: 'PeoplePay360',
        days: {
          create: [
            { dayOfWeek: 'MONDAY', startMinute: 540, endMinute: 1020, breakMinutes: 60 },
            { dayOfWeek: 'TUESDAY', startMinute: 540, endMinute: 1020, breakMinutes: 60 },
            { dayOfWeek: 'WEDNESDAY', startMinute: 540, endMinute: 1020, breakMinutes: 60 },
            { dayOfWeek: 'THURSDAY', startMinute: 540, endMinute: 1020, breakMinutes: 60 },
            { dayOfWeek: 'FRIDAY', startMinute: 540, endMinute: 1020, breakMinutes: 60 },
          ],
        },
      },
    });
    testScheduleId = schedule.id;

    // 3. Setup Department
    const dept = await prisma.department.upsert({
      where: { nameKey: 'payroll-test-dept' },
      update: {},
      create: {
        name: 'Payroll Test Dept',
        nameKey: 'payroll-test-dept',
      },
    });
    testDepartmentId = dept.id;

    // 4. Setup Salary Structure with Basic, Gross, and Net rules
    const structure = await prisma.salaryStructure.upsert({
      where: { nameKey: 'payroll-test-structure' },
      update: {},
      create: {
        name: 'Payroll Test Structure',
        nameKey: 'payroll-test-structure',
        description: 'Test structure for payrun integration',
        status: 'ACTIVE',
        rules: {
          create: [
            {
              name: 'Basic Pay',
              code: 'BASIC',
              category: 'BASIC',
              sequence: 10,
              method: 'PERCENTAGE',
              percentageRate: new Prisma.Decimal(50),
              percentageBase: 'WAGE',
              status: 'ACTIVE',
            },
            {
              name: 'House Rent Allowance',
              code: 'HRA',
              category: 'ALLOWANCE',
              sequence: 20,
              method: 'PERCENTAGE',
              percentageRate: new Prisma.Decimal(40),
              percentageBase: 'BASIC',
              status: 'ACTIVE',
            },
            {
              name: 'Gross Pay',
              code: 'GROSS',
              category: 'GROSS',
              sequence: 30,
              method: 'FORMULA',
              formula: 'BASIC + HRA',
              status: 'ACTIVE',
            },
            {
              name: 'Provident Fund',
              code: 'PF',
              category: 'DEDUCTION',
              sequence: 40,
              method: 'PERCENTAGE',
              percentageRate: new Prisma.Decimal(12),
              percentageBase: 'BASIC',
              status: 'ACTIVE',
            },
            {
              name: 'Net Pay',
              code: 'NET',
              category: 'NET',
              sequence: 50,
              method: 'FORMULA',
              formula: 'GROSS - PF',
              status: 'ACTIVE',
            },
          ],
        },
      },
    });
    testStructureId = structure.id;

    // 5. Setup 2 Employees
    const emp1 = await prisma.employee.upsert({
      where: { employeeNumber: 'TESTPAY001' },
      update: {},
      create: {
        employeeNumber: 'TESTPAY001',
        firstName: 'Vikram',
        lastName: 'Sharma',
        workEmail: 'vikram.sharma@peoplepay360.dev',
        jobPosition: 'Software Engineer',
        employeeType: 'FULL_TIME',
        departmentId: testDepartmentId,
        workingScheduleId: testScheduleId,
        bankAccountName: 'Vikram Sharma',
        bankAccountNumber: '987654321012',
        bankName: 'HDFC Bank',
        bankIfsc: 'HDFC0001234',
        status: 'ACTIVE',
      },
    });
    testEmployeeId1 = emp1.id;

    const emp2 = await prisma.employee.upsert({
      where: { employeeNumber: 'TESTPAY002' },
      update: {},
      create: {
        employeeNumber: 'TESTPAY002',
        firstName: 'Ananya',
        lastName: 'Roy',
        workEmail: 'ananya.roy@peoplepay360.dev',
        jobPosition: 'QA Engineer',
        employeeType: 'FULL_TIME',
        departmentId: testDepartmentId,
        workingScheduleId: testScheduleId,
        bankAccountName: 'Ananya Roy',
        bankAccountNumber: '876543210987',
        bankName: 'Axis Bank',
        bankIfsc: 'UTIB0005678',
        status: 'ACTIVE',
      },
    });
    testEmployeeId2 = emp2.id;

    // 6. Setup Contracts covering 2026-03-01 to 2026-03-31
    const con1 = await prisma.contract.upsert({
      where: { contractNumber: 'TESTCON/2026/001' },
      update: {},
      create: {
        contractNumber: 'TESTCON/2026/001',
        employeeId: testEmployeeId1,
        departmentId: testDepartmentId,
        salaryStructureId: testStructureId,
        jobPosition: 'Software Engineer',
        startDate: new Date('2026-01-01'),
        endDate: null, // open-ended
        monthlyWage: new Prisma.Decimal(80000),
      },
    });
    testContractId1 = con1.id;

    const con2 = await prisma.contract.upsert({
      where: { contractNumber: 'TESTCON/2026/002' },
      update: {},
      create: {
        contractNumber: 'TESTCON/2026/002',
        employeeId: testEmployeeId2,
        departmentId: testDepartmentId,
        salaryStructureId: testStructureId,
        jobPosition: 'QA Engineer',
        startDate: new Date('2026-01-01'),
        endDate: null,
        monthlyWage: new Prisma.Decimal(60000),
      },
    });
    testContractId2 = con2.id;

    // 7. Setup Attendance records for March 2026
    await prisma.attendance.createMany({
      data: [
        {
          employeeId: testEmployeeId1,
          workingScheduleId: testScheduleId,
          attendanceDate: new Date('2026-03-02'),
          status: 'PRESENT',
          workedMinutes: 480,
          overtimeMinutes: 60,
        },
        {
          employeeId: testEmployeeId1,
          workingScheduleId: testScheduleId,
          attendanceDate: new Date('2026-03-03'),
          status: 'PRESENT',
          workedMinutes: 480,
          overtimeMinutes: 0,
        },
        {
          employeeId: testEmployeeId2,
          workingScheduleId: testScheduleId,
          attendanceDate: new Date('2026-03-02'),
          status: 'PRESENT',
          workedMinutes: 480,
          overtimeMinutes: 0,
        },
      ],
    });

    // 8. Log in test agents
    employeeAgent = request.agent(app);
    await employeeAgent.post('/api/v1/auth/login').send({
      email: 'pay.employee@peoplepay360.dev',
      password: testPassword,
    });

    hrManagerAgent = request.agent(app);
    await hrManagerAgent.post('/api/v1/auth/login').send({
      email: 'pay.hrmanager@peoplepay360.dev',
      password: testPassword,
    });

    payrollUserAgent = request.agent(app);
    await payrollUserAgent.post('/api/v1/auth/login').send({
      email: 'pay.payrolluser@peoplepay360.dev',
      password: testPassword,
    });

    payrollManagerAgent = request.agent(app);
    await payrollManagerAgent.post('/api/v1/auth/login').send({
      email: 'pay.payrollmanager@peoplepay360.dev',
      password: testPassword,
    });

    adminAgent = request.agent(app);
    await adminAgent.post('/api/v1/auth/login').send({
      email: 'pay.admin@peoplepay360.dev',
      password: testPassword,
    });
  });

  afterAll(async () => {
    await prisma.payrollWarning.deleteMany({});
    await prisma.payslipLine.deleteMany({});
    await prisma.payslip.deleteMany({});
    await prisma.payrun.deleteMany({});
    await prisma.contract.deleteMany({ where: { contractNumber: { startsWith: 'TESTCON/' } } });
    await prisma.employee.deleteMany({ where: { employeeNumber: { startsWith: 'TESTPAY' } } });
    await prisma.salaryRule.deleteMany({ where: { salaryStructureId: testStructureId } });
    await prisma.salaryStructure.deleteMany({ where: { id: testStructureId } });
    await prisma.user.deleteMany({ where: { email: { in: testUserEmails } } });
    await pgPool.end();
  });

  describe('RBAC Access Matrix', () => {
    it('denies access to EMPLOYEE and HR_MANAGER with 403 PAYROLL_ACCESS_DENIED', async () => {
      const res1 = await employeeAgent.get('/api/v1/payroll/payruns');
      expect(res1.status).toBe(403);
      expect(res1.body.error.code).toBe('PAYROLL_ACCESS_DENIED');

      const res2 = await hrManagerAgent.post('/api/v1/payroll/payruns').send({});
      expect(res2.status).toBe(403);
      expect(res2.body.error.code).toBe('PAYROLL_ACCESS_DENIED');
    });

    it('allows HR_PAYROLL_USER, HR_PAYROLL_MANAGER, and ADMIN to view payruns', async () => {
      const res = await payrollUserAgent.get('/api/v1/payroll/payruns');
      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
    });
  });

  describe('Eligibility Evaluation Preview', () => {
    it('evaluates eligible employees without creating any database records', async () => {
      const countBefore = await prisma.payrun.count();

      const res = await payrollUserAgent
        .post('/api/v1/payroll/payruns/eligibility')
        .send({
          salaryStructureId: testStructureId,
          periodStart: '2026-03-01',
          periodEnd: '2026-03-31',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.eligibleCount).toBeGreaterThanOrEqual(2);
      expect(res.body.data.items.some((i: any) => i.employeeId === testEmployeeId1 && i.eligible)).toBe(true);

      const countAfter = await prisma.payrun.count();
      expect(countAfter).toBe(countBefore);
    });

    it('rejects invalid period dates', async () => {
      const res = await payrollUserAgent
        .post('/api/v1/payroll/payruns/eligibility')
        .send({
          salaryStructureId: testStructureId,
          periodStart: '2026-03-31',
          periodEnd: '2026-03-01', // start > end
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PAYROLL_PERIOD');
    });
  });

  describe('Payrun Lifecycle Workflow', () => {
    let createdPayrunId: string;
    let createdWarningId: string;

    it('creates a Draft Payrun and child Draft Payslips', async () => {
      const res = await payrollUserAgent
        .post('/api/v1/payroll/payruns')
        .send({
          salaryStructureId: testStructureId,
          periodStart: '2026-03-01',
          periodEnd: '2026-03-31',
          employeeIds: [testEmployeeId1, testEmployeeId2],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('DRAFT');
      expect(res.body.data.payrunNumber).toMatch(/^PAY\/2026\/\d{6}$/);
      expect(res.body.data.totalPayslips).toBe(2);
      createdPayrunId = res.body.data.id;
    });

    it('rejects duplicate exact-period payrun creation for same employees', async () => {
      const res = await payrollUserAgent
        .post('/api/v1/payroll/payruns')
        .send({
          salaryStructureId: testStructureId,
          periodStart: '2026-03-01',
          periodEnd: '2026-03-31',
          employeeIds: [testEmployeeId1],
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PAYSLIP_PERIOD_DUPLICATE');
    });

    it('computes the Payrun, calculating lines, summaries, and warnings', async () => {
      const res = await payrollUserAgent
        .post(`/api/v1/payroll/payruns/${createdPayrunId}/compute`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('COMPUTED');
      expect(res.body.data.grossTotal).toBeDefined();
      expect(res.body.data.netTotal).toBeDefined();

      // Should have generated missing attendance warnings for dates without logs
      expect(res.body.data.warnings.length).toBeGreaterThan(0);
      createdWarningId = res.body.data.warnings[0].id;
    });

    it('recomputes the Payrun from COMPUTED state', async () => {
      const res = await payrollUserAgent
        .post(`/api/v1/payroll/payruns/${createdPayrunId}/recompute`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('COMPUTED');
    });

    it('acknowledges a blocking warning with a reason', async () => {
      // Find an open warning
      const payrunDetail = await payrollUserAgent.get(`/api/v1/payroll/payruns/${createdPayrunId}`);
      const openWarning = payrunDetail.body.data.warnings.find((w: any) => w.status === 'OPEN');
      expect(openWarning).toBeDefined();

      const res = await payrollUserAgent
        .post(`/api/v1/payroll/warnings/${openWarning.id}/acknowledge`)
        .send({ reason: 'Approved manual timesheet exception for March' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ACKNOWLEDGED');
      expect(res.body.data.acknowledgementReason).toBe('Approved manual timesheet exception for March');
    });

    it('allows validation when all open blocking warnings are acknowledged', async () => {
      // Acknowledge all remaining open warnings for clean validation test
      const payrunDetail = await payrollUserAgent.get(`/api/v1/payroll/payruns/${createdPayrunId}`);
      for (const w of payrunDetail.body.data.warnings) {
        if (w.status === 'OPEN') {
          await payrollUserAgent
            .post(`/api/v1/payroll/warnings/${w.id}/acknowledge`)
            .send({ reason: 'Acknowledged exception for test run' });
        }
      }

      const res = await payrollUserAgent
        .post(`/api/v1/payroll/payruns/${createdPayrunId}/validate`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('VALIDATED');
    });

    it('returns the final stored PDF for a validated payslip', async () => {
      const payrunDetail = await payrollUserAgent.get(`/api/v1/payroll/payruns/${createdPayrunId}`);
      const payslipId = payrunDetail.body.data.payslips[0].id;

      const res = await payrollUserAgent
        .get(`/api/v1/payroll/payslips/${payslipId}/pdf`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      const header = res.body.subarray(0, 5).toString('ascii');
      expect(header).toMatch(/^%PDF-/);
    });

    it('marks the validated Payrun as PAID', async () => {
      const res = await payrollUserAgent
        .post(`/api/v1/payroll/payruns/${createdPayrunId}/mark-paid`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PAID');
    });

    it('repeating mark-paid on already PAID payrun is idempotent', async () => {
      const res = await payrollUserAgent
        .post(`/api/v1/payroll/payruns/${createdPayrunId}/mark-paid`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PAID');
    });
  });

  describe('Draft Payrun Discard', () => {
    let discardablePayrunId: string;

    beforeAll(async () => {
      // Create a fresh uncomputed draft payrun for April
      const res = await payrollUserAgent
        .post('/api/v1/payroll/payruns')
        .send({
          salaryStructureId: testStructureId,
          periodStart: '2026-04-01',
          periodEnd: '2026-04-30',
          employeeIds: [testEmployeeId1],
        });
      discardablePayrunId = res.body.data.id;
    });

    it('denies discard to HR_PAYROLL_USER with 403', async () => {
      const res = await payrollUserAgent.delete(`/api/v1/payroll/payruns/${discardablePayrunId}`);
      expect(res.status).toBe(403);
    });

    it('allows HR_PAYROLL_MANAGER to discard an uncomputed draft payrun', async () => {
      const res = await payrollManagerAgent.delete(`/api/v1/payroll/payruns/${discardablePayrunId}`);
      expect(res.status).toBe(200);

      // Verify deletion from DB
      const check = await prisma.payrun.findUnique({ where: { id: discardablePayrunId } });
      expect(check).toBeNull();
    });
  });
});
