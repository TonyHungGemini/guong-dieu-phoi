export type ReportCategory = 'Báo cáo ngày' | 'Báo cáo tuần' | 'Báo cáo tháng' | 'Tài liệu khác';

export type RefDocCategory = 'Số liệu tài chính' | 'KPIs & Doanh số' | 'Hợp đồng & Văn bản' | 'Mẫu biểu & Hướng dẫn' | 'Tài liệu kỹ thuật' | 'Khác';

export interface RefDocument {
  id: string;
  title: string;
  category: RefDocCategory;
  description?: string;
  keyMetrics?: string; // Extracted key figures or data summary
  fileName?: string;
  fileSizeFormatted?: string;
  fileBlobId?: string;
  fileType?: string;
  externalUrl?: string;
  pinned?: boolean;
  tags?: string[];
  driveFileId?: string;
  webViewLink?: string;
  webContentLink?: string;
  createdAt: string;
  updatedAt: string;
}

export type ReportStatus = 'To-do' | 'In Progress' | 'Pending Review' | 'Done' | 'Sent';

export interface StoredFileBlob {
  id: string;
  name: string;
  size: number;
  type: string;
  blob?: Blob;
  base64Data?: string;
  reportId?: string;
  version?: number;
  updatedAt: string;
}

export interface GoogleUserProfile {
  id: string;
  name: string;
  email: string;
  picture: string;
  accessToken: string;
  expiresAt: number;
}

export type ReportFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface ReportItem {
  id: string;
  title: string;
  category: ReportCategory;
  project: string;
  date: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD (Manual or auto-calculated due date)
  frequency?: ReportFrequency; // 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  lastProcessedDate?: string; // ISO string when last auto-advanced
  reminderTime?: string; // HH:mm
  status: ReportStatus;
  path: string; // File path or URL convention
  fileName?: string;
  fileBlobId?: string; // Reference to IndexedDB stored blob
  fileSizeFormatted?: string;
  notes?: string;
  version: number;
  pinned: boolean;

  // Google Drive & Cloud Integration
  driveFileId?: string;
  webViewLink?: string;
  webContentLink?: string;
  pendingSync?: boolean;
  lastLocalBackupDate?: string; // ISO string of last local backup timestamp
  
  // Semi-Auto / One-Click Submission Settings
  agentEnabled: boolean;
  submissionUrl?: string; // e.g. https://base.vn/ or custom portal link
  zaloPhone?: string; // Approver's Zalo Phone Number (e.g. 0912345678)
  localMacPath?: string; // Local file path on Mac (e.g. /Users/YourName/Documents/BaoCao.xlsx)
  webhookUrl?: string;
  
  // AI Generated Insights
  aiSummary?: string;
  aiActionItems?: string[];
  aiQualityScore?: number;

  createdAt: string;
  updatedAt: string;
  lastSentAt?: string;
}

export interface AgentGlobalConfig {
  globalActive: boolean;
  senderName: string;
  senderEmail: string;
  zapierWebhookUrl: string;
  makeWebhookUrl: string;
  customNodeApiUrl: string;
  autoSendOnDone: boolean;
  notifyOnSent: boolean;
}

export interface AuditLogItem {
  id: string;
  reportId?: string;
  reportTitle?: string;
  action: 'CREATED' | 'UPDATED' | 'STATUS_CHANGE' | 'SUBMITTED' | 'AGENT_DISPATCH' | 'WEBHOOK_TRIGGERED' | 'AI_SUMMARY' | 'DELETED' | 'ACCESSED' | 'BACKUP_LOCAL';
  details: string;
  timestamp: string;
  status: 'success' | 'error' | 'info' | 'warning';
  payload?: any;
}

export interface ReportTemplate {
  id: string;
  title: string;
  category: ReportCategory;
  project: string;
  description: string;
  sampleContent: string;
  suggestedFilenameConvention: string;
}
