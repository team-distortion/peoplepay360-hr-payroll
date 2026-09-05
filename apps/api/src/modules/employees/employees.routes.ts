import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import * as employeesController from './employees.controller.js';

export const employeesRouter = Router();

// All employees routes require authentication
employeesRouter.use(authenticate);

// Current employee profile endpoint (declared before /:id)
employeesRouter.get('/me', employeesController.getCurrentEmployee);

// Global listing (HR/Admin only)
employeesRouter.get(
  '/',
  authorize(
    Role.HR_MANAGER,
    Role.HR_PAYROLL_USER,
    Role.HR_PAYROLL_MANAGER,
    Role.ADMIN
  ),
  employeesController.listEmployees
);

// Create employee (HR/Admin only)
employeesRouter.post(
  '/',
  authorize(
    Role.HR_MANAGER,
    Role.HR_PAYROLL_USER,
    Role.HR_PAYROLL_MANAGER,
    Role.ADMIN
  ),
  employeesController.createEmployee
);

// Read employee detail by ID (service enforces record-level ownership for EMPLOYEE role)
employeesRouter.get('/:id', employeesController.getEmployeeById);

// Update employee (HR/Admin only)
employeesRouter.put(
  '/:id',
  authorize(
    Role.HR_MANAGER,
    Role.HR_PAYROLL_USER,
    Role.HR_PAYROLL_MANAGER,
    Role.ADMIN
  ),
  employeesController.updateEmployee
);

// Update employee status (HR/Admin only)
employeesRouter.patch(
  '/:id/status',
  authorize(
    Role.HR_MANAGER,
    Role.HR_PAYROLL_USER,
    Role.HR_PAYROLL_MANAGER,
    Role.ADMIN
  ),
  employeesController.updateEmployeeStatus
);
