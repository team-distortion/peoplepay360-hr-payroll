import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, ChevronDown, ArrowLeft, Settings, X, Calendar as CalendarIcon, Clock, Briefcase } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';

interface DaySchedule {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  breakHours: number;
}

interface WorkingSchedule {
  id: string;
  name: string;
  company: string;
  timezone: string;
  status: 'Active' | 'Inactive';
  days: DaySchedule[];
}

const DUMMY_SCHEDULES: WorkingSchedule[] = [
  {
    id: 'SCH-001',
    name: '40 Hours / Week',
    company: 'My Company',
    timezone: 'UTC',
    status: 'Active',
    days: [
      { id: 'd1', day: 'Monday', startTime: '09:00', endTime: '18:00', breakHours: 1 },
      { id: 'd2', day: 'Tuesday', startTime: '09:00', endTime: '18:00', breakHours: 1 },
      { id: 'd3', day: 'Wednesday', startTime: '09:00', endTime: '18:00', breakHours: 1 },
      { id: 'd4', day: 'Thursday', startTime: '09:00', endTime: '18:00', breakHours: 1 },
      { id: 'd5', day: 'Friday', startTime: '09:00', endTime: '18:00', breakHours: 1 },
    ]
  },
  {
    id: 'SCH-002',
    name: 'Night Shift',
    company: 'My Company',
    timezone: 'UTC',
    status: 'Active',
    days: [
      { id: 'd1', day: 'Monday', startTime: '22:00', endTime: '06:00', breakHours: 0 },
      { id: 'd2', day: 'Tuesday', startTime: '22:00', endTime: '06:00', breakHours: 0 },
      { id: 'd3', day: 'Wednesday', startTime: '22:00', endTime: '06:00', breakHours: 0 },
      { id: 'd4', day: 'Thursday', startTime: '22:00', endTime: '06:00', breakHours: 0 },
      { id: 'd5', day: 'Friday', startTime: '22:00', endTime: '06:00', breakHours: 0 },
    ]
  },
  {
    id: 'SCH-003',
    name: 'Part-time 20h',
    company: 'My Company',
    timezone: 'UTC',
    status: 'Inactive',
    days: [
      { id: 'd1', day: 'Monday', startTime: '09:00', endTime: '14:00', breakHours: 0 },
      { id: 'd2', day: 'Tuesday', startTime: '09:00', endTime: '14:00', breakHours: 0 },
      { id: 'd3', day: 'Wednesday', startTime: '09:00', endTime: '14:00', breakHours: 0 },
      { id: 'd4', day: 'Thursday', startTime: '09:00', endTime: '14:00', breakHours: 0 },
    ]
  }
];

function calculateDayHours(day: DaySchedule): number {
  if (!day.startTime || !day.endTime) return 0;
  
  const parseTime = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h + (m || 0) / 60;
  };
  
  let start = parseTime(day.startTime);
  let end = parseTime(day.endTime);
  
  if (end < start) {
    end += 24; // Handle overnight shifts
  }
  
  const total = (end - start) - (day.breakHours || 0);
  return Math.max(0, total);
}

