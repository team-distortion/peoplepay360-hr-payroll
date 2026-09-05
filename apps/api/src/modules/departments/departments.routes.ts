import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import * as departmentsController from './departments.controller.js';

export const departmentsRouter = Router();

departmentsRouter.use(
  authenticate,
  authorize(
    Role.HR_MANAGER,
    Role.HR_PAYROLL_USER,
    Role.HR_PAYROLL_MANAGER,
    Role.ADMIN
  )
);

departmentsRouter.get('/', departmentsController.listDepartments);
departmentsRouter.post('/', departmentsController.createDepartment);
departmentsRouter.put('/:id', departmentsController.updateDepartment);
