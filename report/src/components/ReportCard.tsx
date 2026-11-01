import React from 'react';
import { 
  FileText, 
  Star, 
  ExternalLink, 
  Sparkles, 
  UploadCloud, 
  Edit, 
  Trash2, 
  Calendar, 
  Clock, 
  Bot, 
  CheckCircle2, 
  AlertCircle,
  Copy,
  Download,
  MessageCircle,
  Eye,
  CloudUpload,
  WifiOff,
  HardDrive
} from 'lucide-react';
import { ReportItem, ReportStatus } from '../types';
import { isBackupWarningNeeded, backupReportLocally } from '../lib/submitWorkflow';
import { getFrequencyBadge } from '../lib/scheduleUtils';

interface ReportCardProps {
  report: ReportItem;
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

export const ReportCard: React.FC<ReportCardProps> = ({
  report,
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
  const needsBackup = isBackupWarningNeeded(report);

  const handleQuickView = () => {
    const rawLink = report.webContentLink || report.webViewLink || report.path;
    const encoded = encodeURIComponent(rawLink);
    window.open(`https://view.officeapps.live.com/op/view.aspx?src=${encoded}`, '_blank');
  };

  const handleViewFile = () => {
    if (report.webViewLink) {
      window.open(report.webViewLink, '_blank');
    } else if (onOpenReportFile) {
      onOpenReportFile(report);
    } else {
      onViewReport(report);
    }
  };

  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'Done':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'Sent':
        return 'bg-baemin-light text-baemin border-baemin/40';
      case 'In Progress':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'Pending Review':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Báo cáo ngày': return 'text-baemin bg-baemin-light border-baemin/30 font-extrabold';
      case 'Báo cáo tuần': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'Báo cáo tháng': return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      default: return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
    }
  };

  const getFileExt = (path: string) => {
    if (!path) return 'PDF';
    const parts = path.split('.');
    return parts.length > 1 ? parts.pop()!.toUpperCase() : 'PDF';
  };

