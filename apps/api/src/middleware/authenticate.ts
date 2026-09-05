import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../errors/app-error.js';
import { toSafeUser } from '../modules/auth/auth.service.js';

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const userId = req.session?.userId;
  if (!userId) {
    return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));
    }

    req.user = toSafeUser(user);
    next();
  } catch (error) {
    next(error);
  }
}
