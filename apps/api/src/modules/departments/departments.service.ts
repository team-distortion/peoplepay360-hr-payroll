import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import type {
  DepartmentDto,
  DepartmentInput,
  DepartmentQuery,
} from '@peoplepay360/shared';
import { normalizeDepartmentNameKey } from '@peoplepay360/shared';
import type { Department, Prisma } from '@prisma/client';

export function toDepartmentDto(dept: Department): DepartmentDto {
  return {
    id: dept.id,
    name: dept.name,
    status: dept.status,
    createdAt: dept.createdAt.toISOString(),
    updatedAt: dept.updatedAt.toISOString(),
  };
}

export async function listDepartments(query: DepartmentQuery): Promise<DepartmentDto[]> {
  const where: Prisma.DepartmentWhereInput = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.search && query.search.trim().length > 0) {
    where.name = {
      contains: query.search.trim(),
      mode: 'insensitive',
    };
  }

  const departments = await prisma.department.findMany({
    where,
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });

  return departments.map(toDepartmentDto);
}

export async function getDepartmentById(id: string): Promise<DepartmentDto> {
  const department = await prisma.department.findUnique({
    where: { id },
  });

  if (!department) {
    throw new AppError(404, 'DEPARTMENT_NOT_FOUND', 'Department not found');
  }

  return toDepartmentDto(department);
}

export async function createDepartment(input: DepartmentInput): Promise<DepartmentDto> {
  const nameKey = normalizeDepartmentNameKey(input.name);

  const existing = await prisma.department.findUnique({
    where: { nameKey },
  });

  if (existing) {
    throw new AppError(
      409,
      'DEPARTMENT_NAME_EXISTS',
      'A department with this name already exists'
    );
  }

  try {
    const created = await prisma.department.create({
      data: {
        name: input.name.trim(),
        nameKey,
        status: input.status,
      },
    });

    return toDepartmentDto(created);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      throw new AppError(
        409,
        'DEPARTMENT_NAME_EXISTS',
        'A department with this name already exists'
      );
    }
    throw error;
  }
}

export async function updateDepartment(
  id: string,
  input: DepartmentInput
): Promise<DepartmentDto> {
  const department = await prisma.department.findUnique({
    where: { id },
  });

  if (!department) {
    throw new AppError(404, 'DEPARTMENT_NOT_FOUND', 'Department not found');
  }

  const nameKey = normalizeDepartmentNameKey(input.name);

  // Check if name is taken by another department
  const duplicate = await prisma.department.findFirst({
    where: {
      nameKey,
      id: { not: id },
    },
  });

  if (duplicate) {
    throw new AppError(
      409,
      'DEPARTMENT_NAME_EXISTS',
      'A department with this name already exists'
    );
  }

  // Check if deactivating department that has active employees
  if (department.status === 'ACTIVE' && input.status === 'INACTIVE') {
    const activeEmployeesCount = await prisma.employee.count({
      where: {
        departmentId: id,
        status: 'ACTIVE',
      },
    });

    if (activeEmployeesCount > 0) {
      throw new AppError(
        409,
        'DEPARTMENT_IN_USE',
        'Cannot deactivate department with active employees assigned'
      );
    }
  }

  try {
    const updated = await prisma.department.update({
      where: { id },
      data: {
        name: input.name.trim(),
        nameKey,
        status: input.status,
      },
    });

    return toDepartmentDto(updated);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      throw new AppError(
        409,
        'DEPARTMENT_NAME_EXISTS',
        'A department with this name already exists'
      );
    }
    throw error;
  }
}
