import { PrismaClient, Role } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'PeoplePay360DevPass!';

interface SeedUser {
  email: string;
  role: Role;
  employeeId?: string;
}

const SEED_USERS: SeedUser[] = [
  {
    email: 'employee@peoplepay360.dev',
    role: Role.EMPLOYEE,
    employeeId: 'emp_dev_001',
  },
  {
    email: 'hr.manager@peoplepay360.dev',
    role: Role.HR_MANAGER,
  },
  {
    email: 'payroll.user@peoplepay360.dev',
    role: Role.HR_PAYROLL_USER,
  },
  {
    email: 'payroll.manager@peoplepay360.dev',
    role: Role.HR_PAYROLL_MANAGER,
  },
  {
    email: 'admin@peoplepay360.dev',
    role: Role.ADMIN,
  },
];

export async function main() {
  console.log('Seeding database users...');
  const passwordHash = await argon2.hash(DEV_PASSWORD);

  for (const user of SEED_USERS) {
    const normalizedEmail = user.email.trim().toLowerCase();
    await prisma.user.upsert({
      where: { email: normalizedEmail },
      update: {
        role: user.role,
        passwordHash,
        employeeId: user.employeeId ?? null,
        isActive: true,
      },
      create: {
        email: normalizedEmail,
        passwordHash,
        role: user.role,
        employeeId: user.employeeId ?? null,
        isActive: true,
      },
    });
    console.log(`Seeded user: ${normalizedEmail} (${user.role})`);
  }

  console.log('---');
  console.log(`All seed users initialized with password: ${DEV_PASSWORD}`);
  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
