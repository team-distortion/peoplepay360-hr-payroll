import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Login from './pages/Login';

function CanvasFlow() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <header className="px-6 py-4 border-b border-border bg-surface">
        <h1 className="text-2xl font-display font-bold text-navy tracking-tight">PeoplePay360</h1>
      </header>
      
      <main className="p-8">
        <section className="mb-12">
          <h2 className="text-4xl font-display font-semibold mb-4 italic text-navy">Build dynamic financial flows</h2>
          <p className="text-slate max-w-2xl text-lg">
            A high-contrast, airy canvas designed to model robust billing and payment logic. 
          </p>
        </section>
        
        <div className="h-[600px] rounded-2xl border border-border bg-surface overflow-hidden shadow-sm">
          <ReactFlow 
            nodes={[{ id: '1', position: { x: 100, y: 100 }, data: { label: 'Start Flow' } }]} 
            edges={[]}
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/flow" element={<CanvasFlow />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
