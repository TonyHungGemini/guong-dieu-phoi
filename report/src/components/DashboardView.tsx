import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Send, 
  FileText, 
  TrendingUp, 
  Crown, 
  Award, 
  Sparkles, 
  Calendar, 
  CheckSquare,
  BarChart3,
  PieChart,
  RefreshCw,
  Zap
} from 'lucide-react';
import { ReportItem } from '../types';

interface DashboardViewProps {
  reports: ReportItem[];
  onOpenAddModal: () => void;
  onFilterStatus: (status: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  reports,
  onOpenAddModal,
  onFilterStatus
}) => {
  const total = reports.length;
  const doneCount = reports.filter(r => r.status === 'Done').length;
  const sentCount = reports.filter(r => r.status === 'Sent').length;
  const inProgressCount = reports.filter(r => r.status === 'In Progress' || r.status === 'Pending Review').length;
  const todoCount = reports.filter(r => r.status === 'To-do').length;

  const totalCompleted = doneCount + sentCount;
  const pendingCount = inProgressCount + todoCount;
  const completionRate = total > 0 ? Math.round((totalCompleted / total) * 100) : 100;

  // Category Breakdown
  const dailyCount = reports.filter(r => r.category === 'Báo cáo ngày').length;
  const weeklyCount = reports.filter(r => r.category === 'Báo cáo tuần').length;
  const monthlyCount = reports.filter(r => r.category === 'Báo cáo tháng').length;
  const otherCount = reports.filter(r => r.category === 'Tài liệu khác').length;

  // AI Summary Count & Google Drive Synchronized Count
  const aiSummarizedCount = reports.filter(r => r.aiSummary && r.aiSummary.length > 0).length;
  const driveSyncedCount = reports.filter(r => r.driveFileId && r.driveFileId.length > 0).length;

  // Calculate SVG Donut chart angles
  // Circle circumference = 2 * PI * 70 ≈ 439.8
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  
  const doneStroke = total > 0 ? (doneCount / total) * circumference : 0;
  const sentStroke = total > 0 ? (sentCount / total) * circumference : 0;
  const inProgressStroke = total > 0 ? (inProgressCount / total) * circumference : 0;
  const todoStroke = total > 0 ? (todoCount / total) * circumference : 0;

  // Offsets
  const doneOffset = 0;
  const sentOffset = -doneStroke;
  const inProgressOffset = -(doneStroke + sentStroke);
  const todoOffset = -(doneStroke + sentStroke + inProgressStroke);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      
      {/* Top Welcome & Bee Productivity Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-indigo-700/50">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-extrabold border border-amber-500/30">
              <Crown className="w-3.5 h-3.5 text-amber-400" /> Ong Chăm Chỉ Level: {completionRate === 100 ? 'Ong Vàng Hero 👑' : 'Ong Vàng Siêng Năng 🐝'}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Bảng Thống Kê & Tiến Độ Công Việc
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              Hệ thống tự động theo dõi, tính toán tiến độ nộp báo cáo ngày/tuần và kết nối Google Drive & Trợ lý Chú Ong Chăm Chỉ.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onOpenAddModal}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-emerald-500/30 transition-all flex items-center gap-2 active:scale-95"
            >
              <Zap className="w-4 h-4 fill-current" /> Thêm Báo Cáo Mới
            </button>
          </div>
        </div>
      </div>

      {/* Overview Stat Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Reports */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tổng Báo Cáo</p>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">{total}</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Tất cả mục lưu trữ</p>
          </div>
        </div>

        {/* Completed & Sent */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Đã Hoàn Thành</p>
            <h3 className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">{totalCompleted}</h3>
            <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 font-bold mt-0.5">{doneCount} Done, {sentCount} Sent</p>
          </div>
        </div>

        {/* Pending & Remaining */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Đang Thực Hiện</p>
            <h3 className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">{pendingCount}</h3>
            <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 font-bold mt-0.5">{todoCount} To-do, {inProgressCount} In Progress</p>
          </div>
        </div>

        {/* On-Time Completion Rate */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tỷ Lệ Đúng Hạn</p>
            <h3 className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400">{completionRate}%</h3>
            <p className="text-[11px] text-purple-600/80 dark:text-purple-400/80 font-bold mt-0.5">Mục tiêu 100% đúng hạn</p>
          </div>
        </div>

      </div>

      {/* Main Charts Row: SVG Donut Chart + Category Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* DONUT CHART: Report Status Distribution */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-indigo-500" />
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                Phân Phối Trạng Thái Báo Cáo
              </h3>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300">
              {total} Tổng số
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-4">
            
            {/* SVG DONUT GRAPH */}
            <div className="relative w-48 h-48 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 180 180">
                {/* Background Ring */}
                <circle
                  cx="90"
                  cy="90"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="20"
                  className="text-slate-100 dark:text-slate-800"
                />

                {/* Done Segment */}
                {doneStroke > 0 && (
                  <circle
                    cx="90"
                    cy="90"
                    r={radius}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="20"
                    strokeDasharray={`${doneStroke} ${circumference}`}
                    strokeDashoffset={doneOffset}
                    className="transition-all duration-700 ease-out"
                  />
                )}

                {/* Sent Segment */}
                {sentStroke > 0 && (
                  <circle
                    cx="90"
                    cy="90"
                    r={radius}
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="20"
                    strokeDasharray={`${sentStroke} ${circumference}`}
                    strokeDashoffset={sentOffset}
                    className="transition-all duration-700 ease-out"
                  />
                )}

                {/* In Progress Segment */}
                {inProgressStroke > 0 && (
                  <circle
                    cx="90"
                    cy="90"
                    r={radius}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="20"
                    strokeDasharray={`${inProgressStroke} ${circumference}`}
                    strokeDashoffset={inProgressOffset}
                    className="transition-all duration-700 ease-out"
                  />
                )}

                {/* To-do Segment */}
                {todoStroke > 0 && (
                  <circle
                    cx="90"
                    cy="90"
                    r={radius}
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="20"
                    strokeDasharray={`${todoStroke} ${circumference}`}
                    strokeDashoffset={todoOffset}
                    className="transition-all duration-700 ease-out"
                  />
                )}
              </svg>

              {/* Center Metrics Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{completionRate}%</span>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Hoàn thành</span>
              </div>
            </div>

            {/* Donut Legend */}
            <div className="space-y-3 w-full sm:w-auto">
              <button
                onClick={() => onFilterStatus('Done')}
                className="w-full flex items-center justify-between gap-4 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Done (Đã làm)</span>
                </div>
                <span className="text-xs font-black text-slate-900 dark:text-slate-100">{doneCount}</span>
              </button>

              <button
                onClick={() => onFilterStatus('Sent')}
                className="w-full flex items-center justify-between gap-4 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Sent (Đã gửi)</span>
                </div>
                <span className="text-xs font-black text-slate-900 dark:text-slate-100">{sentCount}</span>
              </button>

              <button
                onClick={() => onFilterStatus('In Progress')}
                className="w-full flex items-center justify-between gap-4 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">In Progress</span>
                </div>
                <span className="text-xs font-black text-slate-900 dark:text-slate-100">{inProgressCount}</span>
              </button>

              <button
                onClick={() => onFilterStatus('To-do')}
                className="w-full flex items-center justify-between gap-4 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">To-do (Chưa làm)</span>
                </div>
                <span className="text-xs font-black text-slate-900 dark:text-slate-100">{todoCount}</span>
              </button>
            </div>

          </div>
        </div>

        {/* BAR CHART: Category Breakdown */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-500" />
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                Báo Cáo Theo Loai Danh Mục
              </h3>
            </div>
          </div>

          <div className="space-y-4 my-auto py-2">
            
            {/* Daily Reports Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-700 dark:text-slate-300">Báo cáo ngày</span>
                <span className="text-slate-900 dark:text-slate-100">{dailyCount} mục</span>
              </div>
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                  style={{ width: `${total > 0 ? (dailyCount / total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            {/* Weekly Reports Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-700 dark:text-slate-300">Báo cáo tuần</span>
                <span className="text-slate-900 dark:text-slate-100">{weeklyCount} mục</span>
              </div>
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                  style={{ width: `${total > 0 ? (weeklyCount / total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            {/* Monthly Reports Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-700 dark:text-slate-300">Báo cáo tháng</span>
                <span className="text-slate-900 dark:text-slate-100">{monthlyCount} mục</span>
              </div>
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${total > 0 ? (monthlyCount / total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            {/* Other Documents Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-700 dark:text-slate-300">Tài liệu khác</span>
                <span className="text-slate-900 dark:text-slate-100">{otherCount} mục</span>
              </div>
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-slate-400 to-slate-600 rounded-full transition-all duration-500"
                  style={{ width: `${total > 0 ? (otherCount / total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>AI Tóm tắt tự động: <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{aiSummarizedCount}</strong></span>
            <span>Google Drive Đồng bộ: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{driveSyncedCount}</strong></span>
          </div>

        </div>

      </div>

    </div>
  );
};