function calculateTotalHours(days: DaySchedule[]): number {
  return days.reduce((sum, day) => sum + calculateDayHours(day), 0);
}

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<WorkingSchedule[]>(DUMMY_SCHEDULES);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'List' | 'Calendar'>('List');

  // Form State
  const [formSchedule, setFormSchedule] = useState<WorkingSchedule | null>(null);

  const filteredSchedules = useMemo(() => {
    if (!searchQuery) return schedules;
    const lowerQ = searchQuery.toLowerCase();
    return schedules.filter(s => 
      s.name.toLowerCase().includes(lowerQ) ||
      s.company.toLowerCase().includes(lowerQ)
    );
  }, [schedules, searchQuery]);

  const handleOpenDetail = (id: string | null) => {
    if (id === null) {
      setFormSchedule({
        id: `SCH-NEW-${Date.now()}`,
        name: '',
        company: 'My Company',
        timezone: 'UTC',
        status: 'Active',
        days: []
      });
    } else {
      const schedule = schedules.find(s => s.id === id);
      if (schedule) setFormSchedule({ ...schedule, days: [...schedule.days.map(d => ({ ...d }))] });
    }
    setSelectedScheduleId(id);
  };

  const handleCloseDetail = () => {
    setSelectedScheduleId(undefined);
    setFormSchedule(null);
  };

  const handleSaveSchedule = () => {
    if (!formSchedule) return;
    
    if (selectedScheduleId === null) {
      setSchedules([...schedules, formSchedule]);
    } else {
      setSchedules(schedules.map(s => s.id === formSchedule.id ? formSchedule : s));
    }
    handleCloseDetail();
  };

  const addDayToForm = () => {
    if (!formSchedule) return;
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const nextDay = daysOfWeek[formSchedule.days.length % 7];
    
    setFormSchedule({
      ...formSchedule,
      days: [
        ...formSchedule.days, 
        { id: `d${Date.now()}`, day: nextDay, startTime: '09:00', endTime: '18:00', breakHours: 1 }
      ]
    });
  };

  const removeDayFromForm = (dayId: string) => {
    if (!formSchedule) return;
    setFormSchedule({
      ...formSchedule,
      days: formSchedule.days.filter(d => d.id !== dayId)
    });
  };

  const updateDayInForm = (dayId: string, field: keyof DaySchedule, value: string | number) => {
    if (!formSchedule) return;
    setFormSchedule({
      ...formSchedule,
      days: formSchedule.days.map(d => d.id === dayId ? { ...d, [field]: value } : d)
    });
  };

  return (
    <AppLayout>
      {selectedScheduleId !== undefined && formSchedule ? (
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
              <h2 className="text-2xl font-display font-bold text-navy">
                {formSchedule.name || 'New Schedule'}
              </h2>
              <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${formSchedule.status === 'Active' ? 'border-success text-success bg-success/10' : 'border-mutedText text-mutedText bg-surface'}`}>
                {formSchedule.status}
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={handleCloseDetail}
                className="px-4 py-2 text-sm font-medium text-slate hover:text-navy transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveSchedule}
                className="px-6 py-2 bg-brandAccent hover:bg-[#4a44cc] text-white text-sm font-medium rounded-full transition-all shadow-sm hover:shadow-md"
              >
                Save Schedule
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-8">
            <div className="max-w-5xl mx-auto space-y-8">
              
              {/* Top Field Group */}
              <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-navy uppercase tracking-wider mb-6 flex items-center gap-2">
                  <Briefcase size={16} className="text-mutedText" />
                  General Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-navy mb-2">Schedule Name</label>
                    <input 
                      type="text" 
                      value={formSchedule.name}
                      onChange={(e) => setFormSchedule({...formSchedule, name: e.target.value})}
                      placeholder="e.g. 40 Hours / Week"
                      className="w-full bg-white border border-border rounded-xl px-4 py-2 text-sm text-navy placeholder:text-mutedText focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-navy mb-2">Company</label>
                    <input 
                      type="text" 
                      value={formSchedule.company}
                      onChange={(e) => setFormSchedule({...formSchedule, company: e.target.value})}
                      className="w-full bg-white border border-border rounded-xl px-4 py-2 text-sm text-navy placeholder:text-mutedText focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-navy mb-2">Timezone</label>
                    <select
                      value={formSchedule.timezone}
                      onChange={(e) => setFormSchedule({...formSchedule, timezone: e.target.value})}
                      className="w-full bg-white border border-border rounded-xl px-4 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all appearance-none"
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">America/New_York</option>
                      <option value="Europe/London">Europe/London</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Weekly Schedule Grid */}
              <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm flex flex-col">
                <div className="p-6 border-b border-border flex items-center justify-between bg-surface/50">
                  <h3 className="text-sm font-semibold text-navy uppercase tracking-wider flex items-center gap-2">
                    <CalendarIcon size={16} className="text-mutedText" />
                    Weekly Schedule
                  </h3>
                  <button 
                    onClick={addDayToForm}
                    className="group flex items-center gap-1.5 px-3 py-1.5 bg-white border border-border text-navy text-sm font-medium rounded-full hover:bg-surface transition-colors shadow-sm"
                  >
                    <Plus size={14} className="transition-transform duration-300 group-hover:rotate-90" /> Add Day
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="border-b border-border bg-white text-xs uppercase tracking-wider text-mutedText font-semibold">
                        <th className="px-6 py-3 w-40">Day</th>
                        <th className="px-6 py-3">Start Time</th>
                        <th className="px-6 py-3">End Time</th>
                        <th className="px-6 py-3">Break (hrs)</th>
                        <th className="px-6 py-3">Hours</th>
                        <th className="px-4 py-3 w-16 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="text-sm text-navy divide-y divide-border">
                      {formSchedule.days.map((day, idx) => {
                        const dayHours = calculateDayHours(day);
                        return (
                          <tr key={day.id} className="hover:bg-surface/30 transition-colors group">
                            <td className="px-6 py-3">
                              <select
                                value={day.day}
                                onChange={(e) => updateDayInForm(day.id, 'day', e.target.value)}
                                className="w-full bg-transparent border-0 focus:ring-0 text-sm font-medium text-navy p-0 cursor-pointer"
                              >
                                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => (
                                  <option key={d} value={d}>{d}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-6 py-3">
                              <input 
                                type="time"
                                value={day.startTime}
                                onChange={(e) => updateDayInForm(day.id, 'startTime', e.target.value)}
                                className="bg-transparent border border-transparent hover:border-border focus:border-brandAccent rounded px-2 py-1 focus:outline-none transition-colors"
                              />
                            </td>
                            <td className="px-6 py-3">
                              <input 
                                type="time"
                                value={day.endTime}
                                onChange={(e) => updateDayInForm(day.id, 'endTime', e.target.value)}
                                className="bg-transparent border border-transparent hover:border-border focus:border-brandAccent rounded px-2 py-1 focus:outline-none transition-colors"
                              />
                            </td>
                            <td className="px-6 py-3">
                              <input 
                                type="number"
                                min="0"
                                step="0.5"
                                value={day.breakHours}
                                onChange={(e) => updateDayInForm(day.id, 'breakHours', parseFloat(e.target.value) || 0)}
                                className="w-16 bg-transparent border border-transparent hover:border-border focus:border-brandAccent rounded px-2 py-1 focus:outline-none transition-colors"
                              />
                            </td>
                            <td className="px-6 py-3 font-medium text-slate">
                              {dayHours.toFixed(1)}h
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button 
                                onClick={() => removeDayFromForm(day.id)}
                                className="p-1.5 text-mutedText hover:text-error hover:bg-error/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <X size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {formSchedule.days.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-mutedText">
                            No days added to this schedule. Click "Add Day" to begin.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="p-6 bg-surface/30 border-t border-border flex justify-between items-center">
                  <div className="flex gap-4">
                    <div className="flex flex-col">
                      <span className="text-xs text-mutedText uppercase font-semibold tracking-wider">Days per week</span>
                      <span className="text-lg font-medium text-navy">{formSchedule.days.length}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-xl border border-border shadow-sm">
                    <Clock className="text-brandAccent" size={20} />
                    <span className="text-sm font-medium text-navy">Total Weekly Hours:</span>
                    <span className="text-xl font-bold text-navy">{calculateTotalHours(formSchedule.days).toFixed(1)}h</span>
                  </div>
                </div>
              </div>
              
              <p className="text-sm text-mutedText text-center pb-8 flex items-center justify-center gap-2">
                <Briefcase size={14} />
                Use this schedule as the employee/contract working pattern.
              </p>

            </div>
          </div>
        </div>
      ) : (
        // LIST VIEW
        <div className="flex-1 flex flex-col bg-surface/30 animate-in fade-in duration-700 ease-out">
          {/* Header Row */}
          <div className="px-8 py-6 bg-white border-b border-border flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => handleOpenDetail(null)}
                className="group flex items-center gap-2 px-4 py-2 bg-brandAccent hover:bg-[#4a44cc] text-white font-medium rounded-full transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
              >
                <Plus size={16} className="transition-transform duration-300 group-hover:rotate-90" />
                <span>New Schedule</span>
              </button>
              <h1 className="text-3xl font-display font-bold text-navy tracking-tight">Working Schedules</h1>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-6 mt-2">
              <button 
                onClick={() => setActiveTab('List')}
                className={`text-sm font-medium pb-2 border-b-2 transition-colors ${activeTab === 'List' ? 'border-brandAccent text-navy' : 'border-transparent text-slate hover:text-navy'}`}
              >
                List
              </button>
              <button 
                onClick={() => setActiveTab('Calendar')}
                className={`text-sm font-medium pb-2 border-b-2 transition-colors ${activeTab === 'Calendar' ? 'border-brandAccent text-navy' : 'border-transparent text-slate hover:text-navy'}`}
              >
                Calendar
              </button>
            </div>
          </div>

          <div className="p-8 flex-1 flex flex-col max-w-[1600px] w-full mx-auto">
            {activeTab === 'List' ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col flex-1">
                {/* Toolbar */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="relative w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-mutedText" size={16} />
                    <input 
                      type="text" 
                      placeholder="Search schedules..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-border rounded-full focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all text-sm text-navy placeholder:text-mutedText shadow-sm"
                    />
                  </div>
                  <button className="flex items-center gap-2 px-4 py-2 bg-white border border-border text-navy font-medium rounded-full hover:bg-surface transition-colors text-sm shadow-sm">
                    <span>Filter</span>
                    <ChevronDown size={14} className="text-mutedText" />
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 bg-white border border-border text-navy font-medium rounded-full hover:bg-surface transition-colors text-sm shadow-sm ml-auto">
                    <Settings size={14} className="text-mutedText" />
                    <span>Columns</span>
                  </button>
                </div>

                {/* Table */}
                <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm flex-1">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-surface text-xs uppercase tracking-wider text-mutedText font-semibold">
                        <th className="px-6 py-4 font-semibold">Schedule Name</th>
                        <th className="px-6 py-4 font-semibold">Days / Week</th>
                        <th className="px-6 py-4 font-semibold">Hours / Week</th>
                        <th className="px-6 py-4 font-semibold">Company</th>
                        <th className="px-6 py-4 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm text-navy divide-y divide-border">
                      {filteredSchedules.map((schedule, idx) => (
                        <tr 
                          key={schedule.id}
                          onClick={() => handleOpenDetail(schedule.id)}
                          className="cursor-pointer transition-all duration-200 hover:bg-surface/50 group"
                        >
                          <td className="px-6 py-4 font-medium group-hover:text-brandAccent transition-colors relative">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-brandAccent opacity-0 group-hover:opacity-100 transition-opacity" />
                            {schedule.name}
                          </td>
                          <td className="px-6 py-4 text-slate">{schedule.days.length}</td>
                          <td className="px-6 py-4 text-slate font-medium">{calculateTotalHours(schedule.days).toFixed(1)}h</td>
                          <td className="px-6 py-4 text-slate">{schedule.company}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                              schedule.status === 'Active' 
                                ? 'border-success text-success bg-success/10' 
                                : 'border-mutedText text-mutedText bg-surface'
                            }`}>
                              {schedule.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {filteredSchedules.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate">
                            No schedules found matching your search.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                
                <p className="mt-4 text-sm text-mutedText text-center">
                  Select a schedule to open its Form view.
                </p>
              </div>
            ) : (
              // CALENDAR VIEW (Scaffold)
              <div className="flex-1 flex flex-col items-center justify-center bg-white border border-border rounded-2xl shadow-sm p-12 text-center animate-in fade-in duration-500">
                <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mb-4 text-brandAccent">
                  <CalendarIcon size={32} />
                </div>
                <h3 className="text-xl font-display font-semibold text-navy mb-2">Calendar View</h3>
                <p className="text-slate max-w-md">
                  This view will provide a timeline/calendar visualization of all schedules across the organization.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
