import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ContractInput,
  ContractListQuery,
} from '@peoplepay360/shared';
import {
  fetchContracts,
  fetchContractById,
  createContract,
  updateContract,
  fetchSalaryStructuresSelector,
} from './contracts.api';

export const contractKeys = {
  all: ['contracts'] as const,
  lists: () => [...contractKeys.all, 'list'] as const,
  list: (query: ContractListQuery) => [...contractKeys.lists(), query] as const,
  details: () => [...contractKeys.all, 'detail'] as const,
  detail: (id: string) => [...contractKeys.details(), id] as const,
  structuresSelector: () => [...contractKeys.all, 'structuresSelector'] as const,
};

export function useContracts(query: ContractListQuery = {}) {
  return useQuery({
    queryKey: contractKeys.list(query),
    queryFn: () => fetchContracts(query),
  });
}

export function useContract(id?: string) {
  return useQuery({
    queryKey: contractKeys.detail(id || ''),
    queryFn: () => fetchContractById(id!),
    enabled: Boolean(id && id !== 'new'),
  });
}

export function useSalaryStructuresSelector() {
  return useQuery({
    queryKey: contractKeys.structuresSelector(),
    queryFn: fetchSalaryStructuresSelector,
  });
}

export function useCreateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ContractInput) => createContract(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contractKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useUpdateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ContractInput }) =>
      updateContract(id, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: contractKeys.lists() });
      queryClient.invalidateQueries({ queryKey: contractKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}
