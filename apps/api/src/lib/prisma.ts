import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
