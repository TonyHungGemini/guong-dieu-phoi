import { ReportItem, ReportFrequency, ReportStatus } from '../types';
import { dbService } from './db';

const LAST_OPENED_DATE_KEY = 'docureport_last_opened_date';

/**
 * Format a Date object to YYYY-MM-DD string
 */
export function formatDateToYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Maps Vietnamese report categories to default schedule frequency if frequency is not explicitly set.
 */
export function inferFrequencyFromCategory(category?: string, explicitFrequency?: ReportFrequency): ReportFrequency {
  if (explicitFrequency && explicitFrequency !== 'none') {
    return explicitFrequency;
  }
  if (!category) return explicitFrequency || 'none';
  if (category === 'Báo cáo ngày' || category === 'Daily') return 'daily';
  if (category === 'Báo cáo tuần' || category === 'Weekly') return 'weekly';
  if (category === 'Báo cáo tháng' || category === 'Monthly') return 'monthly';
  return explicitFrequency || 'none';
}

/**
 * Returns user-friendly label for a frequency option.
 */
export function getFrequencyLabel(frequency: ReportFrequency): string {
  switch (frequency) {
    case 'daily':
      return '🔁 Hàng ngày (Daily)';
    case 'weekly':
      return '🔁 Hàng tuần (Weekly)';
    case 'monthly':
      return '🔁 Hàng tháng (Monthly)';
    case 'yearly':
      return '🔁 Hàng năm (Yearly)';
    case 'none':
    default:
      return 'Thủ công (None)';
  }
}

/**
 * Returns a short badge text for display on cards & tables.
 */
export function getFrequencyBadge(frequency?: ReportFrequency, category?: string): { text: string; bg: string; color: string } | null {
  const freq = inferFrequencyFromCategory(category, frequency);
  if (freq === 'none') return null;

  switch (freq) {
    case 'daily':
      return { text: '🔁 Hàng ngày', bg: 'bg-rose-500/10 dark:bg-rose-500/20', color: 'text-rose-600 dark:text-rose-400 border-rose-500/30' };
    case 'weekly':
      return { text: '🔁 Hàng tuần', bg: 'bg-amber-500/10 dark:bg-amber-500/20', color: 'text-amber-600 dark:text-amber-400 border-amber-500/30' };
    case 'monthly':
      return { text: '🔁 Hàng tháng', bg: 'bg-indigo-500/10 dark:bg-indigo-500/20', color: 'text-indigo-600 dark:text-indigo-400 border-indigo-500/30' };
    case 'yearly':
      return { text: '🔁 Hàng năm', bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', color: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30' };
    default:
      return null;
  }
}

/**
 * Calculates the next due date based on frequency and current due date.
 * Handle 0:00 AM auto-advance logic.
 */
export function getNextDueDate(
  frequency: ReportFrequency,
  currentDueDateStr?: string,
  referenceDate: Date = new Date()
): string {
  const todayStr = formatDateToYYYYMMDD(referenceDate);

  // Parse current due date safely
  let baseDate: Date;
  if (currentDueDateStr && /^\d{4}-\d{2}-\d{2}/.test(currentDueDateStr)) {
    const [y, m, d] = currentDueDateStr.split('T')[0].split('-').map(Number);
    baseDate = new Date(y, m - 1, d);
  } else {
    baseDate = new Date(referenceDate);
  }

  if (frequency === 'none') {
    return currentDueDateStr || todayStr;
  }

  if (frequency === 'daily') {
    // Advance base date by +1 day
    const next = new Date(baseDate);
    next.setDate(next.getDate() + 1);
    const nextStr = formatDateToYYYYMMDD(next);
    // If next date is still in the past relative to today, catch up to today
    return nextStr < todayStr ? todayStr : nextStr;
  }

  if (frequency === 'weekly') {
    // Advance by 7 days
    const next = new Date(baseDate);
    next.setDate(next.getDate() + 7);
    let nextStr = formatDateToYYYYMMDD(next);
    // Catch up to current/next cycle if far behind
    while (nextStr < todayStr) {
      next.setDate(next.getDate() + 7);
      nextStr = formatDateToYYYYMMDD(next);
    }
    return nextStr;
  }

  if (frequency === 'monthly') {
    // Advance by 1 month (or to 1st of next month)
    const next = new Date(baseDate);
    next.setMonth(next.getMonth() + 1);
    let nextStr = formatDateToYYYYMMDD(next);
    while (nextStr < todayStr) {
      next.setMonth(next.getMonth() + 1);
      nextStr = formatDateToYYYYMMDD(next);
    }
    return nextStr;
  }

  if (frequency === 'yearly') {
    // Advance by 1 year (or Jan 1st of next year)
    const next = new Date(baseDate);
    next.setFullYear(next.getFullYear() + 1);
    let nextStr = formatDateToYYYYMMDD(next);
    while (nextStr < todayStr) {
      next.setFullYear(next.getFullYear() + 1);
      nextStr = formatDateToYYYYMMDD(next);
    }
    return nextStr;
  }

  return todayStr;
}

