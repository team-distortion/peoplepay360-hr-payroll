import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Employee } from '../../pages/Employees';

interface EmployeeProfileProps {
  employee: Employee | null; // null indicates Create Mode
  onClose: () => void;
}

export default function EmployeeProfile({ employee, onClose }: EmployeeProfileProps) {
  const [isEditMode, setIsEditMode] = useState(!employee);
  const [activeTab, setActiveTab] = useState<'work' | 'private'>('work');
  
  // Using local state for the form, initialized from the employee if editing
  const [formData, setFormData] = useState({
    name: employee?.name || '',
    jobTitle: employee?.jobTitle || '',
    department: employee?.department || '',
    email: employee?.email || '',
    phone: employee?.phone || '',
    manager: employee?.manager || '',
    workLocation: employee?.workLocation || '',
    schedule: employee?.schedule || '',
    status: employee?.status || 'Active',
    company: employee?.company || 'OXP Pvt Ltd',
  });

  const isCreateMode = !employee;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="flex-1 overflow-y-auto animate-in fade-in duration-200">
      {/* Header */}
      <div className="px-8 py-6 border-b border-border bg-white sticky top-0 z-10 flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate mb-1">
              <button onClick={onClose} className="hover:text-navy transition-colors">
                Employee
              </button>
              <span>/</span>
              <span className="font-medium text-navy">{isCreateMode ? 'New Employee' : employee.name}</span>
            </div>
            <p className="text-xs text-mutedText">Main employee form with related HR actions</p>
          </div>
        </div>

        {/* Action Row */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex gap-2">
            {!isEditMode ? (
              <button
                onClick={() => setIsEditMode(true)}
                className="px-4 py-1.5 border border-border text-navy text-sm font-medium rounded-md hover:bg-surface transition-colors"
              >
                EDIT
              </button>
            ) : (
              <div className="flex gap-2 animate-in fade-in slide-in-from-left-2">
                <button
                  onClick={() => {
                    // Logic to save goes here
                    setIsEditMode(false);
                    if (isCreateMode) onClose();
                  }}
                  className="px-4 py-1.5 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent/90 transition-colors"
                >
                  SAVE
                </button>
                <button
                  onClick={() => {
                    if (isCreateMode) onClose();
                    else setIsEditMode(false);
                  }}
                  className="px-4 py-1.5 border border-border text-navy text-sm font-medium rounded-md hover:bg-surface transition-colors"
                >
                  DISCARD
                </button>
              </div>
            )}
          </div>

          {!isCreateMode && (
            <div className="flex items-center gap-2">
              <button className="px-3 py-1 bg-surface text-navy text-xs font-medium rounded-full hover:bg-surface/80 transition-colors border border-border shadow-sm">
                Time Off <span className="text-mutedText ml-1">3</span>
              </button>
              <Link to={`/contracts?employee=${encodeURIComponent(employee.name)}`} className="px-3 py-1 bg-surface text-navy text-xs font-medium rounded-full hover:bg-surface/80 transition-colors border border-border shadow-sm flex items-center gap-1">
                Contracts <span className="text-mutedText ml-1">2</span>
              </Link>
              <button className="px-3 py-1 bg-surface text-navy text-xs font-medium rounded-full hover:bg-surface/80 transition-colors border border-border shadow-sm">
                Attendance <span className="text-mutedText ml-1">14</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-8">
        {/* Identity Block */}
        <div className="flex items-start gap-6 mb-8">
          <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center text-accent font-medium text-2xl flex-shrink-0">
            {isCreateMode ? '+' : employee.name.split(' ').map((n) => n[0]).join('')}
          </div>
          
          <div className="flex-1 mt-1">
            {isEditMode ? (
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Employee Name"
                className="text-3xl font-display font-bold text-navy w-full border-b border-border border-dashed focus:outline-none focus:border-accent bg-transparent pb-1 mb-2 placeholder:text-mutedText animate-in fade-in duration-150"
              />
            ) : (
              <h2 className="text-3xl font-display font-bold text-navy mb-2">{employee.name}</h2>
            )}

            <div className="flex items-center gap-2 text-slate text-sm mb-1">
              {isEditMode ? (
                <>
                  <input name="jobTitle" value={formData.jobTitle} onChange={handleChange} placeholder="Job Title" className="border-b border-border border-dashed focus:outline-none focus:border-accent bg-transparent w-32" />
                  <span>•</span>
                  <input name="department" value={formData.department} onChange={handleChange} placeholder="Department" className="border-b border-border border-dashed focus:outline-none focus:border-accent bg-transparent w-32" />
                </>
              ) : (
                <>
                  <span>{employee.jobTitle}</span>
                  <span>•</span>
                  <span>{employee.department}</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 text-mutedText text-sm">
              {isEditMode ? (
                <>
                  <input name="email" value={formData.email} onChange={handleChange} placeholder="Email" className="border-b border-border border-dashed focus:outline-none focus:border-accent bg-transparent w-40" />
                  <span>|</span>
                  <input name="phone" value={formData.phone} onChange={handleChange} placeholder="Phone" className="border-b border-border border-dashed focus:outline-none focus:border-accent bg-transparent w-32" />
                </>
              ) : (
                <>
                  <span>{employee.email}</span>
                  <span>|</span>
                  <span>{employee.phone}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border flex gap-6 mb-6">
          <button
            onClick={() => setActiveTab('work')}
            className={`pb-2 text-sm font-medium transition-colors relative ${
              activeTab === 'work' ? 'text-navy' : 'text-slate hover:text-navy'
            }`}
          >
            Work Information
            {activeTab === 'work' && (
              <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-accent rounded-t-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('private')}
            className={`pb-2 text-sm font-medium transition-colors relative ${
              activeTab === 'private' ? 'text-navy' : 'text-slate hover:text-navy'
            }`}
          >
            Private Information
            {activeTab === 'private' && (
              <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-accent rounded-t-full" />
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="grid grid-cols-2 gap-x-12 gap-y-6 relative animate-in fade-in duration-150">
          {activeTab === 'work' ? (
            <>
              <Field label="Department" name="department" value={formData.department} isEditMode={isEditMode} onChange={handleChange} />
              <Field label="Job Position" name="jobTitle" value={formData.jobTitle} isEditMode={isEditMode} onChange={handleChange} />
              <Field label="Manager" name="manager" value={formData.manager} isEditMode={isEditMode} onChange={handleChange} />
              <Field label="Work Location" name="workLocation" value={formData.workLocation} isEditMode={isEditMode} onChange={handleChange} />
              <Field label="Working Schedule" name="schedule" value={formData.schedule} isEditMode={isEditMode} onChange={handleChange} />
              <Field label="Status" name="status" value={formData.status} isEditMode={isEditMode} onChange={handleChange} />
              <Field label="Company" name="company" value={formData.company} isEditMode={isEditMode} onChange={handleChange} />
              <Field label="Work Email" name="email" value={formData.email} isEditMode={isEditMode} onChange={handleChange} />
            </>
          ) : (
            <>
              <Field label="Personal Address" name="address" value="Mock Address, City" isEditMode={isEditMode} onChange={() => {}} />
              <Field label="Personal Email" name="personalEmail" value="mock@example.com" isEditMode={isEditMode} onChange={() => {}} />
              <Field label="Phone" name="phone" value={formData.phone} isEditMode={isEditMode} onChange={handleChange} />
              <Field label="Emergency Contact" name="emergency" value="Sara Doe" isEditMode={isEditMode} onChange={() => {}} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, name, value, isEditMode, onChange }: { label: string, name: string, value: string, isEditMode: boolean, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-mutedText uppercase tracking-wider">{label}</label>
      {isEditMode ? (
        <input
          type="text"
          name={name}
          value={value}
          onChange={onChange}
          className="text-sm text-navy px-2 py-1.5 border border-border rounded bg-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all animate-in fade-in"
        />
      ) : (
        <div className="text-sm text-navy py-1.5">{value || '—'}</div>
      )}
    </div>
  );
}
