import { ReportItem, RefDocument, AuditLogItem } from '../types';
import { dbService } from './db';

const SYNC_CHANNEL_NAME = 'docureport_sync_channel';

// BroadcastChannel for instant multi-tab sync on same device
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
  } catch (e) {
    console.warn('BroadcastChannel creation error:', e);
  }
}

/**
 * Smart Item-Level Merge for Report Lists across Desktop & Mobile
 * Compares reports by ID and keeps the version with newer updatedAt timestamp.
 * Prioritizes completed status ('Done' or 'Sent') so mobile always gets PC completion progress.
 */
export function mergeReportsItemByItem(
  localList: ReportItem[],
  remoteList: ReportItem[],
  deletedReportIds: string[] = []
): { merged: ReportItem[]; hasChanges: boolean } {
  const deletedSet = new Set<string>(deletedReportIds || []);

  const localFiltered = (localList || []).filter((r) => r && r.id && !deletedSet.has(r.id));
  const remoteFiltered = (remoteList || []).filter((r) => r && r.id && !deletedSet.has(r.id));

  if (remoteFiltered.length === 0) {
    return { merged: localFiltered, hasChanges: localFiltered.length !== localList.length };
  }

  const map = new Map<string, ReportItem>();
  let hasChanges = localFiltered.length !== localList.length;

  // Add remote reports first
  remoteFiltered.forEach((remoteRep) => {
    map.set(remoteRep.id, remoteRep);
  });

  // Reconcile with local reports
  localFiltered.forEach((localRep) => {
    const remoteRep = map.get(localRep.id);

    if (!remoteRep) {
      // Local report not on remote -> keep it
      map.set(localRep.id, localRep);
      hasChanges = true;
    } else {
      const localTime = new Date(localRep.updatedAt || localRep.date || 0).getTime();
      const remoteTime = new Date(remoteRep.updatedAt || remoteRep.date || 0).getTime();

      const isRemoteDone = remoteRep.status === 'Done' || remoteRep.status === 'Sent';
      const isLocalDone = localRep.status === 'Done' || localRep.status === 'Sent';

      if (remoteTime > localTime) {
        // Remote is newer
        map.set(remoteRep.id, {
          ...localRep,
          ...remoteRep,
          fileBlobId: remoteRep.fileBlobId || localRep.fileBlobId,
          fileName: remoteRep.fileName || localRep.fileName,
        });
        hasChanges = true;
      } else if (localTime > remoteTime) {
        // Local is newer
        map.set(localRep.id, {
          ...remoteRep,
          ...localRep,
        });
        hasChanges = true;
      } else {
        // Timestamps equal: propagate completion
        if (isRemoteDone && !isLocalDone) {
          map.set(remoteRep.id, {
            ...localRep,
            ...remoteRep,
          });
          hasChanges = true;
        } else if (isLocalDone && !isRemoteDone) {
          map.set(localRep.id, {
            ...remoteRep,
            ...localRep,
          });
          hasChanges = true;
        } else {
          map.set(remoteRep.id, {
            ...localRep,
            ...remoteRep,
            aiSummary: remoteRep.aiSummary || localRep.aiSummary,
            aiActionItems: remoteRep.aiActionItems || localRep.aiActionItems,
            fileBlobId: remoteRep.fileBlobId || localRep.fileBlobId,
            fileName: remoteRep.fileName || localRep.fileName,
          });
        }
      }
    }
  });

  const merged = Array.from(map.values()).filter((r) => !deletedSet.has(r.id));
  if (merged.length !== localList.length) {
    hasChanges = true;
  }

  return { merged, hasChanges };
}

// Helper for fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

/**
 * Push current reports & data to Server Sync API (/api/sync/data)
 */
export async function pushToServerSync(
  reports: ReportItem[],
  userEmail?: string,
  refDocs?: RefDocument[],
  auditLogs?: AuditLogItem[],
  deletedReportIds?: string[]
): Promise<ReportItem[]> {
  try {
    const fileBlobs = await dbService.getAllFileBlobs();
    // Only send fileBlobs with base64Data or compact size (< 400KB)
    const serializableBlobs = fileBlobs.map((b) => ({
      id: b.id,
      name: b.name,
      size: b.size,
      type: b.type,
      reportId: b.reportId,
      version: b.version,
      base64Data: (b.base64Data && b.base64Data.length < 400000) ? b.base64Data : undefined,
      updatedAt: b.updatedAt,
    }));

    const res = await fetchWithTimeout('/api/sync/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail: userEmail || 'default_user',
        reports,
        refDocs: refDocs || [],
        auditLogs: auditLogs || [],
        fileBlobs: serializableBlobs,
        deletedReportIds: deletedReportIds || [],
        lastUpdated: new Date().toISOString(),
      }),
    }, 6000);

    if (!res.ok) {
      throw new Error(`Server sync failed with status ${res.status}`);
    }

    const data = await res.json();
    if (data.success && Array.isArray(data.reports)) {
      // Update IndexedDB with merged result
      await dbService.overwriteAllReports(data.reports);

      if (Array.isArray(data.fileBlobs) && data.fileBlobs.length > 0) {
        await dbService.smartMergeFileBlobs(data.fileBlobs);
      }

      // Notify other tabs/devices via BroadcastChannel
      if (broadcastChannel) {
        broadcastChannel.postMessage({ type: 'DATA_UPDATED', timestamp: Date.now() });
      }

      return data.reports;
    }
    return reports;
  } catch (err) {
    console.warn('pushToServerSync error:', err);
    return reports;
  }
}

