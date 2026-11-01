// Notification Service supporting Desktop, Mobile Chrome/Safari, PWA, and Service Worker

export interface NotificationScheduleOptions {
  enableDaily5PM?: boolean;
  enableMonday9AM?: boolean;
  enableOverdueReminders?: boolean;
}

const NOTIF_STORAGE_KEY = 'docureport_notif_last_sent';

/**
 * Get active Service Worker registration safely
 */
export async function getSWRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    // Wait up to 2 seconds for SW ready
    const readyPromise = navigator.serviceWorker.ready;
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
    const reg = await Promise.race([readyPromise, timeoutPromise]);
    if (reg) return reg;

    return (await navigator.serviceWorker.getRegistration()) || null;
  } catch (err) {
    console.warn('[NotificationService] getSWRegistration error:', err);
    return null;
  }
}

/**
 * Request Notification Permission cleanly across Desktop & Mobile
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    throw new Error('Trình duyệt không hỗ trợ Web Notification.');
  }

  // Mobile Safari / Chrome permission request
  let result: NotificationPermission = Notification.permission;
  if (result === 'default') {
    result = await Notification.requestPermission();
  }

  return result;
}

/**
 * Send Web Notification with ServiceWorker primary + classic fallback
 */
export async function sendNotification(
  title: string,
  options?: NotificationOptions & { url?: string }
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('[NotificationService] Notifications not supported in this environment');
    return false;
  }

  if (Notification.permission !== 'granted') {
    console.warn('[NotificationService] Permission not granted');
    return false;
  }

  const notificationOptions: any = {
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    vibrate: [100, 50, 100],
    tag: 'docureport-reminder',
    renotify: true,
    ...options,
  };

  // 1. Try Service Worker showNotification (Mandatory on Android Mobile & iOS PWA)
  try {
    const reg = await getSWRegistration();
    if (reg && reg.showNotification) {
      await reg.showNotification(title, notificationOptions);
      return true;
    }
  } catch (swErr) {
    console.warn('[NotificationService] SW showNotification failed, trying classic fallback:', swErr);
  }

  // 2. Fallback to Classic Notification Constructor (Desktop browsers)
  try {
    const notif = new Notification(title, notificationOptions);
    if (options?.url) {
      notif.onclick = () => {
        window.focus();
        if (options.url) window.location.href = options.url;
      };
    }
    return true;
  } catch (classicErr) {
    console.warn('[NotificationService] Classic Notification constructor failed:', classicErr);
    return false;
  }
}

/**
 * Send a Test Notification immediately
 */
export async function sendTestNotification(): Promise<boolean> {
  const perm = await requestNotificationPermission();
  if (perm !== 'granted') {
    return false;
  }

  return sendNotification('🔔 DocuReport AI: Thử Thông Báo Success!', {
    body: 'Hệ thống thông báo nhắc nhở báo cáo hoạt động tốt trên thiết bị của bạn!',
    icon: '/icon-192.svg',
    tag: 'test-notification-' + Date.now(),
  });
}

/**
 * Check if a notification tag was already sent recently (within last 30 minutes)
 */
function shouldSendReminder(reminderKey: string): boolean {
  try {
    const stored = localStorage.getItem(`${NOTIF_STORAGE_KEY}_${reminderKey}`);
    if (!stored) return true;
    const lastTime = parseInt(stored, 10);
    // Don't repeat same reminder within 30 minutes
    return Date.now() - lastTime > 30 * 60 * 1000;
  } catch {
    return true;
  }
}

function markReminderSent(reminderKey: string) {
  try {
    localStorage.setItem(`${NOTIF_STORAGE_KEY}_${reminderKey}`, Date.now().toString());
  } catch (e) {
    console.warn(e);
  }
}

export interface CustomReminderSlot {
  id: string;
  label: string;
  time: string; // "HH:mm"
  enabled: boolean;
}

