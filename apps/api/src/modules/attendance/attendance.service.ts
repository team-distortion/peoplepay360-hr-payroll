import { PrismaClient, Prisma } from '@prisma/client';
import { AppError } from '../../errors/app-error.js';
import { prisma as defaultPrisma } from '../../lib/prisma.js';
import type { AuthenticatedUser } from '../../types/express.js';
import type {
  ManualAttendanceInput,
  AttendanceCorrectionInput,
  AttendanceListQuery,
  AttendanceListResponse,
  AttendanceDto,
  AttendanceTodayDto,
} from '@peoplepay360/shared';
import {
  CompanyClock,
  SystemCompanyClock,
  getCompanyBusinessDate,
  getCompanyMinuteOfDay,
  getCompanyWeekday,
  isInstantOnBusinessDate,
} from './attendance-clock.js';
import {
  deriveAttendanceStatus,
  calculateMinutes,
  calculateDisplayElapsedMinutes,
  type ExpectedScheduleSnapshot,
} from './attendance-calculation.js';
import {
  toAttendanceDto,
  formatDateToYYYYMMDD,
  type AttendanceWithRelations,
} from './attendance.mapper.js';

export const attendanceInclude = {
  employee: {
    include: {
      department: true,
      manager: true,
    },
  },
  workingSchedule: true,
  lastEditedByUser: {
    select: {
      id: true,
      email: true,
    },
  },
} as const;

