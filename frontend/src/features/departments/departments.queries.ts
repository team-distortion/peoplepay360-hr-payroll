import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  DepartmentInput,
  DepartmentQuery,
} from '@peoplepay360/shared';
import {
  fetchDepartments,
  createDepartment,
  updateDepartment,
} from './departments.api';

export const departmentKeys = {
  all: ['departments'] as const,
  lists: () => [...departmentKeys.all, 'list'] as const,
  list: (query: DepartmentQuery) => [...departmentKeys.lists(), query] as const,
};

export function useDepartments(query: DepartmentQuery = {}) {
  return useQuery({
    queryKey: departmentKeys.list(query),
    queryFn: () => fetchDepartments(query),
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DepartmentInput) => createDepartment(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: departmentKeys.lists() });
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: DepartmentInput }) =>
      updateDepartment(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: departmentKeys.lists() });
    },
  });
}
