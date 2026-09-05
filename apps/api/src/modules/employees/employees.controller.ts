import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type {
  ApiResponse,
  EmployeeDetailDto,
  EmployeeListResponse,
} from '@peoplepay360/shared';
import {
  EmployeeInputSchema,
  EmployeeQuerySchema,
  EmployeeStatusSchema,
} from '@peoplepay360/shared';
import * as employeesService from './employees.service.js';
import { AppError } from '../../errors/app-error.js';

export const EmployeeIdParamSchema = z.object({
  id: z.string().uuid('Invalid employee ID'),
});

export async function listEmployees(
  req: Request,
  res: Response<ApiResponse<EmployeeListResponse>>,
  next: NextFunction
): Promise<void> {
  try {
    const parseResult = EmployeeQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Validation failed',
        parseResult.error.format()
      );
    }

    const result = await employeesService.listEmployees(parseResult.data);
    res.status(200).json({
      data: result,
      error: null,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCurrentEmployee(
  req: Request,
  res: Response<ApiResponse<EmployeeDetailDto>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
    }

    const employee = await employeesService.getCurrentEmployee(req.user);
    res.status(200).json({
      data: employee,
      error: null,
    });
  } catch (error) {
    next(error);
  }
}

export async function getEmployeeById(
  req: Request,
  res: Response<ApiResponse<EmployeeDetailDto>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
    }

    const paramResult = EmployeeIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Invalid employee ID',
        paramResult.error.format()
      );
    }

    const employee = await employeesService.getEmployeeById(
      paramResult.data.id,
      req.user
    );
    res.status(200).json({
      data: employee,
      error: null,
    });
  } catch (error) {
    next(error);
  }
}

export async function createEmployee(
  req: Request,
  res: Response<ApiResponse<EmployeeDetailDto>>,
  next: NextFunction
): Promise<void> {
  try {
    const bodyResult = EmployeeInputSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Validation failed',
        bodyResult.error.format()
      );
    }

    const created = await employeesService.createEmployee(bodyResult.data);
    res.status(201).json({
      data: created,
      error: null,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateEmployee(
  req: Request,
  res: Response<ApiResponse<EmployeeDetailDto>>,
  next: NextFunction
): Promise<void> {
  try {
    const paramResult = EmployeeIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Invalid employee ID',
        paramResult.error.format()
      );
    }

    const bodyResult = EmployeeInputSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Validation failed',
        bodyResult.error.format()
      );
    }

    const updated = await employeesService.updateEmployee(
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

export async function updateEmployeeStatus(
  req: Request,
  res: Response<ApiResponse<EmployeeDetailDto>>,
  next: NextFunction
): Promise<void> {
  try {
    const paramResult = EmployeeIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Invalid employee ID',
        paramResult.error.format()
      );
    }

    const bodyResult = EmployeeStatusSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Validation failed',
        bodyResult.error.format()
      );
    }

    const updated = await employeesService.updateEmployeeStatus(
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
