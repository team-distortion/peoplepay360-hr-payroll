import { fetchApi } from '../../lib/api';
import type {
  WorkingScheduleDto,
  WorkingScheduleInput,
  WorkingScheduleListQuery,
  WorkingScheduleListResponse,
  WorkingScheduleStatus,
} from '@peoplepay360/shared';

export interface ApiClientError extends Error {
  code?: string;
  details?: unknown;
}

export async function fetchSchedules(
  query: WorkingScheduleListQuery = {}
): Promise<WorkingScheduleListResponse> {
  const params = new URLSearchParams();
  if (query.search) params.append('search', query.search);
  if (query.status) params.append('status', query.status);
  if (query.type) params.append('type', query.type);
  if (query.page) params.append('page', String(query.page));
  if (query.pageSize) params.append('pageSize', String(query.pageSize));

  const queryString = params.toString();
  const endpoint = `/schedules${queryString ? `?${queryString}` : ''}`;
  const response = await fetchApi<WorkingScheduleListResponse>(endpoint);

  if (response.error) {
    const err: ApiClientError = new Error(
      response.error.message || 'Failed to fetch schedules'
    );
    err.code = response.error.code;
    err.details = response.error.details;
    throw err;
  }

  return response.data;
}

export async function fetchScheduleById(id: string): Promise<WorkingScheduleDto> {
  const response = await fetchApi<WorkingScheduleDto>(`/schedules/${id}`);

  if (response.error) {
    const err: ApiClientError = new Error(
      response.error.message || 'Failed to fetch schedule'
    );
    err.code = response.error.code;
    err.details = response.error.details;
    throw err;
  }

  return response.data;
}

export async function createSchedule(
  input: WorkingScheduleInput
): Promise<WorkingScheduleDto> {
  const response = await fetchApi<WorkingScheduleDto>('/schedules', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (response.error) {
    const err: ApiClientError = new Error(
      response.error.message || 'Failed to create schedule'
    );
    err.code = response.error.code;
    err.details = response.error.details;
    throw err;
  }

  return response.data;
}

export async function updateSchedule(
  id: string,
  input: WorkingScheduleInput
): Promise<WorkingScheduleDto> {
  const response = await fetchApi<WorkingScheduleDto>(`/schedules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });

  if (response.error) {
    const err: ApiClientError = new Error(
      response.error.message || 'Failed to update schedule'
    );
    err.code = response.error.code;
    err.details = response.error.details;
    throw err;
  }

  return response.data;
}

export async function updateScheduleStatus(
  id: string,
  status: WorkingScheduleStatus
): Promise<WorkingScheduleDto> {
  const response = await fetchApi<WorkingScheduleDto>(`/schedules/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

  if (response.error) {
    const err: ApiClientError = new Error(
      response.error.message || 'Failed to update schedule status'
    );
    err.code = response.error.code;
    err.details = response.error.details;
    throw err;
  }

  return response.data;
}
