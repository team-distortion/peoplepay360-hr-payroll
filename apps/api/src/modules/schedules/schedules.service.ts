import { Prisma, type WorkingSchedule, type WorkingScheduleDay } from '@prisma/client';
import type {
  WorkingScheduleInput,
  WorkingScheduleDto,
  WorkingScheduleDayDto,
  WorkingScheduleListQuery,
  WorkingScheduleListResponse,
  WorkingScheduleStatus,
} from '@peoplepay360/shared';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { AppError } from '../../errors/app-error.js';
import {
  timeStringToMinutes,
  minutesToTimeString,
  calculateDayInterval,
  normalizeScheduleName,
  sortDaysByWeekday,
} from './schedule-time.js';

type ScheduleWithDays = WorkingSchedule & { days: WorkingScheduleDay[] };

function toScheduleDto(schedule: ScheduleWithDays): WorkingScheduleDto {
  const sortedDays = sortDaysByWeekday(schedule.days);
  const dayDtos: WorkingScheduleDayDto[] = sortedDays.map((d) => {
    const startTime = minutesToTimeString(d.startMinute);
    const endTime = minutesToTimeString(d.endMinute);
    const { dailyMinutes, overnight } = calculateDayInterval(
      startTime,
      endTime,
      d.breakMinutes
    );
    return {
      id: d.id,
      dayOfWeek: d.dayOfWeek,
      startTime,
      endTime,
      breakMinutes: d.breakMinutes,
      dailyMinutes,
      overnight,
    };
  });

  const weeklyMinutes = dayDtos.reduce((sum, d) => sum + d.dailyMinutes, 0);

  return {
    id: schedule.id,
    name: schedule.name,
    type: schedule.type,
    companyName: schedule.companyName,
    timezone: env.COMPANY_TIMEZONE,
    status: schedule.status,
    days: dayDtos,
    daysPerWeek: dayDtos.length,
    weeklyMinutes,
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString(),
  };
}

function handlePrismaError(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target)
        ? (err.meta?.target as string[]).join(',')
        : String(err.meta?.target || '');
      if (target.includes('nameKey')) {
        throw new AppError(
          409,
          'SCHEDULE_NAME_EXISTS',
          'Working schedule name already exists'
        );
      }
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Unique constraint violation on schedule'
      );
    }
  }
  throw err;
}

export async function listSchedules(
  query: WorkingScheduleListQuery
): Promise<WorkingScheduleListResponse> {
  const page = Math.max(1, query.page || 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));
  const skip = (page - 1) * pageSize;

  const where: Prisma.WorkingScheduleWhereInput = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.type) {
    where.type = query.type;
  }

  if (query.search && query.search.trim()) {
    const trimmed = query.search.trim();
    where.OR = [
      { name: { contains: trimmed, mode: 'insensitive' } },
      { companyName: { contains: trimmed, mode: 'insensitive' } },
    ];
  }

  const [total, records] = await Promise.all([
    prisma.workingSchedule.count({ where }),
    prisma.workingSchedule.findMany({
      where,
      include: { days: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip,
      take: pageSize,
    }),
  ]);

  return {
    items: records.map(toScheduleDto),
    page,
    pageSize,
    total,
  };
}

export async function getScheduleById(id: string): Promise<WorkingScheduleDto> {
  const schedule = await prisma.workingSchedule.findUnique({
    where: { id },
    include: { days: true },
  });

  if (!schedule) {
    throw new AppError(404, 'SCHEDULE_NOT_FOUND', 'Working schedule not found');
  }

  return toScheduleDto(schedule);
}

export async function createSchedule(
  input: WorkingScheduleInput
): Promise<WorkingScheduleDto> {
  const nameKey = normalizeScheduleName(input.name);

  try {
    const created = await prisma.workingSchedule.create({
      data: {
        name: input.name.trim(),
        nameKey,
        type: input.type,
        companyName: input.companyName.trim(),
        status: input.status,
        days: {
          create: input.days.map((d) => ({
            dayOfWeek: d.dayOfWeek,
            startMinute: timeStringToMinutes(d.startTime),
            endMinute: timeStringToMinutes(d.endTime),
            breakMinutes: d.breakMinutes,
          })),
        },
      },
      include: { days: true },
    });

    return toScheduleDto(created);
  } catch (err) {
    handlePrismaError(err);
  }
}

export async function updateSchedule(
  id: string,
  input: WorkingScheduleInput
): Promise<WorkingScheduleDto> {
  const existing = await prisma.workingSchedule.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError(404, 'SCHEDULE_NOT_FOUND', 'Working schedule not found');
  }

  const nameKey = normalizeScheduleName(input.name);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Replace all day rows
      await tx.workingScheduleDay.deleteMany({
        where: { scheduleId: id },
      });

      return tx.workingSchedule.update({
        where: { id },
        data: {
          name: input.name.trim(),
          nameKey,
          type: input.type,
          companyName: input.companyName.trim(),
          status: input.status,
          days: {
            create: input.days.map((d) => ({
              dayOfWeek: d.dayOfWeek,
              startMinute: timeStringToMinutes(d.startTime),
              endMinute: timeStringToMinutes(d.endTime),
              breakMinutes: d.breakMinutes,
            })),
          },
        },
        include: { days: true },
      });
    });

    return toScheduleDto(updated);
  } catch (err) {
    handlePrismaError(err);
  }
}

export async function updateScheduleStatus(
  id: string,
  status: WorkingScheduleStatus
): Promise<WorkingScheduleDto> {
  const existing = await prisma.workingSchedule.findUnique({
    where: { id },
    include: { days: true },
  });

  if (!existing) {
    throw new AppError(404, 'SCHEDULE_NOT_FOUND', 'Working schedule not found');
  }

  if (status === 'ACTIVE' && existing.days.length === 0) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Cannot activate schedule without working days'
    );
  }

  const updated = await prisma.workingSchedule.update({
    where: { id },
    data: { status },
    include: { days: true },
  });

  return toScheduleDto(updated);
}
