import React, { useState, useMemo } from 'react';
import { Plus, Search, ArrowLeft, Check, X, Filter } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';

export interface TimeOffRequest {
  id: string;
  employeeName: string;
  timeOffType: string;
  start: string;
  end: string;
  duration: string;
  status: 'Approved' | 'To Approve' | 'Refused';
  approver: string;
  allocationUsed: string;
  reason: string;
  isMyTeam: boolean; // For mocking the My Team filter
}

const INITIAL_REQUESTS: TimeOffRequest[] = [
  {
    id: 'REQ-001',
    employeeName: 'Aarav Mehta',
    timeOffType: 'Paid Time Off',
    start: '12-Sep-2026',
    end: '14-Sep-2026',
    duration: '3 Days',
    status: 'Approved',
    approver: 'Sara Khan',
    allocationUsed: 'Paid Time Off 2026',
    reason: 'Family vacation',
    isMyTeam: true,
  },
  {
    id: 'REQ-002',
    employeeName: 'Sara Khan',
    timeOffType: 'Sick Leave',
    start: '18-Sep-2026',
    end: '18-Sep-2026',
    duration: '1 Day',
    status: 'Approved',
    approver: 'Director HR',
    allocationUsed: '',
    reason: 'Not feeling well',
    isMyTeam: false,
  },
  {
    id: 'REQ-003',
    employeeName: 'John Dsouza',
    timeOffType: 'Comp Off',
    start: '27-Sep-2026',
    end: '27-Sep-2026',
    duration: '1 Day',
    status: 'To Approve',
    approver: 'Aarav Mehta',
    allocationUsed: 'Q3 Overtime',
    reason: 'Taking time off for working on weekend',
    isMyTeam: true,
  }
];

