import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';

import {
  MOCK_RULES,
  MOCK_STRUCTURES,
  type SalaryRule,
  type SalaryStructure,
} from '../components/payroll/mockData';

import PayrunList from '../components/payroll/PayrunList';
import NewPayrunWizard from '../components/payroll/NewPayrunWizard';
import PayrunDetail from '../components/payroll/PayrunDetail';
import PayslipList from '../components/payroll/PayslipList';
import PayslipDetail from '../components/payroll/PayslipDetail';
import StructuresList from '../components/payroll/StructuresList';
import StructureForm from '../components/payroll/StructureForm';
import RulesList from '../components/payroll/RulesList';
import RuleForm from '../components/payroll/RuleForm';

export default function PayrollPage() {
  const [rules, setRules] = useState<SalaryRule[]>(MOCK_RULES);
  const [structures, setStructures] = useState<SalaryStructure[]>(MOCK_STRUCTURES);

  // ── Structure Handlers ─────────────────────────────────────────
  const handleSaveStructure = (saved: SalaryStructure) => {
    setStructures(prev => {
      const idx = prev.findIndex(s => s.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
  };

  const handleDeleteStructure = (id: string) => {
    setStructures(prev => prev.filter(s => s.id !== id));
  };

  // ── Rule Handlers ──────────────────────────────────────────────
  const handleSaveRule = (saved: SalaryRule) => {
    setRules(prev => {
      const idx = prev.findIndex(r => r.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
  };

  const handleDeleteRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
  };

  return (
    <AppLayout>
      <Routes>
        <Route path="payruns" element={<PayrunList />} />
        <Route path="payruns/new" element={<NewPayrunWizard />} />
        <Route path="payruns/:id" element={<PayrunDetail />} />
        <Route path="payslips" element={<PayslipList />} />
        <Route path="payslips/:id" element={<PayslipDetail />} />

        <Route path="structures" element={<StructuresList structures={structures} />} />
        <Route
          path="structures/:id"
          element={
            <StructureForm
              structures={structures}
              allRules={rules}
              onSave={handleSaveStructure}
              onDelete={handleDeleteStructure}
            />
          }
        />

        <Route path="rules" element={<RulesList rules={rules} structures={structures} />} />
        <Route
          path="rules/:id"
          element={
            <RuleForm
              rules={rules}
              structures={structures}
              onSave={handleSaveRule}
              onDelete={handleDeleteRule}
            />
          }
        />

        <Route path="" element={<Navigate to="payruns" replace />} />
        <Route path="*" element={<Navigate to="payruns" replace />} />
      </Routes>
    </AppLayout>
  );
}
