import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import * as contractController from './contract.controller.js';
import { AppError } from '../../errors/app-error.js';

export const contractsRouter = Router();

// All contract routes require authentication
contractsRouter.use(authenticate);

// List and Detail routes are accessible by all authenticated users (Employees scoped to own)
contractsRouter.get('/', contractController.listContracts);
contractsRouter.get('/selectors/salary-structures', contractController.getSalaryStructuresSelector);
contractsRouter.get('/:id', contractController.getContractById);

function authorizeContractWrite(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));
  }
  const allowed = ['HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN'];
  if (!allowed.includes(req.user.role)) {
    return next(new AppError(403, 'CONTRACT_ACCESS_DENIED', 'You do not have permission to perform this action'));
  }
  next();
}

contractsRouter.post('/', authorizeContractWrite, contractController.createContract);
contractsRouter.put('/:id', authorizeContractWrite, contractController.updateContract);
