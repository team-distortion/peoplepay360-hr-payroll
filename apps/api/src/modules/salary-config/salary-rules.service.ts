import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import type {
  SalaryRuleConfigurationInput,
  SalaryRuleDto,
  SalaryRuleInput,
  SalaryRuleListQuery,
  SalaryRuleListResponse,
  SalaryStructureDetailDto,
  RecordStatus,
} from '@peoplepay360/shared';
import type { Prisma } from '@prisma/client';
import {
  toSalaryRuleDto,
  toSalaryStructureDetailDto,
  extractFormulaIdentifiers,
} from './salary-config.mapper.js';
import { validateProspectiveStructureRules } from './salary-rule-dependencies.js';

export async function listSalaryRules(
  query: SalaryRuleListQuery
): Promise<SalaryRuleListResponse> {
  const page = query.page && query.page >= 1 ? query.page : 1;
  const pageSize =
    query.pageSize && query.pageSize >= 1 && query.pageSize <= 100
      ? query.pageSize
      : 20;
  const skip = (page - 1) * pageSize;

  const where: Prisma.SalaryRuleWhereInput = {};

  if (query.salaryStructureId) {
    where.salaryStructureId = query.salaryStructureId;
  }

  if (query.category) {
    where.category = query.category;
  }

  if (query.method) {
    where.method = query.method;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.search && query.search.trim().length > 0) {
    const term = query.search.trim();
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { code: { contains: term, mode: 'insensitive' } },
    ];
  }

  const [totalItems, rules] = await Promise.all([
    prisma.salaryRule.count({ where }),
    prisma.salaryRule.findMany({
      where,
      include: {
        salaryStructure: {
          select: { id: true, name: true },
        },
      },
      orderBy: [
        { salaryStructure: { name: 'asc' } },
        { sequence: 'asc' },
        { id: 'asc' },
      ],
      skip,
      take: pageSize,
    }),
  ]);

  const items: SalaryRuleDto[] = rules.map(toSalaryRuleDto);
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

export async function getSalaryRuleById(id: string): Promise<SalaryRuleDto> {
  const rule = await prisma.salaryRule.findUnique({
    where: { id },
    include: {
      salaryStructure: {
        select: { id: true, name: true },
      },
    },
  });

  if (!rule) {
    throw new AppError(
      404,
      'SALARY_RULE_NOT_FOUND',
      `Salary rule with ID "${id}" was not found`
    );
  }

  return toSalaryRuleDto(rule);
}

export async function createSalaryRule(
  structureId: string,
  input: SalaryRuleInput
): Promise<SalaryRuleDto> {
  const structure = await prisma.salaryStructure.findUnique({
    where: { id: structureId },
    include: {
      rules: true,
    },
  });

  if (!structure) {
    throw new AppError(
      404,
      'SALARY_STRUCTURE_NOT_FOUND',
      `Salary structure with ID "${structureId}" was not found`
    );
  }

  const trimmedCode = input.code.trim().toUpperCase();

  // Prospective rules: existing rules + prospective new rule
  const prospectiveRules = [
    ...structure.rules.map((r) => ({
      id: r.id,
      code: r.code,
      sequence: r.sequence,
      status: r.status,
      method: r.method,
      percentageBase: r.percentageBase,
      formula: r.formula,
    })),
    {
      id: null,
      code: trimmedCode,
      sequence: input.sequence,
      status: input.status,
      method: input.method,
      percentageBase: input.percentageBase,
      formula: input.formula,
    },
  ];

  validateProspectiveStructureRules(prospectiveRules);

  try {
    const created = await prisma.salaryRule.create({
      data: {
        salaryStructureId: structureId,
        name: input.name.trim(),
        code: trimmedCode,
        category: input.category,
        sequence: input.sequence,
        method: input.method,
        fixedAmount: input.fixedAmount ? input.fixedAmount : null,
        percentageRate: input.percentageRate ? input.percentageRate : null,
        percentageBase: input.percentageBase ? input.percentageBase.trim().toUpperCase() : null,
        formula: input.formula ? input.formula.trim() : null,
        status: input.status,
      },
      include: {
        salaryStructure: {
          select: { id: true, name: true },
        },
      },
    });

    return toSalaryRuleDto(created);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      const target = (error.meta?.target as string[]) || [];
      if (target.includes('code')) {
        throw new AppError(
          409,
          'SALARY_RULE_CODE_EXISTS',
          `Rule code "${trimmedCode}" already exists in this structure`
        );
      }
      if (target.includes('sequence')) {
        throw new AppError(
          409,
          'SALARY_RULE_SEQUENCE_EXISTS',
          `Rule sequence "${input.sequence}" already exists in this structure`
        );
      }
    }
    throw error;
  }
}

