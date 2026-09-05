import argon2 from 'argon2';
import { CurrentUser } from '@peoplepay360/shared';
import { User } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import { AuthenticatedUser } from '../../types/express.js';

export function toSafeUser(user: User): CurrentUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId,
  };
}

export async function loginUser(email: string, password: string): Promise<AuthenticatedUser> {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user || !user.isActive) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const isValidPassword = await argon2.verify(user.passwordHash, password);
  if (!isValidPassword) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  return toSafeUser(user);
}
