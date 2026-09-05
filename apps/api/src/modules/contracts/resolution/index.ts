export {
  assertDateOnly,
  assertValidPeriod,
} from './date-only.js';

export {
  contractCoversPeriod,
  resolveApplicableContract,
} from './resolve-contract.js';

export {
  resolveEffectiveSchedule,
} from './resolve-schedule.js';

export {
  evaluateContractEligibility,
} from './evaluate-eligibility.js';

export {
  ContractResolutionError,
  type ContractResolutionErrorCode,
} from './contract-resolution.errors.js';

export type {
  PayrollPeriod,
  ContractCandidate,
  EmployeeScheduleContext,
  ResolvedSchedule,
  EligibleContractContext,
} from './contract-resolution.types.js';
