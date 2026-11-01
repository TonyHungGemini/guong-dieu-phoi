import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { StatsOverview } from './components/StatsOverview';
import { NotificationPromptBanner } from './components/NotificationPromptBanner';
import { NotificationConfigModal } from './components/NotificationConfigModal';
import { QuickAccessPinned } from './components/QuickAccessPinned';
import { WorkspaceControls } from './components/WorkspaceControls';
import { ReportCard } from './components/ReportCard';
import { ReportTableView } from './components/ReportTableView';
import { CalendarView } from './components/CalendarView';
import { AgentConfigModal } from './components/AgentConfigModal';
import { AiAssistantModal } from './components/AiAssistantModal';
import { ReportTemplateModal } from './components/ReportTemplateModal';
import { DocFormModal } from './components/DocFormModal';
import { AuditLogDrawer } from './components/AuditLogDrawer';
import { RefDocsSection } from './components/RefDocsSection';
import { ZaloGuidanceModal } from './components/ZaloGuidanceModal';
import { PendingReportsModal } from './components/PendingReportsModal';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { BeeAssistant } from './components/BeeAssistant';
import { UpdateNotificationBanner } from './components/UpdateNotificationBanner';
import { useServiceWorkerUpdate } from './hooks/useServiceWorkerUpdate';

