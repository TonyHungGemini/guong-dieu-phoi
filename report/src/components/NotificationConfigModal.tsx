import React, { useState, useEffect } from 'react';
import { Bell, Clock, Calendar, AlertTriangle, Plus, Trash2, CheckCircle2, RotateCcw, X, Save, Send, Sparkles } from 'lucide-react';
import {
  NotificationScheduleConfig,
  getNotificationScheduleConfig,
  saveNotificationScheduleConfig,
  DEFAULT_NOTIFICATION_CONFIG,
  sendTestNotification,
  requestNotificationPermission,
  CustomReminderSlot,
} from '../lib/notificationService';

interface NotificationConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string) => void;
}

const DAY_NAMES = [
  { value: 1, label: 'Thứ Hai' },
  { value: 2, label: 'Thứ Ba' },
  { value: 3, label: 'Thứ Tư' },
  { value: 4, label: 'Thứ Năm' },
  { value: 5, label: 'Thứ Sáu' },
  { value: 6, label: 'Thứ Bảy' },
  { value: 0, label: 'Chủ Nhật' },
];

export const NotificationConfigModal: React.FC<NotificationConfigModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const [config, setConfig] = useState<NotificationScheduleConfig>(DEFAULT_NOTIFICATION_CONFIG);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [testSent, setTestSent] = useState(false);
  
  // State for adding a new custom reminder
  const [newLabel, setNewLabel] = useState('');
  const [newTime, setNewTime] = useState('12:00');
  const [showAddCustom, setShowAddCustom] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfig(getNotificationScheduleConfig());
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPermission(Notification.permission);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    saveNotificationScheduleConfig(config);
    onShowToast('✅ Đã lưu tùy chỉnh mốc thời gian thông báo thành công!');
    onClose();
  };

  const handleResetDefault = () => {
    setConfig(DEFAULT_NOTIFICATION_CONFIG);
    saveNotificationScheduleConfig(DEFAULT_NOTIFICATION_CONFIG);
    onShowToast('🔄 Đã khôi phục lịch thông báo mặc định (5 PM hàng ngày & 9 AM Thứ Hai).');
  };

  const handleTestNotification = async () => {
    try {
      const perm = await requestNotificationPermission();
      setPermission(perm);
      if (perm === 'granted') {
        const success = await sendTestNotification();
        if (success) {
          setTestSent(true);
          setTimeout(() => setTestSent(false), 3000);
          onShowToast('🔔 Đã gửi thông báo thử nghiệm tới thiết bị của bạn!');
        } else {
          onShowToast('⚠️ Không thể gửi thông báo thử. Hãy kiểm tra cài đặt thiết bị.');
        }
      } else {
        onShowToast('⚠️ Trình duyệt chưa cho phép quyền hiển thị thông báo.');
      }
    } catch (e: any) {
      onShowToast(`❌ Lỗi gửi thông báo: ${e?.message || 'Không xác định'}`);
    }
  };

  const handleAddCustomReminder = () => {
    if (!newLabel.trim()) {
      onShowToast('⚠️ Vui lòng nhập tên/tiêu đề cho mốc nhắc nhở mới.');
      return;
    }
    const newSlot: CustomReminderSlot = {
      id: 'custom-' + Date.now(),
      label: newLabel.trim(),
      time: newTime || '12:00',
      enabled: true,
    };
    setConfig(prev => ({
      ...prev,
      customReminders: [...prev.customReminders, newSlot],
    }));
    setNewLabel('');
    setNewTime('12:00');
    setShowAddCustom(false);
    onShowToast('✨ Đã thêm mốc giờ nhắc nhở mới!');
  };

  const handleDeleteCustomReminder = (id: string) => {
    setConfig(prev => ({
      ...prev,
      customReminders: prev.customReminders.filter(c => c.id !== id),
    }));
  };

  const handleToggleCustomReminder = (id: string) => {
    setConfig(prev => ({
      ...prev,
      customReminders: prev.customReminders.map(c =>
        c.id === id ? { ...c, enabled: !c.enabled } : c
      ),
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden text-slate-900 dark:text-slate-100">
        
        {/* MODAL HEADER */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-transparent to-baemin/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md shadow-amber-500/20">
              <Bell className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold flex items-center gap-2">
                Tùy Chỉnh Mốc Giờ Thông Báo
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/30">
                  Sub-Settings
                </span>
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Cấu hình thời gian đếm ngược & nhắc nhở tự động theo lịch cá nhân của bạn
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">

          {/* PERMISSION STATUS BANNER */}
          <div className="p-3.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-3 h-3 rounded-full ${permission === 'granted' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <div>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">Trạng Thái Quyền Thông Báo: </span>
                <span className={`font-bold ${permission === 'granted' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {permission === 'granted' ? 'Đã Cho Phép (Đang Hoạt Động)' : permission === 'denied' ? 'Bị Từ Chối Trên Trình Duyệt' : 'Chưa Kích Hoạt'}
                </span>
              </div>
            </div>
            <button
              onClick={handleTestNotification}
              className={`px-3 py-1.5 font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm text-xs ${
                testSent
                  ? 'bg-emerald-500 text-white'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              {testSent ? 'Đã Gửi Thử!' : 'Gửi Thử Thông Báo'}
            </button>
          </div>

          {/* 1. DAILY REMINDER SECTION */}
          <div className="p-4 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-xs sm:text-sm font-extrabold text-amber-900 dark:text-amber-200">
                  1. Nhắc Nhở Hằng Ngày (Daily Reminder)
                </h3>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.dailyEnabled}
                  onChange={e => setConfig(prev => ({ ...prev, dailyEnabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Hệ thống sẽ đếm ngược và tự động bắn thông báo nhắc nhở nộp báo cáo trong ngày đúng mốc thời gian bên dưới.
            </p>

            {config.dailyEnabled && (
              <div className="pt-2 space-y-2">
                <div className="flex items-center gap-3">
                  <label className="font-bold text-slate-700 dark:text-slate-300 shrink-0">
                    Mốc giờ thông báo:
                  </label>
                  <input
                    type="time"
                    value={config.dailyTime}
                    onChange={e => setConfig(prev => ({ ...prev, dailyTime: e.target.value }))}
                    className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold text-sm text-slate-900 dark:text-white shadow-sm focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-500 font-semibold">Chọn nhanh:</span>
                  {['16:00', '16:30', '17:00', '17:30', '18:00'].map(t => (
                    <button
                      key={t}
                      onClick={() => setConfig(prev => ({ ...prev, dailyTime: t }))}
                      className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                        config.dailyTime === t
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {t} {t === '17:00' ? '(Mặc định 5 PM)' : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. WEEKLY REMINDER SECTION */}
          <div className="p-4 bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-xs sm:text-sm font-extrabold text-indigo-900 dark:text-indigo-200">
                  2. Nhắc Nhở Đầu Tuần (Weekly Reminder)
                </h3>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.weeklyEnabled}
                  onChange={e => setConfig(prev => ({ ...prev, weeklyEnabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Nhắc nhở tổng hợp danh sách báo cáo tuần mới và kế hoạch cần chuẩn bị.
            </p>

            {config.weeklyEnabled && (
              <div className="pt-2 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="font-bold text-slate-700 dark:text-slate-300">Ngày trong tuần:</label>
                    <select
                      value={config.weeklyDay}
                      onChange={e => setConfig(prev => ({ ...prev, weeklyDay: parseInt(e.target.value, 10) }))}
                      className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white"
                    >
                      {DAY_NAMES.map(d => (
                        <option key={d.value} value={d.value}>
                          {d.label} {d.value === 1 ? '(Mặc định)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="font-bold text-slate-700 dark:text-slate-300">Giờ nhắc:</label>
                    <input
                      type="time"
                      value={config.weeklyTime}
                      onChange={e => setConfig(prev => ({ ...prev, weeklyTime: e.target.value }))}
                      className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold text-xs text-slate-900 dark:text-white shadow-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-slate-500 font-semibold">Khung giờ phổ biến:</span>
                  {['08:00', '08:30', '09:00', '10:00'].map(t => (
                    <button
                      key={t}
                      onClick={() => setConfig(prev => ({ ...prev, weeklyTime: t }))}
                      className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                        config.weeklyTime === t
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {t} {t === '09:00' ? '(Mặc định 9 AM)' : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. OVERDUE & BACKUP WARNING SECTION */}
          <div className="p-4 bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <h3 className="text-xs sm:text-sm font-extrabold text-rose-900 dark:text-rose-200">
                  3. Cảnh Báo Báo Cáo Quá Hạn & Sao Lưu
                </h3>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.overdueEnabled}
                  onChange={e => setConfig(prev => ({ ...prev, overdueEnabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
              </label>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Tự động quét mỗi phút và phát chuông cảnh báo nếu có báo cáo quá hạn nộp hoặc cần sao lưu khẩn cấp.
            </p>
          </div>

          {/* 4. CUSTOM EXTRA REMINDER SLOTS */}
          <div className="p-4 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-xs sm:text-sm font-extrabold text-emerald-900 dark:text-emerald-200">
                  4. Khung Giờ Nhắc Nhở Bổ Sung Tùy Chỉnh
                </h3>
              </div>
              <button
                onClick={() => setShowAddCustom(!showAddCustom)}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] rounded-xl transition-all flex items-center gap-1 shadow-sm active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm Mốc Mới
              </button>
            </div>

            {/* Add New Custom Slot Form */}
            {showAddCustom && (
              <div className="p-3 bg-white dark:bg-slate-900 border border-emerald-500/30 rounded-xl space-y-2 animate-in fade-in">
                <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">✨ Thêm mốc thời gian thông báo riêng:</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="VD: Nhắc nộp báo cáo ca sáng..."
                    value={newLabel}
                    onChange={e => setNewLabel(e.target.value)}
                    className="sm:col-span-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium"
                  />
                  <input
                    type="time"
                    value={newTime}
                    onChange={e => setNewTime(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold text-xs"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setShowAddCustom(false)}
                    className="px-3 py-1 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleAddCustomReminder}
                    className="px-3 py-1 bg-emerald-600 text-white font-extrabold rounded-lg shadow-sm"
                  >
                    Lưu Mốc Giờ
                  </button>
                </div>
              </div>
            )}

            {/* List of Custom Slots */}
            {config.customReminders.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic">Chưa có mốc thời gian bổ sung nào.</p>
            ) : (
              <div className="space-y-2 pt-1">
                {config.customReminders.map(slot => (
                  <div
                    key={slot.id}
                    className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-2 shadow-sm"
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={slot.enabled}
                        onChange={() => handleToggleCustomReminder(slot.id)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <div>
                        <p className={`font-bold text-xs ${slot.enabled ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 line-through'}`}>
                          {slot.label}
                        </p>
                        <p className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          ⏰ Khung giờ: {slot.time}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteCustomReminder(slot.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Xóa mốc này"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={handleResetDefault}
            className="px-3.5 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-bold text-xs rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Khôi Phục Mặc Định
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-all"
            >
              Hủy
            </button>

            <button
              onClick={handleSave}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/20 transition-all active:scale-95 flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" /> Lưu Thay Đổi
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
