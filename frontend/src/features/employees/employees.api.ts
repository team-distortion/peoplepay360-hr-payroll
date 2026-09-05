import { fetchApi } from '../../lib/api';
import type {
  EmployeeDetailDto,
  EmployeeInput,
  EmployeeListQuery,
  EmployeeListResponse,
  RecordStatus,
} from '@peoplepay360/shared';

export interface ApiClientError extends Error {
  code?: string;
  details?: unknown;
}

export async function fetchEmployees(
  query: EmployeeListQuery = {}
): Promise<EmployeeListResponse> {
  const params = new URLSearchParams();
  if (query.search) params.append('search', query.search);
  if (query.status) params.append('status', query.status);
  if (query.employeeType) params.append('employeeType', query.employeeType);
  if (query.departmentId) params.append('departmentId', query.departmentId);
  if (query.managerId) params.append('managerId', query.managerId);
  if (query.workingScheduleId) params.append('workingScheduleId', query.workingScheduleId);
  if (query.sortBy) params.append('sortBy', query.sortBy);
  if (query.sortOrder) params.append('sortOrder', query.sortOrder);
  if (query.page) params.append('page', String(query.page));
  if (query.pageSize) params.append('pageSize', String(query.pageSize));

  const queryString = params.toString();
  const endpoint = `/employees${queryString ? `?${queryString}` : ''}`;
  const response = await fetchApi<EmployeeListResponse>(endpoint);

  if (response.error) {
    const err: ApiClientError = new Error(
      response.error.message || 'Failed to fetch employees'
    );
    err.code = response.error.code;
    err.details = response.error.details;
    throw err;
  }

  return response.data;
}

export async function fetchEmployeeById(id: string): Promise<EmployeeDetailDto> {
  const response = await fetchApi<EmployeeDetailDto>(`/employees/${id}`);

  if (response.error) {
    const err: ApiClientError = new Error(
      response.error.message || 'Failed to fetch employee'
    );
    err.code = response.error.code;
    err.details = response.error.details;
    throw err;
  }

  return response.data;
}

export async function fetchCurrentEmployee(): Promise<EmployeeDetailDto> {
  const response = await fetchApi<EmployeeDetailDto>('/employees/me');

  if (response.error) {
    const err: ApiClientError = new Error(
      response.error.message || 'Failed to fetch current employee profile'
    );
    err.code = response.error.code;
    err.details = response.error.details;
    throw err;
  }

  return response.data;
}

export async function createEmployee(
  input: EmployeeInput
): Promise<EmployeeDetailDto> {
  const response = await fetchApi<EmployeeDetailDto>('/employees', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (response.error) {
    const err: ApiClientError = new Error(
      response.error.message || 'Failed to create employee'
    );
    err.code = response.error.code;
    err.details = response.error.details;
    throw err;
  }

  return response.data;
}

export async function updateEmployee(
  id: string,
  input: EmployeeInput
): Promise<EmployeeDetailDto> {
  const response = await fetchApi<EmployeeDetailDto>(`/employees/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });

  if (response.error) {
    const err: ApiClientError = new Error(
      response.error.message || 'Failed to update employee'
    );
    err.code = response.error.code;
    err.details = response.error.details;
    throw err;
  }

  return response.data;
}

export async function updateEmployeeStatus(
  id: string,
  status: RecordStatus
): Promise<EmployeeDetailDto> {
  const response = await fetchApi<EmployeeDetailDto>(`/employees/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

  if (response.error) {
    const err: ApiClientError = new Error(
      response.error.message || 'Failed to update employee status'
    );
    err.code = response.error.code;
    err.details = response.error.details;
    throw err;
  }

  return response.data;
}
