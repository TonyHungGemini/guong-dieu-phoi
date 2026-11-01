import React, { useState, useEffect } from 'react';
import { Bell, BellRing, CheckCircle2, X, Send, AlertTriangle, Settings } from 'lucide-react';
import { requestNotificationPermission, sendTestNotification } from '../lib/notificationService';

interface NotificationPromptBannerProps {
  onOpenConfigModal?: () => void;
}

export const NotificationPromptBanner: React.FC<NotificationPromptBannerProps> = ({
  onOpenConfigModal,
}) => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [dismissed, setDismissed] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPermission(Notification.permission);
      }
    } catch (e) {
      console.warn('Notification permission check failed:', e);
    }
  }, []);

  const handleRequestPermission = async () => {
    setErrorMessage(null);
    try {
      const res = await requestNotificationPermission();
      setPermission(res);
      if (res === 'granted') {
        const success = await sendTestNotification();
        if (success) {
          setTestSent(true);
        }
      } else if (res === 'denied') {
        setErrorMessage('Quyền thông báo đã bị từ chối trên trình duyệt này. Hãy vào Cài đặt Trình duyệt > Quyền trang web để bật lại.');
      }
    } catch (err: any) {
      console.warn('Notification request failed:', err);
      setErrorMessage(err?.message || 'Không thể kích hoạt thông báo trên thiết bị này.');
    }
  };

  const handleTestClick = async () => {
    setErrorMessage(null);
    try {
      const success = await sendTestNotification();
      if (success) {
        setTestSent(true);
        setTimeout(() => setTestSent(false), 4000);
      } else {
        setErrorMessage('Không thể gửi thông báo. Hãy kiểm tra cài đặt thông báo của thiết bị/trình duyệt.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Lỗi khi gửi thông báo thử nghiệm.');
    }
  };

  if (dismissed || typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-baemin/30 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm transition-all">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-baemin-light text-baemin flex items-center justify-center shrink-0 border border-baemin/30 mt-0.5 sm:mt-0 animate-baemin-bounce">
          <BellRing className="w-5 h-5 stroke-[2.5]" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            Bật Thông Báo Nhắc Nhở Báo Cáo
            {permission === 'granted' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3 h-3" /> Đã Bật
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
            Nhận thông báo nhắc nhở tự động theo mốc thời gian tùy chỉnh ngay cả khi đóng ứng dụng!
          </p>
          {errorMessage && (
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {errorMessage}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto shrink-0">
        {onOpenConfigModal && (
          <button
            onClick={onOpenConfigModal}
            className="px-3 py-1.5 text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-lg transition-all flex items-center gap-1.5"
            title="Tùy chỉnh mốc giờ thông báo"
          >
            <Settings className="w-3.5 h-3.5" />
            ⚙️ Sửa Lịch Nhắc
          </button>
        )}

        {permission === 'default' && (
          <button
            onClick={handleRequestPermission}
            className="px-3.5 py-1.5 text-xs font-black bg-baemin hover:bg-baemin-dark text-slate-950 rounded-lg transition-all shadow-sm baemin-hover-pop flex items-center gap-1.5"
          >
            <Bell className="w-3.5 h-3.5" />
            Cho Phép
          </button>
        )}

        {permission === 'granted' && (
          <button
            onClick={handleTestClick}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 border ${
              testSent
                ? 'bg-emerald-500 text-white border-emerald-600'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            {testSent ? 'Đã Gửi Thử!' : 'Thử Gửi'}
          </button>
        )}

        {permission === 'denied' && (
          <button
            onClick={handleRequestPermission}
            className="px-3 py-1.5 text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded-lg transition-all"
          >
            Mở Bật Lại
          </button>
        )}

        <button
          onClick={() => setDismissed(true)}
          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
          title="Đóng banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};


