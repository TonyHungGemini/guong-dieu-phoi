import { GoogleUserProfile, ReportItem, RefDocument, AuditLogItem, StoredFileBlob } from '../types';
import { dbService } from './db';
import firebaseConfig from '../../firebase-applet-config.json';

export interface CloudSyncData {
  app: string;
  version: number;
  lastUpdated: string;
  reports: ReportItem[];
  refDocs: RefDocument[];
  auditLogs: AuditLogItem[];
  fileBlobs?: StoredFileBlob[];
}

// Helper for fetch with strict timeout to prevent indefinite spinning
export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 7000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error(`Quá thời gian kết nối (${Math.round(timeoutMs / 1000)}s).`);
    }
    throw error;
  }
}

// Fast Chunked Uint8Array to Base64 (zero UI freeze even for 10MB files)
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000; // 32KB chunks
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as any);
  }
  return btoa(binary);
}

// Use provisioned OAuth Client ID from firebase-applet-config.json
export const GOOGLE_CLIENT_ID = (firebaseConfig as any).oAuthClientId || '80167301652-dpfgs2regia45ul3nij8klfrchbpe4gj.apps.googleusercontent.com';

const CLIENT_ID_KEY = 'docureport_google_client_id';

export function getActiveClientId(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(CLIENT_ID_KEY);
    if (saved && saved.trim() !== '' && saved !== 'YOUR_GOOGLE_CLIENT_ID_HERE') return saved.trim();
  }
  return GOOGLE_CLIENT_ID;
}

export function isPlaceholderClientId(clientId?: string): boolean {
  const id = clientId || getActiveClientId();
  if (!id || id.trim() === '' || id.includes('YOUR_GOOGLE_CLIENT_ID') || !id.includes('.apps.googleusercontent.com')) {
    return true;
  }
  return false;
}

export function saveActiveClientId(clientId: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(CLIENT_ID_KEY, clientId);
  }
}

const USER_PROFILE_KEY = 'docureport_user_profile';

export async function saveStoredUserProfile(profile: GoogleUserProfile): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
  }
  await dbService.saveUserProfile(profile);
}

export async function getStoredUserProfile(): Promise<GoogleUserProfile | null> {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.email || parsed.name)) {
          return parsed;
        }
      } catch (e) {
        console.warn('Error reading user profile from localStorage:', e);
      }
    }
  }
  return await dbService.getUserProfile();
}

export async function clearStoredUserProfile(): Promise<void> {
  const currentProfile = await getStoredUserProfile();
  if (typeof window !== 'undefined') {
    localStorage.removeItem(USER_PROFILE_KEY);
  }
  await dbService.clearUserProfile();

  // Revoke token if available
  if (currentProfile?.accessToken && typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2?.revoke) {
    try {
      (window as any).google.accounts.oauth2.revoke(currentProfile.accessToken, () => {
        // Token revoked cleanly
      });
    } catch (e) {
      console.warn('Token revocation notice:', e);
    }
  }
}

export async function restoreUserSession(): Promise<GoogleUserProfile | null> {
  const profile = await getStoredUserProfile();
  if (!profile) return null;

  // Clean up stale or invalid Firebase JWT tokens (which start with 'eyJ')
  if (profile.accessToken && profile.accessToken.startsWith('eyJ')) {
    profile.accessToken = '';
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
  }

  return profile;
}

/**
 * Initiates Google OAuth Sign-In using Google Identity Services (GIS)
 * Supports ANY Gmail / Google Workspace account worldwide.
 * Includes 'prompt: select_account' so users can choose or switch to any Gmail account.
 */