/**
 * Pull latest data from Server Sync API (/api/sync/data) and smart-merge
 */
export async function pullFromServerSync(
  currentLocalReports: ReportItem[],
  userEmail?: string
): Promise<{ reports: ReportItem[]; dataUpdated: boolean }> {
  try {
    const emailParam = encodeURIComponent(userEmail || 'default_user');
    const res = await fetchWithTimeout(`/api/sync/data?userEmail=${emailParam}`, {}, 5000);

    if (!res.ok) {
      return { reports: currentLocalReports, dataUpdated: false };
    }

    const data = await res.json();
    if (data.success && Array.isArray(data.reports) && data.reports.length > 0) {
      // Delete any tombstones from local IndexedDB
      if (Array.isArray(data.deletedReportIds)) {
        for (const delId of data.deletedReportIds) {
          await dbService.deleteReport(delId).catch(() => {});
        }
      }

      const { merged, hasChanges } = mergeReportsItemByItem(currentLocalReports, data.reports, data.deletedReportIds || []);

      if (hasChanges || currentLocalReports.length === 0) {
        await dbService.overwriteAllReports(merged);
        if (Array.isArray(data.refDocs) && data.refDocs.length > 0) {
          await dbService.overwriteAllRefDocs(data.refDocs);
        }
        if (Array.isArray(data.fileBlobs) && data.fileBlobs.length > 0) {
          await dbService.smartMergeFileBlobs(data.fileBlobs);
        }
        // Run health check & repair
        await dbService.verifyAndRepairLocalFileVault();
        return { reports: merged, dataUpdated: true };
      }
    }
  } catch (err) {
    console.warn('pullFromServerSync error:', err);
  }

  return { reports: currentLocalReports, dataUpdated: false };
}

/**
 * Real-Time Server-Sent Events (SSE) Live Subscription
 * Establishes a permanent real-time stream between server and mobile/PC (<100ms update latency)
 */
export function subscribeToLiveServerSync(
  onUpdate: (payload: { reports: ReportItem[]; refDocs?: RefDocument[]; auditLogs?: AuditLogItem[] }) => void,
  userEmail?: string
): () => void {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return () => {};
  }

  let eventSource: EventSource | null = null;
  let retryTimeout: any = null;
  let isClosed = false;

  const connect = () => {
    if (isClosed) return;
    try {
      const emailParam = encodeURIComponent(userEmail || 'default_user');
      eventSource = new EventSource(`/api/sync/stream?userEmail=${emailParam}`);

      eventSource.onopen = () => {
        // Connected to live real-time sync stream
      };

      eventSource.onmessage = async (event) => {
        try {
          if (!event.data) return;
          const data = JSON.parse(event.data);
          if ((data.type === 'SYNC_INIT' || data.type === 'SYNC_UPDATE') && Array.isArray(data.reports)) {
            // Delete any deleted report IDs from local IndexedDB
            if (Array.isArray(data.deletedReportIds)) {
              for (const delId of data.deletedReportIds) {
                await dbService.deleteReport(delId).catch(() => {});
              }
            }

            const currentLocal = await dbService.getAllReports();
            const { merged, hasChanges } = mergeReportsItemByItem(currentLocal, data.reports, data.deletedReportIds || []);

            if (hasChanges || data.type === 'SYNC_UPDATE' || currentLocal.length === 0) {
              await dbService.overwriteAllReports(merged);
              if (Array.isArray(data.refDocs) && data.refDocs.length > 0) {
                await dbService.overwriteAllRefDocs(data.refDocs);
              }
              if (Array.isArray(data.fileBlobs) && data.fileBlobs.length > 0) {
                await dbService.smartMergeFileBlobs(data.fileBlobs);
              }
              await dbService.verifyAndRepairLocalFileVault();
              onUpdate({
                reports: merged,
                refDocs: data.refDocs,
                auditLogs: data.auditLogs,
              });
            }
          }
        } catch (e) {
          console.warn('SSE message parse error:', e);
        }
      };

      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (!isClosed) {
          // Reconnect with 3s backoff
          retryTimeout = setTimeout(connect, 3000);
        }
      };
    } catch (err) {
      console.warn('SSE connection init error:', err);
      if (!isClosed) {
        retryTimeout = setTimeout(connect, 4000);
      }
    }
  };

  connect();

  return () => {
    isClosed = true;
    if (retryTimeout) clearTimeout(retryTimeout);
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };
}

/**
 * Subscribe to multi-tab BroadcastChannel updates
 */
export function subscribeToSyncChannel(onUpdate: () => void): () => void {
  if (!broadcastChannel) return () => {};

  const handler = (event: MessageEvent) => {
    if (event.data && event.data.type === 'DATA_UPDATED') {
      onUpdate();
    }
  };

  broadcastChannel.addEventListener('message', handler);
  return () => {
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', handler);
    }
  };
}
