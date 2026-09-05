import { env } from '../../config/env.js';
import {
  formatEmployeeFullName,
  type ContractListItemDto,
  type ContractDetailDto,
} from '@peoplepay360/shared';
import type {
  Contract,
  Employee,
  Department,
  SalaryStructure,
  WorkingSchedule,
} from '@prisma/client';
import { evaluateContractStatus } from './contract-status.js';
import { resolveEffectiveSchedule } from './contract-resolver.js';

export type ContractWithRelations = Contract & {
  employee: Pick<Employee, 'id' | 'employeeNumber' | 'firstName' | 'lastName' | 'jobPosition' | 'departmentId' | 'workingScheduleId'> & {
    department?: Pick<Department, 'id' | 'name'> | null;
    workingSchedule?: Pick<WorkingSchedule, 'id' | 'name' | 'type'> | null;
  };
  department: Pick<Department, 'id' | 'name'>;
  salaryStructure: Pick<SalaryStructure, 'id' | 'name' | 'status'>;
  workingSchedule?: Pick<WorkingSchedule, 'id' | 'name' | 'type'> | null;
};

export function formatDateToYYYYMMDD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function toContractListItemDto(
  contract: ContractWithRelations,
  todayStr?: string
): ContractListItemDto {
  const startDateStr = formatDateToYYYYMMDD(contract.startDate);
  const endDateStr = contract.endDate ? formatDateToYYYYMMDD(contract.endDate) : null;

  const { status, isEffectiveToday } = evaluateContractStatus(
    startDateStr,
    endDateStr,
    todayStr
  );

  const contractSchedule = contract.workingSchedule
    ? {
        id: contract.workingSchedule.id,
        name: contract.workingSchedule.name,
        type: contract.workingSchedule.type,
      }
    : null;

  const employeeSchedule = contract.employee.workingSchedule
    ? {
        id: contract.employee.workingSchedule.id,
        name: contract.employee.workingSchedule.name,
        type: contract.employee.workingSchedule.type,
      }
    : null;

  const { effectiveSchedule, effectiveScheduleSource } = resolveEffectiveSchedule(
    contractSchedule,
    employeeSchedule
  );

  return {
    id: contract.id,
    contractNumber: contract.contractNumber,
    employee: {
      id: contract.employee.id,
      employeeNumber: contract.employee.employeeNumber,
      fullName: formatEmployeeFullName(
        contract.employee.firstName,
        contract.employee.lastName
      ),
    },
    department: {
      id: contract.department.id,
      name: contract.department.name,
    },
    startDate: startDateStr,
    endDate: endDateStr,
    monthlyWage: contract.monthlyWage.toFixed(2),
    currency: env.COMPANY_CURRENCY,
    jobPosition: contract.jobPosition,
    salaryStructure: {
      id: contract.salaryStructure.id,
      name: contract.salaryStructure.name,
      status: contract.salaryStructure.status,
    },
    workingSchedule: contract.workingSchedule
      ? {
          id: contract.workingSchedule.id,
          name: contract.workingSchedule.name,
        }
      : null,
    effectiveScheduleSource,
    effectiveSchedule,
    status,
    isEffectiveToday,
    createdAt: contract.createdAt.toISOString(),
    updatedAt: contract.updatedAt.toISOString(),
  };
}

export function toContractDetailDto(
  contract: ContractWithRelations,
  todayStr?: string
): ContractDetailDto {
  const base = toContractListItemDto(contract, todayStr);

  return {
    ...base,
    notes: contract.notes,
    employeeSuggestions: {
      department: contract.employee.department
        ? {
            id: contract.employee.department.id,
            name: contract.employee.department.name,
          }
        : null,
      jobPosition: contract.employee.jobPosition || null,
      workingSchedule: contract.employee.workingSchedule
        ? {
            id: contract.employee.workingSchedule.id,
            name: contract.employee.workingSchedule.name,
          }
        : null,
    },
  };
}
