import { useState, useMemo } from 'react';
import { Plus, Search, ArrowLeft, Info } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';

export interface TimeOffType {
  id: string;
  name: string;
  unit: 'Days' | 'Hours';
  requiresAllocation: boolean;
  approvalRole: string;
  status: 'Active' | 'Inactive';
  payrollWorkEntry: string;
  displayColor: string;
}

const INITIAL_TYPES: TimeOffType[] = [
  {
    id: 'TOT-001',
    name: 'Paid Time Off',
    unit: 'Days',
    requiresAllocation: true,
    approvalRole: 'Manager',
    status: 'Active',
    payrollWorkEntry: 'Leave Work Entry',
    displayColor: 'blue',
  },
  {
    id: 'TOT-002',
    name: 'Sick Leave',
    unit: 'Days',
    requiresAllocation: false,
    approvalRole: 'Manager',
    status: 'Active',
    payrollWorkEntry: 'Sick Leave Entry',
    displayColor: 'red',
  },
  {
    id: 'TOT-003',
    name: 'Comp Off',
    unit: 'Hours',
    requiresAllocation: true,
    approvalRole: 'Officer',
    status: 'Active',
    payrollWorkEntry: 'Comp Off Entry',
    displayColor: 'emerald',
  }
];

const COLORS = [
  { label: 'Blue', value: 'blue', hex: '#3b82f6' },
  { label: 'Emerald', value: 'emerald', hex: '#10b981' },
  { label: 'Red', value: 'red', hex: '#ef4444' },
  { label: 'Amber', value: 'amber', hex: '#f59e0b' },
  { label: 'Purple', value: 'purple', hex: '#8b5cf6' },
];

