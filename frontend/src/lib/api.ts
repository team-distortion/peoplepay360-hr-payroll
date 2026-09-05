import type { ApiResponse } from '@peoplepay360/shared';

const API_BASE_URL = '/api/v1';

export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        return data as ApiResponse<T>;
      }
      return {
        data: null,
        error: {
          code: 'HTTP_ERROR',
          message: response.statusText || `Request failed with status ${response.status}`,
        },
      };
    }

    return data as ApiResponse<T>;
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network error occurred',
      },
    };
  }
}
