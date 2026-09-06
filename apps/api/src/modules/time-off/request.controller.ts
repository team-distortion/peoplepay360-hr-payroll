import type { Request, Response, NextFunction } from 'express';
import {
  TimeOffRequestQuerySchema,
  TimeOffRequestInputSchema,
  TimeOffIdParamSchema,
  ApproveDecisionSchema,
  RefuseDecisionSchema,
  parseOrThrow,
} from './time-off.schemas.js';
import * as requestService from './request.service.js';
import { AppError } from '../../errors/app-error.js';

export async function listRequests(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }
    const query = parseOrThrow(TimeOffRequestQuerySchema, req.query);
    const result = await requestService.listRequests(query, req.user);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function getRequestById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }
    const { id } = parseOrThrow(TimeOffIdParamSchema, req.params);
    const result = await requestService.getRequestById(id, req.user);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function createRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }
    const input = parseOrThrow(TimeOffRequestInputSchema, req.body);
    const result = await requestService.createRequest(input, req.user);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function updateRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }
    const { id } = parseOrThrow(TimeOffIdParamSchema, req.params);
    const input = parseOrThrow(TimeOffRequestInputSchema, req.body);
    const result = await requestService.updateRequest(id, input, req.user);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function approveRequest(
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
    const result = await requestService.approveRequest(id, note ?? null, req.user.id);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function refuseRequest(
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
    const result = await requestService.refuseRequest(id, note, req.user.id);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}
