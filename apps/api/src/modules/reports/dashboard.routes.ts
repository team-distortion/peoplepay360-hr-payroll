import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { AppError } from '../../errors/app-error.js';
import type { Role } from '@prisma/client';
import {
  getDashboardFiltersHandler,
  getDashboardHrHandler,
  getDashboardPayrollHandler,
} from './dashboard.controller.js';

export function authorizeDashboard(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          403,
          'DASHBOARD_ACCESS_DENIED',
          'You do not have permission to access this dashboard resource'
        )
      );
    }
    next();
  };
}

const ORG_DASHBOARD_ROLES: Role[] = [
  'HR_MANAGER',
  'HR_PAYROLL_USER',
  'HR_PAYROLL_MANAGER',
  'ADMIN',
];

const PAYROLL_DASHBOARD_ROLES: Role[] = [
  'HR_PAYROLL_USER',
  'HR_PAYROLL_MANAGER',
  'ADMIN',
];

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

dashboardRouter.get(
  '/filters',
  authorizeDashboard(...ORG_DASHBOARD_ROLES),
  getDashboardFiltersHandler
);

dashboardRouter.get(
  '/hr',
  authorizeDashboard(...ORG_DASHBOARD_ROLES),
  getDashboardHrHandler
);

dashboardRouter.get(
  '/payroll',
  authorizeDashboard(...PAYROLL_DASHBOARD_ROLES),
  getDashboardPayrollHandler
);
