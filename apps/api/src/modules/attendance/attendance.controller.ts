import type { Request, Response, NextFunction } from 'express';
import {
  ManualAttendanceInputSchema,
  AttendanceCorrectionInputSchema,
  AttendanceListQuerySchema,
} from '@peoplepay360/shared';
import { AppError } from '../../errors/app-error.js';
import { AttendanceService } from './attendance.service.js';

export class AttendanceController {
  constructor(private readonly service: AttendanceService = new AttendanceService()) {}

  getToday = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getAttendanceTodayForEmployee(req.user!);
      res.status(200).json({ data: result, error: null });
    } catch (err) {
      next(err);
    }
  };

  checkIn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.body && Object.keys(req.body).length > 0) {
        throw new AppError(400, 'INVALID_ATTENDANCE_INPUT', 'Check-in does not accept a request body');
      }
      const result = await this.service.checkIn(req.user!);
      res.status(201).json({ data: result, error: null });
    } catch (err) {
      next(err);
    }
  };

  checkOut = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.body && Object.keys(req.body).length > 0) {
        throw new AppError(400, 'INVALID_ATTENDANCE_INPUT', 'Check-out does not accept a request body');
      }
      const result = await this.service.checkOut(req.user!);
      res.status(200).json({ data: result, error: null });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = AttendanceListQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new AppError(
          400,
          'INVALID_ATTENDANCE_INPUT',
          'Invalid attendance query parameters',
          parsed.error.format()
        );
      }
      const result = await this.service.listAttendance(req.user!, parsed.data);
      res.status(200).json({ data: result, error: null });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getAttendanceById(req.user!, req.params.id as string);
      res.status(200).json({ data: result, error: null });
    } catch (err) {
      next(err);
    }
  };

  createManual = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = ManualAttendanceInputSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(
          400,
          'INVALID_ATTENDANCE_INPUT',
          'Invalid manual attendance input',
          parsed.error.format()
        );
      }
      const result = await this.service.createManualAttendance(req.user!, parsed.data);
      res.status(201).json({ data: result, error: null });
    } catch (err) {
      next(err);
    }
  };

  correct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = AttendanceCorrectionInputSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(
          400,
          'INVALID_ATTENDANCE_INPUT',
          'Invalid attendance correction input',
          parsed.error.format()
        );
      }
      const result = await this.service.correctAttendance(req.user!, req.params.id as string, parsed.data);
      res.status(200).json({ data: result, error: null });
    } catch (err) {
      next(err);
    }
  };
}
