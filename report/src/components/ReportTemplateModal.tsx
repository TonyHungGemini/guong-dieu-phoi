import React, { useState } from 'react';
import { X, FileCode, Check, Copy, Sparkles, Plus } from 'lucide-react';
import { BUILTIN_TEMPLATES } from '../lib/sampleData';
import { ReportTemplate, ReportCategory } from '../types';

interface ReportTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUseTemplate: (template: ReportTemplate) => void;
}

export const ReportTemplateModal: React.FC<ReportTemplateModalProps> = ({
  isOpen,
  onClose,
  onUseTemplate
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  if (!isOpen) return null;

  const filteredTemplates = BUILTIN_TEMPLATES.filter(
    t => selectedCategory === 'ALL' || t.category === selectedCategory
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-baemin text-slate-950 flex items-center justify-center shadow-sm font-extrabold animate-baemin-bounce">
              <FileCode className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                Thư Viện Mẫu Báo Cáo Chuẩn Cấu Trúc
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Chọn mẫu có sẵn để tạo nhanh báo cáo hàng ngày, tuần hoặc tháng
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          
          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {['ALL', 'Báo cáo ngày', 'Báo cáo tuần', 'Báo cáo tháng'].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-all border ${
                  selectedCategory === cat
                    ? 'bg-baemin text-slate-950 font-extrabold border-baemin shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {cat === 'ALL' ? 'Tất cả mẫu' : cat}
              </button>
            ))}
          </div>

          {/* List of Templates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3 hover:border-baemin/50 transition-all group shadow-sm"
              >
                <div>
                  <span className="inline-block px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-baemin-light text-baemin border border-baemin/30 mb-2">
                    {template.category}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-baemin transition-colors">
                    {template.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {template.description}
                  </p>

                  <div className="mt-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300 max-h-28 overflow-hidden whitespace-pre-wrap leading-relaxed">
                    {template.sampleContent}
                  </div>
                </div>

                <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                    {template.suggestedFilenameConvention}
                  </span>
                  <button
                    onClick={() => {
                      onUseTemplate(template);
                      onClose();
                    }}
                    className="px-3 py-1.5 text-xs font-black bg-baemin hover:bg-baemin-dark text-slate-950 rounded-lg transition-all flex items-center gap-1 shadow-sm baemin-hover-pop shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> Dùng Mẫu này
                  </button>
                </div>

              </div>
            ))}
          </div>

        </div>

      </div>
    </div>
  );
};
