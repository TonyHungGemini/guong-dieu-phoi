import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Plus, FileText, CheckCircle2 } from 'lucide-react';
import { ReportItem } from '../types';

interface CalendarViewProps {
  reports: ReportItem[];
  onViewReport: (report: ReportItem) => void;
  onOpenAddModalWithDate: (dateStr: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  reports,
  onViewReport,
  onOpenAddModalWithDate
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Day of week index (0: Sun, 1: Mon...) -> Adjust for Monday start (0: Mon ... 6: Sun)
  let startingDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startingDayOfWeek < 0) startingDayOfWeek = 6;

  const totalDays = lastDayOfMonth.getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const todayMonth = () => setCurrentDate(new Date());

  const monthNames = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
  ];

  const daysOfWeek = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];

  // Helper to format date YYYY-MM-DD
  const formatDateKey = (dayNum: number) => {
    const m = (month + 1).toString().padStart(2, '0');
    const d = dayNum.toString().padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm mb-8">
      
      {/* Calendar Header Nav */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-baemin-light text-baemin flex items-center justify-center border border-baemin/30">
            <CalendarIcon className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
              Lịch Làm Việc & Nhắc Nhở Báo Cáo
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Theo dõi hạn chót và đặt giờ tự động gửi báo cáo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={todayMonth}
            className="px-3 py-1.5 text-xs font-extrabold bg-baemin-light hover:bg-baemin text-baemin hover:text-slate-950 rounded-lg border border-baemin/40 transition-all baemin-hover-pop"
          >
            Hôm nay
          </button>
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-1">
            <button
              onClick={prevMonth}
              className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-sm font-extrabold text-slate-800 dark:text-slate-200 min-w-[110px] text-center">
              {monthNames[month]} {year}
            </span>
            <button
              onClick={nextMonth}
              className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid Days Header */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center mb-2">
        {daysOfWeek.map((day) => (
          <div key={day} className="py-2 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider bg-slate-100 dark:bg-slate-950/60 rounded-lg border border-slate-200 dark:border-slate-800/60">
            {day}
          </div>
        ))}
      </div>

      {/* Grid Days Cells */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {/* Blank preceding days */}
        {Array.from({ length: startingDayOfWeek }).map((_, idx) => (
          <div key={`blank-${idx}`} className="min-h-[90px] sm:min-h-[110px] bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800/30 rounded-xl opacity-40"></div>
        ))}

        {/* Days of current month */}
        {Array.from({ length: totalDays }).map((_, idx) => {
          const dayNum = idx + 1;
          const dateKey = formatDateKey(dayNum);
          const dayReports = reports.filter((r) => r.date === dateKey);
          const isToday = dateKey === todayStr;

          return (
            <div
              key={dateKey}
              className={`min-h-[90px] sm:min-h-[110px] bg-white dark:bg-slate-950 border rounded-xl p-1.5 sm:p-2 flex flex-col justify-between transition-all group hover:border-baemin/60 relative ${
                isToday ? 'border-baemin bg-baemin-light/40 shadow-sm' : 'border-slate-200 dark:border-slate-800/80'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                  isToday ? 'bg-baemin text-slate-950 font-black shadow-sm' : 'text-slate-700 dark:text-slate-300'
                }`}>
                  {dayNum}
                </span>

                <button
                  onClick={() => onOpenAddModalWithDate(dateKey)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-baemin hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-all"
                  title="Thêm báo cáo cho ngày này"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Day's Report Chips */}
              <div className="space-y-1 overflow-y-auto max-h-[70px] scrollbar-none">
                {dayReports.map((report) => (
                  <div
                    key={report.id}
                    onClick={() => onViewReport(report)}
                    className={`cursor-pointer text-[10px] sm:text-[11px] p-1.5 rounded-lg border font-medium truncate flex items-center justify-between gap-1 transition-all hover:scale-[1.02] ${
                      report.status === 'Sent'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : report.status === 'Done'
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    }`}
                    title={`${report.title} (${report.reminderTime || 'Không cài giờ'})`}
                  >
                    <span className="truncate">{report.title}</span>
                    {report.reminderTime && (
                      <span className="shrink-0 text-[9px] opacity-80 flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" /> {report.reminderTime}
                      </span>
                    )}
                  </div>
                ))}
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
