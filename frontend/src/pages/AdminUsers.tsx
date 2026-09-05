import React, { useState } from 'react';
import { Plus, Search, ChevronDown, Check } from 'lucide-react';

interface UserData {
  id: string;
  userName: string;
  employeeName: string;
  email: string;
  roles: string[];
  status: 'Active' | 'Inactive';
}

const DUMMY_USERS: UserData[] = [
  { id: '1', userName: 'Alice Smith', employeeName: 'Alice Smith', email: 'alice@company.com', roles: ['Admin'], status: 'Active' },
  { id: '2', userName: 'Bob Johnson', employeeName: 'Bob Johnson', email: 'bob@company.com', roles: ['Hr Payroll Admin'], status: 'Active' },
  { id: '3', userName: 'Charlie Davis', employeeName: 'Charlie Davis', email: 'charlie@company.com', roles: ['Hr Manager'], status: 'Inactive' },
  { id: '4', userName: 'Diana Prince', employeeName: 'Diana Prince', email: 'diana@company.com', roles: ['Employee'], status: 'Active' },
];

const ROLES = [
  'Employee',
  'Hr Manager',
  'Hr Payroll User',
  'Hr Payroll Admin',
  'Admin'
];

export default function AdminUsers() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [glowTrigger, setGlowTrigger] = useState(0);
  
  const selectedUser = DUMMY_USERS.find(u => u.id === selectedUserId) || null;
  const isEditing = !!selectedUser;

  // Form state
  const [formEmployee, setFormEmployee] = useState(selectedUser?.employeeName || '');
  const [formEmail, setFormEmail] = useState(selectedUser?.email || '');
  const [formRoles, setFormRoles] = useState<string[]>(selectedUser?.roles || ['Employee']);
  const [formStatus, setFormStatus] = useState<'Active'|'Inactive'>(selectedUser?.status || 'Active');

  // Update form when selection changes
  React.useEffect(() => {
    if (selectedUser) {
      setFormEmployee(selectedUser.employeeName);
      setFormEmail(selectedUser.email);
      setFormRoles(selectedUser.roles);
      setFormStatus(selectedUser.status);
    } else {
      setFormEmployee('');
      setFormEmail('');
      setFormRoles(['Employee']);
      setFormStatus('Active');
    }
  }, [selectedUser]);

  const handleNewUser = () => {
    setSelectedUserId(null);
    setGlowTrigger(prev => prev + 1);
  };

  const filteredUsers = DUMMY_USERS.filter(u => 
    u.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* 2. Page Header Bar */}
      <header className="px-8 py-6 bg-surface rounded-b-2xl border-b border-border mb-8 mx-4 animate-in fade-in slide-in-from-top-8 duration-500 ease-out">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-display font-bold text-navy">User Management</h1>
          <span className="px-3 py-1 text-xs font-semibold tracking-wide text-brandAccent border border-brandAccent rounded-full bg-white">
            ADMIN ONLY
          </span>
        </div>
      </header>

      <main className="px-8 flex-1 max-w-[1600px] w-full mx-auto">
        {/* 3. Toolbar */}
        <div className="flex items-center gap-4 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150 fill-mode-both ease-out">
          <button 
            onClick={handleNewUser}
            className="group flex items-center gap-2 px-4 py-2 bg-brandAccent hover:bg-[#4a44cc] text-white font-medium rounded-full transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus size={18} className="transition-transform duration-300 group-hover:rotate-90" />
            <span>New User</span>
          </button>
          
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-mutedText" size={18} />
            <input 
              type="text" 
              placeholder="Search users, employees or email..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-border rounded-full focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all text-sm text-navy placeholder:text-mutedText"
            />
          </div>

          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-border text-navy font-medium rounded-full hover:bg-surface transition-colors text-sm">
            <span>Role Filter</span>
            <ChevronDown size={16} className="text-mutedText" />
          </button>
        </div>

        {/* 1. Main content - two-column split */}
        <div className="flex gap-8 pb-12">
          {/* Left Column: User Table */}
          <div className="flex-1 flex flex-col min-w-0 animate-in fade-in slide-in-from-left-8 duration-700 delay-300 fill-mode-both ease-out">
            <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface text-xs uppercase tracking-wider text-mutedText font-semibold">
                    <th className="px-6 py-4 font-semibold">User</th>
                    <th className="px-6 py-4 font-semibold">Employee</th>
                    <th className="px-6 py-4 font-semibold">Work Email</th>
                    <th className="px-6 py-4 font-semibold">Role</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-navy divide-y divide-border">
                  {filteredUsers.map((user, idx) => {
                    const isSelected = selectedUserId === user.id;
                    return (
                      <tr 
                        key={user.id}
                        style={{ animationDelay: `${idx * 50 + 400}ms` }}
                        onClick={() => {
                          setSelectedUserId(user.id);
                          setGlowTrigger(prev => prev + 1);
                        }}
                        className={`cursor-pointer transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 fill-mode-both ${isSelected ? 'bg-accentSoft shadow-sm z-10 relative scale-[1.01]' : 'hover:bg-surface hover:scale-[1.01]'}`}
                      >
                        <td className="px-6 py-4 relative">
                          {isSelected && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-brandAccent" />
                          )}
                          <span className="font-medium">{user.userName}</span>
                        </td>
                        <td className="px-6 py-4">{user.employeeName}</td>
                        <td className="px-6 py-4 text-slate">{user.email}</td>
                        <td className="px-6 py-4">{user.roles.join(', ')}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            user.status === 'Active' 
                              ? 'border-success text-success bg-success/10' 
                              : 'border-mutedText text-mutedText bg-surface'
                          }`}>
                            {user.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-sm text-mutedText px-2">
              Select a user to edit access, or create a new user.
            </p>

            <div className="mt-auto pt-8 px-2">
              <p className="text-xs text-mutedText">
                User accounts are separate from Employee records, but should be linked to an employee for access and ownership.
              </p>
            </div>
          </div>

          {/* Right Column: Create / Edit User Form */}
          <div className="w-[400px] shrink-0 animate-in fade-in slide-in-from-right-8 duration-700 delay-500 fill-mode-both ease-out">
            <div 
              key={glowTrigger}
              className="bg-white border border-border rounded-2xl p-6 shadow-sm sticky top-8 animate-card-glow"
            >
              <div className="mb-6">
                <span className="text-xs font-semibold text-brandAccent uppercase tracking-wider mb-1 block">
                  {isEditing ? `Editing: ${selectedUser.userName}` : 'Open on New User'}
                </span>
                <h2 className="text-xl font-display font-bold text-navy">
                  Create / Edit User
                </h2>
              </div>

              <div className="space-y-6">
                {/* Employee Field */}
                <div>
                  <label className="block text-sm font-medium text-navy mb-2">
                    Employee <span className="text-error">*</span>
                  </label>
                  <div className="relative">
                    <select 
                      className="w-full appearance-none bg-white border border-border rounded-xl px-4 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all"
                      value={formEmployee}
                      onChange={(e) => setFormEmployee(e.target.value)}
                    >
                      <option value="" disabled>Select employee</option>
                      <option value="Alice Smith">Alice Smith</option>
                      <option value="Bob Johnson">Bob Johnson</option>
                      <option value="Charlie Davis">Charlie Davis</option>
                      <option value="Diana Prince">Diana Prince</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-mutedText pointer-events-none" />
                  </div>
                </div>

                {/* Work Email Field */}
                <div>
                  <label className="block text-sm font-medium text-navy mb-2">
                    Work Email <span className="text-error">*</span>
                  </label>
                  <input 
                    type="email" 
                    placeholder="employee@company.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full bg-white border border-border rounded-xl px-4 py-2.5 text-sm text-navy placeholder:text-mutedText focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all"
                  />
                </div>

                {/* Roles Field */}
                <div>
                  <label className="block text-sm font-medium text-navy mb-3">
                    Roles <span className="text-error">*</span>
                  </label>
                  <div className="space-y-3">
                    {ROLES.map((role) => {
                      const isSelected = formRoles.includes(role);
                      return (
                        <label 
                          key={role} 
                          className="flex items-center gap-3 cursor-pointer group"
                          onClick={(e) => {
                            e.preventDefault();
                            setFormRoles(prev => 
                              prev.includes(role) 
                                ? prev.filter(r => r !== role)
                                : [...prev, role]
                            );
                          }}
                        >
                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                            isSelected 
                              ? 'border-brandAccent bg-brandAccent' 
                              : 'border-border bg-white group-hover:border-brandAccent/50'
                          }`}>
                            {isSelected && <Check size={14} className="text-white" />}
                          </div>
                          <span className="text-sm text-navy">{role}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Account Status Field */}
                <div>
                  <label className="block text-sm font-medium text-navy mb-3">
                    Account Status
                  </label>
                  <button 
                    onClick={() => setFormStatus(prev => prev === 'Active' ? 'Inactive' : 'Active')}
                    className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      formStatus === 'Active'
                        ? 'border-success text-success bg-success/10 hover:bg-success/20'
                        : 'border-mutedText text-mutedText bg-surface hover:bg-border'
                    }`}
                  >
                    {formStatus}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button 
                className="w-full mt-8 bg-brandAccent hover:bg-brandAccent/90 text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 hover:shadow-lg hover:-translate-y-1 active:translate-y-0"
              >
                {isEditing ? 'Save Access' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
