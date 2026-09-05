import { fetchApi } from '../../lib/api';
import type {
  AttendanceDto,
  AttendanceTodayDto,
  AttendanceListQuery,
  AttendanceListResponse,
  ManualAttendanceInput,
  AttendanceCorrectionInput,
} from '@peoplepay360/shared';

export interface ApiClientError extends Error {
  code?: string;
  details?: any;
  fields?: Record<string, string | string[]>;
}

export async function fetchAttendanceList(
  query: AttendanceListQuery = {}
): Promise<AttendanceListResponse> {
  const params = new URLSearchParams();
  if (query.search) params.append('search', query.search);
  if (query.employeeId) params.append('employeeId', query.employeeId);
  if (query.departmentId) params.append('departmentId', query.departmentId);
  if (query.status) params.append('status', query.status);
  if (query.flag) params.append('flag', query.flag);
  if (query.date) params.append('date', query.date);
  if (query.dateFrom) params.append('dateFrom', query.dateFrom);
  if (query.dateTo) params.append('dateTo', query.dateTo);
  if (query.page) params.append('page', String(query.page));
  if (query.pageSize) params.append('pageSize', String(query.pageSize));
  if (query.sort) params.append('sort', query.sort);
  if (query.order) params.append('order', query.order);

  const queryString = params.toString();
  const endpoint = `/attendance${queryString ? `?${queryString}` : ''}`;
  const response = await fetchApi<AttendanceListResponse>(endpoint);

  if (response.error) {
    const err: ApiClientError = new Error(
      response.error.message || 'Failed to fetch attendance records'
    );
    err.code = response.error.code;
    err.details = response.error.details;
    err.fields = (response.error as any).fields;
    throw err;
  }

  return response.data;
}

export async function fetchAttendanceById(id: string): Promise<AttendanceDto> {
  const response = await fetchApi<AttendanceDto>(`/attendance/${id}`);

  if (response.error) {
    const err: ApiClientError = new Error(
      response.error.message || 'Failed to fetch attendance record'
    );
    err.code = response.error.code;
    err.details = response.error.details;
    err.fields = (response.error as any).fields;
    throw err;
  }

  return response.data;
}

export async function fetchAttendanceToday(): Promise<AttendanceTodayDto> {
  const response = await fetchApi<AttendanceTodayDto>('/attendance/me/today');

  if (response.error) {
    const err: ApiClientError = new Error(
      response.error.message || 'Failed to fetch today attendance'
    );
    err.code = response.error.code;
    err.details = response.error.details;
    err.fields = (response.error as any).fields;
    throw err;
  }

  return response.data;
}

export async function checkInSelf(): Promise<AttendanceDto> {
  const response = await fetchApi<AttendanceDto>('/attendance/me/check-in', {
    method: 'POST',
  });

  if (response.error) {
    const err: ApiClientError = new Error(
      response.error.message || 'Failed to check in'
    );
    err.code = response.error.code;
    err.details = response.error.details;
    err.fields = (response.error as any).fields;
    throw err;
  }

  return response.data;
}

export async function checkOutSelf(): Promise<AttendanceDto> {
  const response = await fetchApi<AttendanceDto>('/attendance/me/check-out', {
    method: 'POST',
  });

  if (response.error) {
    const err: ApiClientError = new Error(
      response.error.message || 'Failed to check out'
    );
    err.code = response.error.code;
    err.details = response.error.details;
    err.fields = (response.error as any).fields;
    throw err;
  }

  return response.data;
}

export async function createManualAttendance(
  input: ManualAttendanceInput
): Promise<AttendanceDto> {
  const response = await fetchApi<AttendanceDto>('/attendance', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (response.error) {
    const err: ApiClientError = new Error(
      response.error.message || 'Failed to create attendance'
    );
    err.code = response.error.code;
    err.details = response.error.details;
    err.fields = (response.error as any).fields;
    throw err;
  }

  return response.data;
}

export async function correctAttendance(
  id: string,
  input: AttendanceCorrectionInput
): Promise<AttendanceDto> {
  const response = await fetchApi<AttendanceDto>(`/attendance/${id}/correction`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

  if (response.error) {
    const err: ApiClientError = new Error(
      response.error.message || 'Failed to correct attendance'
    );
    err.code = response.error.code;
    err.details = response.error.details;
    err.fields = (response.error as any).fields;
    throw err;
  }

  return response.data;
}
