import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchPayruns,
  fetchPayrunById,
  evaluatePayrunEligibility,
  createPayrun,
  discardPayrun,
  computePayrun,
  recomputePayrun,
  validatePayrun,
  markPayrunPaid,
  fetchPayslips,
  fetchPayslipById,
  acknowledgeWarning,
} from './payroll.api';
import type {
  ListPayrunsQuery,
  ListPayslipsQuery,
  PayrunEligibilityInput,
  CreatePayrunInput,
  WarningAcknowledgementInput,
} from '@peoplepay360/shared';

export const payrollQueryKeys = {
  payruns: ['payruns'] as const,
  payrunList: (query?: Partial<ListPayrunsQuery>) => ['payruns', 'list', query] as const,
  payrunDetail: (id: string) => ['payruns', 'detail', id] as const,
  payslips: ['payslips'] as const,
  payslipList: (query?: Partial<ListPayslipsQuery>) => ['payslips', 'list', query] as const,
  payslipDetail: (id: string) => ['payslips', 'detail', id] as const,
};

export function usePayrunsQuery(query: Partial<ListPayrunsQuery> = {}) {
  return useQuery({
    queryKey: payrollQueryKeys.payrunList(query),
    queryFn: () => fetchPayruns(query),
  });
}

export function usePayrunQuery(id: string) {
  return useQuery({
    queryKey: payrollQueryKeys.payrunDetail(id),
    queryFn: () => fetchPayrunById(id),
    enabled: !!id,
  });
}

export function useEvaluateEligibilityMutation() {
  return useMutation({
    mutationFn: (input: PayrunEligibilityInput) => evaluatePayrunEligibility(input),
  });
}

export function useCreatePayrunMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePayrunInput) => createPayrun(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.payruns });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.payslips });
    },
  });
}

export function useDiscardPayrunMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => discardPayrun(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.payruns });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.payslips });
    },
  });
}

export function useComputePayrunMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => computePayrun(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.payrunDetail(id) });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.payruns });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.payslips });
    },
  });
}

export function useRecomputePayrunMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recomputePayrun(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.payrunDetail(id) });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.payruns });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.payslips });
    },
  });
}

export function useValidatePayrunMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => validatePayrun(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.payrunDetail(id) });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.payruns });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.payslips });
    },
  });
}

export function useMarkPayrunPaidMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markPayrunPaid(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.payrunDetail(id) });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.payruns });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.payslips });
    },
  });
}

export function usePayslipsQuery(query: Partial<ListPayslipsQuery> = {}) {
  return useQuery({
    queryKey: payrollQueryKeys.payslipList(query),
    queryFn: () => fetchPayslips(query),
  });
}

export function usePayslipQuery(id: string) {
  return useQuery({
    queryKey: payrollQueryKeys.payslipDetail(id),
    queryFn: () => fetchPayslipById(id),
    enabled: !!id,
  });
}

export function useAcknowledgeWarningMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      warningId,
      input,
    }: {
      warningId: string;
      input: WarningAcknowledgementInput;
    }) => acknowledgeWarning(warningId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.payruns });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.payslips });
    },
  });
}
