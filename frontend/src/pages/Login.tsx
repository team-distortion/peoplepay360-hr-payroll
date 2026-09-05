import { useState } from 'react';
import { GradientCard } from '@/components/ui/GradientCard';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const isValid = email.length > 0 && password.length > 0;

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
          <div className="bg-surface border-b border-border px-4 py-3 relative z-30">
            <span className="text-sm font-medium text-mutedText">HR Portal</span>
          </div>

          {/* Card Body */}
          <div className="p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-navy mb-1">Welcome back</h2>
              <p className="text-sm text-mutedText">Sign in to continue to your workspace</p>
            </div>

            <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
              <div>
                <label className="block text-sm font-medium text-mutedText mb-1.5">
                  Work Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
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
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg text-foreground placeholder:text-mutedText/50 focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={!isValid}
                className="w-full h-11 mt-6 bg-accent text-accent-foreground font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors"
              >
                Sign In
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
