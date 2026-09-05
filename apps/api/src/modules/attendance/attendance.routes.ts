import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { AppError } from '../../errors/app-error.js';
import { AttendanceController } from './attendance.controller.js';

export const attendanceRouter = Router();
const controller = new AttendanceController();

// All attendance endpoints require authentication
attendanceRouter.use(authenticate);

function authorizeAttendanceWrite(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));
  }
  const allowed = ['HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN'];
  if (!allowed.includes(req.user.role)) {
    return next(new AppError(403, 'ATTENDANCE_ACCESS_DENIED', 'You do not have permission to perform this action'));
  }
  next();
}

// 1. Static Self/Widget routes (Must be registered BEFORE /:id)
attendanceRouter.get('/me/today', controller.getToday);
attendanceRouter.post('/me/check-in', controller.checkIn);
attendanceRouter.post('/me/check-out', controller.checkOut);

// 2. Collection routes
attendanceRouter.get('/', controller.list);
attendanceRouter.post('/', authorizeAttendanceWrite, controller.createManual);

// 3. Item routes
attendanceRouter.get('/:id', controller.getById);
attendanceRouter.patch('/:id/correction', authorizeAttendanceWrite, controller.correct);
