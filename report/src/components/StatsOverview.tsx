import React from 'react';
import { FileText, Calendar, CheckCircle2, Bot, Clock } from 'lucide-react';
import { ReportItem } from '../types';

interface StatsOverviewProps {
  reports: ReportItem[];
  onSelectCategory: (category: string) => void;
  onSelectStatus: (status: string) => void;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({
  reports,
  onSelectCategory,
  onSelectStatus
}) => {
  const total = reports.length;
  
  const todayStr = new Date().toISOString().split('T')[0];
  const dueToday = reports.filter(r => r.date === todayStr && r.status !== 'Sent');
  
  const sentCount = reports.filter(r => r.status === 'Sent').length;
  const agentActiveCount = reports.filter(r => r.agentEnabled).length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
      
      {/* Total Reports */}
      <div 
        onClick={() => onSelectStatus('ALL')}
        className="cursor-pointer bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-baemin/60 rounded-2xl p-4 flex items-center justify-between shadow-sm transition-all baemin-hover-pop"
      >
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">TỔNG SỐ BÁO CÁO</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">{total}</p>
          <p className="text-[11px] text-slate-500 mt-1">Đã lưu trong IndexedDB</p>
        </div>
        <div className="w-11 h-11 rounded-xl bg-baemin-light text-baemin flex items-center justify-center border border-baemin/30">
          <FileText className="w-5 h-5 stroke-[2.5]" />
        </div>
      </div>

      {/* Due Today */}
      <div 
        onClick={() => onSelectStatus('To-do')}
        className="cursor-pointer bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 rounded-2xl p-4 flex items-center justify-between shadow-sm transition-all hover:-translate-y-0.5"
      >
        <div>
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">CẦN XỬ LÝ HÔM NAY</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-300">{dueToday.length}</p>
          <p className="text-[11px] text-slate-500 mt-1">Hạn báo cáo ngày {todayStr.split('-').reverse().join('/')}</p>
        </div>
        <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
          <Clock className="w-5 h-5" />
        </div>
      </div>

      {/* Active Agents */}
      <div 
        onClick={() => onSelectStatus('ALL')}
        className="cursor-pointer bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 rounded-2xl p-4 flex items-center justify-between shadow-sm transition-all hover:-translate-y-0.5"
      >
        <div>
          <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wider mb-1">AUTOMATION AGENTS</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-purple-700 dark:text-purple-300">{agentActiveCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">Báo cáo bật tự động gửi</p>
        </div>
        <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-700 dark:text-purple-400 flex items-center justify-center border border-purple-500/20">
          <Bot className="w-5 h-5" />
        </div>
      </div>

      {/* Sent / Done Reports */}
      <div 
        onClick={() => onSelectStatus('Sent')}
        className="cursor-pointer bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 rounded-2xl p-4 flex items-center justify-between shadow-sm transition-all hover:-translate-y-0.5"
      >
        <div>
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1">ĐÃ GỬI THÀNH CÔNG</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-700 dark:text-emerald-300">{sentCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">Trạng thái "Sent"</p>
        </div>
        <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
          <CheckCircle2 className="w-5 h-5" />
        </div>
      </div>

    </div>
  );
};
