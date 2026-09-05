import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { Role } from '@prisma/client';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { pgPool } from '../src/lib/session.js';
import type {
  SalaryRuleInput,
  SalaryStructureInput,
  SalaryRuleConfigurationInput,
} from '@peoplepay360/shared';

describe('Salary Configuration API Integration Tests (Phase 4A)', () => {
  const app = createApp();
  const testPassword = 'SalaryConfigTestPass123!';

  let employeeAgent: ReturnType<typeof request.agent>;
  let hrManagerAgent: ReturnType<typeof request.agent>;
  let payrollUserAgent: ReturnType<typeof request.agent>;
  let payrollManagerAgent: ReturnType<typeof request.agent>;
  let adminAgent: ReturnType<typeof request.agent>;

  const testUserEmails = [
    'sal.employee@peoplepay360.dev',
    'sal.hrmanager@peoplepay360.dev',
    'sal.payrolluser@peoplepay360.dev',
    'sal.payrollmanager@peoplepay360.dev',
    'sal.admin@peoplepay360.dev',
  ];

  const createdStructureIds: string[] = [];

  beforeAll(async () => {
    // Clean up any test users
    await prisma.user.deleteMany({
      where: { email: { in: testUserEmails } },
    });

    const passwordHash = await argon2.hash(testPassword);

    // Create test users for all 5 roles
    await prisma.user.createMany({
      data: [
        {
          email: 'sal.employee@peoplepay360.dev',
          passwordHash,
          role: Role.EMPLOYEE,
          isActive: true,
        },
        {
          email: 'sal.hrmanager@peoplepay360.dev',
          passwordHash,
          role: Role.HR_MANAGER,
          isActive: true,
        },
        {
          email: 'sal.payrolluser@peoplepay360.dev',
          passwordHash,
          role: Role.HR_PAYROLL_USER,
          isActive: true,
        },
        {
          email: 'sal.payrollmanager@peoplepay360.dev',
          passwordHash,
          role: Role.HR_PAYROLL_MANAGER,
          isActive: true,
        },
        {
          email: 'sal.admin@peoplepay360.dev',
          passwordHash,
          role: Role.ADMIN,
          isActive: true,
        },
      ],
    });

    // Login each agent
    employeeAgent = request.agent(app);
    await employeeAgent.post('/api/v1/auth/login').send({
      email: 'sal.employee@peoplepay360.dev',
      password: testPassword,
    });

    hrManagerAgent = request.agent(app);
    await hrManagerAgent.post('/api/v1/auth/login').send({
      email: 'sal.hrmanager@peoplepay360.dev',
      password: testPassword,
    });

    payrollUserAgent = request.agent(app);
    await payrollUserAgent.post('/api/v1/auth/login').send({
      email: 'sal.payrolluser@peoplepay360.dev',
      password: testPassword,
    });

    payrollManagerAgent = request.agent(app);
    await payrollManagerAgent.post('/api/v1/auth/login').send({
      email: 'sal.payrollmanager@peoplepay360.dev',
      password: testPassword,
    });

    adminAgent = request.agent(app);
    await adminAgent.post('/api/v1/auth/login').send({
      email: 'sal.admin@peoplepay360.dev',
      password: testPassword,
    });

    // Seed Regular Salary in test DB if not already present
    const regularStructure = await prisma.salaryStructure.upsert({
      where: { nameKey: 'regular salary' },
      update: {
        name: 'Regular Salary',
        description: 'Standard full-time salary structure with basic allowances and statutory deductions',
        status: 'ACTIVE',
      },
      create: {
        name: 'Regular Salary',
        nameKey: 'regular salary',
        description: 'Standard full-time salary structure with basic allowances and statutory deductions',
        status: 'ACTIVE',
      },
    });

    const canonicalRules = [
      { sequence: 10, name: 'Basic Salary', code: 'BASIC', category: 'BASIC' as const, method: 'FORMULA' as const, formula: 'PRORATED_BASIC' },
      { sequence: 20, name: 'House Rent Allowance', code: 'HRA', category: 'ALLOWANCE' as const, method: 'PERCENTAGE' as const, percentageRate: '20.0000', percentageBase: 'BASIC' },
      { sequence: 30, name: 'Meal Allowance', code: 'MEAL', category: 'ALLOWANCE' as const, method: 'FIXED' as const, fixedAmount: '2000.00' },
      { sequence: 40, name: 'Overtime', code: 'OT', category: 'OVERTIME' as const, method: 'FORMULA' as const, formula: 'OVERTIME_HOURS * 250' },
      { sequence: 50, name: 'Gross Salary', code: 'GROSS', category: 'GROSS' as const, method: 'FORMULA' as const, formula: 'BASIC + HRA + MEAL + OT' },
      { sequence: 60, name: 'Provident Fund', code: 'PF', category: 'DEDUCTION' as const, method: 'PERCENTAGE' as const, percentageRate: '12.0000', percentageBase: 'BASIC' },
      { sequence: 70, name: 'Net Salary', code: 'NET', category: 'NET' as const, method: 'FORMULA' as const, formula: 'GROSS - PF' },
    ];

    for (const r of canonicalRules) {
      await prisma.salaryRule.upsert({
        where: {
          salaryStructureId_code: {
            salaryStructureId: regularStructure.id,
            code: r.code,
          },
        },
        update: {
          name: r.name,
          category: r.category,
          sequence: r.sequence,
          method: r.method,
          fixedAmount: (r as any).fixedAmount ?? null,
          percentageRate: (r as any).percentageRate ?? null,
          percentageBase: (r as any).percentageBase ?? null,
          formula: (r as any).formula ?? null,
          status: 'ACTIVE',
        },
        create: {
          salaryStructureId: regularStructure.id,
          name: r.name,
          code: r.code,
          category: r.category,
          sequence: r.sequence,
          method: r.method,
          fixedAmount: (r as any).fixedAmount ?? null,
          percentageRate: (r as any).percentageRate ?? null,
          percentageBase: (r as any).percentageBase ?? null,
          formula: (r as any).formula ?? null,
          status: 'ACTIVE',
        },
      });
    }
  });

  afterAll(async () => {
    // Clean up created test structures and rules
    if (createdStructureIds.length > 0) {
      await prisma.salaryRule.deleteMany({
        where: { salaryStructureId: { in: createdStructureIds } },
      });
      await prisma.salaryStructure.deleteMany({
        where: { id: { in: createdStructureIds } },
      });
    }

    await prisma.user.deleteMany({
      where: { email: { in: testUserEmails } },
    });

    await prisma.$disconnect();
    await pgPool.end();
  });

  describe('1. Role-Based Access Control (RBAC Matrix)', () => {
    it('denies list/read structures to EMPLOYEE and HR_MANAGER (403)', async () => {
      const empRes = await employeeAgent.get('/api/v1/payroll/structures');
      expect(empRes.status).toBe(403);
      expect(empRes.body.error.code).toBe('FORBIDDEN');

      const hrRes = await hrManagerAgent.get('/api/v1/payroll/structures');
      expect(hrRes.status).toBe(403);
      expect(hrRes.body.error.code).toBe('FORBIDDEN');
    });

    it('allows list/read structures to HR_PAYROLL_USER, HR_PAYROLL_MANAGER, and ADMIN (200)', async () => {
      const userRes = await payrollUserAgent.get('/api/v1/payroll/structures');
      expect(userRes.status).toBe(200);
      expect(userRes.body.data.items).toBeDefined();

      const mgrRes = await payrollManagerAgent.get('/api/v1/payroll/structures');
      expect(mgrRes.status).toBe(200);

      const adminRes = await adminAgent.get('/api/v1/payroll/structures');
      expect(adminRes.status).toBe(200);
    });

    it('denies structure creation to HR_PAYROLL_USER (403) but allows HR_PAYROLL_MANAGER (201)', async () => {
      const input: SalaryStructureInput = {
        name: 'RBAC Test Structure',
        description: 'Test description',
        status: 'ACTIVE',
      };

      const userRes = await payrollUserAgent
        .post('/api/v1/payroll/structures')
        .send(input);
      expect(userRes.status).toBe(403);

      const mgrRes = await payrollManagerAgent
        .post('/api/v1/payroll/structures')
        .send(input);
      expect(mgrRes.status).toBe(201);
      expect(mgrRes.body.data.name).toBe('RBAC Test Structure');
      createdStructureIds.push(mgrRes.body.data.id);
    });

    it('denies rule mutations to HR_PAYROLL_USER (403)', async () => {
      const structId = createdStructureIds[0];
      const ruleInput: SalaryRuleInput = {
        name: 'Basic',
        code: 'BASIC',
        category: 'BASIC',
        sequence: 10,
        method: 'FIXED',
        fixedAmount: '1000.00',
        percentageRate: null,
        percentageBase: null,
        formula: null,
        status: 'ACTIVE',
      };

      const res = await payrollUserAgent
        .post(`/api/v1/payroll/structures/${structId}/rules`)
        .send(ruleInput);
      expect(res.status).toBe(403);
    });
  });

  describe('2. Salary Structure Lifecycle & Uniqueness', () => {
    it('enforces case-insensitive structure name uniqueness (409)', async () => {
      const input1: SalaryStructureInput = {
        name: 'Unique Test Structure',
        description: null,
        status: 'ACTIVE',
      };
      const res1 = await payrollManagerAgent
        .post('/api/v1/payroll/structures')
        .send(input1);
      expect(res1.status).toBe(201);
      createdStructureIds.push(res1.body.data.id);

      // Attempt duplicate with different casing and whitespace
      const input2: SalaryStructureInput = {
        name: '  UNIQUE TEST STRUCTURE  ',
        description: 'duplicate',
        status: 'ACTIVE',
      };
      const res2 = await payrollManagerAgent
        .post('/api/v1/payroll/structures')
        .send(input2);
      expect(res2.status).toBe(409);
      expect(res2.body.error.code).toBe('SALARY_STRUCTURE_NAME_EXISTS');
    });

    it('allows saving an INACTIVE structure with 0 rules, but blocks activating it (409)', async () => {
      const input: SalaryStructureInput = {
        name: 'Draft Inactive Structure',
        description: 'Draft',
        status: 'INACTIVE',
      };
      const createRes = await payrollManagerAgent
        .post('/api/v1/payroll/structures')
        .send(input);
      expect(createRes.status).toBe(201);
      const structId = createRes.body.data.id;
      createdStructureIds.push(structId);

      // Attempt to activate via PATCH status
      const patchRes = await payrollManagerAgent
        .patch(`/api/v1/payroll/structures/${structId}/status`)
        .send({ status: 'ACTIVE' });
      expect(patchRes.status).toBe(409);
      expect(patchRes.body.error.code).toBe('SALARY_STRUCTURE_INVALID');

      // Attempt to activate via PUT
      const putRes = await payrollManagerAgent
        .put(`/api/v1/payroll/structures/${structId}`)
        .send({ ...input, status: 'ACTIVE' });
      expect(putRes.status).toBe(409);
      expect(putRes.body.error.code).toBe('SALARY_STRUCTURE_INVALID');
    });
  });

  describe('3. Salary Rule CRUD, Constraints & Method Exclusivity', () => {
    let testStructId: string;

    beforeAll(async () => {
      const res = await payrollManagerAgent
        .post('/api/v1/payroll/structures')
        .send({
          name: 'Rule Tests Structure',
          description: 'Testing rule validation',
          status: 'INACTIVE',
        });
      testStructId = res.body.data.id;
      createdStructureIds.push(testStructId);
    });

    it('rejects FIXED method with extra percentage or formula fields (400)', async () => {
      const invalidInput = {
        name: 'Invalid Fixed',
        code: 'INV_FIX',
        category: 'ALLOWANCE',
        sequence: 10,
        method: 'FIXED',
        fixedAmount: '1000.00',
        percentageRate: '10.00', // extra field
        percentageBase: null,
        formula: null,
        status: 'ACTIVE',
      };

      const res = await payrollManagerAgent
        .post(`/api/v1/payroll/structures/${testStructId}/rules`)
        .send(invalidInput);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid decimal strings or negative amounts (400)', async () => {
      const res1 = await payrollManagerAgent
        .post(`/api/v1/payroll/structures/${testStructId}/rules`)
        .send({
          name: 'Negative',
          code: 'NEG',
          category: 'BASIC',
          sequence: 10,
          method: 'FIXED',
          fixedAmount: '-500.00',
          status: 'ACTIVE',
        });
      expect(res1.status).toBe(400);

      const res2 = await payrollManagerAgent
        .post(`/api/v1/payroll/structures/${testStructId}/rules`)
        .send({
          name: 'Bad Decimals',
          code: 'BAD_DEC',
          category: 'BASIC',
          sequence: 10,
          method: 'FIXED',
          fixedAmount: '100.123', // 3 decimal places
          status: 'ACTIVE',
        });
      expect(res2.status).toBe(400);
    });

    it('enforces rule code uniqueness within the structure (409)', async () => {
      const rule1: SalaryRuleInput = {
        name: 'Basic Pay',
        code: 'BASIC_PAY',
        category: 'BASIC',
        sequence: 10,
        method: 'FIXED',
        fixedAmount: '50000.00',
        percentageRate: null,
        percentageBase: null,
        formula: null,
        status: 'ACTIVE',
      };
      const res1 = await payrollManagerAgent
        .post(`/api/v1/payroll/structures/${testStructId}/rules`)
        .send(rule1);
      expect(res1.status).toBe(201);
      expect(res1.body.data.fixedAmount).toBe('50000.00');

      // Attempt same code
      const rule2: SalaryRuleInput = {
        name: 'Another Basic',
        code: 'BASIC_PAY',
        category: 'BASIC',
        sequence: 20,
        method: 'FIXED',
        fixedAmount: '2000.00',
        percentageRate: null,
        percentageBase: null,
        formula: null,
        status: 'ACTIVE',
      };
      const res2 = await payrollManagerAgent
        .post(`/api/v1/payroll/structures/${testStructId}/rules`)
        .send(rule2);
      expect(res2.status).toBe(409);
      expect(res2.body.error.code).toBe('SALARY_RULE_CODE_EXISTS');
    });

    it('enforces rule sequence uniqueness within the structure (409)', async () => {
      const rule: SalaryRuleInput = {
        name: 'HRA',
        code: 'HRA_PAY',
        category: 'ALLOWANCE',
        sequence: 10, // already used by BASIC_PAY
        method: 'PERCENTAGE',
        fixedAmount: null,
        percentageRate: '20.0000',
        percentageBase: 'BASIC_PAY',
        formula: null,
        status: 'ACTIVE',
      };
      const res = await payrollManagerAgent
        .post(`/api/v1/payroll/structures/${testStructId}/rules`)
        .send(rule);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SALARY_RULE_SEQUENCE_EXISTS');
    });

    it('creates PERCENTAGE rule with earlier active rule base and returns decimal strings', async () => {
      const rule: SalaryRuleInput = {
        name: 'HRA',
        code: 'HRA_PAY',
        category: 'ALLOWANCE',
        sequence: 20,
        method: 'PERCENTAGE',
        fixedAmount: null,
        percentageRate: '20.0000',
        percentageBase: 'BASIC_PAY',
        formula: null,
        status: 'ACTIVE',
      };
      const res = await payrollManagerAgent
        .post(`/api/v1/payroll/structures/${testStructId}/rules`)
        .send(rule);
      expect(res.status).toBe(201);
      expect(res.body.data.percentageRate).toBe('20.0000');
      expect(res.body.data.percentageBase).toBe('BASIC_PAY');
      expect(res.body.data.referencedIdentifiers).toEqual(['BASIC_PAY']);
    });

    it('rejects forward reference in FORMULA and PERCENTAGE methods (409)', async () => {
      const forwardPercent: SalaryRuleInput = {
        name: 'Invalid Percent Forward',
        code: 'INV_PCT',
        category: 'ALLOWANCE',
        sequence: 30,
        method: 'PERCENTAGE',
        fixedAmount: null,
        percentageRate: '10.0000',
        percentageBase: 'FUTURE_CODE', // not defined yet
        formula: null,
        status: 'ACTIVE',
      };
      const res1 = await payrollManagerAgent
        .post(`/api/v1/payroll/structures/${testStructId}/rules`)
        .send(forwardPercent);
      expect(res1.status).toBe(409);
      expect(res1.body.error.code).toBe('SALARY_RULE_DEPENDENCY_INVALID');

      const forwardFormula: SalaryRuleInput = {
        name: 'Invalid Formula Forward',
        code: 'INV_FORM',
        category: 'GROSS',
        sequence: 30,
        method: 'FORMULA',
        fixedAmount: null,
        percentageRate: null,
        percentageBase: null,
        formula: 'BASIC_PAY + FUTURE_CODE',
        status: 'ACTIVE',
      };
      const res2 = await payrollManagerAgent
        .post(`/api/v1/payroll/structures/${testStructId}/rules`)
        .send(forwardFormula);
      expect(res2.status).toBe(409);
      expect(res2.body.error.code).toBe('SALARY_RULE_DEPENDENCY_INVALID');
    });

    it('blocks deactivating a rule if later active rules depend on it (409)', async () => {
      // Find BASIC_PAY rule ID
      const structRes = await payrollManagerAgent.get(
        `/api/v1/payroll/structures/${testStructId}`
      );
      const basicRule = structRes.body.data.rules.find(
        (r: any) => r.code === 'BASIC_PAY'
      );

      // Attempt to deactivate BASIC_PAY when HRA_PAY depends on it
      const res = await payrollManagerAgent
        .patch(`/api/v1/payroll/rules/${basicRule.id}/status`)
        .send({ status: 'INACTIVE' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SALARY_RULE_CODE_IN_USE');
    });
  });

  describe('4. Atomic Multi-Rule Configuration Update', () => {
    let testStructId: string;
    let ruleAId: string;
    let ruleBId: string;

    beforeAll(async () => {
      const sRes = await payrollManagerAgent
        .post('/api/v1/payroll/structures')
        .send({
          name: 'Atomic Config Structure',
          description: 'Testing atomic reordering',
          status: 'ACTIVE',
        });
      testStructId = sRes.body.data.id;
      createdStructureIds.push(testStructId);

      const rARes = await payrollManagerAgent
        .post(`/api/v1/payroll/structures/${testStructId}/rules`)
        .send({
          name: 'Rule Alpha',
          code: 'ALPHA',
          category: 'BASIC',
          sequence: 10,
          method: 'FIXED',
          fixedAmount: '1000.00',
          status: 'ACTIVE',
        });
      ruleAId = rARes.body.data.id;

      const rBRes = await payrollManagerAgent
        .post(`/api/v1/payroll/structures/${testStructId}/rules`)
        .send({
          name: 'Rule Beta',
          code: 'BETA',
          category: 'ALLOWANCE',
          sequence: 20,
          method: 'FIXED',
          fixedAmount: '500.00',
          status: 'ACTIVE',
        });
      ruleBId = rBRes.body.data.id;
    });

    it('swaps sequences atomically without transient collision failures', async () => {
      const configPayload: SalaryRuleConfigurationInput = {
        rules: [
          {
            id: ruleAId,
            name: 'Rule Alpha',
            code: 'ALPHA',
            category: 'BASIC',
            sequence: 20, // swapped to 20
            method: 'FIXED',
            fixedAmount: '1000.00',
            percentageRate: null,
            percentageBase: null,
            formula: null,
            status: 'ACTIVE',
          },
          {
            id: ruleBId,
            name: 'Rule Beta',
            code: 'BETA',
            category: 'ALLOWANCE',
            sequence: 10, // swapped to 10
            method: 'FIXED',
            fixedAmount: '500.00',
            percentageRate: null,
            percentageBase: null,
            formula: null,
            status: 'ACTIVE',
          },
        ],
      };

      const res = await payrollManagerAgent
        .put(`/api/v1/payroll/structures/${testStructId}/rules/configuration`)
        .send(configPayload);

      expect(res.status).toBe(200);
      const rules = res.body.data.rules;
      expect(rules[0].code).toBe('BETA');
      expect(rules[0].sequence).toBe(10);
      expect(rules[1].code).toBe('ALPHA');
      expect(rules[1].sequence).toBe(20);
    });

    it('rejects update if existing rules are omitted (400)', async () => {
      const configPayload: SalaryRuleConfigurationInput = {
        rules: [
          {
            id: ruleAId,
            name: 'Rule Alpha',
            code: 'ALPHA',
            category: 'BASIC',
            sequence: 10,
            method: 'FIXED',
            fixedAmount: '1000.00',
            percentageRate: null,
            percentageBase: null,
            formula: null,
            status: 'ACTIVE',
          },
          // ruleB omitted!
        ],
      };

      const res = await payrollManagerAgent
        .put(`/api/v1/payroll/structures/${testStructId}/rules/configuration`)
        .send(configPayload);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rolls back completely if one rule in atomic batch fails validation', async () => {
      const configPayload: SalaryRuleConfigurationInput = {
        rules: [
          {
            id: ruleAId,
            name: 'Rule Alpha Renamed',
            code: 'ALPHA_RENAMED',
            category: 'BASIC',
            sequence: 10,
            method: 'FIXED',
            fixedAmount: '1000.00',
            percentageRate: null,
            percentageBase: null,
            formula: null,
            status: 'ACTIVE',
          },
          {
            id: ruleBId,
            name: 'Rule Beta Broken',
            code: 'BETA_BROKEN',
            category: 'ALLOWANCE',
            sequence: 20,
            method: 'FORMULA',
            fixedAmount: null,
            percentageRate: null,
            percentageBase: null,
            formula: 'NON_EXISTENT_ID * 2', // invalid dependency!
            status: 'ACTIVE',
          },
        ],
      };

      const res = await payrollManagerAgent
        .put(`/api/v1/payroll/structures/${testStructId}/rules/configuration`)
        .send(configPayload);

      expect(res.status).toBe(409);

      // Verify DB was NOT touched and rule A was not renamed
      const checkRes = await payrollManagerAgent.get(
        `/api/v1/payroll/structures/${testStructId}`
      );
      const alphaRule = checkRes.body.data.rules.find((r: any) => r.id === ruleAId);
      expect(alphaRule.code).toBe('ALPHA');
    });
  });

  describe('5. Seed Idempotency & Regular Salary Structure', () => {
    it('verifies that Regular Salary structure and its 7 canonical rules are present and ordered', async () => {
      const res = await payrollUserAgent.get('/api/v1/payroll/structures');
      expect(res.status).toBe(200);

      const regular = res.body.data.items.find(
        (s: any) => s.name === 'Regular Salary'
      );
      expect(regular).toBeDefined();
      expect(regular.status).toBe('ACTIVE');

      const detailRes = await payrollUserAgent.get(
        `/api/v1/payroll/structures/${regular.id}`
      );
      expect(detailRes.status).toBe(200);
      const rules = detailRes.body.data.rules;

      expect(rules.length).toBe(7);
      expect(rules.map((r: any) => r.code)).toEqual([
        'BASIC',
        'HRA',
        'MEAL',
        'OT',
        'GROSS',
        'PF',
        'NET',
      ]);
      expect(rules.map((r: any) => r.sequence)).toEqual([10, 20, 30, 40, 50, 60, 70]);
    });
  });
});
