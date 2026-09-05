import React from 'react';
import AppLayout from '../../components/layout/AppLayout';
import { Calendar, Clock, CheckCircle, AlertCircle } from 'lucide-react';

export default function TimeOffDashboard() {
  return (
    <AppLayout>
      <div className="flex-1 flex flex-col bg-surface/30 p-8 animate-in fade-in duration-500">
        <div className="max-w-6xl mx-auto w-full">
          
          <div className="mb-10">
            <h1 className="text-3xl font-display font-bold text-navy tracking-tight">Time Off Dashboard</h1>
            <p className="text-slate mt-2 text-lg">Overview of pending requests and team balances.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {/* Stat Cards */}
            <div className="bg-white p-6 rounded-2xl border border-border shadow-sm flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shrink-0">
                <AlertCircle size={24} />
              </div>
              <div>
                <div className="text-3xl font-bold text-navy">12</div>
                <div className="text-sm font-medium text-slate">Pending Requests</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-border shadow-sm flex items-start gap-4">
              <div className="w-12 h-12 bg-brandAccent/10 text-brandAccent rounded-full flex items-center justify-center shrink-0">
                <CheckCircle size={24} />
              </div>
              <div>
                <div className="text-3xl font-bold text-navy">45</div>
                <div className="text-sm font-medium text-slate">Approved This Month</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-border shadow-sm flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                <Clock size={24} />
              </div>
              <div>
                <div className="text-3xl font-bold text-navy">8</div>
                <div className="text-sm font-medium text-slate">Pending Allocations</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-border shadow-sm flex items-start gap-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
                <Calendar size={24} />
              </div>
              <div>
                <div className="text-3xl font-bold text-navy">3</div>
                <div className="text-sm font-medium text-slate">On Leave Today</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-surface/50">
                <h3 className="font-semibold text-navy">Recent Requests to Approve</h3>
              </div>
              <div className="p-6 text-center text-slate">
                <p>Use the Time offs tab to review all pending requests.</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-surface/50">
                <h3 className="font-semibold text-navy">Team Balances Overview</h3>
              </div>
              <div className="p-6 text-center text-slate">
                <p>Use the Allocations tab to view detailed balances.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
