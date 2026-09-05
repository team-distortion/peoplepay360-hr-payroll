import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import * as schedulesController from './schedules.controller.js';

export const schedulesRouter = Router();

// Enforce authentication and role permissions across all schedules routes
schedulesRouter.use(
  authenticate,
  authorize(
    Role.HR_MANAGER,
    Role.HR_PAYROLL_USER,
    Role.HR_PAYROLL_MANAGER,
    Role.ADMIN
  )
);

schedulesRouter.get('/', schedulesController.listSchedules);
schedulesRouter.post('/', schedulesController.createSchedule);
schedulesRouter.get('/:id', schedulesController.getScheduleById);
schedulesRouter.put('/:id', schedulesController.updateSchedule);
schedulesRouter.patch('/:id/status', schedulesController.updateScheduleStatus);
