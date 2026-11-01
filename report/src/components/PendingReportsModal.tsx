import React, { useState } from 'react';
import { X, CheckCircle2, Clock, Calendar, AlertCircle, FileText, Sparkles, Send, Eye, ShieldAlert, ArrowUpRight } from 'lucide-react';
import { ReportItem } from '../types';

interface PendingReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  reports: ReportItem[];
  onOneClickSubmit: (report: ReportItem) => Promise<void>;
  onQuickView: (report: ReportItem) => void;
  onOpenCreateNew: () => void;
}

export const PendingReportsModal: React.FC<PendingReportsModalProps> = ({
  isOpen,
  onClose,
  reports,
  onOneClickSubmit,
  onQuickView,
  onOpenCreateNew,
}) => {
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState('');

  if (!isOpen) return null;

  // Category helpers
  const isDaily = (c: string) => c === 'Báo cáo ngày' || c === 'Daily';
  const isWeekly = (c: string) => c === 'Báo cáo tuần' || c === 'Weekly';
  const isMonthly = (c: string) => c === 'Báo cáo tháng' || c === 'Monthly';

  // Filter pending reports (not Submitted or Done)
  const pendingReports = reports.filter(r => {
    const isPending = r.status !== 'Done' && r.status !== 'Sent';
    if (!isPending) return false;
    if (!filterSearch.trim()) return true;
    const q = filterSearch.toLowerCase();
    return r.title.toLowerCase().includes(q) || r.project?.toLowerCase().includes(q) || r.category.toLowerCase().includes(q);
  });

  // Grouping & Sorting by Priority: Daily -> Weekly -> Monthly -> Yearly/Ad-hoc
  const dailyReports = pendingReports
    .filter(r => isDaily(r.category))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const weeklyReports = pendingReports
    .filter(r => isWeekly(r.category))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const monthlyReports = pendingReports
    .filter(r => isMonthly(r.category))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const otherReports = pendingReports
    .filter(r => !isDaily(r.category) && !isWeekly(r.category) && !isMonthly(r.category))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const totalPendingCount = pendingReports.length;

  const handleSubmitItem = async (report: ReportItem) => {
    setSubmittingId(report.id);
    try {
      await onOneClickSubmit(report);
    } finally {
      setSubmittingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'In Progress':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3" /> Đang thực hiện
          </span>
        );
      case 'Pending Review':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30">
            <AlertCircle className="w-3 h-3" /> Chờ xem xét
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/30">
            <Clock className="w-3 h-3" /> Chưa bắt đầu
          </span>
        );
    }
  };

  const renderGroup = (
    title: string,
    badgeText: string,
    badgeBg: string,
    items: ReportItem[],
    icon: React.ReactNode,
    isUrgent = false
  ) => {
    if (items.length === 0) return null;

    return (
      <div className="space-y-3">
        {/* Group Header */}
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              {title}
            </h3>
            {isUrgent && (
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 animate-pulse">
                🔥 Ưu Tiên Cao
              </span>
            )}
          </div>
          <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${badgeBg}`}>
            {items.length} {badgeText}
          </span>
        </div>

        {/* Group Items */}
        <div className="grid grid-cols-1 gap-3">
          {items.map(report => {
            const isSubmittingThis = submittingId === report.id;

            return (
              <div
                key={report.id}
                className="group relative bg-slate-50 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 rounded-2xl p-4 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left Column: Details */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-extrabold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                        {report.category}
                      </span>
                      {getStatusBadge(report.status)}
                      {report.project && (
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold truncate max-w-[180px]">
                          • Dự án: {report.project}
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {report.title}
                    </h4>

                    <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" /> Hạn/Ngày: {report.date}
                      </span>
                      {report.fileName && (
                        <span className="hidden sm:inline-block truncate max-w-[180px] text-slate-400">
                          📎 {report.fileName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => onQuickView(report)}
                      className="px-3 py-2 bg-slate-200/70 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5"
                      title="Xem chi tiết & chỉnh sửa"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span>Xem Nhanh</span>
                    </button>

                    <button
                      onClick={() => handleSubmitItem(report)}
                      disabled={isSubmittingThis}
                      className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-500/20 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
                      title="Tải file & mở liên kết nộp báo cáo 1-Click"
                    >
                      {isSubmittingThis ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Đang nộp...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Nộp 1-Chạm</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-950 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  Danh Sách Báo Cáo Đang Chờ Nộp
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                  {totalPendingCount} chưa hoàn thành
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sắp xếp ưu tiên theo báo cáo Ngày → Tuần → Tháng. Bấm "Nộp 1-Chạm" để xử lý ngay!
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        {totalPendingCount > 0 && (
          <div className="px-5 py-2.5 bg-slate-100/60 dark:bg-slate-900/30 border-b border-slate-200/80 dark:border-slate-800">
            <input
              type="text"
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              placeholder="🔍 Tìm nhanh báo cáo đang chờ theo tên, dự án..."
              className="w-full px-3.5 py-2 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {totalPendingCount === 0 ? (
            <div className="text-center py-12 space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/30">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Tất Cả Báo Cáo Đã Hoàn Thành! 🎉
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tuyệt vời! Bạn không còn báo cáo nào tồn đọng. Chú Ong Vàng tuyên dương sự chăm chỉ của bạn!
                </p>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenCreateNew();
                }}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-500/20 transition-all inline-flex items-center gap-2"
              >
                <FileText className="w-4 h-4" /> Tạo Báo Cáo Mới
              </button>
            </div>
          ) : (
            <>
              {/* Group 1: Daily Reports */}
              {renderGroup(
                'Báo Cáo Ngày (Daily)',
                'báo cáo ngày',
                'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30',
                dailyReports,
                <Clock className="w-4 h-4 text-rose-500" />,
                true
              )}

              {/* Group 2: Weekly Reports */}
              {renderGroup(
                'Báo Cáo Tuần (Weekly)',
                'báo cáo tuần',
                'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30',
                weeklyReports,
                <Calendar className="w-4 h-4 text-amber-500" />
              )}

              {/* Group 3: Monthly Reports */}
              {renderGroup(
                'Báo Cáo Tháng (Monthly)',
                'báo cáo tháng',
                'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30',
                monthlyReports,
                <FileText className="w-4 h-4 text-indigo-500" />
              )}

              {/* Group 4: Other Reports */}
              {renderGroup(
                'Báo Cáo Năm & Khác (Yearly / Ad-hoc)',
                'báo cáo',
                'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/30',
                otherReports,
                <FileText className="w-4 h-4 text-slate-500" />
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            🐝 Chú Ong Chăm Chỉ tự động hỗ trợ nhắc lịch
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-xs rounded-xl transition-all"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
