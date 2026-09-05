import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  EmployeeInput,
  EmployeeListQuery,
  RecordStatus,
} from '@peoplepay360/shared';
import {
  fetchEmployees,
  fetchEmployeeById,
  fetchCurrentEmployee,
  createEmployee,
  updateEmployee,
  updateEmployeeStatus,
} from './employees.api';

export const employeeKeys = {
  all: ['employees'] as const,
  lists: () => [...employeeKeys.all, 'list'] as const,
  list: (query: EmployeeListQuery) => [...employeeKeys.lists(), query] as const,
  details: () => [...employeeKeys.all, 'detail'] as const,
  detail: (id: string) => [...employeeKeys.details(), id] as const,
  me: () => [...employeeKeys.all, 'me'] as const,
};

export function useEmployees(query: EmployeeListQuery = {}) {
  return useQuery({
    queryKey: employeeKeys.list(query),
    queryFn: () => fetchEmployees(query),
  });
}

export function useEmployee(id?: string) {
  return useQuery({
    queryKey: employeeKeys.detail(id || ''),
    queryFn: () => fetchEmployeeById(id!),
    enabled: Boolean(id && id !== 'new' && id !== 'me'),
  });
}

export function useCurrentEmployeeProfile(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: employeeKeys.me(),
    queryFn: fetchCurrentEmployee,
    enabled: options?.enabled ?? true,
    retry: false,
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EmployeeInput) => createEmployee(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
      queryClient.setQueryData(employeeKeys.detail(data.id), data);
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: EmployeeInput }) =>
      updateEmployee(id, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
      queryClient.invalidateQueries({ queryKey: employeeKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: employeeKeys.me() });
    },
  });
}

export function useUpdateEmployeeStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: RecordStatus }) =>
      updateEmployeeStatus(id, status),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
      queryClient.invalidateQueries({ queryKey: employeeKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: employeeKeys.me() });
    },
  });
}