export default function TimeOffTypes() {
  const [types, setTypes] = useState<TimeOffType[]>(INITIAL_TYPES);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState<string | null | undefined>(undefined);
  const [formType, setFormType] = useState<TimeOffType | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const filteredTypes = useMemo(() => {
    if (!searchQuery) return types;
    const q = searchQuery.toLowerCase();
    return types.filter(t => t.name.toLowerCase().includes(q) || t.approvalRole.toLowerCase().includes(q));
  }, [types, searchQuery]);

  const handleOpenDetail = (id: string | null) => {
    if (id === null) {
      setFormType({
        id: `TOT-NEW-${Date.now()}`,
        name: '',
        unit: 'Days',
        requiresAllocation: true,
        approvalRole: 'Manager',
        status: 'Active',
        payrollWorkEntry: '',
        displayColor: 'blue'
      });
      setIsEditMode(true);
    } else {
      const found = types.find(t => t.id === id);
      if (found) setFormType({ ...found });
      setIsEditMode(false);
    }
    setSelectedTypeId(id);
  };

  const handleCloseDetail = () => {
    setSelectedTypeId(undefined);
    setFormType(null);
    setIsEditMode(false);
  };

  const handleSaveType = () => {
    if (!formType) return;
    if (selectedTypeId === null) {
      setTypes([formType, ...types]);
    } else {
      setTypes(types.map(t => t.id === formType.id ? formType : t));
    }
    setIsEditMode(false);
    // Note: To mimic real behavior, we just switch out of edit mode instead of closing
  };

  return (
    <AppLayout>
      {selectedTypeId !== undefined && formType ? (
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
                <span className="text-xs text-mutedText font-medium mb-0.5">Time Off Type / {formType.name || 'New Type'}</span>
                <h2 className="text-2xl font-display font-bold text-navy">
                  {formType.name || 'New Type'}
                </h2>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {isEditMode ? (
                <>
                  <button 
                    onClick={() => {
                      if (selectedTypeId === null) handleCloseDetail();
                      else {
                        const original = types.find(t => t.id === selectedTypeId);
                        if (original) setFormType({...original});
                        setIsEditMode(false);
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium text-slate hover:text-navy transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveType}
                    className="px-6 py-2 bg-brandAccent hover:bg-[#4a44cc] text-white text-sm font-medium rounded-full transition-all shadow-sm"
                  >
                    Save
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => setIsEditMode(true)}
                  className="px-6 py-2 border border-brandAccent text-brandAccent hover:bg-brandAccent/5 text-sm font-medium rounded-full transition-all shadow-sm"
                >
                  EDIT
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-8">
            <div className="max-w-4xl mx-auto space-y-8">
              
              <div className={`bg-white rounded-2xl border border-border p-8 shadow-sm transition-all duration-300 ${isEditMode ? 'ring-1 ring-brandAccent/20' : ''}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                  {/* Left Column */}
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-navy mb-1.5">Type Name</label>
                      {isEditMode ? (
                        <input 
                          type="text" 
                          value={formType.name}
                          onChange={(e) => setFormType({...formType, name: e.target.value})}
                          className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all animate-in fade-in"
                        />
                      ) : (
                        <div className="text-sm text-slate py-2">{formType.name}</div>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-navy mb-1.5">Unit</label>
                      {isEditMode ? (
                        <select 
                          value={formType.unit}
                          onChange={(e) => setFormType({...formType, unit: e.target.value as 'Days'|'Hours'})}
                          className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all animate-in fade-in"
                        >
                          <option value="Days">Days</option>
                          <option value="Hours">Hours</option>
                        </select>
                      ) : (
                        <div className="text-sm text-slate py-2">{formType.unit}</div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-navy mb-1.5">Requires Allocation</label>
                      {isEditMode ? (
                        <select 
                          value={formType.requiresAllocation ? "true" : "false"}
                          onChange={(e) => setFormType({...formType, requiresAllocation: e.target.value === "true"})}
                          className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all animate-in fade-in"
                        >
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      ) : (
                        <div className="text-sm text-slate py-2">{formType.requiresAllocation ? "Yes" : "No"}</div>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-navy mb-1.5">Active</label>
                      {isEditMode ? (
                        <select 
                          value={formType.status}
                          onChange={(e) => setFormType({...formType, status: e.target.value as 'Active'|'Inactive'})}
                          className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all animate-in fade-in"
                        >
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      ) : (
                        <div className="text-sm text-slate py-2">{formType.status === 'Active' ? 'True' : 'False'}</div>
                      )}
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-navy mb-1.5">Approval Role</label>
                      {isEditMode ? (
                        <select 
                          value={formType.approvalRole}
                          onChange={(e) => setFormType({...formType, approvalRole: e.target.value})}
                          className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all animate-in fade-in"
                        >
                          <option value="Manager">Manager</option>
                          <option value="Officer">Officer</option>
                          <option value="HR">HR</option>
                        </select>
                      ) : (
                        <div className="text-sm text-slate py-2">{formType.approvalRole}</div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-navy mb-1.5">Payroll / Work Entry</label>
                      {isEditMode ? (
                        <input 
                          type="text" 
                          value={formType.payrollWorkEntry}
                          onChange={(e) => setFormType({...formType, payrollWorkEntry: e.target.value})}
                          className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all animate-in fade-in"
                        />
                      ) : (
                        <div className="text-sm text-slate py-2">{formType.payrollWorkEntry}</div>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-navy mb-1.5">Display Color</label>
                      {isEditMode ? (
                        <div className="flex gap-2 pt-1 animate-in fade-in">
                          {COLORS.map(c => (
                            <button
                              key={c.value}
                              onClick={() => setFormType({...formType, displayColor: c.value})}
                              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${formType.displayColor === c.value ? 'ring-2 ring-offset-2 ring-navy scale-105' : 'hover:scale-110'}`}
                              style={{ backgroundColor: c.hex }}
                              title={c.label}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="py-2 flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ backgroundColor: COLORS.find(c => c.value === formType.displayColor)?.hex || '#ccc' }} 
                          />
                          <span className="text-sm text-slate capitalize">{formType.displayColor}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Configuration Notes */}
              <div className="bg-surface/50 border border-border p-6 rounded-2xl flex gap-4">
                <Info className="text-brandAccent shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="font-semibold text-navy mb-1">Configuration Notes</h4>
                  <p className="text-sm text-slate">
                    Time Off Type drives approval behavior and whether a request needs an allocation. Editing these settings changes behavior for every future request of this type.
                  </p>
                </div>
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
                <span>New Type</span>
              </button>
              <div className="flex flex-col">
                <h1 className="text-3xl font-display font-bold text-navy tracking-tight">Time Off Types</h1>
                <p className="text-sm text-mutedText mt-1">List view opened from Time Off ▼ → Time Off Types</p>
              </div>
            </div>
          </div>

          <div className="p-8 flex-1 flex flex-col max-w-6xl mx-auto w-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-mutedText" size={16} />
                <input 
                  type="text" 
                  placeholder="Search time off types..." 
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
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Unit</th>
                    <th className="px-6 py-4">Allocation</th>
                    <th className="px-6 py-4">Approval</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-navy divide-y divide-border">
                  {filteredTypes.map((type) => (
                    <tr 
                      key={type.id}
                      onClick={() => handleOpenDetail(type.id)}
                      className="cursor-pointer transition-colors duration-200 hover:bg-surface/50 group"
                    >
                      <td className="px-6 py-4 font-medium flex items-center gap-2">
                        <div 
                          className="w-2.5 h-2.5 rounded-full" 
                          style={{ backgroundColor: COLORS.find(c => c.value === type.displayColor)?.hex || '#ccc' }} 
                        />
                        <span className="group-hover:text-brandAccent transition-colors">{type.name}</span>
                      </td>
                      <td className="px-6 py-4 text-slate">{type.unit}</td>
                      <td className="px-6 py-4 text-slate">{type.requiresAllocation ? 'Required' : 'No'}</td>
                      <td className="px-6 py-4 text-slate">{type.approvalRole}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          type.status === 'Active' 
                            ? 'border-success text-success bg-success/10' 
                            : 'border-mutedText text-mutedText bg-surface'
                        }`}>
                          {type.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredTypes.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate">
                        No time off types found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <p className="mt-4 text-sm text-mutedText text-center">
              Useful note: this list defines policy rules, not employee transactions.
            </p>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
