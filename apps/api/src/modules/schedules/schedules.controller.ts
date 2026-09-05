import type { Request, Response, NextFunction } from 'express';
import type {
  ApiResponse,
  WorkingScheduleDto,
  WorkingScheduleListResponse,
} from '@peoplepay360/shared';
import {
  WorkingScheduleInputSchema,
  WorkingScheduleStatusSchema,
  WorkingScheduleQuerySchema,
  ScheduleIdParamSchema,
} from './schedules.schemas.js';
import * as schedulesService from './schedules.service.js';
import { AppError } from '../../errors/app-error.js';

export async function listSchedules(
  req: Request,
  res: Response<ApiResponse<WorkingScheduleListResponse>>,
  next: NextFunction
): Promise<void> {
  try {
    const parseResult = WorkingScheduleQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Validation failed',
        parseResult.error.format()
      );
    }

    const result = await schedulesService.listSchedules(parseResult.data);
    res.status(200).json({
      data: result,
      error: null,
    });
  } catch (error) {
    next(error);
  }
}

export async function getScheduleById(
  req: Request,
  res: Response<ApiResponse<WorkingScheduleDto>>,
  next: NextFunction
): Promise<void> {
  try {
    const paramResult = ScheduleIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Invalid schedule ID',
        paramResult.error.format()
      );
    }

    const schedule = await schedulesService.getScheduleById(paramResult.data.id);
    res.status(200).json({
      data: schedule,
      error: null,
    });
  } catch (error) {
    next(error);
  }
}

export async function createSchedule(
  req: Request,
  res: Response<ApiResponse<WorkingScheduleDto>>,
  next: NextFunction
): Promise<void> {
  try {
    const bodyResult = WorkingScheduleInputSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Validation failed',
        bodyResult.error.format()
      );
    }

    const created = await schedulesService.createSchedule(bodyResult.data);
    res.status(201).json({
      data: created,
      error: null,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateSchedule(
  req: Request,
  res: Response<ApiResponse<WorkingScheduleDto>>,
  next: NextFunction
): Promise<void> {
  try {
    const paramResult = ScheduleIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Invalid schedule ID',
        paramResult.error.format()
      );
    }

    const bodyResult = WorkingScheduleInputSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Validation failed',
        bodyResult.error.format()
      );
    }

    const updated = await schedulesService.updateSchedule(
      paramResult.data.id,
      bodyResult.data
    );
    res.status(200).json({
      data: updated,
      error: null,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateScheduleStatus(
  req: Request,
  res: Response<ApiResponse<WorkingScheduleDto>>,
  next: NextFunction
): Promise<void> {
  try {
    const paramResult = ScheduleIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Invalid schedule ID',
        paramResult.error.format()
      );
    }

    const bodyResult = WorkingScheduleStatusSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Validation failed',
        bodyResult.error.format()
      );
    }

    const updated = await schedulesService.updateScheduleStatus(
      paramResult.data.id,
      bodyResult.data.status
    );
    res.status(200).json({
      data: updated,
      error: null,
    });
  } catch (error) {
    next(error);
  }
}
