import type { PayrunStatus, PayslipStatus } from './mockData';

const statusConfig: Record<string, { bg: string; text: string }> = {
  Draft:     { bg: 'bg-gray-100',  text: 'text-gray-600' },
  Validated: { bg: 'bg-blue-100',  text: 'text-blue-700' },
  Done:      { bg: 'bg-green-100', text: 'text-green-700' },
  Paid:      { bg: 'bg-green-100', text: 'text-green-700' },
  Active:    { bg: 'bg-green-100', text: 'text-green-700' },
  Inactive:  { bg: 'bg-gray-100',  text: 'text-gray-500' },
};

export default function StatusBadge({ status }: { status: PayrunStatus | PayslipStatus | 'Active' | 'Inactive' }) {
  const cfg = statusConfig[status] ?? statusConfig.Draft;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      {status}
    </span>
  );
}
