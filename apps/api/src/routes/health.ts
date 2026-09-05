import { Router, Request, Response, NextFunction } from 'express';
import { ApiResponse, HealthStatus } from '@peoplepay360/shared';
import { checkDatabaseHealth } from '../services/health.service.js';
import { AppError } from '../errors/app-error.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response<ApiResponse<HealthStatus>>, next: NextFunction): Promise<void> => {
  try {
    const isDbHealthy = await checkDatabaseHealth();

    if (!isDbHealthy) {
      throw new AppError(503, 'DATABASE_UNAVAILABLE', 'Database is unavailable');
    }

    res.status(200).json({
      data: {
        status: 'ok',
        database: 'ok',
      },
      error: null,
    });
  } catch (error) {
    next(error);
  }
});
