import { ReportItem, AgentGlobalConfig, AuditLogItem, StoredFileBlob, RefDocument, GoogleUserProfile } from '../types';

const DB_NAME = 'DocuReportAI_DB';
const DB_VERSION = 4;

const STORE_REPORTS = 'reports';
const STORE_BLOBS = 'file_blobs';
const STORE_VAULT = 'local_pc_file_vault';
const STORE_CONFIG = 'agent_config';
const STORE_LOGS = 'audit_logs';
const STORE_REF_DOCS = 'ref_docs';
const STORE_USER = 'user_profile';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB not supported or blocked in this context'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;

        if (!db.objectStoreNames.contains(STORE_REPORTS)) {
          const reportStore = db.createObjectStore(STORE_REPORTS, { keyPath: 'id' });
          reportStore.createIndex('category', 'category', { unique: false });
          reportStore.createIndex('status', 'status', { unique: false });
          reportStore.createIndex('date', 'date', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORE_BLOBS)) {
          db.createObjectStore(STORE_BLOBS, { keyPath: 'id' });
        }

        // Dedicated Local PC File Vault (Immutable & Protected from Cloud wipe)
        if (!db.objectStoreNames.contains(STORE_VAULT)) {
          const vaultStore = db.createObjectStore(STORE_VAULT, { keyPath: 'id' });
          vaultStore.createIndex('name', 'name', { unique: false });
          vaultStore.createIndex('reportId', 'reportId', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORE_CONFIG)) {
          db.createObjectStore(STORE_CONFIG, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(STORE_LOGS)) {
          const logStore = db.createObjectStore(STORE_LOGS, { keyPath: 'id' });
          logStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORE_REF_DOCS)) {
          const refStore = db.createObjectStore(STORE_REF_DOCS, { keyPath: 'id' });
          refStore.createIndex('category', 'category', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORE_USER)) {
          db.createObjectStore(STORE_USER, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
    } catch (e) {
      reject(e);
    }
  });
}