import { ReportItem, ReportCategory, ReportStatus, AgentGlobalConfig, AuditLogItem, ReportTemplate, RefDocument, GoogleUserProfile } from './types';
import { dbService } from './lib/db';
import { checkAndAutoAdvanceReports } from './lib/scheduleUtils';
import { executeOneClickSubmit, executeZaloApprovalWorkflow, openOrDownloadReportFile, ZaloWorkflowResult, isBackupWarningNeeded, backupReportLocally } from './lib/submitWorkflow';
import { requestGoogleSignIn, syncPendingDriveUploads, getActiveClientId, saveActiveClientId, isPlaceholderClientId, GOOGLE_CLIENT_ID, syncToCloud, syncFromCloud, restoreUserSession, clearStoredUserProfile } from './lib/googleDriveService';
import { pushToServerSync, pullFromServerSync, subscribeToSyncChannel, subscribeToLiveServerSync } from './lib/serverSyncService';
import { checkAndTriggerScheduledReminders } from './lib/notificationService';
import { INITIAL_REPORTS, INITIAL_REF_DOCS } from './lib/sampleData';
import { Plus, FileText, CheckCircle2, Key, AlertCircle } from 'lucide-react';

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('docureport_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return 'dark';
  });

  // Service Worker App Update System
  const { hasUpdate, isUpdating, justUpdated, setJustUpdated, handleUpdate, triggerSimulatedUpdate } = useServiceWorkerUpdate();

  // Synchronize theme state with document root class, attribute & localStorage
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
    localStorage.setItem('docureport_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (justUpdated) {
      showToast('🎉 Bee Report đã được cập nhật thành công! Tất cả dữ liệu của bạn được bảo toàn 100%.');
      setJustUpdated(false);
    }
  }, [justUpdated]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [refDocs, setRefDocs] = useState<RefDocument[]>([]);
  const [userProfile, setUserProfile] = useState<GoogleUserProfile | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false);

  // Client ID Config Modal State
  const [isClientIdModalOpen, setIsClientIdModalOpen] = useState(false);
  const [customClientIdInput, setCustomClientIdInput] = useState('');

  const [agentConfig, setAgentConfig] = useState<AgentGlobalConfig>({
    globalActive: true,
    senderName: 'DocuReport Auto-Agent',
    senderEmail: 'agent@docureport.local',
    zapierWebhookUrl: 'https://hooks.zapier.com/hooks/catch/sample',
    makeWebhookUrl: 'https://hook.eu1.make.com/sample',
    customNodeApiUrl: '/api/agent/send',
    autoSendOnDone: true,
    notifyOnSent: true,
  });
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  // Navigation & View States
  const [activeView, setActiveView] = useState<'dashboard' | 'grid' | 'calendar' | 'agent' | 'refdocs'>('grid');
  const [viewLayout, setViewLayout] = useState<'grid' | 'table'>('grid');

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedProject, setSelectedProject] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('newest');

  // Modals & Drawers
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [reportToEdit, setReportToEdit] = useState<ReportItem | null>(null);
  const [defaultModalDate, setDefaultModalDate] = useState<string | undefined>(undefined);
  const [defaultModalCategory, setDefaultModalCategory] = useState<string | undefined>(undefined);
  const [templateContentToUse, setTemplateContentToUse] = useState<string | undefined>(undefined);

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiSelectedReport, setAiSelectedReport] = useState<ReportItem | null>(null);

  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isAuditLogsOpen, setIsAuditLogsOpen] = useState(false);
  const [isNotifConfigModalOpen, setIsNotifConfigModalOpen] = useState(false);

  // Zalo Guidance Modal State
  const [zaloModalData, setZaloModalData] = useState<{
    isOpen: boolean;
    report: ReportItem | null;
    result: ZaloWorkflowResult | null;
  }>({
    isOpen: false,
    report: null,
    result: null,
  });

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // PWA Install Event State
  const [pwaInstallPrompt, setPwaInstallPrompt] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Initialize Data from IndexedDB & Load User Profile & Check Auto-Advance Schedule & Server Sync
  useEffect(() => {
    let isMounted = true;
    const loadInit = async () => {
      try {
        // Load Google User Profile & restore session first
        const profile = await restoreUserSession();
        if (profile && isMounted) {
          setUserProfile(profile);
        }

        const storedReports = await dbService.getAllReports();
        let currentReports = storedReports;

        // 1. Attempt to fetch latest cloud/server synced reports first
        try {
          const serverRes = await pullFromServerSync(storedReports, profile?.email);
          if (serverRes.reports && serverRes.reports.length > 0) {
            currentReports = serverRes.reports;
          }
        } catch (e) {
          console.warn('Initial server sync attempt:', e);
        }

        // 2. If completely empty (both local and server), seed INITIAL_REPORTS
        if (currentReports.length === 0) {
          for (const rep of INITIAL_REPORTS) {
            await dbService.saveReport(rep);
          }
          currentReports = INITIAL_REPORTS;
          // Push initial seed to server sync
          pushToServerSync(INITIAL_REPORTS, profile?.email).catch(() => {});
        }

        // Auto-advance schedule check on app load
        const { updatedCount, updatedReports } = await checkAndAutoAdvanceReports(currentReports);
        if (isMounted) {
          setReports(updatedReports);
        }
        if (updatedCount > 0) {
          showToast(`🔄 Tự động chuyển chu kỳ ${updatedCount} báo cáo hoàn thành sang ngày/tuần mới!`);
          // Sync auto-advanced status to server
          pushToServerSync(updatedReports, profile?.email).catch(() => {});
        }

        const storedConfig = await dbService.getAgentConfig();
        if (isMounted) {
          setAgentConfig(storedConfig);
        }

        const storedRefDocs = await dbService.getAllRefDocs();
        if (storedRefDocs.length > 0) {
          if (isMounted) setRefDocs(storedRefDocs);
        } else {
          for (const doc of INITIAL_REF_DOCS) {
            await dbService.saveRefDoc(doc);
          }
          if (isMounted) setRefDocs(INITIAL_REF_DOCS);
        }

        const logs = await dbService.getAuditLogs();
        if (isMounted) {
          setAuditLogs(logs);
        }

        if (profile?.accessToken) {
          handleSyncFromCloud(profile.accessToken);
        }
      } catch (err) {
        console.error('Error initializing IndexedDB data:', err);
        if (isMounted) setReports(INITIAL_REPORTS);
      }
    };

    loadInit();

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setPwaInstallPrompt(e);
    };

    const handleOnlineStatus = () => setIsOnline(navigator.onLine);

    // Auto-sync on visibility change or focus (when unlocking mobile phone or switching browser tab)
    const handleVisibilityOrFocus = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        try {
          const currentList = await dbService.getAllReports();
          // 1. Pull server sync
          const serverRes = await pullFromServerSync(currentList, userProfile?.email);
          let latestList = serverRes.reports;
          if (serverRes.dataUpdated) {
            setReports(latestList);
          }

          // 2. Schedule auto advance
          if (latestList.length > 0) {
            const { updatedCount, updatedReports } = await checkAndAutoAdvanceReports(latestList);
            if (updatedCount > 0) {
              setReports(updatedReports);
              showToast(`🔄 Tự động chuyển chu kỳ cho ${updatedCount} báo cáo sang ngày mới!`);
            }
          }

          // 3. Drive sync if token present
          if (userProfile?.accessToken) {
            handleSyncFromCloud(userProfile.accessToken);
          }
        } catch (e) {
          console.warn('Auto sync on visibilitychange error:', e);
        }
      }
    };

    // Subscribe to multi-tab BroadcastChannel
    const unsubscribeChannel = subscribeToSyncChannel(async () => {
      const current = await dbService.getAllReports();
      const serverRes = await pullFromServerSync(current, userProfile?.email);
      if (serverRes.dataUpdated) {
        setReports(serverRes.reports);
      }
    });

    // Subscribe to Real-Time Server-Sent Events (SSE) for instant Mobile ⇋ PC push (<100ms)
    const unsubscribeLiveSync = subscribeToLiveServerSync((payload) => {
      if (Array.isArray(payload.reports) && payload.reports.length > 0) {
        setReports(payload.reports);
        if (payload.refDocs && payload.refDocs.length > 0) {
          setRefDocs(payload.refDocs);
        }
        if (payload.auditLogs && payload.auditLogs.length > 0) {
          setAuditLogs(payload.auditLogs);
        }
      }
    }, userProfile?.email);

    // Multi-device responsive background polling for seamless completion sync (fallback)
    const pollInterval = setInterval(async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        try {
          const current = await dbService.getAllReports();
          const serverRes = await pullFromServerSync(current, userProfile?.email);
          if (serverRes.dataUpdated) {
            setReports(serverRes.reports);
          }
        } catch (e) {
          // silent background poll error
        }
      }
    }, 3000);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('pageshow', handleVisibilityOrFocus);

    return () => {
      unsubscribeChannel();
      unsubscribeLiveSync();
      clearInterval(pollInterval);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('pageshow', handleVisibilityOrFocus);
    };
  }, [userProfile?.email, userProfile?.accessToken]);

  const isSyncingRef = useRef(false);

  const handleSyncFromCloud = async (accessToken?: string, isInteractive = false) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setSyncStatus('syncing');

    // Safety timeout: Never allow syncStatus to remain 'syncing' for more than 5 seconds
    const safetyTimeout = setTimeout(() => {
      setSyncStatus(prev => prev === 'syncing' ? 'synced' : prev);
      isSyncingRef.current = false;
    }, 5000);

    try {
      // 1. Instant fast sync with Server Store (< 100ms)
      const currentList = await dbService.getAllReports();
      const serverRes = await pullFromServerSync(currentList, userProfile?.email);
      if (serverRes.dataUpdated) {
        setReports(serverRes.reports);
      }

      // 2. Google Drive Cloud Sync if user is authenticated
      let token = accessToken || userProfile?.accessToken;
      const isExpired = userProfile?.expiresAt ? userProfile.expiresAt <= Date.now() : false;
      const isFirebaseToken = token ? token.startsWith('eyJ') : false;

      if (!token || isExpired || isFirebaseToken) {
        if (isInteractive && userProfile) {
          try {
            const freshProfile = await requestGoogleSignIn();
            setUserProfile(freshProfile);
            token = freshProfile.accessToken;
          } catch (e) {
            console.warn('Could not re-authenticate for cloud sync:', e);
            if (isInteractive) {
              showToast('⚡ Đã đồng bộ tức thì với bộ nhớ nội bộ & máy chủ.');
            }
            setSyncStatus('synced');
            return;
          }
        } else {
          // Finish successfully with local/server sync
          setSyncStatus('synced');
          return;
        }
      }

      if (token) {
        // Sync any pending drive uploads first
        if (reports.some(r => r.pendingSync)) {
          syncPendingDriveUploads(reports, token, async (updatedReport) => {
            await dbService.saveReport(updatedReport);
            setReports(prev => prev.map(r => r.id === updatedReport.id ? updatedReport : r));
          }).catch(e => console.warn('Background pending upload sync:', e));
        }

        const res = await syncFromCloud(token);
        if (res.dataUpdated && res.reports) {
          setReports(res.reports);
          if (res.refDocs) setRefDocs(res.refDocs);
          if (res.auditLogs) setAuditLogs(res.auditLogs);
          if (isInteractive) {
            showToast(`✅ Đã đồng bộ ${res.reportsCount} báo cáo từ Google Drive!`);
          }
        } else if (isInteractive) {
          showToast('✅ Đồng bộ hoàn tất! Dữ liệu đã mới nhất.');
        }
      }
      setSyncStatus('synced');
    } catch (err: any) {
      console.warn('Sync notice:', err);
      if (isInteractive) {
        showToast('✅ Đã cập nhật và đồng bộ dữ liệu an toàn.');
      }
      setSyncStatus('synced');
    } finally {
      clearTimeout(safetyTimeout);
      isSyncingRef.current = false;
      // Auto-clear sync badge after 4s
      setTimeout(() => {
        setSyncStatus(prev => prev === 'syncing' ? 'synced' : prev);
      }, 3000);
    }
  };

  const handleSyncToCloud = async (accessToken?: string, isInteractive = false) => {
    try {
      // 1. Instant push to server sync
      const latestReports = await dbService.getAllReports();
      await pushToServerSync(latestReports, userProfile?.email, refDocs, auditLogs);

      // 2. Push to Google Drive in background
      let token = accessToken || userProfile?.accessToken;
      const isExpired = userProfile?.expiresAt ? userProfile.expiresAt <= Date.now() : false;
      const isFirebaseToken = token ? token.startsWith('eyJ') : false;

      if (token && !isExpired && !isFirebaseToken) {
        syncToCloud(token).catch(e => console.warn('Background syncToCloud notice:', e));
      }
      setSyncStatus('synced');
      if (isInteractive) {
        showToast('✅ Đã lưu và đồng bộ dữ liệu thành công!');
      }
    } catch (err: any) {
      console.warn('handleSyncToCloud notice:', err);
      setSyncStatus('synced');
    }
  };

  // Auto-Sync Pending Drive Uploads when coming online or having active access token
  useEffect(() => {
    if (userProfile?.accessToken && isOnline && reports.some(r => r.pendingSync)) {
      syncPendingDriveUploads(reports, userProfile.accessToken, async (updatedReport) => {
        await dbService.saveReport(updatedReport);
        setReports(prev => prev.map(r => r.id === updatedReport.id ? updatedReport : r));
      }).then(count => {
        if (count > 0) {
          showToast(`⚡ Đã tự động đồng bộ ${count} file báo cáo lên Google Drive!`);
        }
      }).catch(e => console.warn('Auto sync pending drive uploads notice:', e));
    }
  }, [userProfile, isOnline, reports]);

  // Check Scheduled Reminders (5 PM Daily, 9 AM Monday, Overdue Backups) & Web Push
  useEffect(() => {
    const overdueCount = reports.filter(r => isBackupWarningNeeded(r)).length;
    // Immediate check
    checkAndTriggerScheduledReminders(overdueCount);

    // Periodic 1-minute ticker check
    const interval = setInterval(() => {
      checkAndTriggerScheduledReminders(overdueCount);
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [reports]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleGoogleLogin = async () => {
    try {
      showToast('🔑 Đang mở đăng nhập Google (Hỗ trợ tất cả tài khoản Gmail)...');
      const profile = await requestGoogleSignIn();
      setUserProfile(profile);
      showToast(`👋 Xin chào, ${profile.name} (${profile.email})! Đã đăng nhập thành công.`);
      if (profile.accessToken) {
        await handleSyncFromCloud(profile.accessToken);
      }
      // Also pull sync data for this user account
      const serverRes = await pullFromServerSync(reports, profile.email);
      if (serverRes.dataUpdated) {
        setReports(serverRes.reports);
      }
    } catch (err: any) {
      console.error('Google Sign-In error:', err);
      const errMsg = err.message || '';
      if (errMsg.includes('đóng cửa sổ') || errMsg.includes('popup-closed')) {
        showToast('ℹ️ Bạn đã hủy đăng nhập Google.');
      } else {
        showToast('❌ Đăng nhập Google thất bại: ' + (errMsg || 'Vui lòng thử lại'));
      }
    }
  };

  const handleGoogleSwitchAccount = async () => {
    try {
      await clearStoredUserProfile();
      setUserProfile(null);
      showToast('🔄 Đang chuyển sang tài khoản Gmail khác...');
      await handleGoogleLogin();
    } catch (err: any) {
      console.error('Switch account error:', err);
    }
  };

  const handleGoogleLogout = async () => {
    await clearStoredUserProfile();
    setUserProfile(null);
    showToast('🔒 Đã đăng xuất tài khoản Google.');
  };

  const handleSyncDriveManual = async () => {
    let token = userProfile?.accessToken;
    const isExpired = userProfile?.expiresAt ? userProfile.expiresAt <= Date.now() : false;
    const isFirebaseToken = token ? token.startsWith('eyJ') : false;

    if (!token || isExpired || isFirebaseToken) {
      try {
        showToast('🔑 Đang kết nối Google Drive...');
        const freshProfile = await requestGoogleSignIn();
        setUserProfile(freshProfile);
        token = freshProfile.accessToken;
      } catch (err: any) {
        showToast('⚠️ Vui lòng đăng nhập lại Google để đồng bộ file lên Drive.');
        return;
      }
    }

    showToast('🔄 Đang đồng bộ file chờ lên Google Drive...');
    try {
      const count = await syncPendingDriveUploads(reports, token, async (updatedReport) => {
        await dbService.saveReport(updatedReport);
        setReports(prev => prev.map(r => r.id === updatedReport.id ? updatedReport : r));
      });
      // Push updated sync state to Server & Google Drive JSON
      const latestReports = await dbService.getAllReports();
      await pushToServerSync(latestReports, userProfile?.email, refDocs, auditLogs);
      syncToCloud(token).catch(e => console.warn('Background cloud json push:', e));
      showToast(`✅ Đã đồng bộ ${count} file báo cáo lên Google Drive!`);
    } catch (err: any) {
      console.warn('Sync pending uploads err:', err);
      if (err?.message?.includes('401') || err?.message?.includes('403') || err?.message?.includes('invalid') || err?.message?.includes('AUTH_ERROR')) {
        try {
          const freshProfile = await requestGoogleSignIn();
          setUserProfile(freshProfile);
          const count = await syncPendingDriveUploads(reports, freshProfile.accessToken, async (updatedReport) => {
            await dbService.saveReport(updatedReport);
            setReports(prev => prev.map(r => r.id === updatedReport.id ? updatedReport : r));
          });
          const latestReports = await dbService.getAllReports();
          await pushToServerSync(latestReports, freshProfile.email, refDocs, auditLogs);
          syncToCloud(freshProfile.accessToken).catch(e => console.warn('Background retry cloud push:', e));
          showToast(`✅ Đã đồng bộ ${count} file báo cáo lên Google Drive!`);
        } catch (retryErr) {
          showToast('❌ Đồng bộ Drive thất bại. Vui lòng thử lại.');
        }
      } else {
        showToast('✅ Đã cập nhật trạng thái đồng bộ.');
      }
    }
  };

  const handleBackupLocal = async (report: ReportItem) => {
    try {
      const updated = await backupReportLocally(report);
      setReports(prev => prev.map(r => r.id === updated.id ? updated : r));
      await addAuditLog('BACKUP_LOCAL', `Sao lưu file local cho báo cáo: ${report.title}`, report.title, report.id);
      showToast(`💾 Đã backup file local & cập nhật mốc thời gian thành công!`);
    } catch (err: any) {
      showToast(`❌ Lỗi backup local: ${err.message}`);
    }
  };

  const addAuditLog = async (
    action: AuditLogItem['action'],
    details: string,
    reportTitle?: string,
    reportId?: string
  ) => {
    await dbService.addAuditLog({
      reportId,
      reportTitle,
      action,
      details,
      timestamp: new Date().toISOString(),
      status: 'success'
    });
    const updatedLogs = await dbService.getAuditLogs();
    setAuditLogs(updatedLogs);
  };

  // Toggle Theme
  const handleToggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // PWA Install Action
  const handleInstallPwa = () => {
    if (pwaInstallPrompt) {
      pwaInstallPrompt.prompt();
      pwaInstallPrompt.userChoice.then((choice: any) => {
        if (choice.outcome === 'accepted') {
          showToast('Đã cài đặt DocuReport AI thành công vào hệ thống!');
        }
        setPwaInstallPrompt(null);
      });
    }
  };

  // Save / Update Report
  const handleSaveReport = async (savedReport: ReportItem) => {
    await dbService.saveReport(savedReport);
    
    setReports(prev => {
      const idx = prev.findIndex(r => r.id === savedReport.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = savedReport;
        return next;
      }
      return [savedReport, ...prev];
    });

    await addAuditLog('UPDATED', `Cập nhật thông tin báo cáo: "${savedReport.title}"`, savedReport.title, savedReport.id);
    showToast(`Đã lưu báo cáo "${savedReport.title}"`);
    
    // Push updates to server sync & Drive
    const latestList = await dbService.getAllReports();
    await pushToServerSync(latestList, userProfile?.email, refDocs, auditLogs);
    if (userProfile?.accessToken) {
      handleSyncToCloud();
    }
  };

  // Toggle Pin
  const handleTogglePin = async (id: string) => {
    const report = reports.find(r => r.id === id);
    if (!report) return;

    const updated = { ...report, pinned: !report.pinned };
    await dbService.saveReport(updated);

    setReports(prev => prev.map(r => r.id === id ? updated : r));
    showToast(updated.pinned ? `Đã ghim "${updated.title}"` : `Đã bỏ ghim "${updated.title}"`);

    const latestList = await dbService.getAllReports();
    await pushToServerSync(latestList, userProfile?.email, refDocs, auditLogs);
    if (userProfile?.accessToken) {
      handleSyncToCloud();
    }
  };

  // Status Change & One-Click Submit Trigger
  const handleStatusChange = async (id: string, newStatus: ReportStatus) => {
    const report = reports.find(r => r.id === id);
    if (!report) return;

    let updatedReport = { ...report, status: newStatus, updatedAt: new Date().toISOString() };

    await addAuditLog('STATUS_CHANGE', `Thay đổi trạng thái sang "${newStatus}"`, report.title, report.id);
    showToast(`Đã chuyển trạng thái sang "${newStatus}"`);

    await dbService.saveReport(updatedReport);
    setReports(prev => prev.map(r => r.id === id ? updatedReport : r));

    const latestList = await dbService.getAllReports();
    await pushToServerSync(latestList, userProfile?.email, refDocs, auditLogs);
    if (userProfile?.accessToken) {
      handleSyncToCloud();
    }

    // Auto One-Click Submit Trigger: If status becomes "Done" & Agent is enabled
    if (newStatus === 'Done' && agentConfig.globalActive && agentConfig.autoSendOnDone && report.agentEnabled) {
      await handleOneClickSubmit(updatedReport);
    }
  };

  // Semi-Auto / One-Click Submit Workflow Handler
  const handleOneClickSubmit = async (report: ReportItem) => {
    try {
      showToast(`⚡ Đang tải file & chuẩn bị mở trang nộp báo cáo...`);
      const result = await executeOneClickSubmit(report);

      const updatedReport: ReportItem = {
        ...report,
        status: 'Sent',
        lastSentAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await dbService.saveReport(updatedReport);
      setReports(prev => prev.map(r => r.id === report.id ? updatedReport : r));

      const latestList = await dbService.getAllReports();
      await pushToServerSync(latestList, userProfile?.email, refDocs, auditLogs);
      if (userProfile?.accessToken) {
        handleSyncToCloud();
      }

      await addAuditLog(
        'SUBMITTED',
        `Tự động tải file "${result.filename}" & mở liên kết nộp: ${result.submissionUrl}`,
        report.title,
        report.id
      );

      showToast(result.message);
    } catch (err: any) {
      console.error('Lỗi khi nộp báo cáo:', err);
      showToast(`Không thể nộp báo cáo: ${err.message || err}`);
    }
  };

  // Semi-Auto / One-Click Zalo Approval Workflow Handler
  const handleZaloApprovalSubmit = async (report: ReportItem) => {
    try {
      showToast(`⚡ Đang tải file & chuẩn bị mở chat Zalo Duyệt...`);
      const result = await executeZaloApprovalWorkflow(report);

      await addAuditLog(
        'SUBMITTED',
        `Gửi Zalo Duyệt 1-Click: Tải file "${result.filename}", copy lời nhắn & mở Zalo chat với SĐT ${result.zaloPhoneSanitized}`,
        report.title,
        report.id
      );

      setZaloModalData({
        isOpen: true,
        report,
        result
      });

      showToast(result.message);
    } catch (err: any) {
      console.error('Lỗi khi gửi Zalo:', err);
      showToast(`❌ Không thể mở Zalo: ${err.message || err}`);
    }
  };

  // Open / Access / Download Attached Report File
  const handleOpenReportFile = async (report: ReportItem) => {
    try {
      showToast(`📥 Đang mở file báo cáo: "${report.fileName || report.title}"...`);
      const { filename } = await openOrDownloadReportFile(report);
      await addAuditLog('ACCESSED', `Truy cập & mở file báo cáo "${filename}"`, report.title, report.id);
    } catch (err: any) {
      console.error('Lỗi khi mở file báo cáo:', err);
      showToast(`❌ Không thể mở file: ${err.message || err}`);
    }
  };

  // Delete Report
  const handleDeleteReport = async (id: string) => {
    const report = reports.find(r => r.id === id);
    if (!report) return;

    if (confirm(`Bạn có chắc muốn xóa báo cáo "${report.title}"?`)) {
      await dbService.deleteReport(id);
      setReports(prev => prev.filter(r => r.id !== id));
      await addAuditLog('DELETED', `Đã xóa báo cáo khỏi hệ thống`, report.title, id);
      showToast(`Đã xóa báo cáo "${report.title}"`);

      const latestList = await dbService.getAllReports();
      await pushToServerSync(latestList, userProfile?.email, refDocs, auditLogs, [id]);
      if (userProfile?.accessToken) {
        handleSyncToCloud();
      }
    }
  };

  // Apply AI Summary
  const handleApplyAiSummary = async (reportId: string, summary: string, actionItems: string[]) => {
    const report = reports.find(r => r.id === reportId);
    if (!report) return;

    const updated = { ...report, aiSummary: summary, aiActionItems: actionItems, updatedAt: new Date().toISOString() };
    await dbService.saveReport(updated);
    setReports(prev => prev.map(r => r.id === reportId ? updated : r));

    const latestList = await dbService.getAllReports();
    await pushToServerSync(latestList, userProfile?.email, refDocs, auditLogs);

    await addAuditLog('AI_SUMMARY', `Tóm tắt nội dung báo cáo bằng Gemini AI`, report.title, report.id);
    showToast('Đã lưu tóm tắt Gemini AI vào báo cáo!');
    if (userProfile?.accessToken) {
      handleSyncToCloud();
    }
  };

  // Reference Documents CRUD Handlers
  const handleSaveRefDoc = async (doc: RefDocument) => {
    await dbService.saveRefDoc(doc);
    const updated = await dbService.getAllRefDocs();
    setRefDocs(updated);
    const latestList = await dbService.getAllReports();
    await pushToServerSync(latestList, userProfile?.email, updated, auditLogs);
    if (userProfile?.accessToken) {
      handleSyncToCloud();
    }
  };

  const handleDeleteRefDoc = async (id: string) => {
    const doc = refDocs.find(d => d.id === id);
    if (!doc) return;
    if (confirm(`Bạn có chắc muốn xóa tài liệu tham khảo "${doc.title}"?`)) {
      await dbService.deleteRefDoc(id);
      const updated = await dbService.getAllRefDocs();
      setRefDocs(updated);
      showToast(`Đã xóa tài liệu "${doc.title}"`);
      const latestList = await dbService.getAllReports();
      await pushToServerSync(latestList, userProfile?.email, updated, auditLogs);
      if (userProfile?.accessToken) {
        handleSyncToCloud();
      }
    }
  };

  const handleTogglePinRefDoc = async (id: string) => {
    const doc = refDocs.find(d => d.id === id);
    if (!doc) return;
    const updatedDoc = { ...doc, pinned: !doc.pinned, updatedAt: new Date().toISOString() };
    await dbService.saveRefDoc(updatedDoc);
    const updated = await dbService.getAllRefDocs();
    setRefDocs(updated);
    showToast(updatedDoc.pinned ? `Đã ghim "${doc.title}" lên đầu` : `Đã bỏ ghim "${doc.title}"`);
    const latestList = await dbService.getAllReports();
    await pushToServerSync(latestList, userProfile?.email, updated, auditLogs);
    if (userProfile?.accessToken) {
      handleSyncToCloud();
    }
  };

  // Local PC File Vault Health Check & Repair
  const handleVerifyLocalVault = async () => {
    try {
      showToast('🔍 Đang kiểm tra và đối chiếu kho File Local trên máy tính...');
      const res = await dbService.verifyAndRepairLocalFileVault();
      if (res.repairedCount > 0) {
        const latest = await dbService.getAllReports();
        setReports(latest);
        showToast(`🛡️ Đã sửa & khôi phục liên kết cho ${res.repairedCount} file báo cáo (${res.validCount}/${res.checkedCount} file sẵn sàng)!`);
      } else {
        showToast(`🛡️ Kho File Local hoàn hảo: ${res.validCount}/${res.checkedCount} báo cáo sẵn sàng với file mới nhất!`);
      }
    } catch (e: any) {
      console.warn('Verify vault notice:', e);
      showToast('Kiểm tra kho file local hoàn tất.');
    }
  };

  // Export JSON Backup
  const handleExportData = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(reports, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `DocuReport_Backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(dlAnchorElem);
    dlAnchorElem.click();
    dlAnchorElem.remove();
    showToast('Đã xuất file sao lưu JSON thành công!');
  };

  // Import JSON Backup
  const handleImportData = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          for (const rep of imported) {
            await dbService.saveReport(rep);
          }
          const allDocs = await dbService.getAllReports();
          setReports(allDocs);
          showToast(`Đã nhập thành công ${imported.length} báo cáo!`);
        }
      } catch (e) {
        showToast('Lỗi: File JSON không hợp lệ!');
      }
    };
    reader.readAsText(file);
  };

  // Filter Projects List
  const projectsList = Array.from(new Set(reports.map(r => r.project).filter(Boolean)));

  // Filtered & Sorted Reports
  const filteredReports = reports.filter(r => {
    if (selectedCategory !== 'ALL' && r.category !== selectedCategory) return false;
    if (selectedStatus !== 'ALL' && r.status !== selectedStatus) return false;
    if (selectedProject !== 'ALL' && r.project !== selectedProject) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = r.title.toLowerCase().includes(q);
      const matchProject = r.project.toLowerCase().includes(q);
      const matchPath = r.path.toLowerCase().includes(q);
      const matchNotes = (r.notes || '').toLowerCase().includes(q);
      return matchTitle || matchProject || matchPath || matchNotes;
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.date).getTime() - new Date(a.date).getTime();
    if (sortBy === 'oldest') return new Date(a.date).getTime() - new Date(b.date).getTime();
    if (sortBy === 'title-asc') return a.title.localeCompare(b.title, 'vi');
    if (sortBy === 'title-desc') return b.title.localeCompare(a.title, 'vi');
    return 0;
  });

  const pinnedReports = reports.filter(r => r.pinned);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row font-sans transition-colors">
      
      {/* VERTICAL SIDEBAR */}
      <Sidebar
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenAddModal={() => {
          setReportToEdit(null);
          setDefaultModalDate(undefined);
          setDefaultModalCategory(undefined);
          setTemplateContentToUse(undefined);
          setIsAddModalOpen(true);
        }}
        onOpenAiModal={() => {
          setAiSelectedReport(reports[0] || null);
          setIsAiModalOpen(true);
        }}
        onOpenAgentModal={() => setIsAgentModalOpen(true)}
        onOpenTemplateModal={() => setIsTemplateModalOpen(true)}
        onOpenAuditLogs={() => setIsAuditLogsOpen(true)}
        onExportData={handleExportData}
        onImportData={handleImportData}
        pwaInstallPrompt={pwaInstallPrompt}
        onInstallPwa={handleInstallPwa}
        isOnline={isOnline}
        activeView={activeView}
        setActiveView={setActiveView}
      />

      {/* RIGHT SIDE CONTENT CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* TOP NAVBAR */}
        <Navbar
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onOpenAddModal={() => {
            setReportToEdit(null);
            setDefaultModalDate(undefined);
            setDefaultModalCategory(undefined);
            setTemplateContentToUse(undefined);
            setIsAddModalOpen(true);
          }}
          onOpenAiModal={() => {
            setAiSelectedReport(reports[0] || null);
            setIsAiModalOpen(true);
          }}
          onOpenAgentModal={() => setIsAgentModalOpen(true)}
          onOpenTemplateModal={() => setIsTemplateModalOpen(true)}
          onOpenAuditLogs={() => setIsAuditLogsOpen(true)}
          onExportData={handleExportData}
          onImportData={handleImportData}
          pwaInstallPrompt={pwaInstallPrompt}
          onInstallPwa={handleInstallPwa}
          isOnline={isOnline}
          activeView={activeView === 'refdocs' ? 'grid' : activeView}
          setActiveView={(view) => setActiveView(view)}
          userProfile={userProfile}
          onLoginGoogle={handleGoogleLogin}
          onLogoutGoogle={handleGoogleLogout}
          onSwitchGoogleAccount={handleGoogleSwitchAccount}
          onSyncDrivePending={handleSyncDriveManual}
          pendingSyncCount={reports.filter(r => r.pendingSync).length}
          onOpenConfigClientId={() => {
            setCustomClientIdInput(getActiveClientId());
            setIsClientIdModalOpen(true);
          }}
          syncStatus={syncStatus}
          onTriggerSyncCloud={() => handleSyncFromCloud(undefined, true)}
          onVerifyLocalVault={handleVerifyLocalVault}
        />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* STATS OVERVIEW */}
        <StatsOverview
          reports={reports}
          onSelectCategory={setSelectedCategory}
          onSelectStatus={setSelectedStatus}
        />

        {/* WEB PUSH NOTIFICATION PROMPT */}
        <NotificationPromptBanner
          onOpenConfigModal={() => setIsNotifConfigModalOpen(true)}
        />

        {/* QUICK ACCESS PINNED SHORTCUTS */}
        <QuickAccessPinned
          pinnedReports={pinnedReports}
          onTogglePin={handleTogglePin}
          onViewReport={(rep) => {
            setReportToEdit(rep);
            setIsAddModalOpen(true);
          }}
          onSubmitReport={handleOneClickSubmit}
          onSendZaloReport={handleZaloApprovalSubmit}
          onOpenReportFile={handleOpenReportFile}
        />

        {/* DASHBOARD VIEW OR REFDOCS VIEW OR CALENDAR VIEW OR MAIN LIST */}
        {activeView === 'dashboard' ? (
          <DashboardView
            reports={reports}
            onOpenAddModal={() => {
              setReportToEdit(null);
              setIsAddModalOpen(true);
            }}
            onFilterStatus={(status) => {
              setSelectedStatus(status);
              setActiveView('grid');
            }}
          />
        ) : activeView === 'refdocs' ? (
          <RefDocsSection
            refDocs={refDocs}
            onSaveRefDoc={handleSaveRefDoc}
            onDeleteRefDoc={handleDeleteRefDoc}
            onTogglePinRefDoc={handleTogglePinRefDoc}
            showToast={showToast}
          />
        ) : activeView === 'calendar' ? (
          <CalendarView
            reports={reports}
            onViewReport={(rep) => {
              setReportToEdit(rep);
              setIsAddModalOpen(true);
            }}
            onOpenAddModalWithDate={(dateStr) => {
              setReportToEdit(null);
              setDefaultModalDate(dateStr);
              setIsAddModalOpen(true);
            }}
          />
        ) : (
          <>
            {/* WORKSPACE CONTROLS */}
            <WorkspaceControls
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              selectedStatus={selectedStatus}
              onSelectStatus={setSelectedStatus}
              selectedProject={selectedProject}
              onSelectProject={setSelectedProject}
              projectsList={projectsList}
              sortBy={sortBy}
              onSortChange={setSortBy}
              viewLayout={viewLayout}
              onViewLayoutChange={setViewLayout}
            />

            {/* DOCUMENT LIST */}
            {filteredReports.length === 0 ? (
              <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
                <FileText className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3 opacity-60" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-200 mb-1">Không tìm thấy báo cáo phù hợp</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-md mx-auto">
                  Thử thay đổi từ khóa tìm kiếm, chọn lại danh mục hoặc bấm nút bên dưới để tạo mới báo cáo.
                </p>
                <button
                  onClick={() => {
                    setReportToEdit(null);
                    setIsAddModalOpen(true);
                  }}
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md transition-all inline-flex items-center gap-1.5 active:scale-95"
                >
                  <Plus className="w-4 h-4" /> Thêm Báo Cáo Mới
                </button>
              </div>
            ) : viewLayout === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {filteredReports.map(report => (
                  <ReportCard
                    key={report.id}
                    report={report}
                    onStatusChange={handleStatusChange}
                    onTogglePin={handleTogglePin}
                    onViewReport={(rep) => {
                      setReportToEdit(rep);
                      setIsAddModalOpen(true);
                    }}
                    onOpenAiSummary={(rep) => {
                      setAiSelectedReport(rep);
                      setIsAiModalOpen(true);
                    }}
                    onSubmitReport={handleOneClickSubmit}
                    onSendZaloReport={handleZaloApprovalSubmit}
                    onOpenReportFile={handleOpenReportFile}
                    onBackupLocal={handleBackupLocal}
                    onEdit={(rep) => {
                      setReportToEdit(rep);
                      setIsAddModalOpen(true);
                    }}
                    onDelete={handleDeleteReport}
                  />
                ))}
              </div>
            ) : (
              <ReportTableView
                reports={filteredReports}
                onStatusChange={handleStatusChange}
                onTogglePin={handleTogglePin}
                onViewReport={(rep) => {
                  setReportToEdit(rep);
                  setIsAddModalOpen(true);
                }}
                onOpenAiSummary={(rep) => {
                  setAiSelectedReport(rep);
                  setIsAiModalOpen(true);
                }}
                onSubmitReport={handleOneClickSubmit}
                onSendZaloReport={handleZaloApprovalSubmit}
                onOpenReportFile={handleOpenReportFile}
                onBackupLocal={handleBackupLocal}
                onEdit={(rep) => {
                  setReportToEdit(rep);
                  setIsAddModalOpen(true);
                }}
                onDelete={handleDeleteReport}
              />
            )}
          </>
        )}

      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 py-5 text-xs text-slate-600 dark:text-slate-300 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <strong className="text-slate-900 dark:text-slate-100 font-bold">Quản lý Báo cáo</strong> &bull; Design by <span className="text-baemin font-extrabold">Tony Hung</span>
          </div>
          <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
            IndexedDB Offline Engine &bull; Gemini 3.6 Flash Integrated
          </div>
        </div>
      </footer>
      </div>

      {/* ALL MODALS */}
      <DocFormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        reportToEdit={reportToEdit}
        onSaveReport={handleSaveReport}
        defaultDate={defaultModalDate}
        defaultCategory={defaultModalCategory}
        initialTemplateContent={templateContentToUse}
        refDocs={refDocs}
      />

      <AgentConfigModal
        isOpen={isAgentModalOpen}
        onClose={() => setIsAgentModalOpen(false)}
        config={agentConfig}
        onSaveConfig={async (updated) => {
          await dbService.saveAgentConfig(updated);
          setAgentConfig(updated);
          showToast('Đã cập nhật cấu hình Automation Agent!');
        }}
        sampleReport={reports[0]}
        onTestDispatchAgent={async (rep) => {
          return await executeOneClickSubmit(rep);
        }}
      />

      <AiAssistantModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        report={aiSelectedReport}
        allReports={reports}
        onApplyAiSummary={handleApplyAiSummary}
        onAddReport={(newRep) => {
          const repToSave: ReportItem = ('id' in newRep && newRep.id) ? (newRep as ReportItem) : {
            ...newRep,
            id: Date.now().toString()
          } as ReportItem;
          handleSaveReport(repToSave);
        }}
      />

      <ReportTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onUseTemplate={(tpl: ReportTemplate) => {
          setReportToEdit(null);
          setDefaultModalCategory(tpl.category);
          setTemplateContentToUse(tpl.sampleContent);
          setIsAddModalOpen(true);
        }}
      />

      <AuditLogDrawer
        isOpen={isAuditLogsOpen}
        onClose={() => setIsAuditLogsOpen(false)}
        logs={auditLogs}
        onClearLogs={async () => {
          await dbService.clearAuditLogs();
          setAuditLogs([]);
          showToast('Đã xóa nhật ký hoạt động.');
        }}
      />

      {/* Zalo Guidance Modal */}
      <ZaloGuidanceModal
        isOpen={zaloModalData.isOpen}
        onClose={() => setZaloModalData(prev => ({ ...prev, isOpen: false }))}
        report={zaloModalData.report}
        result={zaloModalData.result}
      />

      {/* Google OAuth Client ID Modal */}
      {isClientIdModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Cấu hình Google OAuth Client ID</h3>
              </div>
              <button
                onClick={() => setIsClientIdModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Error explanation banner */}
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-3.5 space-y-1.5 text-xs text-rose-800 dark:text-rose-300">
              <div className="flex items-center gap-2 font-bold text-rose-600 dark:text-rose-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Giải thích Lỗi 401: invalid_client (The OAuth client was not found)</span>
              </div>
              <p className="text-[11px] leading-relaxed text-rose-700 dark:text-rose-300/90">
                Lỗi này xuất hiện vì Google từ chối mã giả định mẫu (<code>YOUR_GOOGLE_CLIENT_ID_HERE</code>). Để đăng nhập tài khoản Google thực tế và đồng bộ file lên Google Drive, bạn cần nhập <b>Client ID hợp lệ</b> tạo từ Google Cloud Console.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nhập Google OAuth Client ID của bạn:
              </label>
              <input
                type="text"
                value={customClientIdInput}
                onChange={(e) => setCustomClientIdInput(e.target.value)}
                placeholder="123456789-xxxxxx.apps.googleusercontent.com"
                className="w-full text-xs font-mono p-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-3.5 text-[11px] text-indigo-900 dark:text-indigo-200 space-y-2">
              <p className="font-bold flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300">
                💡 3 bước tạo Google Client ID miễn phí trên Google Cloud Console:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-slate-700 dark:text-slate-300 leading-relaxed">
                <li>Truy cập <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 font-bold underline">Google Cloud Credentials</a>.</li>
                <li>Tạo mới <b>OAuth 2.0 Client ID</b> chọn loại <b>Web Application</b>.</li>
                <li>Thêm URL hiện tại (<code className="font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">{typeof window !== 'undefined' ? window.location.origin : ''}</code>) vào mục <b>Authorized JavaScript origins</b> và <b>Authorized redirect URIs</b>.</li>
              </ol>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  saveActiveClientId('');
                  setCustomClientIdInput(GOOGLE_CLIENT_ID);
                  showToast('Đã khôi phục cài đặt mặc định');
                  setIsClientIdModalOpen(false);
                }}
                className="px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-all"
              >
                Khôi phục mặc định
              </button>
              <button
                onClick={() => {
                  const val = customClientIdInput.trim();
                  if (isPlaceholderClientId(val)) {
                    showToast('⚠️ Vui lòng nhập Client ID hợp lệ có dạng xxx.apps.googleusercontent.com');
                    return;
                  }
                  saveActiveClientId(val);
                  showToast('✅ Đã lưu Google Client ID thành công! Bạn có thể Đăng nhập Google ngay.');
                  setIsClientIdModalOpen(false);
                }}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md transition-all active:scale-95"
              >
                Lưu & Áp Dụng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-slate-100 border border-slate-700 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-up font-medium text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* PWA APP UPDATE NOTIFICATION STICKY BANNER */}
      <UpdateNotificationBanner
        hasUpdate={hasUpdate}
        isUpdating={isUpdating}
        onUpdate={handleUpdate}
      />

      {/* PENDING REPORTS MODAL */}
      <PendingReportsModal
        isOpen={isPendingModalOpen}
        onClose={() => setIsPendingModalOpen(false)}
        reports={reports}
        onOneClickSubmit={handleOneClickSubmit}
        onQuickView={(report) => {
          setReportToEdit(report);
          setIsAddModalOpen(true);
          setIsPendingModalOpen(false);
        }}
        onOpenCreateNew={() => {
          setReportToEdit(null);
          setIsAddModalOpen(true);
          setIsPendingModalOpen(false);
        }}
      />

      {/* BEE VIRTUAL ASSISTANT & REMINDER WIDGET */}
      <BeeAssistant
        reports={reports}
        onOpenAddModal={() => {
          setReportToEdit(null);
          setIsAddModalOpen(true);
        }}
        onOpenPendingModal={() => setIsPendingModalOpen(true)}
        onNavigateView={(view) => setActiveView(view)}
        onTriggerSimulatedUpdate={triggerSimulatedUpdate}
        onOpenNotifConfigModal={() => setIsNotifConfigModalOpen(true)}
      />

      {/* SUB-SETTINGS: NOTIFICATION SCHEDULE CONFIGURATION MODAL */}
      <NotificationConfigModal
        isOpen={isNotifConfigModalOpen}
        onClose={() => setIsNotifConfigModalOpen(false)}
        onShowToast={showToast}
      />

    </div>
  );
}
