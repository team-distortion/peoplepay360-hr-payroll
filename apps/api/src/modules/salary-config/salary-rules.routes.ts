import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import * as salaryRulesController from './salary-rules.controller.js';

export const salaryRulesRouter = Router();

salaryRulesRouter.use(authenticate);

// Global rule list
salaryRulesRouter.get(
  '/',
  authorize(Role.HR_PAYROLL_USER, Role.HR_PAYROLL_MANAGER, Role.ADMIN),
  salaryRulesController.listSalaryRules
);

// Get rule by ID
salaryRulesRouter.get(
  '/:id',
  authorize(Role.HR_PAYROLL_USER, Role.HR_PAYROLL_MANAGER, Role.ADMIN),
  salaryRulesController.getSalaryRuleById
);

// Update rule
salaryRulesRouter.put(
  '/:id',
  authorize(Role.HR_PAYROLL_MANAGER, Role.ADMIN),
  salaryRulesController.updateSalaryRule
);

// Update rule status
salaryRulesRouter.patch(
  '/:id/status',
  authorize(Role.HR_PAYROLL_MANAGER, Role.ADMIN),
  salaryRulesController.updateSalaryRuleStatus
);
