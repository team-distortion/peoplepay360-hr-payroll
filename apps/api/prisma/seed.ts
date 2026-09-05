import {
  EmployeeType,
  PrismaClient,
  RecordStatus,
  Role,
  Weekday,
  WorkingScheduleStatus,
  WorkingScheduleType,
} from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD ?? 'PeoplePay360DevPass!';

const scheduleDays = {
  standard: [
    Weekday.MONDAY,
    Weekday.TUESDAY,
    Weekday.WEDNESDAY,
    Weekday.THURSDAY,
    Weekday.FRIDAY,
  ].map((dayOfWeek) => ({
    dayOfWeek,
    startMinute: 9 * 60,
    endMinute: 18 * 60,
    breakMinutes: 60,
  })),
  flexible: [
    Weekday.MONDAY,
    Weekday.TUESDAY,
    Weekday.WEDNESDAY,
    Weekday.THURSDAY,
    Weekday.FRIDAY,
  ].map((dayOfWeek) => ({
    dayOfWeek,
    startMinute: 10 * 60,
    endMinute: 17 * 60,
    breakMinutes: 30,
  })),
  weekend: [Weekday.SATURDAY, Weekday.SUNDAY].map((dayOfWeek) => ({
    dayOfWeek,
    startMinute: 9 * 60,
    endMinute: 18 * 60,
    breakMinutes: 60,
  })),
};

async function seedSchedule(input: {
  name: string;
  nameKey: string;
  type: WorkingScheduleType;
  status: WorkingScheduleStatus;
  days: Array<{
    dayOfWeek: Weekday;
    startMinute: number;
    endMinute: number;
    breakMinutes: number;
  }>;
}) {
  return prisma.$transaction(async (tx) => {
    const schedule = await tx.workingSchedule.upsert({
      where: { nameKey: input.nameKey },
      update: {
        name: input.name,
        type: input.type,
        companyName: 'PeoplePay360',
        status: input.status,
      },
      create: {
        name: input.name,
        nameKey: input.nameKey,
        type: input.type,
        companyName: 'PeoplePay360',
        status: input.status,
      },
    });

    // These are controlled development fixtures. Replacing their day rows keeps
    // reruns deterministic and cannot duplicate schedule entries.
    await tx.workingScheduleDay.deleteMany({
      where: { scheduleId: schedule.id },
    });
    await tx.workingScheduleDay.createMany({
      data: input.days.map((day) => ({ ...day, scheduleId: schedule.id })),
    });

    return schedule;
  });
}

interface EmployeeSeedInput {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  workPhone: string | null;
  jobPosition: string;
  employeeType: EmployeeType;
  status: RecordStatus;
  workLocation: string | null;
  departmentId: string | null;
  managerId: string | null;
  workingScheduleId: string | null;
  personalEmail: string | null;
  personalPhone: string | null;
  dateOfBirth: Date | null;
  personalAddress: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  bankIfsc: string | null;
}

async function seedEmployee(data: EmployeeSeedInput) {
  return prisma.employee.upsert({
    where: { employeeNumber: data.employeeNumber },
    update: data,
    create: data,
  });
}

