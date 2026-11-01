import { dbService } from './db';

// GLOBAL APP VERSION
export const APP_VERSION = '1.0.0';
export const VERSION_STORAGE_KEY = 'beereport_app_version';

/**
 * Migration function for future-proofing app updates.
 * Guarantees that user data in IndexedDB (reports, refDocs, configs, etc.)
 * is preserved 100%, adding default values for new fields on existing records.
 */
export async function migrateData(oldVersion: string | null, newVersion: string): Promise<boolean> {
  console.log(`[Bee Report Migration] Upgrading data schema from ${oldVersion || 'Initial'} to ${newVersion}`);
  
  try {
    const reports = await dbService.getAllReports();
    for (const report of reports) {
      let modified = false;

      // Assign default values for required fields on legacy records if missing
      if (!report.category) {
        report.category = 'Báo cáo ngày';
        modified = true;
      }
      if (!report.status) {
        report.status = 'To-do';
        modified = true;
      }
      if (report.pendingSync === undefined) {
        report.pendingSync = false;
        modified = true;
      }
      if (!report.date) {
        report.date = new Date().toISOString().split('T')[0];
        modified = true;
      }

      if (modified) {
        await dbService.saveReport(report);
      }
    }

    // Update stored version in localStorage safely
    localStorage.setItem(VERSION_STORAGE_KEY, newVersion);
    return true;
  } catch (err) {
    console.error('[Bee Report Migration] Migration failed cleanly:', err);
    localStorage.setItem(VERSION_STORAGE_KEY, newVersion);
    return false;
  }
}
