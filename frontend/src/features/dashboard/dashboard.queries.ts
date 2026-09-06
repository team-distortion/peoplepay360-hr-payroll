import { useQuery } from '@tanstack/react-query';
import type { DashboardFilters } from '@peoplepay360/shared';
import {
  fetchDashboardFilters,
  fetchDashboardHr,
  fetchDashboardPayroll,
} from './dashboard.api';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  filters: () => [...dashboardKeys.all, 'filters'] as const,
  hr: (filters: DashboardFilters) => [...dashboardKeys.all, 'hr', filters] as const,
  payroll: (filters: DashboardFilters) => [...dashboardKeys.all, 'payroll', filters] as const,
};

export function useDashboardFilters() {
  return useQuery({
    queryKey: dashboardKeys.filters(),
    queryFn: fetchDashboardFilters,
    staleTime: 60 * 1000,
  });
}

export function useDashboardHr(
  filters: DashboardFilters,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: dashboardKeys.hr(filters),
    queryFn: ({ signal }) => fetchDashboardHr(filters, signal),
    enabled: options?.enabled ?? true,
    staleTime: 30 * 1000,
  });
}

export function useDashboardPayroll(
  filters: DashboardFilters,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: dashboardKeys.payroll(filters),
    queryFn: ({ signal }) => fetchDashboardPayroll(filters, signal),
    enabled: options?.enabled ?? true,
    staleTime: 30 * 1000,
  });
}
