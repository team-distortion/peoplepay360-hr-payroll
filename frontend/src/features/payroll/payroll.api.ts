import { fetchApi } from '../../lib/api';
import type {
  PayrunDetailDto,
  PayrunListResponse,
  PayslipListResponse,
  ListPayrunsQuery,
  ListPayslipsQuery,
  PayslipDetailDto,
  PayrunEligibilityInput,
  CreatePayrunInput,
  WarningAcknowledgementInput,
  PayrunEligibilityResponse,
  PayrollWarningDto,
} from '@peoplepay360/shared';

export interface ApiClientError extends Error {
  code?: string;
  details?: unknown;
}

function handleResponse<T>(res: {
  data: T | null;
  error: { code: string; message: string; details?: unknown } | null;
}): T {
  if (res.error || res.data === null || res.data === undefined) {
    const error: ApiClientError = new Error(res.error?.message || 'API request failed');
    error.code = res.error?.code || 'UNKNOWN_ERROR';
    error.details = res.error?.details;
    throw error;
  }
  return res.data;
}

// ── Payrun APIs ───────────────────────────────────────────────────

export async function fetchPayruns(
  query: Partial<ListPayrunsQuery> = {}
): Promise<PayrunListResponse> {
  const params = new URLSearchParams();
  if (query.search) params.append('search', query.search);
  if (query.salaryStructureId) params.append('salaryStructureId', query.salaryStructureId);
  if (query.status) params.append('status', query.status);
  if (query.periodStart) params.append('periodStart', query.periodStart);
  if (query.periodEnd) params.append('periodEnd', query.periodEnd);
  if (query.page) params.append('page', String(query.page));
  if (query.pageSize) params.append('pageSize', String(query.pageSize));
  if (query.sort) params.append('sort', query.sort);
  if (query.order) params.append('order', query.order);

  const qs = params.toString();
  const res = await fetchApi<PayrunListResponse>(
    `/payroll/payruns${qs ? `?${qs}` : ''}`
  );
  return handleResponse(res);
}

export async function fetchPayrunById(id: string): Promise<PayrunDetailDto> {
  const res = await fetchApi<PayrunDetailDto>(`/payroll/payruns/${id}`);
  return handleResponse(res);
}

export async function evaluatePayrunEligibility(
  input: PayrunEligibilityInput
): Promise<PayrunEligibilityResponse> {
  const res = await fetchApi<PayrunEligibilityResponse>('/payroll/payruns/eligibility', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return handleResponse(res);
}

export async function createPayrun(input: CreatePayrunInput): Promise<PayrunDetailDto> {
  const res = await fetchApi<PayrunDetailDto>('/payroll/payruns', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return handleResponse(res);
}

export async function discardPayrun(id: string): Promise<{ success: boolean; message: string }> {
  const res = await fetchApi<{ success: boolean; message: string }>(`/payroll/payruns/${id}`, {
    method: 'DELETE',
  });
  return handleResponse(res);
}

export async function computePayrun(id: string): Promise<PayrunDetailDto> {
  const res = await fetchApi<PayrunDetailDto>(`/payroll/payruns/${id}/compute`, {
    method: 'POST',
  });
  return handleResponse(res);
}

export async function recomputePayrun(id: string): Promise<PayrunDetailDto> {
  const res = await fetchApi<PayrunDetailDto>(`/payroll/payruns/${id}/recompute`, {
    method: 'POST',
  });
  return handleResponse(res);
}

export async function validatePayrun(id: string): Promise<PayrunDetailDto> {
  const res = await fetchApi<PayrunDetailDto>(`/payroll/payruns/${id}/validate`, {
    method: 'POST',
  });
  return handleResponse(res);
}

export async function markPayrunPaid(id: string): Promise<PayrunDetailDto> {
  const res = await fetchApi<PayrunDetailDto>(`/payroll/payruns/${id}/mark-paid`, {
    method: 'POST',
  });
  return handleResponse(res);
}

// ── Payslip APIs ──────────────────────────────────────────────────

export async function fetchPayslips(
  query: Partial<ListPayslipsQuery> = {}
): Promise<PayslipListResponse> {
  const params = new URLSearchParams();
  if (query.search) params.append('search', query.search);
  if (query.payrunId) params.append('payrunId', query.payrunId);
  if (query.employeeId) params.append('employeeId', query.employeeId);
  if (query.department) params.append('department', query.department);
  if (query.salaryStructureId) params.append('salaryStructureId', query.salaryStructureId);
  if (query.status) params.append('status', query.status);
  if (query.periodStart) params.append('periodStart', query.periodStart);
  if (query.periodEnd) params.append('periodEnd', query.periodEnd);
  if (query.warningType) params.append('warningType', query.warningType);
  if (query.page) params.append('page', String(query.page));
  if (query.pageSize) params.append('pageSize', String(query.pageSize));
  if (query.sort) params.append('sort', query.sort);
  if (query.order) params.append('order', query.order);

  const qs = params.toString();
  const res = await fetchApi<PayslipListResponse>(
    `/payroll/payslips${qs ? `?${qs}` : ''}`
  );
  return handleResponse(res);
}

export async function fetchPayslipById(id: string): Promise<PayslipDetailDto> {
  const res = await fetchApi<PayslipDetailDto>(`/payroll/payslips/${id}`);
  return handleResponse(res);
}

export async function downloadPayslipPdf(id: string, employeeName = 'payslip'): Promise<void> {
  const response = await fetch(`/api/v1/payroll/payslips/${id}/pdf`, {
    credentials: 'include',
  });

  if (!response.ok) {
    let errorMsg = 'Failed to download payslip PDF';
    try {
      const data = await response.json();
      if (data?.error?.message) errorMsg = data.error.message;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Payslip-${employeeName.replace(/\s+/g, '_')}-${id.slice(0, 8)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// ── Warning APIs ──────────────────────────────────────────────────

export async function acknowledgeWarning(
  warningId: string,
  input: WarningAcknowledgementInput
): Promise<PayrollWarningDto> {
  const res = await fetchApi<PayrollWarningDto>(`/payroll/warnings/${warningId}/acknowledge`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return handleResponse(res);
}
