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
  CheckCircle2, 
  Wifi, 
  WifiOff,
  LogOut,
  User,
  CloudUpload,
  RefreshCw,
  Key,
  Users
} from 'lucide-react';
import { GoogleUserProfile } from '../types';

interface NavbarProps {
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
  userProfile?: GoogleUserProfile | null;
  onLoginGoogle?: () => void;
  onLogoutGoogle?: () => void;
  onSwitchGoogleAccount?: () => void;
  onSyncDrivePending?: () => void;
  pendingSyncCount?: number;
  onOpenConfigClientId?: () => void;
  syncStatus?: 'idle' | 'syncing' | 'synced' | 'error';
  onTriggerSyncCloud?: () => void;
  onVerifyLocalVault?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
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
  setActiveView,
  userProfile,
  onLoginGoogle,
  onLogoutGoogle,
  onSwitchGoogleAccount,
  onSyncDrivePending,
  pendingSyncCount = 0,
  onOpenConfigClientId,
  syncStatus = 'idle',
  onTriggerSyncCloud,
  onVerifyLocalVault,
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const getViewTitle = () => {
    switch (activeView) {
      case 'dashboard':
        return { title: 'Thống Kê Dashboard 🐝', icon: '📊' };
      case 'calendar':
        return { title: 'Lịch Báo Cáo', icon: '📅' };
      case 'agent':
        return { title: 'Automation Agent', icon: '🤖' };
      case 'refdocs':
        return { title: 'Kho Tài Liệu Tham Khảo', icon: '📚' };
      default:
        return { title: 'Danh Sách Báo Cáo', icon: '📄' };
    }
  };

  const currentView = getViewTitle();

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-3">
          
          {/* Active View Title & Status */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-base">{currentView.icon}</span>
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">
              {currentView.title}
            </h2>
            <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
              Cloud-First GIS &bull;
              {isOnline ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Online
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 text-[11px]">
                  <WifiOff className="w-3 h-3" /> Offline Mode
                </span>
              )}
            </span>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2 shrink-0">
            
            {/* Sync Drive Pending Button */}
            {pendingSyncCount > 0 && onSyncDrivePending && (
              <button
                onClick={onSyncDrivePending}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 border border-amber-500/40 rounded-lg transition-all animate-pulse"
                title={`Có ${pendingSyncCount} file chờ đồng bộ Google Drive. Bấm để đồng bộ ngay.`}
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden sm:inline">Sync Drive ({pendingSyncCount})</span>
              </button>
            )}

            {/* CLOUD SYNC STATUS BADGE */}
            <button
              onClick={onTriggerSyncCloud}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-xl border transition-all ${
                syncStatus === 'syncing'
                  ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30'
                  : syncStatus === 'synced'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : syncStatus === 'error'
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              title="Đồng bộ dữ liệu báo cáo (Bấm để đồng bộ ngay lập tức)"
            >
              {syncStatus === 'syncing' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-500" />
                  <span className="hidden sm:inline text-[11px]">Đang đồng bộ...</span>
                </>
              ) : syncStatus === 'synced' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="hidden sm:inline text-[11px]">Đã đồng bộ</span>
                </>
              ) : syncStatus === 'error' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-rose-500" />
                  <span className="hidden sm:inline text-[11px]">Đồng bộ ngay</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[11px]">Đồng bộ</span>
                </>
              )}
            </button>

            {/* GOOGLE SIGN IN / PROFILE BUTTON */}
            {userProfile ? (
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl transition-all"
                >
                  <img
                    src={userProfile.picture}
                    alt={userProfile.name}
                    className="w-6 h-6 rounded-full object-cover border border-indigo-500"
                  />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 max-w-[100px] truncate hidden sm:inline">
                    {userProfile.name}
                  </span>
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-3 z-50 text-xs">
                    <div className="flex items-center gap-2.5 pb-2.5 mb-2 border-b border-slate-200 dark:border-slate-800">
                      <img
                        src={userProfile.picture}
                        alt={userProfile.name}
                        className="w-9 h-9 rounded-full object-cover border border-indigo-500"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{userProfile.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{userProfile.email}</p>
                      </div>
                    </div>

                    {onVerifyLocalVault && (
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          onVerifyLocalVault();
                        }}
                        className="w-full text-left px-2.5 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-lg flex items-center gap-2 mb-1 font-semibold"
                      >
                        <FileText className="w-4 h-4 text-emerald-500" />
                        <span>Kiểm tra Kho File Local</span>
                      </button>
                    )}

                    {onSwitchGoogleAccount && (
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          onSwitchGoogleAccount();
                        }}
                        className="w-full text-left px-2.5 py-2 hover:bg-sky-50 dark:hover:bg-sky-950/40 text-sky-700 dark:text-sky-300 rounded-lg flex items-center gap-2 mb-1 font-semibold"
                      >
                        <Users className="w-4 h-4 text-sky-500" />
                        <span>Đổi tài khoản Gmail khác</span>
                      </button>
                    )}

                    {onOpenConfigClientId && (
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          onOpenConfigClientId();
                        }}
                        className="w-full text-left px-2.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-1"
                      >
                        <Key className="w-4 h-4 text-indigo-500" />
                        <span>Cấu hình Client ID</span>
                      </button>
                    )}

                    {onLogoutGoogle && (
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          onLogoutGoogle();
                        }}
                        className="w-full text-left px-2.5 py-2 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg flex items-center gap-2 font-bold"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Đăng xuất Google</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={onLoginGoogle}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl shadow-sm transition-all active:scale-95"
                title="Đăng nhập Google với scope drive.file"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Google Sign-In</span>
              </button>
            )}

            {/* PWA Install Button */}
            {pwaInstallPrompt && (
              <button
                onClick={onInstallPwa}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-lg shadow-md transition-all animate-pulse"
                title="Cài đặt DocuReport AI thành ứng dụng PWA trên máy"
              >
                <Laptop className="w-3.5 h-3.5" /> <span className="hidden md:inline">Cài App PWA</span>
              </button>
            )}

            {/* Dark/Light Toggle */}
            <button
              onClick={onToggleTheme}
              className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 transition-all"
              title="Đổi giao diện Sáng / Tối"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

          </div>
        </div>
      </div>
    </header>
  );
};
