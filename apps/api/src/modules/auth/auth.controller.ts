import type { Request, Response, NextFunction } from 'express';
import { ApiResponse, CurrentUser } from '@peoplepay360/shared';
import { LoginRequestSchema } from './auth.schemas.js';
import { loginUser } from './auth.service.js';

export async function loginHandler(
  req: Request,
  res: Response<ApiResponse<CurrentUser>>,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password } = LoginRequestSchema.parse(req.body);
    const user = await loginUser(email, password);

    req.session.regenerate((err) => {
      if (err) {
        return next(err);
      }
      req.session.userId = user.id;
      req.session.save((saveErr) => {
        if (saveErr) {
          return next(saveErr);
        }
        res.status(200).json({
          data: user,
          error: null,
        });
      });
    });
  } catch (error) {
    next(error);
  }
}

export function meHandler(
  req: Request,
  res: Response<ApiResponse<CurrentUser>>,
  _next: NextFunction
): void {
  res.status(200).json({
    data: req.user!,
    error: null,
  });
}

export function logoutHandler(
  req: Request,
  res: Response<ApiResponse<{ success: boolean }>>,
  _next: NextFunction
): void {
  if (req.session) {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.status(200).json({
        data: { success: true },
        error: null,
      });
    });
  } else {
    res.clearCookie('connect.sid');
    res.status(200).json({
      data: { success: true },
      error: null,
    });
  }
}
