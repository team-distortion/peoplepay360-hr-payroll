import { fetchApi } from '../../lib/api';
import type {
  DashboardFilters,
  DashboardFilterOptionsDto,
  DashboardHrResponseDto,
  DashboardPayrollResponseDto,
} from '@peoplepay360/shared';

export interface ApiClientError extends Error {
  code?: string;
  details?: unknown;
}

function buildFilterQueryParams(filters: DashboardFilters): string {
  const params = new URLSearchParams();
  if (filters.periodStart) params.append('periodStart', filters.periodStart);
  if (filters.periodEnd) params.append('periodEnd', filters.periodEnd);
  if (filters.departmentId) params.append('departmentId', filters.departmentId);
  if (filters.employeeType) params.append('employeeType', filters.employeeType);
  return params.toString();
}

export async function fetchDashboardFilters(): Promise<DashboardFilterOptionsDto> {
  const response = await fetchApi<DashboardFilterOptionsDto>('/reports/dashboard/filters');
  if (response.error) {
    const err: ApiClientError = new Error(
      response.error.message || 'Failed to fetch dashboard filters'
    );
    err.code = response.error.code;
    err.details = response.error.details;
    throw err;
  }
  return response.data;
}

export async function fetchDashboardHr(
  filters: DashboardFilters,
  signal?: AbortSignal
): Promise<DashboardHrResponseDto> {
  const queryString = buildFilterQueryParams(filters);
  const endpoint = `/reports/dashboard/hr?${queryString}`;
  const response = await fetchApi<DashboardHrResponseDto>(endpoint, { signal });

  if (response.error) {
    const err: ApiClientError = new Error(
      response.error.message || 'Failed to fetch HR dashboard metrics'
    );
    err.code = response.error.code;
    err.details = response.error.details;
    throw err;
  }
  return response.data;
}

export async function fetchDashboardPayroll(
  filters: DashboardFilters,
  signal?: AbortSignal
): Promise<DashboardPayrollResponseDto> {
  const queryString = buildFilterQueryParams(filters);
  const endpoint = `/reports/dashboard/payroll?${queryString}`;
  const response = await fetchApi<DashboardPayrollResponseDto>(endpoint, { signal });

  if (response.error) {
    const err: ApiClientError = new Error(
      response.error.message || 'Failed to fetch payroll dashboard metrics'
    );
    err.code = response.error.code;
    err.details = response.error.details;
    throw err;
  }
  return response.data;
}
