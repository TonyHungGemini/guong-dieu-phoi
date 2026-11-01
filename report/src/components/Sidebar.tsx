import React, { useState } from 'react';
import { 
  FileText, 
  Sparkles, 
  Download, 
  Upload, 
  Plus, 
  Moon, 
  Sun, 
  Laptop, 
  Bot, 
  History, 
  Calendar, 
  WifiOff,
  Menu,
  X,
  LayoutGrid,
  FolderKanban,
  BarChart3
} from 'lucide-react';

interface SidebarProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenAddModal: () => void;
  onOpenAiModal: () => void;
  onOpenAgentModal: () => void;
  onOpenTemplateModal: () => void;
  onOpenAuditLogs: () => void;
  onExportData: () => void;
  onImportData: (file: File) => void;
  pwaInstallPrompt: any;
  onInstallPwa: () => void;
  isOnline: boolean;
  activeView: 'dashboard' | 'grid' | 'calendar' | 'agent' | 'refdocs';
  setActiveView: (view: 'dashboard' | 'grid' | 'calendar' | 'agent' | 'refdocs') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  theme,
  onToggleTheme,
  onOpenAddModal,
  onOpenAiModal,
  onOpenAgentModal,
  onOpenTemplateModal,
  onOpenAuditLogs,
  onExportData,
  onImportData,
  pwaInstallPrompt,
  onInstallPwa,
  isOnline,
  activeView,
  setActiveView
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportData(file);
      e.target.value = '';
    }
  };

  const navItems = [
    {
      id: 'dashboard' as const,
      label: 'Thống Kê Dashboard 🐝',
      icon: BarChart3,
    },
    {
      id: 'grid' as const,
      label: 'Danh Sách Báo Cáo',
      icon: LayoutGrid,
    },
    {
      id: 'calendar' as const,
      label: 'Lịch Báo Cáo',
      icon: Calendar,
    },
    {
      id: 'refdocs' as const,
      label: 'Kho Tài Liệu Liên Quan',
      icon: FolderKanban,
    },
    {
      id: 'agent' as const,
      label: 'Automation Agent',
      icon: Bot,
      onClick: onOpenAgentModal,
    }
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between p-4 sm:p-5">
      {/* TOP BRANDING & LOGO */}
      <div>
        <div className="flex items-center gap-3 pb-5 mb-5 border-b border-slate-200 dark:border-slate-800">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20 shrink-0 animate-baemin-bounce p-1 relative overflow-hidden">
            {/* CUTE BEE REPORT LOGO SVG */}
            <svg viewBox="0 0 512 512" className="w-full h-full drop-shadow-sm">
              <ellipse cx="205" cy="165" rx="55" ry="90" fill="#ffffff" fillOpacity="0.85" transform="rotate(-30 205 165)"/>
              <ellipse cx="307" cy="165" rx="55" ry="90" fill="#ffffff" fillOpacity="0.85" transform="rotate(30 307 165)"/>
              <ellipse cx="256" cy="275" rx="120" ry="100" fill="#fbbf24"/>
              <path d="M175 240 Q256 220 337 240 Q335 275 337 310 Q256 290 175 310 Z" fill="#1e1b4b"/>
              <path d="M195 340 Q256 325 317 340 Q310 355 290 368 Q256 375 222 368 Z" fill="#1e1b4b"/>
              <circle cx="256" cy="185" r="70" fill="#fbbf24"/>
              <path d="M225 125 Q205 75 175 85" stroke="#1e1b4b" strokeWidth="14" strokeLinecap="round" fill="none"/>
              <circle cx="170" cy="85" r="14" fill="#1e1b4b"/>
              <path d="M287 125 Q307 75 337 85" stroke="#1e1b4b" strokeWidth="14" strokeLinecap="round" fill="none"/>
              <circle cx="342" cy="85" r="14" fill="#1e1b4b"/>
              <circle cx="225" cy="175" r="14" fill="#1e1b4b"/>
              <circle cx="229" cy="170" r="5" fill="#ffffff"/>
              <circle cx="287" cy="175" r="14" fill="#1e1b4b"/>
              <circle cx="291" cy="170" r="5" fill="#ffffff"/>
              <path d="M240 200 Q256 215 272 200" stroke="#1e1b4b" strokeWidth="9" strokeLinecap="round" fill="none"/>
              <circle cx="205" cy="192" r="10" fill="#f43f5e" fillOpacity="0.5"/>
              <circle cx="307" cy="192" r="10" fill="#f43f5e" fillOpacity="0.5"/>
              {/* Mini Clipboard */}
              <rect x="290" y="260" width="85" height="110" rx="12" fill="#ffffff" stroke="#1e1b4b" strokeWidth="10" transform="rotate(12 290 260)"/>
              <path d="M310 285 L355 293 M310 305 L350 312 M310 325 L340 330" stroke="#10b981" strokeWidth="9" strokeLinecap="round" transform="rotate(12 290 260)"/>
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1.5">
              <h1 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-slate-100 truncate leading-snug">
                Bee Report 🐝
              </h1>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 font-sans tracking-wide truncate mt-0.5">
              Design by <strong className="text-teal-600 dark:text-baemin font-bold">Tony Hung</strong>
            </p>
          </div>
        </div>

        {/* PRIMARY ADD BUTTON */}
        <button
          onClick={() => {
            onOpenAddModal();
            setMobileOpen(false);
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-black bg-baemin hover:bg-baemin-dark text-slate-950 rounded-xl shadow-sm baemin-hover-pop transition-all mb-6 uppercase tracking-wider"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Thêm Báo Cáo Mới</span>
        </button>

        {/* NAVIGATION LINKS */}
        <div className="space-y-1 mb-6">
          <p className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
            Menu Navigation
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.onClick) {
                    item.onClick();
                  } else {
                    setActiveView(item.id);
                  }
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all baemin-hover-pop ${
                  isActive
                    ? 'bg-baemin text-slate-950 shadow-sm font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950 stroke-[2.5]' : 'text-slate-400 dark:text-slate-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* TOOLBOX & QUICK ACTIONS */}
        <div className="space-y-1 mb-6">
          <p className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
            Công Cụ Trợ Lý
          </p>
          
          <button
            onClick={() => {
              onOpenAiModal();
              setMobileOpen(false);
            }}
            className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-xl transition-all border border-purple-200 dark:border-purple-500/20"
          >
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 animate-spin-slow" />
              <span>AI Copilot (Gemini)</span>
            </div>
            <span className="text-[10px] font-bold uppercase bg-purple-500/20 px-1.5 py-0.5 rounded text-purple-700 dark:text-purple-300">New</span>
          </button>

          <button
            onClick={() => {
              onOpenTemplateModal();
              setMobileOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-xl transition-all"
          >
            <FileText className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            <span>Mẫu Báo Cáo Sẵn Có</span>
          </button>

          <button
            onClick={() => {
              onOpenAuditLogs();
              setMobileOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-xl transition-all"
          >
            <History className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            <span>Nhật Ký Hoạt Động</span>
          </button>

          {pwaInstallPrompt && (
            <button
              onClick={() => {
                onInstallPwa();
                setMobileOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 rounded-xl border border-teal-500/30 transition-all animate-pulse"
            >
              <Laptop className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>Cài Đặt App PWA</span>
            </button>
          )}
        </div>
      </div>

      {/* FOOTER ACTIONS & SETTINGS */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Giao diện Sáng/Tối</span>
          <button
            onClick={onToggleTheme}
            className="p-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 transition-all"
            title="Đổi Giao diện"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={onExportData}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 transition-all"
            title="Xuất Backup JSON"
          >
            <Download className="w-3.5 h-3.5" /> Xuất Data
          </button>
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 transition-all"
            title="Nhập Data JSON"
          >
            <Upload className="w-3.5 h-3.5" /> Nhập Data
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
          />
        </div>

        <div className="pt-2 text-center text-[10px] text-slate-400 dark:text-slate-500">
          Quản lý Báo cáo thông minh &bull; v2.0
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* DESKTOP VERTICAL SIDEBAR */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/80 shrink-0 h-screen sticky top-0 z-30 transition-all">
        {sidebarContent}
      </aside>

      {/* MOBILE TOP BAR WITH HAMBURGER */}
      <div className="md:hidden sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-baemin flex items-center justify-center text-slate-950 shadow-sm font-bold">
            <FileText className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">Quản lý Báo cáo thông minh</h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Design by <span className="text-baemin font-bold">Tony Hung</span></p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAddModal}
            className="p-2 bg-baemin text-slate-950 rounded-lg text-xs font-bold shadow-sm baemin-hover-pop"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-800"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* MOBILE DRAWER OVERLAY */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-slate-950/80 backdrop-blur-sm flex">
          <div className="w-72 bg-white dark:bg-slate-900 h-full border-r border-slate-200 dark:border-slate-800 overflow-y-auto">
            {sidebarContent}
          </div>
          <div className="flex-1" onClick={() => setMobileOpen(false)}></div>
        </div>
      )}
    </>
  );
};
