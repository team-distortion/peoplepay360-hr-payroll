import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import type {
  SalaryStructureDetailDto,
  SalaryStructureInput,
  SalaryStructureListItemDto,
  SalaryStructureListQuery,
  SalaryStructureListResponse,
  RecordStatus,
} from '@peoplepay360/shared';
import { normalizeStructureNameKey } from '@peoplepay360/shared';
import type { Prisma } from '@prisma/client';
import {
  toSalaryStructureDetailDto,
  toSalaryStructureListItemDto,
} from './salary-config.mapper.js';
import { validateProspectiveStructureRules } from './salary-rule-dependencies.js';

export async function listSalaryStructures(
  query: SalaryStructureListQuery
): Promise<SalaryStructureListResponse> {
  const page = query.page && query.page >= 1 ? query.page : 1;
  const pageSize =
    query.pageSize && query.pageSize >= 1 && query.pageSize <= 100
      ? query.pageSize
      : 20;
  const skip = (page - 1) * pageSize;

  const where: Prisma.SalaryStructureWhereInput = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.search && query.search.trim().length > 0) {
    const term = query.search.trim();
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { description: { contains: term, mode: 'insensitive' } },
    ];
  }

  const [totalItems, structures] = await Promise.all([
    prisma.salaryStructure.count({ where }),
    prisma.salaryStructure.findMany({
      where,
      include: {
        rules: {
          select: { id: true, status: true },
        },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip,
      take: pageSize,
    }),
  ]);

  const items: SalaryStructureListItemDto[] = structures.map(toSalaryStructureListItemDto);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  return {
    items,
    pagination: {
      totalItems,
      page,
      pageSize,
      totalPages,
    },
  };
}

export async function getSalaryStructureById(
  id: string,
  options: { includeInactiveRules?: boolean } = {}
): Promise<SalaryStructureDetailDto> {
  const includeInactive = options.includeInactiveRules !== false;

  const structure = await prisma.salaryStructure.findUnique({
    where: { id },
    include: {
      rules: {
        where: includeInactive ? undefined : { status: 'ACTIVE' },
        orderBy: [{ sequence: 'asc' }, { id: 'asc' }],
      },
    },
  });

  if (!structure) {
    throw new AppError(
      404,
      'SALARY_STRUCTURE_NOT_FOUND',
      `Salary structure with ID "${id}" was not found`
    );
  }

  return toSalaryStructureDetailDto(structure);
}

export async function createSalaryStructure(
  input: SalaryStructureInput
): Promise<SalaryStructureDetailDto> {
  const trimmedName = input.name.trim();
  const nameKey = normalizeStructureNameKey(trimmedName);

  const existing = await prisma.salaryStructure.findUnique({
    where: { nameKey },
  });

  if (existing) {
    throw new AppError(
      409,
      'SALARY_STRUCTURE_NAME_EXISTS',
      `A salary structure named "${trimmedName}" already exists`
    );
  }

  try {
    const created = await prisma.salaryStructure.create({
      data: {
        name: trimmedName,
        nameKey,
        description: input.description?.trim() || null,
        status: input.status,
      },
      include: {
        rules: true,
      },
    });

    return toSalaryStructureDetailDto(created);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      throw new AppError(
        409,
        'SALARY_STRUCTURE_NAME_EXISTS',
        `A salary structure named "${trimmedName}" already exists`
      );
    }
    throw error;
  }
}

export async function updateSalaryStructure(
  id: string,
  input: SalaryStructureInput
): Promise<SalaryStructureDetailDto> {
  const structure = await prisma.salaryStructure.findUnique({
    where: { id },
    include: {
      rules: {
        orderBy: [{ sequence: 'asc' }, { id: 'asc' }],
      },
    },
  });

  if (!structure) {
    throw new AppError(
      404,
      'SALARY_STRUCTURE_NOT_FOUND',
      `Salary structure with ID "${id}" was not found`
    );
  }

  const trimmedName = input.name.trim();
  const nameKey = normalizeStructureNameKey(trimmedName);

  if (nameKey !== structure.nameKey) {
    const duplicate = await prisma.salaryStructure.findFirst({
      where: {
        nameKey,
        id: { not: id },
      },
    });

    if (duplicate) {
      throw new AppError(
        409,
        'SALARY_STRUCTURE_NAME_EXISTS',
        `A salary structure named "${trimmedName}" already exists`
      );
    }
  }

  // Activating an inactive structure requires at least 1 active rule and valid dependencies
  if (structure.status === 'INACTIVE' && input.status === 'ACTIVE') {
    const activeRules = structure.rules.filter((r) => r.status === 'ACTIVE');
    if (activeRules.length === 0) {
      throw new AppError(
        409,
        'SALARY_STRUCTURE_INVALID',
        'Cannot activate salary structure: at least one active rule is required'
      );
    }

    try {
      validateProspectiveStructureRules(
        structure.rules.map((r) => ({
          id: r.id,
          code: r.code,
          sequence: r.sequence,
          status: r.status,
          method: r.method,
          percentageBase: r.percentageBase,
          formula: r.formula,
        }))
      );
    } catch (err) {
      if (err instanceof AppError) {
        throw new AppError(
          409,
          'SALARY_STRUCTURE_INVALID',
          `Cannot activate salary structure: ${err.message}`,
          err.details
        );
      }
      throw err;
    }
  }

  try {
    const updated = await prisma.salaryStructure.update({
      where: { id },
      data: {
        name: trimmedName,
        nameKey,
        description: input.description?.trim() || null,
        status: input.status,
      },
      include: {
        rules: {
          orderBy: [{ sequence: 'asc' }, { id: 'asc' }],
        },
      },
    });

    return toSalaryStructureDetailDto(updated);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      throw new AppError(
        409,
        'SALARY_STRUCTURE_NAME_EXISTS',
        `A salary structure named "${trimmedName}" already exists`
      );
    }
    throw error;
  }
}

export async function updateSalaryStructureStatus(
  id: string,
  status: RecordStatus
): Promise<SalaryStructureDetailDto> {
  const structure = await prisma.salaryStructure.findUnique({
    where: { id },
    include: {
      rules: {
        orderBy: [{ sequence: 'asc' }, { id: 'asc' }],
      },
    },
  });

  if (!structure) {
    throw new AppError(
      404,
      'SALARY_STRUCTURE_NOT_FOUND',
      `Salary structure with ID "${id}" was not found`
    );
  }

  if (status === 'ACTIVE') {
    const activeRules = structure.rules.filter((r) => r.status === 'ACTIVE');
    if (activeRules.length === 0) {
      throw new AppError(
        409,
        'SALARY_STRUCTURE_INVALID',
        'Cannot activate salary structure: at least one active rule is required'
      );
    }

    try {
      validateProspectiveStructureRules(
        structure.rules.map((r) => ({
          id: r.id,
          code: r.code,
          sequence: r.sequence,
          status: r.status,
          method: r.method,
          percentageBase: r.percentageBase,
          formula: r.formula,
        }))
      );
    } catch (err) {
      if (err instanceof AppError) {
        throw new AppError(
          409,
          'SALARY_STRUCTURE_INVALID',
          `Cannot activate salary structure: ${err.message}`,
          err.details
        );
      }
      throw err;
    }
  }

  const updated = await prisma.salaryStructure.update({
    where: { id },
    data: { status },
    include: {
      rules: {
        orderBy: [{ sequence: 'asc' }, { id: 'asc' }],
      },
    },
  });

  return toSalaryStructureDetailDto(updated);
}
