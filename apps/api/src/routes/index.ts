import { Router } from 'express';
import { healthRouter } from './health.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { schedulesRouter } from '../modules/schedules/schedules.routes.js';
import { departmentsRouter } from '../modules/departments/departments.routes.js';
import { employeesRouter } from '../modules/employees/employees.routes.js';
import { contractsRouter } from '../modules/contracts/contract.routes.js';
import { salaryStructuresRouter } from '../modules/salary-config/salary-structures.routes.js';
import { salaryRulesRouter } from '../modules/salary-config/salary-rules.routes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/schedules', schedulesRouter);
apiRouter.use('/departments', departmentsRouter);
apiRouter.use('/employees', employeesRouter);
apiRouter.use('/contracts', contractsRouter);

const payrollRouter = Router();
payrollRouter.use('/structures', salaryStructuresRouter);
payrollRouter.use('/rules', salaryRulesRouter);
apiRouter.use('/payroll', payrollRouter);
