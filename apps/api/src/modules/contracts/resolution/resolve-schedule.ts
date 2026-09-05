import { ContractResolutionError } from './contract-resolution.errors.js';
import type {
  ContractCandidate,
  EmployeeScheduleContext,
  ResolvedSchedule,
} from './contract-resolution.types.js';

export function resolveEffectiveSchedule(
  contract: ContractCandidate,
  employee: EmployeeScheduleContext
): ResolvedSchedule {
  if (!contract || !employee) {
    throw new ContractResolutionError(
      'WORKING_SCHEDULE_MISSING',
      'Both contract and employee schedule context are required'
    );
  }

  // 1. Require contract.employeeId === employee.employeeId
  if (contract.employeeId !== employee.employeeId) {
    throw new ContractResolutionError(
      'CONTRACT_EMPLOYEE_MISMATCH',
      `Contract employeeId (${contract.employeeId}) does not match employee context (${employee.employeeId})`,
      {
        contractEmployeeId: contract.employeeId,
        contextEmployeeId: employee.employeeId,
        contractId: contract.id,
      }
    );
  }

  // 2. Return Contract schedule with source 'CONTRACT' when non-null/non-empty
  if (
    contract.workingScheduleId !== null &&
    typeof contract.workingScheduleId === 'string' &&
    contract.workingScheduleId.trim().length > 0
  ) {
    return Object.freeze({
      workingScheduleId: contract.workingScheduleId.trim(),
      source: 'CONTRACT',
    });
  }

  // 3. Return Employee schedule with source 'EMPLOYEE' when non-null/non-empty
  if (
    employee.workingScheduleId !== null &&
    typeof employee.workingScheduleId === 'string' &&
    employee.workingScheduleId.trim().length > 0
  ) {
    return Object.freeze({
      workingScheduleId: employee.workingScheduleId.trim(),
      source: 'EMPLOYEE',
    });
  }

  // 4. Otherwise throw WORKING_SCHEDULE_MISSING
  throw new ContractResolutionError(
    'WORKING_SCHEDULE_MISSING',
    `Working schedule is missing for employee '${employee.employeeId}' (not defined on contract or employee)`,
    {
      employeeId: employee.employeeId,
      contractId: contract.id,
    }
  );
}
