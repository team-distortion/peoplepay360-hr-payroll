import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type {
  ApiResponse,
  DepartmentDto,
} from '@peoplepay360/shared';
import {
  DepartmentInputSchema,
  DepartmentQuerySchema,
} from '@peoplepay360/shared';
import * as departmentsService from './departments.service.js';
import { AppError } from '../../errors/app-error.js';

export const DepartmentIdParamSchema = z.object({
  id: z.string().uuid('Invalid department ID'),
});

export async function listDepartments(
  req: Request,
  res: Response<ApiResponse<DepartmentDto[]>>,
  next: NextFunction
): Promise<void> {
  try {
    const parseResult = DepartmentQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Validation failed',
        parseResult.error.format()
      );
    }

    const departments = await departmentsService.listDepartments(parseResult.data);
    res.status(200).json({
      data: departments,
      error: null,
    });
  } catch (error) {
    next(error);
  }
}

export async function createDepartment(
  req: Request,
  res: Response<ApiResponse<DepartmentDto>>,
  next: NextFunction
): Promise<void> {
  try {
    const bodyResult = DepartmentInputSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Validation failed',
        bodyResult.error.format()
      );
    }

    const created = await departmentsService.createDepartment(bodyResult.data);
    res.status(201).json({
      data: created,
      error: null,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateDepartment(
  req: Request,
  res: Response<ApiResponse<DepartmentDto>>,
  next: NextFunction
): Promise<void> {
  try {
    const paramResult = DepartmentIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Invalid department ID',
        paramResult.error.format()
      );
    }

    const bodyResult = DepartmentInputSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Validation failed',
        bodyResult.error.format()
      );
    }

    const updated = await departmentsService.updateDepartment(
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