export async function updateSalaryRule(
  id: string,
  input: SalaryRuleInput
): Promise<SalaryRuleDto> {
  const existing = await prisma.salaryRule.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError(
      404,
      'SALARY_RULE_NOT_FOUND',
      `Salary rule with ID "${id}" was not found`
    );
  }

  const structure = await prisma.salaryStructure.findUnique({
    where: { id: existing.salaryStructureId },
    include: {
      rules: true,
    },
  });

  if (!structure) {
    throw new AppError(
      404,
      'SALARY_STRUCTURE_NOT_FOUND',
      'Associated salary structure was not found'
    );
  }

  const trimmedCode = input.code.trim().toUpperCase();

  // Prospective structure rules replacing this rule
  const prospectiveRules = structure.rules.map((r) => {
    if (r.id === id) {
      return {
        id,
        code: trimmedCode,
        sequence: input.sequence,
        status: input.status,
        method: input.method,
        percentageBase: input.percentageBase,
        formula: input.formula,
      };
    }
    return {
      id: r.id,
      code: r.code,
      sequence: r.sequence,
      status: r.status,
      method: r.method,
      percentageBase: r.percentageBase,
      formula: r.formula,
    };
  });

  validateProspectiveStructureRules(prospectiveRules);

  try {
    const updated = await prisma.salaryRule.update({
      where: { id },
      data: {
        name: input.name.trim(),
        code: trimmedCode,
        category: input.category,
        sequence: input.sequence,
        method: input.method,
        fixedAmount: input.fixedAmount ? input.fixedAmount : null,
        percentageRate: input.percentageRate ? input.percentageRate : null,
        percentageBase: input.percentageBase ? input.percentageBase.trim().toUpperCase() : null,
        formula: input.formula ? input.formula.trim() : null,
        status: input.status,
      },
      include: {
        salaryStructure: {
          select: { id: true, name: true },
        },
      },
    });

    return toSalaryRuleDto(updated);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      const target = (error.meta?.target as string[]) || [];
      if (target.includes('code')) {
        throw new AppError(
          409,
          'SALARY_RULE_CODE_EXISTS',
          `Rule code "${trimmedCode}" already exists in this structure`
        );
      }
      if (target.includes('sequence')) {
        throw new AppError(
          409,
          'SALARY_RULE_SEQUENCE_EXISTS',
          `Rule sequence "${input.sequence}" already exists in this structure`
        );
      }
    }
    throw error;
  }
}

export async function updateSalaryRuleStatus(
  id: string,
  status: RecordStatus
): Promise<SalaryRuleDto> {
  const existing = await prisma.salaryRule.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError(
      404,
      'SALARY_RULE_NOT_FOUND',
      `Salary rule with ID "${id}" was not found`
    );
  }

  if (existing.status === status) {
    return getSalaryRuleById(id);
  }

  const structure = await prisma.salaryStructure.findUnique({
    where: { id: existing.salaryStructureId },
    include: {
      rules: true,
    },
  });

  if (!structure) {
    throw new AppError(
      404,
      'SALARY_STRUCTURE_NOT_FOUND',
      'Associated salary structure was not found'
    );
  }

  // If deactivating, check if active downstream rules reference this code
  if (status === 'INACTIVE') {
    const activeDependents = structure.rules.filter((r) => {
      if (r.id === id || r.status !== 'ACTIVE') return false;
      if (r.method === 'PERCENTAGE' && r.percentageBase === existing.code) return true;
      if (r.method === 'FORMULA' && r.formula) {
        const ids = extractFormulaIdentifiers(r.formula);
        return ids.includes(existing.code);
      }
      return false;
    });

    if (activeDependents.length > 0) {
      const dependentCodes = activeDependents.map((d) => d.code).join(', ');
      throw new AppError(
        409,
        'SALARY_RULE_CODE_IN_USE',
        `Cannot deactivate salary rule "${existing.code}": active rules (${dependentCodes}) depend on it`,
        { ruleCode: existing.code, dependentCodes: activeDependents.map((d) => d.code) }
      );
    }
  }

  // Prospective graph validation
  const prospectiveRules = structure.rules.map((r) => {
    if (r.id === id) {
      return {
        id,
        code: r.code,
        sequence: r.sequence,
        status,
        method: r.method,
        percentageBase: r.percentageBase,
        formula: r.formula,
      };
    }
    return {
      id: r.id,
      code: r.code,
      sequence: r.sequence,
      status: r.status,
      method: r.method,
      percentageBase: r.percentageBase,
      formula: r.formula,
    };
  });

  validateProspectiveStructureRules(prospectiveRules);

  const updated = await prisma.salaryRule.update({
    where: { id },
    data: { status },
    include: {
      salaryStructure: {
        select: { id: true, name: true },
      },
    },
  });

  return toSalaryRuleDto(updated);
}

