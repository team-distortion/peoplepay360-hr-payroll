import { PrismaClient } from '@prisma/client';

const dbPublic = new PrismaClient({
  datasourceUrl: 'postgresql://peoplepay360:peoplepay360@localhost:5433/peoplepay360?schema=public',
});
const dbTest = new PrismaClient({
  datasourceUrl: 'postgresql://peoplepay360:peoplepay360@localhost:5433/peoplepay360?schema=test',
});

async function applyConstraints(prisma: PrismaClient, schema: string) {
  try {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "WorkingScheduleDay"
          ADD CONSTRAINT "WorkingScheduleDay_startMinute_check"
          CHECK ("startMinute" >= 0 AND "startMinute" <= 1439);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "WorkingScheduleDay"
          ADD CONSTRAINT "WorkingScheduleDay_endMinute_check"
          CHECK ("endMinute" >= 0 AND "endMinute" <= 1439);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "WorkingScheduleDay"
          ADD CONSTRAINT "WorkingScheduleDay_start_end_different_check"
          CHECK ("startMinute" <> "endMinute");
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "WorkingScheduleDay"
          ADD CONSTRAINT "WorkingScheduleDay_breakMinutes_check"
          CHECK ("breakMinutes" >= 0 AND "breakMinutes" <= 720);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    console.log('Applied constraints to', schema);
  } catch (err: any) {
    console.error('Error applying to', schema, err.message);
  }
}

async function main() {
  await applyConstraints(dbPublic, 'public');
  await applyConstraints(dbTest, 'test');
  await dbPublic.$disconnect();
  await dbTest.$disconnect();
}

main();
