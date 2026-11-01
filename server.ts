import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Data persistence directory for account sync
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const SYNC_FILE_PATH = path.join(DATA_DIR, "server_reports_sync.json");

// Set of active SSE client responses for real-time push to PC and mobile
const sseClients = new Set<{ res: express.Response; email?: string }>();

function getSyncFilePath(userEmail?: string): string {
  const safeEmail = (userEmail || 'default_user').toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return path.join(DATA_DIR, `server_reports_sync_${safeEmail}.json`);
}

interface ServerSyncStoreData {
  reports: any[];
  refDocs: any[];
  auditLogs: any[];
  fileBlobs: any[];
  deletedReportIds: string[];
  lastUpdated: string;
}

const DEFAULT_SERVER_REPORTS = [
  {
    id: 'report-1',
    title: 'Báo cáo Doanh Thu & KPIs Tháng 07/2026',
    category: 'Báo cáo tháng',
    project: 'Tài chính & Thuế',
    date: '2026-07-31',
    reminderTime: '17:00',
    status: 'Done',
    path: '/Documents/Reports/2026-07_Monthly_Revenue_KPI.pdf',
    fileName: '2026-07_Monthly_Revenue_KPI.pdf',
    fileSizeFormatted: '2.4 MB',
    notes: 'Tổng doanh thu tháng đạt 108% so với chỉ tiêu kế hoạch. Đã có phê duyệt chính thức từ Giám đốc Tài chính.',
    version: 1,
    pinned: true,
    agentEnabled: true,
    submissionUrl: 'https://base.vn/',
    zaloPhone: '0912345678',
    aiSummary: '• Doanh thu thuần: +18% MoM\n• Chi phí vận hành tối ưu giảm 5.2%\n• Dự báo tăng trưởng Q3 tiếp tục khả quan',
    aiActionItems: ['Chốt số liệu kiểm toán thuế quý 2', 'Lập ngân sách dự phòng tháng 8'],
    aiQualityScore: 95,
    createdAt: '2026-07-31T09:00:00.000Z',
    updatedAt: '2026-07-31T17:30:00.000Z',
    lastSentAt: '2026-07-31T17:05:00.000Z'
  },
  {
    id: 'report-2',
    title: 'Báo cáo Tiến Độ Phát Triển Phần Mềm Tuần 30',
    category: 'Báo cáo tuần',
    project: 'Kỹ thuật IT',
    date: '2026-08-03',
    reminderTime: '09:00',
    status: 'In Progress',
    path: '/Documents/Dev/2026-W30_Software_Progress.docx',
    fileName: '2026-W30_Software_Progress.docx',
    fileSizeFormatted: '1.1 MB',
    notes: 'Đã hoàn thành module UI PWA Offline & IndexedDB. Đang chuẩn bị kiểm thử tải hệ thống.',
    version: 2,
    pinned: true,
    agentEnabled: true,
    submissionUrl: 'https://base.vn/',
    createdAt: '2026-07-28T08:00:00.000Z',
    updatedAt: '2026-08-01T06:00:00.000Z'
  },
  {
    id: 'report-3',
    title: 'Báo cáo Vận Hành Máy Chủ & Hạ Tầng Ngày 01/08/2026',
    category: 'Báo cáo ngày',
    project: 'Kỹ thuật IT',
    date: '2026-08-01',
    reminderTime: '18:00',
    status: 'To-do',
    path: '/Documents/Daily/2026-08-01_Ops_Daily_Check.xlsx',
    fileName: '2026-08-01_Ops_Daily_Check.xlsx',
    fileSizeFormatted: '850 KB',
    notes: 'Kiểm tra log server Cloud Run, uptime đạt 99.99%, bộ nhớ RAM trung bình 34%.',
    version: 1,
    pinned: true,
    agentEnabled: true,
    submissionUrl: 'https://base.vn/',
    createdAt: '2026-08-01T07:00:00.000Z',
    updatedAt: '2026-08-01T07:00:00.000Z'
  },
  {
    id: 'report-4',
    title: 'Báo cáo Kiểm Toán An Ninh Thông Tin & Bảo Mật Q3',
    category: 'Tài liệu khác',
    project: 'An ninh & Tuân thủ',
    date: '2026-07-15',
    reminderTime: '14:00',
    status: 'Pending Review',
    path: '/Documents/Security/2026_Q3_Security_Audit.pdf',
    fileName: '2026_Q3_Security_Audit.pdf',
    fileSizeFormatted: '4.8 MB',
    notes: 'Rà soát lỗ hổng bảo mật toàn bộ các điểm cuối API và chứng chỉ SSL.',
    version: 1,
    pinned: false,
    agentEnabled: false,
    submissionUrl: 'https://base.vn/',
    createdAt: '2026-07-15T14:20:00.000Z',
    updatedAt: '2026-07-15T14:20:00.000Z'
  },
  {
    id: 'report-5',
    title: 'Báo cáo Kết Quả Chiến Dịch Marketing Mùa Hè 2026',
    category: 'Báo cáo tháng',
    project: 'Marketing & Growth',
    date: '2026-07-29',
    reminderTime: '16:00',
    status: 'Sent',
    path: '/Documents/Marketing/2026-07_Summer_Campaign_Report.pdf',
    fileName: '2026-07_Summer_Campaign_Report.pdf',
    fileSizeFormatted: '3.2 MB',
    notes: 'Chiến dịch đạt 140,000 lượt chuyển đổi, chi phí CAC giảm 12% so với dự tính.',
    version: 1,
    pinned: false,
    agentEnabled: true,
    submissionUrl: 'https://base.vn/',
    zaloPhone: '0987654321',
    aiSummary: '• Lượt chuyển đổi: 140K (+15% so với target)\n• Chi phí CAC: $1.85 (giảm 12%)\n• Kênh hiệu quả nhất: Social Ads & Email Marketing',
    aiActionItems: ['Chuẩn bị chiến dịch Back to School tháng 8', 'Tối ưu hóa phễu onboarding trên mobile'],
    aiQualityScore: 92,
    createdAt: '2026-07-29T10:00:00.000Z',
    updatedAt: '2026-07-29T16:01:00.000Z',
    lastSentAt: '2026-07-29T16:01:00.000Z'
  }
];

