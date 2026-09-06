import type { Request, Response, NextFunction } from 'express';
import {
  evaluatePayrunEligibility,
} from './eligibility.service.js';
import {
  createPayrun,
  listPayruns,
  getPayrunById,
  discardDraftPayrun,
  computePayrun,
  recomputePayrun,
  validatePayrun,
  markPaidPayrun,
} from './payrun.service.js';
import {
  PayrunEligibilityInputSchema,
  CreatePayrunInputSchema,
  ListPayrunsQuerySchema,
  PayrunIdParamSchema,
} from './payroll.schemas.js';
import type { ApiResponse } from '@peoplepay360/shared';

export async function getEligibilityHandler(
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction
): Promise<void> {
  try {
    const input = PayrunEligibilityInputSchema.parse(req.body);
    const result = await evaluatePayrunEligibility(input);
    res.status(200).json({ data: result, error: null });
  } catch (error) {
    next(error);
  }
}

export async function createPayrunHandler(
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction
): Promise<void> {
  try {
    const input = CreatePayrunInputSchema.parse(req.body);
    const result = await createPayrun(req.user!.id, input);
    res.status(201).json({ data: result, error: null });
  } catch (error) {
    next(error);
  }
}

export async function listPayrunsHandler(
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction
): Promise<void> {
  try {
    const query = ListPayrunsQuerySchema.parse(req.query);
    const result = await listPayruns(query);
    res.status(200).json({ data: result, error: null });
  } catch (error) {
    next(error);
  }
}

export async function getPayrunByIdHandler(
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = PayrunIdParamSchema.parse(req.params);
    const result = await getPayrunById(id);
    res.status(200).json({ data: result, error: null });
  } catch (error) {
    next(error);
  }
}

export async function discardDraftPayrunHandler(
  req: Request,
  res: Response<ApiResponse<null>>,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = PayrunIdParamSchema.parse(req.params);
    await discardDraftPayrun(id, req.user!.id, req.user!.role);
    res.status(200).json({ data: null, error: null });
  } catch (error) {
    next(error);
  }
}

export async function computePayrunHandler(
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = PayrunIdParamSchema.parse(req.params);
    const result = await computePayrun(id, req.user!.id);
    res.status(200).json({ data: result, error: null });
  } catch (error) {
    next(error);
  }
}

export async function recomputePayrunHandler(
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = PayrunIdParamSchema.parse(req.params);
    const result = await recomputePayrun(id, req.user!.id);
    res.status(200).json({ data: result, error: null });
  } catch (error) {
    next(error);
  }
}

export async function validatePayrunHandler(
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = PayrunIdParamSchema.parse(req.params);
    const result = await validatePayrun(id, req.user!.id);
    res.status(200).json({ data: result, error: null });
  } catch (error) {
    next(error);
  }
}

export async function markPaidPayrunHandler(
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = PayrunIdParamSchema.parse(req.params);
    const result = await markPaidPayrun(id, req.user!.id);
    res.status(200).json({ data: result, error: null });
  } catch (error) {
    next(error);
  }
}
