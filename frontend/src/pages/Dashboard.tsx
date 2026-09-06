import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import {
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ChevronDown,
  Users,
  IndianRupee,
  FileText,
  CalendarOff,
  Activity,
  ExternalLink,
} from 'lucide-react';
import { usePayrunsQuery, usePayslipsQuery } from '@/features/payroll/payroll.queries';
import { useEmployees } from '@/features/employees/employees.queries';
import { useDepartments } from '@/features/departments/departments.queries';

/* ─── Design tokens (from ui-context.md) ─────────────────────── */
const T = {
  bg: '#FFFFFF',
  surface: '#F6F9FC',
  navy: '#0A2540',
  slate: '#425466',
  muted: '#697386',
  border: '#E3E8EE',
  accent: '#635BFF',
  accentSoft: '#EDECFF',
  gradientEnd: '#00D4FF',
  success: '#3ECF8E',
  error: '#DF1B41',
  warning: '#FFA940',
};

/* ─── Mock data (per spec §3–§5) ─────────────────────────────── */
const SALARY_BY_DEPT = [
  { label: 'HR', value: 110 },
  { label: 'Sales', value: 150 },
  { label: 'Support', value: 90 },
  { label: 'Finance', value: 130 },
  { label: 'IT', value: 170 },
];

const SALARY_TREND = [
  { label: 'Apr', value: 13.2 },
  { label: 'May', value: 14.1 },
  { label: 'Jun', value: 13.8 },
  { label: 'Jul', value: 15.0 },
  { label: 'Aug', value: 16.2 },
  { label: 'Sep', value: 18.4 },
];

const PAYSLIP_STATUSES = [
  { label: 'Paid', value: 95, color: T.success },
  { label: 'Done', value: 32, color: T.accent },
  { label: 'Pending', value: 15, color: T.warning },
  { label: 'Warning', value: 6, color: T.error },
];

const PAYROLL_ALERTS = [
  { id: 1, text: '2 employees missing bank account', link: '/employees', severity: 'error' as const },
  { id: 2, text: '1 duplicate payslip warning', link: '/payroll/payslips', severity: 'error' as const },
  { id: 3, text: '4 drafts still not validated', link: '/payroll/payruns', severity: 'warning' as const },
  { id: 4, text: '3 contracts expiring this month', link: '/contracts', severity: 'warning' as const },
];

const ATTENDANCE_BARS = [
  { label: 'Present', value: 94, color: T.success },
  { label: 'Late', value: 18, color: T.warning },
  { label: 'Absent', value: 9, color: T.error },
  { label: 'Overtime', value: 22, color: T.accent },
];

const TIME_OFF_TABLE = [
  { type: 'Paid Time Off', approved: 24, pending: 3, balance: '118 Days' },
  { type: 'Sick Leave', approved: 6, pending: 1, balance: null },
  { type: 'Comp Off', approved: 4, pending: 2, balance: '11 Days' },
];

const DEPT_TABLE = [
  { dept: 'IT', headcount: 18, salary: '₹4.2L' },
  { dept: 'Sales', headcount: 22, salary: '₹5.7L' },
  { dept: 'HR', headcount: 8, salary: '₹1.9L' },
  { dept: 'Support', headcount: 14, salary: '₹3.1L' },
];

/* ─── KPI card definitions ───────────────────────────────────── */
interface KpiDef {
  label: string;
  rawValue: number;
  displayValue: string;
  context: string;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ElementType;
}
const KPI_CARDS: KpiDef[] = [
  { label: 'Total Net Salary Paid', rawValue: 184, displayValue: '₹18.4L', context: '+8.5% vs previous month', trend: 'up', icon: IndianRupee },
  { label: 'Payslips Generated', rawValue: 148, displayValue: '148', context: '142 paid, 6 pending', trend: 'neutral', icon: FileText },
  { label: 'Avg Salary / Employee', rawValue: 12432, displayValue: '₹12,432', context: 'Based on current payrun', trend: 'neutral', icon: Users },
  { label: 'Approved Time Off Days', rawValue: 34, displayValue: '34 Days', context: 'Across selected period', trend: 'neutral', icon: CalendarOff },
  { label: 'Attendance Health', rawValue: 94, displayValue: '94%', context: 'Present / reviewed records', trend: 'up', icon: Activity },
];

/* ─── Helpers ─────────────────────────────────────────────────── */
function useCountUp(target: number, duration = 500, trigger: boolean): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    setValue(0);
    const start = performance.now();
    const frame = (now: number) => {
      const pct = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - pct, 3); // ease-out cubic
      setValue(Math.round(ease * target));
      if (pct < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [target, duration, trigger]);
  return value;
}