export async function requestGoogleSignIn(customClientId?: string): Promise<GoogleUserProfile> {
  const activeClientId = customClientId || getActiveClientId();

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Môi trường trình duyệt là bắt buộc để đăng nhập Google'));
      return;
    }

    const scope = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

    // Helper to request token via GIS
    const triggerGIS = () => {
      try {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: activeClientId,
          scope: scope,
          prompt: 'select_account',
          callback: async (response: any) => {
            if (response.error) {
              if (response.error === 'access_denied') {
                reject(new Error('Bạn đã hủy hoặc đóng cửa sổ đăng nhập Google.'));
              } else {
                reject(new Error(response.error_description || response.error));
              }
              return;
            }
            try {
              const accessToken = response.access_token;
              const expiresIn = response.expires_in || 3600;
              const profile = await fetchGoogleUserProfile(accessToken, expiresIn);
              await saveStoredUserProfile(profile);
              resolve(profile);
            } catch (err) {
              reject(err);
            }
          },
          error_callback: (nonOAuthErr: any) => {
            console.warn('GIS error_callback:', nonOAuthErr);
            if (nonOAuthErr?.type === 'popup_closed') {
              reject(new Error('Bạn đã đóng cửa sổ đăng nhập Google.'));
            } else {
              reject(new Error(nonOAuthErr?.message || 'Lỗi khi mở cửa sổ đăng nhập Google.'));
            }
          }
        });
        client.requestAccessToken();
      } catch (e: any) {
        console.error('GIS initTokenClient error:', e);
        reject(new Error(e.message || 'Không thể khởi tạo dịch vụ đăng nhập Google.'));
      }
    };

    if ((window as any).google?.accounts?.oauth2) {
      triggerGIS();
    } else {
      // Wait up to 3 seconds for GIS script to finish loading
      let checkCount = 0;
      const checkInterval = setInterval(() => {
        checkCount++;
        if ((window as any).google?.accounts?.oauth2) {
          clearInterval(checkInterval);
          triggerGIS();
        } else if (checkCount >= 30) {
          clearInterval(checkInterval);
          reject(new Error('Thư viện Google Identity Services chưa tải xong. Vui lòng kiểm tra kết nối mạng và thử lại sau 2 giây.'));
        }
      }, 100);
    }
  });
}

/**
 * Fetches User Info from Google OAuth2 Userinfo API
 */
export async function fetchGoogleUserProfile(accessToken: string, expiresInSeconds: number = 3600): Promise<GoogleUserProfile> {
  const res = await fetchWithTimeout('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  }, 6000);

  if (!res.ok) {
    throw new Error('Failed to fetch Google User Profile');
  }

  const data = await res.json();

  return {
    id: data.id || 'google-user-' + Date.now(),
    name: data.name || data.email?.split('@')[0] || 'Google User',
    email: data.email || 'user@gmail.com',
    picture: data.picture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    accessToken,
    expiresAt: Date.now() + (expiresInSeconds * 1000),
  };
}

/**
 * Searches for or creates a folder named PWA_Report_Manager in the user's Google Drive.
 */
export async function getOrCreateAppFolder(accessToken: string, folderName = 'PWA_Report_Manager'): Promise<string> {
  // Search for folder
  const query = encodeURIComponent(`name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const searchRes = await fetchWithTimeout(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }, 7000);

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }
  }

  // Folder does not exist, create it
  const createRes = await fetchWithTimeout('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  }, 7000);

  if (!createRes.ok) {
    throw new Error('Failed to create folder on Google Drive');
  }

  const newFolder = await createRes.json();
  return newFolder.id;
}

/**
 * Uploads a file directly to PWA_Report_Manager folder on Google Drive using Drive API v3.
 * Returns fileId, webViewLink, webContentLink.
 */
export async function uploadFileToDrive(
  accessToken: string,
  file: File | Blob,
  fileName: string,
  mimeType: string = 'application/octet-stream'
): Promise<{ fileId: string; webViewLink: string; webContentLink: string }> {
  // 1. Get or create folder
  const folderId = await getOrCreateAppFolder(accessToken);

  // 2. Prepare Multipart Upload Body
  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  const metadata = {
    name: fileName,
    mimeType: mimeType || 'application/octet-stream',
    parents: [folderId],
  };

  const fileArrayBuffer = await file.arrayBuffer();

  // Construct multipart body
  const metaPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
  const fileHeader = `${delimiter}Content-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n`;

  // Convert array buffer to base64 using fast chunking (prevents UI freeze)
  const bytes = new Uint8Array(fileArrayBuffer);
  const base64Data = uint8ArrayToBase64(bytes);

  const requestBody = metaPart + fileHeader + base64Data + close_delim;

  const uploadRes = await fetchWithTimeout(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: requestBody,
    },
    15000
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Google Drive Upload Error: ${errText}`);
  }

  const uploadedData = await uploadRes.json();
  const fileId = uploadedData.id;

  // Make file publicly readable for webContentLink/webViewLink to work seamlessly
  try {
    await fetchWithTimeout(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    }, 4000);
  } catch (e) {
    console.warn('Could not set permissions for file:', e);
  }

  // Fallback links if not returned
  const webViewLink = uploadedData.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
  const webContentLink = uploadedData.webContentLink || `https://drive.google.com/uc?id=${fileId}&export=download`;

  return {
    fileId,
    webViewLink,
    webContentLink,
  };
}

