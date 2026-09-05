import type { Request, Response, NextFunction } from 'express';
import type {
  ApiResponse,
  ContractDetailDto,
  ContractListResponse,
} from '@peoplepay360/shared';
import {
  ContractIdParamSchema,
  ContractInputSchema,
  ContractListQuerySchema,
} from './contract.schemas.js';
import * as contractService from './contract.service.js';
import { AppError } from '../../errors/app-error.js';

export async function listContracts(
  req: Request,
  res: Response<ApiResponse<ContractListResponse>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
    }

    const parseResult = ContractListQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      throw new AppError(
        400,
        'INVALID_CONTRACT_INPUT',
        'Validation failed for query parameters',
        { fields: parseResult.error.flatten().fieldErrors }
      );
    }

    // Role-based scoping
    let scopedEmployeeId: string | undefined;
    if (req.user.role === 'EMPLOYEE') {
      if (!req.user.employeeId) {
        throw new AppError(
          403,
          'EMPLOYEE_PROFILE_NOT_LINKED',
          'User account is not linked to an employee profile'
        );
      }
      scopedEmployeeId = req.user.employeeId;
    }

    const result = await contractService.listContracts(parseResult.data, scopedEmployeeId);

    res.status(200).json({
      data: result,
      error: null,
    });
  } catch (error) {
    next(error);
  }
}

export async function getContractById(
  req: Request,
  res: Response<ApiResponse<ContractDetailDto>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
    }

    const paramResult = ContractIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      throw new AppError(400, 'INVALID_CONTRACT_INPUT', 'Invalid contract ID parameter');
    }

    let scopedEmployeeId: string | undefined;
    if (req.user.role === 'EMPLOYEE') {
      if (!req.user.employeeId) {
        throw new AppError(
          403,
          'EMPLOYEE_PROFILE_NOT_LINKED',
          'User account is not linked to an employee profile'
        );
      }
      scopedEmployeeId = req.user.employeeId;
    }

    const contract = await contractService.getContractById(
      paramResult.data.id,
      scopedEmployeeId
    );

    res.status(200).json({
      data: contract,
      error: null,
    });
  } catch (error) {
    next(error);
  }
}

export async function createContract(
  req: Request,
  res: Response<ApiResponse<ContractDetailDto>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
    }

    if (req.user.role === 'EMPLOYEE') {
      throw new AppError(
        403,
        'CONTRACT_ACCESS_DENIED',
        'Employees are not authorized to create contracts'
      );
    }

    const parseResult = ContractInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      const fieldErrors = parseResult.error.flatten().fieldErrors;
      // If the error specifically concerns the date period
      if (fieldErrors.endDate && fieldErrors.endDate.some((m) => m.includes('earlier'))) {
        throw new AppError(
          400,
          'INVALID_CONTRACT_PERIOD',
          'End date cannot be earlier than start date',
          { fields: fieldErrors }
        );
      }
      throw new AppError(
        400,
        'INVALID_CONTRACT_INPUT',
        'Validation failed for contract input',
        { fields: fieldErrors }
      );
    }

    const created = await contractService.createContract(parseResult.data, req.user.id);

    res.status(201).json({
      data: created,
      error: null,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateContract(
  req: Request,
  res: Response<ApiResponse<ContractDetailDto>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
    }

    if (req.user.role === 'EMPLOYEE') {
      throw new AppError(
        403,
        'CONTRACT_ACCESS_DENIED',
        'Employees are not authorized to update contracts'
      );
    }

    const paramResult = ContractIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      throw new AppError(400, 'INVALID_CONTRACT_INPUT', 'Invalid contract ID parameter');
    }

    const parseResult = ContractInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      const fieldErrors = parseResult.error.flatten().fieldErrors;
      if (fieldErrors.endDate && fieldErrors.endDate.some((m) => m.includes('earlier'))) {
        throw new AppError(
          400,
          'INVALID_CONTRACT_PERIOD',
          'End date cannot be earlier than start date',
          { fields: fieldErrors }
        );
      }
      throw new AppError(
        400,
        'INVALID_CONTRACT_INPUT',
        'Validation failed for contract input',
        { fields: fieldErrors }
      );
    }

    const updated = await contractService.updateContract(
      paramResult.data.id,
      parseResult.data,
      req.user.id
    );

    res.status(200).json({
      data: updated,
      error: null,
    });
  } catch (error) {
    next(error);
  }
}

export async function getSalaryStructuresSelector(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const structures = await contractService.getActiveSalaryStructuresSelector();
    res.status(200).json({
      data: structures,
      error: null,
    });
  } catch (error) {
    next(error);
  }
}
