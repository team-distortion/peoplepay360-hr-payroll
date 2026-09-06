import type { Request, Response, NextFunction } from 'express';
import {
  AllocationQuerySchema,
  AllocationInputSchema,
  TimeOffIdParamSchema,
  ApproveDecisionSchema,
  RefuseDecisionSchema,
  parseOrThrow,
} from './time-off.schemas.js';
import * as allocationService from './allocation.service.js';
import { AppError } from '../../errors/app-error.js';

export async function listAllocations(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }
    const query = parseOrThrow(AllocationQuerySchema, req.query);
    const result = await allocationService.listAllocations(query, req.user);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function getAllocationById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }
    const { id } = parseOrThrow(TimeOffIdParamSchema, req.params);
    const result = await allocationService.getAllocationById(id, req.user);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function createAllocation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }
    const input = parseOrThrow(AllocationInputSchema, req.body);
    const result = await allocationService.createAllocation(input, req.user.id);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function updateAllocation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }
    const { id } = parseOrThrow(TimeOffIdParamSchema, req.params);
    const input = parseOrThrow(AllocationInputSchema, req.body);
    const result = await allocationService.updateAllocation(id, input, req.user.id);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function approveAllocation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }
    const { id } = parseOrThrow(TimeOffIdParamSchema, req.params);
    const { note } = parseOrThrow(ApproveDecisionSchema, req.body);
    const result = await allocationService.approveAllocation(id, note ?? null, req.user.id);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function refuseAllocation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }
    const { id } = parseOrThrow(TimeOffIdParamSchema, req.params);
    const { note } = parseOrThrow(RefuseDecisionSchema, req.body);
    const result = await allocationService.refuseAllocation(id, note, req.user.id);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}
