import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

import Login from './pages/Login';
import AdminUsers from './pages/AdminUsers';
import EmployeesPage from './pages/Employees';
import ContractsPage from './pages/Contracts';
import SchedulesPage from './pages/Schedules';
import AttendancePage from './pages/Attendance';
import AttendanceDetail from './pages/AttendanceDetail';
import TimeOffDashboard from './pages/time-off/TimeOffDashboard';
import TimeOffRequests from './pages/time-off/TimeOffRequests';
import TimeOffAllocations from './pages/time-off/TimeOffAllocations';
import TimeOffTypes from './pages/time-off/TimeOffTypes';
import PayrollPage from './pages/Payroll';

function CanvasFlow() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <header className="px-6 py-4 border-b border-border bg-surface">
        <h1 className="text-2xl font-display font-bold text-navy tracking-tight">PeoplePay360</h1>
      </header>

      <main className="p-8">
        <section className="mb-12">
          <h2 className="text-4xl font-display font-semibold mb-4 italic text-navy">
            Build dynamic financial flows
          </h2>
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
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/flow"
            element={
              <ProtectedRoute>
                <CanvasFlow />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/users"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AdminUsers />
              </ProtectedRoute>
            }
          />

          <Route
            path="/employees"
            element={
              <ProtectedRoute>
                <EmployeesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/contracts/*"
            element={
              <ProtectedRoute>
                <ContractsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/schedules/*"
            element={
              <ProtectedRoute>
                <SchedulesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/attendance"
            element={
              <ProtectedRoute>
                <AttendancePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/attendance/:id"
            element={
              <ProtectedRoute>
                <AttendanceDetail />
              </ProtectedRoute>
            }
          />

          <Route
            path="/time-off"
            element={
              <ProtectedRoute>
                <TimeOffDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/time-off/requests/*"
            element={
              <ProtectedRoute>
                <TimeOffRequests />
              </ProtectedRoute>
            }
          />

          <Route
            path="/time-off/allocations/*"
            element={
              <ProtectedRoute>
                <TimeOffAllocations />
              </ProtectedRoute>
            }
          />

          <Route
            path="/time-off/types/*"
            element={
              <ProtectedRoute>
                <TimeOffTypes />
              </ProtectedRoute>
            }
          />

          <Route
            path="/payroll/*"
            element={
              <ProtectedRoute>
                <PayrollPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/employees" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
