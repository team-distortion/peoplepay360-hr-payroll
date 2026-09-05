import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminUsers from './pages/AdminUsers';
import EmployeesPage from './pages/Employees';
import EmployeeDetailPage from './pages/EmployeeDetail';
import ContractsPage from './pages/Contracts';
import SchedulesPage from './pages/Schedules';
import ScheduleForm from './pages/ScheduleForm';
import AttendancePage from './pages/Attendance';
import AttendanceDetail from './pages/AttendanceDetail';
import TimeOffDashboard from './pages/time-off/TimeOffDashboard';
import TimeOffRequests from './pages/time-off/TimeOffRequests';
import TimeOffAllocations from './pages/time-off/TimeOffAllocations';
import TimeOffTypes from './pages/time-off/TimeOffTypes';
import SalaryStructuresPage from './pages/payroll/SalaryStructures';
import SalaryStructureDetailPage from './pages/payroll/SalaryStructureDetail';
import SalaryRulesPage from './pages/payroll/SalaryRules';
import SalaryRuleDetailPage from './pages/payroll/SalaryRuleDetail';

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
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={['HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />

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
              <ProtectedRoute allowedRoles={['ADMIN', 'HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER']}>
                <EmployeesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/employees/new"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER']}>
                <EmployeeDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/employees/:id"
            element={
              <ProtectedRoute>
                <EmployeeDetailPage />
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
            path="/schedules"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER']}>
                <SchedulesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/schedules/new"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER']}>
                <ScheduleForm />
              </ProtectedRoute>
            }
          />

          <Route
            path="/schedules/:id"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER']}>
                <ScheduleForm />
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
            path="/payroll/structures"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER']}>
                <SalaryStructuresPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/payroll/structures/new"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'HR_PAYROLL_MANAGER']}>
                <SalaryStructureDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/payroll/structures/:id"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER']}>
                <SalaryStructureDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/payroll/rules"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER']}>
                <SalaryRulesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/payroll/rules/new"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'HR_PAYROLL_MANAGER']}>
                <SalaryRuleDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/payroll/rules/:id"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER']}>
                <SalaryRuleDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/payroll"
            element={<Navigate to="/payroll/structures" replace />}
          />

          <Route
            path="/payroll/*"
            element={<Navigate to="/payroll/structures" replace />}
          />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