/**
 * Downloads a file from Google Drive by fileId as a native Blob
 */
export async function fetchDriveFileBlob(
  accessToken: string,
  fileId: string
): Promise<{ blob: Blob; mimeType: string } | null> {
  try {
    const res = await fetchWithTimeout(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      8000
    );

    if (!res.ok) {
      console.warn(`Drive download failed for ${fileId}:`, res.status);
      return null;
    }

    const mimeType = res.headers.get('Content-Type') || 'application/octet-stream';
    const blob = await res.blob();
    return { blob, mimeType };
  } catch (err) {
    console.warn(`Error fetching Drive file ${fileId}:`, err);
    return null;
  }
}

/**
 * Auto-Syncs reports that were saved offline (pendingSync = true).
 */
export async function syncPendingDriveUploads(
  reports: ReportItem[],
  accessToken: string,
  onUpdateReport: (updated: ReportItem) => Promise<void>
): Promise<number> {
  let syncedCount = 0;
  const pending = reports.filter((r) => r.pendingSync);

  for (const report of pending) {
    try {
      let blobToUpload: Blob | null = null;
      let fileName = report.fileName || `${report.title.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`;
      let mimeType = 'application/pdf';

      if (report.fileBlobId) {
        const storedBlobRecord = await dbService.getFileBlob(report.fileBlobId);
        if (storedBlobRecord) {
          if (storedBlobRecord.blob) {
            blobToUpload = storedBlobRecord.blob;
          } else if (storedBlobRecord.base64Data) {
            // Reconstruct Blob from Base64
            try {
              const byteCharacters = atob(storedBlobRecord.base64Data);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              blobToUpload = new Blob([byteArray], { type: storedBlobRecord.type || 'application/octet-stream' });
            } catch (e) {
              console.warn('Could not decode base64Data for blob:', e);
            }
          }
          if (storedBlobRecord.name) fileName = storedBlobRecord.name;
          if (storedBlobRecord.type) mimeType = storedBlobRecord.type;
        }
      }

      // If there was no file uploaded, or file blob is missing, generate a clean report text/manifest blob so Google Drive has a copy of the report
      if (!blobToUpload) {
        const content = `BÁO CÁO: ${report.title}\n` +
          `Danh mục: ${report.category}\n` +
          `Dự án: ${report.project}\n` +
          `Ngày: ${report.date}\n` +
          `Trạng thái: ${report.status}\n` +
          `Ghi chú: ${report.notes || 'Không có ghi chú'}\n` +
          `Tạo lúc: ${report.createdAt}\n` +
          `Cập nhật: ${report.updatedAt}\n`;
        blobToUpload = new Blob([content], { type: 'text/plain;charset=utf-8' });
        if (!fileName.includes('.')) fileName += '.txt';
        mimeType = 'text/plain';
      }

      const { fileId, webViewLink, webContentLink } = await uploadFileToDrive(
        accessToken,
        blobToUpload,
        fileName,
        mimeType
      );

      const updatedReport: ReportItem = {
        ...report,
        driveFileId: fileId,
        webViewLink,
        webContentLink,
        pendingSync: false,
        updatedAt: new Date().toISOString(),
      };

      await onUpdateReport(updatedReport);
      syncedCount++;
    } catch (err: any) {
      console.error(`Failed to sync pending report ${report.id}:`, err);
      // If token expired / auth failure, propagate so caller can refresh token
      if (err?.message?.includes('401') || err?.message?.includes('403') || err?.message?.includes('AUTH_ERROR') || err?.message?.includes('invalid_grant')) {
        throw err;
      }
      // If non-auth error (e.g. invalid file), safely clear pendingSync to prevent forever stuck badge
      const resolvedReport: ReportItem = {
        ...report,
        pendingSync: false,
        updatedAt: new Date().toISOString(),
      };
      await onUpdateReport(resolvedReport);
    }
  }

  return syncedCount;
}