  return (
    <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5 relative group">
      
      {/* Top Meta Bar */}
      <div>
        {/* Backup Warning Badge if > 7 days */}
        {needsBackup && (
          <div className="mb-2.5 bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-300 rounded-xl px-3 py-1.5 text-[11px] font-bold flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>⚠️ Quá 7 ngày chưa backup local</span>
            </span>
            {onBackupLocal && (
              <button
                type="button"
                onClick={() => onBackupLocal(report)}
                className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-md transition-all text-[10px] active:scale-95"
              >
                Backup Ngay
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-full border ${getCategoryColor(report.category)}`}>
              {report.category}
            </span>
            {(() => {
              const freqBadge = getFrequencyBadge(report.frequency, report.category);
              if (!freqBadge) return null;
              return (
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${freqBadge.bg} ${freqBadge.color}`}>
                  {freqBadge.text}
                </span>
              );
            })()}
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700/60 font-mono">
              v{report.version}.0
            </span>
            {report.webViewLink ? (
              <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/30 flex items-center gap-1">
                <CloudUpload className="w-3 h-3 text-blue-500" /> Drive
              </span>
            ) : report.pendingSync ? (
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                <WifiOff className="w-3 h-3 text-amber-500" /> Pending Sync
              </span>
            ) : null}
            {report.agentEnabled && (
              <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-500/10 dark:bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/30 flex items-center gap-1">
                <Bot className="w-3 h-3" /> Auto Agent
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Quick 1-Tap Task Completion Toggle Button */}
            <button
              onClick={() => onStatusChange(report.id, (report.status === 'Done' || report.status === 'Sent') ? 'To-do' : 'Done')}
              className={`px-2.5 py-1 text-[11px] font-black rounded-xl transition-all flex items-center gap-1 shadow-sm cursor-pointer ${
                report.status === 'Done' || report.status === 'Sent'
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 hover:bg-emerald-600 hover:text-white border border-slate-200 dark:border-slate-700'
              }`}
              title={(report.status === 'Done' || report.status === 'Sent') ? 'Bấm để đổi lại thành To-do (Chờ làm)' : 'Tích 1-Chạm để ĐÃ HOÀN THÀNH công việc này'}
            >
              <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{(report.status === 'Done' || report.status === 'Sent') ? 'Đã Xong ✓' : 'Đánh dấu Xong'}</span>
            </button>

            <button
              onClick={() => onTogglePin(report.id)}
              className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
              title={report.pinned ? 'Bỏ ghim' : 'Ghim báo cáo này'}
            >
              <Star className={`w-4 h-4 ${report.pinned ? 'text-amber-400 fill-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Title & Project */}
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-baemin transition-colors leading-snug mb-1">
          {report.title}
        </h3>

        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mb-3 flex-wrap">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Dự án: {report.project}</span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            {report.date.split('-').reverse().join('/')}
          </span>
          {report.reminderTime && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
              <Clock className="w-3.5 h-3.5" />
              {report.reminderTime}
            </span>
          )}
        </div>

        {/* Path / File info & Direct File Action Buttons */}
        <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 rounded-xl p-2.5 flex flex-col gap-2 text-xs font-mono text-slate-500 dark:text-slate-400 mb-3">
          {/* File extension & name row */}
          <div className="flex items-center gap-2 min-w-0 w-full">
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-baemin-light text-baemin rounded border border-baemin/30 shrink-0 uppercase font-sans">
              {getFileExt(report.fileName || report.path)}
            </span>
            <span className="truncate text-slate-800 dark:text-slate-200 font-semibold text-xs min-w-0 flex-1 font-mono" title={report.fileName || report.path}>
              {report.fileName || report.path}
            </span>
          </div>

          {/* Direct File action buttons */}
          <div className="flex items-center gap-1.5 font-sans flex-wrap pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
            {/* View File Button */}
            <button
              type="button"
              onClick={handleViewFile}
              className="px-2.5 py-1 text-[10px] sm:text-[11px] font-extrabold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 rounded-lg transition-all flex items-center gap-1 active:scale-95 whitespace-nowrap"
              title="View File: Mở Google Drive / ứng dụng xem file trực tiếp"
            >
              <ExternalLink className="w-3 h-3 stroke-[2.5]" />
              <span>View File</span>
            </button>

            {/* Quick View Button (Eye Icon / MS Office Viewer) */}
            <button
              type="button"
              onClick={handleQuickView}
              className="px-2.5 py-1 text-[10px] sm:text-[11px] font-extrabold bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 border border-sky-500/30 rounded-lg transition-all flex items-center gap-1 active:scale-95 whitespace-nowrap"
              title="Quick View: Xem nhanh qua Microsoft Office Online Viewer"
            >
              <Eye className="w-3 h-3 stroke-[2.5]" />
              <span>Quick View</span>
            </button>

            {/* Backup Local Button */}
            {onBackupLocal && (
              <button
                type="button"
                onClick={() => onBackupLocal(report)}
                className="px-2.5 py-1 text-[10px] sm:text-[11px] font-extrabold bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 rounded-lg transition-all flex items-center gap-1 active:scale-95 whitespace-nowrap"
                title="Backup Local: Tải file về thiết bị và lưu lịch sử backup"
              >
                <HardDrive className="w-3 h-3 stroke-[2.5]" />
                <span>Backup Local</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onEdit(report)}
              className="px-2.5 py-1 text-[10px] sm:text-[11px] font-extrabold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg transition-all flex items-center gap-1 active:scale-95 whitespace-nowrap"
              title="Chỉnh sửa & Thay thế file báo cáo"
            >
              <Edit className="w-3 h-3 stroke-[2.5]" />
              <span>Sửa File</span>
            </button>
          </div>
        </div>

        {/* Notes / AI Summary snippet */}
        {report.aiSummary ? (
          <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-500/20 rounded-xl p-3 text-xs text-purple-900 dark:text-purple-200/90 space-y-1 mb-3">
            <div className="flex items-center gap-1.5 font-bold text-purple-700 dark:text-purple-400 text-[11px] uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> AI Executive Summary
            </div>
            <p className="line-clamp-2 leading-relaxed whitespace-pre-line">
              {report.aiSummary}
            </p>
          </div>
        ) : report.notes ? (
          <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800/60 line-clamp-2 mb-3">
            📝 {report.notes}
          </p>
        ) : null}
      </div>

      {/* Footer Controls & Status Dropdown */}
      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
        
        {/* Status Selector */}
        <select
          value={report.status}
          onChange={(e) => onStatusChange(report.id, e.target.value as ReportStatus)}
          className={`text-[11px] sm:text-xs font-extrabold rounded-lg px-2.5 py-1 border transition-all cursor-pointer ${getStatusBadge(report.status)}`}
        >
          <option value="To-do">To-do (Chờ làm)</option>
          <option value="In Progress">In Progress (Đang làm)</option>
          <option value="Pending Review">Pending Review (Chờ duyệt)</option>
          <option value="Done">Done (Đã duyệt)</option>
          <option value="Sent">Sent (Đã gửi)</option>
        </select>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          
          <button
            onClick={() => onOpenAiSummary(report)}
            className="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 rounded-lg transition-all"
            title="Phân tích & Tóm tắt AI Gemini"
          >
            <Sparkles className="w-4 h-4" />
          </button>

          <button
            onClick={() => onSubmitReport(report)}
            className="px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-extrabold bg-baemin hover:bg-baemin-dark text-slate-950 rounded-xl transition-all flex items-center gap-1 shadow-sm whitespace-nowrap active:scale-95"
            title="Nộp 1-Click: Tải file, copy ghi chú & mở trang nộp"
          >
            <UploadCloud className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Sẵn sàng Nộp</span>
          </button>

          {onSendZaloReport && (
            <button
              onClick={() => onSendZaloReport(report)}
              className="px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-extrabold bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl transition-all flex items-center gap-1 shadow-sm whitespace-nowrap active:scale-95"
              title={`Gửi Zalo Duyệt 1-Click cho SĐT: ${report.zaloPhone || '0912345678'}`}
            >
              <MessageCircle className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Zalo Duyệt</span>
            </button>
          )}

          <button
            onClick={() => onEdit(report)}
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-all"
            title="Chỉnh sửa"
          >
            <Edit className="w-4 h-4" />
          </button>

          <button
            onClick={() => onDelete(report.id)}
            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
            title="Xóa báo cáo"
          >
            <Trash2 className="w-4 h-4" />
          </button>

        </div>

      </div>

    </div>
  );
};
