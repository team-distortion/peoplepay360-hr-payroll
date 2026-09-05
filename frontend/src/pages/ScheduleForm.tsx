import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Clock,
  Briefcase,
  Plus,
  X,
  AlertCircle,
  Moon,
  Loader2,
} from 'lucide-react';
import {
  WorkingScheduleInputSchema,
  WeekdayValues,
  WorkingScheduleTypeValues,
  WorkingScheduleStatusValues,
  calculateDayInterval,
  type WorkingScheduleInput,
  type Weekday,
} from '@peoplepay360/shared';
import AppLayout from '../components/layout/AppLayout';
import {
  useSchedule,
  useCreateSchedule,
  useUpdateSchedule,
} from '../features/schedules/schedules.queries';

const WEEKDAY_LABELS: Record<Weekday, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
};

const DEFAULT_DAYS = [
  { dayOfWeek: 'MONDAY' as Weekday, startTime: '09:00', endTime: '18:00', breakMinutes: 60 },
  { dayOfWeek: 'TUESDAY' as Weekday, startTime: '09:00', endTime: '18:00', breakMinutes: 60 },
  { dayOfWeek: 'WEDNESDAY' as Weekday, startTime: '09:00', endTime: '18:00', breakMinutes: 60 },
  { dayOfWeek: 'THURSDAY' as Weekday, startTime: '09:00', endTime: '18:00', breakMinutes: 60 },
  { dayOfWeek: 'FRIDAY' as Weekday, startTime: '09:00', endTime: '18:00', breakMinutes: 60 },
];

