import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import AttendanceToolbar from '../components/attendance/AttendanceToolbar';
import AttendanceListTable from '../components/attendance/AttendanceListTable';
import { useAuth } from '@/context/AuthContext';
import { useAttendanceList } from '@/features/attendance/attendance.queries';
import type { AttendanceStatus, AttendanceFlag } from '@peoplepay360/shared';

export default function AttendancePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  // URL state
  const employeeIdParam = searchParams.get('employeeId') || '';
  const searchParam = searchParams.get('search') || '';
  const statusParam = (searchParams.get('status') as AttendanceStatus) || '';
  const flagParam = (searchParams.get('flag') as AttendanceFlag) || '';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);

  // Local state for search bar
  const [searchQuery, setSearchQuery] = useState(searchParam);

  // Debounce search update to URL
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (searchQuery.trim()) {
          next.set('search', searchQuery.trim());
        } else {
          next.delete('search');
        }
        next.set('page', '1');
        return next;
      });
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery, setSearchParams]);

  // Keep local search input in sync if URL changes externally
  useEffect(() => {
    setSearchQuery(searchParam);
  }, [searchParam]);

  const queryPayload = useMemo(() => {
    return {
      employeeId: employeeIdParam || undefined,
      search: searchParam || undefined,
      status: statusParam || undefined,
      flag: flagParam || undefined,
      page: pageParam,
      pageSize: 20,
    };
  }, [employeeIdParam, searchParam, statusParam, flagParam, pageParam]);

  const { data, isLoading, isError, error, refetch } = useAttendanceList(queryPayload);

  const canCreate =
    user?.role === 'ADMIN' ||
    user?.role === 'HR_MANAGER' ||
    user?.role === 'HR_PAYROLL_USER' ||
    user?.role === 'HR_PAYROLL_MANAGER';

  const handleStatusChange = (val: AttendanceStatus | '') => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val) {
        next.set('status', val);
      } else {
        next.delete('status');
      }
      next.set('page', '1');
      return next;
    });
  };

  const handleFlagChange = (val: AttendanceFlag | '') => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val) {
        next.set('flag', val);
      } else {
        next.delete('flag');
      }
      next.set('page', '1');
      return next;
    });
  };

  const handlePageChange = (newPage: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('page', String(newPage));
      return next;
    });
  };

  // Build filter chips
  const filterChips = useMemo(() => {
    const chips: { id: string; label: string }[] = [];
    if (employeeIdParam) {
      chips.push({ id: 'employeeId', label: `Employee Filter Active` });
    }
    if (statusParam) {
      chips.push({ id: 'status', label: `Status: ${statusParam}` });
    }
    if (flagParam) {
      chips.push({ id: 'flag', label: `Flag: ${flagParam}` });
    }
    return chips;
  }, [employeeIdParam, statusParam, flagParam]);

  const handleRemoveFilterChip = (id: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(id);
      next.set('page', '1');
      return next;
    });
  };

  return (
    <AppLayout>
      <div className="flex flex-col flex-1 bg-surface/30">
        <div className="px-6 py-6 pb-4">
          <h1 className="text-2xl font-bold text-navy">Attendance</h1>
          <p className="text-slate text-xs">
            Operational review of check-ins, worked durations, and schedule overtime
          </p>
        </div>

        <AttendanceToolbar
          onNew={() => navigate('/attendance/new')}
          canCreate={canCreate}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusParam}
          setStatusFilter={handleStatusChange}
          flagFilter={flagParam}
          setFlagFilter={handleFlagChange}
          filterChips={filterChips}
          onRemoveFilterChip={handleRemoveFilterChip}
        />

        <div className="flex-1">
          <AttendanceListTable
            records={data?.items ?? []}
            isLoading={isLoading}
            isError={isError}
            errorMessage={(error as Error)?.message}
            onRetry={() => refetch()}
            page={data?.page ?? pageParam}
            pageSize={data?.pageSize ?? 20}
            total={data?.total ?? 0}
            onPageChange={handlePageChange}
          />
        </div>
      </div>
    </AppLayout>
  );
}
