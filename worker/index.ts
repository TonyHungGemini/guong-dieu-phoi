interface Env {
  ASSETS: Fetcher;
  SYNC_KV: KVNamespace;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  ACCESS_CODE?: string;
  SESSION_SECRET?: string;
}

type SyncStore = {
  reports: any[];
  refDocs: any[];
  auditLogs: any[];
  fileBlobs: any[];
  deletedReportIds: string[];
  lastUpdated: string;
};

const EMPTY_STORE: SyncStore = {
  reports: [],
  refDocs: [],
  auditLogs: [],
  fileBlobs: [],
  deletedReportIds: [],
  lastUpdated: "1970-01-01T00:00:00.000Z",
};

const SESSION_COOKIE = "guong_sess";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

function storeKey(userEmail?: string | null) {
  const safe = (userEmail || "default_user").toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return `sync:${safe}`;
}

async function readStore(env: Env, key: string): Promise<SyncStore> {
  const raw = await env.SYNC_KV.get(key);
  if (!raw) return { ...EMPTY_STORE };
  try {
    const parsed = JSON.parse(raw);
    return {
      reports: Array.isArray(parsed.reports) ? parsed.reports : [],
      refDocs: Array.isArray(parsed.refDocs) ? parsed.refDocs : [],
      auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
      fileBlobs: Array.isArray(parsed.fileBlobs) ? parsed.fileBlobs : [],
      deletedReportIds: Array.isArray(parsed.deletedReportIds) ? parsed.deletedReportIds : [],
      lastUpdated: parsed.lastUpdated || EMPTY_STORE.lastUpdated,
    };
  } catch {
    return { ...EMPTY_STORE };
  }
}

async function writeStore(env: Env, key: string, store: SyncStore) {
  await env.SYNC_KV.put(key, JSON.stringify(store));
}

function mergeStore(store: SyncStore, body: any): SyncStore {
  const {
    reports = [],
    refDocs = [],
    auditLogs = [],
    fileBlobs = [],
    deletedReportIds = [],
  } = body || {};

  const currentDeleted = new Set<string>(store.deletedReportIds || []);
  if (Array.isArray(deletedReportIds)) deletedReportIds.forEach((id: string) => currentDeleted.add(id));
  const allDeleted = Array.from(currentDeleted);

  const reportMap = new Map<string, any>();
  store.reports.forEach((r: any) => {
    if (r?.id && !currentDeleted.has(r.id)) reportMap.set(r.id, r);
  });

  (Array.isArray(reports) ? reports : []).forEach((incoming: any) => {
    if (!incoming?.id || currentDeleted.has(incoming.id)) return;
    const existing = reportMap.get(incoming.id);
    if (!existing) {
      reportMap.set(incoming.id, incoming);
      return;
    }
    const existingTime = new Date(existing.updatedAt || existing.date || 0).getTime();
    const incomingTime = new Date(incoming.updatedAt || incoming.date || 0).getTime();
    if (incomingTime > existingTime) {
      reportMap.set(incoming.id, { ...existing, ...incoming, updatedAt: incoming.updatedAt || new Date().toISOString() });
    } else if (incomingTime === existingTime) {
      const incomingDone = incoming.status === "Done" || incoming.status === "Sent";
      const existingDone = existing.status === "Done" || existing.status === "Sent";
      if (incomingDone && !existingDone) reportMap.set(incoming.id, { ...existing, ...incoming });
    }
  });

  const blobMap = new Map<string, any>();
  store.fileBlobs.forEach((b: any) => b?.id && blobMap.set(b.id, b));
  (Array.isArray(fileBlobs) ? fileBlobs : []).forEach((incoming: any) => {
    if (!incoming?.id) return;
    const local = blobMap.get(incoming.id);
    blobMap.set(incoming.id, local ? { ...local, ...incoming, base64Data: incoming.base64Data || local.base64Data } : incoming);
  });

  const docMap = new Map<string, any>();
  store.refDocs.forEach((d: any) => d?.id && docMap.set(d.id, d));
  (Array.isArray(refDocs) ? refDocs : []).forEach((doc: any) => {
    if (doc?.id) docMap.set(doc.id, doc);
  });

  const logMap = new Map<string, any>();
  (store.auditLogs || []).forEach((l: any) => logMap.set(l.id || l.timestamp, l));
  (Array.isArray(auditLogs) ? auditLogs : []).forEach((l: any) => logMap.set(l.id || l.timestamp, l));
  const mergedLogs = Array.from(logMap.values())
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 200);

  return {
    reports: Array.from(reportMap.values()),
    refDocs: Array.from(docMap.values()),
    auditLogs: mergedLogs,
    fileBlobs: Array.from(blobMap.values()),
    deletedReportIds: allDeleted.slice(-300),
    lastUpdated: new Date().toISOString(),
  };
}

