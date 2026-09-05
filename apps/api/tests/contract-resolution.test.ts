import { describe, it, expect } from 'vitest';
import {
  assertDateOnly,
  assertValidPeriod,
  contractCoversPeriod,
  resolveApplicableContract,
  resolveEffectiveSchedule,
  evaluateContractEligibility,
  ContractResolutionError,
  type ContractCandidate,
  type EmployeeScheduleContext,
  type PayrollPeriod,
} from '../src/modules/contracts/resolution/index.js';

describe('Contract Period and Schedule Resolver (Phase 5B)', () => {
  // ── 1. Date Validation ───────────────────────────────────────────────────────
  describe('Date-only and Period validation', () => {
    it('accepts valid normal calendar dates', () => {
      expect(() => assertDateOnly('2026-01-01', 'testDate')).not.toThrow();
      expect(() => assertDateOnly('2026-04-30', 'testDate')).not.toThrow();
      expect(() => assertDateOnly('2026-12-31', 'testDate')).not.toThrow();
    });

    it('accepts valid leap year date (2028-02-29)', () => {
      expect(() => assertDateOnly('2028-02-29', 'leapDate')).not.toThrow();
      expect(() => assertDateOnly('2000-02-29', 'centuryLeapDate')).not.toThrow();
    });

    it('accepts valid one-day period', () => {
      const oneDay: PayrollPeriod = {
        startDate: '2026-06-15',
        endDate: '2026-06-15',
      };
      expect(() => assertValidPeriod(oneDay)).not.toThrow();
    });

    it('rejects impossible dates and invalid leap dates', () => {
      // Non-leap year February 29
      try {
        assertDateOnly('2026-02-29', 'date');
        expect.unreachable('Should have thrown');
      } catch (e: any) {
        expect(e).toBeInstanceOf(ContractResolutionError);
        expect(e.code).toBe('INVALID_DATE_ONLY');
      }

      // Century non-leap year February 29 (1900, 2100)
      try {
        assertDateOnly('2100-02-29', 'date');
        expect.unreachable('Should have thrown');
      } catch (e: any) {
        expect(e.code).toBe('INVALID_DATE_ONLY');
      }

      // 31st of April (April has 30 days)
      try {
        assertDateOnly('2026-04-31', 'date');
        expect.unreachable('Should have thrown');
      } catch (e: any) {
        expect(e.code).toBe('INVALID_DATE_ONLY');
      }

      // Month 00 or Day 00
      expect(() => assertDateOnly('2026-00-10', 'date')).toThrowError(ContractResolutionError);
      expect(() => assertDateOnly('2026-05-00', 'date')).toThrowError(ContractResolutionError);
    });

    it('rejects malformed dates, locale styles, and ISO timestamps', () => {
      // US style MM/DD/YYYY
      expect(() => assertDateOnly('01/15/2026', 'date')).toThrowError(ContractResolutionError);

      // ISO timestamp with time
      expect(() => assertDateOnly('2026-01-15T00:00:00Z', 'date')).toThrowError(
        ContractResolutionError
      );

      // Garbage
      expect(() => assertDateOnly('invalid', 'date')).toThrowError(ContractResolutionError);
    });

    it('rejects periods where endDate is before startDate', () => {
      const invalidPeriod: PayrollPeriod = {
        startDate: '2026-02-28',
        endDate: '2026-02-01',
      };

      try {
        assertValidPeriod(invalidPeriod);
        expect.unreachable('Should have thrown');
      } catch (e: any) {
        expect(e).toBeInstanceOf(ContractResolutionError);
        expect(e.code).toBe('INVALID_PAYROLL_PERIOD');
      }
    });
  });

  // ── 2. Contract Coverage ───────────────────────────────────────────────────
  describe('Contract period coverage (contractCoversPeriod)', () => {
    const period: PayrollPeriod = {
      startDate: '2026-02-01',
      endDate: '2026-02-28',
    };

    it('returns true for exact boundary match', () => {
      const contract: ContractCandidate = {
        id: 'c-1',
        employeeId: 'emp-1',
        startDate: '2026-02-01',
        endDate: '2026-02-28',
        salaryStructureId: 'struct-1',
        workingScheduleId: null,
      };
      expect(contractCoversPeriod(contract, period)).toBe(true);
    });

    it('returns true for open-ended contract (endDate: null)', () => {
      const contract: ContractCandidate = {
        id: 'c-2',
        employeeId: 'emp-1',
        startDate: '2026-01-01',
        endDate: null,
        salaryStructureId: 'struct-1',
        workingScheduleId: null,
      };
      expect(contractCoversPeriod(contract, period)).toBe(true);
    });

    it('returns true when contract starts before and ends after period', () => {
      const contract: ContractCandidate = {
        id: 'c-3',
        employeeId: 'emp-1',
        startDate: '2026-01-15',
        endDate: '2026-03-15',
        salaryStructureId: 'struct-1',
        workingScheduleId: null,
      };
      expect(contractCoversPeriod(contract, period)).toBe(true);
    });

    it('returns false when contract starts inside period', () => {
      const contract: ContractCandidate = {
        id: 'c-4',
        employeeId: 'emp-1',
        startDate: '2026-02-05',
        endDate: '2026-02-28',
        salaryStructureId: 'struct-1',
        workingScheduleId: null,
      };
      expect(contractCoversPeriod(contract, period)).toBe(false);
    });

    it('returns false when contract ends inside period', () => {
      const contract: ContractCandidate = {
        id: 'c-5',
        employeeId: 'emp-1',
        startDate: '2026-02-01',
        endDate: '2026-02-20',
        salaryStructureId: 'struct-1',
        workingScheduleId: null,
      };
      expect(contractCoversPeriod(contract, period)).toBe(false);
    });

    it('returns false when contract starts 1 day after period start', () => {
      const contract: ContractCandidate = {
        id: 'c-6',
        employeeId: 'emp-1',
        startDate: '2026-02-02',
        endDate: '2026-02-28',
        salaryStructureId: 'struct-1',
        workingScheduleId: null,
      };
      expect(contractCoversPeriod(contract, period)).toBe(false);
    });

    it('returns false when contract ends 1 day before period end', () => {
      const contract: ContractCandidate = {
        id: 'c-7',
        employeeId: 'emp-1',
        startDate: '2026-02-01',
        endDate: '2026-02-27',
        salaryStructureId: 'struct-1',
        workingScheduleId: null,
      };
      expect(contractCoversPeriod(contract, period)).toBe(false);
    });

    it('returns true for 1-day exact match between contract and period', () => {
      const oneDayPeriod: PayrollPeriod = {
        startDate: '2026-07-01',
        endDate: '2026-07-01',
      };
      const oneDayContract: ContractCandidate = {
        id: 'c-8',
        employeeId: 'emp-1',
        startDate: '2026-07-01',
        endDate: '2026-07-01',
        salaryStructureId: 'struct-1',
        workingScheduleId: null,
      };
      expect(contractCoversPeriod(oneDayContract, oneDayPeriod)).toBe(true);
    });
  });

  // ── 3. Applicable Contract Resolution ──────────────────────────────────────
  describe('Contract resolution (resolveApplicableContract)', () => {
    const period: PayrollPeriod = {
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    };

    it('ignores candidates for other employees and returns only the matching candidate', () => {
      const contracts: ContractCandidate[] = [
        {
          id: 'c-other-emp',
          employeeId: 'emp-99',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          salaryStructureId: 'struct-1',
          workingScheduleId: null,
        },
        {
          id: 'c-target-emp',
          employeeId: 'emp-1',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          salaryStructureId: 'struct-1',
          workingScheduleId: 'sched-1',
        },
      ];

      const resolved = resolveApplicableContract(contracts, 'emp-1', period);
      expect(resolved.id).toBe('c-target-emp');
      expect(resolved.employeeId).toBe('emp-1');
      expect(Object.isFrozen(resolved)).toBe(true);
    });

    it('throws NO_APPLICABLE_CONTRACT when 0 contracts match the period', () => {
      const contracts: ContractCandidate[] = [
        {
          id: 'c-partial',
          employeeId: 'emp-1',
          startDate: '2026-03-10', // Starts mid-period
          endDate: '2026-03-31',
          salaryStructureId: 'struct-1',
          workingScheduleId: null,
        },
      ];

      try {
        resolveApplicableContract(contracts, 'emp-1', period);
        expect.unreachable('Should have thrown');
      } catch (e: any) {
        expect(e).toBeInstanceOf(ContractResolutionError);
        expect(e.code).toBe('NO_APPLICABLE_CONTRACT');
        expect(e.details?.employeeId).toBe('emp-1');
      }
    });

    it('throws MULTIPLE_APPLICABLE_CONTRACTS with contract IDs in details when more than 1 matches', () => {
      const contracts: ContractCandidate[] = [
        {
          id: 'c-1',
          employeeId: 'emp-1',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          salaryStructureId: 'struct-1',
          workingScheduleId: null,
        },
        {
          id: 'c-2',
          employeeId: 'emp-1',
          startDate: '2026-02-01',
          endDate: null,
          salaryStructureId: 'struct-1',
          workingScheduleId: null,
        },
      ];

      try {
        resolveApplicableContract(contracts, 'emp-1', period);
        expect.unreachable('Should have thrown');
      } catch (e: any) {
        expect(e).toBeInstanceOf(ContractResolutionError);
        expect(e.code).toBe('MULTIPLE_APPLICABLE_CONTRACTS');
        expect(e.details?.contractIds).toEqual(['c-1', 'c-2']);
      }
    });

    it('catches invalid candidate date ranges (endDate before startDate)', () => {
      const contracts: ContractCandidate[] = [
        {
          id: 'c-invalid',
          employeeId: 'emp-1',
          startDate: '2026-05-01',
          endDate: '2026-04-01', // Invalid
          salaryStructureId: 'struct-1',
          workingScheduleId: null,
        },
      ];

      try {
        resolveApplicableContract(contracts, 'emp-1', period);
        expect.unreachable('Should have thrown');
      } catch (e: any) {
        expect(e).toBeInstanceOf(ContractResolutionError);
        expect(e.code).toBe('INVALID_DATE_ONLY');
      }
    });

    it('does not mutate input array or candidate objects', () => {
      const contracts: ContractCandidate[] = [
        {
          id: 'c-1',
          employeeId: 'emp-1',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          salaryStructureId: 'struct-1',
          workingScheduleId: null,
        },
      ];

      const copy = [...contracts];
      resolveApplicableContract(contracts, 'emp-1', period);
      expect(contracts.length).toBe(copy.length);
      expect(contracts[0].id).toBe(copy[0].id);
    });
  });

  // ── 4. Effective Schedule Resolution ───────────────────────────────────────
  describe('Schedule precedence (resolveEffectiveSchedule)', () => {
    it('prefers Contract schedule over Employee default schedule', () => {
      const contract: ContractCandidate = {
        id: 'c-1',
        employeeId: 'emp-1',
        startDate: '2026-01-01',
        endDate: null,
        salaryStructureId: 'struct-1',
        workingScheduleId: 'sched-contract-override',
      };
      const employee: EmployeeScheduleContext = {
        employeeId: 'emp-1',
        workingScheduleId: 'sched-employee-default',
      };

      const resolved = resolveEffectiveSchedule(contract, employee);
      expect(resolved.workingScheduleId).toBe('sched-contract-override');
      expect(resolved.source).toBe('CONTRACT');
    });

    it('falls back to Employee schedule when Contract schedule is null', () => {
      const contract: ContractCandidate = {
        id: 'c-1',
        employeeId: 'emp-1',
        startDate: '2026-01-01',
        endDate: null,
        salaryStructureId: 'struct-1',
        workingScheduleId: null,
      };
      const employee: EmployeeScheduleContext = {
        employeeId: 'emp-1',
        workingScheduleId: 'sched-employee-default',
      };

      const resolved = resolveEffectiveSchedule(contract, employee);
      expect(resolved.workingScheduleId).toBe('sched-employee-default');
      expect(resolved.source).toBe('EMPLOYEE');
    });

    it('throws WORKING_SCHEDULE_MISSING when neither Contract nor Employee has a schedule', () => {
      const contract: ContractCandidate = {
        id: 'c-1',
        employeeId: 'emp-1',
        startDate: '2026-01-01',
        endDate: null,
        salaryStructureId: 'struct-1',
        workingScheduleId: null,
      };
      const employee: EmployeeScheduleContext = {
        employeeId: 'emp-1',
        workingScheduleId: null,
      };

      try {
        resolveEffectiveSchedule(contract, employee);
        expect.unreachable('Should have thrown');
      } catch (e: any) {
        expect(e).toBeInstanceOf(ContractResolutionError);
        expect(e.code).toBe('WORKING_SCHEDULE_MISSING');
      }
    });

    it('throws CONTRACT_EMPLOYEE_MISMATCH when contract and employee context differ', () => {
      const contract: ContractCandidate = {
        id: 'c-1',
        employeeId: 'emp-1',
        startDate: '2026-01-01',
        endDate: null,
        salaryStructureId: 'struct-1',
        workingScheduleId: 'sched-1',
      };
      const employee: EmployeeScheduleContext = {
        employeeId: 'emp-DIFFERENT',
        workingScheduleId: 'sched-1',
      };

      try {
        resolveEffectiveSchedule(contract, employee);
        expect.unreachable('Should have thrown');
      } catch (e: any) {
        expect(e).toBeInstanceOf(ContractResolutionError);
        expect(e.code).toBe('CONTRACT_EMPLOYEE_MISMATCH');
      }
    });
  });

  // ── 5. Full Eligibility Composition ────────────────────────────────────────
  describe('Full eligibility composition (evaluateContractEligibility)', () => {
    const period: PayrollPeriod = {
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    };

    const validContract: ContractCandidate = {
      id: 'c-valid',
      employeeId: 'emp-1',
      startDate: '2025-01-01',
      endDate: null,
      salaryStructureId: 'struct-regular',
      workingScheduleId: 'sched-override',
    };

    const employeeContext: EmployeeScheduleContext = {
      employeeId: 'emp-1',
      workingScheduleId: 'sched-default',
    };

    it('succeeds with matching structure and returns resolved context', () => {
      const result = evaluateContractEligibility({
        contracts: [validContract],
        employee: employeeContext,
        period,
        salaryStructureId: 'struct-regular',
      });

      expect(result.contract.id).toBe('c-valid');
      expect(result.schedule.workingScheduleId).toBe('sched-override');
      expect(result.schedule.source).toBe('CONTRACT');
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('throws SALARY_STRUCTURE_MISMATCH when payrun structure differs from contract', () => {
      try {
        evaluateContractEligibility({
          contracts: [validContract],
          employee: employeeContext,
          period,
          salaryStructureId: 'struct-COMMISSION', // Different structure
        });
        expect.unreachable('Should have thrown');
      } catch (e: any) {
        expect(e).toBeInstanceOf(ContractResolutionError);
        expect(e.code).toBe('SALARY_STRUCTURE_MISMATCH');
        expect(e.details?.contractStructureId).toBe('struct-regular');
        expect(e.details?.requestedStructureId).toBe('struct-COMMISSION');
      }
    });

    it('reports missing contract before salary structure mismatch or schedule error', () => {
      // Contract does not cover period
      const expiredContract: ContractCandidate = {
        ...validContract,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      };

      try {
        evaluateContractEligibility({
          contracts: [expiredContract],
          employee: employeeContext,
          period,
          salaryStructureId: 'struct-MISMATCH',
        });
        expect.unreachable('Should have thrown');
      } catch (e: any) {
        // Must throw NO_APPLICABLE_CONTRACT, not structure mismatch
        expect(e.code).toBe('NO_APPLICABLE_CONTRACT');
      }
    });

    it('reports salary structure mismatch before schedule error', () => {
      // Contract matches period, but has structure mismatch AND missing schedule
      const noScheduleContract: ContractCandidate = {
        ...validContract,
        workingScheduleId: null,
      };
      const noScheduleEmployee: EmployeeScheduleContext = {
        employeeId: 'emp-1',
        workingScheduleId: null,
      };

      try {
        evaluateContractEligibility({
          contracts: [noScheduleContract],
          employee: noScheduleEmployee,
          period,
          salaryStructureId: 'struct-DIFFERENT',
        });
        expect.unreachable('Should have thrown');
      } catch (e: any) {
        // Must throw SALARY_STRUCTURE_MISMATCH before WORKING_SCHEDULE_MISSING
        expect(e.code).toBe('SALARY_STRUCTURE_MISMATCH');
      }
    });
  });
});