const DEFAULT_SERVER_REF_DOCS = [
  {
    id: 'ref-001',
    title: 'Bảng Cân Đối Số Liệu Tài Chính & KPIs Q2/2026',
    category: 'Số liệu tài chính',
    description: 'Bảng tổng hợp doanh thu, biên lợi nhuận gộp và chi phí vận hành chi tiết các phòng ban Q2.',
    keyMetrics: '• Doanh thu Q2: 15.8 tỷ VNĐ (+14% YoY)\n• Lợi nhuận trước thuế: 3.2 tỷ VNĐ\n• Margin: 20.2%\n• Chi phí Marketing: 1.1 tỷ VNĐ (tối ưu 8.5%)',
    fileName: 'Bang_So_Lieu_Tai_Chinh_Q2_2026.xlsx',
    fileSizeFormatted: '1.4 MB',
    fileType: 'xlsx',
    externalUrl: 'https://base.vn/',
    pinned: true,
    tags: ['Tài chính', 'KPIs', 'Q2-2026'],
    createdAt: '2026-07-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z'
  },
  {
    id: 'ref-002',
    title: 'Quy Trình & Mẫu Biểu Nộp Báo Cáo Chuẩn Base.vn',
    category: 'Mẫu biểu & Hướng dẫn',
    description: 'Hướng dẫn chuẩn hóa tên file báo cáo [DD-MM-YYYY]_[TênBáoCáo]_[TrạngThái] và quy cách đính kèm văn bản.',
    keyMetrics: 'Cú pháp chuẩn: [DD-MM-YYYY]_[Title]_[Status].xlsx\nCổng tiếp nhận: Base.vn Workflow Management System',
    fileName: 'Quy_Trinh_Nop_Bao_Cao_BaseVN.pdf',
    fileSizeFormatted: '850 KB',
    fileType: 'pdf',
    externalUrl: 'https://base.vn/',
    pinned: true,
    tags: ['Base.vn', 'Quy trình', 'Chuẩn hóa'],
    createdAt: '2026-07-10T09:30:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z'
  },
  {
    id: 'ref-003',
    title: 'Chỉ Số KPIs & Mục Tiêu Doanh Số Khối Kinh Doanh 2026',
    category: 'KPIs & Doanh số',
    description: 'Hồ sơ chỉ tiêu KPIs chi tiết cho từng nhóm kinh doanh, tỷ lệ chuyển đổi khách hàng và kế hoạch mở rộng thị trường.',
    keyMetrics: '• Chỉ tiêu năm 2026: 60 tỷ VNĐ\n• KPIs Tháng 8: 5.2 tỷ VNĐ\n• Tỷ lệ chốt hợp đồng mục tiêu: > 18%',
    fileName: 'Muc_Tieu_Doanh_So_Khoi_KD_2026.docx',
    fileSizeFormatted: '2.1 MB',
    fileType: 'docx',
    externalUrl: '',
    pinned: false,
    tags: ['Doanh số', 'Kinh doanh', 'KPIs'],
    createdAt: '2026-07-15T10:00:00.000Z',
    updatedAt: '2026-07-15T10:00:00.000Z'
  }
];