/* ─── Custom tooltip ─────────────────────────────────────────── */
function DarkTooltip({ active, payload, label, formatter }: {
  active?: boolean; payload?: { value: number }[]; label?: string;
  formatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: T.navy, color: '#fff', borderRadius: 8,
      padding: '8px 12px', fontSize: 12,
      boxShadow: '0 8px 24px rgba(10,37,64,0.18)',
    }}>
      <div style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 600 }}>
        {formatter ? formatter(payload[0].value) : payload[0].value}
      </div>
    </div>
  );
}

/* ─── Animated bar chart ─────────────────────────────────────── */
function AnimatedBarChart({
  data, title, subtitle, height = 220, formatter,
  animate,
}: {
  data: { label: string; value: number }[];
  title: string; subtitle: string; height?: number;
  formatter?: (v: number) => string;
  animate: boolean;
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [animData, setAnimData] = useState(data.map(d => ({ ...d, value: 0 })));

  useEffect(() => {
    if (!animate) return;
    setAnimData(data.map(d => ({ ...d, value: 0 })));
    const timers: ReturnType<typeof setTimeout>[] = [];
    data.forEach((d, i) => {
      const t = setTimeout(() => {
        const duration = 380;
        const start = performance.now();
        const frame = (now: number) => {
          const pct = Math.min((now - start) / duration, 1);
          const ease = 1 - Math.pow(1 - pct, 3);
          setAnimData(prev => {
            const next = [...prev];
            next[i] = { ...d, value: Math.round(ease * d.value) };
            return next;
          });
          if (pct < 1) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }, i * 40);
      timers.push(t);
    });
    return () => timers.forEach(clearTimeout);
  }, [animate, data]);

  return (
    <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 20, padding: '20px 20px 12px' }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.navy }}>{title}</div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{subtitle}</div>
      </div>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <BarChart
            data={animData}
            onMouseMove={(s) => setActiveIdx(s?.isTooltipActive ? (s.activeTooltipIndex ?? null) : null)}
            onMouseLeave={() => setActiveIdx(null)}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          >
            <CartesianGrid vertical={false} stroke={T.border} />
            <XAxis dataKey="label" axisLine={false} tickLine={false}
              tick={{ fill: T.muted, fontSize: 12 }} dy={8} />
            <YAxis axisLine={false} tickLine={false}
              tick={{ fill: T.muted, fontSize: 12 }} width={36} />
            <Tooltip cursor={{ fill: T.surface }}
              content={<DarkTooltip formatter={formatter} />} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={38}>
              {animData.map((_, i) => (
                <Cell key={i} fill={i === activeIdx ? T.accent : T.accentSoft} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ─── Animated line chart ────────────────────────────────────── */
function AnimatedLineChart({
  data, title, subtitle, height = 220, formatter, animate,
}: {
  data: { label: string; value: number }[];
  title: string; subtitle: string; height?: number;
  formatter?: (v: number) => string;
  animate: boolean;
}) {
  const [progress, setProgress] = useState(0);
  const [displayData, setDisplayData] = useState(data.map((d, i) => ({ ...d, value: i === 0 ? d.value : null })));

  useEffect(() => {
    if (!animate) return;
    setProgress(0);
    setDisplayData(data.map((d, i) => ({ ...d, value: i === 0 ? d.value : null })));
    const duration = 550;
    const start = performance.now();
    const frame = (now: number) => {
      const pct = Math.min((now - start) / duration, 1);
      setProgress(pct);
      // reveal points progressively
      const revealed = Math.floor(pct * data.length);
      setDisplayData(data.map((d, i) => ({ ...d, value: i <= revealed ? d.value : null })));
      if (pct < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [animate, data]);

  // annotate the peak point
  const peakIdx = data.reduce((mi, d, i) => d.value > data[mi].value ? i : mi, 0);
  const peakVisible = progress >= peakIdx / data.length;

  return (
    <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 20, padding: '20px 20px 12px', position: 'relative' }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.navy }}>{title}</div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{subtitle}</div>
      </div>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <LineChart data={displayData} margin={{ top: 20, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={T.accent} />
                <stop offset="100%" stopColor={T.gradientEnd} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={T.border} />
            <XAxis dataKey="label" axisLine={false} tickLine={false}
              tick={{ fill: T.muted, fontSize: 12 }} dy={8} />
            <YAxis axisLine={false} tickLine={false}
              tick={{ fill: T.muted, fontSize: 12 }} width={36} />
            <Tooltip content={<DarkTooltip formatter={formatter} />} />
            <Line
              type="monotone" dataKey="value"
              stroke="url(#lineGrad)" strokeWidth={2.5}
              dot={(props) => {
                // render annotated callout on peak point
                if (props.index === peakIdx && peakVisible) {
                  return (
                    <g key={`peak-${props.cx}`}>
                      <circle cx={props.cx} cy={props.cy} r={5}
                        fill={T.accent} stroke="#fff" strokeWidth={2} />
                      <text x={props.cx} y={(props.cy as number) - 12}
                        textAnchor="middle" fontSize={11} fontWeight={700} fill={T.navy}>
                        {formatter ? formatter(data[peakIdx].value) : data[peakIdx].value}
                      </text>
                    </g>
                  );
                }
                return <circle key={`dot-${props.index}`} cx={props.cx} cy={props.cy} r={0} />;
              }}
              activeDot={{ r: 5, fill: T.accent, stroke: '#fff', strokeWidth: 2 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ─── Filter bar ─────────────────────────────────────────────── */
interface Filters {
  period: string;
  department: string;
  employeeType: string;
  company: string;
}

function FilterSelect({
  label, value, options, onChange,
}: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="appearance-none h-9 pl-3 pr-8 bg-white border border-border rounded-lg text-sm text-navy font-medium focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent cursor-pointer transition-colors"
        >
          {options.map(o => <option key={o}>{o}</option>)}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
      </div>
    </div>
  );
}

/* ─── KPI Card ───────────────────────────────────────────────── */
function KpiCard({
  def, staggerIdx, trigger,
}: { def: KpiDef; staggerIdx: number; trigger: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [contextVisible, setContextVisible] = useState(false);
  const counted = useCountUp(def.rawValue, 500, trigger);

  useEffect(() => {
    if (!trigger) { setMounted(false); setContextVisible(false); return; }
    const t1 = setTimeout(() => setMounted(true), staggerIdx * 40);
    const t2 = setTimeout(() => setContextVisible(true), staggerIdx * 40 + 600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [trigger, staggerIdx]);

  const Icon = def.icon;
  const trendColor = def.trend === 'up' ? T.success : def.trend === 'down' ? T.error : T.muted;
  const TrendIcon = def.trend === 'up' ? TrendingUp : def.trend === 'down' ? TrendingDown : null;

  // format display using counted value
  const display = def.displayValue.includes('%')
    ? `${counted}%`
    : def.displayValue.includes('₹') && def.displayValue.includes('L')
      ? `₹${(counted / 10).toFixed(1)}L`
      : def.displayValue.includes('₹')
        ? `₹${counted.toLocaleString('en-IN')}`
        : def.displayValue.includes('Days')
          ? `${counted} Days`
          : `${counted}`;

  return (
    <div
      style={{
        background: T.bg,
        border: `1px solid ${T.border}`,
        borderRadius: 16,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 200ms ease, transform 200ms ease, box-shadow 150ms ease',
        boxShadow: '0 1px 4px rgba(10,37,64,0.04)',
        cursor: 'default',
        flex: 1,
        minWidth: 0,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(10,37,64,0.10)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(10,37,64,0.04)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{def.label}</span>
        <div style={{ width: 32, height: 32, background: T.accentSoft, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={T.accent} />
        </div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: T.navy, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
        {trigger ? display : def.displayValue}
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, marginTop: 2,
        opacity: contextVisible ? 1 : 0,
        transition: 'opacity 100ms ease',
      }}>
        {TrendIcon && <TrendIcon size={12} color={trendColor} />}
        <span style={{ fontSize: 12, color: trendColor, fontWeight: 500 }}>{def.context}</span>
      </div>
    </div>
  );
}

/* ─── Stacked status bar ─────────────────────────────────────── */
interface PayslipStatusItem {
  label: string;
  value: number;
  color: string;
}

function PayslipStatusBar({
  statuses = PAYSLIP_STATUSES,
  total,
  animate,
}: {
  statuses?: PayslipStatusItem[];
  total?: number;
  animate: boolean;
}) {
  const effectiveTotal = total ?? Math.max(1, statuses.reduce((s, x) => s + x.value, 0));
  const [widths, setWidths] = useState(statuses.map(() => 0));

  useEffect(() => {
    if (!animate) return;
    setWidths(statuses.map(() => 0));
    const safeTotal = Math.max(effectiveTotal, 1);
    statuses.forEach((s, i) => {
      const target = (s.value / safeTotal) * 100;
      const delay = i * 200;
      setTimeout(() => {
        const dur = 200;
        const start = performance.now();
        const frame = (now: number) => {
          const pct = Math.min((now - start) / dur, 1);
          setWidths(prev => { const n = [...prev]; n[i] = pct * target; return n; });
          if (pct < 1) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }, delay);
    });
  }, [animate, statuses, effectiveTotal]);

  return (
    <div>
      <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2, marginBottom: 10, background: T.surface }}>
        {statuses.map((s, i) => (
          <div key={s.label} style={{
            width: `${widths[i]}%`, background: s.color,
            borderRadius: i === 0 ? '6px 0 0 6px' : i === statuses.length - 1 ? '0 6px 6px 0' : 0,
            transition: 'none',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
        {statuses.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
            <span style={{ fontSize: 12, color: T.slate }}>{s.label} ({s.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Alert list ─────────────────────────────────────────────── */
interface AlertItem {
  id: string | number;
  text: string;
  link: string;
  severity: 'error' | 'warning' | 'success';
}

function AlertList({
  alerts = PAYROLL_ALERTS,
  animate,
}: {
  alerts?: AlertItem[];
  animate: boolean;
}) {
  const [visible, setVisible] = useState<boolean[]>(alerts.map(() => false));

  useEffect(() => {
    if (!animate) return;
    setVisible(alerts.map(() => false));
    alerts.forEach((_, i) => {
      setTimeout(() => {
        setVisible(prev => { const n = [...prev]; n[i] = true; return n; });
      }, 300 + i * 50);
    });
  }, [animate, alerts]);

  if (alerts.length === 0) {
    return (
      <div style={{ padding: '12px', textAlign: 'center', color: T.muted, fontSize: 13, background: T.surface, borderRadius: 8, marginTop: 12 }}>
        No pending payroll alerts. Everything is in good standing.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
      {alerts.map((a, i) => (
        <Link
          key={a.id}
          to={a.link}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 10px',
            background: a.severity === 'error' ? '#FFF5F5' : a.severity === 'success' ? '#F0FDF4' : '#FFFBF0',
            border: `1px solid ${a.severity === 'error' ? '#FECDD3' : a.severity === 'success' ? '#BBF7D0' : '#FDE68A'}`,
            borderRadius: 8,
            textDecoration: 'none',
            opacity: visible[i] ? 1 : 0,
            transform: visible[i] ? 'translateX(0)' : 'translateX(12px)',
            transition: 'opacity 150ms ease, transform 150ms ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: a.severity === 'error' ? T.error : a.severity === 'success' ? T.success : T.warning,
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 13, color: T.navy, fontWeight: 500 }}>{a.text}</span>
          </div>
          <ExternalLink size={12} color={T.muted} />
        </Link>
      ))}
    </div>
  );
}

/* ─── Panel shell ────────────────────────────────────────────── */
function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        background: T.bg, border: `1px solid ${T.border}`, borderRadius: 20,
        padding: 20, boxShadow: '0 1px 4px rgba(10,37,64,0.04)',
        transition: 'box-shadow 150ms ease',
      }}
      onMouseEnter={() => { if (ref.current) ref.current.style.boxShadow = '0 4px 16px rgba(10,37,64,0.10)'; }}
      onMouseLeave={() => { if (ref.current) ref.current.style.boxShadow = '0 1px 4px rgba(10,37,64,0.04)'; }}
    >
      {children}
    </div>
  );
}

function PanelHeader({ title, source }: { title: string; source: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: T.navy }}>{title}</div>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{source}</div>
    </div>
  );
}

/* ─── Attendance small bar chart ─────────────────────────────── */
function AttendanceBars({ animate }: { animate: boolean }) {
  const max = Math.max(...ATTENDANCE_BARS.map(b => b.value));
  const [heights, setHeights] = useState(ATTENDANCE_BARS.map(() => 0));

  useEffect(() => {
    if (!animate) return;
    setHeights(ATTENDANCE_BARS.map(() => 0));
    ATTENDANCE_BARS.forEach((b, i) => {
      setTimeout(() => {
        const dur = 350;
        const start = performance.now();
        const frame = (now: number) => {
          const pct = Math.min((now - start) / dur, 1);
          const ease = 1 - Math.pow(1 - pct, 3);
          setHeights(prev => { const n = [...prev]; n[i] = ease * (b.value / max) * 100; return n; });
          if (pct < 1) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }, i * 40);
    });
  }, [animate]);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 100, marginBottom: 16 }}>
      {ATTENDANCE_BARS.map((b, i) => (
        <div key={b.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.navy, opacity: heights[i] > 90 ? 1 : 0, transition: 'opacity 150ms ease' }}>
            {b.value}
          </span>
          <div style={{
            width: '100%', height: `${heights[i]}%`,
            background: b.color, borderRadius: '4px 4px 0 0',
            minHeight: 4, transition: 'none',
          }} />
          <span style={{ fontSize: 11, color: T.muted, textAlign: 'center' }}>{b.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Table components ───────────────────────────────────────── */
function StripedTable({
  headers, rows, animate,
}: { headers: string[]; rows: (string | React.ReactNode)[][]; animate: boolean }) {
  const [visible, setVisible] = useState<boolean[]>(rows.map(() => false));

  useEffect(() => {
    if (!animate) return;
    setVisible(rows.map(() => false));
    rows.forEach((_, i) => {
      setTimeout(() => setVisible(prev => { const n = [...prev]; n[i] = true; return n; }), i * 35);
    });
  }, [animate, rows]);

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr>
          {headers.map(h => (
            <th key={h} style={{ textAlign: 'left', padding: '0 8px 10px', color: T.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${T.border}` }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri}
            style={{
              opacity: visible[ri] ? 1 : 0,
              transform: visible[ri] ? 'none' : 'translateY(4px)',
              transition: 'opacity 150ms ease, transform 150ms ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = T.surface; }}
            onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
          >
            {row.map((cell, ci) => (
              <td key={ci} style={{ padding: '10px 8px', color: ci === 0 ? T.navy : T.slate, fontWeight: ci === 0 ? 500 : 400, borderBottom: ri < rows.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ─── Main Dashboard component ───────────────────────────────── */
export default function Dashboard() {
  const [filters, setFilters] = useState<Filters>({
    period: 'All Periods',
    department: 'All Departments',
    employeeType: 'All Types',
    company: 'All Companies',
  });
  const [panelVisible, setPanelVisible] = useState(true);
  const [animTrigger, setAnimTrigger] = useState(false);
  const filterTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live queries
  const { data: payrunsResponse } = usePayrunsQuery({ pageSize: 100 });
  const { data: payslipsResponse } = usePayslipsQuery({ pageSize: 100 });
  const { data: employeesResponse } = useEmployees({ pageSize: 100 });
  const { data: departmentsData } = useDepartments();

  const payruns = useMemo(() => payrunsResponse?.items ?? [], [payrunsResponse]);
  const payslips = useMemo(() => payslipsResponse?.items ?? [], [payslipsResponse]);
  const employees = useMemo(() => employeesResponse?.items ?? [], [employeesResponse]);
  const departments = useMemo(() => departmentsData ?? [], [departmentsData]);

  // Initial load animation
  useEffect(() => {
    const t = setTimeout(() => setAnimTrigger(true), 100);
    return () => clearTimeout(t);
  }, []);

  const handleFilterChange = useCallback(<K extends keyof Filters>(key: K, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPanelVisible(false);
    setAnimTrigger(false);
    if (filterTimeout.current) clearTimeout(filterTimeout.current);
    filterTimeout.current = setTimeout(() => {
      setPanelVisible(true);
      setTimeout(() => setAnimTrigger(true), 50);
    }, 150);
  }, []);

  // Filter options derived from live data
  const availablePeriods = useMemo(() => {
    const periodSet = new Set<string>();
    payruns.forEach(pr => {
      const d = new Date(pr.periodStart);
      if (!isNaN(d.getTime())) {
        const str = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        periodSet.add(str);
      }
    });
    if (periodSet.size === 0) {
      return ['All Periods', 'Sep 2026', 'Aug 2026', 'Jul 2026'];
    }
    return ['All Periods', ...Array.from(periodSet)];
  }, [payruns]);

  const availableDepartments = useMemo(() => {
    const names = departments.map(d => d.name);
    return ['All Departments', ...(names.length > 0 ? names : ['IT', 'Sales', 'HR', 'Support', 'Finance'])];
  }, [departments]);

  const EMP_TYPES = ['All Types', 'FULL_TIME', 'PART_TIME', 'CONTRACT'];
  const COMPANIES = ['All Companies', 'OXP Pvt Ltd'];

  // Filtered collections
  const filteredPayslips = useMemo(() => {
    return payslips.filter(ps => {
      if (filters.department !== 'All Departments' && ps.departmentName !== filters.department) {
        return false;
      }
      if (filters.period !== 'All Periods') {
        const d = new Date(ps.periodStart);
        const periodStr = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        if (periodStr !== filters.period) return false;
      }
      return true;
    });
  }, [payslips, filters.department, filters.period]);

  const filteredPayruns = useMemo(() => {
    return payruns.filter(pr => {
      if (filters.period !== 'All Periods') {
        const d = new Date(pr.periodStart);
        const periodStr = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        if (periodStr !== filters.period) return false;
      }
      return true;
    });
  }, [payruns, filters.period]);

  // Dynamic KPI Cards
  const kpiCards: KpiDef[] = useMemo(() => {
    if (payruns.length === 0 && payslips.length === 0) {
      return KPI_CARDS;
    }

    const totalNetSalaryNum = filteredPayruns.reduce((acc, pr) => acc + Number(pr.netTotal || 0), 0) ||
      filteredPayslips.reduce((acc, ps) => acc + Number(ps.netAmount || 0), 0);

    const payslipsCount = filteredPayslips.length;
    const paidPayslipsCount = filteredPayslips.filter(p => p.status === 'PAID').length;
    const pendingPayslipsCount = payslipsCount - paidPayslipsCount;

    const avgSalary = payslipsCount > 0
      ? Math.round(totalNetSalaryNum / payslipsCount)
      : (employees.length > 0 ? Math.round(totalNetSalaryNum / employees.length) : 0);

    const netDisplay = totalNetSalaryNum >= 100000
      ? `₹${(totalNetSalaryNum / 100000).toFixed(1)}L`
      : `₹${Math.round(totalNetSalaryNum).toLocaleString('en-IN')}`;

    const activePayrunsCount = filteredPayruns.length;
    const validatedCount = filteredPayruns.filter(p => p.status === 'VALIDATED' || p.status === 'PAID').length;
    const hasBlocking = filteredPayruns.some(p => p.openBlockingWarningsCount > 0);

    return [
      {
        label: 'Total Net Salary Paid',
        rawValue: totalNetSalaryNum >= 100000 ? Math.round((totalNetSalaryNum / 100000) * 10) : Math.round(totalNetSalaryNum),
        displayValue: totalNetSalaryNum > 0 ? netDisplay : '₹0',
        context: activePayrunsCount > 0 ? `${activePayrunsCount} payruns (${validatedCount} validated)` : 'No payruns recorded',
        trend: totalNetSalaryNum > 0 ? 'up' : 'neutral',
        icon: IndianRupee,
      },
      {
        label: 'Payslips Generated',
        rawValue: payslipsCount > 0 ? payslipsCount : (payslips.length === 0 ? 148 : 0),
        displayValue: payslipsCount > 0 ? `${payslipsCount}` : (payslips.length === 0 ? '148' : '0'),
        context: payslipsCount > 0 ? `${paidPayslipsCount} paid, ${pendingPayslipsCount} pending` : '142 paid, 6 pending',
        trend: 'neutral',
        icon: FileText,
      },
      {
        label: 'Avg Salary / Employee',
        rawValue: avgSalary > 0 ? avgSalary : (payslips.length === 0 ? 12432 : 0),
        displayValue: avgSalary > 0 ? `₹${avgSalary.toLocaleString('en-IN')}` : (payslips.length === 0 ? '₹12,432' : '₹0'),
        context: payslipsCount > 0 ? `Based on ${payslipsCount} payslips` : (employees.length > 0 ? `${employees.length} active employees` : 'Based on current payrun'),
        trend: 'neutral',
        icon: Users,
      },
      {
        label: 'Approved Time Off Days',
        rawValue: 34,
        displayValue: '34 Days',
        context: 'Across selected period',
        trend: 'neutral',
        icon: CalendarOff,
      },
      {
        label: 'Payroll Health',
        rawValue: hasBlocking ? 0 : 94,
        displayValue: hasBlocking ? 'Action Req.' : '94%',
        context: hasBlocking ? 'Blocking warnings open' : 'Present / reviewed records',
        trend: hasBlocking ? 'down' : 'up',
        icon: Activity,
      },
    ];
  }, [filteredPayruns, filteredPayslips, employees, payruns.length, payslips.length]);

  // Dynamic Salary by Department
  const salaryByDept = useMemo(() => {
    if (departments.length === 0 && filteredPayslips.length === 0) {
      return SALARY_BY_DEPT;
    }

    const map = new Map<string, number>();
    departments.forEach(d => map.set(d.name, 0));

    filteredPayslips.forEach(ps => {
      const dept = ps.departmentName || 'General';
      const current = map.get(dept) || 0;
      map.set(dept, current + Number(ps.netAmount || ps.grossAmount || 0));
    });

    const list: { label: string; value: number }[] = [];
    map.forEach((total, dept) => {
      list.push({
        label: dept,
        value: Math.round(total / 1000), // in thousands (₹k)
      });
    });

    if (list.length === 0 || list.every(item => item.value === 0)) {
      return SALARY_BY_DEPT;
    }
    return list.slice(0, 6);
  }, [departments, filteredPayslips]);

  // Dynamic Monthly Net Salary Trend
  const salaryTrend = useMemo(() => {
    if (payruns.length === 0) return SALARY_TREND;

    const monthMap = new Map<string, number>();
    const sorted = [...payruns].sort((a, b) => a.periodStart.localeCompare(b.periodStart));

    sorted.forEach(pr => {
      const d = new Date(pr.periodStart);
      const key = !isNaN(d.getTime())
        ? d.toLocaleDateString('en-US', { month: 'short' })
        : pr.periodStart.substring(5, 7);
      const val = Number((Number(pr.netTotal || 0) / 100000).toFixed(1));
      monthMap.set(key, (monthMap.get(key) || 0) + val);
    });

    const result = Array.from(monthMap.entries()).map(([label, value]) => ({ label, value }));
    return result.length > 0 ? result : SALARY_TREND;
  }, [payruns]);

  // Dynamic Payslip Statuses & Total
  const payslipStatuses = useMemo(() => {
    if (payslips.length === 0) return PAYSLIP_STATUSES;

    const paid = payslips.filter(p => p.status === 'PAID').length;
    const validated = payslips.filter(p => p.status === 'VALIDATED').length;
    const computed = payslips.filter(p => p.status === 'COMPUTED').length;
    const draft = payslips.filter(p => p.status === 'DRAFT').length;

    return [
      { label: 'Paid', value: paid, color: T.success },
      { label: 'Validated', value: validated, color: T.accent },
      { label: 'Computed', value: computed, color: T.gradientEnd },
      { label: 'Draft', value: draft, color: T.warning },
    ];
  }, [payslips]);

  const payslipTotal = useMemo(() => {
    return payslipStatuses.reduce((s, x) => s + x.value, 0);
  }, [payslipStatuses]);

  // Dynamic Payroll Alerts
  const payrollAlerts = useMemo(() => {
    const alerts: AlertItem[] = [];

    const payrunsWithBlocking = payruns.filter(p => p.openBlockingWarningsCount > 0);
    payrunsWithBlocking.forEach(p => {
      alerts.push({
        id: `pr-block-${p.id}`,
        text: `${p.openBlockingWarningsCount} blocking warnings in ${p.payrunNumber}`,
        link: `/payroll/payruns/${p.id}`,
        severity: 'error',
      });
    });

    const payslipsWithWarnings = payslips.filter(p => p.hasWarnings);
    if (payslipsWithWarnings.length > 0) {
      alerts.push({
        id: 'ps-warnings',
        text: `${payslipsWithWarnings.length} payslips have active warnings`,
        link: '/payroll/payslips',
        severity: 'warning',
      });
    }

    const draftPayruns = payruns.filter(p => p.status === 'DRAFT');
    if (draftPayruns.length > 0) {
      alerts.push({
        id: 'pr-drafts',
        text: `${draftPayruns.length} draft payrun${draftPayruns.length > 1 ? 's' : ''} awaiting computation`,
        link: '/payroll/payruns',
        severity: 'warning',
      });
    }

    const computedPayruns = payruns.filter(p => p.status === 'COMPUTED');
    if (computedPayruns.length > 0) {
      alerts.push({
        id: 'pr-computed',
        text: `${computedPayruns.length} computed payrun${computedPayruns.length > 1 ? 's' : ''} ready for validation`,
        link: '/payroll/payruns',
        severity: 'warning',
      });
    }

    if (alerts.length === 0 && (payruns.length > 0 || payslips.length > 0)) {
      return [
        {
          id: 'all-clear',
          text: 'All payroll records and payruns are compliant',
          link: '/payroll/payruns',
          severity: 'success' as const,
        },
      ];
    }

    return alerts.length > 0 ? alerts.slice(0, 5) : PAYROLL_ALERTS;
  }, [payruns, payslips]);

  const timeOffRows: (string | React.ReactNode)[][] = TIME_OFF_TABLE.map(r => [
    r.type,
    String(r.approved),
    String(r.pending),
    r.balance === null
      ? <span style={{ color: T.muted, fontStyle: 'italic' }}>N/A</span>
      : r.balance,
  ]);

  // Dynamic Department Table Rows
  const deptRows: (string | React.ReactNode)[][] = useMemo(() => {
    if (departments.length === 0) {
      return DEPT_TABLE.map(r => [r.dept, String(r.headcount), r.salary]);
    }

    return departments.map(d => {
      const count = employees.filter(e => e.department?.id === d.id || e.department?.name === d.name).length;
      const deptPayslips = filteredPayslips.filter(p => p.departmentName === d.name);
      const totalSalary = deptPayslips.reduce((acc, p) => acc + Number(p.netAmount || p.grossAmount || 0), 0);
      const salaryStr = totalSalary >= 100000
        ? `₹${(totalSalary / 100000).toFixed(1)}L`
        : totalSalary > 0
          ? `₹${Math.round(totalSalary).toLocaleString('en-IN')}`
          : '₹0';

      return [
        d.name,
        String(count),
        salaryStr,
      ];
    });
  }, [departments, employees, filteredPayslips]);

  return (
    <AppLayout>
      <div style={{ minHeight: '100vh', background: T.surface, padding: '24px 32px 48px', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

        {/* ── Page Header ─────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.navy, letterSpacing: '-0.02em', margin: 0 }}>
            Payroll Dashboard
          </h1>
          <p style={{ fontSize: 13, color: T.muted, marginTop: 4, maxWidth: 640 }}>
            Understand payments, staffing impact, leave patterns, and attendance quality for the selected period.
          </p>
        </div>

        {/* ── Filter Bar ──────────────────────────────────── */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 24,
          background: T.bg, border: `1px solid ${T.border}`, borderRadius: 16,
          padding: '16px 20px',
        }}>
          <FilterSelect label="Period" value={filters.period} options={availablePeriods}
            onChange={v => handleFilterChange('period', v)} />
          <FilterSelect label="Department" value={filters.department} options={availableDepartments}
            onChange={v => handleFilterChange('department', v)} />
          <FilterSelect label="Employee Type" value={filters.employeeType} options={EMP_TYPES}
            onChange={v => handleFilterChange('employeeType', v)} />
          <FilterSelect label="Company" value={filters.company} options={COMPANIES}
            onChange={v => handleFilterChange('company', v)} />
        </div>

        {/* ── All panels (fade on filter change) ─────────── */}
        <div style={{
          opacity: panelVisible ? 1 : 0,
          transition: 'opacity 150ms ease',
        }}>

          {/* ── KPI Card Row ─────────────────────────────── */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            {kpiCards.map((def, i) => (
              <KpiCard key={def.label} def={def} staggerIdx={i} trigger={animTrigger} />
            ))}
          </div>

          {/* ── Middle Row ───────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>

            {/* Salary by Dept */}
            <AnimatedBarChart
              data={salaryByDept}
              title="Salary Cost by Department"
              subtitle="Source: Payslips + Employee Department"
              formatter={v => `₹${v}k`}
              animate={animTrigger}
            />

            {/* Monthly Trend */}
            <AnimatedLineChart
              data={salaryTrend}
              title="Monthly Net Salary Trend"
              subtitle="Source: historical Payslips / Payruns"
              formatter={v => `${v}L`}
              animate={animTrigger}
            />

            {/* Status + Alerts */}
            <Panel>
              <PanelHeader title="Payslip Status & Payroll Alerts" source="Source: Payrun + Payslip validation" />
              <PayslipStatusBar statuses={payslipStatuses} total={payslipTotal} animate={animTrigger} />
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.navy, marginBottom: 2 }}>
                  Current Alerts
                </div>
                <AlertList alerts={payrollAlerts} animate={animTrigger} />
              </div>
            </Panel>
          </div>

          {/* ── Bottom Row ───────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>

            {/* Attendance Overview */}
            <Panel>
              <PanelHeader title="Attendance Overview" source="Source: Attendance" />
              <AttendanceBars animate={animTrigger} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
                {[
                  { label: 'Missing check-outs', value: '5', color: T.warning },
                  { label: 'Manual attendance edits', value: '7', color: T.slate },
                  { label: 'Attendance coverage', value: '94%', color: T.success },
                ].map(stat => (
                  <div key={stat.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: T.muted }}>{stat.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: stat.color }}>{stat.value}</span>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Time Off Overview */}
            <Panel>
              <PanelHeader title="Time Off Overview" source="Source: Time Off Requests + Allocations" />
              <StripedTable
                headers={['Type', 'Approved', 'Pending', 'Balance']}
                rows={timeOffRows}
                animate={animTrigger}
              />
            </Panel>

            {/* Department Overview */}
            <Panel>
              <PanelHeader title="Department Overview" source="Source: Employee + Contract + Payslip totals" />
              <StripedTable
                headers={['Department', 'Headcount', 'Monthly Salary']}
                rows={deptRows}
                animate={animTrigger}
              />
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 11, color: T.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={11} color={T.warning} />
                  Data aggregated from Employees, Contracts &amp; Payslips
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
