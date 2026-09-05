import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  WorkingScheduleInput,
  WorkingScheduleListQuery,
  WorkingScheduleStatus,
} from '@peoplepay360/shared';
import {
  fetchSchedules,
  fetchScheduleById,
  createSchedule,
  updateSchedule,
  updateScheduleStatus,
} from './schedules.api';

export const scheduleKeys = {
  all: ['schedules'] as const,
  lists: () => [...scheduleKeys.all, 'list'] as const,
  list: (query: WorkingScheduleListQuery) =>
    [...scheduleKeys.lists(), query] as const,
  details: () => [...scheduleKeys.all, 'detail'] as const,
  detail: (id: string) => [...scheduleKeys.details(), id] as const,
};

export function useSchedules(query: WorkingScheduleListQuery = {}) {
  return useQuery({
    queryKey: scheduleKeys.list(query),
    queryFn: () => fetchSchedules(query),
  });
}

export function useSchedule(id?: string) {
  return useQuery({
    queryKey: scheduleKeys.detail(id || ''),
    queryFn: () => fetchScheduleById(id!),
    enabled: Boolean(id),
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkingScheduleInput) => createSchedule(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.lists() });
    },
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: WorkingScheduleInput;
    }) => updateSchedule(id, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.lists() });
      queryClient.invalidateQueries({ queryKey: scheduleKeys.detail(data.id) });
    },
  });
}

export function useUpdateScheduleStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: WorkingScheduleStatus;
    }) => updateScheduleStatus(id, status),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.lists() });
      queryClient.invalidateQueries({ queryKey: scheduleKeys.detail(data.id) });
    },
  });
}