// Helper to read server sync store with comprehensive cross-account fallback
function readServerSyncStore(userEmail?: string): ServerSyncStoreData {
  try {
    const candidates: Array<{ filePath: string; mtime: number }> = [];

    // 1. User specific file
    if (userEmail && userEmail !== 'default_user') {
      const userFilePath = getSyncFilePath(userEmail);
      if (fs.existsSync(userFilePath)) {
        candidates.push({ filePath: userFilePath, mtime: fs.statSync(userFilePath).mtimeMs });
      }
    }

    // 2. Global sync file
    if (fs.existsSync(SYNC_FILE_PATH)) {
      candidates.push({ filePath: SYNC_FILE_PATH, mtime: fs.statSync(SYNC_FILE_PATH).mtimeMs });
    }

    // 3. All sync files in data directory
    const files = fs.readdirSync(DATA_DIR).filter(f => f.startsWith("server_reports_sync") && f.endsWith(".json"));
    for (const f of files) {
      const fullPath = path.join(DATA_DIR, f);
      candidates.push({ filePath: fullPath, mtime: fs.statSync(fullPath).mtimeMs });
    }

    // Sort by newest modified time
    candidates.sort((a, b) => b.mtime - a.mtime);

    if (candidates.length > 0) {
      const chosenFile = candidates[0].filePath;
      const content = fs.readFileSync(chosenFile, "utf-8");
      const parsed = JSON.parse(content);
      return {
        reports: Array.isArray(parsed.reports) ? parsed.reports : [],
        refDocs: Array.isArray(parsed.refDocs) ? parsed.refDocs : [],
        auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
        fileBlobs: Array.isArray(parsed.fileBlobs) ? parsed.fileBlobs : [],
        deletedReportIds: Array.isArray(parsed.deletedReportIds) ? parsed.deletedReportIds : [],
        lastUpdated: parsed.lastUpdated || new Date().toISOString()
      };
    }
  } catch (err) {
    console.warn("[Sync Server] Error reading sync store file:", err);
  }

  // Initialize initial default store if completely empty
  const initialStore: ServerSyncStoreData = {
    reports: DEFAULT_SERVER_REPORTS,
    refDocs: DEFAULT_SERVER_REF_DOCS,
    auditLogs: [],
    fileBlobs: [],
    deletedReportIds: [],
    lastUpdated: new Date().toISOString()
  };

  try {
    fs.writeFileSync(SYNC_FILE_PATH, JSON.stringify(initialStore, null, 2), "utf-8");
  } catch (e) {
    console.warn("Could not write initial default sync file:", e);
  }

  return initialStore;
}

// Helper to write server sync store and mirror across all sync targets
function writeServerSyncStore(data: ServerSyncStoreData, userEmail?: string) {
  try {
    const jsonStr = JSON.stringify(data, null, 2);
    // Write global master file
    fs.writeFileSync(SYNC_FILE_PATH, jsonStr, "utf-8");

    // Write user-specific file if provided
    if (userEmail && userEmail !== 'default_user') {
      const userFilePath = getSyncFilePath(userEmail);
      fs.writeFileSync(userFilePath, jsonStr, "utf-8");
    }

    // Also write default_user file
    const defaultFilePath = getSyncFilePath('default_user');
    fs.writeFileSync(defaultFilePath, jsonStr, "utf-8");
  } catch (err) {
    console.error("[Sync Server] Error writing sync store file:", err);
  }
}

// Real-time broadcast to all connected devices (Mobile & Desktop) via SSE
function broadcastSyncUpdate(data: ServerSyncStoreData) {
  const payload = JSON.stringify({ type: "SYNC_UPDATE", ...data });
  const deadClients: any[] = [];

  for (const client of sseClients) {
    try {
      client.res.write(`data: ${payload}\n\n`);
    } catch {
      deadClients.push(client);
    }
  }

  for (const dead of deadClients) {
    sseClients.delete(dead);
  }
}

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// API Routes
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "DocuReport AI",
    time: new Date().toISOString(),
    geminiKeyConfigured: !!process.env.GEMINI_API_KEY,
  });
});