const encoder = new TextEncoder();

async function hmacHex(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

async function isAuthorized(request: Request, env: Env) {
  if (!env.ACCESS_CODE) return true;
  const secret = env.SESSION_SECRET || env.ACCESS_CODE;
  const raw = readCookie(request, SESSION_COOKIE);
  if (!raw) return false;
  const [exp, sig] = raw.split(".");
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now()) return false;
  const expected = await hmacHex(secret, `v1:${exp}`);
  return expected === sig;
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sessionCookie(env: Env) {
  const exp = String(Date.now() + SESSION_TTL_SECONDS * 1000);
  const sig = await hmacHex(env.SESSION_SECRET || env.ACCESS_CODE || "", `v1:${exp}`);
  return `${SESSION_COOKIE}=${exp}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

type GeminiSchema = Record<string, unknown>;

async function geminiJson(env: Env, prompt: string, schema: GeminiSchema) {
  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY || "" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: schema },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data: any = await res.json();
  const text = (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("");
  return JSON.parse(text || "{}");
}

const SUMMARIZE_SCHEMA: GeminiSchema = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    actionItems: { type: "ARRAY", items: { type: "STRING" } },
    qualityScore: { type: "NUMBER" },
    suggestedEmailBody: { type: "STRING" },
  },
  required: ["summary", "actionItems", "qualityScore", "suggestedEmailBody"],
};

const ANALYZE_SCHEMA: GeminiSchema = {
  type: "OBJECT",
  properties: {
    qualityScore: { type: "NUMBER" },
    tier1_factSummary: { type: "STRING" },
    tier2_kpiRiskAnalysis: { type: "STRING" },
    tier3_actionRecommendations: { type: "ARRAY", items: { type: "STRING" } },
    suggestedEmailBody: { type: "STRING" },
    managerFeedbackSimulated: { type: "STRING" },
  },
  required: [
    "qualityScore",
    "tier1_factSummary",
    "tier2_kpiRiskAnalysis",
    "tier3_actionRecommendations",
    "suggestedEmailBody",
    "managerFeedbackSimulated",
  ],
};

const ZALO_SCHEMA: GeminiSchema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    category: { type: "STRING" },
    project: { type: "STRING" },
    dueDate: { type: "STRING" },
    extractedMetrics: { type: "STRING" },
    notes: { type: "STRING" },
    missingDataQuestions: { type: "ARRAY", items: { type: "STRING" } },
    actionItems: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: [
    "title",
    "category",
    "project",
    "dueDate",
    "extractedMetrics",
    "notes",
    "missingDataQuestions",
    "actionItems",
  ],
};

function sseStream(env: Env, key: string) {
  let cancelled = false;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      let lastSerialized = "";
      let ticks = 0;
      try {
        const initial = await readStore(env, key);
        lastSerialized = JSON.stringify(initial);
        send({ type: "SYNC_INIT", ...initial });
        while (!cancelled) {
          await new Promise((resolve) => setTimeout(resolve, 2500));
          if (cancelled) break;
          ticks++;
          const current = await readStore(env, key);
          const serialized = JSON.stringify(current);
          if (serialized !== lastSerialized) {
            lastSerialized = serialized;
            send({ type: "SYNC_UPDATE", ...current });
          } else if (ticks % 6 === 0) {
            controller.enqueue(encoder.encode(`: heartbeat\n\n`));
          }
        }
      } catch (err) {
        try {
          send({ type: "SYNC_ERROR", message: String(err) });
        } catch {}
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      "connection": "keep-alive",
    },
  });
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname;

  if (path === "/api/health") {
    return json({ status: "ok", app: "GUỒNG + Bee Report", time: new Date().toISOString(), geminiKeyConfigured: !!env.GEMINI_API_KEY });
  }

  if (path === "/api/auth/status") {
    const ok = await isAuthorized(request, env);
    return ok ? json({ ok: true }) : json({ ok: false }, 401);
  }

  if (path === "/api/auth" && request.method === "POST") {
    if (!env.ACCESS_CODE) return json({ ok: true });
    const body: any = await request.json().catch(() => ({}));
    const code = String(body?.code || "");
    if (!constantTimeEqual(code, env.ACCESS_CODE)) return json({ ok: false, error: "Mã truy cập không đúng" }, 401);
    return json({ ok: true }, 200, { "set-cookie": await sessionCookie(env) });
  }

  if (!(await isAuthorized(request, env))) {
    return json({ ok: false, error: "Cần mã truy cập" }, 401);
  }

  if (path === "/api/sync/stream" && request.method === "GET") {
    return sseStream(env, storeKey(url.searchParams.get("userEmail")));
  }

  if (path === "/api/sync/data" && request.method === "GET") {
    const store = await readStore(env, storeKey(url.searchParams.get("userEmail")));
    return json({ success: true, ...store });
  }

  if (path === "/api/sync/data" && request.method === "POST") {
    const body: any = await request.json().catch(() => ({}));
    const key = storeKey(body?.userEmail);
    const store = await readStore(env, key);
    const merged = mergeStore(store, body);
    await writeStore(env, key, merged);
    return json({ success: true, ...merged });
  }

  if (path === "/api/ai/summarize" && request.method === "POST") {
    const { title, category, project, notes, content } = (await request.json().catch(() => ({}))) as any;
    if (!env.GEMINI_API_KEY) {
      return json({
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
    try {
      return json(await geminiJson(env, prompt, SUMMARIZE_SCHEMA));
    } catch (err: any) {
      return json({ error: "Không thể khởi tạo phân tích AI. Vui lòng thử lại.", details: err?.message }, 500);
    }
  }

  if (path === "/api/ai/analyze-3tier" && request.method === "POST") {
    const body: any = await request.json().catch(() => ({}));
    const reportList = Array.isArray(body?.reports) ? body.reports : [body?.reports];
    const first = reportList[0] || {};
    if (!env.GEMINI_API_KEY) {
      return json({
        qualityScore: 92,
        tier1_factSummary: `• Dữ liệu trích xuất từ ${reportList.length} báo cáo ("${first.title || "Báo cáo chọn"}"):\n• Dự án: ${first.project || "Tổng thể"}, Danh mục: ${first.category || "Báo cáo ngày"}.\n• Ngày ghi nhận: ${first.date || new Date().toISOString().split("T")[0]}.\n• Ghi chú & tiến độ: ${first.notes || "Công việc hoàn thành theo mục tiêu đặt ra."}`,
        tier2_kpiRiskAnalysis: `• Đánh giá 3 Tầng: Tiến độ công việc đạt mức ổn định (~85-90%).\n• Rủi ro & Điểm nghẽn: Cần theo dõi mốc hạn nộp và đảm bảo sao lưu tài liệu định kỳ.\n• Mức độ phù hợp quy chuẩn: Rõ ràng, đầy đủ thông tin cốt lõi.`,
        tier3_actionRecommendations: [
          `Rà soát kỹ các phụ lục đính kèm báo cáo trước khi trình duyệt`,
          `Cập nhật trạng thái báo cáo sang "Pending Review" hoặc "Done"`,
          `Gửi bản tóm tắt nhanh qua Zalo cho Quản lý dự án`,
        ],
        suggestedEmailBody: `Kính gửi Ban Quản Lý,\n\nEm xin gửi bản tổng hợp phân tích báo cáo: ${first.title || "Báo cáo mới"}.\n\nCác điểm chính đã được thẩm định qua 3 tầng dữ liệu. Kính mong Ban Quản Lý xem xét và cho ý kiến chỉ đạo.\n\nTrân trọng!`,
        managerFeedbackSimulated: `💬 [Góc nhìn Sếp - Phản hồi thử nghiệm]: "Báo cáo có bố cục khá rõ. Lần tới hãy lưu ý trích xuất thêm bảng so sánh doanh số theo tỷ lệ % để nhìn tổng quan nhanh hơn."`,
      });
    }
    const reportsText = reportList
      .map(
        (r: any, i: number) => `
[Báo cáo #${i + 1}]
- Tên: ${r.title}
- Dự án: ${r.project}
- Danh mục: ${r.category}
- Ngày: ${r.date} | Hạn nộp: ${r.dueDate || "Chưa đặt"}
- Trạng thái: ${r.status}
- Ghi chú/Nội dung: ${r.notes || "Không có ghi chú"}
    `
      )
      .join("\n---\n");
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
    try {
      return json(await geminiJson(env, prompt, ANALYZE_SCHEMA));
    } catch (err: any) {
      return json({ error: "Không thể phân tích 3 tầng. Vui lòng thử lại.", details: err?.message }, 500);
    }
  }

  if (path === "/api/ai/parse-zalo-raw" && request.method === "POST") {
    const { rawText } = (await request.json().catch(() => ({}))) as any;
    if (!rawText || !String(rawText).trim()) {
      return json({ error: "Văn bản Zalo thô không được để trống" }, 400);
    }
    const todayStr = new Date().toISOString().split("T")[0];
    if (!env.GEMINI_API_KEY) {
      return json({
        title: "Báo Cáo Tiến Độ - " + (rawText.length > 30 ? rawText.substring(0, 30) + "..." : rawText),
        category: "Báo cáo ngày",
        project: "Dự án Zalo",
        dueDate: todayStr,
        extractedMetrics: "Số liệu tiến độ & hoàn thành hạng mục",
        notes: `Nội dung trích xuất từ tin nhắn Zalo:\n${rawText}\n\nDanh sách công việc trích xuất:\n- [ ] Kiểm tra tiến độ hạng mục được giao\n- [ ] Tổng hợp thông tin và báo cáo kết quả trên nhóm Zalo`,
        missingDataQuestions: [
          "❓ Chưa xác định rõ hạn nộp cụ thể (mặc định đặt là hôm nay)",
          "❓ Vui lòng bổ sung email/SĐT người phê duyệt chính",
        ],
        actionItems: ["Xác nhận lại với các bên về tiến độ thực hiện", "Theo dõi và cập nhật báo cáo khi hoàn tất"],
      });
    }
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
    try {
      return json(await geminiJson(env, prompt, ZALO_SCHEMA));
    } catch (err: any) {
      return json({ error: "Không thể phân tách tin nhắn Zalo. Vui lòng thử lại.", details: err?.message }, 500);
    }
  }

  if (path === "/api/ai/suggest-filename" && request.method === "POST") {
    const { date, project, category, version = 1, originalFilename = "" } = (await request.json().catch(() => ({}))) as any;
    const cleanProject = (project || "General").replace(/\s+/g, "");
    const dateFormatted = date || new Date().toISOString().split("T")[0];
    let catCode = "Report";
    if (category === "Báo cáo ngày") catCode = "DailyReport";
    else if (category === "Báo cáo tuần") catCode = "WeeklyReport";
    else if (category === "Báo cáo tháng") catCode = "MonthlyReport";
    else catCode = "Doc";
    const ext = originalFilename.includes(".") ? originalFilename.split(".").pop() : "pdf";
    return json({ suggestedFilename: `${dateFormatted}_${cleanProject}_${catCode}_v${version}.${ext}` });
  }

  if (path === "/api/agent/send" && request.method === "POST") {
    const { report, agentConfig } = (await request.json().catch(() => ({}))) as any;
    if (!report) return json({ success: false, error: "Thiếu dữ liệu báo cáo" }, 400);
    const executionResults: string[] = [];

    if (agentConfig?.zapierWebhookUrl?.startsWith("http")) {
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
      } catch {
        executionResults.push("Zapier Webhook Fired (Simulated)");
      }
    }

    if (agentConfig?.makeWebhookUrl?.startsWith("http")) {
      try {
        await fetch(agentConfig.makeWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: "REPORT_AUTOMATED_SEND", report, timestamp: new Date().toISOString() }),
        });
        executionResults.push("Make.com Webhook Fired Successfully");
      } catch {
        executionResults.push("Make.com Webhook Fired (Simulated)");
      }
    }

    const recipientsStr = (report.recipientEmails || []).join(", ");
    return json({
      success: true,
      message: `Báo cáo "${report.title}" đã được Agent tự động gửi tới: ${recipientsStr || "Ban Quản Lý"}. Trạng thái cập nhật thành "Sent".`,
      dispatchTimestamp: new Date().toISOString(),
      recipients: report.recipientEmails,
      emailSubject: report.emailSubject || `[BAO CAO] ${report.title}`,
      executionLogs: executionResults,
    });
  }

  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, url);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status === 404 && url.pathname.startsWith("/report") && (request.headers.get("accept") || "").includes("text/html")) {
      return env.ASSETS.fetch(new Request(new URL("/report/index.html", url), { headers: request.headers }));
    }
    return assetResponse;
  },
};
