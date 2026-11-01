import React from 'react';
import { MessageCircle, Download, Copy, ExternalLink, X, CheckCircle2, ArrowRight } from 'lucide-react';
import { ReportItem } from '../types';
import { ZaloWorkflowResult } from '../lib/submitWorkflow';

interface ZaloGuidanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ReportItem | null;
  result: ZaloWorkflowResult | null;
}

export const ZaloGuidanceModal: React.FC<ZaloGuidanceModalProps> = ({
  isOpen,
  onClose,
  report,
  result
}) => {
  if (!isOpen || !report || !result) return null;

  const displayPhone = '0' + result.zaloPhoneSanitized.replace(/^84/, '');

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-sky-500/40 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-sky-50 dark:bg-gradient-to-r dark:from-sky-950/60 dark:to-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500 text-slate-950 flex items-center justify-center font-black shadow-md">
              <MessageCircle className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Quy Trình Gửi Zalo Duyệt 1-Click
                <span className="text-[10px] font-bold bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-full">
                  Thành Công
                </span>
              </h3>
              <p className="text-xs text-sky-700 dark:text-sky-300">
                Đã xử lý tự động 3 bước cho báo cáo: <strong className="text-slate-900 dark:text-slate-100">{report.title}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workflow Summary Steps */}
        <div className="p-5 space-y-4">
          
          <div className="space-y-2.5">
            {/* Step 1 */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-start gap-3">
              <div className="p-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0 mt-0.5">
                <Download className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200">1. Đã tự động tải file chuẩn về máy:</span>
                <p className="font-mono text-emerald-700 dark:text-emerald-400 font-bold mt-0.5">{result.filename}</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-start gap-3">
              <div className="p-1.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg shrink-0 mt-0.5">
                <Copy className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200">2. Đã sao chép lời nhắn vào Bộ nhớ tạm (Clipboard):</span>
                <p className="text-slate-700 dark:text-slate-300 italic mt-0.5 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 font-sans">
                  "Dạ anh/chị duyệt giúp em báo cáo {report.title} nhé!"
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-start gap-3">
              <div className="p-1.5 bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-lg shrink-0 mt-0.5">
                <MessageCircle className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200">3. Đang mở cuộc trò chuyện Zalo với Người Duyệt:</span>
                <p className="font-mono text-sky-700 dark:text-sky-300 font-bold mt-0.5">SĐT Zalo: {displayPhone}</p>
              </div>
            </div>
          </div>

          {/* User Instructions Box */}
          <div className="p-4 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-500/30 rounded-2xl text-xs space-y-2">
            <h4 className="font-extrabold text-sky-800 dark:text-sky-300 flex items-center gap-1.5 text-xs uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4 text-sky-600 dark:text-sky-400" /> Hướng Dẫn Hoàn Tất Trực Tiếp Trong Zalo:
            </h4>
            <ol className="list-decimal list-inside text-slate-700 dark:text-slate-300 space-y-1.5 leading-relaxed pl-1">
              <li>Nếu trình duyệt hỏi <span className="text-sky-700 dark:text-sky-300 font-bold">"Cho phép mở Zalo?"</span>, nhấn <span className="text-emerald-700 dark:text-emerald-400 font-bold">Cho Phép (Allow)</span>.</li>
              <li>Tại ô chat Zalo vừa mở ra: Bấm <kbd className="bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-200 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 font-mono font-bold">Ctrl + V</kbd> (hoặc <kbd className="bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-200 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 font-mono font-bold">Cmd + V</kbd>) để Dán câu xin duyệt.</li>
              <li>Kéo thả file vừa tải (<strong className="text-emerald-700 dark:text-emerald-400">{result.filename}</strong>) từ thư mục Downloads vào khung chat và nhấn <strong className="text-sky-700 dark:text-sky-300">Gửi</strong>!</li>
            </ol>
          </div>

          <div className="pt-2 flex items-center justify-between gap-3">
            <a
              href={`https://zalo.me/${result.zaloPhoneSanitized}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Mở Zalo Web (Mạng)
            </a>

            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all uppercase tracking-wider flex items-center gap-1.5 active:scale-95"
            >
              <span>Đã Hiểu & Xong</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
