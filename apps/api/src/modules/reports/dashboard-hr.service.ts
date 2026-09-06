import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import { Prisma, type EmployeeType } from '@prisma/client';
import type { DashboardFiltersQuery } from './dashboard.schemas.js';
import type {
  DashboardHrResponseDto,
  DashboardAttendanceSectionDto,
  DashboardTimeOffSectionDto,
  DepartmentHeadcountDto,
  DashboardAlertItemDto,
} from './dashboard.types.js';
import {
  generateDateRange,
  getWeekdayFromDateString,
} from './dashboard-date.service.js';

export async function getDashboardHrMetrics(
  filters: DashboardFiltersQuery
): Promise<DashboardHrResponseDto> {
  const { periodStart, periodEnd, departmentId, employeeType } = filters;

  // Validate department if provided
  if (departmentId) {
    const dept = await prisma.department.findUnique({
      where: { id: departmentId },
    });
    if (!dept) {
      throw new AppError(404, 'DEPARTMENT_NOT_FOUND', 'Department not found');
    }
  }

  const periodStartDate = new Date(periodStart);
  const periodEndDate = new Date(periodEnd);

  // Employee filter condition
  const employeeWhere: Prisma.EmployeeWhereInput = {
    status: 'ACTIVE',
    ...(departmentId ? { departmentId } : {}),
    ...(employeeType ? { employeeType } : {}),
  };

  // 1. Headcount
  const headcount = await prisma.employee.count({
    where: employeeWhere,
  });

  // 2. Department Headcount Breakdown
  const activeDepartments = await prisma.department.findMany({
    where: departmentId ? { id: departmentId } : undefined,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      employees: {
        where: {
          status: 'ACTIVE',
          ...(employeeType ? { employeeType } : {}),
        },
        select: { id: true },
      },
    },
  });

  const departmentHeadcount: DepartmentHeadcountDto[] = activeDepartments.map((d) => ({
    departmentId: d.id,
    departmentName: d.name,
    headcount: d.employees.length,
  }));

  // Also check employees without a department if no specific department was filtered
  if (!departmentId) {
    const unassignedCount = await prisma.employee.count({
      where: {
        status: 'ACTIVE',
        departmentId: null,
        ...(employeeType ? { employeeType } : {}),
      },
    });
    if (unassignedCount > 0) {
      departmentHeadcount.push({
        departmentId: null,
        departmentName: 'Unassigned',
        headcount: unassignedCount,
      });
    }
  }

  // 3. Attendance Status Totals & Aggregate
  const attendanceWhere: Prisma.AttendanceWhereInput = {
    attendanceDate: {
      gte: periodStartDate,
      lte: periodEndDate,
    },
    employee: {
      ...(departmentId ? { departmentId } : {}),
      ...(employeeType ? { employeeType } : {}),
    },
  };

  const attendancesInPeriod = await prisma.attendance.findMany({
    where: attendanceWhere,
    select: {
      id: true,
      employeeId: true,
      attendanceDate: true,
      status: true,
      overtimeMinutes: true,
      checkInAt: true,
      checkOutAt: true,
      manuallyEdited: true,
    },
  });

  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  let overtimeMinutesSum = 0;
  let missingCheckOutsCount = 0;
  let manualEditsCount = 0;

  // Key: `${employeeId}_${YYYY-MM-DD}` -> status
  const attendanceRecordMap = new Map<string, string>();

  for (const att of attendancesInPeriod) {
    if (att.status === 'PRESENT') presentCount++;
    else if (att.status === 'LATE') lateCount++;
    else if (att.status === 'ABSENT') absentCount++;

    overtimeMinutesSum += att.overtimeMinutes ?? 0;

    if (att.checkInAt && !att.checkOutAt) {
      missingCheckOutsCount++;
    }

    if (att.manuallyEdited) {
      manualEditsCount++;
    }

    const dateStr = att.attendanceDate.toISOString().slice(0, 10);
    attendanceRecordMap.set(`${att.employeeId}_${dateStr}`, att.status);
  }

  // 4. Attendance Coverage Calculation
  // Active employees in scope with their schedules, contracts, and approved time off
  const employeesForCoverage = await prisma.employee.findMany({
    where: employeeWhere,
    select: {
      id: true,
      workingSchedule: {
        select: {
          id: true,
          days: {
            select: {
              dayOfWeek: true,
            },
          },
        },
      },
      contracts: {
        where: {
          startDate: { lte: periodEndDate },
          OR: [{ endDate: null }, { endDate: { gte: periodStartDate } }],
        },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          workingSchedule: {
            select: {
              id: true,
              days: {
                select: {
                  dayOfWeek: true,
                },
              },
            },
          },
        },
        orderBy: { startDate: 'desc' },
      },
      timeOffRequests: {
        where: {
          status: 'APPROVED',
          unitSnapshot: 'DAY',
          startDate: { lte: periodEndDate },
          endDate: { gte: periodStartDate },
        },
        select: {
          startDate: true,
          endDate: true,
        },
      },
    },
  });

  const allDates = generateDateRange(periodStart, periodEnd);
  let expectedDays = 0;
  let coveredDays = 0;

  for (const emp of employeesForCoverage) {
    for (const dateStr of allDates) {
      const dateObj = new Date(dateStr);
      const weekday = getWeekdayFromDateString(dateStr);

      // Check if employee has contract covering date
      let effectiveSchedule = emp.workingSchedule;
      const matchingContract = emp.contracts.find(
        (c) =>
          c.startDate <= dateObj &&
          (c.endDate === null || c.endDate >= dateObj)
      );

      if (matchingContract?.workingSchedule) {
        effectiveSchedule = matchingContract.workingSchedule;
      }

      if (!effectiveSchedule) continue;

      const isWorkingDay = effectiveSchedule.days.some((d) => d.dayOfWeek === weekday);
      if (!isWorkingDay) continue;

      // Exclude approved full-day Time Off
      const hasFullDayTimeOff = emp.timeOffRequests.some(
        (to) =>
          to.startDate <= dateObj &&
          to.endDate >= dateObj
      );
      if (hasFullDayTimeOff) continue;

      expectedDays++;

      const attStatus = attendanceRecordMap.get(`${emp.id}_${dateStr}`);
      if (attStatus === 'PRESENT' || attStatus === 'LATE') {
        coveredDays++;
      }
    }
  }

  const hasCoverageData = expectedDays > 0;
  const coveragePercent = hasCoverageData
    ? ((coveredDays / expectedDays) * 100).toFixed(4)
    : '0.0000';

  const attendanceSection: DashboardAttendanceSectionDto = {
    expectedDays,
    coveredDays,
    coveragePercent,
    hasCoverageData,
    present: presentCount,
    late: lateCount,
    absent: absentCount,
    overtimeMinutes: overtimeMinutesSum,
    missingCheckOuts: missingCheckOutsCount,
    manualEdits: manualEditsCount,
  };

  // 5. Time Off Metrics
  const timeOffRequests = await prisma.timeOffRequest.findMany({
    where: {
      startDate: { lte: periodEndDate },
      endDate: { gte: periodStartDate },
      employee: {
        ...(departmentId ? { departmentId } : {}),
        ...(employeeType ? { employeeType } : {}),
      },
    },
    select: {
      id: true,
      status: true,
      unitSnapshot: true,
      requestedUnits: true,
    },
  });

  let approvedRequestCount = 0;
  let pendingRequestCount = 0;
  let approvedDayUnitsDecimal = new Prisma.Decimal(0);
  let approvedHourUnitsDecimal = new Prisma.Decimal(0);

  for (const tor of timeOffRequests) {
    if (tor.status === 'APPROVED') {
      approvedRequestCount++;
      if (tor.unitSnapshot === 'DAY') {
        approvedDayUnitsDecimal = approvedDayUnitsDecimal.plus(tor.requestedUnits);
      } else if (tor.unitSnapshot === 'HOUR') {
        approvedHourUnitsDecimal = approvedHourUnitsDecimal.plus(tor.requestedUnits);
      }
    } else if (tor.status === 'PENDING') {
      pendingRequestCount++;
    }
  }

  // Usable allocation count
  const usableAllocationCount = await prisma.timeOffAllocation.count({
    where: {
      status: 'APPROVED',
      validFrom: { lte: periodEndDate },
      validTo: { gte: periodStartDate },
      employee: {
        ...(departmentId ? { departmentId } : {}),
        ...(employeeType ? { employeeType } : {}),
      },
    },
  });

  const timeOffSection: DashboardTimeOffSectionDto = {
    approvedRequestCount,
    approvedDayUnits: approvedDayUnitsDecimal.toFixed(2),
    approvedHourUnits: approvedHourUnitsDecimal.toFixed(2),
    pendingRequestCount,
    usableAllocationCount,
  };

  // 6. HR Alerts
  const hrAlerts: DashboardAlertItemDto[] = [];

  // A. CONTRACT_EXPIRING
  const expiringContractsCount = await prisma.contract.count({
    where: {
      endDate: {
        gte: periodStartDate,
        lte: periodEndDate,
      },
      employee: {
        ...(departmentId ? { departmentId } : {}),
        ...(employeeType ? { employeeType } : {}),
      },
    },
  });

  if (expiringContractsCount > 0) {
    hrAlerts.push({
      code: 'CONTRACT_EXPIRING',
      severity: 'warning',
      count: expiringContractsCount,
      label: 'Contracts Expiring',
      safeSummary: `${expiringContractsCount} contract(s) expiring within the selected period`,
      deepLink: '/contracts',
    });
  }

  // B. ATTENDANCE_MISSING_CHECKOUT
  if (missingCheckOutsCount > 0) {
    hrAlerts.push({
      code: 'ATTENDANCE_MISSING_CHECKOUT',
      severity: 'error',
      count: missingCheckOutsCount,
      label: 'Missing Check-Outs',
      safeSummary: `${missingCheckOutsCount} attendance record(s) missing check-out in period`,
      deepLink: '/attendance',
    });
  }

  // C. PENDING_TIME_OFF_REQUEST
  if (pendingRequestCount > 0) {
    hrAlerts.push({
      code: 'PENDING_TIME_OFF_REQUEST',
      severity: 'warning',
      count: pendingRequestCount,
      label: 'Pending Time Off Requests',
      safeSummary: `${pendingRequestCount} time off request(s) awaiting approval`,
      deepLink: '/time-off/requests',
    });
  }

  return {
    headcount,
    attendance: attendanceSection,
    timeOff: timeOffSection,
    departmentHeadcount,
    hrAlerts,
  };
}
