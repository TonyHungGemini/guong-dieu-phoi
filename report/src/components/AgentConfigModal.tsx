import React, { useState } from 'react';
import { X, Bot, Send, CheckCircle2, AlertTriangle, Zap, Server, Mail, Play, Sparkles, RefreshCw } from 'lucide-react';
import { AgentGlobalConfig, ReportItem } from '../types';

interface AgentConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AgentGlobalConfig;
  onSaveConfig: (updated: AgentGlobalConfig) => Promise<void>;
  sampleReport?: ReportItem;
  onTestDispatchAgent: (report: ReportItem, config: AgentGlobalConfig) => Promise<any>;
}

export const AgentConfigModal: React.FC<AgentConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  sampleReport,
  onTestDispatchAgent
}) => {
  const [formData, setFormData] = useState<AgentGlobalConfig>(config);
  const [testing, setTesting] = useState(false);
  const [testLog, setTestLog] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSaveConfig(formData);
    setSaving(false);
    onClose();
  };

  const handleTestRun = async () => {
    if (!sampleReport) return;
    setTesting(true);
    setTestLog('Đang khởi tạo quy trình Nộp Báo Cáo 1-Click...\nKiểm tra IndexedDB & đính kèm file...');
    try {
      const res = await onTestDispatchAgent(sampleReport, formData);
      setTestLog(
        `✅ Đã thực thi Quy Trình Nộp Báo Cáo 1-Click thành công!\n` +
        `• Tên file tải về: ${res.filename || 'BaoCao.pdf'}\n` +
        `• Đã copy ghi chú: ${res.copiedNotes ? 'Có' : 'Không'}\n` +
        `• Trang nộp mở ra: ${res.submissionUrl || 'https://base.vn/'}\n` +
        `• Thông báo: ${res.message || 'Thành công'}`
      );
    } catch (err: any) {
      setTestLog(`❌ Lỗi thực thi quy trình: ${err.message || err}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-baemin text-slate-950 flex items-center justify-center shadow-baemin font-extrabold animate-baemin-bounce">
              <Bot className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Cấu Hình Quy Trình Nộp Báo Cáo 1-Click
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tự động kích hoạt quy trình tải file, sao chép nội dung & mở trang nộp khi báo cáo ở trạng thái "Done"
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          
          {/* Global Toggle */}
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <label className="text-sm font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                Kích hoạt Automation Agent Toàn Hệ Thống
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cho phép Agent kiểm tra và tự động gửi báo cáo khi thỏa mãn điều kiện
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.globalActive}
              onChange={(e) => setFormData({ ...formData, globalActive: e.target.checked })}
              className="w-5 h-5 text-blue-600 accent-blue-600 cursor-pointer rounded"
            />
          </div>

          {/* Auto Send on Done Toggle */}
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <label className="text-sm font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                Tự động gửi khi đánh dấu "Done" (Hoàn thành)
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Khi trạng thái chuyển thành "Done", Agent sẽ tự động gửi email & cập nhật thành "Sent"
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.autoSendOnDone}
              onChange={(e) => setFormData({ ...formData, autoSendOnDone: e.target.checked })}
              className="w-5 h-5 text-blue-600 accent-blue-600 cursor-pointer rounded"
            />
          </div>

          {/* Sender Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Tên Người Gửi (Agent Name)
              </label>
              <input
                type="text"
                value={formData.senderName}
                onChange={(e) => setFormData({ ...formData, senderName: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Email Cấu Hình Agent
              </label>
              <input
                type="email"
                value={formData.senderEmail}
                onChange={(e) => setFormData({ ...formData, senderEmail: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Webhook Endpoint Integrations */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" /> Tích Hợp Webhook / Zapier / Make / Custom Backend
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Zapier Catch Hook URL
              </label>
              <input
                type="url"
                value={formData.zapierWebhookUrl}
                onChange={(e) => setFormData({ ...formData, zapierWebhookUrl: e.target.value })}
                placeholder="https://hooks.zapier.com/hooks/catch/..."
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Make.com Webhook URL
              </label>
              <input
                type="url"
                value={formData.makeWebhookUrl}
                onChange={(e) => setFormData({ ...formData, makeWebhookUrl: e.target.value })}
                placeholder="https://hook.eu1.make.com/..."
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Custom Node.js Express API Endpoint
              </label>
              <input
                type="text"
                value={formData.customNodeApiUrl}
                onChange={(e) => setFormData({ ...formData, customNodeApiUrl: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Test Run Output Box */}
          {testLog && (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-mono text-slate-800 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
              {testLog}
            </div>
          )}

          {/* Modal Footer Buttons */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleTestRun}
              disabled={testing || !sampleReport}
              className="px-4 py-2 text-xs font-bold bg-purple-500/15 hover:bg-purple-500/25 text-purple-700 dark:text-purple-300 border border-purple-500/30 rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Test Chạy Thử Agent
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-all"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-xs font-black bg-baemin hover:bg-baemin-dark text-slate-950 rounded-xl shadow-baemin baemin-hover-pop transition-all flex items-center gap-1.5 uppercase tracking-wider"
              >
                {saving ? 'Đang lưu...' : 'Lưu Cấu Hình Agent'}
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
