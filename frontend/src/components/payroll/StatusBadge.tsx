const statusConfig: Record<string, { bg: string; text: string }> = {
  DRAFT:     { bg: 'bg-amber-50 border border-amber-200', text: 'text-amber-700' },
  COMPUTED:  { bg: 'bg-blue-50 border border-blue-200',   text: 'text-blue-700' },
  VALIDATED: { bg: 'bg-indigo-50 border border-indigo-200', text: 'text-indigo-700' },
  PAID:      { bg: 'bg-emerald-50 border border-emerald-200', text: 'text-emerald-700' },
  Draft:     { bg: 'bg-amber-50 border border-amber-200', text: 'text-amber-700' },
  Computed:  { bg: 'bg-blue-50 border border-blue-200',   text: 'text-blue-700' },
  Validated: { bg: 'bg-indigo-50 border border-indigo-200', text: 'text-indigo-700' },
  Done:      { bg: 'bg-emerald-50 border border-emerald-200', text: 'text-emerald-700' },
  Paid:      { bg: 'bg-emerald-50 border border-emerald-200', text: 'text-emerald-700' },
  Active:    { bg: 'bg-emerald-50 border border-emerald-200', text: 'text-emerald-700' },
  Inactive:  { bg: 'bg-gray-100 border border-gray-200',  text: 'text-gray-500' },
};

export default function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? statusConfig[status.toUpperCase()] ?? statusConfig.DRAFT;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      {status}
    </span>
  );
}
