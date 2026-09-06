import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { AppError } from '../../errors/app-error.js';
import type { Role } from '@prisma/client';
import {
  getEligibilityHandler,
  createPayrunHandler,
  listPayrunsHandler,
  getPayrunByIdHandler,
  discardDraftPayrunHandler,
  computePayrunHandler,
  recomputePayrunHandler,
  validatePayrunHandler,
  markPaidPayrunHandler,
} from './payrun.controller.js';
import {
  listPayslipsHandler,
  getPayslipByIdHandler,
  getPayslipPdfHandler,
  acknowledgeWarningHandler,
} from './payslip.controller.js';

export function authorizePayroll(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          403,
          'PAYROLL_ACCESS_DENIED',
          'You do not have permission to access payroll resources'
        )
      );
    }
    next();
  };
}

const PAYROLL_ROLES: Role[] = ['HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN'];
const MANAGER_ROLES: Role[] = ['HR_PAYROLL_MANAGER', 'ADMIN'];

export const payrollRouter = Router();

payrollRouter.use(authenticate);

// ── Payrun Wizard & Lifecycle ──────────────────────────────────────
payrollRouter.post(
  '/payruns/eligibility',
  authorizePayroll(...PAYROLL_ROLES),
  getEligibilityHandler
);

payrollRouter.post(
  '/payruns',
  authorizePayroll(...PAYROLL_ROLES),
  createPayrunHandler
);

payrollRouter.get(
  '/payruns',
  authorizePayroll(...PAYROLL_ROLES),
  listPayrunsHandler
);

payrollRouter.get(
  '/payruns/:id',
  authorizePayroll(...PAYROLL_ROLES),
  getPayrunByIdHandler
);

payrollRouter.delete(
  '/payruns/:id',
  authorizePayroll(...MANAGER_ROLES),
  discardDraftPayrunHandler
);

payrollRouter.post(
  '/payruns/:id/compute',
  authorizePayroll(...PAYROLL_ROLES),
  computePayrunHandler
);

payrollRouter.post(
  '/payruns/:id/recompute',
  authorizePayroll(...PAYROLL_ROLES),
  recomputePayrunHandler
);

payrollRouter.post(
  '/payruns/:id/validate',
  authorizePayroll(...PAYROLL_ROLES),
  validatePayrunHandler
);

payrollRouter.post(
  '/payruns/:id/mark-paid',
  authorizePayroll(...PAYROLL_ROLES),
  markPaidPayrunHandler
);

// ── Warning Actions ────────────────────────────────────────────────
payrollRouter.post(
  '/warnings/:id/acknowledge',
  authorizePayroll(...PAYROLL_ROLES),
  acknowledgeWarningHandler
);

// ── Payslips & PDFs ────────────────────────────────────────────────
payrollRouter.get(
  '/payslips',
  authorizePayroll(...PAYROLL_ROLES),
  listPayslipsHandler
);

payrollRouter.get(
  '/payslips/:id',
  authorizePayroll(...PAYROLL_ROLES),
  getPayslipByIdHandler
);

payrollRouter.get(
  '/payslips/:id/pdf',
  authorizePayroll(...PAYROLL_ROLES),
  getPayslipPdfHandler
);