async function main() {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_DEV_SEED !== 'true'
  ) {
    throw new Error(
      'Development seed refused in production. Set ALLOW_DEV_SEED=true only intentionally.',
    );
  }

  console.log('Seeding Working Schedules...');

  const standardSchedule = await seedSchedule({
    name: 'Standard 40 Hours',
    nameKey: 'standard 40 hours',
    type: WorkingScheduleType.STANDARD,
    status: WorkingScheduleStatus.ACTIVE,
    days: scheduleDays.standard,
  });
  const flexibleSchedule = await seedSchedule({
    name: 'Flexible 32.5 Hours',
    nameKey: 'flexible 32.5 hours',
    type: WorkingScheduleType.FLEXIBLE,
    status: WorkingScheduleStatus.ACTIVE,
    days: scheduleDays.flexible,
  });
  const inactiveSchedule = await seedSchedule({
    name: 'Legacy Weekend Support',
    nameKey: 'legacy weekend support',
    type: WorkingScheduleType.SHIFT,
    status: WorkingScheduleStatus.INACTIVE,
    days: scheduleDays.weekend,
  });

  console.log('Seeding Departments...');

  const executiveDepartment = await prisma.department.upsert({
    where: { nameKey: 'executive' },
    update: { name: 'Executive', status: RecordStatus.ACTIVE },
    create: {
      name: 'Executive',
      nameKey: 'executive',
      status: RecordStatus.ACTIVE,
    },
  });
  const hrDepartment = await prisma.department.upsert({
    where: { nameKey: 'human resources' },
    update: { name: 'Human Resources', status: RecordStatus.ACTIVE },
    create: {
      name: 'Human Resources',
      nameKey: 'human resources',
      status: RecordStatus.ACTIVE,
    },
  });
  const financeDepartment = await prisma.department.upsert({
    where: { nameKey: 'finance' },
    update: { name: 'Finance', status: RecordStatus.ACTIVE },
    create: {
      name: 'Finance',
      nameKey: 'finance',
      status: RecordStatus.ACTIVE,
    },
  });
  const engineeringDepartment = await prisma.department.upsert({
    where: { nameKey: 'engineering' },
    update: { name: 'Engineering', status: RecordStatus.ACTIVE },
    create: {
      name: 'Engineering',
      nameKey: 'engineering',
      status: RecordStatus.ACTIVE,
    },
  });
  const inactiveDepartment = await prisma.department.upsert({
    where: { nameKey: 'legacy operations' },
    update: { name: 'Legacy Operations', status: RecordStatus.INACTIVE },
    create: {
      name: 'Legacy Operations',
      nameKey: 'legacy operations',
      status: RecordStatus.INACTIVE,
    },
  });

  console.log('Seeding Employees and manager hierarchy...');

  const neha = await seedEmployee({
    employeeNumber: 'EMP0001',
    firstName: 'Neha',
    lastName: 'Kapoor',
    workEmail: 'neha.kapoor@peoplepay360.dev',
    workPhone: '+91 98765 10001',
    jobPosition: 'Chief Executive Officer',
    employeeType: EmployeeType.FULL_TIME,
    status: RecordStatus.ACTIVE,
    workLocation: 'Raipur',
    departmentId: executiveDepartment.id,
    managerId: null,
    workingScheduleId: standardSchedule.id,
    personalEmail: 'neha.kapoor@example.com',
    personalPhone: '+91 98765 20001',
    dateOfBirth: new Date('1985-04-12T00:00:00.000Z'),
    personalAddress: 'Civil Lines, Raipur, Chhattisgarh',
    emergencyContactName: 'Arjun Kapoor',
    emergencyContactPhone: '+91 98765 30001',
    bankAccountName: 'Neha Kapoor',
    bankAccountNumber: '001234567890',
    bankName: 'HDFC Bank',
    bankIfsc: 'HDFC0001234',
  });

  const priya = await seedEmployee({
    employeeNumber: 'EMP0002',
    firstName: 'Priya',
    lastName: 'Sharma',
    workEmail: 'priya.sharma@peoplepay360.dev',
    workPhone: '+91 98765 10002',
    jobPosition: 'HR Manager',
    employeeType: EmployeeType.FULL_TIME,
    status: RecordStatus.ACTIVE,
    workLocation: 'Raipur',
    departmentId: hrDepartment.id,
    managerId: neha.id,
    workingScheduleId: standardSchedule.id,
    personalEmail: 'priya.sharma@example.com',
    personalPhone: '+91 98765 20002',
    dateOfBirth: new Date('1990-08-21T00:00:00.000Z'),
    personalAddress: 'Shankar Nagar, Raipur, Chhattisgarh',
    emergencyContactName: 'Karan Sharma',
    emergencyContactPhone: '+91 98765 30002',
    bankAccountName: 'Priya Sharma',
    bankAccountNumber: '001234567891',
    bankName: 'State Bank of India',
    bankIfsc: 'SBIN0004321',
  });

  const aarav = await seedEmployee({
    employeeNumber: 'EMP0003',
    firstName: 'Aarav',
    lastName: 'Mehta',
    workEmail: 'aarav.mehta@peoplepay360.dev',
    workPhone: '+91 98765 10003',
    jobPosition: 'Payroll Manager',
    employeeType: EmployeeType.FULL_TIME,
    status: RecordStatus.ACTIVE,
    workLocation: 'Raipur',
    departmentId: financeDepartment.id,
    managerId: neha.id,
    workingScheduleId: standardSchedule.id,
    personalEmail: 'aarav.mehta@example.com',
    personalPhone: '+91 98765 20003',
    dateOfBirth: new Date('1989-11-05T00:00:00.000Z'),
    personalAddress: 'Telibandha, Raipur, Chhattisgarh',
    emergencyContactName: 'Riya Mehta',
    emergencyContactPhone: '+91 98765 30003',
    bankAccountName: 'Aarav Mehta',
    bankAccountNumber: '001234567892',
    bankName: 'ICICI Bank',
    bankIfsc: 'ICIC0002468',
  });

  const vikram = await seedEmployee({
    employeeNumber: 'EMP0004',
    firstName: 'Vikram',
    lastName: 'Rao',
    workEmail: 'vikram.rao@peoplepay360.dev',
    workPhone: '+91 98765 10004',
    jobPosition: 'Engineering Lead',
    employeeType: EmployeeType.FULL_TIME,
    status: RecordStatus.ACTIVE,
    workLocation: 'Bengaluru',
    departmentId: engineeringDepartment.id,
    managerId: neha.id,
    workingScheduleId: flexibleSchedule.id,
    personalEmail: 'vikram.rao@example.com',
    personalPhone: '+91 98765 20004',
    dateOfBirth: new Date('1991-02-17T00:00:00.000Z'),
    personalAddress: 'Indiranagar, Bengaluru, Karnataka',
    emergencyContactName: 'Anita Rao',
    emergencyContactPhone: '+91 98765 30004',
    bankAccountName: 'Vikram Rao',
    bankAccountNumber: '001234567893',
    bankName: 'Axis Bank',
    bankIfsc: 'UTIB0001357',
  });

  const sara = await seedEmployee({
    employeeNumber: 'EMP0005',
    firstName: 'Sara',
    lastName: 'Khan',
    workEmail: 'sara.khan@peoplepay360.dev',
    workPhone: '+91 98765 10005',
    jobPosition: 'Payroll Analyst',
    employeeType: EmployeeType.PART_TIME,
    status: RecordStatus.ACTIVE,
    workLocation: 'Remote',
    departmentId: financeDepartment.id,
    managerId: aarav.id,
    workingScheduleId: flexibleSchedule.id,
    personalEmail: 'sara.khan@example.com',
    personalPhone: '+91 98765 20005',
    dateOfBirth: new Date('1996-06-09T00:00:00.000Z'),
    personalAddress: 'Bhopal, Madhya Pradesh',
    emergencyContactName: 'Imran Khan',
    emergencyContactPhone: '+91 98765 30005',
    bankAccountName: 'Sara Khan',
    bankAccountNumber: '001234567894',
    bankName: 'Kotak Mahindra Bank',
    bankIfsc: 'KKBK0009876',
  });

  const kabir = await seedEmployee({
    employeeNumber: 'EMP0006',
    firstName: 'Kabir',
    lastName: 'Verma',
    workEmail: 'kabir.verma@peoplepay360.dev',
    workPhone: '+91 98765 10006',
    jobPosition: 'Backend Engineer',
    employeeType: EmployeeType.CONTRACT,
    status: RecordStatus.ACTIVE,
    workLocation: 'Remote',
    departmentId: engineeringDepartment.id,
    managerId: vikram.id,
    workingScheduleId: flexibleSchedule.id,
    personalEmail: 'kabir.verma@example.com',
    personalPhone: '+91 98765 20006',
    dateOfBirth: new Date('1998-09-14T00:00:00.000Z'),
    personalAddress: 'Kanker, Chhattisgarh',
    emergencyContactName: 'Nisha Verma',
    emergencyContactPhone: '+91 98765 30006',
    bankAccountName: 'Kabir Verma',
    bankAccountNumber: '001234567895',
    bankName: 'HDFC Bank',
    bankIfsc: 'HDFC0005678',
  });

  await seedEmployee({
    employeeNumber: 'EMP0007',
    firstName: 'Meera',
    lastName: 'Iyer',
    workEmail: 'meera.iyer@peoplepay360.dev',
    workPhone: null,
    jobPosition: 'HR Intern',
    employeeType: EmployeeType.INTERN,
    status: RecordStatus.ACTIVE,
    workLocation: 'Raipur',
    departmentId: hrDepartment.id,
    managerId: priya.id,
    workingScheduleId: standardSchedule.id,
    personalEmail: null,
    personalPhone: null,
    dateOfBirth: new Date('2004-01-30T00:00:00.000Z'),
    personalAddress: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    bankAccountName: null,
    bankAccountNumber: null,
    bankName: null,
    bankIfsc: null,
  });

  await seedEmployee({
    employeeNumber: 'EMP0008',
    firstName: 'Rohan',
    lastName: 'Das',
    workEmail: 'rohan.das@peoplepay360.dev',
    workPhone: null,
    jobPosition: 'Operations Executive',
    employeeType: EmployeeType.FULL_TIME,
    status: RecordStatus.INACTIVE,
    workLocation: 'Raipur',
    departmentId: inactiveDepartment.id,
    managerId: neha.id,
    workingScheduleId: inactiveSchedule.id,
    personalEmail: null,
    personalPhone: null,
    dateOfBirth: new Date('1993-12-10T00:00:00.000Z'),
    personalAddress: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    bankAccountName: null,
    bankAccountNumber: null,
    bankName: null,
    bankIfsc: null,
  });

  console.log('Seeding User Accounts...');
  const passwordHash = await argon2.hash(DEV_PASSWORD);
  const users = [
    {
      email: 'employee@peoplepay360.dev',
      role: Role.EMPLOYEE,
      employeeId: kabir.id,
    },
    {
      email: 'hr.manager@peoplepay360.dev',
      role: Role.HR_MANAGER,
      employeeId: priya.id,
    },
    {
      email: 'payroll.user@peoplepay360.dev',
      role: Role.HR_PAYROLL_USER,
      employeeId: sara.id,
    },
    {
      email: 'payroll.manager@peoplepay360.dev',
      role: Role.HR_PAYROLL_MANAGER,
      employeeId: aarav.id,
    },
    {
      email: 'admin@peoplepay360.dev',
      role: Role.ADMIN,
      employeeId: neha.id,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        role: user.role,
        passwordHash,
        employeeId: user.employeeId,
        isActive: true,
      },
      create: {
        email: user.email,
        passwordHash,
        role: user.role,
        employeeId: user.employeeId,
        isActive: true,
      },
    });
  }

  console.log('Seed completed successfully.');
  console.log('Created/updated: 3 schedules, 5 departments, 8 employees, 5 users.');
  console.log(`Development login password: ${DEV_PASSWORD}`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed error:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