/**
 * Checks if a report with status 'Done' or 'Sent' needs auto-advancing
 * when a new period (day/week/month/year) is reached.
 */
export function isReportReadyForAutoAdvance(
  report: ReportItem,
  currentDate: Date = new Date()
): boolean {
  // Only auto-advance reports that are completed ('Done' or 'Sent')
  if (report.status !== 'Done' && report.status !== 'Sent') {
    return false;
  }

  const freq = inferFrequencyFromCategory(report.category, report.frequency);
  if (freq === 'none') {
    return false;
  }

  const todayStr = formatDateToYYYYMMDD(currentDate);
  const reportDateStr = (report.dueDate || report.date || '').split('T')[0];

  if (!reportDateStr) return false;

  // If report due date is in the past relative to today, it should auto-advance!
  if (reportDateStr < todayStr) {
    return true;
  }

  // If report was completed today, check whether the frequency indicates a new cycle
  // e.g. for daily reports completed yesterday/earlier
  return false;
}

/**
 * Scans all reports in IndexedDB / state and automatically advances completed
 * recurring reports to their next due date and resets status to 'To-do'.
 *
 * Called on App Initialization and 'visibilitychange' / 'DOMContentLoaded'.
 */
export async function checkAndAutoAdvanceReports(
  currentReports: ReportItem[],
  onReportsUpdated?: (updatedReports: ReportItem[]) => void
): Promise<{ updatedCount: number; updatedReports: ReportItem[] }> {
  const now = new Date();
  const todayStr = formatDateToYYYYMMDD(now);

  // Check lastOpenedDate from storage
  let lastOpenedDate = '';
  try {
    if (typeof window !== 'undefined') {
      lastOpenedDate = localStorage.getItem(LAST_OPENED_DATE_KEY) || '';
    }
  } catch (e) {
    console.warn('LocalStorage error reading lastOpenedDate:', e);
  }

  let hasChanges = false;
  const updatedReports = currentReports.map(report => {
    const freq = inferFrequencyFromCategory(report.category, report.frequency);

    // Skip non-recurring or incomplete reports
    if (freq === 'none') return report;
    if (report.status !== 'Done' && report.status !== 'Sent') return report;

    const reportDateStr = (report.dueDate || report.date || '').split('T')[0];

    // Check if current date is strictly after report's due date
    if (reportDateStr && reportDateStr < todayStr) {
      hasChanges = true;
      const nextDueDate = getNextDueDate(freq, reportDateStr, now);

      const updatedReport: ReportItem = {
        ...report,
        frequency: freq,
        date: nextDueDate,
        dueDate: nextDueDate,
        status: 'To-do', // Reset status to To-do for the new cycle
        lastProcessedDate: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      // Persist to IndexedDB asynchronously
      dbService.saveReport(updatedReport).catch(err => {
        console.error(`Failed to auto-advance report ${report.id}:`, err);
      });

      // Log audit entry
      dbService.addAuditLog({
        reportId: report.id,
        reportTitle: report.title,
        action: 'STATUS_CHANGE',
        details: `🔄 Tự động chuyển chu kỳ [${getFrequencyLabel(freq)}] sang ngày ${nextDueDate} (Trạng thái chuyển lại 'To-do').`,
        timestamp: now.toISOString(),
        status: 'info',
      }).catch(err => console.warn('Audit log error:', err));

      return updatedReport;
    }

    return report;
  });

  // Save lastOpenedDate to storage
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LAST_OPENED_DATE_KEY, todayStr);
    }
  } catch (e) {
    console.warn('LocalStorage error saving lastOpenedDate:', e);
  }

  if (hasChanges && onReportsUpdated) {
    onReportsUpdated(updatedReports);
  }

  const updatedCount = updatedReports.filter((r, idx) => r !== currentReports[idx]).length;

  return { updatedCount, updatedReports };
}
