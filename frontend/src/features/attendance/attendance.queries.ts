import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  AttendanceListQuery,
  ManualAttendanceInput,
  AttendanceCorrectionInput,
} from '@peoplepay360/shared';
import {
  fetchAttendanceList,
  fetchAttendanceById,
  fetchAttendanceToday,
  checkInSelf,
  checkOutSelf,
  createManualAttendance,
  correctAttendance,
} from './attendance.api';

export const attendanceKeys = {
  all: ['attendance'] as const,
  lists: () => [...attendanceKeys.all, 'list'] as const,
  list: (query: AttendanceListQuery) => [...attendanceKeys.lists(), query] as const,
  details: () => [...attendanceKeys.all, 'detail'] as const,
  detail: (id: string) => [...attendanceKeys.details(), id] as const,
  today: () => [...attendanceKeys.all, 'today'] as const,
};

export function useAttendanceList(query: AttendanceListQuery = {}) {
  return useQuery({
    queryKey: attendanceKeys.list(query),
    queryFn: () => fetchAttendanceList(query),
  });
}

export function useAttendanceDetail(id: string | undefined) {
  return useQuery({
    queryKey: attendanceKeys.detail(id || ''),
    queryFn: () => fetchAttendanceById(id!),
    enabled: Boolean(id) && id !== 'new',
  });
}

export function useAttendanceToday(enabled: boolean = true) {
  return useQuery({
    queryKey: attendanceKeys.today(),
    queryFn: fetchAttendanceToday,
    enabled,
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useCheckInMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: checkInSelf,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.today() });
      queryClient.invalidateQueries({ queryKey: attendanceKeys.lists() });
    },
  });
}

export function useCheckOutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: checkOutSelf,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.today() });
      queryClient.invalidateQueries({ queryKey: attendanceKeys.lists() });
    },
  });
}

export function useCreateAttendanceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ManualAttendanceInput) => createManualAttendance(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: attendanceKeys.today() });
    },
  });
}

export function useCorrectAttendanceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AttendanceCorrectionInput }) =>
      correctAttendance(id, input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: attendanceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: attendanceKeys.today() });
    },
  });
}
