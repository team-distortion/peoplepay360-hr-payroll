import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { mockAttendanceRecords } from './Attendance';
import { AttendanceRecord } from '../components/attendance/AttendanceListTable';
import { ArrowLeft, Edit2, Save, X } from 'lucide-react';

export default function AttendanceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [record, setRecord] = useState<AttendanceRecord | null>(null);

  useEffect(() => {
    if (id === 'new') {
      setIsEditing(true);
      setRecord({
        id: 'new',
        employeeName: '',
        date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-'),
        checkIn: '',
        checkOut: '',
        workedHours: 0,
        status: 'Present',
        department: '',
        manager: '',
        overtime: 0
      });
    } else {
      const found = mockAttendanceRecords.find(r => r.id === id);
      if (found) {
        setRecord(found);
      }
    }
  }, [id]);

  if (!record) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-slate">Record not found</div>
      </AppLayout>
    );
  }

  const handleSave = () => {
    // mock save
    setIsEditing(false);
  };

  return (
    <AppLayout>
      <div className="flex flex-col flex-1 bg-surface/30">
        <div className="px-6 py-6 border-b border-border bg-white flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => navigate('/attendance')} className="text-muted hover:text-navy transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-2xl font-bold text-navy">
                Attendance <span className="text-muted font-normal mx-1">/</span> {record.employeeName || 'New Record'} <span className="text-muted font-normal mx-1">/</span> {record.date}
              </h1>
            </div>
            <p className="text-slate text-sm ml-7">Form view of one attendance record</p>
          </div>
          <div>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-surface transition-colors"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-md text-sm font-medium transition-colors shadow-sm"
                >
                  <Save className="w-4 h-4" /> Save
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-surface transition-colors text-navy uppercase tracking-wide"
              >
                <Edit2 className="w-4 h-4" /> Edit
              </button>
            )}
          </div>
        </div>

        <div className="p-6 max-w-5xl mx-auto w-full animate-in fade-in duration-200">
          <div className="bg-white border border-border rounded-xl p-8 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              
              {/* Left Column */}
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">Employee</label>
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={record.employeeName} 
                      onChange={e => setRecord({...record, employeeName: e.target.value})}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors" 
                      placeholder="Select Employee..."
                    />
                  ) : (
                    <div className="text-navy font-medium text-lg">{record.employeeName || '—'}</div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">Check In</label>
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={record.checkIn || ''} 
                      onChange={e => setRecord({...record, checkIn: e.target.value})}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors" 
                      placeholder="HH:MM"
                    />
                  ) : (
                    <div className="text-navy">{record.checkIn ? `${record.date} ${record.checkIn}` : '—'}</div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">Check Out</label>
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={record.checkOut || ''} 
                      onChange={e => setRecord({...record, checkOut: e.target.value})}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors" 
                      placeholder="HH:MM"
                    />
                  ) : (
                    <div className="text-navy">{record.checkOut ? `${record.date} ${record.checkOut}` : '—'}</div>
                  )}
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">Worked Hours</label>
                  <div className="text-2xl font-bold text-navy tabular-nums transition-opacity duration-200">
                    {record.workedHours.toFixed(2)}
                  </div>
                  {isEditing && <p className="text-xs text-muted mt-1">System-computed from check in/out.</p>}
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">Department</label>
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={record.department} 
                      onChange={e => setRecord({...record, department: e.target.value})}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors" 
                    />
                  ) : (
                    <div className="text-navy">{record.department || '—'}</div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">Manager</label>
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={record.manager} 
                      onChange={e => setRecord({...record, manager: e.target.value})}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors" 
                    />
                  ) : (
                    <div className="text-navy">{record.manager || '—'}</div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">Status</label>
                  {isEditing ? (
                    <select 
                      value={record.status}
                      onChange={e => setRecord({...record, status: e.target.value as any})}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
                    >
                      <option value="Present">Present</option>
                      <option value="Absent">Absent</option>
                      <option value="Late">Late</option>
                      <option value="Half Day">Half Day</option>
                      <option value="On Leave">On Leave</option>
                    </select>
                  ) : (
                    <div className="text-navy font-medium">{record.status}</div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1.5">Overtime</label>
                  <div className="text-2xl font-bold text-accent tabular-nums transition-opacity duration-200">
                    {record.overtime.toFixed(2)} <span className="text-base font-medium text-slate">hrs</span>
                  </div>
                  {isEditing && <p className="text-xs text-muted mt-1">Computed against expected schedule.</p>}
                </div>
              </div>

            </div>

            {/* Notes Panel */}
            <div className="mt-10 p-4 border border-border rounded-lg bg-surface/50 text-sm text-slate flex items-start gap-3">
              <div className="w-1 h-5 bg-accent rounded-full shrink-0"></div>
              <p>System-generated from check in/out or manually corrected by an authorized user.</p>
            </div>
            
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
