import React from 'react';
import { Star, ExternalLink, FileText, UploadCloud, Calendar, Folder, MessageCircle, HardDrive } from 'lucide-react';
import { ReportItem } from '../types';
import { getFrequencyBadge } from '../lib/scheduleUtils';

interface QuickAccessPinnedProps {
  pinnedReports: ReportItem[];
  onTogglePin: (id: string) => void;
  onViewReport: (report: ReportItem) => void;
  onSubmitReport: (report: ReportItem) => void;
  onSendZaloReport?: (report: ReportItem) => void;
  onOpenReportFile?: (report: ReportItem) => void;
}

export const QuickAccessPinned: React.FC<QuickAccessPinnedProps> = ({
  pinnedReports,
  onTogglePin,
  onViewReport,
  onSubmitReport,
  onSendZaloReport,
  onOpenReportFile
}) => {
  if (pinnedReports.length === 0) return null;

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Báo cáo ngày': return 'text-baemin bg-baemin-light border-baemin/30 font-extrabold';
      case 'Báo cáo tuần': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'Báo cáo tháng': return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      default: return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
    }
  };

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
          Truy Cập Nhanh (Báo Cáo Ghim)
        </h2>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          {pinnedReports.length} báo cáo ưu tiên
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {pinnedReports.map(report => (
          <div 
            key={report.id}
            className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 relative group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  <span className={`inline-block px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-full border ${getCategoryColor(report.category)}`}>
                    {report.category}
                  </span>
                  {(() => {
                    const badge = getFrequencyBadge(report.frequency, report.category);
                    if (!badge) return null;
                    return (
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${badge.bg} ${badge.color}`}>
                        {badge.text}
                      </span>
                    );
                  })()}
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug group-hover:text-baemin transition-colors">
                  {report.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1 font-mono">
                  <Folder className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
                  <span className="truncate">{report.project}</span>
                </p>
              </div>

              <button
                onClick={() => onTogglePin(report.id)}
                className="p-1.5 text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all shrink-0"
                title="Bỏ ghim"
              >
                <Star className="w-4 h-4 fill-amber-400" />
              </button>
            </div>

            <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800/80 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1 font-semibold">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  {report.date.split('-').reverse().join('/')}
                </span>
                {report.reminderTime && (
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                    ⏰ {report.reminderTime}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => onSubmitReport(report)}
                  className="px-2 py-1 text-[10px] sm:text-[11px] font-extrabold bg-baemin hover:bg-baemin-dark text-slate-950 rounded-lg transition-all flex items-center gap-1 shadow-sm whitespace-nowrap active:scale-95"
                  title="Nộp 1-Click (Tải file, copy ghi chú & mở trang nộp)"
                >
                  <UploadCloud className="w-3 h-3 stroke-[2.5]" />
                  <span>Sẵn sàng Nộp</span>
                </button>
                {onSendZaloReport && (
                  <button
                    onClick={() => onSendZaloReport(report)}
                    className="px-2 py-1 text-[10px] sm:text-[11px] font-extrabold bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg transition-all flex items-center gap-1 shadow-sm whitespace-nowrap active:scale-95"
                    title={`Gửi Zalo Duyệt 1-Click cho SĐT: ${report.zaloPhone || '0912345678'}`}
                  >
                    <MessageCircle className="w-3 h-3 stroke-[2.5]" />
                    <span>Zalo Duyệt</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onOpenReportFile ? onOpenReportFile(report) : onViewReport(report)}
                  className="px-2 py-1 text-[10px] sm:text-[11px] font-extrabold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 rounded-lg transition-all flex items-center gap-1 whitespace-nowrap active:scale-95"
                  title="View File: Mở Google Drive / file trực tiếp"
                >
                  <ExternalLink className="w-3 h-3 stroke-[2.5]" />
                  <span>View File</span>
                </button>
                <button
                  onClick={() => onViewReport(report)}
                  className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg transition-all shrink-0 ml-auto"
                  title="Sửa / Chi tiết báo cáo"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </div>
        ))}
      </div>
    </section>
  );
};
