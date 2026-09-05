import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ApiErrorResponse } from '@peoplepay360/shared';
import { AppError } from './app-error.js';
import { env } from '../config/env.js';
import { ContractResolutionError } from '../modules/contracts/resolution/index.js';

export const errorHandler: ErrorRequestHandler = (
  err: Error,
  _req: Request,
  res: Response<ApiErrorResponse>,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    const detailsObj = err.details && typeof err.details === 'object' ? (err.details as Record<string, unknown>) : null;
    const errorBody: ApiErrorResponse & { error: { fields?: unknown } } = {
      data: null,
      error: {
        code: err.code,
        message: err.message,
        ...(detailsObj?.fields ? { fields: detailsObj.fields } : {}),
        ...(err.details ? { details: err.details } : {}),
      },
    };
    res.status(err.statusCode).json(errorBody);
    return;
  }

  // Map Phase 5B typed contract-resolution errors to HTTP responses.
  // Only code + message are exposed; internal details stay server-side.
  if (err instanceof ContractResolutionError) {
    const httpStatus: Record<string, number> = {
      INVALID_DATE_ONLY: 400,
      INVALID_PAYROLL_PERIOD: 400,
      NO_APPLICABLE_CONTRACT: 422,
      MULTIPLE_APPLICABLE_CONTRACTS: 409,
      CONTRACT_EMPLOYEE_MISMATCH: 422,
      SALARY_STRUCTURE_MISMATCH: 422,
      WORKING_SCHEDULE_MISSING: 422,
    };
    const status = httpStatus[err.code] ?? 422;
    const body: ApiErrorResponse = {
      data: null,
      error: { code: err.code, message: err.message },
    };
    res.status(status).json(body);
    return;
  }

  if (env.NODE_ENV !== 'test') {
    console.error('Unhandled server error:', err);
  }

  const genericResponse: ApiErrorResponse = {
    data: null,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  };

  res.status(500).json(genericResponse);
};
