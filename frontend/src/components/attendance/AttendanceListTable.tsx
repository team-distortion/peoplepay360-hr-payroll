import { useNavigate } from 'react-router-dom';

export interface AttendanceRecord {
  id: string;
  employeeName: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  workedHours: number;
  status: 'Present' | 'Absent' | 'Late' | 'Half Day' | 'On Leave';
  department: string;
  manager: string;
  overtime: number;
}

interface AttendanceListTableProps {
  records: AttendanceRecord[];
}

export default function AttendanceListTable({ records }: AttendanceListTableProps) {
  const navigate = useNavigate();

  const getStatusColor = (status: AttendanceRecord['status']) => {
    switch (status) {
      case 'Present': return 'bg-green-100 text-green-700 border-green-200';
      case 'Absent': return 'bg-red-100 text-red-700 border-red-200';
      case 'Late': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Half Day': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'On Leave': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden mx-6 my-6 shadow-sm">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-border bg-surface/50">
            <th className="px-6 py-3 text-xs font-semibold text-slate uppercase tracking-wider">Employee</th>
            <th className="px-6 py-3 text-xs font-semibold text-slate uppercase tracking-wider">Check In</th>
            <th className="px-6 py-3 text-xs font-semibold text-slate uppercase tracking-wider">Check Out</th>
            <th className="px-6 py-3 text-xs font-semibold text-slate uppercase tracking-wider">Worked Hours</th>
            <th className="px-6 py-3 text-xs font-semibold text-slate uppercase tracking-wider">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {records.map((record) => (
            <tr 
              key={record.id}
              onClick={() => navigate(`/attendance/${record.id}`)}
              className="group hover:bg-surface/50 transition-colors cursor-pointer"
            >
              <td className="px-6 py-4">
                <div className="font-medium text-navy">{record.employeeName}</div>
                <div className="text-xs text-muted">{record.date}</div>
              </td>
              <td className="px-6 py-4 text-sm text-navy">
                {record.checkIn ? record.checkIn : <span className="text-muted">—</span>}
              </td>
              <td className="px-6 py-4 text-sm text-navy">
                {record.checkOut ? record.checkOut : <span className="text-muted">—</span>}
              </td>
              <td className="px-6 py-4 text-sm">
                <span className={`tabular-nums ${(!record.checkIn || !record.checkOut) && record.status !== 'Absent' ? 'text-red-500 font-semibold' : 'text-navy'}`}>
                  {record.workedHours.toFixed(2)}
                </span>
              </td>
              <td className="px-6 py-4 text-sm">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(record.status)}`}>
                  {record.status}
                </span>
              </td>
            </tr>
          ))}
          {records.length === 0 && (
            <tr>
              <td colSpan={5} className="px-6 py-12 text-center text-slate">
                No attendance records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="px-6 py-3 bg-surface/30 border-t border-border text-xs text-muted">
        Useful note: list view should help users review raw check-in / check-out data and identify missing punches quickly.
      </div>
    </div>
  );
}