export default function TimeOffRequests() {
  const [requests, setRequests] = useState<TimeOffRequest[]>(INITIAL_REQUESTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMyTeamOnly, setShowMyTeamOnly] = useState(false);
  
  const [selectedRequestId, setSelectedRequestId] = useState<string | null | undefined>(undefined);
  const [formRequest, setFormRequest] = useState<TimeOffRequest | null>(null);

  const filteredRequests = useMemo(() => {
    let result = requests;
    if (showMyTeamOnly) {
      result = result.filter(r => r.isMyTeam);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => r.employeeName.toLowerCase().includes(q) || r.timeOffType.toLowerCase().includes(q));
    }
    return result;
  }, [requests, searchQuery, showMyTeamOnly]);

  const handleOpenDetail = (id: string | null) => {
    if (id === null) {
      setFormRequest({
        id: `REQ-NEW-${Date.now()}`,
        employeeName: '',
        timeOffType: 'Paid Time Off',
        start: '',
        end: '',
        duration: '1 Day',
        status: 'To Approve',
        approver: '',
        allocationUsed: '',
        reason: '',
        isMyTeam: true
      });
    } else {
      const found = requests.find(r => r.id === id);
      if (found) setFormRequest({ ...found });
    }
    setSelectedRequestId(id);
  };

  const handleCloseDetail = () => {
    setSelectedRequestId(undefined);
    setFormRequest(null);
  };

  const handleInlineAction = (e: React.MouseEvent, id: string, newStatus: 'Approved' | 'Refused') => {
    e.stopPropagation(); // Prevent opening detail view
    setRequests(reqs => reqs.map(r => r.id === id ? { ...r, status: newStatus } : r));
  };

  const handleFormAction = (newStatus: 'Approved' | 'Refused' | 'To Approve') => {
    if (!formRequest) return;
    const updated = { ...formRequest, status: newStatus };
    
    if (selectedRequestId === null) {
      setRequests([updated, ...requests]);
    } else {
      setRequests(requests.map(r => r.id === updated.id ? updated : r));
    }
    setFormRequest(updated);
  };

  return (
    <AppLayout>
      {selectedRequestId !== undefined && formRequest ? (
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
                <span className="text-xs text-mutedText font-medium mb-0.5">Time Off Request / {formRequest.employeeName || 'New'}</span>
                <h2 className="text-2xl font-display font-bold text-navy">
                  Time Off Request / {formRequest.employeeName || 'New'}
                </h2>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {formRequest.status === 'To Approve' ? (
                <>
                  <button 
                    onClick={() => handleFormAction('Refused')}
                    className="px-6 py-2 border border-error text-error hover:bg-error/5 text-sm font-medium rounded-full transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <X size={16} /> Refuse
                  </button>
                  <button 
                    onClick={() => handleFormAction('Approved')}
                    className="px-6 py-2 bg-brandAccent hover:bg-[#4a44cc] text-white text-sm font-medium rounded-full transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <Check size={16} /> Approve
                  </button>
                </>
              ) : (
                <span className={`px-4 py-1.5 text-sm font-medium rounded-full border transition-all duration-300 ${
                  formRequest.status === 'Approved' ? 'border-success text-success bg-success/10' : 'border-error text-error bg-error/10'
                }`}>
                  {formRequest.status}
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
                      {formRequest.status === 'To Approve' && selectedRequestId === null ? (
                        <input 
                          type="text" 
                          value={formRequest.employeeName}
                          onChange={(e) => setFormRequest({...formRequest, employeeName: e.target.value})}
                          placeholder="e.g. Aarav Mehta"
                          className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all"
                        />
                      ) : (
                        <div className="text-sm text-slate py-2">{formRequest.employeeName}</div>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-navy mb-1.5">Time Off Type</label>
                      {formRequest.status === 'To Approve' && selectedRequestId === null ? (
                        <select 
                          value={formRequest.timeOffType}
                          onChange={(e) => setFormRequest({...formRequest, timeOffType: e.target.value})}
                          className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all"
                        >
                          <option value="Paid Time Off">Paid Time Off</option>
                          <option value="Sick Leave">Sick Leave</option>
                          <option value="Comp Off">Comp Off</option>
                        </select>
                      ) : (
                        <div className="text-sm text-slate py-2">{formRequest.timeOffType}</div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-navy mb-1.5">Start Date</label>
                      {formRequest.status === 'To Approve' && selectedRequestId === null ? (
                        <input 
                          type="date" 
                          value={formRequest.start}
                          onChange={(e) => setFormRequest({...formRequest, start: e.target.value})}
                          className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all"
                        />
                      ) : (
                        <div className="text-sm text-slate py-2">{formRequest.start}</div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-navy mb-1.5">End Date</label>
                      {formRequest.status === 'To Approve' && selectedRequestId === null ? (
                        <input 
                          type="date" 
                          value={formRequest.end}
                          onChange={(e) => setFormRequest({...formRequest, end: e.target.value})}
                          className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all"
                        />
                      ) : (
                        <div className="text-sm text-slate py-2">{formRequest.end}</div>
                      )}
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-navy mb-1.5">Duration</label>
                      {formRequest.status === 'To Approve' && selectedRequestId === null ? (
                        <input 
                          type="text" 
                          value={formRequest.duration}
                          onChange={(e) => setFormRequest({...formRequest, duration: e.target.value})}
                          placeholder="e.g. 3 Days"
                          className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all"
                        />
                      ) : (
                        <div className="text-sm text-slate py-2">{formRequest.duration}</div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-navy mb-1.5">Status</label>
                      <div className="text-sm text-slate py-2 transition-all duration-300" style={{ color: formRequest.status === 'Approved' ? '#10b981' : formRequest.status === 'Refused' ? '#ef4444' : '#f59e0b' }}>
                        {formRequest.status}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-navy mb-1.5">Approver</label>
                      {formRequest.status === 'To Approve' && selectedRequestId === null ? (
                        <input 
                          type="text" 
                          value={formRequest.approver}
                          onChange={(e) => setFormRequest({...formRequest, approver: e.target.value})}
                          placeholder="e.g. Sara Khan"
                          className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all"
                        />
                      ) : (
                        <div className="text-sm text-slate py-2">{formRequest.approver}</div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-navy mb-1.5">Allocation Used</label>
                      {formRequest.status === 'To Approve' && selectedRequestId === null ? (
                        <input 
                          type="text" 
                          value={formRequest.allocationUsed}
                          onChange={(e) => setFormRequest({...formRequest, allocationUsed: e.target.value})}
                          placeholder="Leave empty if not required"
                          className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all"
                        />
                      ) : (
                        <div className="text-sm text-slate py-2">
                          {formRequest.allocationUsed ? (
                            formRequest.allocationUsed
                          ) : (
                            <span className="text-mutedText italic">Not applicable</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Reason Panel */}
              <div className="bg-white border border-border p-6 rounded-2xl shadow-sm">
                <h4 className="font-semibold text-navy mb-3">Reason</h4>
                {formRequest.status === 'To Approve' && selectedRequestId === null ? (
                  <textarea 
                    value={formRequest.reason}
                    onChange={(e) => setFormRequest({...formRequest, reason: e.target.value})}
                    placeholder="E.g. Family vacation"
                    className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all min-h-[80px]"
                  />
                ) : (
                  <p className="text-sm text-slate">{formRequest.reason}</p>
                )}
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
                className="flex items-center gap-2 px-4 py-2 bg-brandAccent hover:bg-[#4a44cc] text-white font-medium rounded-full transition-all shadow-sm hover:shadow-md uppercase tracking-wider text-xs"
              >
                <Plus size={16} />
                <span>New</span>
              </button>
              <div className="flex flex-col">
                <h1 className="text-3xl font-display font-bold text-navy tracking-tight">Time Off Requests</h1>
                <p className="text-sm text-mutedText mt-1">List view opened from Time Off ▼ → Requests</p>
              </div>
            </div>
          </div>

          <div className="p-8 flex-1 flex flex-col max-w-6xl mx-auto w-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-mutedText" size={16} />
                <input 
                  type="text" 
                  placeholder="Search requests..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-border rounded-full focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all text-sm text-navy placeholder:text-mutedText shadow-sm"
                />
              </div>
              
              <button 
                onClick={() => setShowMyTeamOnly(!showMyTeamOnly)}
                className={`flex items-center gap-2 px-4 py-2 border rounded-full font-medium transition-colors text-sm shadow-sm ${
                  showMyTeamOnly 
                    ? 'border-brandAccent bg-brandAccent/5 text-brandAccent' 
                    : 'border-border bg-white text-navy hover:bg-surface'
                }`}
              >
                <Filter size={14} />
                <span>My Team</span>
              </button>
            </div>

            <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface text-xs uppercase tracking-wider text-mutedText font-semibold">
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Start</th>
                    <th className="px-6 py-4">End</th>
                    <th className="px-6 py-4">Duration</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 w-32"></th>
                  </tr>
                </thead>
                <tbody className="text-sm text-navy divide-y divide-border">
                  {filteredRequests.map((req) => (
                    <tr 
                      key={req.id}
                      onClick={() => handleOpenDetail(req.id)}
                      className="cursor-pointer transition-colors duration-200 hover:bg-surface/50 group"
                    >
                      <td className="px-6 py-4 font-medium group-hover:text-brandAccent transition-colors">{req.employeeName}</td>
                      <td className="px-6 py-4 text-slate">{req.timeOffType}</td>
                      <td className="px-6 py-4 text-slate">{req.start}</td>
                      <td className="px-6 py-4 text-slate">{req.end}</td>
                      <td className="px-6 py-4 text-slate">{req.duration}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center transition-colors duration-300 font-medium ${
                          req.status === 'Approved' 
                            ? 'text-success' 
                            : req.status === 'Refused'
                            ? 'text-error'
                            : 'text-amber-500'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {req.status === 'To Approve' ? (
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => handleInlineAction(e, req.id, 'Refused')}
                              className="p-1.5 border border-border text-error hover:bg-error/5 hover:border-error rounded-md transition-all active:scale-95 bg-white"
                              title="Refuse"
                            >
                              <X size={14} />
                            </button>
                            <button
                              onClick={(e) => handleInlineAction(e, req.id, 'Approved')}
                              className="p-1.5 bg-brandAccent text-white hover:bg-[#4a44cc] rounded-md transition-all active:scale-95 shadow-sm"
                              title="Approve"
                            >
                              <Check size={14} />
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {filteredRequests.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate">
                        No requests found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <p className="mt-4 text-sm text-mutedText text-center">
              Useful note: request status should show the approval lifecycle clearly.
            </p>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