/**
 * Uploads/Overwrites bee_report_data.json in Google Drive appDataFolder.
 */
export async function syncToCloud(accessToken: string): Promise<{ success: boolean; lastUpdated: string }> {
  try {
    const reports = await dbService.getAllReports();
    const refDocs = await dbService.getAllRefDocs();
    const auditLogs = await dbService.getAuditLogs();
    const fileBlobs = await dbService.getAllFileBlobs();

    // Compact fileBlobs to prevent huge payloads (> 500KB) from causing timeouts
    const compactBlobs = fileBlobs.map(b => ({
      id: b.id,
      name: b.name,
      size: b.size,
      type: b.type,
      updatedAt: b.updatedAt,
      // Only keep base64 data for small files (< 300KB)
      base64Data: (b.base64Data && b.base64Data.length < 400000) ? b.base64Data : undefined,
    }));

    const lastUpdated = new Date().toISOString();
    const payload: CloudSyncData = {
      app: 'bee_report_manager',
      version: 1,
      lastUpdated,
      reports,
      refDocs,
      auditLogs,
      fileBlobs: compactBlobs,
    };

    const jsonString = JSON.stringify(payload);

    // 1. Search for existing bee_report_data.json in appDataFolder
    const searchRes = await fetchWithTimeout(
      "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D%27bee_report_data.json%27%20and%20trashed%3Dfalse&fields=files(id,name)",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      6000
    );

    if (searchRes.status === 401 || searchRes.status === 403) {
      throw new Error('AUTH_ERROR: Google OAuth access token invalid or expired (401/403)');
    }

    let existingFileId: string | null = null;
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        existingFileId = searchData.files[0].id;
      }
    }

    if (existingFileId) {
      // Overwrite file content via PATCH uploadType=media
      const updateRes = await fetchWithTimeout(
        `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: jsonString,
        },
        8000
      );
      if (!updateRes.ok) {
        const errText = await updateRes.text();
        if (updateRes.status === 401 || updateRes.status === 403) {
          throw new Error(`AUTH_ERROR: ${errText}`);
        }
        throw new Error(`Cloud update error: ${errText}`);
      }
    } else {
      // Create new file in appDataFolder
      const boundary = '-------314159265358979323846';
      const delimiter = "\r\n--" + boundary + "\r\n";
      const close_delim = "\r\n--" + boundary + "--";

      const metadata = {
        name: 'bee_report_data.json',
        parents: ['appDataFolder'],
        mimeType: 'application/json',
      };

      const metaPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
      const fileHeader = `${delimiter}Content-Type: application/json\r\n\r\n`;
      const requestBody = metaPart + fileHeader + jsonString + close_delim;

      const createRes = await fetchWithTimeout(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: requestBody,
        },
        8000
      );

      if (!createRes.ok) {
        const errText = await createRes.text();
        if (createRes.status === 401 || createRes.status === 403) {
          throw new Error(`AUTH_ERROR: ${errText}`);
        }
        throw new Error(`Cloud create error: ${errText}`);
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('docureport_last_cloud_sync', lastUpdated);
    }

    return { success: true, lastUpdated };
  } catch (err) {
    console.error('syncToCloud error:', err);
    throw err;
  }
}

/**
 * Downloads bee_report_data.json from appDataFolder and performs Last Write Wins comparison.
 */
export async function syncFromCloud(accessToken: string): Promise<{
  synced: boolean;
  reportsCount: number;
  dataUpdated: boolean;
  reports?: ReportItem[];
  refDocs?: RefDocument[];
  auditLogs?: AuditLogItem[];
}> {
  try {
    // 1. Search for file in appDataFolder
    const searchRes = await fetchWithTimeout(
      "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D%27bee_report_data.json%27%20and%20trashed%3Dfalse&fields=files(id,name,modifiedTime)",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      6000
    );

    if (!searchRes.ok) {
      if (searchRes.status === 401 || searchRes.status === 403) {
        throw new Error('AUTH_ERROR: Google OAuth access token invalid or expired (401/403)');
      }
      throw new Error('Failed to query Google Drive appDataFolder');
    }

    const searchData = await searchRes.json();
    if (!searchData.files || searchData.files.length === 0) {
      // No cloud file exists -> upload local data to Cloud in background
      syncToCloud(accessToken).catch(e => console.warn('Background initial cloud upload:', e));
      return { synced: true, reportsCount: 0, dataUpdated: false };
    }

    const fileId = searchData.files[0].id;

    // 2. Download file content
    const downloadRes = await fetchWithTimeout(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      7000
    );

    if (!downloadRes.ok) {
      if (downloadRes.status === 401 || downloadRes.status === 403) {
        throw new Error('AUTH_ERROR: Google OAuth access token invalid or expired (401/403)');
      }
      throw new Error('Failed to download cloud sync data from Google Drive');
    }

    const cloudPayload: CloudSyncData = await downloadRes.json();
    const localReports = await dbService.getAllReports();

    // 3. Item-level smart merge between local and cloud reports
    const cloudReports = Array.isArray(cloudPayload.reports) ? cloudPayload.reports : [];
    const reportMap = new Map<string, ReportItem>();

    localReports.forEach((r) => reportMap.set(r.id, r));

    let dataHasChanged = false;
    cloudReports.forEach((remoteRep) => {
      const localRep = reportMap.get(remoteRep.id);
      if (!localRep) {
        reportMap.set(remoteRep.id, remoteRep);
        dataHasChanged = true;
      } else {
        const localTime = new Date(localRep.updatedAt || localRep.date || 0).getTime();
        const remoteTime = new Date(remoteRep.updatedAt || remoteRep.date || 0).getTime();

        if (remoteTime > localTime) {
          reportMap.set(remoteRep.id, remoteRep);
          dataHasChanged = true;
        } else if (remoteTime === localTime) {
          const isRemoteDone = remoteRep.status === 'Done' || remoteRep.status === 'Sent';
          const isLocalDone = localRep.status === 'Done' || localRep.status === 'Sent';
          if (isRemoteDone && !isLocalDone) {
            reportMap.set(remoteRep.id, remoteRep);
            dataHasChanged = true;
          }
        }
      }
    });

    const mergedReports = Array.from(reportMap.values());

    // Save merged result to local DB
    await dbService.overwriteAllReports(mergedReports);

    if (Array.isArray(cloudPayload.refDocs) && cloudPayload.refDocs.length > 0) {
      await dbService.overwriteAllRefDocs(cloudPayload.refDocs);
    }
    if (Array.isArray(cloudPayload.fileBlobs) && cloudPayload.fileBlobs.length > 0) {
      await dbService.smartMergeFileBlobs(cloudPayload.fileBlobs);
    }

    // Auto-verify and repair local file associations
    await dbService.verifyAndRepairLocalFileVault();

    const lastUpdatedIso = new Date().toISOString();
    if (typeof window !== 'undefined') {
      localStorage.setItem('docureport_last_cloud_sync', lastUpdatedIso);
    }

    // Push merged consensus back to cloud non-blockingly
    syncToCloud(accessToken).catch(e => console.warn('Non-blocking cloud push error:', e));

    return {
      synced: true,
      reportsCount: mergedReports.length,
      dataUpdated: true,
      reports: mergedReports,
      refDocs: cloudPayload.refDocs || [],
      auditLogs: cloudPayload.auditLogs || [],
    };
  } catch (err) {
    console.error('syncFromCloud error:', err);
    throw err;
  }
}