export default function ScheduleForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [serverError, setServerError] = useState<string | null>(null);

  const {
    data: schedule,
    isLoading: isFetching,
    isError: isFetchError,
    error: fetchError,
    refetch,
  } = useSchedule(id);

  const createMutation = useCreateSchedule();
  const updateMutation = useUpdateSchedule();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isValid },
  } = useForm<WorkingScheduleInput>({
    resolver: zodResolver(WorkingScheduleInputSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      type: 'STANDARD',
      companyName: 'PeoplePay360 Inc.',
      status: 'ACTIVE',
      days: DEFAULT_DAYS,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'days',
  });

  // Populate form when editing
  useEffect(() => {
    if (schedule && isEdit) {
      reset({
        name: schedule.name,
        type: schedule.type,
        companyName: schedule.companyName,
        status: schedule.status,
        days: schedule.days.map((d) => ({
          dayOfWeek: d.dayOfWeek,
          startTime: d.startTime,
          endTime: d.endTime,
          breakMinutes: d.breakMinutes,
        })),
      });
    }
  }, [schedule, isEdit, reset]);

  const watchedDays = watch('days') || [];
  const watchedStatus = watch('status');
  const watchedName = watch('name');

  // Compute available weekdays
  const usedWeekdays = useMemo(() => {
    return new Set(watchedDays.map((d) => d?.dayOfWeek).filter(Boolean));
  }, [watchedDays]);

  const availableWeekdays = useMemo(() => {
    return WeekdayValues.filter((w) => !usedWeekdays.has(w));
  }, [usedWeekdays]);

  // Live preview totals
  const livePreview = useMemo(() => {
    let totalMinutes = 0;
    const dayPreviews: Array<{
      hoursText: string;
      overnight: boolean;
      isValid: boolean;
    }> = [];

    for (const day of watchedDays) {
      if (!day || !day.startTime || !day.endTime) {
        dayPreviews.push({ hoursText: '-', overnight: false, isValid: false });
        continue;
      }
      try {
        const res = calculateDayInterval(
          day.startTime,
          day.endTime,
          Number(day.breakMinutes) || 0
        );
        totalMinutes += res.dailyMinutes;
        dayPreviews.push({
          hoursText: `${(res.dailyMinutes / 60).toFixed(1)}h`,
          overnight: res.overnight,
          isValid: true,
        });
      } catch {
        dayPreviews.push({ hoursText: '-', overnight: false, isValid: false });
      }
    }

    return {
      totalMinutes,
      totalHoursText: `${(totalMinutes / 60).toFixed(1)}h`,
      dayPreviews,
    };
  }, [watchedDays]);

  const handleAddDay = () => {
    if (availableWeekdays.length === 0 || fields.length >= 7) return;
    const nextDay = availableWeekdays[0];
    append({
      dayOfWeek: nextDay,
      startTime: '09:00',
      endTime: '18:00',
      breakMinutes: 60,
    });
  };

  const onSubmit = async (data: WorkingScheduleInput) => {
    setServerError(null);
    try {
      if (isEdit && id) {
        await updateMutation.mutateAsync({ id, input: data });
      } else {
        await createMutation.mutateAsync(data);
      }
      navigate('/schedules');
    } catch (err: any) {
      if (err.code === 'SCHEDULE_NAME_EXISTS') {
        setError('name', {
          type: 'manual',
          message: 'A schedule with this name already exists (case-insensitive)',
        });
      } else if (err.code === 'VALIDATION_ERROR' && err.details) {
        setServerError('Validation failed. Please check the highlighted fields.');
      } else {
        setServerError(err.message || 'An unexpected error occurred while saving.');
      }
    }
  };

  // Loading state for edit mode
  if (isEdit && isFetching) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-brandAccent animate-spin" />
            <span className="text-sm font-medium text-slate">Loading working schedule...</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Not found or error state in edit mode
  if (isEdit && isFetchError) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="bg-white border border-border rounded-2xl p-8 max-w-md w-full text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-error/10 text-error flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={24} />
            </div>
            <h2 className="text-xl font-bold text-navy mb-2">Schedule Not Found</h2>
            <p className="text-sm text-slate mb-6">
              {(fetchError as Error)?.message || 'The requested working schedule does not exist or has been removed.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => refetch()}
                className="px-4 py-2 border border-border text-navy rounded-full text-sm font-medium hover:bg-surface transition-colors"
              >
                Retry
              </button>
              <Link
                to="/schedules"
                className="px-5 py-2 bg-brandAccent text-white rounded-full text-sm font-medium hover:bg-[#4a44cc] transition-colors"
              >
                Back to Schedules
              </Link>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col bg-surface/30">
        {/* Top Sticky Header */}
        <div className="px-8 py-5 bg-white border-b border-border sticky top-0 z-10 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-4">
            <Link
              to="/schedules"
              className="p-2 hover:bg-surface rounded-full text-brandAccent transition-colors flex items-center justify-center group"
              title="Back to schedules"
            >
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-display font-bold text-navy">
                  {watchedName || (isEdit ? 'Edit Schedule' : 'New Schedule')}
                </h1>
                <span
                  className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                    watchedStatus === 'ACTIVE'
                      ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
                      : 'border-slate-200 text-slate-600 bg-slate-100'
                  }`}
                >
                  {watchedStatus === 'ACTIVE' ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-xs text-mutedText mt-0.5">
                {isEdit ? 'Update working hours and shift days' : 'Define weekly working pattern and intervals'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/schedules"
              className="px-4 py-2 text-sm font-medium text-slate hover:text-navy transition-colors rounded-full"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || !isValid}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium text-white transition-all shadow-sm ${
                isSubmitting || !isValid
                  ? 'bg-brandAccent/50 cursor-not-allowed'
                  : 'bg-brandAccent hover:bg-[#4a44cc] hover:shadow-md active:translate-y-0'
              }`}
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              <span>{isEdit ? 'Save Changes' : 'Create Schedule'}</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-5xl mx-auto space-y-8">
            {/* Global Server Error Banner */}
            {serverError && (
              <div className="p-4 bg-error/10 border border-error/20 rounded-xl flex items-center gap-3 text-error text-sm">
                <AlertCircle size={18} className="shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            {/* General Information Card */}
            <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-navy uppercase tracking-wider mb-6 flex items-center gap-2">
                <Briefcase size={16} className="text-brandAccent" />
                General Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Schedule Name */}
                <div className="lg:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-navy mb-2">
                    Schedule Name <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    {...register('name')}
                    placeholder="e.g. 40 Hours / Week"
                    className={`w-full bg-white border rounded-xl px-4 py-2.5 text-sm text-navy placeholder:text-mutedText focus:outline-none focus:ring-2 focus:ring-brandAccent/20 transition-all ${
                      errors.name ? 'border-error focus:border-error' : 'border-border focus:border-brandAccent'
                    }`}
                  />
                  {errors.name && (
                    <p className="mt-1.5 text-xs text-error flex items-center gap-1">
                      <AlertCircle size={12} /> {errors.name.message}
                    </p>
                  )}
                </div>

                {/* Schedule Type */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-navy mb-2">
                    Schedule Type <span className="text-error">*</span>
                  </label>
                  <select
                    {...register('type')}
                    className="w-full bg-white border border-border rounded-xl px-4 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all cursor-pointer"
                  >
                    {WorkingScheduleTypeValues.map((t) => (
                      <option key={t} value={t}>
                        {t.charAt(0) + t.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                  {errors.type && (
                    <p className="mt-1.5 text-xs text-error">{errors.type.message}</p>
                  )}
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-navy mb-2">
                    Status <span className="text-error">*</span>
                  </label>
                  <select
                    {...register('status')}
                    className="w-full bg-white border border-border rounded-xl px-4 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brandAccent/20 focus:border-brandAccent transition-all cursor-pointer"
                  >
                    {WorkingScheduleStatusValues.map((s) => (
                      <option key={s} value={s}>
                        {s === 'ACTIVE' ? 'Active' : 'Inactive'}
                      </option>
                    ))}
                  </select>
                  {errors.status && (
                    <p className="mt-1.5 text-xs text-error">{errors.status.message}</p>
                  )}
                </div>

                {/* Company Name (Display Metadata) */}
                <div className="lg:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-navy mb-2">
                    Company Name <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    {...register('companyName')}
                    placeholder="e.g. PeoplePay360 Inc."
                    className={`w-full bg-white border rounded-xl px-4 py-2.5 text-sm text-navy placeholder:text-mutedText focus:outline-none focus:ring-2 focus:ring-brandAccent/20 transition-all ${
                      errors.companyName
                        ? 'border-error focus:border-error'
                        : 'border-border focus:border-brandAccent'
                    }`}
                  />
                  {errors.companyName && (
                    <p className="mt-1.5 text-xs text-error flex items-center gap-1">
                      <AlertCircle size={12} /> {errors.companyName.message}
                    </p>
                  )}
                </div>

                {/* Company Timezone (Read-only per architecture) */}
                <div className="lg:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-navy mb-2">
                    Company Timezone <span className="text-xs font-normal text-mutedText">(Read-only)</span>
                  </label>
                  <div className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-slate flex items-center justify-between">
                    <span>{schedule?.timezone || 'Asia/Kolkata'}</span>
                    <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md font-medium">
                      Company Standard
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Weekly Schedule Days Table */}
            <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm flex flex-col">
              <div className="p-6 border-b border-border flex items-center justify-between bg-surface/40">
                <div>
                  <h2 className="text-sm font-semibold text-navy uppercase tracking-wider flex items-center gap-2">
                    <CalendarIcon size={16} className="text-brandAccent" />
                    Weekly Working Days
                  </h2>
                  <p className="text-xs text-mutedText mt-0.5">
                    Configure daily shift hours and breaks. Days must have distinct weekdays.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddDay}
                  disabled={fields.length >= 7 || availableWeekdays.length === 0}
                  className={`group flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full border transition-all ${
                    fields.length >= 7 || availableWeekdays.length === 0
                      ? 'bg-surface border-border text-mutedText cursor-not-allowed'
                      : 'bg-white border-border text-navy hover:bg-surface hover:shadow-xs'
                  }`}
                >
                  <Plus size={14} className="transition-transform duration-300 group-hover:rotate-90 text-brandAccent" />
                  <span>Add Day</span>
                </button>
              </div>

              {errors.days?.message && (
                <div className="px-6 py-2.5 bg-error/10 text-error text-xs border-b border-error/20 flex items-center gap-1.5">
                  <AlertCircle size={14} />
                  <span>{errors.days.message}</span>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[750px]">
                  <thead>
                    <tr className="border-b border-border bg-surface/80 text-xs uppercase tracking-wider text-mutedText font-semibold">
                      <th className="px-6 py-3.5 w-48">Day of Week</th>
                      <th className="px-6 py-3.5 w-36">Start Time</th>
                      <th className="px-6 py-3.5 w-36">End Time</th>
                      <th className="px-6 py-3.5 w-40">Break (minutes)</th>
                      <th className="px-6 py-3.5">Shift Hours</th>
                      <th className="px-4 py-3.5 w-16 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-navy divide-y divide-border">
                    {fields.map((field, index) => {
                      const dayError = errors.days?.[index];
                      const preview = livePreview.dayPreviews[index];
                      const currentDayVal = watchedDays[index]?.dayOfWeek;

                      // Weekdays eligible for this dropdown: available ones PLUS current selected one
                      const selectableWeekdays = WeekdayValues.filter(
                        (w) => w === currentDayVal || !usedWeekdays.has(w)
                      );

                      return (
                        <tr key={field.id} className="hover:bg-surface/30 transition-colors">
                          {/* Weekday Selection */}
                          <td className="px-6 py-3.5 align-top">
                            <select
                              {...register(`days.${index}.dayOfWeek` as const)}
                              className={`w-full bg-white border rounded-lg px-3 py-1.5 text-sm font-medium text-navy focus:outline-none focus:ring-2 focus:ring-brandAccent/20 ${
                                dayError?.dayOfWeek ? 'border-error' : 'border-border focus:border-brandAccent'
                              }`}
                            >
                              {selectableWeekdays.map((w) => (
                                <option key={w} value={w}>
                                  {WEEKDAY_LABELS[w]}
                                </option>
                              ))}
                            </select>
                            {dayError?.dayOfWeek && (
                              <p className="text-xs text-error mt-1">{dayError.dayOfWeek.message}</p>
                            )}
                          </td>

                          {/* Start Time */}
                          <td className="px-6 py-3.5 align-top">
                            <input
                              type="time"
                              {...register(`days.${index}.startTime` as const)}
                              className={`w-full bg-white border rounded-lg px-3 py-1.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brandAccent/20 ${
                                dayError?.startTime ? 'border-error' : 'border-border focus:border-brandAccent'
                              }`}
                            />
                            {dayError?.startTime && (
                              <p className="text-xs text-error mt-1">{dayError.startTime.message}</p>
                            )}
                          </td>

                          {/* End Time */}
                          <td className="px-6 py-3.5 align-top">
                            <input
                              type="time"
                              {...register(`days.${index}.endTime` as const)}
                              className={`w-full bg-white border rounded-lg px-3 py-1.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brandAccent/20 ${
                                dayError?.endTime ? 'border-error' : 'border-border focus:border-brandAccent'
                              }`}
                            />
                            {dayError?.endTime && (
                              <p className="text-xs text-error mt-1">{dayError.endTime.message}</p>
                            )}
                          </td>

                          {/* Break Minutes */}
                          <td className="px-6 py-3.5 align-top">
                            <input
                              type="number"
                              min="0"
                              max="720"
                              step="5"
                              {...register(`days.${index}.breakMinutes` as const, {
                                valueAsNumber: true,
                              })}
                              className={`w-full bg-white border rounded-lg px-3 py-1.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brandAccent/20 ${
                                dayError?.breakMinutes ? 'border-error' : 'border-border focus:border-brandAccent'
                              }`}
                            />
                            {dayError?.breakMinutes && (
                              <p className="text-xs text-error mt-1">{dayError.breakMinutes.message}</p>
                            )}
                          </td>

                          {/* Live Shift Hours & Overnight Badge */}
                          <td className="px-6 py-3.5 align-top">
                            <div className="flex items-center gap-2 pt-1.5">
                              <span className="font-semibold text-navy">
                                {preview?.hoursText || '-'}
                              </span>
                              {preview?.overnight && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  <Moon size={11} /> Overnight
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Delete Day Action */}
                          <td className="px-4 py-3.5 text-center align-top pt-2">
                            <button
                              type="button"
                              onClick={() => remove(index)}
                              className="p-1.5 text-mutedText hover:text-error hover:bg-error/10 rounded-md transition-colors"
                              title="Remove day"
                            >
                              <X size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {fields.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate">
                          <p className="text-sm mb-2">No working days added yet.</p>
                          <button
                            type="button"
                            onClick={handleAddDay}
                            className="inline-flex items-center gap-1 text-sm font-medium text-brandAccent hover:underline"
                          >
                            <Plus size={14} /> Add your first working day
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Grid Summary Footer */}
              <div className="p-6 bg-surface/50 border-t border-border flex justify-between items-center flex-wrap gap-4">
                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-xs text-mutedText uppercase font-semibold tracking-wider block">
                      Days per week
                    </span>
                    <span className="text-lg font-bold text-navy">{fields.length}</span>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div>
                    <span className="text-xs text-mutedText uppercase font-semibold tracking-wider block">
                      Available Weekdays
                    </span>
                    <span className="text-sm font-medium text-slate">
                      {availableWeekdays.length > 0
                        ? availableWeekdays.map((w) => WEEKDAY_LABELS[w]).join(', ')
                        : 'All 7 weekdays added'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-xl border border-border shadow-xs">
                  <Clock className="text-brandAccent" size={20} />
                  <div>
                    <span className="text-xs text-mutedText uppercase font-semibold tracking-wider block">
                      Total Weekly Hours (Live Preview)
                    </span>
                    <span className="text-xl font-bold text-navy">
                      {livePreview.totalHoursText}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </AppLayout>
  );
}
