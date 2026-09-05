import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  SalaryStructureInput,
  SalaryStructureListQuery,
  SalaryRuleInput,
  SalaryRuleListQuery,
  SalaryRuleConfigurationInput,
  RecordStatus,
} from '@peoplepay360/shared';
import * as api from './salary-config.api';

export const salaryConfigKeys = {
  allStructures: ['salary-structures'] as const,
  structuresList: (query?: SalaryStructureListQuery) =>
    ['salary-structures', 'list', query] as const,
  structureDetail: (id: string, options?: { includeInactiveRules?: boolean }) =>
    ['salary-structures', 'detail', id, options] as const,
  allRules: ['salary-rules'] as const,
  rulesList: (query?: SalaryRuleListQuery) =>
    ['salary-rules', 'list', query] as const,
  ruleDetail: (id: string) => ['salary-rules', 'detail', id] as const,
};

// ── Structure Queries & Mutations ──────────────────────────────

export function useSalaryStructures(query: SalaryStructureListQuery = {}) {
  return useQuery({
    queryKey: salaryConfigKeys.structuresList(query),
    queryFn: () => api.fetchSalaryStructures(query),
  });
}

export function useSalaryStructure(
  id: string,
  options?: { includeInactiveRules?: boolean }
) {
  return useQuery({
    queryKey: salaryConfigKeys.structureDetail(id, options),
    queryFn: () => api.fetchSalaryStructureById(id, options),
    enabled: Boolean(id),
  });
}

export function useCreateSalaryStructure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SalaryStructureInput) => api.createSalaryStructure(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: salaryConfigKeys.allStructures });
    },
  });
}

export function useUpdateSalaryStructure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SalaryStructureInput }) =>
      api.updateSalaryStructure(id, input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: salaryConfigKeys.allStructures });
      queryClient.invalidateQueries({
        queryKey: salaryConfigKeys.structureDetail(variables.id),
      });
    },
  });
}

export function useUpdateSalaryStructureStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: RecordStatus }) =>
      api.updateSalaryStructureStatus(id, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: salaryConfigKeys.allStructures });
      queryClient.invalidateQueries({
        queryKey: salaryConfigKeys.structureDetail(variables.id),
      });
    },
  });
}

// ── Rule Queries & Mutations ───────────────────────────────────

export function useSalaryRules(query: SalaryRuleListQuery = {}) {
  return useQuery({
    queryKey: salaryConfigKeys.rulesList(query),
    queryFn: () => api.fetchSalaryRules(query),
  });
}

export function useSalaryRule(id: string) {
  return useQuery({
    queryKey: salaryConfigKeys.ruleDetail(id),
    queryFn: () => api.fetchSalaryRuleById(id),
    enabled: Boolean(id),
  });
}

export function useCreateSalaryRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      structureId,
      input,
    }: {
      structureId: string;
      input: SalaryRuleInput;
    }) => api.createSalaryRule(structureId, input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: salaryConfigKeys.allRules });
      queryClient.invalidateQueries({
        queryKey: salaryConfigKeys.structureDetail(variables.structureId),
      });
      queryClient.invalidateQueries({ queryKey: salaryConfigKeys.allStructures });
    },
  });
}

export function useUpdateSalaryRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SalaryRuleInput }) =>
      api.updateSalaryRule(id, input),
    onSuccess: (updatedRule) => {
      queryClient.invalidateQueries({ queryKey: salaryConfigKeys.allRules });
      queryClient.invalidateQueries({
        queryKey: salaryConfigKeys.ruleDetail(updatedRule.id),
      });
      queryClient.invalidateQueries({
        queryKey: salaryConfigKeys.structureDetail(updatedRule.salaryStructureId),
      });
    },
  });
}

export function useUpdateSalaryRuleStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: RecordStatus }) =>
      api.updateSalaryRuleStatus(id, status),
    onSuccess: (updatedRule) => {
      queryClient.invalidateQueries({ queryKey: salaryConfigKeys.allRules });
      queryClient.invalidateQueries({
        queryKey: salaryConfigKeys.ruleDetail(updatedRule.id),
      });
      queryClient.invalidateQueries({
        queryKey: salaryConfigKeys.structureDetail(updatedRule.salaryStructureId),
      });
    },
  });
}

export function useUpdateSalaryRuleConfiguration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      structureId,
      input,
    }: {
      structureId: string;
      input: SalaryRuleConfigurationInput;
    }) => api.updateSalaryRuleConfiguration(structureId, input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: salaryConfigKeys.allRules });
      queryClient.invalidateQueries({ queryKey: salaryConfigKeys.allStructures });
      queryClient.invalidateQueries({
        queryKey: salaryConfigKeys.structureDetail(variables.structureId),
      });
    },
  });
}
