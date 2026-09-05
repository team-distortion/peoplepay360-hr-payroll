import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ApiErrorResponse } from '@peoplepay360/shared';
import { AppError } from './app-error.js';
import { env } from '../config/env.js';

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
