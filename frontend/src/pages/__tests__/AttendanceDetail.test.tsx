import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AttendanceDetailPage from '../AttendanceDetail';
import type { AttendanceDetailDto } from '@peoplepay360/shared';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'att-test-123' }),
  useNavigate: () => vi.fn(),
}));

// Mock AppLayout
vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));

// Mock AuthContext
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-hr', role: 'HR_MANAGER', email: 'hr.manager@peoplepay360.dev' },
  }),
}));

// Mock queries
const mockUseAttendanceDetail = vi.fn();
vi.mock('@/features/attendance/attendance.queries', () => ({
  useAttendanceDetail: (id: string | undefined) => mockUseAttendanceDetail(id),
  useCreateAttendanceMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCorrectAttendanceMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/features/employees/employees.queries', () => ({
  useEmployees: () => ({ data: { items: [] } }),
}));

describe('AttendanceDetailPage UI Reason Display', () => {
  const baseRecord: AttendanceDetailDto = {
    id: 'att-test-123',
    employee: {
      id: 'emp-1',
      employeeNumber: 'EMP0001',
      fullName: 'Neha Kapoor',
    },
    department: {
      id: 'dept-1',
      name: 'Executive',
    },
    manager: null,
    attendanceDate: '2026-08-28',
    checkInAt: '2026-08-28T03:30:00.000Z',
    checkOutAt: '2026-08-28T12:30:00.000Z',
    status: 'PRESENT',
    workedMinutes: 480,
    overtimeMinutes: 0,
    workingSchedule: {
      id: 'sched-1',
      name: 'Standard 40 Hours',
    },
    expectedStartMinute: 540,
    expectedEndMinute: 1080,
    expectedBreakMinutes: 60,
    expectedMinutes: 480,
    flags: ['MANUALLY_EDITED'],
    manuallyEdited: true,
    lastEditedBy: {
      id: 'user-admin',
      email: 'admin@peoplepay360.dev',
    },
    lastEditedAt: '2026-08-28T13:00:00.000Z',
    lastEditReason: 'Biometric fingerprint reader malfunctioned during check-in',
    createdAt: '2026-08-28T03:30:00.000Z',
    updatedAt: '2026-08-28T13:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays the latest correction reason as Reason: <comment> in the Manually Edited card', () => {
    mockUseAttendanceDetail.mockReturnValue({
      data: baseRecord,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<AttendanceDetailPage />);

    // Verify "Manually Edited" title is present
    expect(screen.getByText('Manually Edited')).toBeInTheDocument();
    expect(screen.getByText('By: admin@peoplepay360.dev')).toBeInTheDocument();

    // Verify Reason: <comment> is displayed
    const reasonElement = screen.getByTestId('last-edit-reason');
    expect(reasonElement).toBeInTheDocument();
    expect(reasonElement).toHaveTextContent(
      'Reason: Biometric fingerprint reader malfunctioned during check-in'
    );
  });

  it('renders Manually Edited card without reason when lastEditReason is null', () => {
    mockUseAttendanceDetail.mockReturnValue({
      data: {
        ...baseRecord,
        lastEditReason: null,
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<AttendanceDetailPage />);

    expect(screen.getByText('Manually Edited')).toBeInTheDocument();
    expect(screen.queryByTestId('last-edit-reason')).not.toBeInTheDocument();
  });

  it('does not display Manually Edited card or reason when manuallyEdited is false', () => {
    mockUseAttendanceDetail.mockReturnValue({
      data: {
        ...baseRecord,
        flags: [],
        manuallyEdited: false,
        lastEditedBy: null,
        lastEditedAt: null,
        lastEditReason: null,
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<AttendanceDetailPage />);

    expect(screen.queryByText('Manually Edited')).not.toBeInTheDocument();
    expect(screen.queryByTestId('last-edit-reason')).not.toBeInTheDocument();
  });
});
