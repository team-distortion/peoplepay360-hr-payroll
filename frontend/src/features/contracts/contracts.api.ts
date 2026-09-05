import { fetchApi } from '../../lib/api';
import type {
  ContractDetailDto,
  ContractInput,
  ContractListQuery,
  ContractListResponse,
} from '@peoplepay360/shared';

export interface ApiClientError extends Error {
  code?: string;
  details?: any;
  fields?: Record<string, string | string[]>;
}

export async function fetchContracts(
  query: ContractListQuery = {}
): Promise<ContractListResponse> {
  const params = new URLSearchParams();
  if (query.search) params.append('search', query.search);
  if (query.employeeId) params.append('employeeId', query.employeeId);
  if (query.departmentId) params.append('departmentId', query.departmentId);
  if (query.salaryStructureId) params.append('salaryStructureId', query.salaryStructureId);
  if (query.status) params.append('status', query.status);
  if (query.effectiveOn) params.append('effectiveOn', query.effectiveOn);
  if (query.page) params.append('page', String(query.page));
  if (query.pageSize) params.append('pageSize', String(query.pageSize));
  if (query.sort) params.append('sort', query.sort);
  if (query.order) params.append('order', query.order);

  const queryString = params.toString();
  const endpoint = `/contracts${queryString ? `?${queryString}` : ''}`;
  const response = await fetchApi<ContractListResponse>(endpoint);

  if (response.error) {
    const err: ApiClientError = new Error(
      response.error.message || 'Failed to fetch contracts'
    );
    err.code = response.error.code;
    err.details = response.error.details;
    err.fields = (response.error as any).fields;
    throw err;
  }

  return response.data;
}

export async function fetchContractById(id: string): Promise<ContractDetailDto> {
  const response = await fetchApi<ContractDetailDto>(`/contracts/${id}`);

  if (response.error) {
    const err: ApiClientError = new Error(
      response.error.message || 'Failed to fetch contract'
    );
    err.code = response.error.code;
    err.details = response.error.details;
    err.fields = (response.error as any).fields;
    throw err;
  }

  return response.data;
}

export async function createContract(
  input: ContractInput
): Promise<ContractDetailDto> {
  const response = await fetchApi<ContractDetailDto>('/contracts', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (response.error) {
    const err: ApiClientError = new Error(
      response.error.message || 'Failed to create contract'
    );
    err.code = response.error.code;
    err.details = response.error.details;
    err.fields = (response.error as any).fields;
    throw err;
  }

  return response.data;
}

export async function updateContract(
  id: string,
  input: ContractInput
): Promise<ContractDetailDto> {
  const response = await fetchApi<ContractDetailDto>(`/contracts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });

  if (response.error) {
    const err: ApiClientError = new Error(
      response.error.message || 'Failed to update contract'
    );
    err.code = response.error.code;
    err.details = response.error.details;
    err.fields = (response.error as any).fields;
    throw err;
  }

  return response.data;
}

export async function fetchSalaryStructuresSelector(): Promise<
  Array<{ id: string; name: string; status: string }>
> {
  const response = await fetchApi<Array<{ id: string; name: string; status: string }>>(
    '/contracts/selectors/salary-structures'
  );

  if (response.error) {
    const err: ApiClientError = new Error(
      response.error.message || 'Failed to fetch salary structures'
    );
    err.code = response.error.code;
    err.details = response.error.details;
    throw err;
  }

  return response.data;
}
