import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { Role, Prisma, RecordStatus, EmployeeType, PayrollStatus, PayrollWarningType, PayrollWarningStatus, Weekday } from '@prisma/client';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { pgPool } from '../src/lib/session.js';

describe('Payroll Dashboard and Reporting API Integration Tests (Phase 10)', () => {
  const app = createApp();
  const testPassword = 'DashboardTestPass123!';

  let employeeAgent: ReturnType<typeof request.agent>;
  let hrManagerAgent: ReturnType<typeof request.agent>;
  let payrollUserAgent: ReturnType<typeof request.agent>;
  let payrollManagerAgent: ReturnType<typeof request.agent>;
  let adminAgent: ReturnType<typeof request.agent>;

  const testUserEmails = [
    'dash.employee@peoplepay360.dev',
    'dash.hrmanager@peoplepay360.dev',
    'dash.payrolluser@peoplepay360.dev',
    'dash.payrollmanager@peoplepay360.dev',
    'dash.admin@peoplepay360.dev',
  ];

  let deptEngineeringId: string;
  let deptMarketingId: string;
  let scheduleId: string;
  let salaryStructureId: string;
  let empEngId: string;
  let empMktId: string;
  let payrunId: string;
  let paidPayslipId: string;
  let draftPayslipId: string;

  beforeAll(async () => {
    // 1. Scoped cleanup
    await prisma.payrollWarning.deleteMany({ where: { payrun: { payrunNumber: { startsWith: 'DASH-PR' } } } });
    await prisma.payslipLine.deleteMany({ where: { payslip: { payrun: { payrunNumber: { startsWith: 'DASH-PR' } } } } });
    await prisma.payslip.deleteMany({ where: { payrun: { payrunNumber: { startsWith: 'DASH-PR' } } } });
    await prisma.payrun.deleteMany({ where: { payrunNumber: { startsWith: 'DASH-PR' } } });

    const existingEmps = await prisma.employee.findMany({
      where: { employeeNumber: { startsWith: 'DASHEMP' } },
      select: { id: true },
    });
    const existingEmpIds = existingEmps.map((e) => e.id);
    if (existingEmpIds.length > 0) {
      await prisma.attendance.deleteMany({ where: { employeeId: { in: existingEmpIds } } });
      await prisma.timeOffRequest.deleteMany({ where: { employeeId: { in: existingEmpIds } } });
      await prisma.timeOffAllocation.deleteMany({ where: { employeeId: { in: existingEmpIds } } });
      await prisma.contract.deleteMany({ where: { employeeId: { in: existingEmpIds } } });
      await prisma.employee.deleteMany({ where: { id: { in: existingEmpIds } } });
    }

    await prisma.user.deleteMany({ where: { email: { in: testUserEmails } } });
    await prisma.department.deleteMany({ where: { nameKey: { in: ['dash-engineering', 'dash-marketing'] } } });
    await prisma.workingScheduleDay.deleteMany({ where: { schedule: { nameKey: 'dash-standard-sched' } } });
    await prisma.workingSchedule.deleteMany({ where: { nameKey: 'dash-standard-sched' } });
    await prisma.salaryRule.deleteMany({ where: { salaryStructure: { nameKey: 'dash-sal-struct' } } });
    await prisma.salaryStructure.deleteMany({ where: { nameKey: 'dash-sal-struct' } });

    // 2. Create Users
    const passwordHash = await argon2.hash(testPassword);
    await prisma.user.createMany({
      data: [
        { email: 'dash.employee@peoplepay360.dev', passwordHash, role: Role.EMPLOYEE, isActive: true },
        { email: 'dash.hrmanager@peoplepay360.dev', passwordHash, role: Role.HR_MANAGER, isActive: true },
        { email: 'dash.payrolluser@peoplepay360.dev', passwordHash, role: Role.HR_PAYROLL_USER, isActive: true },
        { email: 'dash.payrollmanager@peoplepay360.dev', passwordHash, role: Role.HR_PAYROLL_MANAGER, isActive: true },
        { email: 'dash.admin@peoplepay360.dev', passwordHash, role: Role.ADMIN, isActive: true },
      ],
    });

    // 3. Create Departments
    const deptEng = await prisma.department.create({
      data: { name: 'Dash Engineering', nameKey: 'dash-engineering', status: RecordStatus.ACTIVE },
    });
    deptEngineeringId = deptEng.id;

    const deptMkt = await prisma.department.create({
      data: { name: 'Dash Marketing', nameKey: 'dash-marketing', status: RecordStatus.ACTIVE },
    });
    deptMarketingId = deptMkt.id;

    // 4. Create Schedule (Mon-Fri 09:00 - 18:00)
    const sched = await prisma.workingSchedule.create({
      data: {
        name: 'Dash Standard Schedule',
        nameKey: 'dash-standard-sched',
        companyName: 'PeoplePay360',
        status: 'ACTIVE',
        days: {
          createMany: {
            data: [
              Weekday.MONDAY,
              Weekday.TUESDAY,
              Weekday.WEDNESDAY,
              Weekday.THURSDAY,
              Weekday.FRIDAY,
            ].map((dayOfWeek) => ({
              dayOfWeek,
              startMinute: 540,
              endMinute: 1080,
              breakMinutes: 60,
            })),
          },
        },
      },
    });
    scheduleId = sched.id;

    // 5. Create Salary Structure
    const struct = await prisma.salaryStructure.create({
      data: {
        name: 'Dash Salary Structure',
        nameKey: 'dash-sal-struct',
        status: RecordStatus.ACTIVE,
      },
    });
    salaryStructureId = struct.id;

    // 6. Create Employees
    const emp1 = await prisma.employee.create({
      data: {
        employeeNumber: 'DASHEMP001',
        firstName: 'Aarav',
        lastName: 'Sharma',
        workEmail: 'aarav.dash@peoplepay360.dev',
        jobPosition: 'Senior Architect',
        employeeType: EmployeeType.FULL_TIME,
        departmentId: deptEngineeringId,
        workingScheduleId: scheduleId,
        status: RecordStatus.ACTIVE,
      },
    });
    empEngId = emp1.id;

    const emp2 = await prisma.employee.create({
      data: {
        employeeNumber: 'DASHEMP002',
        firstName: 'Meera',
        lastName: 'Patel',
        workEmail: 'meera.dash@peoplepay360.dev',
        jobPosition: 'Growth Marketer',
        employeeType: EmployeeType.PART_TIME,
        departmentId: deptMarketingId,
        workingScheduleId: scheduleId,
        status: RecordStatus.ACTIVE,
      },
    });
    empMktId = emp2.id;

    // 7. Create Contracts
    const con1 = await prisma.contract.create({
      data: {
        contractNumber: 'CON/2026/888001',
        employeeId: empEngId,
        departmentId: deptEngineeringId,
        salaryStructureId,
        jobPosition: 'Senior Architect',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'), // Expiring in March 2026!
        monthlyWage: new Prisma.Decimal(120000),
      },
    });

    const con2 = await prisma.contract.create({
      data: {
        contractNumber: 'CON/2026/888002',
        employeeId: empMktId,
        departmentId: deptMarketingId,
        salaryStructureId,
        jobPosition: 'Growth Marketer',
        startDate: new Date('2026-01-01'),
        endDate: null,
        monthlyWage: new Prisma.Decimal(70000),
      },
    });

    // 8. Create Attendance
    // emp1 worked on 2026-03-02 (Present)
    await prisma.attendance.create({
      data: {
        employeeId: empEngId,
        attendanceDate: new Date('2026-03-02'),
        status: 'PRESENT',
        checkInAt: new Date('2026-03-02T09:00:00Z'),
        checkOutAt: new Date('2026-03-02T18:00:00Z'),
        expectedMinutes: 480,
        workedMinutes: 540,
        overtimeMinutes: 60,
        workingScheduleId: scheduleId,
      },
    });

    // emp2 has open check-in on 2026-03-03 (Missing check-out alert!)
    await prisma.attendance.create({
      data: {
        employeeId: empMktId,
        attendanceDate: new Date('2026-03-03'),
        status: 'PRESENT',
        checkInAt: new Date('2026-03-03T09:00:00Z'),
        checkOutAt: null,
        expectedMinutes: 480,
        workedMinutes: 0,
        overtimeMinutes: 0,
        workingScheduleId: scheduleId,
      },
    });

    // 9. Create Time Off Type & Request
    const timeOffType = await prisma.timeOffType.upsert({
      where: { nameKey: 'dash-pto' },
      update: {},
      create: {
        name: 'Dash PTO',
        nameKey: 'dash-pto',
        unit: 'DAY',
        status: 'ACTIVE',
      },
    });

    const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: 'dash.admin@peoplepay360.dev' } });

    // Pending time off request for emp1 (Pending request alert!)
    await prisma.timeOffRequest.create({
      data: {
        employeeId: empEngId,
        timeOffTypeId: timeOffType.id,
        unitSnapshot: 'DAY',
        requiresAllocationSnapshot: false,
        payrollTreatmentSnapshot: 'PAID',
        startDate: new Date('2026-03-10'),
        endDate: new Date('2026-03-11'),
        requestedUnits: new Prisma.Decimal(2),
        reason: 'Personal time off',
        status: 'PENDING',
        createdByUserId: adminUser.id,
      },
    });

    // Approved full-day time off request for emp2 on 2026-03-12 (Excluded from attendance expected days!)
    await prisma.timeOffRequest.create({
      data: {
        employeeId: empMktId,
        timeOffTypeId: timeOffType.id,
        unitSnapshot: 'DAY',
        requiresAllocationSnapshot: false,
        payrollTreatmentSnapshot: 'PAID',
        startDate: new Date('2026-03-12'),
        endDate: new Date('2026-03-12'),
        requestedUnits: new Prisma.Decimal(1),
        reason: 'Doctor appointment',
        status: 'APPROVED',
        createdByUserId: adminUser.id,
        decidedByUserId: adminUser.id,
        decidedAt: new Date(),
      },
    });

    // 10. Create Payrun & Payslips
    const payrun = await prisma.payrun.create({
      data: {
        payrunNumber: 'DASH-PR-2026-03',
        name: 'March 2026 Dashboard Payrun',
        salaryStructureId,
        salaryStructureName: 'Dash Salary Structure',
        periodStart: new Date('2026-03-01'),
        periodEnd: new Date('2026-03-31'),
        currency: 'INR',
        status: PayrollStatus.PAID,
        createdByUserId: adminUser.id,
      },
    });
    payrunId = payrun.id;

    // Paid payslip for emp1 with immutable snapshots (Department: Dash Engineering)
    const paidSlip = await prisma.payslip.create({
      data: {
        payrunId: payrun.id,
        employeeId: empEngId,
        contractId: con1.id,
        salaryStructureId,
        periodStart: new Date('2026-03-01'),
        periodEnd: new Date('2026-03-31'),
        status: PayrollStatus.PAID,
        departmentIdSnapshot: deptEngineeringId,
        departmentNameSnapshot: 'Dash Engineering',
        employeeTypeSnapshot: EmployeeType.FULL_TIME,
        monthlyWage: new Prisma.Decimal(120000),
        netAmount: new Prisma.Decimal(115000.50),
        grossAmount: new Prisma.Decimal(120000),
      },
    });
    paidPayslipId = paidSlip.id;

    // Draft payslip for emp2 (Must be excluded from paid salary and generated counts!)
    const draftSlip = await prisma.payslip.create({
      data: {
        payrunId: payrun.id,
        employeeId: empMktId,
        contractId: con2.id,
        salaryStructureId,
        periodStart: new Date('2026-03-01'),
        periodEnd: new Date('2026-03-31'),
        status: PayrollStatus.DRAFT,
        departmentIdSnapshot: deptMarketingId,
        departmentNameSnapshot: 'Dash Marketing',
        employeeTypeSnapshot: EmployeeType.PART_TIME,
        monthlyWage: new Prisma.Decimal(70000),
        netAmount: new Prisma.Decimal(65000.00),
      },
    });
    draftPayslipId = draftSlip.id;

    // 11. Create a draft payrun in same period (Draft payrun alert!)
    await prisma.payrun.create({
      data: {
        payrunNumber: 'DASH-PR-2026-03-DRAFT',
        name: 'Draft Secondary Payrun',
        salaryStructureId,
        salaryStructureName: 'Dash Salary Structure',
        periodStart: new Date('2026-03-01'),
        periodEnd: new Date('2026-03-31'),
        currency: 'INR',
        status: PayrollStatus.DRAFT,
        createdByUserId: adminUser.id,
      },
    });

    // 12. Create open blocking warning on the payrun
    await prisma.payrollWarning.create({
      data: {
        payrunId: payrun.id,
        payslipId: paidSlip.id,
        type: PayrollWarningType.MISSING_BANK_DETAILS,
        status: PayrollWarningStatus.OPEN,
        message: 'Missing bank account information',
        blocking: true,
        acknowledgeable: true,
      },
    });

    // 13. Set up supertest agents
    employeeAgent = request.agent(app);
    await employeeAgent.post('/api/v1/auth/login').send({
      email: 'dash.employee@peoplepay360.dev',
      password: testPassword,
    });

    hrManagerAgent = request.agent(app);
    await hrManagerAgent.post('/api/v1/auth/login').send({
      email: 'dash.hrmanager@peoplepay360.dev',
      password: testPassword,
    });

    payrollUserAgent = request.agent(app);
    await payrollUserAgent.post('/api/v1/auth/login').send({
      email: 'dash.payrolluser@peoplepay360.dev',
      password: testPassword,
    });

    payrollManagerAgent = request.agent(app);
    await payrollManagerAgent.post('/api/v1/auth/login').send({
      email: 'dash.payrollmanager@peoplepay360.dev',
      password: testPassword,
    });

    adminAgent = request.agent(app);
    await adminAgent.post('/api/v1/auth/login').send({
      email: 'dash.admin@peoplepay360.dev',
      password: testPassword,
    });
  });

  afterAll(async () => {
    await prisma.payrollWarning.deleteMany({ where: { payrun: { payrunNumber: { startsWith: 'DASH-PR' } } } });
    await prisma.payslipLine.deleteMany({ where: { payslip: { payrun: { payrunNumber: { startsWith: 'DASH-PR' } } } } });
    await prisma.payslip.deleteMany({ where: { payrun: { payrunNumber: { startsWith: 'DASH-PR' } } } });
    await prisma.payrun.deleteMany({ where: { payrunNumber: { startsWith: 'DASH-PR' } } });

    const existingEmps = await prisma.employee.findMany({
      where: { employeeNumber: { startsWith: 'DASHEMP' } },
      select: { id: true },
    });
    const existingEmpIds = existingEmps.map((e) => e.id);
    if (existingEmpIds.length > 0) {
      await prisma.attendance.deleteMany({ where: { employeeId: { in: existingEmpIds } } });
      await prisma.timeOffRequest.deleteMany({ where: { employeeId: { in: existingEmpIds } } });
      await prisma.timeOffAllocation.deleteMany({ where: { employeeId: { in: existingEmpIds } } });
      await prisma.contract.deleteMany({ where: { employeeId: { in: existingEmpIds } } });
      await prisma.employee.deleteMany({ where: { id: { in: existingEmpIds } } });
    }

    await prisma.user.deleteMany({ where: { email: { in: testUserEmails } } });
    await prisma.department.deleteMany({ where: { nameKey: { in: ['dash-engineering', 'dash-marketing'] } } });
    await prisma.workingScheduleDay.deleteMany({ where: { schedule: { nameKey: 'dash-standard-sched' } } });
    await prisma.workingSchedule.deleteMany({ where: { nameKey: 'dash-standard-sched' } });
    await prisma.salaryRule.deleteMany({ where: { salaryStructure: { nameKey: 'dash-sal-struct' } } });
    await prisma.salaryStructure.deleteMany({ where: { nameKey: 'dash-sal-struct' } });

    await pgPool.end();
  });

  // ── 1. RBAC Access Matrix Tests ────────────────────────────────────
  describe('RBAC Access Matrix', () => {
    it('denies unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/v1/reports/dashboard/filters');
      expect(res.status).toBe(401);
    });

    it('denies EMPLOYEE from /filters, /hr, and /payroll with 403 DASHBOARD_ACCESS_DENIED', async () => {
      const res1 = await employeeAgent.get('/api/v1/reports/dashboard/filters');
      expect(res1.status).toBe(403);
      expect(res1.body.error.code).toBe('DASHBOARD_ACCESS_DENIED');

      const res2 = await employeeAgent.get('/api/v1/reports/dashboard/hr?periodStart=2026-03-01&periodEnd=2026-03-31');
      expect(res2.status).toBe(403);
      expect(res2.body.error.code).toBe('DASHBOARD_ACCESS_DENIED');

      const res3 = await employeeAgent.get('/api/v1/reports/dashboard/payroll?periodStart=2026-03-01&periodEnd=2026-03-31');
      expect(res3.status).toBe(403);
      expect(res3.body.error.code).toBe('DASHBOARD_ACCESS_DENIED');
    });

    it('allows HR_MANAGER to read filters and HR section, but denies payroll section with 403', async () => {
      const resFilters = await hrManagerAgent.get('/api/v1/reports/dashboard/filters');
      expect(resFilters.status).toBe(200);
      expect(resFilters.body.data.departments).toBeDefined();

      const resHr = await hrManagerAgent.get('/api/v1/reports/dashboard/hr?periodStart=2026-03-01&periodEnd=2026-03-31');
      expect(resHr.status).toBe(200);
      expect(resHr.body.data.headcount).toBeGreaterThanOrEqual(2);

      const resPayroll = await hrManagerAgent.get('/api/v1/reports/dashboard/payroll?periodStart=2026-03-01&periodEnd=2026-03-31');
      expect(resPayroll.status).toBe(403);
      expect(resPayroll.body.error.code).toBe('DASHBOARD_ACCESS_DENIED');
    });

    it('allows HR_PAYROLL_USER, HR_PAYROLL_MANAGER, and ADMIN to read both HR and Payroll sections', async () => {
      for (const agent of [payrollUserAgent, payrollManagerAgent, adminAgent]) {
        const resHr = await agent.get('/api/v1/reports/dashboard/hr?periodStart=2026-03-01&periodEnd=2026-03-31');
        expect(resHr.status).toBe(200);
        expect(resHr.body.data).toBeDefined();

        const resPayroll = await agent.get('/api/v1/reports/dashboard/payroll?periodStart=2026-03-01&periodEnd=2026-03-31');
        expect(resPayroll.status).toBe(200);
        expect(resPayroll.body.data).toBeDefined();
      }
    });
  });

  // ── 2. Filter Validation Tests ─────────────────────────────────────
  describe('Filter Validation & Boundaries', () => {
    it('rejects missing periodStart or periodEnd with 400 INVALID_DASHBOARD_FILTERS', async () => {
      const res = await adminAgent.get('/api/v1/reports/dashboard/hr?periodStart=2026-03-01');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_DASHBOARD_FILTERS');
    });

    it('rejects malformed date strings with 400 INVALID_DASHBOARD_FILTERS', async () => {
      const res = await adminAgent.get('/api/v1/reports/dashboard/hr?periodStart=not-a-date&periodEnd=2026-03-31');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_DASHBOARD_FILTERS');
    });

    it('rejects periodStart > periodEnd with 400 INVALID_DASHBOARD_FILTERS', async () => {
      const res = await adminAgent.get('/api/v1/reports/dashboard/hr?periodStart=2026-04-01&periodEnd=2026-03-31');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_DASHBOARD_FILTERS');
    });

    it('rejects date range exceeding 366 days with 400 INVALID_DASHBOARD_FILTERS', async () => {
      const res = await adminAgent.get('/api/v1/reports/dashboard/hr?periodStart=2025-01-01&periodEnd=2026-02-01');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_DASHBOARD_FILTERS');
    });

    it('rejects unknown query keys with 400 INVALID_DASHBOARD_FILTERS', async () => {
      const res = await adminAgent.get('/api/v1/reports/dashboard/hr?periodStart=2026-03-01&periodEnd=2026-03-31&unknownKey=123');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_DASHBOARD_FILTERS');
    });

    it('rejects non-existent department with 404 DEPARTMENT_NOT_FOUND', async () => {
      const res = await adminAgent.get('/api/v1/reports/dashboard/hr?periodStart=2026-03-01&periodEnd=2026-03-31&departmentId=a0000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('DEPARTMENT_NOT_FOUND');
    });
  });

  // ── 3. HR Section Aggregations & Semantics ─────────────────────────
  describe('HR Section Aggregations', () => {
    it('calculates headcount and department distribution accurately', async () => {
      const res = await adminAgent.get('/api/v1/reports/dashboard/hr?periodStart=2026-03-01&periodEnd=2026-03-31');
      expect(res.status).toBe(200);

      const data = res.body.data;
      expect(data.headcount).toBeGreaterThanOrEqual(2);

      const engDept = data.departmentHeadcount.find((d: any) => d.departmentId === deptEngineeringId);
      expect(engDept).toBeDefined();
      expect(engDept.headcount).toBe(1);

      const mktDept = data.departmentHeadcount.find((d: any) => d.departmentId === deptMarketingId);
      expect(mktDept).toBeDefined();
      expect(mktDept.headcount).toBe(1);
    });

    it('calculates attendance totals and coverage excluding full-day time-off', async () => {
      const res = await adminAgent.get('/api/v1/reports/dashboard/hr?periodStart=2026-03-01&periodEnd=2026-03-31');
      expect(res.status).toBe(200);

      const att = res.body.data.attendance;
      expect(att.present).toBeGreaterThanOrEqual(2);
      expect(att.overtimeMinutes).toBeGreaterThanOrEqual(60);
      expect(att.missingCheckOuts).toBeGreaterThanOrEqual(1);
      expect(att.hasCoverageData).toBe(true);
      expect(typeof att.coveragePercent).toBe('string');
      expect(att.coveragePercent).toMatch(/^\d+\.\d{4}$/);
    });

    it('returns 0.0000 and hasCoverageData: false when expected days is zero', async () => {
      // Sunday-only range
      const res = await adminAgent.get('/api/v1/reports/dashboard/hr?periodStart=2026-03-08&periodEnd=2026-03-08');
      expect(res.status).toBe(200);

      const att = res.body.data.attendance;
      expect(att.expectedDays).toBe(0);
      expect(att.hasCoverageData).toBe(false);
      expect(att.coveragePercent).toBe('0.0000');
    });

    it('separates approved DAY and HOUR time off units without mixing them', async () => {
      const res = await adminAgent.get('/api/v1/reports/dashboard/hr?periodStart=2026-03-01&periodEnd=2026-03-31');
      expect(res.status).toBe(200);

      const to = res.body.data.timeOff;
      expect(to.approvedRequestCount).toBeGreaterThanOrEqual(1);
      expect(to.approvedDayUnits).toBe('1.00'); // doctor appointment approved
      expect(to.approvedHourUnits).toBe('0.00');
      expect(to.pendingRequestCount).toBeGreaterThanOrEqual(1); // personal time off pending
    });

    it('returns HR alerts with deepLinks for expiring contracts and pending requests', async () => {
      const res = await adminAgent.get('/api/v1/reports/dashboard/hr?periodStart=2026-03-01&periodEnd=2026-03-31');
      expect(res.status).toBe(200);

      const alerts = res.body.data.hrAlerts;
      const expiring = alerts.find((a: any) => a.code === 'CONTRACT_EXPIRING');
      expect(expiring).toBeDefined();
      expect(expiring.deepLink).toBe('/contracts');

      const missingCheckouts = alerts.find((a: any) => a.code === 'ATTENDANCE_MISSING_CHECKOUT');
      expect(missingCheckouts).toBeDefined();
      expect(missingCheckouts.deepLink).toBe('/attendance');

      const pendingTimeOff = alerts.find((a: any) => a.code === 'PENDING_TIME_OFF_REQUEST');
      expect(pendingTimeOff).toBeDefined();
      expect(pendingTimeOff.deepLink).toBe('/time-off/requests');
    });
  });

  // ── 4. Payroll Section Aggregations & Semantics ────────────────────
  describe('Payroll Section Aggregations', () => {
    it('aggregates totalNetSalaryPaid only from PAID payslips with exact Decimal strings', async () => {
      const res = await adminAgent.get('/api/v1/reports/dashboard/payroll?periodStart=2026-03-01&periodEnd=2026-03-31');
      expect(res.status).toBe(200);

      const p = res.body.data;
      // Exactly paidPayslip (115000.50), draftPayslip (65000) excluded!
      expect(p.totalNetSalaryPaid).toBe('115000.50');
      expect(p.averagePaidSalary).toBe('115000.50');
      expect(p.payslipsGenerated).toBe(1); // 1 paid payslip generated, 1 draft excluded
    });

    it('groups historical salary cost by immutable department snapshot even if employee changes department', async () => {
      // Temporarily move Aarav to Marketing
      await prisma.employee.update({
        where: { id: empEngId },
        data: { departmentId: deptMarketingId },
      });

      try {
        const res = await adminAgent.get('/api/v1/reports/dashboard/payroll?periodStart=2026-03-01&periodEnd=2026-03-31');
        expect(res.status).toBe(200);

        // Even though employee's current department is now Marketing,
        // the finalized March payslip snapshot remains in Dash Engineering!
        const deptCost = res.body.data.salaryCostByDepartment.find(
          (d: any) => d.departmentId === deptEngineeringId
        );
        expect(deptCost).toBeDefined();
        expect(deptCost.totalPaidNet).toBe('115000.50');
      } finally {
        // Restore Aarav to Engineering
        await prisma.employee.update({
          where: { id: empEngId },
          data: { departmentId: deptEngineeringId },
        });
      }
    });

    it('returns chronological monthly salary trend array', async () => {
      const res = await adminAgent.get('/api/v1/reports/dashboard/payroll?periodStart=2026-03-01&periodEnd=2026-03-31');
      expect(res.status).toBe(200);

      const trend = res.body.data.monthlyNetSalaryTrend;
      expect(trend.length).toBeGreaterThanOrEqual(1);
      expect(trend[0].month).toBe('2026-03');
      expect(trend[0].totalPaidNet).toBe('115000.50');
    });

    it('returns payrun status counts and warning counts with blocking breakdowns', async () => {
      const res = await adminAgent.get('/api/v1/reports/dashboard/payroll?periodStart=2026-03-01&periodEnd=2026-03-31');
      expect(res.status).toBe(200);

      const p = res.body.data;
      expect(p.payrunStatusCounts.paid).toBeGreaterThanOrEqual(1);
      expect(p.payrunStatusCounts.draft).toBeGreaterThanOrEqual(1);

      expect(p.warningCounts.blockingCount).toBeGreaterThanOrEqual(1);
      expect(p.warningCounts.byStatus.OPEN).toBeGreaterThanOrEqual(1);
    });

    it('returns payroll alerts for draft payruns and open blocking warnings', async () => {
      const res = await adminAgent.get('/api/v1/reports/dashboard/payroll?periodStart=2026-03-01&periodEnd=2026-03-31');
      expect(res.status).toBe(200);

      const alerts = res.body.data.payrollAlerts;
      const draftAlert = alerts.find((a: any) => a.code === 'DRAFT_PAYRUN');
      expect(draftAlert).toBeDefined();
      expect(draftAlert.deepLink).toBe('/payroll/payruns');

      const blockingAlert = alerts.find((a: any) => a.code === 'OPEN_BLOCKING_PAYROLL_WARNING');
      expect(blockingAlert).toBeDefined();
      expect(blockingAlert.deepLink).toBe('/payroll/payruns');
    });

    it('ensures no private bank details, passwords, or PDF bytes are leaked in responses', async () => {
      const resPayroll = await adminAgent.get('/api/v1/reports/dashboard/payroll?periodStart=2026-03-01&periodEnd=2026-03-31');
      const bodyStr = JSON.stringify(resPayroll.body);
      expect(bodyStr).not.toContain('bankAccount');
      expect(bodyStr).not.toContain('passwordHash');
      expect(bodyStr).not.toContain('finalPdf');
      expect(bodyStr).not.toContain('auditLog');
    });

    it('returns stable empty DTOs with "0.00" strings for empty periods', async () => {
      const res = await adminAgent.get('/api/v1/reports/dashboard/payroll?periodStart=2020-01-01&periodEnd=2020-01-31');
      expect(res.status).toBe(200);

      const p = res.body.data;
      expect(p.totalNetSalaryPaid).toBe('0.00');
      expect(p.averagePaidSalary).toBe('0.00');
      expect(p.payslipsGenerated).toBe(0);
      expect(p.salaryCostByDepartment).toEqual([]);
      expect(p.monthlyNetSalaryTrend).toEqual([]);
      expect(p.payrollAlerts).toEqual([]);
    });
  });
});
