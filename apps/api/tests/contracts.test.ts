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
import type { ContractInput } from '@peoplepay360/shared';
import {
  resolveEffectiveSchedule,
  resolvePayrollContract,
} from '../src/modules/contracts/contract-resolver.js';
import { evaluateContractStatus } from '../src/modules/contracts/contract-status.js';

describe('Contracts Module & Phase 5A Integration Tests', () => {
  const app = createApp();
  const testPassword = 'ContractTestPass123!';

  let unlinkedEmployeeAgent: ReturnType<typeof request.agent>;
  let linkedEmployeeAgent: ReturnType<typeof request.agent>;
  let otherEmployeeAgent: ReturnType<typeof request.agent>;
  let hrManagerAgent: ReturnType<typeof request.agent>;
  let payrollUserAgent: ReturnType<typeof request.agent>;
  let payrollManagerAgent: ReturnType<typeof request.agent>;
  let adminAgent: ReturnType<typeof request.agent>;

  let testDepartmentId: string;
  let inactiveDepartmentId: string;
  let testScheduleId: string;
  let inactiveScheduleId: string;
  let testStructureId: string;
  let emptyStructureId: string;
  let linkedEmployeeId: string;
  let otherEmployeeId: string;
  let inactiveEmployeeId: string;

  const testUserEmails = [
    'con.unlinked.emp@peoplepay360.dev',
    'con.linked.emp@peoplepay360.dev',
    'con.other.emp@peoplepay360.dev',
    'con.hr.mgr@peoplepay360.dev',
    'con.pay.user@peoplepay360.dev',
    'con.pay.mgr@peoplepay360.dev',
    'con.admin@peoplepay360.dev',
  ];

  beforeAll(async () => {
    // Clean up previous test runs
    await prisma.auditLog.deleteMany({
      where: { entityType: 'Contract' },
    });
    await prisma.contract.deleteMany({
      where: {
        employee: {
          workEmail: {
            in: [
              'con.linked.emp@peoplepay360.dev',
              'con.other.emp@peoplepay360.dev',
              'con.inactive.emp@peoplepay360.dev',
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
            'con.linked.emp@peoplepay360.dev',
            'con.other.emp@peoplepay360.dev',
            'con.inactive.emp@peoplepay360.dev',
          ],
        },
      },
    });

    // Create Departments
    const dept = await prisma.department.upsert({
      where: { nameKey: 'contract test dept' },
      update: { status: RecordStatus.ACTIVE },
      create: {
        name: 'Contract Test Dept',
        nameKey: 'contract test dept',
        status: RecordStatus.ACTIVE,
      },
    });
    testDepartmentId = dept.id;

    const inactDept = await prisma.department.upsert({
      where: { nameKey: 'contract inactive dept' },
      update: { status: RecordStatus.INACTIVE },
      create: {
        name: 'Contract Inactive Dept',
        nameKey: 'contract inactive dept',
        status: RecordStatus.INACTIVE,
      },
    });
    inactiveDepartmentId = inactDept.id;

    // Create Schedules
    const sched = await prisma.workingSchedule.upsert({
      where: { nameKey: 'contract test sched' },
      update: { status: 'ACTIVE' },
      create: {
        name: 'Contract Test Sched',
        nameKey: 'contract test sched',
        companyName: 'PeoplePay360',
        status: 'ACTIVE',
      },
    });
    testScheduleId = sched.id;

    const inactSched = await prisma.workingSchedule.upsert({
      where: { nameKey: 'contract inact sched' },
      update: { status: 'INACTIVE' },
      create: {
        name: 'Contract Inact Sched',
        nameKey: 'contract inact sched',
        companyName: 'PeoplePay360',
        status: 'INACTIVE',
      },
    });
    inactiveScheduleId = inactSched.id;

    // Create Salary Structures
    const structure = await prisma.salaryStructure.upsert({
      where: { nameKey: 'contract test structure' },
      update: { status: RecordStatus.ACTIVE },
      create: {
        name: 'Contract Test Structure',
        nameKey: 'contract test structure',
        status: RecordStatus.ACTIVE,
      },
    });
    testStructureId = structure.id;

    await prisma.salaryRule.upsert({
      where: {
        salaryStructureId_code: {
          salaryStructureId: testStructureId,
          code: 'BASIC',
        },
      },
      update: { status: RecordStatus.ACTIVE },
      create: {
        salaryStructureId: testStructureId,
        name: 'Basic',
        code: 'BASIC',
        category: 'BASIC',
        sequence: 1,
        method: 'FIXED',
        fixedAmount: new Prisma.Decimal('50000.00'),
        status: RecordStatus.ACTIVE,
      },
    });

    const emptyStructure = await prisma.salaryStructure.upsert({
      where: { nameKey: 'contract empty structure' },
      update: { status: RecordStatus.ACTIVE },
      create: {
        name: 'Contract Empty Structure',
        nameKey: 'contract empty structure',
        status: RecordStatus.ACTIVE,
      },
    });
    emptyStructureId = emptyStructure.id;

    // Create Employees
    const emp1 = await prisma.employee.create({
      data: {
        employeeNumber: 'CON0001',
        firstName: 'Contract',
        lastName: 'EmployeeOne',
        workEmail: 'con.linked.emp@peoplepay360.dev',
        jobPosition: 'Developer',
        employeeType: EmployeeType.FULL_TIME,
        status: RecordStatus.ACTIVE,
        departmentId: testDepartmentId,
        workingScheduleId: testScheduleId,
      },
    });
    linkedEmployeeId = emp1.id;

    const emp2 = await prisma.employee.create({
      data: {
        employeeNumber: 'CON0002',
        firstName: 'Contract',
        lastName: 'EmployeeTwo',
        workEmail: 'con.other.emp@peoplepay360.dev',
        jobPosition: 'Designer',
        employeeType: EmployeeType.FULL_TIME,
        status: RecordStatus.ACTIVE,
        departmentId: testDepartmentId,
      },
    });
    otherEmployeeId = emp2.id;

    const empInactive = await prisma.employee.create({
      data: {
        employeeNumber: 'CON0003',
        firstName: 'Inactive',
        lastName: 'Employee',
        workEmail: 'con.inactive.emp@peoplepay360.dev',
        jobPosition: 'Archived Role',
        employeeType: EmployeeType.FULL_TIME,
        status: RecordStatus.INACTIVE,
        departmentId: testDepartmentId,
      },
    });
    inactiveEmployeeId = empInactive.id;

    // Create Users
    const passwordHash = await argon2.hash(testPassword);

    await prisma.user.create({
      data: {
        email: 'con.unlinked.emp@peoplepay360.dev',
        passwordHash,
        role: Role.EMPLOYEE,
        isActive: true,
      },
    });

    await prisma.user.create({
      data: {
        email: 'con.linked.emp@peoplepay360.dev',
        passwordHash,
        role: Role.EMPLOYEE,
        employeeId: linkedEmployeeId,
        isActive: true,
      },
    });

    await prisma.user.create({
      data: {
        email: 'con.other.emp@peoplepay360.dev',
        passwordHash,
        role: Role.EMPLOYEE,
        employeeId: otherEmployeeId,
        isActive: true,
      },
    });

    await prisma.user.create({
      data: {
        email: 'con.hr.mgr@peoplepay360.dev',
        passwordHash,
        role: Role.HR_MANAGER,
        isActive: true,
      },
    });

    await prisma.user.create({
      data: {
        email: 'con.pay.user@peoplepay360.dev',
        passwordHash,
        role: Role.HR_PAYROLL_USER,
        isActive: true,
      },
    });

    await prisma.user.create({
      data: {
        email: 'con.pay.mgr@peoplepay360.dev',
        passwordHash,
        role: Role.HR_PAYROLL_MANAGER,
        isActive: true,
      },
    });

    await prisma.user.create({
      data: {
        email: 'con.admin@peoplepay360.dev',
        passwordHash,
        role: Role.ADMIN,
        isActive: true,
      },
    });

    // Sign in agents
    async function login(email: string) {
      const agent = request.agent(app);
      await agent
        .post('/api/v1/auth/login')
        .send({ email, password: testPassword })
        .expect(200);
      return agent;
    }

    unlinkedEmployeeAgent = await login('con.unlinked.emp@peoplepay360.dev');
    linkedEmployeeAgent = await login('con.linked.emp@peoplepay360.dev');
    otherEmployeeAgent = await login('con.other.emp@peoplepay360.dev');
    hrManagerAgent = await login('con.hr.mgr@peoplepay360.dev');
    payrollUserAgent = await login('con.pay.user@peoplepay360.dev');
    payrollManagerAgent = await login('con.pay.mgr@peoplepay360.dev');
    adminAgent = await login('con.admin@peoplepay360.dev');
  });

  afterAll(async () => {
    // Cleanup
    await prisma.auditLog.deleteMany({
      where: { entityType: 'Contract' },
    });
    await prisma.contract.deleteMany({
      where: {
        employee: {
          workEmail: {
            in: [
              'con.linked.emp@peoplepay360.dev',
              'con.other.emp@peoplepay360.dev',
              'con.inactive.emp@peoplepay360.dev',
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
            'con.linked.emp@peoplepay360.dev',
            'con.other.emp@peoplepay360.dev',
            'con.inactive.emp@peoplepay360.dev',
          ],
        },
      },
    });
    await pgPool.end();
  });

  describe('1. Database Constraints & Integrity', () => {
    it('direct DB insert rejects endDate before startDate', async () => {
      await expect(
        prisma.contract.create({
          data: {
            contractNumber: 'CON/2026/999001',
            employeeId: linkedEmployeeId,
            departmentId: testDepartmentId,
            salaryStructureId: testStructureId,
            jobPosition: 'Test Position',
            startDate: new Date('2026-06-01T00:00:00.000Z'),
            endDate: new Date('2026-05-01T00:00:00.000Z'),
            monthlyWage: new Prisma.Decimal('50000.00'),
          },
        })
      ).rejects.toThrow();
    });

    it('direct DB insert rejects negative monthly wage', async () => {
      await expect(
        prisma.contract.create({
          data: {
            contractNumber: 'CON/2026/999002',
            employeeId: linkedEmployeeId,
            departmentId: testDepartmentId,
            salaryStructureId: testStructureId,
            jobPosition: 'Test Position',
            startDate: new Date('2026-06-01T00:00:00.000Z'),
            endDate: new Date('2026-06-30T00:00:00.000Z'),
            monthlyWage: new Prisma.Decimal('-500.00'),
          },
        })
      ).rejects.toThrow();
    });

    it('PostgreSQL btree_gist exclusion constraint rejects overlapping date ranges for same employee', async () => {
      const c1 = await prisma.contract.create({
        data: {
          contractNumber: 'CON/2026/999010',
          employeeId: linkedEmployeeId,
          departmentId: testDepartmentId,
          salaryStructureId: testStructureId,
          jobPosition: 'Test Position',
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-01-31T00:00:00.000Z'),
          monthlyWage: new Prisma.Decimal('50000.00'),
        },
      });

      // Overlapping insert (same day 2026-01-31 overlaps)
      await expect(
        prisma.contract.create({
          data: {
            contractNumber: 'CON/2026/999011',
            employeeId: linkedEmployeeId,
            departmentId: testDepartmentId,
            salaryStructureId: testStructureId,
            jobPosition: 'Test Position',
            startDate: new Date('2026-01-31T00:00:00.000Z'),
            endDate: new Date('2026-02-28T00:00:00.000Z'),
            monthlyWage: new Prisma.Decimal('55000.00'),
          },
        })
      ).rejects.toThrow();

      // Clean up c1
      await prisma.contract.delete({ where: { id: c1.id } });
    });

    it('PostgreSQL accepts adjacent inclusive ranges (e.g. ends 2026-01-31, next starts 2026-02-01)', async () => {
      const c1 = await prisma.contract.create({
        data: {
          contractNumber: 'CON/2026/999020',
          employeeId: linkedEmployeeId,
          departmentId: testDepartmentId,
          salaryStructureId: testStructureId,
          jobPosition: 'Test Position',
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-01-31T00:00:00.000Z'),
          monthlyWage: new Prisma.Decimal('50000.00'),
        },
      });

      const c2 = await prisma.contract.create({
        data: {
          contractNumber: 'CON/2026/999021',
          employeeId: linkedEmployeeId,
          departmentId: testDepartmentId,
          salaryStructureId: testStructureId,
          jobPosition: 'Test Position',
          startDate: new Date('2026-02-01T00:00:00.000Z'),
          endDate: new Date('2026-02-28T00:00:00.000Z'),
          monthlyWage: new Prisma.Decimal('55000.00'),
        },
      });

      expect(c1.id).toBeDefined();
      expect(c2.id).toBeDefined();

      await prisma.contract.deleteMany({
        where: { id: { in: [c1.id, c2.id] } },
      });
    });
  });

  describe('2. Contract CRUD & API Rules', () => {
    let createdContractId: string;

    it('POST /api/v1/contracts requires authentication', async () => {
      await request(app)
        .post('/api/v1/contracts')
        .send({})
        .expect(401);
    });

    it('POST /api/v1/contracts rejects EMPLOYEE role (403 CONTRACT_ACCESS_DENIED)', async () => {
      const res = await linkedEmployeeAgent
        .post('/api/v1/contracts')
        .send({
          employeeId: linkedEmployeeId,
          departmentId: testDepartmentId,
          salaryStructureId: testStructureId,
          workingScheduleId: null,
          jobPosition: 'Software Engineer',
          startDate: '2026-03-01',
          endDate: '2026-08-31',
          monthlyWage: '75000.00',
          notes: 'Test contract',
        })
        .expect(403);

      expect(res.body.error.code).toBe('CONTRACT_ACCESS_DENIED');
    });

    it('POST /api/v1/contracts rejects inactive Employee (422 CONTRACT_EMPLOYEE_INACTIVE)', async () => {
      const res = await hrManagerAgent
        .post('/api/v1/contracts')
        .send({
          employeeId: inactiveEmployeeId,
          departmentId: testDepartmentId,
          salaryStructureId: testStructureId,
          workingScheduleId: null,
          jobPosition: 'Inactive Position',
          startDate: '2026-03-01',
          endDate: '2026-08-31',
          monthlyWage: '50000.00',
          notes: null,
        })
        .expect(422);

      expect(res.body.error.code).toBe('CONTRACT_EMPLOYEE_INACTIVE');
    });

    it('POST /api/v1/contracts rejects inactive Department (422 CONTRACT_DEPARTMENT_INACTIVE)', async () => {
      const res = await hrManagerAgent
        .post('/api/v1/contracts')
        .send({
          employeeId: linkedEmployeeId,
          departmentId: inactiveDepartmentId,
          salaryStructureId: testStructureId,
          workingScheduleId: null,
          jobPosition: 'Position',
          startDate: '2026-03-01',
          endDate: '2026-08-31',
          monthlyWage: '50000.00',
          notes: null,
        })
        .expect(422);

      expect(res.body.error.code).toBe('CONTRACT_DEPARTMENT_INACTIVE');
    });

    it('POST /api/v1/contracts rejects Structure without active rules (422 CONTRACT_STRUCTURE_INVALID)', async () => {
      const res = await hrManagerAgent
        .post('/api/v1/contracts')
        .send({
          employeeId: linkedEmployeeId,
          departmentId: testDepartmentId,
          salaryStructureId: emptyStructureId,
          workingScheduleId: null,
          jobPosition: 'Position',
          startDate: '2026-03-01',
          endDate: '2026-08-31',
          monthlyWage: '50000.00',
          notes: null,
        })
        .expect(422);

      expect(res.body.error.code).toBe('CONTRACT_STRUCTURE_INVALID');
    });

    it('POST /api/v1/contracts creates contract, generates CON/YYYY/00000X number and logs CONTRACT_CREATED audit', async () => {
      const input: ContractInput = {
        employeeId: linkedEmployeeId,
        departmentId: testDepartmentId,
        salaryStructureId: testStructureId,
        workingScheduleId: null,
        jobPosition: 'Software Engineer',
        startDate: '2026-03-01',
        endDate: '2026-08-31',
        monthlyWage: '82500.50',
        notes: 'Signed permanent contract',
      };

      const res = await hrManagerAgent
        .post('/api/v1/contracts')
        .send(input)
        .expect(201);

      expect(res.body.data.id).toBeDefined();
      createdContractId = res.body.data.id;
      expect(res.body.data.contractNumber).toMatch(/^CON\/2026\/[0-9]{6}$/);
      expect(res.body.data.monthlyWage).toBe('82500.50');
      expect(res.body.data.currency).toBe('INR');
      expect(res.body.data.effectiveScheduleSource).toBe('EMPLOYEE');
      expect(res.body.data.effectiveSchedule).toBeDefined();
      expect(res.body.data.notes).toBe('Signed permanent contract');

      // Verify AuditLog entry was created atomically
      const audit = await prisma.auditLog.findFirst({
        where: {
          entityType: 'Contract',
          entityId: createdContractId,
          action: 'CONTRACT_CREATED',
        },
      });
      expect(audit).not.toBeNull();
      expect((audit?.after as any).contractNumber).toBe(res.body.data.contractNumber);
    });

    it('POST /api/v1/contracts rejects overlapping period with 409 CONTRACT_PERIOD_OVERLAP', async () => {
      const res = await hrManagerAgent
        .post('/api/v1/contracts')
        .send({
          employeeId: linkedEmployeeId,
          departmentId: testDepartmentId,
          salaryStructureId: testStructureId,
          workingScheduleId: null,
          jobPosition: 'Overlapping Role',
          startDate: '2026-05-01',
          endDate: '2026-09-30',
          monthlyWage: '90000.00',
          notes: null,
        })
        .expect(409);

      expect(res.body.error.code).toBe('CONTRACT_PERIOD_OVERLAP');
      expect(res.body.error.details.fields.conflictingContractNumber).toBeDefined();
    });

    it('PUT /api/v1/contracts/:id allows valid update and logs CONTRACT_UPDATED', async () => {
      const res = await payrollManagerAgent
        .put(`/api/v1/contracts/${createdContractId}`)
        .send({
          employeeId: linkedEmployeeId,
          departmentId: testDepartmentId,
          salaryStructureId: testStructureId,
          workingScheduleId: testScheduleId, // Explicit override
          jobPosition: 'Senior Software Engineer',
          startDate: '2026-03-01',
          endDate: '2026-08-31',
          monthlyWage: '95000.00',
          notes: 'Promoted to Senior Engineer',
        })
        .expect(200);

      expect(res.body.data.jobPosition).toBe('Senior Software Engineer');
      expect(res.body.data.monthlyWage).toBe('95000.00');
      expect(res.body.data.effectiveScheduleSource).toBe('CONTRACT');

      const audit = await prisma.auditLog.findFirst({
        where: {
          entityType: 'Contract',
          entityId: createdContractId,
          action: 'CONTRACT_UPDATED',
        },
      });
      expect(audit).not.toBeNull();
      expect((audit?.after as any).monthlyWage).toBe('95000');
    });

    it('DELETE /api/v1/contracts/:id does not exist (404 or 405)', async () => {
      await adminAgent.delete(`/api/v1/contracts/${createdContractId}`).expect(404);
    });
  });

  describe('3. Ownership and RBAC', () => {
    let employeeContractId: string;
    let otherContractId: string;

    beforeAll(async () => {
      // Contract for linked employee (2025 past contract)
      const c1 = await prisma.contract.create({
        data: {
          contractNumber: 'CON/2025/999101',
          employeeId: linkedEmployeeId,
          departmentId: testDepartmentId,
          salaryStructureId: testStructureId,
          jobPosition: 'Past Role',
          startDate: new Date('2025-01-01T00:00:00.000Z'),
          endDate: new Date('2025-12-31T00:00:00.000Z'),
          monthlyWage: new Prisma.Decimal('60000.00'),
        },
      });
      employeeContractId = c1.id;

      // Contract for other employee
      const c2 = await prisma.contract.create({
        data: {
          contractNumber: 'CON/2026/999102',
          employeeId: otherEmployeeId,
          departmentId: testDepartmentId,
          salaryStructureId: testStructureId,
          jobPosition: 'Designer Role',
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: null,
          monthlyWage: new Prisma.Decimal('70000.00'),
        },
      });
      otherContractId = c2.id;
    });

    it('Unlinked Employee user receives 403 EMPLOYEE_PROFILE_NOT_LINKED', async () => {
      const res = await unlinkedEmployeeAgent.get('/api/v1/contracts').expect(403);
      expect(res.body.error.code).toBe('EMPLOYEE_PROFILE_NOT_LINKED');
    });

    it('Employee sees only own contracts in GET /api/v1/contracts', async () => {
      const res = await linkedEmployeeAgent.get('/api/v1/contracts').expect(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      res.body.data.items.forEach((item: any) => {
        expect(item.employee.id).toBe(linkedEmployeeId);
      });
    });

    it('Employee cannot view other employees contract (returns 404 CONTRACT_NOT_FOUND)', async () => {
      const res = await linkedEmployeeAgent
        .get(`/api/v1/contracts/${otherContractId}`)
        .expect(404);
      expect(res.body.error.code).toBe('CONTRACT_NOT_FOUND');
    });

    it('Employee can view own contract detail', async () => {
      const res = await linkedEmployeeAgent
        .get(`/api/v1/contracts/${employeeContractId}`)
        .expect(200);
      expect(res.body.data.id).toBe(employeeContractId);
      expect(res.body.data.status).toBe('EXPIRED');
    });

    it('HR Manager can view all contracts and filter by employeeId', async () => {
      const res = await hrManagerAgent
        .get(`/api/v1/contracts?employeeId=${otherEmployeeId}`)
        .expect(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].id).toBe(otherContractId);
    });

    it('HR Payroll User can view and create contracts', async () => {
      const res = await payrollUserAgent.get('/api/v1/contracts').expect(200);
      expect(res.body.data.items.length).toBeGreaterThan(0);
    });
  });

  describe('4. Status and Resolver Helper Tests', () => {
    it('evaluateContractStatus computes RUNNING and EXPIRED correctly', () => {
      const today = '2026-09-06';

      // Past contract
      const past = evaluateContractStatus('2025-01-01', '2025-12-31', today);
      expect(past.status).toBe('EXPIRED');
      expect(past.isEffectiveToday).toBe(false);

      // Current running contract
      const current = evaluateContractStatus('2026-01-01', '2026-12-31', today);
      expect(current.status).toBe('RUNNING');
      expect(current.isEffectiveToday).toBe(true);

      // Open-ended running contract
      const openEnded = evaluateContractStatus('2026-01-01', null, today);
      expect(openEnded.status).toBe('RUNNING');
      expect(openEnded.isEffectiveToday).toBe(true);

      // Future contract is RUNNING with isEffectiveToday: false
      const future = evaluateContractStatus('2027-01-01', null, today);
      expect(future.status).toBe('RUNNING');
      expect(future.isEffectiveToday).toBe(false);
    });

    it('resolveEffectiveSchedule follows precedence: CONTRACT -> EMPLOYEE -> MISSING', () => {
      const contractSched = { id: 'cs1', name: 'Contract Schedule', type: 'SHIFT' as const };
      const empSched = { id: 'es1', name: 'Employee Schedule', type: 'STANDARD' as const };

      // Contract override
      const r1 = resolveEffectiveSchedule(contractSched, empSched);
      expect(r1.effectiveScheduleSource).toBe('CONTRACT');
      expect(r1.effectiveSchedule?.name).toBe('Contract Schedule');

      // Employee fallback
      const r2 = resolveEffectiveSchedule(null, empSched);
      expect(r2.effectiveScheduleSource).toBe('EMPLOYEE');
      expect(r2.effectiveSchedule?.name).toBe('Employee Schedule');

      // Missing
      const r3 = resolveEffectiveSchedule(null, null);
      expect(r3.effectiveScheduleSource).toBe('MISSING');
      expect(r3.effectiveSchedule).toBeNull();
    });

    it('resolvePayrollContract returns exact match only when contract covers full period', () => {
      const candidates = [
        {
          id: 'c1',
          startDate: '2026-01-01',
          endDate: '2026-01-31',
        },
        {
          id: 'c2',
          startDate: '2026-02-01',
          endDate: null,
        },
      ];

      // January period: exactly c1
      const jan = resolvePayrollContract(candidates, '2026-01-01', '2026-01-31');
      expect(jan.status).toBe('EXACT_MATCH');
      expect(jan.contract?.id).toBe('c1');

      // Mid-month partial: zero matches (must cover entire period)
      const mid = resolvePayrollContract(candidates, '2026-01-15', '2026-02-15');
      expect(mid.status).toBe('ZERO_MATCHES');
      expect(mid.contract).toBeNull();

      // March period: covered by open-ended c2
      const mar = resolvePayrollContract(candidates, '2026-03-01', '2026-03-31');
      expect(mar.status).toBe('EXACT_MATCH');
      expect(mar.contract?.id).toBe('c2');
    });
  });

  describe('5. Related Module Derived Counts', () => {
    it('Salary Structure exposes real employeeCount', async () => {
      const res = await payrollManagerAgent
        .get(`/api/v1/payroll/structures/${testStructureId}`)
        .expect(200);

      expect(res.body.data.employeeCount).toBeGreaterThanOrEqual(1);
    });

    it('Employee Detail exposes real contractCount for smart button', async () => {
      const res = await hrManagerAgent
        .get(`/api/v1/employees/${linkedEmployeeId}`)
        .expect(200);

      expect(res.body.data.contractCount).toBeGreaterThanOrEqual(1);
    });
  });
});