export class AttendanceService {
  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly clock: CompanyClock = new SystemCompanyClock()
  ) {}

  /**
   * Resolves the schedule snapshot for an employee on a specific business date (YYYY-MM-DD).
   * Precedence: Contract on date -> Contract Schedule Override -> Employee Schedule Fallback.
   */
  async resolveScheduleSnapshot(
    employeeId: string,
    businessDate: string
  ): Promise<{ workingScheduleId: string; snapshot: ExpectedScheduleSnapshot }> {
    const dateObj = new Date(`${businessDate}T00:00:00.000Z`);

    // 1. Find the zero-or-one Contract covering this date
    const contract = await this.prisma.contract.findFirst({
      where: {
        employeeId,
        startDate: { lte: dateObj },
        OR: [{ endDate: null }, { endDate: { gte: dateObj } }],
      },
      select: {
        id: true,
        workingScheduleId: true,
      },
    });

    let targetScheduleId: string | null = contract?.workingScheduleId ?? null;

    // 2. If no contract schedule override, fallback to employee default schedule
    if (!targetScheduleId) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: employeeId },
        select: { workingScheduleId: true },
      });
      targetScheduleId = employee?.workingScheduleId ?? null;
    }

    if (!targetScheduleId) {
      throw new AppError(
        422,
        'ATTENDANCE_SCHEDULE_MISSING',
        'Neither contract nor employee has an assigned working schedule'
      );
    }

    const schedule = await this.prisma.workingSchedule.findUnique({
      where: { id: targetScheduleId },
      include: { days: true },
    });

    if (!schedule) {
      throw new AppError(
        422,
        'ATTENDANCE_SCHEDULE_INVALID',
        'Assigned working schedule does not exist'
      );
    }

    // Determine weekday for the business date in company timezone
    const weekday = getCompanyWeekday(dateObj, this.clock.timeZone);
    const dayRow = schedule.days.find((d) => d.dayOfWeek === weekday);

    if (dayRow) {
      const expectedMinutes = dayRow.endMinute - dayRow.startMinute - dayRow.breakMinutes;
      return {
        workingScheduleId: schedule.id,
        snapshot: {
          expectedStartMinute: dayRow.startMinute,
          expectedEndMinute: dayRow.endMinute,
          expectedBreakMinutes: dayRow.breakMinutes,
          expectedMinutes: Math.max(0, expectedMinutes),
        },
      };
    }

    // Non-working day snapshot
    return {
      workingScheduleId: schedule.id,
      snapshot: {
        expectedStartMinute: null,
        expectedEndMinute: null,
        expectedBreakMinutes: 0,
        expectedMinutes: 0,
      },
    };
  }

  /**
   * Self action: GET /api/v1/attendance/me/today
   */
  async getAttendanceTodayForEmployee(user: AuthenticatedUser): Promise<AttendanceTodayDto> {
    if (!user.employeeId) {
      throw new AppError(
        403,
        'EMPLOYEE_PROFILE_NOT_LINKED',
        'Your user account is not linked to an employee profile'
      );
    }

    const now = this.clock.now();
    const businessDate = getCompanyBusinessDate(now, this.clock.timeZone);
    const dateObj = new Date(`${businessDate}T00:00:00.000Z`);

    const record = (await this.prisma.attendance.findUnique({
      where: {
        employeeId_attendanceDate: {
          employeeId: user.employeeId,
          attendanceDate: dateObj,
        },
      },
      include: attendanceInclude,
    })) as AttendanceWithRelations | null;

    if (!record) {
      return {
        businessDate,
        serverNow: now.toISOString(),
        state: 'NOT_CHECKED_IN',
        attendance: null,
        elapsedMinutes: 0,
      };
    }

    let state: AttendanceTodayDto['state'] = 'CHECKED_IN';
    let elapsedMinutes = 0;

    if (record.status === 'ABSENT') {
      state = 'ABSENT';
      elapsedMinutes = 0;
    } else if (record.checkOutAt !== null) {
      state = 'CHECKED_OUT';
      elapsedMinutes = calculateDisplayElapsedMinutes(record.checkInAt, record.checkOutAt, now);
    } else {
      state = 'CHECKED_IN';
      elapsedMinutes = calculateDisplayElapsedMinutes(record.checkInAt, null, now);
    }

    return {
      businessDate,
      serverNow: now.toISOString(),
      state,
      attendance: toAttendanceDto(record, { omitEditorEmail: user.role === 'EMPLOYEE' }),
      elapsedMinutes,
    };
  }

  /**
   * Self action: POST /api/v1/attendance/me/check-in
   */
  async checkIn(user: AuthenticatedUser): Promise<AttendanceDto> {
    if (!user.employeeId) {
      throw new AppError(
        403,
        'EMPLOYEE_PROFILE_NOT_LINKED',
        'Your user account is not linked to an employee profile'
      );
    }

    // Verify employee is active
    const employee = await this.prisma.employee.findUnique({
      where: { id: user.employeeId },
      select: { status: true },
    });
    if (!employee || employee.status !== 'ACTIVE') {
      throw new AppError(422, 'ATTENDANCE_EMPLOYEE_INACTIVE', 'Employee is inactive');
    }

    const now = this.clock.now();
    const businessDate = getCompanyBusinessDate(now, this.clock.timeZone);
    const dateObj = new Date(`${businessDate}T00:00:00.000Z`);
    const minuteOfDay = getCompanyMinuteOfDay(now, this.clock.timeZone);

    const { workingScheduleId, snapshot } = await this.resolveScheduleSnapshot(
      user.employeeId,
      businessDate
    );

    const status = deriveAttendanceStatus('WORKED', minuteOfDay, snapshot.expectedStartMinute);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.attendance.findUnique({
        where: {
          employeeId_attendanceDate: {
            employeeId: user.employeeId!,
            attendanceDate: dateObj,
          },
        },
      });

      if (existing) {
        if (existing.checkOutAt === null && existing.status !== 'ABSENT') {
          throw new AppError(
            409,
            'ATTENDANCE_ALREADY_CHECKED_IN',
            'Today attendance is already open'
          );
        }
        throw new AppError(
          409,
          'ATTENDANCE_ALREADY_RECORDED',
          'Attendance has already been recorded for today'
        );
      }

      try {
        const created = (await tx.attendance.create({
          data: {
            employeeId: user.employeeId!,
            attendanceDate: dateObj,
            checkInAt: now,
            checkOutAt: null,
            status,
            workedMinutes: 0,
            overtimeMinutes: 0,
            workingScheduleId,
            expectedStartMinute: snapshot.expectedStartMinute,
            expectedEndMinute: snapshot.expectedEndMinute,
            expectedBreakMinutes: snapshot.expectedBreakMinutes,
            expectedMinutes: snapshot.expectedMinutes,
            manuallyEdited: false,
          },
          include: attendanceInclude,
        })) as AttendanceWithRelations;

        const dto = toAttendanceDto(created, { omitEditorEmail: user.role === 'EMPLOYEE' });

        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: 'ATTENDANCE_CHECKED_IN',
            entityType: 'ATTENDANCE',
            entityId: created.id,
            before: Prisma.JsonNull,
            after: dto as unknown as Prisma.InputJsonValue,
          },
        });

        return dto;
      } catch (err: any) {
        if (err?.code === 'P2002') {
          throw new AppError(
            409,
            'ATTENDANCE_ALREADY_CHECKED_IN',
            'Today attendance is already open'
          );
        }
        throw err;
      }
    });
  }

  /**
   * Self action: POST /api/v1/attendance/me/check-out
   */
  async checkOut(user: AuthenticatedUser): Promise<AttendanceDto> {
    if (!user.employeeId) {
      throw new AppError(
        403,
        'EMPLOYEE_PROFILE_NOT_LINKED',
        'Your user account is not linked to an employee profile'
      );
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: user.employeeId },
      select: { status: true },
    });
    if (!employee || employee.status !== 'ACTIVE') {
      throw new AppError(422, 'ATTENDANCE_EMPLOYEE_INACTIVE', 'Employee is inactive');
    }

    const now = this.clock.now();
    const todayBusinessDate = getCompanyBusinessDate(now, this.clock.timeZone);

    return this.prisma.$transaction(async (tx) => {
      // Find open record
      const openRecord = (await tx.attendance.findFirst({
        where: {
          employeeId: user.employeeId!,
          checkOutAt: null,
          status: { in: ['PRESENT', 'LATE'] },
        },
        include: attendanceInclude,
      })) as AttendanceWithRelations | null;

      if (!openRecord) {
        const todayObj = new Date(`${todayBusinessDate}T00:00:00.000Z`);
        const todayRecord = await tx.attendance.findUnique({
          where: {
            employeeId_attendanceDate: {
              employeeId: user.employeeId!,
              attendanceDate: todayObj,
            },
          },
        });

        if (todayRecord) {
          if (todayRecord.checkOutAt !== null) {
            throw new AppError(
              409,
              'ATTENDANCE_ALREADY_CHECKED_OUT',
              'Today attendance has already been completed'
            );
          }
          if (todayRecord.status === 'ABSENT') {
            throw new AppError(
              409,
              'ATTENDANCE_ALREADY_RECORDED',
              'Today is recorded as absent'
            );
          }
        }

        throw new AppError(
          404,
          'ATTENDANCE_NOT_FOUND',
          'No open attendance record found for today'
        );
      }

      // Check if open record belongs to today
      const openRecordDateStr = formatDateToYYYYMMDD(openRecord.attendanceDate);
      if (openRecordDateStr !== todayBusinessDate) {
        throw new AppError(
          422,
          'ATTENDANCE_OVERNIGHT_UNSUPPORTED',
          'Automatic check-out cannot cross company business date boundary'
        );
      }

      if (!openRecord.checkInAt || now <= openRecord.checkInAt) {
        throw new AppError(
          400,
          'INVALID_ATTENDANCE_TIMES',
          'Check-out time must be later than check-in time'
        );
      }

      const { workedMinutes, overtimeMinutes } = calculateMinutes(
        openRecord.checkInAt,
        now,
        openRecord
      );

      const beforeDto = toAttendanceDto(openRecord, { omitEditorEmail: user.role === 'EMPLOYEE' });

      const updated = (await tx.attendance.update({
        where: { id: openRecord.id },
        data: {
          checkOutAt: now,
          workedMinutes,
          overtimeMinutes,
        },
        include: attendanceInclude,
      })) as AttendanceWithRelations;

      const afterDto = toAttendanceDto(updated, { omitEditorEmail: user.role === 'EMPLOYEE' });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'ATTENDANCE_CHECKED_OUT',
          entityType: 'ATTENDANCE',
          entityId: updated.id,
          before: beforeDto as unknown as Prisma.InputJsonValue,
          after: afterDto as unknown as Prisma.InputJsonValue,
        },
      });

      return afterDto;
    });
  }

  /**
   * HR action: POST /api/v1/attendance
   */
  async createManualAttendance(
    actorUser: AuthenticatedUser,
    input: ManualAttendanceInput
  ): Promise<AttendanceDto> {
    const targetEmployee = await this.prisma.employee.findUnique({
      where: { id: input.employeeId },
      select: { status: true },
    });
    if (!targetEmployee || targetEmployee.status !== 'ACTIVE') {
      throw new AppError(422, 'ATTENDANCE_EMPLOYEE_INACTIVE', 'Employee is inactive');
    }

    const companyToday = getCompanyBusinessDate(this.clock.now(), this.clock.timeZone);
    if (input.attendanceDate > companyToday) {
      throw new AppError(400, 'INVALID_ATTENDANCE_DATE', 'Attendance date cannot be in the future');
    }

    let checkInAt: Date | null = null;
    let checkOutAt: Date | null = null;

    if (input.kind === 'WORKED') {
      if (!input.checkInAt) {
        throw new AppError(400, 'INVALID_ATTENDANCE_INPUT', 'Check-in time is required for worked attendance');
      }
      checkInAt = new Date(input.checkInAt);
      if (!isInstantOnBusinessDate(checkInAt, input.attendanceDate, this.clock.timeZone)) {
        throw new AppError(
          400,
          'INVALID_ATTENDANCE_TIMES',
          'Check-in time must fall on the attendance business date'
        );
      }

      if (input.checkOutAt) {
        checkOutAt = new Date(input.checkOutAt);
        if (!isInstantOnBusinessDate(checkOutAt, input.attendanceDate, this.clock.timeZone)) {
          throw new AppError(
            422,
            'ATTENDANCE_OVERNIGHT_UNSUPPORTED',
            'Check-out time must fall on the same business date'
          );
        }
        if (checkOutAt <= checkInAt) {
          throw new AppError(
            400,
            'INVALID_ATTENDANCE_TIMES',
            'Check-out time must be later than check-in time'
          );
        }
      }
    }

    const { workingScheduleId, snapshot } = await this.resolveScheduleSnapshot(
      input.employeeId,
      input.attendanceDate
    );

    let status = deriveAttendanceStatus('WORKED', null, snapshot.expectedStartMinute);
    let workedMinutes = 0;
    let overtimeMinutes = 0;

    if (input.kind === 'ABSENT') {
      if (snapshot.expectedMinutes === 0) {
        throw new AppError(
          400,
          'ABSENT_ON_NON_WORKING_DAY',
          'Cannot record absent on a non-working day'
        );
      }
      status = 'ABSENT';
      workedMinutes = 0;
      overtimeMinutes = 0;
      checkInAt = null;
      checkOutAt = null;
    } else if (checkInAt) {
      const checkInMinute = getCompanyMinuteOfDay(checkInAt, this.clock.timeZone);
      status = deriveAttendanceStatus('WORKED', checkInMinute, snapshot.expectedStartMinute);
      const mins = calculateMinutes(checkInAt, checkOutAt, snapshot);
      workedMinutes = mins.workedMinutes;
      overtimeMinutes = mins.overtimeMinutes;
    }

    const dateObj = new Date(`${input.attendanceDate}T00:00:00.000Z`);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.attendance.findUnique({
        where: {
          employeeId_attendanceDate: {
            employeeId: input.employeeId,
            attendanceDate: dateObj,
          },
        },
      });

      if (existing) {
        throw new AppError(
          409,
          'ATTENDANCE_DATE_CONFLICT',
          'An attendance record already exists for this employee and date'
        );
      }

      try {
        const created = (await tx.attendance.create({
          data: {
            employeeId: input.employeeId,
            attendanceDate: dateObj,
            checkInAt,
            checkOutAt,
            status,
            workedMinutes,
            overtimeMinutes,
            workingScheduleId,
            expectedStartMinute: snapshot.expectedStartMinute,
            expectedEndMinute: snapshot.expectedEndMinute,
            expectedBreakMinutes: snapshot.expectedBreakMinutes,
            expectedMinutes: snapshot.expectedMinutes,
            manuallyEdited: true,
            lastEditedByUserId: actorUser.id,
            lastEditedAt: this.clock.now(),
          },
          include: attendanceInclude,
        })) as AttendanceWithRelations;

        const dto = toAttendanceDto(created);

        await tx.auditLog.create({
          data: {
            actorId: actorUser.id,
            action: 'ATTENDANCE_MANUALLY_CREATED',
            entityType: 'ATTENDANCE',
            entityId: created.id,
            before: Prisma.JsonNull,
            after: {
              ...dto,
              reason: input.reason,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        return dto;
      } catch (err: any) {
        if (err?.code === 'P2002') {
          throw new AppError(
            409,
            'ATTENDANCE_DATE_CONFLICT',
            'An attendance record already exists for this employee and date'
          );
        }
        throw err;
      }
    });
  }

  /**
   * HR action: PATCH /api/v1/attendance/:id/correction
   */
  async correctAttendance(
    actorUser: AuthenticatedUser,
    id: string,
    input: AttendanceCorrectionInput
  ): Promise<AttendanceDto> {
    const existing = (await this.prisma.attendance.findUnique({
      where: { id },
      include: attendanceInclude,
    })) as AttendanceWithRelations | null;

    if (!existing) {
      throw new AppError(404, 'ATTENDANCE_NOT_FOUND', 'Attendance record not found');
    }

    const attendanceDateStr = formatDateToYYYYMMDD(existing.attendanceDate);

    let checkInAt: Date | null = null;
    let checkOutAt: Date | null = null;

    if (input.kind === 'WORKED') {
      if (!input.checkInAt) {
        throw new AppError(400, 'INVALID_ATTENDANCE_INPUT', 'Check-in time is required for worked attendance');
      }
      checkInAt = new Date(input.checkInAt);
      if (!isInstantOnBusinessDate(checkInAt, attendanceDateStr, this.clock.timeZone)) {
        throw new AppError(
          400,
          'INVALID_ATTENDANCE_TIMES',
          'Check-in time must fall on the attendance business date'
        );
      }

      if (input.checkOutAt) {
        checkOutAt = new Date(input.checkOutAt);
        if (!isInstantOnBusinessDate(checkOutAt, attendanceDateStr, this.clock.timeZone)) {
          throw new AppError(
            422,
            'ATTENDANCE_OVERNIGHT_UNSUPPORTED',
            'Check-out time must fall on the same business date'
          );
        }
        if (checkOutAt <= checkInAt) {
          throw new AppError(
            400,
            'INVALID_ATTENDANCE_TIMES',
            'Check-out time must be later than check-in time'
          );
        }
      }
    }

    let status = existing.status;
    let workedMinutes = 0;
    let overtimeMinutes = 0;

    if (input.kind === 'ABSENT') {
      if (existing.expectedMinutes === 0) {
        throw new AppError(
          400,
          'ABSENT_ON_NON_WORKING_DAY',
          'Cannot mark absent on a non-working day'
        );
      }
      status = 'ABSENT';
      workedMinutes = 0;
      overtimeMinutes = 0;
      checkInAt = null;
      checkOutAt = null;
    } else if (checkInAt) {
      const checkInMinute = getCompanyMinuteOfDay(checkInAt, this.clock.timeZone);
      status = deriveAttendanceStatus('WORKED', checkInMinute, existing.expectedStartMinute);
      const mins = calculateMinutes(checkInAt, checkOutAt, existing);
      workedMinutes = mins.workedMinutes;
      overtimeMinutes = mins.overtimeMinutes;
    }

    return this.prisma.$transaction(async (tx) => {
      const beforeDto = toAttendanceDto(existing);

      const updated = (await tx.attendance.update({
        where: { id },
        data: {
          checkInAt,
          checkOutAt,
          status,
          workedMinutes,
          overtimeMinutes,
          manuallyEdited: true,
          lastEditedByUserId: actorUser.id,
          lastEditedAt: this.clock.now(),
        },
        include: attendanceInclude,
      })) as AttendanceWithRelations;

      const afterDto = toAttendanceDto(updated);

      await tx.auditLog.create({
        data: {
          actorId: actorUser.id,
          action: 'ATTENDANCE_CORRECTED',
          entityType: 'ATTENDANCE',
          entityId: id,
          before: beforeDto as unknown as Prisma.InputJsonValue,
          after: {
            ...afterDto,
            reason: input.reason,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      return afterDto;
    });
  }

  /**
   * List records with filters and role access.
   */
  async listAttendance(
    actorUser: AuthenticatedUser,
    query: AttendanceListQuery
  ): Promise<AttendanceListResponse> {
    const where: Prisma.AttendanceWhereInput = {};

    if (actorUser.role === 'EMPLOYEE') {
      if (!actorUser.employeeId) {
        throw new AppError(
          403,
          'EMPLOYEE_PROFILE_NOT_LINKED',
          'Your user account is not linked to an employee profile'
        );
      }
      where.employeeId = actorUser.employeeId;
    } else if (query.employeeId) {
      where.employeeId = query.employeeId;
    }

    if (query.departmentId) {
      where.employee = {
        departmentId: query.departmentId,
      };
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.flag) {
      if (query.flag === 'OVERTIME') {
        where.overtimeMinutes = { gt: 0 };
      } else if (query.flag === 'MISSING_CHECK_OUT') {
        where.checkInAt = { not: null };
        where.checkOutAt = null;
      } else if (query.flag === 'MANUALLY_EDITED') {
        where.manuallyEdited = true;
      }
    }

    if (query.date) {
      where.attendanceDate = new Date(`${query.date}T00:00:00.000Z`);
    } else if (query.dateFrom || query.dateTo) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (query.dateFrom) {
        dateFilter.gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
      }
      if (query.dateTo) {
        dateFilter.lte = new Date(`${query.dateTo}T00:00:00.000Z`);
      }
      where.attendanceDate = dateFilter;
    }

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { employee: { firstName: { contains: search, mode: 'insensitive' } } },
        { employee: { lastName: { contains: search, mode: 'insensitive' } } },
        { employee: { employeeNumber: { contains: search, mode: 'insensitive' } } },
      ];
    }

    let orderBy: Prisma.AttendanceOrderByWithRelationInput[] = [];
    const order = query.order ?? 'desc';

    switch (query.sort) {
      case 'employee':
        orderBy = [
          { employee: { lastName: order } },
          { employee: { firstName: order } },
          { id: 'asc' },
        ];
        break;
      case 'checkInAt':
        orderBy = [{ checkInAt: order }, { id: 'asc' }];
        break;
      case 'checkOutAt':
        orderBy = [{ checkOutAt: order }, { id: 'asc' }];
        break;
      case 'workedMinutes':
        orderBy = [{ workedMinutes: order }, { id: 'asc' }];
        break;
      case 'overtimeMinutes':
        orderBy = [{ overtimeMinutes: order }, { id: 'asc' }];
        break;
      case 'status':
        orderBy = [{ status: order }, { id: 'asc' }];
        break;
      case 'attendanceDate':
      default:
        orderBy = [
          { attendanceDate: order },
          { employee: { lastName: 'asc' } },
          { employee: { firstName: 'asc' } },
          { id: 'asc' },
        ];
        break;
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [records, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        include: attendanceInclude,
      }),
      this.prisma.attendance.count({ where }),
    ]);

    const isEmployee = actorUser.role === 'EMPLOYEE';
    const items = (records as AttendanceWithRelations[]).map((r) =>
      toAttendanceDto(r, { omitEditorEmail: isEmployee })
    );

    return {
      items,
      page,
      pageSize,
      total,
    };
  }

  /**
   * Get attendance by ID with ownership enforcement.
   */
  async getAttendanceById(
    actorUser: AuthenticatedUser,
    id: string
  ): Promise<AttendanceDto> {
    const record = (await this.prisma.attendance.findUnique({
      where: { id },
      include: attendanceInclude,
    })) as AttendanceWithRelations | null;

    if (!record) {
      throw new AppError(404, 'ATTENDANCE_NOT_FOUND', 'Attendance record not found');
    }

    if (actorUser.role === 'EMPLOYEE') {
      if (record.employeeId !== actorUser.employeeId) {
        throw new AppError(
          403,
          'ATTENDANCE_ACCESS_DENIED',
          'You do not have permission to view this attendance record'
        );
      }
    }

    return toAttendanceDto(record, { omitEditorEmail: actorUser.role === 'EMPLOYEE' });
  }
}
