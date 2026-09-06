import { Router, Request, Response, NextFunction } from 'express';
import type { Role } from '@prisma/client';
import { authenticate } from '../../middleware/authenticate.js';
import { AppError } from '../../errors/app-error.js';
import * as typeController from './time-off-type.controller.js';
import * as allocationController from './allocation.controller.js';
import * as requestController from './request.controller.js';
import { getTimeOffSummary } from './summary.service.js';
import { TimeOffSummaryQuerySchema } from './time-off.schemas.js';

export const timeOffRouter = Router();

const HR_ROLES: Role[] = [
  'ADMIN',
  'HR_MANAGER',
  'HR_PAYROLL_USER',
  'HR_PAYROLL_MANAGER',
];

function requireRoles(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, 'TIME_OFF_ACCESS_DENIED', 'You do not have permission to perform this action'));
    }
    next();
  };
}

// All time off routes require authentication
timeOffRouter.use(authenticate);

// Summary endpoint
timeOffRouter.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }
    const query = TimeOffSummaryQuerySchema.parse(req.query);
    const result = await getTimeOffSummary(query.employeeId, req.user);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

// Types routes
timeOffRouter.get('/types', typeController.listTimeOffTypes);
timeOffRouter.get('/types/:id', typeController.getTimeOffTypeById);
timeOffRouter.post('/types', requireRoles(...HR_ROLES), typeController.createTimeOffType);
timeOffRouter.put('/types/:id', requireRoles(...HR_ROLES), typeController.updateTimeOffType);
timeOffRouter.patch('/types/:id/status', requireRoles(...HR_ROLES), typeController.updateTimeOffTypeStatus);

// Allocations routes
timeOffRouter.get('/allocations', allocationController.listAllocations);
timeOffRouter.get('/allocations/:id', allocationController.getAllocationById);
timeOffRouter.post('/allocations', requireRoles(...HR_ROLES), allocationController.createAllocation);
timeOffRouter.put('/allocations/:id', requireRoles(...HR_ROLES), allocationController.updateAllocation);
timeOffRouter.post('/allocations/:id/approve', requireRoles(...HR_ROLES), allocationController.approveAllocation);
timeOffRouter.post('/allocations/:id/refuse', requireRoles(...HR_ROLES), allocationController.refuseAllocation);

// Requests routes
timeOffRouter.get('/requests', requestController.listRequests);
timeOffRouter.get('/requests/:id', requestController.getRequestById);
timeOffRouter.post('/requests', requestController.createRequest);
timeOffRouter.put('/requests/:id', requestController.updateRequest);
timeOffRouter.post('/requests/:id/approve', requireRoles(...HR_ROLES), requestController.approveRequest);
timeOffRouter.post('/requests/:id/refuse', requireRoles(...HR_ROLES), requestController.refuseRequest);
