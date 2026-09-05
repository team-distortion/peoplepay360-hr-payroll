import type { Request, Response, NextFunction } from 'express';
import type {
  ApiResponse,
  SalaryRuleDto,
  SalaryRuleListResponse,
  SalaryStructureDetailDto,
} from '@peoplepay360/shared';
import { AppError } from '../../errors/app-error.js';
import * as salaryRulesService from './salary-rules.service.js';
import {
  RuleIdParamSchema,
  StructureRuleParamsSchema,
  ListRulesQuerySchema,
  SalaryRuleInputSchema,
  SalaryRuleStatusInputSchema,
  SalaryRuleConfigurationInputSchema,
} from './salary-config.schemas.js';

export async function listSalaryRules(
  req: Request,
  res: Response<ApiResponse<SalaryRuleListResponse>>,
  next: NextFunction
): Promise<void> {
  try {
    const parseResult = ListRulesQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Validation failed',
        parseResult.error.format()
      );
    }

    const result = await salaryRulesService.listSalaryRules(parseResult.data);
    res.status(200).json({
      data: result,
      error: null,
    });
  } catch (error) {
    next(error);
  }
}

export async function getSalaryRuleById(
  req: Request,
  res: Response<ApiResponse<SalaryRuleDto>>,
  next: NextFunction
): Promise<void> {
  try {
    const paramResult = RuleIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Invalid rule ID',
        paramResult.error.format()
      );
    }

    const rule = await salaryRulesService.getSalaryRuleById(paramResult.data.id);
    res.status(200).json({
      data: rule,
      error: null,
    });
  } catch (error) {
    next(error);
  }
}

export async function createRuleForStructure(
  req: Request,
  res: Response<ApiResponse<SalaryRuleDto>>,
  next: NextFunction
): Promise<void> {
  try {
    const paramResult = StructureRuleParamsSchema.safeParse(req.params);
    if (!paramResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Invalid structure ID',
        paramResult.error.format()
      );
    }

    const bodyResult = SalaryRuleInputSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Validation failed',
        bodyResult.error.format()
      );
    }

    const created = await salaryRulesService.createSalaryRule(
      paramResult.data.structureId,
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

export async function updateSalaryRule(
  req: Request,
  res: Response<ApiResponse<SalaryRuleDto>>,
  next: NextFunction
): Promise<void> {
  try {
    const paramResult = RuleIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Invalid rule ID',
        paramResult.error.format()
      );
    }

    const bodyResult = SalaryRuleInputSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Validation failed',
        bodyResult.error.format()
      );
    }

    const updated = await salaryRulesService.updateSalaryRule(
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

export async function updateSalaryRuleStatus(
  req: Request,
  res: Response<ApiResponse<SalaryRuleDto>>,
  next: NextFunction
): Promise<void> {
  try {
    const paramResult = RuleIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Invalid rule ID',
        paramResult.error.format()
      );
    }

    const bodyResult = SalaryRuleStatusInputSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Validation failed',
        bodyResult.error.format()
      );
    }

    const updated = await salaryRulesService.updateSalaryRuleStatus(
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

export async function updateStructureRuleConfiguration(
  req: Request,
  res: Response<ApiResponse<SalaryStructureDetailDto>>,
  next: NextFunction
): Promise<void> {
  try {
    const paramResult = StructureRuleParamsSchema.safeParse(req.params);
    if (!paramResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Invalid structure ID',
        paramResult.error.format()
      );
    }

    const bodyResult = SalaryRuleConfigurationInputSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Validation failed',
        bodyResult.error.format()
      );
    }

    const result = await salaryRulesService.updateSalaryRuleConfiguration(
      paramResult.data.structureId,
      bodyResult.data
    );

    res.status(200).json({
      data: result,
      error: null,
    });
  } catch (error) {
    next(error);
  }
}
