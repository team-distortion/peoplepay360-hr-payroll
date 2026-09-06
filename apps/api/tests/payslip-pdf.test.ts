import { describe, it, expect } from 'vitest';
import { generatePayslipPdf } from '../src/modules/payroll/payslip-pdf.service.js';

describe('Payslip PDF Generator', () => {
  it('generates a valid PDF buffer with %PDF header', async () => {
    const buffer = await generatePayslipPdf({
      companyName: 'PeoplePay360',
      payrunNumber: 'PAY/2026/000001',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      currency: 'INR',
      generatedAt: new Date().toISOString(),
      status: 'VALIDATED',
      isPreview: false,
      employee: {
        number: 'EMP001',
        name: 'Aarav Mehta',
        department: 'Engineering',
        jobPosition: 'Lead Architect',
      },
      contract: {
        number: 'CON/2026/0001',
        structureName: 'Regular Salary',
        monthlyWage: '85000.00',
      },
      attendance: {
        expectedDays: 22,
        workedDays: 22,
        expectedHours: '176.00',
        workedHours: '176.00',
        overtimeHours: '10.00',
      },
      bank: {
        accountName: 'Aarav Mehta',
        maskedAccountNumber: '•••• 4321',
        bankName: 'HDFC Bank',
        ifsc: 'HDFC0001234',
      },
      lines: [
        { category: 'BASIC', code: 'BASIC', name: 'Basic Salary', amount: '42500.00' },
        { category: 'ALLOWANCE', code: 'HRA', name: 'HRA', amount: '17000.00' },
        { category: 'GROSS', code: 'GROSS', name: 'Gross Total', amount: '59500.00' },
        { category: 'DEDUCTION', code: 'PF', name: 'Provident Fund', amount: '5100.00' },
        { category: 'NET', code: 'NET', name: 'Net Salary', amount: '54400.00' },
      ],
      summaries: {
        proratedBasic: '42500.00',
        basic: '42500.00',
        allowance: '17000.00',
        overtime: '0.00',
        deduction: '5100.00',
        gross: '59500.00',
        net: '54400.00',
      },
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
    // PDF Magic number: %PDF
    const header = buffer.subarray(0, 5).toString('ascii');
    expect(header).toMatch(/^%PDF-/);
  });

  it('generates a preview PDF buffer without throwing', async () => {
    const buffer = await generatePayslipPdf({
      companyName: 'PeoplePay360',
      payrunNumber: 'PAY/2026/000002',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      currency: 'INR',
      generatedAt: new Date().toISOString(),
      status: 'COMPUTED',
      isPreview: true, // triggers watermark
      employee: {
        number: 'EMP002',
        name: 'Sara Khan',
        department: 'Finance',
        jobPosition: 'Financial Analyst',
      },
      contract: {
        number: 'CON/2026/0002',
        structureName: 'Regular Salary',
        monthlyWage: '75000.00',
      },
      attendance: {
        expectedDays: 20,
        workedDays: 18,
        expectedHours: '160.00',
        workedHours: '144.00',
        overtimeHours: '0.00',
      },
      bank: {
        accountName: 'Sara Khan',
        maskedAccountNumber: '•••• 9876',
        bankName: 'ICICI Bank',
        ifsc: 'ICIC0005678',
      },
      lines: [
        { category: 'BASIC', code: 'BASIC', name: 'Basic Salary', amount: '37500.00' },
        { category: 'GROSS', code: 'GROSS', name: 'Gross Total', amount: '37500.00' },
        { category: 'NET', code: 'NET', name: 'Net Salary', amount: '37500.00' },
      ],
      summaries: {
        proratedBasic: '33750.00',
        basic: '37500.00',
        allowance: '0.00',
        overtime: '0.00',
        deduction: '0.00',
        gross: '37500.00',
        net: '37500.00',
      },
      hasAcknowledgedWarnings: true,
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
    const header = buffer.subarray(0, 5).toString('ascii');
    expect(header).toMatch(/^%PDF-/);
  });
});
