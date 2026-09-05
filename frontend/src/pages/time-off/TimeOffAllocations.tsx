import React, { useState, useMemo } from 'react';
import { Plus, Search, ArrowLeft, Check, X, Info } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';

export interface Allocation {
  id: string;
  employeeName: string;
  timeOffType: string;
  allocated: number;
  taken: number;
  status: 'Approved' | 'To Approve' | 'Refused';
  approver: string;
  validity: string;
  description: string;
}

const INITIAL_ALLOCATIONS: Allocation[] = [
  {
    id: 'ALL-001',
    employeeName: 'Aarav Mehta',
    timeOffType: 'Paid Time Off',
    allocated: 20,
    taken: 8,
    status: 'Approved',
    approver: 'Sara Khan',
    validity: '2026 Annual Balance',
    description: 'Annual leave balance granted at start of policy year.'
  },
  {
    id: 'ALL-002',
    employeeName: 'Sara Khan',
    timeOffType: 'Paid Time Off',
    allocated: 18,
    taken: 4,
    status: 'Approved',
    approver: 'Director HR',
    validity: '2026 Annual Balance',
    description: 'Annual leave balance.'
  },
  {
    id: 'ALL-003',
    employeeName: 'Neha Patel',
    timeOffType: 'Comp Off',
    allocated: 2,
    taken: 1,
    status: 'To Approve',
    approver: 'Manager',
    validity: 'Q3 Overtime',
    description: 'Weekend deployment compensation.'
  }
];

