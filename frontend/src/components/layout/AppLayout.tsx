import React from 'react';
import TopNav from './TopNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-navy font-sans flex flex-col">
      <TopNav />
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
}
