import type { Request, Response } from 'express';
import { ApiErrorResponse } from '@peoplepay360/shared';

export const notFoundHandler = (_req: Request, res: Response<ApiErrorResponse>): void => {
  res.status(404).json({
    data: null,
    error: {
      code: 'NOT_FOUND',
      message: 'Resource or endpoint not found',
    },
  });
};