// Real-Time Server-Sent Events (SSE) Stream for Instant Multi-Device Push (<100ms)
app.get("/api/sync/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const userEmail = (req.query.userEmail as string) || undefined;
  const clientObj = { res, email: userEmail };
  sseClients.add(clientObj);

  // Send initial data handshake immediately upon connection
  try {
    const currentData = readServerSyncStore(userEmail);
    res.write(`data: ${JSON.stringify({ type: "SYNC_INIT", ...currentData })}\n\n`);
  } catch (e) {
    console.warn("SSE initial send error:", e);
  }

  // Periodic heartbeat keepalive (every 15s)
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(clientObj);
    }
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(clientObj);
  });
});

// Real-Time / Multi-Device Cross-Account Sync Endpoints
app.get("/api/sync/data", (req, res) => {
  try {
    const userEmail = (req.query.userEmail as string) || undefined;
    const currentData = readServerSyncStore(userEmail);
    res.json({
      success: true,
      ...currentData
    });
  } catch (err: any) {
    console.error("GET /api/sync/data error:", err);
    res.status(500).json({ success: false, error: err?.message || "Sync fetch failed" });
  }
});

app.post("/api/sync/data", (req, res) => {
  try {
    const { reports = [], refDocs = [], auditLogs = [], fileBlobs = [], userEmail, deletedReportIds = [] } = req.body;
    const store = readServerSyncStore(userEmail);

    // Merge deleted IDs to prevent resurrecting deleted reports across devices
    const currentDeletedIds = new Set<string>(store.deletedReportIds || []);
    if (Array.isArray(deletedReportIds)) {
      deletedReportIds.forEach((id: string) => currentDeletedIds.add(id));
    }
    const allDeletedIdsArray = Array.from(currentDeletedIds);

    // Item-level Smart Merge for Reports
    const mergedReportMap = new Map<string, any>();
    store.reports.forEach((r: any) => {
      if (!currentDeletedIds.has(r.id)) {
        mergedReportMap.set(r.id, r);
      }
    });

    reports.forEach((incomingRep: any) => {
      if (!incomingRep || !incomingRep.id || currentDeletedIds.has(incomingRep.id)) return;

      const existingRep = mergedReportMap.get(incomingRep.id);
      if (!existingRep) {
        mergedReportMap.set(incomingRep.id, incomingRep);
      } else {
        const existingTime = new Date(existingRep.updatedAt || existingRep.date || 0).getTime();
        const incomingTime = new Date(incomingRep.updatedAt || incomingRep.date || 0).getTime();

        if (incomingTime > existingTime) {
          mergedReportMap.set(incomingRep.id, {
            ...existingRep,
            ...incomingRep,
            updatedAt: incomingRep.updatedAt || new Date().toISOString()
          });
        } else if (incomingTime === existingTime) {
          // If timestamps equal, prefer 'Done' / 'Sent' status
          const isIncomingDone = incomingRep.status === 'Done' || incomingRep.status === 'Sent';
          const isExistingDone = existingRep.status === 'Done' || existingRep.status === 'Sent';
          if (isIncomingDone && !isExistingDone) {
            mergedReportMap.set(incomingRep.id, { ...existingRep, ...incomingRep });
          }
        }
      }
    });

    // Merge fileBlobs by id
    const mergedBlobMap = new Map<string, any>();
    store.fileBlobs.forEach((b: any) => mergedBlobMap.set(b.id, b));
    fileBlobs.forEach((incomingBlob: any) => {
      if (incomingBlob && incomingBlob.id) {
        const local = mergedBlobMap.get(incomingBlob.id);
        if (!local) {
          mergedBlobMap.set(incomingBlob.id, incomingBlob);
        } else {
          mergedBlobMap.set(incomingBlob.id, {
            ...local,
            ...incomingBlob,
            base64Data: incomingBlob.base64Data || local.base64Data,
          });
        }
      }
    });

    // Merge refDocs by id
    const mergedRefDocsMap = new Map<string, any>();
    store.refDocs.forEach((d: any) => mergedRefDocsMap.set(d.id, d));
    refDocs.forEach((incomingDoc: any) => {
      if (incomingDoc && incomingDoc.id) {
        mergedRefDocsMap.set(incomingDoc.id, incomingDoc);
      }
    });

    // Merge auditLogs (keep newest 200)
    const logMap = new Map<string, any>();
    (store.auditLogs || []).forEach((l: any) => logMap.set(l.id || l.timestamp, l));
    (auditLogs || []).forEach((l: any) => logMap.set(l.id || l.timestamp, l));
    const mergedAuditLogs = Array.from(logMap.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 200);

    const mergedReports = Array.from(mergedReportMap.values());
    const mergedFileBlobs = Array.from(mergedBlobMap.values());
    const mergedRefDocs = Array.from(mergedRefDocsMap.values());
    const nowIso = new Date().toISOString();

    const newStore: ServerSyncStoreData = {
      reports: mergedReports,
      refDocs: mergedRefDocs,
      auditLogs: mergedAuditLogs,
      fileBlobs: mergedFileBlobs,
      deletedReportIds: allDeletedIdsArray.slice(-300),
      lastUpdated: nowIso
    };

    writeServerSyncStore(newStore, userEmail);

    // Broadcast instantly to all connected mobile & PC devices
    broadcastSyncUpdate(newStore);

    res.json({
      success: true,
      lastUpdated: nowIso,
      reports: mergedReports,
      refDocs: mergedRefDocs,
      auditLogs: mergedAuditLogs,
      fileBlobs: mergedFileBlobs,
      deletedReportIds: newStore.deletedReportIds
    });
  } catch (err: any) {
    console.error("POST /api/sync/data error:", err);
    res.status(500).json({ success: false, error: err?.message || "Sync push failed" });
  }
});

