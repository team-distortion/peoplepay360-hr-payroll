import { fetchApi } from '../../lib/api';
import type {
  TimeOffTypeListItemDto,
  TimeOffTypeDetailDto,
  TimeOffTypeInput,
  TimeOffUnit,
  TimeOffRequestStatus,
  AllocationStatus,
  TimeOffPayrollTreatment,
  AllocationListItemDto,
  AllocationDetailDto,
  AllocationInput,
  TimeOffRequestListItemDto,
  TimeOffRequestDetailDto,
  TimeOffRequestInput,
  TimeOffSummaryDto,
} from '@peoplepay360/shared';

export interface ApiClientError extends Error {
  code?: string;
  details?: any;
  fields?: Record<string, string | string[]>;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface TimeOffTypeQuery {
  search?: string;
  unit?: TimeOffUnit;
  status?: 'ACTIVE' | 'INACTIVE';
  requiresAllocation?: boolean;
  page?: number;
  pageSize?: number;
}

export interface AllocationQuery {
  search?: string;
  employeeId?: string;
  timeOffTypeId?: string;
  status?: AllocationStatus;
  validOn?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface TimeOffRequestQuery {
  scope?: 'mine' | 'team' | 'all';
  search?: string;
  employeeId?: string;
  timeOffTypeId?: string;
  status?: TimeOffRequestStatus;
  payrollTreatment?: TimeOffPayrollTreatment;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

function handleResponse<T>(response: any, defaultMessage: string): T {
  if (response.error) {
    const err: ApiClientError = new Error(
      response.error.message || defaultMessage
    );
    err.code = response.error.code;
    err.details = response.error.details;
    err.fields = (response.error as any).fields;
    throw err;
  }
  return response.data;
}

// Summary API
export async function fetchTimeOffSummary(employeeId?: string): Promise<TimeOffSummaryDto> {
  const params = new URLSearchParams();
  if (employeeId) params.append('employeeId', employeeId);
  const queryString = params.toString();
  const endpoint = `/time-off/summary${queryString ? `?${queryString}` : ''}`;
  const response = await fetchApi<TimeOffSummaryDto>(endpoint);
  return handleResponse<TimeOffSummaryDto>(response, 'Failed to fetch time off summary');
}

// Types API
export async function fetchTimeOffTypes(
  query: TimeOffTypeQuery = {}
): Promise<PaginatedResult<TimeOffTypeListItemDto>> {
  const params = new URLSearchParams();
  if (query.search) params.append('search', query.search);
  if (query.unit) params.append('unit', query.unit);
  if (query.status) params.append('status', query.status);
  if (query.requiresAllocation !== undefined) {
    params.append('requiresAllocation', String(query.requiresAllocation));
  }
  if (query.page) params.append('page', String(query.page));
  if (query.pageSize) params.append('pageSize', String(query.pageSize));

  const queryString = params.toString();
  const endpoint = `/time-off/types${queryString ? `?${queryString}` : ''}`;
  const response = await fetchApi<PaginatedResult<TimeOffTypeListItemDto>>(endpoint);
  return handleResponse<PaginatedResult<TimeOffTypeListItemDto>>(response, 'Failed to fetch time off types');
}

export async function fetchTimeOffTypeById(id: string): Promise<TimeOffTypeDetailDto> {
  const response = await fetchApi<TimeOffTypeDetailDto>(`/time-off/types/${id}`);
  return handleResponse<TimeOffTypeDetailDto>(response, 'Failed to fetch time off type');
}

export async function createTimeOffType(input: TimeOffTypeInput): Promise<TimeOffTypeDetailDto> {
  const response = await fetchApi<TimeOffTypeDetailDto>('/time-off/types', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return handleResponse<TimeOffTypeDetailDto>(response, 'Failed to create time off type');
}

export async function updateTimeOffType(
  id: string,
  input: TimeOffTypeInput
): Promise<TimeOffTypeDetailDto> {
  const response = await fetchApi<TimeOffTypeDetailDto>(`/time-off/types/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return handleResponse<TimeOffTypeDetailDto>(response, 'Failed to update time off type');
}

export async function updateTimeOffTypeStatus(
  id: string,
  status: 'ACTIVE' | 'INACTIVE'
): Promise<TimeOffTypeDetailDto> {
  const response = await fetchApi<TimeOffTypeDetailDto>(`/time-off/types/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return handleResponse<TimeOffTypeDetailDto>(response, 'Failed to update time off type status');
}

// Allocations API
export async function fetchAllocations(
  query: AllocationQuery = {}
): Promise<PaginatedResult<AllocationListItemDto>> {
  const params = new URLSearchParams();
  if (query.search) params.append('search', query.search);
  if (query.employeeId) params.append('employeeId', query.employeeId);
  if (query.timeOffTypeId) params.append('timeOffTypeId', query.timeOffTypeId);
  if (query.status) params.append('status', query.status);
  if (query.validOn) params.append('validOn', query.validOn);
  if (query.page) params.append('page', String(query.page));
  if (query.pageSize) params.append('pageSize', String(query.pageSize));
  if (query.sort) params.append('sort', query.sort);
  if (query.order) params.append('order', query.order);

  const queryString = params.toString();
  const endpoint = `/time-off/allocations${queryString ? `?${queryString}` : ''}`;
  const response = await fetchApi<PaginatedResult<AllocationListItemDto>>(endpoint);
  return handleResponse<PaginatedResult<AllocationListItemDto>>(response, 'Failed to fetch allocations');
}

export async function fetchAllocationById(id: string): Promise<AllocationDetailDto> {
  const response = await fetchApi<AllocationDetailDto>(`/time-off/allocations/${id}`);
  return handleResponse<AllocationDetailDto>(response, 'Failed to fetch allocation');
}

export async function createAllocation(input: AllocationInput): Promise<AllocationDetailDto> {
  const response = await fetchApi<AllocationDetailDto>('/time-off/allocations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return handleResponse<AllocationDetailDto>(response, 'Failed to create allocation');
}

export async function updateAllocation(
  id: string,
  input: AllocationInput
): Promise<AllocationDetailDto> {
  const response = await fetchApi<AllocationDetailDto>(`/time-off/allocations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return handleResponse<AllocationDetailDto>(response, 'Failed to update allocation');
}

export async function approveAllocation(
  id: string,
  note?: string
): Promise<AllocationDetailDto> {
  const response = await fetchApi<AllocationDetailDto>(`/time-off/allocations/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
  return handleResponse<AllocationDetailDto>(response, 'Failed to approve allocation');
}

export async function refuseAllocation(
  id: string,
  note: string
): Promise<AllocationDetailDto> {
  const response = await fetchApi<AllocationDetailDto>(`/time-off/allocations/${id}/refuse`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
  return handleResponse<AllocationDetailDto>(response, 'Failed to refuse allocation');
}

// Requests API
export async function fetchTimeOffRequests(
  query: TimeOffRequestQuery = {}
): Promise<PaginatedResult<TimeOffRequestListItemDto>> {
  const params = new URLSearchParams();
  if (query.scope) params.append('scope', query.scope);
  if (query.search) params.append('search', query.search);
  if (query.employeeId) params.append('employeeId', query.employeeId);
  if (query.timeOffTypeId) params.append('timeOffTypeId', query.timeOffTypeId);
  if (query.status) params.append('status', query.status);
  if (query.payrollTreatment) params.append('payrollTreatment', query.payrollTreatment);
  if (query.date) params.append('date', query.date);
  if (query.dateFrom) params.append('dateFrom', query.dateFrom);
  if (query.dateTo) params.append('dateTo', query.dateTo);
  if (query.page) params.append('page', String(query.page));
  if (query.pageSize) params.append('pageSize', String(query.pageSize));
  if (query.sort) params.append('sort', query.sort);
  if (query.order) params.append('order', query.order);

  const queryString = params.toString();
  const endpoint = `/time-off/requests${queryString ? `?${queryString}` : ''}`;
  const response = await fetchApi<PaginatedResult<TimeOffRequestListItemDto>>(endpoint);
  return handleResponse<PaginatedResult<TimeOffRequestListItemDto>>(response, 'Failed to fetch time off requests');
}

export async function fetchTimeOffRequestById(id: string): Promise<TimeOffRequestDetailDto> {
  const response = await fetchApi<TimeOffRequestDetailDto>(`/time-off/requests/${id}`);
  return handleResponse<TimeOffRequestDetailDto>(response, 'Failed to fetch time off request');
}

export async function createTimeOffRequest(
  input: TimeOffRequestInput
): Promise<TimeOffRequestDetailDto> {
  const response = await fetchApi<TimeOffRequestDetailDto>('/time-off/requests', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return handleResponse<TimeOffRequestDetailDto>(response, 'Failed to create time off request');
}

export async function updateTimeOffRequest(
  id: string,
  input: TimeOffRequestInput
): Promise<TimeOffRequestDetailDto> {
  const response = await fetchApi<TimeOffRequestDetailDto>(`/time-off/requests/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return handleResponse<TimeOffRequestDetailDto>(response, 'Failed to update time off request');
}

export async function approveTimeOffRequest(
  id: string,
  note?: string
): Promise<TimeOffRequestDetailDto> {
  const response = await fetchApi<TimeOffRequestDetailDto>(`/time-off/requests/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
  return handleResponse<TimeOffRequestDetailDto>(response, 'Failed to approve time off request');
}

export async function refuseTimeOffRequest(
  id: string,
  note: string
): Promise<TimeOffRequestDetailDto> {
  const response = await fetchApi<TimeOffRequestDetailDto>(`/time-off/requests/${id}/refuse`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
  return handleResponse<TimeOffRequestDetailDto>(response, 'Failed to refuse time off request');
}
