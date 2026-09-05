import { Router } from 'express';
import { healthRouter } from './health.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { schedulesRouter } from '../modules/schedules/schedules.routes.js';
import { departmentsRouter } from '../modules/departments/departments.routes.js';
import { employeesRouter } from '../modules/employees/employees.routes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/schedules', schedulesRouter);
apiRouter.use('/departments', departmentsRouter);
apiRouter.use('/employees', employeesRouter);
