import argon2 from 'argon2';
import type { Role } from '@prisma/client';
import type { CurrentUser } from '@peoplepay360/shared';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import type { AuthenticatedUser } from '../../types/express.js';

export function toSafeUser(user: {
  id: string;
  email: string;
  role: Role;
  employeeId: string | null;
}): CurrentUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId,
  };
}

export async function login(email: string, password: string): Promise<AuthenticatedUser> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  if (!user.isActive) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const isPasswordValid = await argon2.verify(user.passwordHash, password);
  if (!isPasswordValid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  return toSafeUser(user);
}
