import type { ContractStatus } from '@peoplepay360/shared';

export interface ContractStatusEvaluation {
  status: ContractStatus;
  isEffectiveToday: boolean;
}

export function getCompanyTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function evaluateContractStatus(
  startDateStr: string,
  endDateStr: string | null,
  todayStr: string = getCompanyTodayDateString()
): ContractStatusEvaluation {
  // endDate is inclusive.
  // Expired when endDate < today.
  // Running otherwise, including future-dated contracts.
  const isExpired = endDateStr !== null && endDateStr < todayStr;
  const status: ContractStatus = isExpired ? 'EXPIRED' : 'RUNNING';

  // Effective today if startDate <= today and (endDate is null or endDate >= today)
  const isEffectiveToday = startDateStr <= todayStr && (endDateStr === null || endDateStr >= todayStr);

  return {
    status,
    isEffectiveToday,
  };
}
