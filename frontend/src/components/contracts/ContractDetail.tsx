import React, { useState } from 'react';
import { Contract } from '../../pages/Contracts';

interface ContractDetailProps {
  contract: Contract | null; // null for Create Mode
  allContracts: Contract[];
  onClose: () => void;
  onSave: (contract: Contract) => void;
}

// Mock employee lookup logic
const mockEmployees = {
  'Aarav Mehta': { department: 'Finance', jobTitle: 'Payroll Specialist', schedule: '40 Hours / Week' },
  'Sara Khan': { department: 'HR', jobTitle: 'HR Officer', schedule: '40 Hours / Week' },
  'John Dsouza': { department: 'Engineering', jobTitle: 'Developer', schedule: '40 Hours / Week' }
};

export default function ContractDetail({ contract, allContracts, onClose, onSave }: ContractDetailProps) {
  const isCreateMode = !contract;
  
  const [formData, setFormData] = useState<Partial<Contract>>(
    contract || {
      id: `CON/2026/${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`,
      employeeName: '',
      department: '',
      jobTitle: '',
      startDate: '',
      endDate: '',
      wage: 0,
      schedule: '',
      status: 'Running'
    }
  );

  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    let updates = { [name]: name === 'wage' ? Number(value) : value };
    
    // Auto-populate based on employee selection
    if (name === 'employeeName' && mockEmployees[value as keyof typeof mockEmployees]) {
      const empData = mockEmployees[value as keyof typeof mockEmployees];
      updates = { ...updates, ...empData };
    }
    
    setFormData(prev => ({ ...prev, ...updates }));
    setError(''); // Clear error on change
  };

  const handleSave = () => {
    // Basic validation
    if (!formData.employeeName || !formData.startDate || !formData.wage) {
      setError('Please fill in all required fields (Employee, Start Date, Wage).');
      return;
    }

    // Business rule validation: No overlapping "Running" contracts
    if (formData.status === 'Running') {
      const hasOverlap = allContracts.some(c => 
        c.employeeName === formData.employeeName && 
        c.status === 'Running' && 
        c.id !== formData.id
      );
      if (hasOverlap) {
        setError('This employee already has an active Running contract.');
        return;
      }
    }

    onSave(formData as Contract);
  };

  return (
    <div className="flex flex-col flex-1 bg-surface/30 animate-in fade-in duration-200">
      {/* Header */}
      <div className="px-8 py-6 border-b border-border bg-white sticky top-0 z-10 flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate mb-1">
              <button onClick={onClose} className="hover:text-navy transition-colors">
                Contract
              </button>
              <span>/</span>
              <span className="font-medium text-navy">{isCreateMode ? 'New Contract' : formData.id}</span>
            </div>
            <p className="text-xs text-mutedText">Form view of one contract</p>
          </div>
        </div>

        {/* Action Row */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={handleSave}
            className="px-4 py-1.5 bg-accent text-white text-sm font-medium rounded-md hover:bg-[#4a42d8] hover:shadow-md transition-all duration-200 active:scale-95 transform"
          >
            SAVE
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 border border-border text-navy text-sm font-medium rounded-md hover:bg-surface hover:text-black hover:border-slate/40 transition-all duration-200"
          >
            DISCARD
          </button>
        </div>
      </div>

      <div className="max-w-4xl p-8 mx-auto w-full">
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-[#DF1B41] border border-red-200 rounded-md text-sm font-medium flex items-center gap-2">
            <span>⚠</span> {error}
          </div>
        )}

        {/* Title */}
        <div className="mb-8">
          <h2 className="text-3xl font-display font-bold text-navy">{formData.id}</h2>
        </div>

        {/* Fields */}
        <div className="bg-white rounded-xl border border-border p-6 shadow-sm mb-6">
          <div className="grid grid-cols-2 gap-x-12 gap-y-6">
            <Field 
              index={1}
              label="Employee" 
              name="employeeName" 
              value={formData.employeeName || ''} 
              onChange={handleChange}
              type="select"
              options={['', 'Aarav Mehta', 'Sara Khan', 'John Dsouza']}
            />
            <Field 
              index={2}
              label="Department" 
              name="department" 
              value={formData.department || ''} 
              onChange={handleChange}
              disabled
            />
            
            <Field 
              index={3}
              label="Start Date" 
              name="startDate" 
              value={formData.startDate || ''} 
              onChange={handleChange} 
              placeholder="e.g. 01-Jan-2026"
            />
            <Field 
              index={4}
              label="Job Position" 
              name="jobTitle" 
              value={formData.jobTitle || ''} 
              onChange={handleChange}
              disabled
            />

            <Field 
              index={5}
              label="End Date" 
              name="endDate" 
              value={formData.endDate || ''} 
              onChange={handleChange} 
              placeholder="—"
            />
            <Field 
              index={6}
              label="Wage / Month (₹)" 
              name="wage" 
              value={formData.wage || ''} 
              onChange={handleChange}
              type="number"
            />

            <Field 
              index={7}
              label="Status" 
              name="status" 
              value={formData.status || ''} 
              onChange={handleChange}
              type="select"
              options={['Running', 'Expired', 'Upcoming', 'Terminated']}
            />
            <Field 
              index={8}
              label="Working Schedule" 
              name="schedule" 
              value={formData.schedule || ''} 
              onChange={handleChange}
              disabled
            />
          </div>
        </div>

        {/* Salary Structure Panel */}
        <div 
          className="bg-white rounded-xl border border-border p-6 shadow-sm relative overflow-hidden group animate-in fade-in slide-in-from-bottom-4 duration-300 fill-mode-both"
          style={{ animationDelay: '450ms' }}
        >
          {/* Subtle gradient border effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-accent/10 to-[#00D4FF]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          
          <h3 className="text-lg font-semibold text-navy mb-4 relative z-10">Salary Structure / Notes</h3>
          <div className="space-y-2 relative z-10">
            <p className="text-sm font-medium text-slate">
              <span className="text-navy">Structure Type:</span> Employee Salary
            </p>
            {formData.status === 'Running' ? (
              <p className="text-sm text-[#3ECF8E] font-medium animate-in fade-in">
                This running contract is the source for payroll calculation in the active period.
              </p>
            ) : formData.status === 'Expired' ? (
              <p className="text-sm text-slate animate-in fade-in">
                This contract is historical and no longer affects active payroll.
              </p>
            ) : (
              <p className="text-sm text-slate animate-in fade-in">
                Status is {formData.status}.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ 
  label, name, value, onChange, type = 'text', options, disabled, placeholder, index = 0
}: { 
  label: string, name: string, value: string | number, onChange: any, type?: string, options?: string[], disabled?: boolean, placeholder?: string, index?: number
}) {
  return (
    <div 
      className="flex flex-col gap-1 animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <label className="text-xs font-semibold text-mutedText uppercase tracking-wider">{label}</label>
      {type === 'select' ? (
        <select
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className="text-sm text-navy px-2 py-1.5 border border-border rounded bg-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:bg-surface/50 disabled:text-slate"
        >
          {options?.map(opt => <option key={opt} value={opt}>{opt || 'Select...'}</option>)}
        </select>
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          className="text-sm text-navy px-2 py-1.5 border border-border rounded bg-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:bg-surface/50 disabled:text-slate"
        />
      )}
    </div>
  );
}
