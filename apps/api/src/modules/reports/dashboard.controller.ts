import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import { EmployeeTypeValues } from '@peoplepay360/shared';
import { dashboardFiltersSchema } from './dashboard.schemas.js';
import { getDashboardHrMetrics } from './dashboard-hr.service.js';
import { getDashboardPayrollMetrics } from './dashboard-payroll.service.js';
import {
  mapFilterOptionsResponse,
  mapHrDashboardResponse,
  mapPayrollDashboardResponse,
} from './dashboard.mapper.js';
import type { DashboardFilterOptionsDto } from './dashboard.types.js';

export async function getDashboardFiltersHandler(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Fetch departments (ordered by name)
    const departments = await prisma.department.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });

    // 2. Find min/max available dates across Payrun, Attendance, Contract
    const [minPayrun, maxPayrun, minAtt, maxAtt, minCon, maxCon] = await Promise.all([
      prisma.payrun.findFirst({ orderBy: { periodStart: 'asc' }, select: { periodStart: true } }),
      prisma.payrun.findFirst({ orderBy: { periodEnd: 'desc' }, select: { periodEnd: true } }),
      prisma.attendance.findFirst({ orderBy: { attendanceDate: 'asc' }, select: { attendanceDate: true } }),
      prisma.attendance.findFirst({ orderBy: { attendanceDate: 'desc' }, select: { attendanceDate: true } }),
      prisma.contract.findFirst({ orderBy: { startDate: 'asc' }, select: { startDate: true } }),
      prisma.contract.findFirst({
        where: { endDate: { not: null } },
        orderBy: { endDate: 'desc' },
        select: { endDate: true },
      }),
    ]);

    const minDates = [
      minPayrun?.periodStart,
      minAtt?.attendanceDate,
      minCon?.startDate,
    ].filter(Boolean) as Date[];

    const maxDates = [
      maxPayrun?.periodEnd,
      maxAtt?.attendanceDate,
      maxCon?.endDate,
    ].filter(Boolean) as Date[];

    const minAvailableDate =
      minDates.length > 0
        ? new Date(Math.min(...minDates.map((d) => d.getTime())))
            .toISOString()
            .slice(0, 10)
        : null;

    const maxAvailableDate =
      maxDates.length > 0
        ? new Date(Math.max(...maxDates.map((d) => d.getTime())))
            .toISOString()
            .slice(0, 10)
        : null;

    const options: DashboardFilterOptionsDto = {
      departments,
      employeeTypes: [...EmployeeTypeValues],
      minAvailableDate,
      maxAvailableDate,
    };

    res.json(mapFilterOptionsResponse(options));
  } catch (error) {
    next(error);
  }
}

export async function getDashboardHrHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parseResult = dashboardFiltersSchema.safeParse(req.query);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      throw new AppError(
        400,
        'INVALID_DASHBOARD_FILTERS',
        issue?.message || 'Invalid dashboard filters query parameters'
      );
    }

    const hrData = await getDashboardHrMetrics(parseResult.data);
    res.json(mapHrDashboardResponse(hrData));
  } catch (error) {
    next(error);
  }
}

export async function getDashboardPayrollHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parseResult = dashboardFiltersSchema.safeParse(req.query);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      throw new AppError(
        400,
        'INVALID_DASHBOARD_FILTERS',
        issue?.message || 'Invalid dashboard filters query parameters'
      );
    }

    const payrollData = await getDashboardPayrollMetrics(parseResult.data);
    res.json(mapPayrollDashboardResponse(payrollData));
  } catch (error) {
    next(error);
  }
}
