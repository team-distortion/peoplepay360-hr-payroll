import React from 'react';
import { Contract } from '../../pages/Contracts';

interface ContractsListProps {
  contracts: Contract[];
  onOpenContract: (contractId: string) => void;
}

export default function ContractsList({ contracts, onOpenContract }: ContractsListProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="p-8">
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface/50">
              <th className="py-3 px-4 text-xs font-semibold text-slate uppercase tracking-wider">Contract</th>
              <th className="py-3 px-4 text-xs font-semibold text-slate uppercase tracking-wider">Employee</th>
              <th className="py-3 px-4 text-xs font-semibold text-slate uppercase tracking-wider">Start</th>
              <th className="py-3 px-4 text-xs font-semibold text-slate uppercase tracking-wider">End</th>
              <th className="py-3 px-4 text-xs font-semibold text-slate uppercase tracking-wider">Wage / Month</th>
              <th className="py-3 px-4 text-xs font-semibold text-slate uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {contracts.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate text-sm">
                  No contracts found
                </td>
              </tr>
            ) : (
              contracts.map((contract, index) => (
                <tr 
                  key={contract.id}
                  onClick={() => onOpenContract(contract.id)}
                  className="border-b border-border hover:bg-surface hover:translate-x-1 transition-all duration-200 cursor-pointer group animate-in fade-in slide-in-from-bottom-4 fill-mode-both"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <td className="py-3 px-4 text-sm font-medium text-navy">{contract.id}</td>
                  <td className="py-3 px-4 text-sm text-navy">{contract.employeeName}</td>
                  <td className="py-3 px-4 text-sm text-slate">{contract.startDate}</td>
                  <td className="py-3 px-4 text-sm text-slate">{contract.endDate || '—'}</td>
                  <td className="py-3 px-4 text-sm font-medium text-navy">{formatCurrency(contract.wage)}</td>
                  <td className="py-3 px-4 text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      contract.status === 'Running' ? 'bg-green-100 text-[#3ECF8E]' : 
                      contract.status === 'Expired' ? 'bg-red-100 text-[#DF1B41]' : 
                      'bg-orange-100 text-[#FFA940]' // e.g. Upcoming
                    }`}>
                      {contract.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
