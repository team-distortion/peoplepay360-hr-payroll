import type {
  EffectiveScheduleSource,
  WorkingScheduleType,
} from '@peoplepay360/shared';

export interface ScheduleSummary {
  id: string;
  name: string;
  type?: WorkingScheduleType;
}

export interface EffectiveScheduleResolution {
  effectiveSchedule: ScheduleSummary | null;
  effectiveScheduleSource: EffectiveScheduleSource;
}

/**
 * Resolves effective working schedule according to precedence:
 * Contract.workingScheduleId -> Employee.workingScheduleId -> missing
 */
export function resolveEffectiveSchedule(
  contractSchedule: ScheduleSummary | null | undefined,
  employeeSchedule: ScheduleSummary | null | undefined
): EffectiveScheduleResolution {
  if (contractSchedule) {
    return {
      effectiveSchedule: contractSchedule,
      effectiveScheduleSource: 'CONTRACT',
    };
  }

  if (employeeSchedule) {
    return {
      effectiveSchedule: employeeSchedule,
      effectiveScheduleSource: 'EMPLOYEE',
    };
  }

  return {
    effectiveSchedule: null,
    effectiveScheduleSource: 'MISSING',
  };
}

export interface PeriodCandidateContract {
  id: string;
  startDate: string | Date;
  endDate: string | Date | null;
}

export interface PayrollContractResolution<T extends PeriodCandidateContract> {
  contract: T | null;
  status: 'EXACT_MATCH' | 'ZERO_MATCHES' | 'MULTIPLE_MATCHES';
  matches: T[];
}

function normalizeDateString(d: string | Date): string {
  if (typeof d === 'string') {
    return d.slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Resolves exactly one Contract satisfying:
 * startDate <= periodStart AND (endDate IS NULL OR endDate >= periodEnd)
 * A Contract must cover the entire payroll period.
 */
export function resolvePayrollContract<T extends PeriodCandidateContract>(
  contracts: T[],
  periodStart: string,
  periodEnd: string
): PayrollContractResolution<T> {
  const normPeriodStart = periodStart.slice(0, 10);
  const normPeriodEnd = periodEnd.slice(0, 10);

  const matches = contracts.filter((c) => {
    const startStr = normalizeDateString(c.startDate);
    const endStr = c.endDate ? normalizeDateString(c.endDate) : null;

    const coversStart = startStr <= normPeriodStart;
    const coversEnd = endStr === null || endStr >= normPeriodEnd;

    return coversStart && coversEnd;
  });

  if (matches.length === 1) {
    return {
      contract: matches[0],
      status: 'EXACT_MATCH',
      matches,
    };
  }

  if (matches.length === 0) {
    return {
      contract: null,
      status: 'ZERO_MATCHES',
      matches,
    };
  }

  return {
    contract: null,
    status: 'MULTIPLE_MATCHES',
    matches,
  };
}
