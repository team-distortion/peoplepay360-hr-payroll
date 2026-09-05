export interface PayrollPeriod {
  startDate: string;
  endDate: string;
}

export interface ContractCandidate {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string | null;
  salaryStructureId: string;
  workingScheduleId: string | null;
}

export interface EmployeeScheduleContext {
  employeeId: string;
  workingScheduleId: string | null;
}

export interface ResolvedSchedule {
  workingScheduleId: string;
  source: 'CONTRACT' | 'EMPLOYEE';
}

export interface EligibleContractContext {
  contract: ContractCandidate;
  schedule: ResolvedSchedule;
}
