import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import type { PrismaClient } from '@prisma/client';

type PrismaTransactionClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0] | PrismaClient;

/**
 * Validates that setting candidateManagerId as the manager for employeeId does not create
 * a self-management relationship or a direct/indirect cycle in the reporting hierarchy.
 */
export async function validateManagerCycle(
  employeeId: string,
  candidateManagerId: string,
  client: PrismaTransactionClient = prisma
): Promise<void> {
  if (employeeId === candidateManagerId) {
    throw new AppError(
      409,
      'INVALID_MANAGER_RELATIONSHIP',
      'An employee cannot be their own manager'
    );
  }

  // Walk up the hierarchy from candidateManagerId to ensure employeeId is never encountered
  let currentId: string | null = candidateManagerId;
  const visited = new Set<string>();

  while (currentId) {
    if (currentId === employeeId) {
      throw new AppError(
        409,
        'INVALID_MANAGER_RELATIONSHIP',
        'Manager relationship would create a cyclical reporting structure'
      );
    }

    if (visited.has(currentId)) {
      // Loop already present in existing records
      break;
    }
    visited.add(currentId);

    const record: { managerId: string | null } | null = await client.employee.findUnique({
      where: { id: currentId },
      select: { managerId: true },
    });

    if (!record) {
      break;
    }

    currentId = record.managerId;
  }
}
