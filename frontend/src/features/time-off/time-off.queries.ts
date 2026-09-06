import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  TimeOffTypeInput,
  AllocationInput,
  TimeOffRequestInput,
} from '@peoplepay360/shared';
import {
  fetchTimeOffSummary,
  fetchTimeOffTypes,
  fetchTimeOffTypeById,
  createTimeOffType,
  updateTimeOffType,
  updateTimeOffTypeStatus,
  fetchAllocations,
  fetchAllocationById,
  createAllocation,
  updateAllocation,
  approveAllocation,
  refuseAllocation,
  fetchTimeOffRequests,
  fetchTimeOffRequestById,
  createTimeOffRequest,
  updateTimeOffRequest,
  approveTimeOffRequest,
  refuseTimeOffRequest,
  TimeOffTypeQuery,
  AllocationQuery,
  TimeOffRequestQuery,
} from './time-off.api';

export const timeOffKeys = {
  all: ['time-off'] as const,
  summary: (employeeId?: string) => [...timeOffKeys.all, 'summary', employeeId || 'all'] as const,
  types: {
    all: () => [...timeOffKeys.all, 'types'] as const,
    list: (query?: TimeOffTypeQuery) => [...timeOffKeys.types.all(), 'list', query] as const,
    detail: (id: string) => [...timeOffKeys.types.all(), 'detail', id] as const,
  },
  allocations: {
    all: () => [...timeOffKeys.all, 'allocations'] as const,
    list: (query?: AllocationQuery) => [...timeOffKeys.allocations.all(), 'list', query] as const,
    detail: (id: string) => [...timeOffKeys.allocations.all(), 'detail', id] as const,
  },
  requests: {
    all: () => [...timeOffKeys.all, 'requests'] as const,
    list: (query?: TimeOffRequestQuery) => [...timeOffKeys.requests.all(), 'list', query] as const,
    detail: (id: string) => [...timeOffKeys.requests.all(), 'detail', id] as const,
  },
};

// Summary Query
export function useTimeOffSummary(employeeId?: string) {
  return useQuery({
    queryKey: timeOffKeys.summary(employeeId),
    queryFn: () => fetchTimeOffSummary(employeeId),
  });
}

// Types Queries & Mutations
export function useTimeOffTypes(query: TimeOffTypeQuery = {}) {
  return useQuery({
    queryKey: timeOffKeys.types.list(query),
    queryFn: () => fetchTimeOffTypes(query),
  });
}

export function useTimeOffType(id: string | undefined) {
  return useQuery({
    queryKey: timeOffKeys.types.detail(id || ''),
    queryFn: () => fetchTimeOffTypeById(id!),
    enabled: Boolean(id) && id !== 'new',
  });
}

export function useCreateTimeOffTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TimeOffTypeInput) => createTimeOffType(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timeOffKeys.types.all() });
      queryClient.invalidateQueries({ queryKey: timeOffKeys.summary() });
    },
  });
}

export function useUpdateTimeOffTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TimeOffTypeInput }) =>
      updateTimeOffType(id, input),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: timeOffKeys.types.all() });
      queryClient.invalidateQueries({ queryKey: timeOffKeys.types.detail(vars.id) });
      queryClient.invalidateQueries({ queryKey: timeOffKeys.summary() });
    },
  });
}

export function useToggleTimeOffTypeStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'INACTIVE' }) =>
      updateTimeOffTypeStatus(id, status),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: timeOffKeys.types.all() });
      queryClient.invalidateQueries({ queryKey: timeOffKeys.types.detail(vars.id) });
    },
  });
}

// Allocations Queries & Mutations
export function useAllocations(query: AllocationQuery = {}) {
  return useQuery({
    queryKey: timeOffKeys.allocations.list(query),
    queryFn: () => fetchAllocations(query),
  });
}

export function useAllocation(id: string | undefined) {
  return useQuery({
    queryKey: timeOffKeys.allocations.detail(id || ''),
    queryFn: () => fetchAllocationById(id!),
    enabled: Boolean(id) && id !== 'new',
  });
}

export function useCreateAllocationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AllocationInput) => createAllocation(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timeOffKeys.allocations.all() });
      queryClient.invalidateQueries({ queryKey: timeOffKeys.summary() });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useUpdateAllocationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AllocationInput }) =>
      updateAllocation(id, input),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: timeOffKeys.allocations.all() });
      queryClient.invalidateQueries({ queryKey: timeOffKeys.allocations.detail(vars.id) });
      queryClient.invalidateQueries({ queryKey: timeOffKeys.summary() });
    },
  });
}

export function useApproveAllocationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      approveAllocation(id, note),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: timeOffKeys.allocations.all() });
      queryClient.invalidateQueries({ queryKey: timeOffKeys.allocations.detail(vars.id) });
      queryClient.invalidateQueries({ queryKey: timeOffKeys.summary() });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useRefuseAllocationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      refuseAllocation(id, note),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: timeOffKeys.allocations.all() });
      queryClient.invalidateQueries({ queryKey: timeOffKeys.allocations.detail(vars.id) });
      queryClient.invalidateQueries({ queryKey: timeOffKeys.summary() });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

// Requests Queries & Mutations
export function useTimeOffRequests(query: TimeOffRequestQuery = {}) {
  return useQuery({
    queryKey: timeOffKeys.requests.list(query),
    queryFn: () => fetchTimeOffRequests(query),
  });
}

export function useTimeOffRequest(id: string | undefined) {
  return useQuery({
    queryKey: timeOffKeys.requests.detail(id || ''),
    queryFn: () => fetchTimeOffRequestById(id!),
    enabled: Boolean(id) && id !== 'new',
  });
}

export function useCreateTimeOffRequestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TimeOffRequestInput) => createTimeOffRequest(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timeOffKeys.requests.all() });
      queryClient.invalidateQueries({ queryKey: timeOffKeys.allocations.all() });
      queryClient.invalidateQueries({ queryKey: timeOffKeys.summary() });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useUpdateTimeOffRequestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TimeOffRequestInput }) =>
      updateTimeOffRequest(id, input),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: timeOffKeys.requests.all() });
      queryClient.invalidateQueries({ queryKey: timeOffKeys.requests.detail(vars.id) });
      queryClient.invalidateQueries({ queryKey: timeOffKeys.allocations.all() });
      queryClient.invalidateQueries({ queryKey: timeOffKeys.summary() });
    },
  });
}

export function useApproveTimeOffRequestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      approveTimeOffRequest(id, note),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: timeOffKeys.requests.all() });
      queryClient.invalidateQueries({ queryKey: timeOffKeys.requests.detail(vars.id) });
      queryClient.invalidateQueries({ queryKey: timeOffKeys.allocations.all() });
      queryClient.invalidateQueries({ queryKey: timeOffKeys.summary() });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useRefuseTimeOffRequestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      refuseTimeOffRequest(id, note),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: timeOffKeys.requests.all() });
      queryClient.invalidateQueries({ queryKey: timeOffKeys.requests.detail(vars.id) });
      queryClient.invalidateQueries({ queryKey: timeOffKeys.allocations.all() });
      queryClient.invalidateQueries({ queryKey: timeOffKeys.summary() });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}
