import type { Request, Response, NextFunction } from 'express';
import {
  TimeOffTypeQuerySchema,
  TimeOffTypeInputSchema,
  TimeOffIdParamSchema,
  TimeOffTypeStatusSchema,
  parseOrThrow,
} from './time-off.schemas.js';
import * as typeService from './time-off-type.service.js';
import { AppError } from '../../errors/app-error.js';

export async function listTimeOffTypes(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }
    const query = parseOrThrow(TimeOffTypeQuerySchema, req.query);
    const result = await typeService.listTimeOffTypes(query, req.user);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function getTimeOffTypeById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }
    const { id } = parseOrThrow(TimeOffIdParamSchema, req.params);
    const result = await typeService.getTimeOffTypeById(id, req.user);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function createTimeOffType(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }
    const input = parseOrThrow(TimeOffTypeInputSchema, req.body);
    const result = await typeService.createTimeOffType(input, req.user.id);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function updateTimeOffType(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }
    const { id } = parseOrThrow(TimeOffIdParamSchema, req.params);
    const input = parseOrThrow(TimeOffTypeInputSchema, req.body);
    const result = await typeService.updateTimeOffType(id, input, req.user.id);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function updateTimeOffTypeStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }
    const { id } = parseOrThrow(TimeOffIdParamSchema, req.params);
    const { status } = parseOrThrow(TimeOffTypeStatusSchema, req.body);
    const result = await typeService.updateTimeOffTypeStatus(id, status, req.user.id);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}