export default function TimeOffAllocations() {
  const [allocations, setAllocations] = useState<Allocation[]>(INITIAL_ALLOCATIONS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAllocationId, setSelectedAllocationId] = useState<string | null | undefined>(undefined);
  const [formAllocation, setFormAllocation] = useState<Allocation | null>(null);

  const filteredAllocations = useMemo(() => {
    if (!searchQuery) return allocations;
    const q = searchQuery.toLowerCase();
    return allocations.filter(a => a.employeeName.toLowerCase().includes(q) || a.timeOffType.toLowerCase().includes(q));
  }, [allocations, searchQuery]);

  const handleOpenDetail = (id: string | null) => {
    if (id === null) {
      setFormAllocation({
        id: `ALL-NEW-${Date.now()}`,
        employeeName: '',
        timeOffType: 'Paid Time Off',
        allocated: 0,
        taken: 0,
        status: 'To Approve',
        approver: '',
        validity: '',
        description: ''
      });
    } else {
      const found = allocations.find(a => a.id === id);
      if (found) setFormAllocation({ ...found });
    }
    setSelectedAllocationId(id);
  };

  const handleCloseDetail = () => {
    setSelectedAllocationId(undefined);
    setFormAllocation(null);
  };

  const handleSaveAction = (newStatus: 'Approved' | 'Refused' | 'To Approve') => {
    if (!formAllocation) return;
    const updated = { ...formAllocation, status: newStatus };
    
    if (selectedAllocationId === null) {
      setAllocations([updated, ...allocations]);
    } else {
      setAllocations(allocations.map(a => a.id === updated.id ? updated : a));
    }
    setFormAllocation(updated); // Update local form state too
    // Keeping it open to show animation/change
  };

  return (
    <AppLayout>
      {selectedAllocationId !== undefined && formAllocation ? (
        // FORM VIEW
        <div className="flex-1 flex flex-col bg-surface/30 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="px-8 py-6 bg-white border-b border-border sticky top-0 z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={handleCloseDetail}
                className="p-2 hover:bg-surface rounded-full text-brandAccent transition-colors flex items-center justify-center group"
              >
                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              </button>
              <div className="flex flex-col">
                <span className="text-xs text-mutedText font-medium mb-0.5">Allocation / {formAllocation.employeeName || 'New'}</span>
                <h2 className="text-2xl font-display font-bold text-navy">
                  Allocation / {formAllocation.employeeName || 'New'}
                </h2>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {formAllocation.status === 'To Approve' ? (
                <>
                  <button 
                    onClick={() => handleSaveAction('Refused')}
                    className="px-6 py-2 border border-error text-error hover:bg-error/5 text-sm font-medium rounded-full transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <X size={16} /> Refuse
                  </button>
                  <button 
                    onClick={() => handleSaveAction('Approved')}
                    className="px-6 py-2 bg-brandAccent hover:bg-[#4a44cc] text-white text-sm font-medium rounded-full transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <Check size={16} /> Approve
                  </button>
                </>
              ) : (
                <span className={`px-4 py-1.5 text-sm font-medium rounded-full border transition-all duration-300 ${
                  formAllocation.status === 'Approved' ? 'border-success text-success bg-success/10' : 'border-error text-error bg-error/10'
                }`}>
                  {formAllocation.status}
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-8">
            <div className="max-w-4xl mx-auto space-y-8">
              
              <div className="bg-white rounded-2xl border border-border p-8 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                  {/* Left Column */}
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-navy mb-1.5">Employee</label>
                      {formAllocation.status === 'To Approve' && selectedAllocationId === null ? (
                        <input 
                          type="text" 
                          value={formAllocation.employeeName}
                          onChange={(e) => setFormAllocation({...formAllocation, employeeName: e.target.value})}
                          placeholder="e.g. Aarav Mehta"
                          className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all"
                        />
                      ) : (
                        <div className="text-sm text-slate py-2">{formAllocation.employeeName}</div>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-navy mb-1.5">Time Off Type</label>
                      {formAllocation.status === 'To Approve' && selectedAllocationId === null ? (
                        <select 
                          value={formAllocation.timeOffType}
                          onChange={(e) => setFormAllocation({...formAllocation, timeOffType: e.target.value})}
                          className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all"
                        >
                          <option value="Paid Time Off">Paid Time Off</option>
                          <option value="Comp Off">Comp Off</option>
                        </select>
                      ) : (
                        <div className="text-sm text-slate py-2">{formAllocation.timeOffType}</div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-navy mb-1.5">Allocated (Days/Hours)</label>
                      {formAllocation.status === 'To Approve' && selectedAllocationId === null ? (
                        <input 
                          type="number" 
                          value={formAllocation.allocated}
                          onChange={(e) => setFormAllocation({...formAllocation, allocated: Number(e.target.value)})}
                          className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all"
                        />
                      ) : (
                        <div className="text-sm text-slate py-2">{formAllocation.allocated} Days</div>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-navy mb-1.5">Status</label>
                      <div className="text-sm text-slate py-2 transition-all duration-300" style={{ color: formAllocation.status === 'Approved' ? '#10b981' : formAllocation.status === 'Refused' ? '#ef4444' : '#f59e0b' }}>
                        {formAllocation.status}
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-navy mb-1.5">Taken</label>
                      <div className="text-sm text-slate py-2">{formAllocation.taken} Days</div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-navy mb-1.5">Remaining</label>
                      <div className="text-sm font-bold text-navy py-2 text-lg">
                        {Math.max(0, formAllocation.allocated - formAllocation.taken)} Days
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-navy mb-1.5">Approver</label>
                      {formAllocation.status === 'To Approve' && selectedAllocationId === null ? (
                        <input 
                          type="text" 
                          value={formAllocation.approver}
                          onChange={(e) => setFormAllocation({...formAllocation, approver: e.target.value})}
                          placeholder="e.g. Sara Khan"
                          className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all"
                        />
                      ) : (
                        <div className="text-sm text-slate py-2">{formAllocation.approver}</div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-navy mb-1.5">Validity</label>
                      {formAllocation.status === 'To Approve' && selectedAllocationId === null ? (
                        <input 
                          type="text" 
                          value={formAllocation.validity}
                          onChange={(e) => setFormAllocation({...formAllocation, validity: e.target.value})}
                          placeholder="e.g. 2026 Annual Balance"
                          className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all"
                        />
                      ) : (
                        <div className="text-sm text-slate py-2">{formAllocation.validity}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Description Notes */}
              <div className="bg-white border border-border p-6 rounded-2xl">
                <h4 className="font-semibold text-navy mb-3">Description</h4>
                {formAllocation.status === 'To Approve' && selectedAllocationId === null ? (
                  <textarea 
                    value={formAllocation.description}
                    onChange={(e) => setFormAllocation({...formAllocation, description: e.target.value})}
                    placeholder="E.g. Annual leave balance granted at start of policy year."
                    className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all min-h-[80px]"
                  />
                ) : (
                  <p className="text-sm text-slate">{formAllocation.description}</p>
                )}
              </div>

              <div className="bg-surface/50 border border-border p-6 rounded-2xl flex gap-4">
                <Info className="text-brandAccent shrink-0 mt-0.5" size={20} />
                <p className="text-sm text-slate">
                  Approved allocation is what creates available leave balance for the employee. A "To Approve" allocation does not count toward the employee's available leave until approved.
                </p>
              </div>

            </div>
          </div>
        </div>
      ) : (
        // LIST VIEW
        <div className="flex-1 flex flex-col bg-surface/30 animate-in fade-in duration-500">
          <div className="px-8 py-6 bg-white border-b border-border flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => handleOpenDetail(null)}
                className="flex items-center gap-2 px-4 py-2 bg-brandAccent hover:bg-[#4a44cc] text-white font-medium rounded-full transition-all shadow-sm hover:shadow-md"
              >
                <Plus size={16} />
                <span>New Allocation</span>
              </button>
              <div className="flex flex-col">
                <h1 className="text-3xl font-display font-bold text-navy tracking-tight">Allocations</h1>
                <p className="text-sm text-mutedText mt-1">List view opened from Time Off ▼ → Allocations</p>
              </div>
            </div>
          </div>

          <div className="p-8 flex-1 flex flex-col max-w-6xl mx-auto w-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-mutedText" size={16} />
                <input 
                  type="text" 
                  placeholder="Search allocations..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-border rounded-full focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all text-sm text-navy placeholder:text-mutedText shadow-sm"
                />
              </div>
            </div>

            <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface text-xs uppercase tracking-wider text-mutedText font-semibold">
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Allocated</th>
                    <th className="px-6 py-4">Taken</th>
                    <th className="px-6 py-4">Remaining</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-navy divide-y divide-border">
                  {filteredAllocations.map((alloc) => (
                    <tr 
                      key={alloc.id}
                      onClick={() => handleOpenDetail(alloc.id)}
                      className="cursor-pointer transition-colors duration-200 hover:bg-surface/50 group"
                    >
                      <td className="px-6 py-4 font-medium group-hover:text-brandAccent transition-colors">{alloc.employeeName}</td>
                      <td className="px-6 py-4 text-slate">{alloc.timeOffType}</td>
                      <td className="px-6 py-4 text-slate">{alloc.allocated}</td>
                      <td className="px-6 py-4 text-slate">{alloc.taken}</td>
                      <td className="px-6 py-4 font-bold text-navy">{Math.max(0, alloc.allocated - alloc.taken)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors duration-300 ${
                          alloc.status === 'Approved' 
                            ? 'border-success text-success bg-success/10' 
                            : alloc.status === 'Refused'
                            ? 'border-error text-error bg-error/10'
                            : 'border-amber-500 text-amber-600 bg-amber-50'
                        }`}>
                          {alloc.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredAllocations.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate">
                        No allocations found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <p className="mt-4 text-sm text-mutedText text-center">
              Useful note: the list should expose the balance math at a glance — Allocated, Taken and Remaining.
            </p>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