export async function updateSalaryRuleConfiguration(
  structureId: string,
  input: SalaryRuleConfigurationInput
): Promise<SalaryStructureDetailDto> {
  const structure = await prisma.salaryStructure.findUnique({
    where: { id: structureId },
    include: {
      rules: true,
    },
  });

  if (!structure) {
    throw new AppError(
      404,
      'SALARY_STRUCTURE_NOT_FOUND',
      `Salary structure with ID "${structureId}" was not found`
    );
  }

  const existingRulesMap = new Map(structure.rules.map((r) => [r.id, r]));
  const seenExistingIds = new Set<string>();

  // Verify all provided existing IDs belong to this structure
  for (const rule of input.rules) {
    if (rule.id !== null) {
      if (!existingRulesMap.has(rule.id)) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          `Rule ID "${rule.id}" does not belong to salary structure "${structureId}"`,
          { invalidRuleId: rule.id }
        );
      }
      if (seenExistingIds.has(rule.id)) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          `Rule ID "${rule.id}" is duplicated in configuration payload`,
          { duplicateRuleId: rule.id }
        );
      }
      seenExistingIds.add(rule.id);
    }
  }

  // Every existing rule in DB must appear in payload (omission is rejected)
  if (seenExistingIds.size !== existingRulesMap.size) {
    const missingIds = Array.from(existingRulesMap.keys()).filter(
      (id) => !seenExistingIds.has(id)
    );
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `All existing rules must be included in configuration update. Missing rules: ${missingIds.join(', ')}`,
      { missingRuleIds: missingIds }
    );
  }

  // Prospective structure rules validation
  const prospectiveRules = input.rules.map((r) => ({
    id: r.id,
    code: r.code.trim().toUpperCase(),
    sequence: r.sequence,
    status: r.status,
    method: r.method,
    percentageBase: r.percentageBase,
    formula: r.formula,
  }));

  validateProspectiveStructureRules(prospectiveRules);

  // If the structure is ACTIVE, verify it still has at least 1 active rule
  if (structure.status === 'ACTIVE') {
    const activeCount = input.rules.filter((r) => r.status === 'ACTIVE').length;
    if (activeCount === 0) {
      throw new AppError(
        409,
        'SALARY_STRUCTURE_INVALID',
        'Active salary structure must have at least one active rule'
      );
    }
  }

  // Atomic database transaction with two-stage temporary sequence update
  await prisma.$transaction(async (tx) => {
    // Collect all sequences currently used or planned
    const usedSequences = new Set<number>([
      ...structure.rules.map((r) => r.sequence),
      ...input.rules.map((r) => r.sequence),
    ]);

    // Stage 1: Temporarily assign unused numbers from 1,000,000 downwards
    // to prevent transient uniqueness violations while satisfying 0 < sequence <= 1000000
    let tempSeq = 1_000_000;
    for (const existingRule of structure.rules) {
      while (usedSequences.has(tempSeq) && tempSeq > 1) {
        tempSeq--;
      }
      usedSequences.add(tempSeq);
      await tx.salaryRule.update({
        where: { id: existingRule.id },
        data: { sequence: tempSeq },
      });
    }

    // Stage 2: Upsert / update each rule with its target configuration
    for (const ruleInput of input.rules) {
      const trimmedCode = ruleInput.code.trim().toUpperCase();
      const ruleData = {
        name: ruleInput.name.trim(),
        code: trimmedCode,
        category: ruleInput.category,
        sequence: ruleInput.sequence,
        method: ruleInput.method,
        fixedAmount: ruleInput.fixedAmount ? ruleInput.fixedAmount : null,
        percentageRate: ruleInput.percentageRate ? ruleInput.percentageRate : null,
        percentageBase: ruleInput.percentageBase
          ? ruleInput.percentageBase.trim().toUpperCase()
          : null,
        formula: ruleInput.formula ? ruleInput.formula.trim() : null,
        status: ruleInput.status,
      };

      if (ruleInput.id !== null) {
        await tx.salaryRule.update({
          where: { id: ruleInput.id },
          data: ruleData,
        });
      } else {
        await tx.salaryRule.create({
          data: {
            ...ruleData,
            salaryStructureId: structureId,
          },
        });
      }
    }
  });

  // Return complete ordered structure detail
  const updatedStructure = await prisma.salaryStructure.findUniqueOrThrow({
    where: { id: structureId },
    include: {
      rules: {
        orderBy: [{ sequence: 'asc' }, { id: 'asc' }],
      },
    },
  });

  return toSalaryStructureDetailDto(updatedStructure);
}
