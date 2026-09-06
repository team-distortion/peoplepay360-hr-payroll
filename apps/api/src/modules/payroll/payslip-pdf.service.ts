import PDFDocument from 'pdfkit';

export interface PayslipPdfData {
  companyName: string;
  payrunNumber: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  generatedAt: string;
  status: 'DRAFT' | 'COMPUTED' | 'VALIDATED' | 'PAID';
  isPreview: boolean;

  employee: {
    number: string;
    name: string;
    department: string | null;
    jobPosition: string | null;
  };

  contract: {
    number: string;
    structureName: string;
    monthlyWage: string;
  };

  attendance: {
    expectedDays: number;
    workedDays: number;
    expectedHours: string;
    workedHours: string;
    overtimeHours: string;
  };

  bank: {
    accountName: string | null;
    maskedAccountNumber: string | null;
    bankName: string | null;
    ifsc: string | null;
  };

  lines: Array<{
    category: string;
    code: string;
    name: string;
    amount: string;
  }>;

  summaries: {
    proratedBasic: string;
    basic: string;
    allowance: string;
    overtime: string;
    deduction: string;
    gross: string;
    net: string;
  };

  hasAcknowledgedWarnings?: boolean;
}

export function generatePayslipPdf(data: PayslipPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `Payslip-${data.employee.number}-${data.periodStart}`,
          Author: data.companyName,
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // Optional Watermark for Preview
      if (data.isPreview) {
        doc.save();
        doc.rotate(-45, { origin: [300, 420] });
        doc.fontSize(48).fillColor('#E2E8F0').opacity(0.4);
        doc.text('PREVIEW - NOT VALIDATED', 80, 400, { align: 'center' });
        doc.restore();
      }

      // Reset styles
      doc.fillColor('#1E293B').opacity(1.0);

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text(data.companyName, 40, 40);
      doc.fontSize(12).font('Helvetica').fillColor('#64748B').text('Official Salary Statement', 40, 65);

      doc.fontSize(16).font('Helvetica-Bold').fillColor('#0F172A').text('PAYSLIP', 400, 40, { align: 'right' });
      doc.fontSize(10).font('Helvetica').fillColor('#64748B').text(`Payrun: ${data.payrunNumber}`, 400, 62, { align: 'right' });
      doc.text(`Period: ${data.periodStart} to ${data.periodEnd}`, 400, 76, { align: 'right' });

      // Horizontal Divider
      doc.moveTo(40, 95).lineTo(555, 95).strokeColor('#CBD5E1').lineWidth(1).stroke();

      // Employee & Employment Details (2 Columns)
      const col1X = 40;
      const col2X = 300;
      let y = 110;

      doc.fontSize(10).font('Helvetica-Bold').fillColor('#334155').text('EMPLOYEE DETAILS', col1X, y);
      doc.text('CONTRACT & SCHEDULE', col2X, y);
      y += 18;

      doc.font('Helvetica').fontSize(9).fillColor('#475569');
      doc.text(`Employee Name: ${data.employee.name}`, col1X, y);
      doc.text(`Contract No: ${data.contract.number}`, col2X, y);
      y += 14;

      doc.text(`Employee ID: ${data.employee.number}`, col1X, y);
      doc.text(`Salary Structure: ${data.contract.structureName}`, col2X, y);
      y += 14;

      doc.text(`Department: ${data.employee.department ?? 'N/A'}`, col1X, y);
      doc.text(`Monthly Wage: ${data.currency} ${data.contract.monthlyWage}`, col2X, y);
      y += 14;

      doc.text(`Designation: ${data.employee.jobPosition ?? 'N/A'}`, col1X, y);
      doc.text(`Prorated Basic: ${data.currency} ${data.summaries.proratedBasic}`, col2X, y);
      y += 24;

      // Attendance & Work Time Summary Box
      doc.rect(col1X, y, 515, 42).fillAndStroke('#F8FAFC', '#E2E8F0');
      doc.fillColor('#1E293B').fontSize(9).font('Helvetica-Bold');
      doc.text(`Expected Days: ${data.attendance.expectedDays}`, col1X + 15, y + 10);
      doc.text(`Worked Days: ${data.attendance.workedDays}`, col1X + 130, y + 10);
      doc.text(`Expected Hours: ${data.attendance.expectedHours}`, col1X + 230, y + 10);
      doc.text(`Worked Hours: ${data.attendance.workedHours}`, col1X + 340, y + 10);
      doc.text(`Overtime: ${data.attendance.overtimeHours} hrs`, col1X + 440, y + 10);

      y += 55;

      // Salary Line Items Table
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#334155').text('EARNINGS & DEDUCTIONS', col1X, y);
      y += 16;

      // Table Header
      doc.rect(col1X, y, 515, 20).fill('#F1F5F9');
      doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold');
      doc.text('CODE', col1X + 10, y + 6);
      doc.text('DESCRIPTION', col1X + 90, y + 6);
      doc.text('CATEGORY', col1X + 280, y + 6);
      doc.text(`AMOUNT (${data.currency})`, col1X + 400, y + 6, { width: 105, align: 'right' });

      y += 20;

      // Rows
      doc.font('Helvetica').fontSize(9).fillColor('#1E293B');
      for (const line of data.lines) {
        // Draw alternate row background if desired
        doc.text(line.code, col1X + 10, y + 5);
        doc.text(line.name, col1X + 90, y + 5);
        doc.text(line.category, col1X + 280, y + 5);
        doc.text(line.amount, col1X + 400, y + 5, { width: 105, align: 'right' });

        doc.moveTo(col1X, y + 18).lineTo(555, y + 18).strokeColor('#F1F5F9').lineWidth(0.5).stroke();
        y += 18;

        if (y > 700) {
          doc.addPage();
          y = 50;
        }
      }

      y += 15;

      // Summary Totals Box
      doc.rect(300, y, 255, 90).fillAndStroke('#F8FAFC', '#CBD5E1');
      doc.fillColor('#334155').fontSize(9).font('Helvetica');

      doc.text('Gross Earnings:', 315, y + 12);
      doc.font('Helvetica-Bold').text(`${data.currency} ${data.summaries.gross}`, 430, y + 12, { align: 'right', width: 110 });

      doc.font('Helvetica').text('Total Deductions:', 315, y + 28);
      doc.font('Helvetica-Bold').text(`- ${data.currency} ${data.summaries.deduction}`, 430, y + 28, { align: 'right', width: 110 });

      doc.moveTo(315, y + 46).lineTo(545, y + 46).strokeColor('#E2E8F0').lineWidth(1).stroke();

      doc.fontSize(11).font('Helvetica-Bold').fillColor('#0F172A').text('NET PAY:', 315, y + 58);
      doc.text(`${data.currency} ${data.summaries.net}`, 410, y + 58, { align: 'right', width: 130 });

      // Bank Details on the Left
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#334155').text('BANK DISBURSEMENT', col1X, y + 12);
      doc.font('Helvetica').fontSize(8).fillColor('#64748B');
      doc.text(`Bank Name: ${data.bank.bankName ?? 'N/A'}`, col1X, y + 28);
      doc.text(`Account No: ${data.bank.maskedAccountNumber ?? '•••• N/A'}`, col1X, y + 42);
      doc.text(`IFSC: ${data.bank.ifsc ?? 'N/A'}`, col1X, y + 56);

      y += 105;

      if (data.hasAcknowledgedWarnings) {
        doc.fontSize(8).font('Helvetica-Oblique').fillColor('#D97706');
        doc.text('* Notice: This payslip contains acknowledged administrative exceptions.', col1X, y);
        y += 14;
      }

      // Footer
      doc.fontSize(8).font('Helvetica').fillColor('#94A3B8');
      doc.text(`Generated on ${data.generatedAt} UTC. This is an official computer-generated document.`, col1X, 780, {
        align: 'center',
        width: 515,
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
