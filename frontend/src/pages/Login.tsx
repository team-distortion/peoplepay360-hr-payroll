import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GradientCard } from '@/components/ui/GradientCard';
import { useAuth } from '@/context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/employees';
  const isValid = email.trim().length > 0 && password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isLoading) return;

    const loggedInUser = await login(email, password);
    if (loggedInUser) {
      if (loggedInUser.role === 'EMPLOYEE') {
        const dest = loggedInUser.employeeId
          ? `/employees/${loggedInUser.employeeId}`
          : '/employees/me';
        navigate(dest, { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col lg:flex-row">
      {/* Left Panel */}
      <div className="flex-1 flex flex-col justify-center p-8 lg:p-20 border-b lg:border-b-0 lg:border-r border-border">
        <div className="max-w-xl mx-auto w-full">
          <h1 className="text-4xl lg:text-5xl font-display font-bold text-[#635BFF] mb-8">
            PeoplePay360
          </h1>
          <p className="text-lg lg:text-xl text-slate mb-12">
            A complete solution for integrated HR and payroll operations management.
          </p>
          <ul className="space-y-4 text-slate">
            <li className="flex items-center gap-4">
              <div className="h-2 w-2 rounded-full border-2 border-slate flex-shrink-0"></div>
              <span>Manages employee profiles.</span>
            </li>
            <li className="flex items-center gap-4">
              <div className="h-2 w-2 rounded-full border-2 border-slate flex-shrink-0"></div>
              <span>Tracks daily attendance.</span>
            </li>
            <li className="flex items-center gap-4">
              <div className="h-2 w-2 rounded-full border-2 border-slate flex-shrink-0"></div>
              <span>Processes accurate payroll.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Right Panel (Login Form) */}
      <div className="flex-1 flex items-center justify-center p-4 lg:p-8">
        <GradientCard className="w-full max-w-[460px] overflow-hidden">
          {/* Header Band */}
          <div className="bg-surface border-b border-border px-4 py-3 relative z-30 flex items-center justify-between">
            <span className="text-sm font-medium text-mutedText">HR Portal</span>
            <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent font-semibold">
              Secure Session
            </span>
          </div>

          {/* Card Body */}
          <div className="p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-navy mb-1">Welcome back</h2>
              <p className="text-sm text-mutedText">Sign in to continue to your workspace</p>
            </div>

            {error && (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start justify-between">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={clearError}
                  className="text-red-500 hover:text-red-700 font-bold ml-2"
                >
                  ×
                </button>
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium text-mutedText mb-1.5">
                  Work Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    clearError();
                    setEmail(e.target.value);
                  }}
                  placeholder="name@company.com"
                  required
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg text-foreground placeholder:text-mutedText/50 focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-mutedText">
                    Password
                  </label>
                  <a href="#" className="text-sm text-accent hover:text-accent/80 font-medium">
                    Forgot password?
                  </a>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    clearError();
                    setPassword(e.target.value);
                  }}
                  placeholder="••••••••"
                  required
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg text-foreground placeholder:text-mutedText/50 focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={!isValid || isLoading}
                className="w-full h-11 mt-6 bg-accent text-accent-foreground font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-accent-foreground border-t-transparent rounded-full animate-spin"></div>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>

            <div className="mt-8">
              <hr className="border-border mb-6" />
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-mutedText">
                  Accounts are created by an administrator.
                </p>
              </div>
            </div>
          </div>
        </GradientCard>
      </div>
    </div>
  );
}
