import { ContractResolutionError } from './contract-resolution.errors.js';
import type {
  ContractCandidate,
  EligibleContractContext,
  EmployeeScheduleContext,
  PayrollPeriod,
} from './contract-resolution.types.js';
import { resolveApplicableContract } from './resolve-contract.js';
import { resolveEffectiveSchedule } from './resolve-schedule.js';

export function evaluateContractEligibility(input: {
  contracts: readonly ContractCandidate[];
  employee: EmployeeScheduleContext;
  period: PayrollPeriod;
  salaryStructureId: string;
}): EligibleContractContext {
  if (!input || typeof input !== 'object') {
    throw new ContractResolutionError(
      'NO_APPLICABLE_CONTRACT',
      'Eligibility input object is required'
    );
  }

  // 1. Resolve applicable contract
  const contract = resolveApplicableContract(
    input.contracts,
    input.employee.employeeId,
    input.period
  );

  // 2. Compare its salaryStructureId with selected input.salaryStructureId
  if (contract.salaryStructureId !== input.salaryStructureId) {
    throw new ContractResolutionError(
      'SALARY_STRUCTURE_MISMATCH',
      `Contract salary structure (${contract.salaryStructureId}) does not match requested payrun structure (${input.salaryStructureId})`,
      {
        contractStructureId: contract.salaryStructureId,
        requestedStructureId: input.salaryStructureId,
        contractId: contract.id,
        employeeId: input.employee.employeeId,
      }
    );
  }

  // 3. Resolve effective schedule
  const schedule = resolveEffectiveSchedule(contract, input.employee);

  // 4. Return frozen eligibility result
  return Object.freeze({
    contract,
    schedule,
  });
}