export const dbService = {
  // REPORTS CRUD
  async getAllReports(): Promise<ReportItem[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_REPORTS, 'readonly');
      const store = tx.objectStore(STORE_REPORTS);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async saveReport(report: ReportItem): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_REPORTS, 'readwrite');
      const store = tx.objectStore(STORE_REPORTS);
      const request = store.put(report);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async overwriteAllReports(reports: ReportItem[]): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_REPORTS, 'readwrite');
      const store = tx.objectStore(STORE_REPORTS);
      store.clear();
      reports.forEach((r) => store.put(r));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async deleteReport(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_REPORTS, STORE_BLOBS, STORE_VAULT], 'readwrite');
      const store = tx.objectStore(STORE_REPORTS);
      const blobStore = tx.objectStore(STORE_BLOBS);
      const vaultStore = tx.objectStore(STORE_VAULT);
      
      store.delete(id);
      blobStore.delete(id);
      vaultStore.delete(id);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  // FILE BLOBS & LOCAL PC FILE VAULT
  async saveFileBlob(fileBlob: StoredFileBlob): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_BLOBS, STORE_VAULT], 'readwrite');
      const store = tx.objectStore(STORE_BLOBS);
      const vault = tx.objectStore(STORE_VAULT);
      
      store.put(fileBlob);
      vault.put(fileBlob);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getFileBlob(id: string): Promise<StoredFileBlob | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_BLOBS, STORE_VAULT], 'readonly');
      const store = tx.objectStore(STORE_BLOBS);
      const request = store.get(id);
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result);
        } else {
          // Check local PC vault fallback
          const vault = tx.objectStore(STORE_VAULT);
          const vReq = vault.get(id);
          vReq.onsuccess = () => resolve(vReq.result || null);
          vReq.onerror = () => resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Robust multi-key search for file blobs: by ID, fileName, or reportId.
   * Checks both active Blob store and immutable Local PC File Vault.
   */
  async findFileBlobByNameOrId(id?: string, fileName?: string, reportId?: string): Promise<StoredFileBlob | null> {
    if (!id && !fileName && !reportId) return null;
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction([STORE_BLOBS, STORE_VAULT], 'readonly');
      const store = tx.objectStore(STORE_BLOBS);
      const vault = tx.objectStore(STORE_VAULT);

      const checkVault = () => {
        const vReq = vault.getAll();
        vReq.onsuccess = () => {
          const vaultItems: StoredFileBlob[] = vReq.result || [];
          // Search vault with highest priority on genuine binary blob
          const found = vaultItems.find((b) => 
            (id && b.id === id) ||
            (reportId && b.reportId === reportId) ||
            (fileName && b.name === fileName)
          );
          resolve(found || null);
        };
        vReq.onerror = () => resolve(null);
      };

      if (id) {
        const request = store.get(id);
        request.onsuccess = () => {
          if (request.result && (request.result.blob || request.result.base64Data)) {
            resolve(request.result);
            return;
          }
          // Fallback check all in store
          const allReq = store.getAll();
          allReq.onsuccess = () => {
            const all: StoredFileBlob[] = allReq.result || [];
            const found = all.find((b) => 
              (id && b.id === id) ||
              (reportId && b.reportId === reportId) ||
              (fileName && b.name === fileName)
            );
            if (found && (found.blob || found.base64Data)) {
              resolve(found);
            } else {
              checkVault();
            }
          };
          allReq.onerror = checkVault;
        };
        request.onerror = checkVault;
      } else {
        const allReq = store.getAll();
        allReq.onsuccess = () => {
          const all: StoredFileBlob[] = allReq.result || [];
          const found = all.find((b) => 
            (reportId && b.reportId === reportId) ||
            (fileName && b.name === fileName)
          );
          if (found && (found.blob || found.base64Data)) {
            resolve(found);
          } else {
            checkVault();
          }
        };
        allReq.onerror = checkVault;
      }
    });
  },

  async getAllFileBlobs(): Promise<StoredFileBlob[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_BLOBS, STORE_VAULT], 'readonly');
      const store = tx.objectStore(STORE_BLOBS);
      const request = store.getAll();
      request.onsuccess = () => {
        const storeBlobs: StoredFileBlob[] = request.result || [];
        const vault = tx.objectStore(STORE_VAULT);
        const vReq = vault.getAll();
        vReq.onsuccess = () => {
          const vaultBlobs: StoredFileBlob[] = vReq.result || [];
          const map = new Map<string, StoredFileBlob>();
          vaultBlobs.forEach(b => map.set(b.id, b));
          storeBlobs.forEach(b => {
            const existing = map.get(b.id);
            if (!existing || (!existing.blob && b.blob)) {
              map.set(b.id, b);
            }
          });
          resolve(Array.from(map.values()));
        };
        vReq.onerror = () => resolve(storeBlobs);
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Safe Non-Destructive Merge of File Blobs:
   * NEVER clears local binary Blobs with empty cloud stubs.
   */
  async smartMergeFileBlobs(incomingBlobs: StoredFileBlob[]): Promise<void> {
    if (!Array.isArray(incomingBlobs) || incomingBlobs.length === 0) return;
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_BLOBS, STORE_VAULT], 'readwrite');
      const store = tx.objectStore(STORE_BLOBS);
      const vault = tx.objectStore(STORE_VAULT);

      const existingReq = store.getAll();
      existingReq.onsuccess = () => {
        const existingList: StoredFileBlob[] = existingReq.result || [];
        const existingMap = new Map<string, StoredFileBlob>();
        existingList.forEach(b => existingMap.set(b.id, b));

        incomingBlobs.forEach(incoming => {
          const local = existingMap.get(incoming.id);
          if (!local) {
            store.put(incoming);
            if (incoming.blob || incoming.base64Data) {
              vault.put(incoming);
            }
          } else {
            // Keep local real Blob if incoming does not have binary data
            const mergedBlob: StoredFileBlob = {
              ...incoming,
              blob: local.blob || incoming.blob,
              base64Data: local.base64Data || incoming.base64Data,
              updatedAt: new Date(incoming.updatedAt || 0) > new Date(local.updatedAt || 0) 
                ? incoming.updatedAt 
                : local.updatedAt,
            };
            store.put(mergedBlob);
            if (mergedBlob.blob || mergedBlob.base64Data) {
              vault.put(mergedBlob);
            }
          }
        });
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async overwriteAllFileBlobs(fileBlobs: StoredFileBlob[]): Promise<void> {
    // Alias to safe non-destructive smart merge
    return this.smartMergeFileBlobs(fileBlobs);
  },

  /**
   * Health Check & Auto-Repair for Local File Vault:
   * Scans reports, identifies any reports with broken/missing file references,
   * matches them against the immutable Local PC Vault, and restores binary links.
   */
  async verifyAndRepairLocalFileVault(): Promise<{
    checkedCount: number;
    repairedCount: number;
    validCount: number;
  }> {
    const reports = await this.getAllReports();
    const blobs = await this.getAllFileBlobs();
    let repairedCount = 0;
    let validCount = 0;

    const blobMapById = new Map<string, StoredFileBlob>();
    const blobMapByName = new Map<string, StoredFileBlob>();

    blobs.forEach(b => {
      blobMapById.set(b.id, b);
      if (b.name) blobMapByName.set(b.name, b);
    });

    for (const report of reports) {
      let hasValidFile = false;
      if (report.fileBlobId && blobMapById.has(report.fileBlobId)) {
        const b = blobMapById.get(report.fileBlobId);
        if (b && (b.blob || b.base64Data)) {
          hasValidFile = true;
          validCount++;
        }
      }

      if (!hasValidFile && report.fileName && blobMapByName.has(report.fileName)) {
        const matchedBlob = blobMapByName.get(report.fileName);
        if (matchedBlob) {
          // Re-link report to valid local blob
          const fixedReport: ReportItem = {
            ...report,
            fileBlobId: matchedBlob.id,
            updatedAt: new Date().toISOString()
          };
          await this.saveReport(fixedReport);
          repairedCount++;
          validCount++;
          hasValidFile = true;
        }
      }
    }

    return {
      checkedCount: reports.length,
      repairedCount,
      validCount
    };
  },

  // GLOBAL AGENT CONFIG
  async getAgentConfig(): Promise<AgentGlobalConfig> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CONFIG, 'readonly');
      const store = tx.objectStore(STORE_CONFIG);
      const request = store.get('global_agent_config');
      request.onsuccess = () => {
        const defaultVal: AgentGlobalConfig = {
          globalActive: true,
          senderName: 'DocuReport Auto-Agent',
          senderEmail: 'agent@docureport.local',
          zapierWebhookUrl: 'https://hooks.zapier.com/hooks/catch/sample',
          makeWebhookUrl: 'https://hook.eu1.make.com/sample',
          customNodeApiUrl: '/api/agent/send',
          autoSendOnDone: true,
          notifyOnSent: true,
        };
        resolve(request.result ? { ...defaultVal, ...request.result } : defaultVal);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async saveAgentConfig(config: AgentGlobalConfig): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CONFIG, 'readwrite');
      const store = tx.objectStore(STORE_CONFIG);
      const request = store.put({ id: 'global_agent_config', ...config });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  // AUDIT LOGS
  async addAuditLog(log: Omit<AuditLogItem, 'id'>): Promise<void> {
    const db = await openDB();
    const newLog: AuditLogItem = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      ...log
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_LOGS, 'readwrite');
      const store = tx.objectStore(STORE_LOGS);
      const request = store.add(newLog);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async getAuditLogs(): Promise<AuditLogItem[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_LOGS, 'readonly');
      const store = tx.objectStore(STORE_LOGS);
      const request = store.getAll();
      request.onsuccess = () => {
        const logs = request.result || [];
        logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        resolve(logs);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async clearAuditLogs(): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_LOGS, 'readwrite');
      const store = tx.objectStore(STORE_LOGS);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  // REFERENCE DOCUMENTS (TÀI LIỆU LIÊN QUAN / TRUY CẬP TRUY XUẤT NHANH)
  async getAllRefDocs(): Promise<RefDocument[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_REF_DOCS, 'readonly');
      const store = tx.objectStore(STORE_REF_DOCS);
      const request = store.getAll();
      request.onsuccess = () => {
        const list: RefDocument[] = request.result || [];
        list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        resolve(list);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async saveRefDoc(doc: RefDocument): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_REF_DOCS, 'readwrite');
      const store = tx.objectStore(STORE_REF_DOCS);
      const request = store.put(doc);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async overwriteAllRefDocs(docs: RefDocument[]): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_REF_DOCS, 'readwrite');
      const store = tx.objectStore(STORE_REF_DOCS);
      store.clear();
      docs.forEach((d) => store.put(d));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async deleteRefDoc(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_REF_DOCS, STORE_BLOBS], 'readwrite');
      const store = tx.objectStore(STORE_REF_DOCS);
      const blobStore = tx.objectStore(STORE_BLOBS);
      store.delete(id);
      blobStore.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  // GOOGLE USER PROFILE & AUTH TOKENS
  async getUserProfile(): Promise<GoogleUserProfile | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_USER, 'readonly');
      const store = tx.objectStore(STORE_USER);
      const request = store.get('current_user');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },

  async saveUserProfile(profile: GoogleUserProfile): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_USER, 'readwrite');
      const store = tx.objectStore(STORE_USER);
      const request = store.put({ id: 'current_user', ...profile });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async clearUserProfile(): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_USER, 'readwrite');
      const store = tx.objectStore(STORE_USER);
      const request = store.delete('current_user');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
};
