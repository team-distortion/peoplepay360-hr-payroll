import type { Request, Response, NextFunction } from 'express';
import type {
  ApiResponse,
  SalaryStructureDetailDto,
  SalaryStructureListResponse,
} from '@peoplepay360/shared';
import { AppError } from '../../errors/app-error.js';
import * as salaryStructuresService from './salary-structures.service.js';
import {
  StructureIdParamSchema,
  ListStructuresQuerySchema,
  GetStructureQuerySchema,
  SalaryStructureInputSchema,
  SalaryStructureStatusInputSchema,
} from './salary-config.schemas.js';

export async function listSalaryStructures(
  req: Request,
  res: Response<ApiResponse<SalaryStructureListResponse>>,
  next: NextFunction
): Promise<void> {
  try {
    const parseResult = ListStructuresQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Validation failed',
        parseResult.error.format()
      );
    }

    const result = await salaryStructuresService.listSalaryStructures(
      parseResult.data
    );
    res.status(200).json({
      data: result,
      error: null,
    });
  } catch (error) {
    next(error);
  }
}

export async function getSalaryStructureById(
  req: Request,
  res: Response<ApiResponse<SalaryStructureDetailDto>>,
  next: NextFunction
): Promise<void> {
  try {
    const paramResult = StructureIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Invalid structure ID',
        paramResult.error.format()
      );
    }

    const queryResult = GetStructureQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Invalid query parameters',
        queryResult.error.format()
      );
    }

    const structure = await salaryStructuresService.getSalaryStructureById(
      paramResult.data.id,
      queryResult.data
    );

    res.status(200).json({
      data: structure,
      error: null,
    });
  } catch (error) {
    next(error);
  }
}

export async function createSalaryStructure(
  req: Request,
  res: Response<ApiResponse<SalaryStructureDetailDto>>,
  next: NextFunction
): Promise<void> {
  try {
    const bodyResult = SalaryStructureInputSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Validation failed',
        bodyResult.error.format()
      );
    }

    const created = await salaryStructuresService.createSalaryStructure(
      bodyResult.data
    );

    res.status(201).json({
      data: created,
      error: null,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateSalaryStructure(
  req: Request,
  res: Response<ApiResponse<SalaryStructureDetailDto>>,
  next: NextFunction
): Promise<void> {
  try {
    const paramResult = StructureIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Invalid structure ID',
        paramResult.error.format()
      );
    }

    const bodyResult = SalaryStructureInputSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Validation failed',
        bodyResult.error.format()
      );
    }

    const updated = await salaryStructuresService.updateSalaryStructure(
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

export async function updateSalaryStructureStatus(
  req: Request,
  res: Response<ApiResponse<SalaryStructureDetailDto>>,
  next: NextFunction
): Promise<void> {
  try {
    const paramResult = StructureIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Invalid structure ID',
        paramResult.error.format()
      );
    }

    const bodyResult = SalaryStructureStatusInputSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Validation failed',
        bodyResult.error.format()
      );
    }

    const updated = await salaryStructuresService.updateSalaryStructureStatus(
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