export interface NotificationScheduleConfig {
  dailyEnabled: boolean;
  dailyTime: string; // "HH:mm"
  weeklyEnabled: boolean;
  weeklyDay: number; // 0 = Sun, 1 = Mon...
  weeklyTime: string; // "HH:mm"
  overdueEnabled: boolean;
  customReminders: CustomReminderSlot[];
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationScheduleConfig = {
  dailyEnabled: true,
  dailyTime: '17:00',
  weeklyEnabled: true,
  weeklyDay: 1, // Monday
  weeklyTime: '09:00',
  overdueEnabled: true,
  customReminders: [
    {
      id: 'custom-noon',
      label: 'Nhắc nhở kiểm tra tiến độ trưa',
      time: '12:00',
      enabled: false,
    },
  ],
};

const SCHEDULE_CONFIG_KEY = 'docureport_notif_schedule_config';

export function getNotificationScheduleConfig(): NotificationScheduleConfig {
  if (typeof window === 'undefined') return DEFAULT_NOTIFICATION_CONFIG;
  try {
    const raw = localStorage.getItem(SCHEDULE_CONFIG_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_NOTIFICATION_CONFIG,
      ...parsed,
      customReminders: Array.isArray(parsed?.customReminders) ? parsed.customReminders : DEFAULT_NOTIFICATION_CONFIG.customReminders,
    };
  } catch {
    return DEFAULT_NOTIFICATION_CONFIG;
  }
}

export function saveNotificationScheduleConfig(config: NotificationScheduleConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SCHEDULE_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('[NotificationService] Save config failed:', e);
  }
}

/**
 * Helper to parse "HH:mm" string safely
 */
function parseTimeHM(timeStr: string): { hour: number; minute: number } {
  try {
    const [h, m] = timeStr.split(':').map(n => parseInt(n, 10));
    return {
      hour: isNaN(h) ? 17 : h,
      minute: isNaN(m) ? 0 : m,
    };
  } catch {
    return { hour: 17, minute: 0 };
  }
}

/**
 * Scheduled Routine Check (Runs every 1 min in foreground/background)
 */
export async function checkAndTriggerScheduledReminders(overdueReportsCount: number = 0) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const config = getNotificationScheduleConfig();
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentDayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon

  // Helper to check if current time matches target "HH:mm" within a 5-minute window
  const matchesTime = (timeStr: string) => {
    const { hour, minute } = parseTimeHM(timeStr);
    return currentHour === hour && currentMinute >= minute && currentMinute < minute + 5;
  };

  // 1. Daily Reminder
  if (config.dailyEnabled && matchesTime(config.dailyTime)) {
    const key = `daily_${config.dailyTime}`;
    if (shouldSendReminder(key)) {
      const sent = await sendNotification(`⏰ DocuReport AI: Nhắc Nhở Báo Cáo (${config.dailyTime})`, {
        body: `Đã đến ${config.dailyTime}! Hãy kiểm tra và hoàn thành các báo cáo công việc ngày hôm nay.`,
        tag: `daily-reminder-${config.dailyTime}`,
      });
      if (sent) markReminderSent(key);
    }
  }

  // 2. Weekly Reminder
  if (config.weeklyEnabled && currentDayOfWeek === config.weeklyDay && matchesTime(config.weeklyTime)) {
    const key = `weekly_${config.weeklyDay}_${config.weeklyTime}`;
    if (shouldSendReminder(key)) {
      const sent = await sendNotification(`📅 DocuReport AI: Nhắc Nhở Đầu Tuần (${config.weeklyTime})`, {
        body: `Chào tuần mới! Hãy kiểm tra lịch lập báo cáo và cập nhật tiến độ công việc.`,
        tag: `weekly-reminder-${config.weeklyDay}-${config.weeklyTime}`,
      });
      if (sent) markReminderSent(key);
    }
  }

  // 3. Overdue Reports Warning
  if (config.overdueEnabled && overdueReportsCount > 0) {
    if (shouldSendReminder(`overdue_${overdueReportsCount}`)) {
      const sent = await sendNotification('⚠️ DocuReport AI: Cần Xử Lý Báo Cáo Quá Hạn', {
        body: `Bạn đang có ${overdueReportsCount} báo cáo cần hoàn thành gấp. Hãy nhấp để mở danh sách!`,
        tag: 'overdue-reports-reminder',
      });
      if (sent) markReminderSent(`overdue_${overdueReportsCount}`);
    }
  }

  // 4. Custom Reminder Slots
  if (config.customReminders && config.customReminders.length > 0) {
    for (const slot of config.customReminders) {
      if (slot.enabled && matchesTime(slot.time)) {
        const key = `custom_${slot.id}_${slot.time}`;
        if (shouldSendReminder(key)) {
          const sent = await sendNotification(`🔔 DocuReport AI: ${slot.label}`, {
            body: `Đã đến ${slot.time}: ${slot.label}. Mở ứng dụng để xem chi tiết!`,
            tag: `custom-slot-${slot.id}`,
          });
          if (sent) markReminderSent(key);
        }
      }
    }
  }
}
