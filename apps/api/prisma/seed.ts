import {
  PrismaClient,
  Role,
  WorkingScheduleType,
  WorkingScheduleStatus,
  Weekday,
} from '@prisma/client';
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

interface SeedSchedule {
  name: string;
  nameKey: string;
  type: WorkingScheduleType;
  companyName: string;
  status: WorkingScheduleStatus;
  days: {
    dayOfWeek: Weekday;
    startMinute: number;
    endMinute: number;
    breakMinutes: number;
  }[];
}

const SEED_SCHEDULES: SeedSchedule[] = [
  {
    name: '40 Hours / Week',
    nameKey: '40 hours / week',
    type: WorkingScheduleType.STANDARD,
    companyName: 'PeoplePay360 Inc.',
    status: WorkingScheduleStatus.ACTIVE,
    days: [
      { dayOfWeek: Weekday.MONDAY, startMinute: 540, endMinute: 1080, breakMinutes: 60 },
      { dayOfWeek: Weekday.TUESDAY, startMinute: 540, endMinute: 1080, breakMinutes: 60 },
      { dayOfWeek: Weekday.WEDNESDAY, startMinute: 540, endMinute: 1080, breakMinutes: 60 },
      { dayOfWeek: Weekday.THURSDAY, startMinute: 540, endMinute: 1080, breakMinutes: 60 },
      { dayOfWeek: Weekday.FRIDAY, startMinute: 540, endMinute: 1080, breakMinutes: 60 },
    ],
  },
  {
    name: 'Night Shift',
    nameKey: 'night shift',
    type: WorkingScheduleType.SHIFT,
    companyName: 'PeoplePay360 Inc.',
    status: WorkingScheduleStatus.ACTIVE,
    days: [
      { dayOfWeek: Weekday.MONDAY, startMinute: 1320, endMinute: 360, breakMinutes: 0 },
      { dayOfWeek: Weekday.TUESDAY, startMinute: 1320, endMinute: 360, breakMinutes: 0 },
      { dayOfWeek: Weekday.WEDNESDAY, startMinute: 1320, endMinute: 360, breakMinutes: 0 },
      { dayOfWeek: Weekday.THURSDAY, startMinute: 1320, endMinute: 360, breakMinutes: 0 },
      { dayOfWeek: Weekday.FRIDAY, startMinute: 1320, endMinute: 360, breakMinutes: 0 },
    ],
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

  console.log('Seeding working schedules...');
  for (const sched of SEED_SCHEDULES) {
    const existing = await prisma.workingSchedule.findUnique({
      where: { nameKey: sched.nameKey },
    });

    if (existing) {
      await prisma.workingSchedule.update({
        where: { id: existing.id },
        data: {
          name: sched.name,
          type: sched.type,
          companyName: sched.companyName,
          status: sched.status,
        },
      });
      await prisma.workingScheduleDay.deleteMany({
        where: { scheduleId: existing.id },
      });
      await prisma.workingScheduleDay.createMany({
        data: sched.days.map((d) => ({
          scheduleId: existing.id,
          ...d,
        })),
      });
      console.log(`Updated seeded schedule: ${sched.name}`);
    } else {
      await prisma.workingSchedule.create({
        data: {
          name: sched.name,
          nameKey: sched.nameKey,
          type: sched.type,
          companyName: sched.companyName,
          status: sched.status,
          days: {
            create: sched.days,
          },
        },
      });
      console.log(`Created seeded schedule: ${sched.name}`);
    }
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
