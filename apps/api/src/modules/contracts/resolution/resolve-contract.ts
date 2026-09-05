import { ContractResolutionError } from './contract-resolution.errors.js';
import type { ContractCandidate, PayrollPeriod } from './contract-resolution.types.js';
import { assertDateOnly, assertValidPeriod } from './date-only.js';

export function contractCoversPeriod(
  contract: ContractCandidate,
  period: PayrollPeriod
): boolean {
  if (!contract || typeof contract !== 'object') {
    throw new ContractResolutionError(
      'NO_APPLICABLE_CONTRACT',
      'Contract candidate must be an object'
    );
  }

  assertDateOnly(contract.startDate, 'contract.startDate');
  if (contract.endDate !== null) {
    assertDateOnly(contract.endDate, 'contract.endDate');
    if (contract.startDate > contract.endDate) {
      throw new ContractResolutionError(
        'INVALID_DATE_ONLY',
        `Contract '${contract.id}' startDate (${contract.startDate}) must be on or before endDate (${contract.endDate})`,
        {
          contractId: contract.id,
          startDate: contract.startDate,
          endDate: contract.endDate,
        }
      );
    }
  }

  assertValidPeriod(period);

  const startsBeforeOrOn = contract.startDate <= period.startDate;
  const endsAfterOrOn = contract.endDate === null || contract.endDate >= period.endDate;

  return startsBeforeOrOn && endsAfterOrOn;
}

export function resolveApplicableContract(
  contracts: readonly ContractCandidate[],
  employeeId: string,
  period: PayrollPeriod
): ContractCandidate {
  if (!employeeId || typeof employeeId !== 'string' || employeeId.trim().length === 0) {
    throw new ContractResolutionError(
      'CONTRACT_EMPLOYEE_MISMATCH',
      'A non-empty employeeId is required for contract resolution'
    );
  }

  assertValidPeriod(period);

  if (!Array.isArray(contracts)) {
    throw new ContractResolutionError(
      'NO_APPLICABLE_CONTRACT',
      'Contracts must be an array of contract candidates'
    );
  }

  // 2. Inspect only candidates with matching employeeId
  const employeeCandidates = contracts.filter(c => c && c.employeeId === employeeId);

  // 3. Validate every inspected candidate's start/end date
  for (const c of employeeCandidates) {
    assertDateOnly(c.startDate, 'contract.startDate');
    if (c.endDate !== null) {
      assertDateOnly(c.endDate, 'contract.endDate');
      if (c.startDate > c.endDate) {
        throw new ContractResolutionError(
          'INVALID_DATE_ONLY',
          `Contract '${c.id}' startDate (${c.startDate}) must be on or before endDate (${c.endDate})`,
          {
            contractId: c.id,
            startDate: c.startDate,
            endDate: c.endDate,
          }
        );
      }
    }
  }

  // 4. Keep candidates covering the complete Period
  const applicable = employeeCandidates.filter(c => contractCoversPeriod(c, period));

  // 5. Return when exactly one matches
  if (applicable.length === 1) {
    return Object.freeze({ ...applicable[0] });
  }

  // 6. Throw NO_APPLICABLE_CONTRACT when none match
  if (applicable.length === 0) {
    throw new ContractResolutionError(
      'NO_APPLICABLE_CONTRACT',
      `No applicable contract found covering period ${period.startDate} to ${period.endDate} for employee '${employeeId}'`,
      { employeeId, period }
    );
  }

  // 7. Throw MULTIPLE_APPLICABLE_CONTRACTS when more than one matches
  throw new ContractResolutionError(
    'MULTIPLE_APPLICABLE_CONTRACTS',
    `Multiple applicable contracts found covering period ${period.startDate} to ${period.endDate} for employee '${employeeId}'`,
    {
      employeeId,
      period,
      contractIds: applicable.map(c => c.id),
    }
  );
}
