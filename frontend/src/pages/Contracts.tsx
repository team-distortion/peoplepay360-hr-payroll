import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import ContractsToolbar from '../components/contracts/ContractsToolbar';
import ContractsList from '../components/contracts/ContractsList';
import ContractDetail from '../components/contracts/ContractDetail';

export interface Contract {
  id: string;
  employeeName: string;
  department: string;
  jobTitle: string;
  startDate: string;
  endDate: string;
  wage: number;
  schedule: string;
  status: 'Running' | 'Expired' | 'Upcoming' | 'Terminated' | string;
}

const initialContracts: Contract[] = [
  {
    id: 'CON/2026/0042',
    employeeName: 'Aarav Mehta',
    department: 'Finance',
    jobTitle: 'Payroll Specialist',
    startDate: '01-Jan-26',
    endDate: '',
    wage: 85000,
    schedule: '40 Hours / Week',
    status: 'Running'
  },
  {
    id: 'CON/2025/0018',
    employeeName: 'Aarav Mehta',
    department: 'Finance',
    jobTitle: 'Payroll Specialist',
    startDate: '01-Jul-25',
    endDate: '31-Dec-25',
    wage: 78000,
    schedule: '40 Hours / Week',
    status: 'Expired'
  },
  {
    id: 'CON/2026/0031',
    employeeName: 'Sara Khan',
    department: 'HR',
    jobTitle: 'HR Officer',
    startDate: '01-Jan-26',
    endDate: '',
    wage: 95000,
    schedule: '40 Hours / Week',
    status: 'Running'
  }
];

export default function ContractsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filterEmployee = searchParams.get('employee');
  
  const [contracts, setContracts] = useState<Contract[]>(initialContracts);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContractId, setSelectedContractId] = useState<string | null | undefined>(undefined);
  
  // undefined = List View
  // null = Create Mode
  // string = Detail View of specific contract ID

  const filteredContracts = useMemo(() => {
    let result = contracts;
    if (filterEmployee) {
      result = result.filter(c => c.employeeName === filterEmployee);
    }
    if (searchQuery) {
      const lowerQ = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.id.toLowerCase().includes(lowerQ) ||
        c.employeeName.toLowerCase().includes(lowerQ) ||
        c.status.toLowerCase().includes(lowerQ)
      );
    }
    return result;
  }, [contracts, searchQuery, filterEmployee]);

  const handleOpenDetail = (id: string | null) => {
    setSelectedContractId(id);
  };

  const handleCloseDetail = () => {
    setSelectedContractId(undefined);
  };

  const handleSaveContract = (savedContract: Contract) => {
    if (selectedContractId === null) {
      // Create mode
      setContracts([savedContract, ...contracts]);
    } else {
      // Edit mode
      setContracts(contracts.map(c => c.id === savedContract.id ? savedContract : c));
    }
    handleCloseDetail();
  };

  const handleClearFilter = () => {
    searchParams.delete('employee');
    setSearchParams(searchParams);
  };

  const activeContract = selectedContractId ? contracts.find(c => c.id === selectedContractId) || null : null;

  return (
    <AppLayout>
      {selectedContractId !== undefined ? (
        <ContractDetail 
          contract={activeContract} 
          allContracts={contracts}
          onClose={handleCloseDetail}
          onSave={handleSaveContract}
        />
      ) : (
        <div className="flex flex-col flex-1 bg-surface/30">
          <ContractsToolbar 
            onNew={() => handleOpenDetail(null)}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filterEmployee={filterEmployee}
            onClearFilter={handleClearFilter}
          />
          <ContractsList 
            contracts={filteredContracts} 
            onOpenContract={handleOpenDetail} 
          />
        </div>
      )}
    </AppLayout>
  );
}
