import React from 'react';
import { X, History, CheckCircle2, AlertTriangle, Bot, FileText, Trash2, Zap } from 'lucide-react';
import { AuditLogItem } from '../types';

interface AuditLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  logs: AuditLogItem[];
  onClearLogs: () => void;
}

export const AuditLogDrawer: React.FC<AuditLogDrawerProps> = ({
  isOpen,
  onClose,
  logs,
  onClearLogs
}) => {
  if (!isOpen) return null;

  const getLogIcon = (action: string) => {
    switch (action) {
      case 'AGENT_DISPATCH':
      case 'WEBHOOK_TRIGGERED':
        return <Bot className="w-4 h-4 text-purple-400" />;
      case 'AI_SUMMARY':
        return <Zap className="w-4 h-4 text-amber-400" />;
      case 'CREATED':
      case 'UPDATED':
        return <FileText className="w-4 h-4 text-blue-400" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-end">
      <div className="bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 w-full max-w-md h-full shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                Nhật Ký Tự Động Hóa & Agent Logs
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Lịch sử gửi email, webhook và cập nhật trạng thái
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Logs List */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {logs.length === 0 ? (
            <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-xs font-medium">
              Chưa có nhật ký ghi nhận.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-3.5 flex items-start gap-3 text-xs shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all"
              >
                <div className="p-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0 mt-0.5">
                  {getLogIcon(log.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="font-bold text-slate-900 dark:text-slate-200 truncate">
                      {log.reportTitle || log.action}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                    {log.details}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90 flex items-center justify-between">
          <button
            onClick={onClearLogs}
            className="px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded-xl border border-rose-500/20 transition-all flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" /> Xóa Nhật Ký
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-all"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
