import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import * as salaryStructuresController from './salary-structures.controller.js';
import * as salaryRulesController from './salary-rules.controller.js';

export const salaryStructuresRouter = Router();

salaryStructuresRouter.use(authenticate);

// Structure list
salaryStructuresRouter.get(
  '/',
  authorize(Role.HR_PAYROLL_USER, Role.HR_PAYROLL_MANAGER, Role.ADMIN),
  salaryStructuresController.listSalaryStructures
);

// Create structure
salaryStructuresRouter.post(
  '/',
  authorize(Role.HR_PAYROLL_MANAGER, Role.ADMIN),
  salaryStructuresController.createSalaryStructure
);

// Get structure detail
salaryStructuresRouter.get(
  '/:id',
  authorize(Role.HR_PAYROLL_USER, Role.HR_PAYROLL_MANAGER, Role.ADMIN),
  salaryStructuresController.getSalaryStructureById
);

// Update structure
salaryStructuresRouter.put(
  '/:id',
  authorize(Role.HR_PAYROLL_MANAGER, Role.ADMIN),
  salaryStructuresController.updateSalaryStructure
);

// Update structure status
salaryStructuresRouter.patch(
  '/:id/status',
  authorize(Role.HR_PAYROLL_MANAGER, Role.ADMIN),
  salaryStructuresController.updateSalaryStructureStatus
);

// Create rule for structure
salaryStructuresRouter.post(
  '/:structureId/rules',
  authorize(Role.HR_PAYROLL_MANAGER, Role.ADMIN),
  salaryRulesController.createRuleForStructure
);

// Atomic multi-rule configuration update for structure
salaryStructuresRouter.put(
  '/:structureId/rules/configuration',
  authorize(Role.HR_PAYROLL_MANAGER, Role.ADMIN),
  salaryRulesController.updateStructureRuleConfiguration
);
