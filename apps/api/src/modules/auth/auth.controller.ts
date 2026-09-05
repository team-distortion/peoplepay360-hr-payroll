import type { Request, Response, NextFunction } from 'express';
import type { ApiResponse, CurrentUser } from '@peoplepay360/shared';
import { LoginRequestSchema } from './auth.schemas.js';
import * as authService from './auth.service.js';
import { AppError } from '../../errors/app-error.js';

export async function login(
  req: Request,
  res: Response<ApiResponse<CurrentUser>>,
  next: NextFunction
): Promise<void> {
  try {
    const parseResult = LoginRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', parseResult.error.format());
    }

    const { email, password } = parseResult.data;
    const safeUser = await authService.login(email, password);

    // Regenerate session to prevent session fixation
    req.session.regenerate((regenErr) => {
      if (regenErr) {
        return next(regenErr);
      }

      req.session.userId = safeUser.id;

      req.session.save((saveErr) => {
        if (saveErr) {
          return next(saveErr);
        }

        res.status(200).json({
          data: safeUser,
          error: null,
        });
      });
    });
  } catch (error) {
    next(error);
  }
}

export function me(
  req: Request,
  res: Response<ApiResponse<CurrentUser>>,
  next: NextFunction
): void {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
    }

    res.status(200).json({
      data: req.user,
      error: null,
    });
  } catch (error) {
    next(error);
  }
}

export function logout(
  req: Request,
  res: Response<ApiResponse<{ success: boolean }>>,
  next: NextFunction
): void {
  try {
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          return next(err);
        }
        res.clearCookie('connect.sid', { path: '/' });
        res.status(200).json({
          data: { success: true },
          error: null,
        });
      });
    } else {
      res.clearCookie('connect.sid', { path: '/' });
      res.status(200).json({
        data: { success: true },
        error: null,
      });
    }
  } catch (error) {
    next(error);
  }
}
