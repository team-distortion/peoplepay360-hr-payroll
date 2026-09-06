import type { Request, Response, NextFunction } from 'express';
import {
  listPayslips,
  getPayslipById,
  getPayslipPdf,
  acknowledgeWarning,
} from './payslip.service.js';
import {
  ListPayslipsQuerySchema,
  PayslipIdParamSchema,
  WarningIdParamSchema,
  WarningAcknowledgementInputSchema,
  GetPdfQuerySchema,
} from './payroll.schemas.js';
import type { ApiResponse } from '@peoplepay360/shared';

export async function listPayslipsHandler(
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction
): Promise<void> {
  try {
    const query = ListPayslipsQuerySchema.parse(req.query);
    const result = await listPayslips(query);
    res.status(200).json({ data: result, error: null });
  } catch (error) {
    next(error);
  }
}

export async function getPayslipByIdHandler(
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = PayslipIdParamSchema.parse(req.params);
    const result = await getPayslipById(id);
    res.status(200).json({ data: result, error: null });
  } catch (error) {
    next(error);
  }
}

export async function getPayslipPdfHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = PayslipIdParamSchema.parse(req.params);
    const { download } = GetPdfQuerySchema.parse(req.query);
    const { buffer, filename, isPreview } = await getPayslipPdf(id);

    res.setHeader('Content-Type', 'application/pdf');
    const disposition = download ? 'attachment' : 'inline';
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);

    if (isPreview) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    } else {
      res.setHeader('Cache-Control', 'private, max-age=86400');
    }

    res.status(200).send(buffer);
  } catch (error) {
    next(error);
  }
}

export async function acknowledgeWarningHandler(
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = WarningIdParamSchema.parse(req.params);
    const { reason } = WarningAcknowledgementInputSchema.parse(req.body);
    const result = await acknowledgeWarning(id, req.user!.id, reason);
    res.status(200).json({ data: result, error: null });
  } catch (error) {
    next(error);
  }
}
