import { fetchApi } from '../../lib/api';
import type {
  DepartmentDto,
  DepartmentInput,
  DepartmentQuery,
} from '@peoplepay360/shared';

export interface ApiClientError extends Error {
  code?: string;
  details?: unknown;
}

export async function fetchDepartments(
  query: DepartmentQuery = {}
): Promise<DepartmentDto[]> {
  const params = new URLSearchParams();
  if (query.search) params.append('search', query.search);
  if (query.status) params.append('status', query.status);

  const queryString = params.toString();
  const endpoint = `/departments${queryString ? `?${queryString}` : ''}`;
  const response = await fetchApi<DepartmentDto[]>(endpoint);

  if (response.error) {
    const err: ApiClientError = new Error(
      response.error.message || 'Failed to fetch departments'
    );
    err.code = response.error.code;
    err.details = response.error.details;
    throw err;
  }

  return response.data;
}

export async function createDepartment(
  input: DepartmentInput
): Promise<DepartmentDto> {
  const response = await fetchApi<DepartmentDto>('/departments', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (response.error) {
    const err: ApiClientError = new Error(
      response.error.message || 'Failed to create department'
    );
    err.code = response.error.code;
    err.details = response.error.details;
    throw err;
  }

  return response.data;
}

export async function updateDepartment(
  id: string,
  input: DepartmentInput
): Promise<DepartmentDto> {
  const response = await fetchApi<DepartmentDto>(`/departments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });

  if (response.error) {
    const err: ApiClientError = new Error(
      response.error.message || 'Failed to update department'
    );
    err.code = response.error.code;
    err.details = response.error.details;
    throw err;
  }

  return response.data;
}