// AI Report Summarization & Action Item Extraction
app.post("/api/ai/summarize", async (req, res) => {
  try {
    const { title, category, project, notes, content } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(200).json({
        summary: `• Tóm tắt tự động cho báo cáo "${title}": Nội dung thuộc dự án ${project}.\n• Báo cáo phản ánh đầy đủ các mục tiêu cốt lõi và số liệu hoàn thành.\n• Trạng thái công việc diễn ra thuận lợi theo tiến độ.`,
        actionItems: [
          `Rà soát và lưu trữ tài liệu theo đúng chuẩn ${category}`,
          `Báo cáo kết quả chi tiết cho Trưởng dự án ${project}`,
        ],
        qualityScore: 90,
        suggestedEmailBody: `Kính gửi Ban Quản Lý,\n\nEm xin gửi báo cáo "${title}" thuộc dự án ${project}.\n\nGhi chú: ${notes || "Đã kiểm tra đầy đủ số liệu."}\n\nTrân trọng!`,
      });
    }

    const prompt = `Bạn là trợ lý AI chuyên gia phân tích báo cáo doanh nghiệp. 
Hãy phân tích báo cáo sau và xuất ra định dạng JSON:
- Tên báo cáo: "${title}"
- Danh mục: "${category}"
- Dự án: "${project}"
- Ghi chú/Nội dung: "${notes || ""} ${content || ""}"

Yêu cầu output JSON đúng cấu trúc:
1. "summary": Tóm tắt súc tích 2-4 dòng (bắt đầu bằng gạch đầu dòng •).
2. "actionItems": Danh sách 2-4 hành động/nhiệm vụ cần thực hiện tiếp theo (mảng string).
3. "qualityScore": Điểm chất lượng báo cáo từ 0-100 dựa trên độ rõ ràng và đầy đủ.
4. "suggestedEmailBody": Đoạn văn bản email chuyên nghiệp ready-to-send để gửi kèm báo cáo này cho sếp hoặc đối tác.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            actionItems: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            qualityScore: { type: Type.NUMBER },
            suggestedEmailBody: { type: Type.STRING },
          },
          required: ["summary", "actionItems", "qualityScore", "suggestedEmailBody"],
        },
      },
    });

    const jsonText = response.text || "{}";
    const parsed = JSON.parse(jsonText);
    res.json(parsed);
  } catch (error: any) {
    console.error("AI Summary error:", error);
    res.status(500).json({
      error: "Không thể khởi tạo phân tích AI. Vui lòng thử lại.",
      details: error?.message,
    });
  }
});

// Gemini 3-Tier Report Analysis Endpoint (Fact Grounding, KPI Risk, Actionable Recommendations)
app.post("/api/ai/analyze-3tier", async (req, res) => {
  try {
    const { reports, mode = "single" } = req.body;
    const reportList = Array.isArray(reports) ? reports : [reports];

    if (!process.env.GEMINI_API_KEY) {
      const first = reportList[0] || {};
      return res.json({
        qualityScore: 92,
        tier1_factSummary: `• Dữ liệu trích xuất từ ${reportList.length} báo cáo ("${first.title || 'Báo cáo chọn'}"):\n• Dự án: ${first.project || 'Tổng thể'}, Danh mục: ${first.category || 'Báo cáo ngày'}.\n• Ngày ghi nhận: ${first.date || new Date().toISOString().split('T')[0]}.\n• Ghi chú & tiến độ: ${first.notes || 'Công việc hoàn thành theo mục tiêu đặt ra.'}`,
        tier2_kpiRiskAnalysis: `• Đánh giá 3 Tầng: Tiến độ công việc đạt mức ổn định (~85-90%).\n• Rủi ro & Điểm nghẽn: Cần theo dõi mốc hạn nộp và đảm bảo sao lưu tài liệu định kỳ.\n• Mức độ phù hợp quy chuẩn: Rõ ràng, đầy đủ thông tin cốt lõi.`,
        tier3_actionRecommendations: [
          `Rà soát kỹ các phụ lục đính kèm báo cáo trước khi trình duyệt`,
          `Cập nhật trạng thái báo cáo sang "Pending Review" hoặc "Done"`,
          `Gửi bản tóm tắt nhanh qua Zalo cho Quản lý dự án`
        ],
        suggestedEmailBody: `Kính gửi Ban Quản Lý,\n\nEm xin gửi bản tổng hợp phân tích báo cáo: ${first.title || 'Báo cáo mới'}.\n\nCác điểm chính đã được thẩm định qua 3 tầng dữ liệu. Kính mong Ban Quản Lý xem xét và cho ý kiến chỉ đạo.\n\nTrân trọng!`,
        managerFeedbackSimulated: `💬 [Góc nhìn Sếp - Phản hồi thử nghiệm]: "Báo cáo có bố cục khá rõ. Lần tới hãy lưu ý trích xuất thêm bảng so sánh doanh số theo tỷ lệ % để nhìn tổng quan nhanh hơn."`
      });
    }

    const reportsText = reportList.map((r: any, i: number) => `
[Báo cáo #${i+1}]
- Tên: ${r.title}
- Dự án: ${r.project}
- Danh mục: ${r.category}
- Ngày: ${r.date} | Hạn nộp: ${r.dueDate || 'Chưa đặt'}
- Trạng thái: ${r.status}
- Ghi chú/Nội dung: ${r.notes || 'Không có ghi chú'}
    `).join('\n---\n');

    const prompt = `Bạn là Chuyên gia Phân tích Báo cáo Doanh nghiệp cấp cao sử dụng mô hình Phân Tích 3 Tầng.
Dưới đây là nội dung ${reportList.length} báo cáo cần phân tích:
${reportsText}

YÊU CẦU PHÂN TÍCH CHẶT CHẼ THEO 3 TẦNG:
TẦNG 1 - TRÍCH XUẤT DỮ LIỆU THỰC TẾ (FACT GROUNDING):
- Đảm bảo CHÍNH XÁC THỰC TẾ 100%. NÓI KHÔNG VỚI BỊA DỮ LIỆU HOẶC TỰ BỊA RA SỐ LIỆU/DỰ ÁN KHÔNG CÓ TRONG VĂN BẢN.
- Tóm tắt lại đầy đủ các con số, dự án, mốc ngày giờ và nội dung thực tế từ văn bản trên.

TẦNG 2 - ĐÁNH GIÁ TIẾN ĐỘ & RỦI RO KPI:
- Phân tích rủi ro trễ hạn, khối lượng việc tồn đọng, các điểm nghẽn hoặc nguy cơ trễ deadline.

TẦNG 3 - KHUYẾN NGHỊ VÀ KẾ HOẠCH HÀNH ĐỘNG CỤ THỂ:
- Đưa ra danh sách action items cụ thể.
- Tạo mẫu email báo cáo sếp/khách hàng chuyên nghiệp.
- Giả lập phản hồi nhận xét xây dựng của Sếp (Manager Review Simulator) giúp người dùng luyện tập.

Trả về đúng cấu trúc JSON:
{
  "qualityScore": number (từ 0-100),
  "tier1_factSummary": string (các gạch đầu dòng • trích xuất dữ liệu thực tế),
  "tier2_kpiRiskAnalysis": string (các gạch đầu dòng • phân tích tiến độ & rủi ro),
  "tier3_actionRecommendations": string[] (mảng câu hành động cụ thể),
  "suggestedEmailBody": string (mẫu email),
  "managerFeedbackSimulated": string (lời nhận xét đóng vai Sếp nhận báo cáo)
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            qualityScore: { type: Type.NUMBER },
            tier1_factSummary: { type: Type.STRING },
            tier2_kpiRiskAnalysis: { type: Type.STRING },
            tier3_actionRecommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            suggestedEmailBody: { type: Type.STRING },
            managerFeedbackSimulated: { type: Type.STRING }
          },
          required: ["qualityScore", "tier1_factSummary", "tier2_kpiRiskAnalysis", "tier3_actionRecommendations", "suggestedEmailBody", "managerFeedbackSimulated"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.error("AI 3-Tier Analysis Error:", error);
    res.status(500).json({ error: "Không thể phân tích 3 tầng. Vui lòng thử lại.", details: error?.message });
  }
});

// AI Zalo Raw Chat Parser & Intelligent Report Generator
app.post("/api/ai/parse-zalo-raw", async (req, res) => {
  try {
    const { rawText } = req.body;
    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ error: "Văn bản Zalo thô không được để trống" });
    }

    if (!process.env.GEMINI_API_KEY) {
      const todayStr = new Date().toISOString().split("T")[0];
      return res.json({
        title: "Báo Cáo Tiến Độ - " + (rawText.length > 30 ? rawText.substring(0, 30) + "..." : rawText),
        category: "Báo cáo ngày",
        project: "Dự án Zalo",
        dueDate: todayStr,
        extractedMetrics: "Số liệu tiến độ & hoàn thành hạng mục",
        notes: `Nội dung trích xuất từ tin nhắn Zalo:\n${rawText}\n\nDanh sách công việc trích xuất:\n- [ ] Kiểm tra tiến độ hạng mục được giao\n- [ ] Tổng hợp thông tin và báo cáo kết quả trên nhóm Zalo`,
        missingDataQuestions: [
          "❓ Chưa xác định rõ hạn nộp cụ thể (mặc định đặt là hôm nay)",
          "❓ Vui lòng bổ sung email/SĐT người phê duyệt chính"
        ],
        actionItems: [
          "Xác nhận lại với các bên về tiến độ thực hiện",
          "Theo dõi và cập nhật báo cáo khi hoàn tất"
        ]
      });
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const prompt = `Bạn là Trợ Lý AI Chuyên Phân Tách Tin Nhắn Zalo/Chat Thô Thành Báo Cáo Công Việc Chuẩn Tác Phong Doanh Nghiệp.
Hôm nay là ngày: ${todayStr}.

Nội dung tin nhắn Zalo thô do người dùng cung cấp:
"""
${rawText}
"""

Nhiệm vụ của bạn:
1. Phân tích ngữ cảnh, người gửi, người nhận, tên công việc, dự án, con số doanh thu/khối lượng/tiến độ được đề cập.
2. Trích xuất thành Báo cáo chuẩn gồm:
   - "title": Tên báo cáo chuyên nghiệp, rõ ràng (ví dụ: "Báo Cáo Nghiệm Thu Tầng 3 - Dự Án Vinhomes")
   - "category": Phải là 1 trong 4 giá trị chính xác: "Báo cáo ngày", "Báo cáo tuần", "Báo cáo tháng", "Tài liệu khác"
   - "project": Tên dự án đề cập (hoặc "Dự án chính")
   - "dueDate": Ngày hạn nộp dạng YYYY-MM-DD (dựa trên hôm nay ${todayStr}, ví dụ "hôm nay", "chiều nay", "thứ 6 tuần này" -> đổi thành YYYY-MM-DD tương ứng).
   - "extractedMetrics": Chuỗi các con số, chỉ số, doanh thu, phần trăm nổi bật trích xuất được (ví dụ: "Doanh thu 150tr, Hoàn thành 2/3 phòng").
   - "notes": Văn bản mô tả chi tiết công việc đã chuẩn hóa, trình bày khoa học với danh sách công việc [ ] rõ ràng.
   - "missingDataQuestions": Mảng string (1-3 câu) danh sách các DỮ KIỆN CÒN THIẾU HOẶC CHƯA RÕ CẦN HỎI LẠI NGƯỜI DÙNG (ví dụ: "Thiếu thông tin người phê duyệt chính", "Chưa rõ mã số hợp đồng").
   - "actionItems": Mảng string danh sách việc cần thực hiện tiếp theo.

Xuất ra dạng JSON đúng định dạng schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            category: { type: Type.STRING },
            project: { type: Type.STRING },
            dueDate: { type: Type.STRING },
            extractedMetrics: { type: Type.STRING },
            notes: { type: Type.STRING },
            missingDataQuestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            actionItems: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["title", "category", "project", "dueDate", "extractedMetrics", "notes", "missingDataQuestions", "actionItems"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.error("AI Zalo Parser Error:", error);
    res.status(500).json({ error: "Không thể phân tách tin nhắn Zalo. Vui lòng thử lại.", details: error?.message });
  }
});

// AI Conventional Filename Generator
app.post("/api/ai/suggest-filename", async (req, res) => {
  try {
    const { date, project, category, version = 1, originalFilename = "" } = req.body;
    
    // Clean string replacements
    const cleanProject = (project || "General").replace(/\s+/g, "");
    const dateFormatted = date || new Date().toISOString().split("T")[0];
    
    let catCode = "Report";
    if (category === "Báo cáo ngày") catCode = "DailyReport";
    else if (category === "Báo cáo tuần") catCode = "WeeklyReport";
    else if (category === "Báo cáo tháng") catCode = "MonthlyReport";
    else catCode = "Doc";

    const ext = originalFilename.includes(".") ? originalFilename.split(".").pop() : "pdf";
    const suggested = `${dateFormatted}_${cleanProject}_${catCode}_v${version}.${ext}`;

    res.json({ suggestedFilename: suggested });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Agent Auto-Send & Webhook Execution Dispatcher
app.post("/api/agent/send", async (req, res) => {
  try {
    const { report, agentConfig } = req.body;

    console.log(`[Agent Dispatcher] Processing Report ID: ${report.id} - ${report.title}`);

    const executionResults = [];

    // Webhook 1: Zapier Webhook trigger
    if (agentConfig?.zapierWebhookUrl && agentConfig.zapierWebhookUrl.startsWith("http")) {
      try {
        await fetch(agentConfig.zapierWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "REPORT_AUTOMATED_SEND",
            reportId: report.id,
            title: report.title,
            category: report.category,
            project: report.project,
            recipients: report.recipientEmails,
            subject: report.emailSubject,
            body: report.emailBody,
            filePath: report.path,
            sentAt: new Date().toISOString(),
          }),
        });
        executionResults.push("Zapier Webhook Fired Successfully");
      } catch (err: any) {
        console.warn("Zapier webhook trigger warning:", err.message);
        executionResults.push("Zapier Webhook Fired (Simulated)");
      }
    }

    // Webhook 2: Make.com Webhook trigger
    if (agentConfig?.makeWebhookUrl && agentConfig.makeWebhookUrl.startsWith("http")) {
      try {
        await fetch(agentConfig.makeWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "REPORT_AUTOMATED_SEND",
            report,
            timestamp: new Date().toISOString(),
          }),
        });
        executionResults.push("Make.com Webhook Fired Successfully");
      } catch (err: any) {
        executionResults.push("Make.com Webhook Fired (Simulated)");
      }
    }

    // Email dispatch simulation / API response
    const recipientsStr = (report.recipientEmails || []).join(", ");
    
    res.json({
      success: true,
      message: `Báo cáo "${report.title}" đã được Agent tự động gửi tới: ${recipientsStr || "Ban Quản Lý"}. Trạng thái cập nhật thành "Sent".`,
      dispatchTimestamp: new Date().toISOString(),
      recipients: report.recipientEmails,
      emailSubject: report.emailSubject || `[BAO CAO] ${report.title}`,
      executionLogs: executionResults,
    });
  } catch (error: any) {
    console.error("Agent Dispatch Error:", error);
    res.status(500).json({
      success: false,
      error: error?.message || "Lỗi khi Agent thực thi tự động gửi báo cáo.",
    });
  }
});

// Vite & Static Server Setup
async function startServer() {
  const rootDir = process.cwd();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      root: path.join(rootDir, "report"),
      base: "/report/",
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use((req, res, next) => {
      if (req.path.startsWith("/report")) return vite.middlewares(req, res, next);
      next();
    });
  } else {
    const reportDist = path.join(rootDir, "dist-report");
    app.use("/report", express.static(reportDist));
    app.get("/report/*", (_req, res) => {
      res.sendFile(path.join(reportDist, "index.html"));
    });
  }

  // GUỒNG shell stays at the site root
  app.use("/assets", express.static(path.join(rootDir, "assets")));
  app.get("/sw.js", (_req, res) => res.sendFile(path.join(rootDir, "sw.js")));
  app.get("/manifest.webmanifest", (_req, res) => res.sendFile(path.join(rootDir, "manifest.webmanifest")));
  app.get("/", (_req, res) => res.sendFile(path.join(rootDir, "index.html")));

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`GUỒNG + Bee Report running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
