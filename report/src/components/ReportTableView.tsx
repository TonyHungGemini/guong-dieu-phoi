import React from 'react';
import { Star, ExternalLink, Sparkles, UploadCloud, Edit, Trash2, Bot, Calendar, MessageCircle, Download, HardDrive, Eye, CheckCircle2 } from 'lucide-react';
import { ReportItem, ReportStatus } from '../types';
import { getFrequencyBadge } from '../lib/scheduleUtils';

interface ReportTableViewProps {
  reports: ReportItem[];
  onStatusChange: (id: string, newStatus: ReportStatus) => void;
  onTogglePin: (id: string) => void;
  onViewReport: (report: ReportItem) => void;
  onOpenAiSummary: (report: ReportItem) => void;
  onSubmitReport: (report: ReportItem) => void;
  onSendZaloReport?: (report: ReportItem) => void;
  onOpenReportFile?: (report: ReportItem) => void;
  onBackupLocal?: (report: ReportItem) => void;
  onEdit: (report: ReportItem) => void;
  onDelete: (id: string) => void;
}

export const ReportTableView: React.FC<ReportTableViewProps> = ({
  reports,
  onStatusChange,
  onTogglePin,
  onViewReport,
  onOpenAiSummary,
  onSubmitReport,
  onSendZaloReport,
  onOpenReportFile,
  onBackupLocal,
  onEdit,
  onDelete
}) => {
  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'Done': return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
      case 'Sent': return 'bg-baemin-light text-baemin border-baemin/40';
      case 'In Progress': return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30';
      case 'Pending Review': return 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30';
      default: return 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-700';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Báo cáo ngày': return 'text-baemin bg-baemin-light border-baemin/30 font-extrabold';
      case 'Báo cáo tuần': return 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'Báo cáo tháng': return 'text-purple-700 dark:text-purple-400 bg-purple-500/10 border-purple-500/20';
      default: return 'text-orange-700 dark:text-orange-400 bg-orange-500/10 border-orange-500/20';
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-800 dark:text-slate-200">
          <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-bold uppercase text-[11px] tracking-wider border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="py-3.5 px-4">Tên Báo Cáo / Dự Án</th>
              <th className="py-3.5 px-4">Danh Mục</th>
              <th className="py-3.5 px-4">Ngày Báo Cáo</th>
              <th className="py-3.5 px-4">Trạng Thái</th>
              <th className="py-3.5 px-4">Đường Dẫn File</th>
              <th className="py-3.5 px-4 text-right">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
            {reports.map((report) => (
              <tr key={report.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                
                {/* Title & Project */}
                <td className="py-3.5 px-4">
                  <div className="flex items-start gap-2.5">
                    <button
                      onClick={() => onTogglePin(report.id)}
                      className="p-1 text-slate-400 hover:text-amber-500 transition-colors shrink-0 mt-0.5"
                    >
                      <Star className={`w-4 h-4 ${report.pinned ? 'text-amber-400 fill-amber-400' : ''}`} />
                    </button>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        {report.title}
                        {report.agentEnabled && (
                          <span title="Bật Agent tự động">
                            <Bot className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>Dự án: {report.project}</span>
                        <span>•</span>
                        <span>v{report.version}.0</span>
                      </div>
                    </div>
                  </div>
                </td>

                {/* Category */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-full border ${getCategoryColor(report.category)}`}>
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
                </td>

                {/* Date */}
                <td className="py-3.5 px-4 whitespace-nowrap text-xs font-medium text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    {report.date.split('-').reverse().join('/')}
                  </div>
                </td>

                {/* Status */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onStatusChange(report.id, (report.status === 'Done' || report.status === 'Sent') ? 'To-do' : 'Done')}
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                        report.status === 'Done' || report.status === 'Sent'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-emerald-600 hover:border-emerald-500 border-slate-200 dark:border-slate-700'
                      }`}
                      title={(report.status === 'Done' || report.status === 'Sent') ? 'Đã xong (Bấm để mở lại)' : 'Bấm 1-Chạm để Đã Hoàn Thành'}
                    >
                      <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    </button>
                    <select
                      value={report.status}
                      onChange={(e) => onStatusChange(report.id, e.target.value as ReportStatus)}
                      className={`text-xs font-extrabold rounded-lg px-2.5 py-1 border transition-all cursor-pointer ${getStatusBadge(report.status)}`}
                    >
                      <option value="To-do">To-do</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Pending Review">Pending Review</option>
                      <option value="Done">Done</option>
                      <option value="Sent">Sent</option>
                    </select>
                  </div>
                </td>

                {/* File / Path & Direct Actions */}
                <td className="py-3.5 px-4 min-w-[240px]">
                  <div className="flex flex-col gap-1.5">
                    <span className="font-mono text-xs text-slate-800 dark:text-slate-300 bg-slate-100 dark:bg-slate-950 px-2 py-1 rounded border border-slate-200 dark:border-slate-800 truncate block max-w-[280px]" title={report.fileName || report.path}>
                      {report.fileName || report.path}
                    </span>
                    <div className="flex items-center gap-1.5 font-sans flex-wrap">
                      <button
                        type="button"
                        onClick={() => onOpenReportFile ? onOpenReportFile(report) : onViewReport(report)}
                        className="px-2.5 py-1 text-[10px] font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 rounded-lg transition-all inline-flex items-center gap-1 active:scale-95 whitespace-nowrap"
                        title="View File: Mở Google Drive / file trực tiếp"
                      >
                        <ExternalLink className="w-2.5 h-2.5 stroke-[2.5]" /> View File
                      </button>
                      {onBackupLocal && (
                        <button
                          type="button"
                          onClick={() => onBackupLocal(report)}
                          className="px-2 py-0.5 text-[10px] font-extrabold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 rounded-lg transition-all inline-flex items-center gap-1 active:scale-95 whitespace-nowrap"
                          title="Sao lưu file báo cáo về máy local"
                        >
                          <HardDrive className="w-2.5 h-2.5 stroke-[2.5]" /> Backup Local
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onEdit(report)}
                        className="px-2.5 py-1 text-[10px] font-bold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg transition-all inline-flex items-center gap-1 active:scale-95 whitespace-nowrap"
                        title="Chỉnh sửa & Thay thế file báo cáo"
                      >
                        <Edit className="w-2.5 h-2.5 stroke-[2.5]" /> Sửa File
                      </button>
                    </div>
                  </div>
                </td>

                {/* Actions */}
                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => onSubmitReport(report)}
                      className="px-2.5 py-1 text-xs font-bold bg-baemin hover:bg-baemin-dark text-slate-950 rounded-lg transition-all flex items-center gap-1 shadow-sm whitespace-nowrap active:scale-95"
                      title="Nộp 1-Click (Tải file, copy ghi chú & mở trang nộp)"
                    >
                      <UploadCloud className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Sẵn sàng Nộp</span>
                    </button>
                    {onSendZaloReport && (
                      <button
                        onClick={() => onSendZaloReport(report)}
                        className="px-2.5 py-1 text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg transition-all flex items-center gap-1 shadow-sm whitespace-nowrap active:scale-95"
                        title={`Gửi Zalo Duyệt 1-Click cho SĐT: ${report.zaloPhone || '0912345678'}`}
                      >
                        <MessageCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Zalo Duyệt</span>
                      </button>
                    )}
                    <button
                      onClick={() => onViewReport(report)}
                      className="p-1.5 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                      title="Mở file"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onOpenAiSummary(report)}
                      className="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 rounded-lg transition-all"
                      title="Tóm tắt AI"
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onEdit(report)}
                      className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                      title="Chỉnh sửa"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(report.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                      title="Xóa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
