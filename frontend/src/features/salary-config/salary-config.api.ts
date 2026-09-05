import { fetchApi } from '../../lib/api';
import type {
  SalaryStructureDetailDto,
  SalaryStructureListQuery,
  SalaryStructureListResponse,
  SalaryStructureInput,
  SalaryRuleDto,
  SalaryRuleListQuery,
  SalaryRuleListResponse,
  SalaryRuleInput,
  SalaryRuleConfigurationInput,
  RecordStatus,
} from '@peoplepay360/shared';

export interface ApiClientError extends Error {
  code?: string;
  details?: unknown;
}

function handleResponse<T>(res: { data: T | null; error: { code: string; message: string; details?: unknown } | null }): T {
  if (res.error || !res.data) {
    const error: ApiClientError = new Error(res.error?.message || 'API request failed');
    error.code = res.error?.code || 'UNKNOWN_ERROR';
    error.details = res.error?.details;
    throw error;
  }
  return res.data;
}

// ── Structure API ──────────────────────────────────────────────

export async function fetchSalaryStructures(
  query: SalaryStructureListQuery = {}
): Promise<SalaryStructureListResponse> {
  const params = new URLSearchParams();
  if (query.search) params.append('search', query.search);
  if (query.status) params.append('status', query.status);
  if (query.page) params.append('page', String(query.page));
  if (query.pageSize) params.append('pageSize', String(query.pageSize));

  const qs = params.toString();
  const res = await fetchApi<SalaryStructureListResponse>(
    `/payroll/structures${qs ? `?${qs}` : ''}`
  );
  return handleResponse(res);
}

export async function fetchSalaryStructureById(
  id: string,
  options: { includeInactiveRules?: boolean } = {}
): Promise<SalaryStructureDetailDto> {
  const params = new URLSearchParams();
  if (options.includeInactiveRules !== undefined) {
    params.append('includeInactiveRules', String(options.includeInactiveRules));
  }
  const qs = params.toString();
  const res = await fetchApi<SalaryStructureDetailDto>(
    `/payroll/structures/${id}${qs ? `?${qs}` : ''}`
  );
  return handleResponse(res);
}

export async function createSalaryStructure(
  input: SalaryStructureInput
): Promise<SalaryStructureDetailDto> {
  const res = await fetchApi<SalaryStructureDetailDto>('/payroll/structures', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return handleResponse(res);
}

export async function updateSalaryStructure(
  id: string,
  input: SalaryStructureInput
): Promise<SalaryStructureDetailDto> {
  const res = await fetchApi<SalaryStructureDetailDto>(`/payroll/structures/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return handleResponse(res);
}

export async function updateSalaryStructureStatus(
  id: string,
  status: RecordStatus
): Promise<SalaryStructureDetailDto> {
  const res = await fetchApi<SalaryStructureDetailDto>(
    `/payroll/structures/${id}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }
  );
  return handleResponse(res);
}

// ── Rule API ───────────────────────────────────────────────────

export async function fetchSalaryRules(
  query: SalaryRuleListQuery = {}
): Promise<SalaryRuleListResponse> {
  const params = new URLSearchParams();
  if (query.salaryStructureId) params.append('salaryStructureId', query.salaryStructureId);
  if (query.search) params.append('search', query.search);
  if (query.category) params.append('category', query.category);
  if (query.method) params.append('method', query.method);
  if (query.status) params.append('status', query.status);
  if (query.page) params.append('page', String(query.page));
  if (query.pageSize) params.append('pageSize', String(query.pageSize));

  const qs = params.toString();
  const res = await fetchApi<SalaryRuleListResponse>(
    `/payroll/rules${qs ? `?${qs}` : ''}`
  );
  return handleResponse(res);
}

export async function fetchSalaryRuleById(id: string): Promise<SalaryRuleDto> {
  const res = await fetchApi<SalaryRuleDto>(`/payroll/rules/${id}`);
  return handleResponse(res);
}

export async function createSalaryRule(
  structureId: string,
  input: SalaryRuleInput
): Promise<SalaryRuleDto> {
  const res = await fetchApi<SalaryRuleDto>(
    `/payroll/structures/${structureId}/rules`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
  return handleResponse(res);
}

export async function updateSalaryRule(
  id: string,
  input: SalaryRuleInput
): Promise<SalaryRuleDto> {
  const res = await fetchApi<SalaryRuleDto>(`/payroll/rules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return handleResponse(res);
}

export async function updateSalaryRuleStatus(
  id: string,
  status: RecordStatus
): Promise<SalaryRuleDto> {
  const res = await fetchApi<SalaryRuleDto>(`/payroll/rules/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return handleResponse(res);
}

export async function updateSalaryRuleConfiguration(
  structureId: string,
  input: SalaryRuleConfigurationInput
): Promise<SalaryStructureDetailDto> {
  const res = await fetchApi<SalaryStructureDetailDto>(
    `/payroll/structures/${structureId}/rules/configuration`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    }
  );
  return handleResponse(res);
}
