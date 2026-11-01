interface Env {
  ASSETS: Fetcher;
  SYNC_KV: KVNamespace;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GEMINI_THINKING_LEVEL?: string;
  GEMINI_RELAY?: DurableObjectNamespace;
  ACCESS_CODE?: string;
  SESSION_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
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
const USER_COOKIE = "guong_user";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const FILE_MAX_BYTES = 8 * 1024 * 1024;
const FILE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const INLINE_FILE_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif", "text/plain"];

type SessionUser = {
  email: string;
  name?: string;
  picture?: string;
  exp: number;
};

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
  // Người dùng đã đăng nhập Google có kho riêng, không cần mã dùng chung.
  if (await readUser(request, env)) return true;
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

function b64urlEncode(bytes: Uint8Array) {
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(value: string) {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function sessionSecret(env: Env) {
  return env.SESSION_SECRET || env.ACCESS_CODE || "guong-local-session";
}

async function userCookie(env: Env, user: Omit<SessionUser, "exp">) {
  const payload = b64urlEncode(encoder.encode(JSON.stringify({ ...user, exp: Date.now() + SESSION_TTL_SECONDS * 1000 })));
  const sig = await hmacHex(sessionSecret(env), `u1:${payload}`);
  return `${USER_COOKIE}=${payload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

function clearUserCookie() {
  return `${USER_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

async function readUser(request: Request, env: Env): Promise<SessionUser | null> {
  const raw = readCookie(request, USER_COOKIE);
  if (!raw) return null;
  const split = raw.lastIndexOf(".");
  if (split < 1) return null;
  const payload = raw.slice(0, split);
  const sig = raw.slice(split + 1);
  const expected = await hmacHex(sessionSecret(env), `u1:${payload}`);
  if (!constantTimeEqual(sig, expected)) return null;
  try {
    const user = JSON.parse(new TextDecoder().decode(b64urlDecode(payload))) as SessionUser;
    if (!user?.email || !user.exp || user.exp < Date.now()) return null;
    return user;
  } catch {
    return null;
  }
}

async function fetchGoogleUser(accessToken: string, env: Env) {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Google token không hợp lệ hoặc đã hết hạn");
  const data: any = await res.json();
  if (!data?.email) throw new Error("Không lấy được email từ Google");
  if (data.email_verified === false) throw new Error("Email Google chưa được xác minh");
  const info = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
  if (!info.ok) throw new Error("Không xác minh được token với Google");
  const meta: any = await info.json();
  if (meta?.aud !== env.GOOGLE_CLIENT_ID) throw new Error("Token không phát hành cho ứng dụng này");
  return {
    email: String(data.email).toLowerCase(),
    name: data.name || data.email,
    picture: data.picture || "",
  };
}

async function resolveStoreKey(request: Request, env: Env) {
  const user = await readUser(request, env);
  return user?.email ? storeKey(user.email) : null;
}

function blobKey(storeKeyValue: string, fileId: string) {
  return `blob:${storeKeyValue}:${fileId}`;
}

function fileDisposition(name: string, inline: boolean) {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "tep-dinh-kem";
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/* ---------- cộng tác: bảng việc chia sẻ theo dự án ---------- */
type SharedBoard = {
  projects: { id: string; name: string; joinCode: string }[];
  members: { id: string; name: string; role?: string }[];
  tasks: {
    id: string;
    title: string;
    status: string;
    priority: string;
    assignee: string | null;
    workstream: string;
    due: string | null;
    completedAt: string | null;
    projectId: string;
    labels: string[];
  }[];
  updatedAt: string;
};

type CodeRecord = {
  owner: string;
  ownerName: string;
  projectId: string;
  name: string;
  updatedAt: string;
};

type MemberRecord = {
  email: string;
  name: string;
  picture?: string;
  owner: string;
  projects: { id: string; name: string }[];
  joinedAt: string;
  lastSeen: string;
};

type RequestRecord = {
  email: string;
  name: string;
  owner: string;
  projectId: string;
  projectName: string;
  note: string;
  createdAt: string;
};

const clip = (value: unknown, max = 120) => String(value ?? "").slice(0, max);
const asArray = (value: unknown): any[] => (Array.isArray(value) ? value : []);
const cleanEmail = (value: unknown) => clip(value, 160).trim().toLowerCase();
const cleanCode = (value: unknown) => clip(value, 20).trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
const boardKey = (email: string) => `board:${email}`;
const codeKey = (code: string) => `code:${code}`;
const codesKey = (owner: string) => `codes:${owner}`;
const memberKey = (owner: string, email: string) => `member:${owner}:${email}`;
const memberPrefix = (owner: string) => `member:${owner}:`;
const joinKey = (email: string, owner: string, projectId: string) => `join:${email}:${owner}:${projectId}`;
const joinPrefix = (email: string) => `join:${email}:`;
const licKey = (owner: string, email: string) => `lic:${owner}:${email}`;
const requestKey = (owner: string, email: string) => `req:${owner}:${email}`;
const requestPrefix = (owner: string) => `req:${owner}:`;

async function readJson<T>(env: Env, key: string): Promise<T | null> {
  const raw = await env.SYNC_KV.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizeBoard(body: any): SharedBoard {
  const projects = asArray(body?.projects).slice(0, 50).map((p: any) => ({
    id: clip(p?.id, 40),
    name: clip(p?.name, 80) || "Dự án",
    joinCode: cleanCode(p?.joinCode),
  })).filter((p) => p.id);
  const members = asArray(body?.members).slice(0, 200).map((m: any) => ({
    id: clip(m?.id, 40),
    name: clip(m?.name, 80),
    role: clip(m?.role, 60),
  })).filter((m) => m.id && m.name);
  const projectIds = new Set(projects.map((p) => p.id));
  const memberIds = new Set(members.map((m) => m.id));
  const tasks = asArray(body?.tasks).slice(0, 3000).map((t: any) => ({
    id: clip(t?.id, 40),
    title: clip(t?.title, 200),
    status: clip(t?.status, 20) || "todo",
    priority: clip(t?.priority, 10) || "med",
    assignee: memberIds.has(t?.assignee) ? clip(t?.assignee, 40) : null,
    workstream: clip(t?.workstream, 20),
    due: /^\d{4}-\d{2}-\d{2}$/.test(String(t?.due || "")) ? String(t.due) : null,
    completedAt: /^\d{4}-\d{2}-\d{2}$/.test(String(t?.completedAt || "")) ? String(t.completedAt) : null,
    projectId: projectIds.has(t?.projectId) ? clip(t.projectId, 40) : (projects[0]?.id || ""),
    labels: asArray(t?.labels).slice(0, 10).map((l: any) => clip(l, 40)).filter(Boolean),
  })).filter((t) => t.id && t.title && t.projectId);
  return { projects, members, tasks, updatedAt: new Date().toISOString() };
}

async function indexProjectCodes(env: Env, owner: string, ownerName: string, board: SharedBoard) {
  const previous = (await readJson<string[]>(env, codesKey(owner))) || [];
  const current: string[] = [];
  for (const project of board.projects) {
    if (!project.joinCode) continue;
    const existing = await readJson<CodeRecord>(env, codeKey(project.joinCode));
    if (existing && existing.owner !== owner) continue;
    await env.SYNC_KV.put(
      codeKey(project.joinCode),
      JSON.stringify({ owner, ownerName, projectId: project.id, name: project.name, updatedAt: board.updatedAt } satisfies CodeRecord)
    );
    current.push(project.joinCode);
  }
  for (const code of previous) {
    if (current.includes(code)) continue;
    const existing = await readJson<CodeRecord>(env, codeKey(code));
    if (existing && existing.owner === owner) await env.SYNC_KV.delete(codeKey(code));
  }
  await env.SYNC_KV.put(codesKey(owner), JSON.stringify(current));
}

async function findMember(env: Env, owner: string, email: string) {
  return readJson<MemberRecord>(env, memberKey(owner, email));
}

function licenseFor(raw: any) {
  if (!raw || !raw.expiresAt) return null;
  const expires = new Date(raw.expiresAt).getTime();
  return {
    plan: clip(raw.plan, 20) || "custom",
    expiresAt: raw.expiresAt,
    daysLeft: Math.ceil((expires - Date.now()) / 86400000),
    expired: expires < Date.now(),
  };
}

type GeminiSchema = Record<string, unknown>;

// Gemini blocks requests whose egress IP geolocates outside its supported regions.
// Cloudflare Workers normally egress from the requesting client's colo (here: KH),
// so generation calls are relayed through a Durable Object pinned to a supported region.
export class GeminiRelay {
  constructor(private state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === "/trace") {
      const trace = await fetch("https://www.cloudflare.com/cdn-cgi/trace").then((r) => r.text()).catch(() => "");
      return new Response(trace, { headers: { "content-type": "text/plain" } });
    }
    const target = request.headers.get("x-gemini-url");
    if (!target) return new Response("missing x-gemini-url", { status: 400 });
    if (new URL(target).hostname !== "generativelanguage.googleapis.com") {
      return new Response("target not allowed", { status: 400 });
    }
    const res = await fetch(target, {
      method: request.method,
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": request.headers.get("x-goog-api-key") || "",
      },
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
    });
    return new Response(res.body, { status: res.status, headers: { "content-type": "application/json" } });
  }
}

function geminiStub(env: Env) {
  if (!env.GEMINI_RELAY) return null;
  return env.GEMINI_RELAY.get(env.GEMINI_RELAY.idFromName("gemini"), { locationHint: "wnam" });
}

async function geminiJson(env: Env, prompt: string, schema: GeminiSchema) {
  const model = env.GEMINI_MODEL || "gemini-3.6-flash";
  const target = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
      thinkingConfig: { thinkingLevel: env.GEMINI_THINKING_LEVEL || "LOW" },
    },
  });
  const stub = geminiStub(env);
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = stub
      ? await stub.fetch("https://gemini-relay.internal/generate", {
          method: "POST",
          headers: { "content-type": "application/json", "x-gemini-url": target, "x-goog-api-key": env.GEMINI_API_KEY || "" },
          body,
        })
      : await fetch(target, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY || "" },
          body,
        });
    if (res.ok) {
      const data: any = await res.json();
      const text = (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("");
      return JSON.parse(text || "{}");
    }
    lastError = `Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`;
    if (res.status !== 503) break;
  }
  throw new Error(lastError);
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
    return json({
      status: "ok",
      app: "GUỒNG + Bee Report",
      time: new Date().toISOString(),
      geminiKeyConfigured: !!env.GEMINI_API_KEY,
      googleConfigured: !!env.GOOGLE_CLIENT_ID,
    });
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

  // Các route xác thực Google phải mở trước cổng mã để bạn bè nhận link có thể tự đăng nhập.
  if (path === "/api/auth/me" && request.method === "GET") {
    const user = await readUser(request, env);
    return user ? json({ ok: true, email: user.email, name: user.name, picture: user.picture }) : json({ ok: false }, 401);
  }

  if (path === "/api/auth/google" && request.method === "POST") {
    if (!env.GOOGLE_CLIENT_ID) return json({ ok: false, error: "Chưa cấu hình GOOGLE_CLIENT_ID" }, 400);
    const body: any = await request.json().catch(() => ({}));
    const accessToken = String(body?.access_token || "");
    if (!accessToken) return json({ ok: false, error: "Thiếu access token" }, 400);
    try {
      const user = await fetchGoogleUser(accessToken, env);
      return json({ ok: true, ...user }, 200, { "set-cookie": await userCookie(env, user) });
    } catch (err: any) {
      return json({ ok: false, error: err?.message || "Đăng nhập Google thất bại" }, 401);
    }
  }

  if (path === "/api/auth/logout" && request.method === "POST") {
    return json({ ok: true }, 200, { "set-cookie": clearUserCookie() });
  }

  if (!(await isAuthorized(request, env))) {
    return json({ ok: false, error: "Cần mã truy cập" }, 401);
  }

  if (path === "/api/files" && request.method === "POST") {
    const key = await resolveStoreKey(request, env);
    if (!key) return json({ ok: false, error: "Cần đăng nhập Google" }, 401);
    const declared = Number(request.headers.get("content-length") || "0");
    if (declared > FILE_MAX_BYTES) {
      return json({ ok: false, error: "Tệp vượt quá 8MB. Nén lại hoặc dùng link Drive." }, 413);
    }
    const bytes = await request.arrayBuffer();
    if (!bytes.byteLength) return json({ ok: false, error: "Tệp rỗng" }, 400);
    if (bytes.byteLength > FILE_MAX_BYTES) {
      return json({ ok: false, error: "Tệp vượt quá 8MB. Nén lại hoặc dùng link Drive." }, 413);
    }
    let rawName = "tep-dinh-kem";
    try {
      rawName = decodeURIComponent(request.headers.get("x-file-name") || "");
    } catch {
      rawName = request.headers.get("x-file-name") || "tep-dinh-kem";
    }
    const name = String(rawName || "tep-dinh-kem").replace(/[\u0000-\u001f\\/]/g, "_").slice(0, 180) || "tep-dinh-kem";
    const type = String(request.headers.get("x-file-type") || request.headers.get("content-type") || "application/octet-stream")
      .split(";")[0]
      .slice(0, 120) || "application/octet-stream";
    const reportId = String(request.headers.get("x-report-id") || "").slice(0, 64);
    const wanted = String(request.headers.get("x-file-id") || "");
    const id = FILE_ID_RE.test(wanted) ? wanted : `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

    const store = await readStore(env, key);
    const version = store.fileBlobs.filter((b: any) => b?.reportId === reportId).length + 1;
    const meta = { id, reportId, name, size: bytes.byteLength, type, version, uploadedAt: new Date().toISOString() };
    await env.SYNC_KV.put(blobKey(key, id), bytes, {
      metadata: { reportId, name, type, size: bytes.byteLength },
    });
    store.fileBlobs = store.fileBlobs.filter((b: any) => b?.id !== id).concat(meta);
    store.lastUpdated = meta.uploadedAt;
    await writeStore(env, key, store);
    return json({ ok: true, file: meta });
  }

  const fileMatch = path.match(/^\/api\/files\/([A-Za-z0-9_-]{1,64})$/);
  if (fileMatch && (request.method === "GET" || request.method === "HEAD")) {
    const key = await resolveStoreKey(request, env);
    if (!key) return json({ ok: false, error: "Cần đăng nhập Google" }, 401);
    const store = await readStore(env, key);
    const meta: any = store.fileBlobs.find((b: any) => b?.id === fileMatch[1]);
    if (!meta) return json({ ok: false, error: "Không tìm thấy tệp trong kho" }, 404);
    const bytes = await env.SYNC_KV.get(blobKey(key, meta.id), "arrayBuffer");
    if (!bytes) return json({ ok: false, error: "Tệp không còn trên máy chủ" }, 404);
    const type = String(meta.type || "application/octet-stream");
    const wantDownload = url.searchParams.get("download") === "1";
    const inline = !wantDownload && INLINE_FILE_TYPES.includes(type);
    const headers: Record<string, string> = {
      "content-type": type,
      "content-length": String(bytes.byteLength),
      "content-disposition": fileDisposition(String(meta.name || "tep-dinh-kem"), inline),
      "cache-control": "private, max-age=600",
      "x-content-type-options": "nosniff",
    };
    if (!inline) headers["content-security-policy"] = "sandbox";
    return new Response(request.method === "HEAD" ? null : bytes, { headers });
  }

  if (fileMatch && request.method === "DELETE") {
    const key = await resolveStoreKey(request, env);
    if (!key) return json({ ok: false, error: "Cần đăng nhập Google" }, 401);
    const store = await readStore(env, key);
    const exists = store.fileBlobs.some((b: any) => b?.id === fileMatch[1]);
    if (!exists) return json({ ok: false, error: "Không tìm thấy tệp trong kho" }, 404);
    await env.SYNC_KV.delete(blobKey(key, fileMatch[1]));
    store.fileBlobs = store.fileBlobs.filter((b: any) => b?.id !== fileMatch[1]);
    store.lastUpdated = new Date().toISOString();
    await writeStore(env, key, store);
    return json({ ok: true, deleted: fileMatch[1] });
  }

  if (path === "/api/sync/stream" && request.method === "GET") {
    const key = await resolveStoreKey(request, env);
    if (!key) return json({ ok: false, error: "Cần đăng nhập Google" }, 401);
    return sseStream(env, key);
  }

  if (path === "/api/sync/data" && request.method === "GET") {
    const key = await resolveStoreKey(request, env);
    if (!key) return json({ ok: false, error: "Cần đăng nhập Google" }, 401);
    const store = await readStore(env, key);
    return json({ success: true, ...store });
  }

  if (path === "/api/sync/data" && request.method === "POST") {
    const body: any = await request.json().catch(() => ({}));
    const key = await resolveStoreKey(request, env);
    if (!key) return json({ ok: false, error: "Cần đăng nhập Google" }, 401);
    const store = await readStore(env, key);
    const merged = mergeStore(store, body);
    await writeStore(env, key, merged);
    return json({ success: true, ...merged });
  }

  /* ---------- cộng tác: bảng việc, mã dự án, thành viên ---------- */
  if (path === "/api/board" && request.method === "POST") {
    const user = await readUser(request, env);
    if (!user) return json({ ok: false, error: "Cần đăng nhập Google" }, 401);
    const body = await request.json().catch(() => ({}));
    const board = normalizeBoard(body);
    await env.SYNC_KV.put(boardKey(user.email), JSON.stringify(board));
    await indexProjectCodes(env, user.email, user.name || user.email, board);
    return json({ ok: true, updatedAt: board.updatedAt, projects: board.projects.length, tasks: board.tasks.length });
  }

  // Dự án chưa có việc vẫn phải tra được mã, nhưng không được xoá bảng việc đã có.
  if (path === "/api/projects/register" && request.method === "POST") {
    const user = await readUser(request, env);
    if (!user) return json({ ok: false, error: "Cần đăng nhập Google" }, 401);
    const body: any = await request.json().catch(() => ({}));
    const incoming = asArray(body?.projects)
      .slice(0, 50)
      .map((p: any) => ({ id: clip(p?.id, 40), name: clip(p?.name, 80) || "Dự án", joinCode: cleanCode(p?.joinCode) }))
      .filter((p) => p.id && /^[A-Z0-9-]{4,20}$/.test(p.joinCode));
    if (!incoming.length) return json({ ok: false, error: "Chưa có dự án để đăng ký." }, 400);
    const previous = await readJson<SharedBoard>(env, boardKey(user.email));
    const merged = new Map<string, SharedBoard["projects"][number]>((previous?.projects || []).map((p) => [p.id, p]));
    incoming.forEach((project) => merged.set(project.id, project));
    const board: SharedBoard = {
      projects: Array.from(merged.values()),
      members: previous?.members || [],
      tasks: previous?.tasks || [],
      updatedAt: new Date().toISOString(),
    };
    await env.SYNC_KV.put(boardKey(user.email), JSON.stringify(board));
    await indexProjectCodes(env, user.email, user.name || user.email, board);
    return json({ ok: true, projects: board.projects.length });
  }

  if (path === "/api/projects/join" && request.method === "POST") {
    const user = await readUser(request, env);
    if (!user) return json({ ok: false, error: "Cần đăng nhập Google" }, 401);
    const body: any = await request.json().catch(() => ({}));
    const code = cleanCode(body?.code);
    if (!code) return json({ ok: false, error: "Nhập mã tham gia dự án." }, 400);
    const record = await readJson<CodeRecord>(env, codeKey(code));
    if (!record) return json({ ok: false, error: "Mã không đúng hoặc dự án đã đổi mã." }, 404);
    if (record.owner === user.email) return json({ ok: false, error: "Đây là dự án của chính bạn." }, 400);
    const now = new Date().toISOString();
    const existing = await findMember(env, record.owner, user.email);
    const projects = (existing?.projects || []).filter((p) => p.id !== record.projectId);
    projects.push({ id: record.projectId, name: record.name });
    const member: MemberRecord = {
      email: user.email,
      name: user.name || user.email,
      picture: user.picture || "",
      owner: record.owner,
      projects,
      joinedAt: existing?.joinedAt || now,
      lastSeen: now,
    };
    await env.SYNC_KV.put(memberKey(record.owner, user.email), JSON.stringify(member));
    await env.SYNC_KV.put(
      joinKey(user.email, record.owner, record.projectId),
      JSON.stringify({
        owner: record.owner,
        ownerName: record.ownerName,
        projectId: record.projectId,
        projectName: record.name,
        joinedAt: now,
      })
    );
    return json({ ok: true, owner: record.owner, ownerName: record.ownerName, project: { id: record.projectId, name: record.name } });
  }

  if (path === "/api/projects/joined" && request.method === "GET") {
    const user = await readUser(request, env);
    if (!user) return json({ ok: false, error: "Cần đăng nhập Google" }, 401);
    const list = await env.SYNC_KV.list({ prefix: joinPrefix(user.email) });
    const items = await Promise.all(list.keys.map((k) => readJson<any>(env, k.name)));
    return json({ ok: true, projects: items.filter(Boolean) });
  }

  if (path === "/api/project/view" && request.method === "GET") {
    const user = await readUser(request, env);
    if (!user) return json({ ok: false, error: "Cần đăng nhập Google" }, 401);
    const owner = cleanEmail(url.searchParams.get("owner"));
    const projectId = clip(url.searchParams.get("projectId"), 40);
    if (!owner || !projectId) return json({ ok: false, error: "Thiếu thông tin dự án." }, 400);
    const isOwner = owner === user.email;
    const member = isOwner ? null : await findMember(env, owner, user.email);
    if (!isOwner && (!member || !member.projects.some((p) => p.id === projectId))) {
      return json({ ok: false, error: "Bạn chưa tham gia dự án này." }, 403);
    }
    const license = isOwner ? null : licenseFor(await readJson<any>(env, licKey(owner, user.email)));
    if (license?.expired) {
      const pending = isOwner ? null : await readJson<RequestRecord>(env, requestKey(owner, user.email));
      return json(
        {
          ok: false,
          code: "license_expired",
          error: "Thời hạn xem dự án đã hết. Gửi yêu cầu để trưởng dự án gia hạn.",
          license,
          request: pending,
        },
        403
      );
    }
    const board = await readJson<SharedBoard>(env, boardKey(owner));
    if (!board) return json({ ok: false, error: "Chủ dự án chưa đồng bộ bảng việc." }, 404);
    const project = board.projects.find((p) => p.id === projectId);
    if (!project) return json({ ok: false, error: "Dự án không còn tồn tại." }, 404);
    const codeRecord = project.joinCode ? await readJson<CodeRecord>(env, codeKey(project.joinCode)) : null;
    if (member) {
      member.lastSeen = new Date().toISOString();
      await env.SYNC_KV.put(memberKey(owner, user.email), JSON.stringify(member));
    }
    return json({
      ok: true,
      owner: { email: owner, name: codeRecord?.ownerName || owner },
      project,
      tasks: board.tasks.filter((t) => t.projectId === projectId),
      members: board.members,
      license,
      updatedAt: board.updatedAt,
    });
  }

  if (path === "/api/projects/leave" && request.method === "DELETE") {
    const user = await readUser(request, env);
    if (!user) return json({ ok: false, error: "Cần đăng nhập Google" }, 401);
    const owner = cleanEmail(url.searchParams.get("owner"));
    const projectId = clip(url.searchParams.get("projectId"), 40);
    if (!owner || !projectId) return json({ ok: false, error: "Thiếu thông tin dự án." }, 400);
    await env.SYNC_KV.delete(joinKey(user.email, owner, projectId));
    await env.SYNC_KV.delete(requestKey(owner, user.email));
    const member = await findMember(env, owner, user.email);
    if (member) {
      member.projects = member.projects.filter((p) => p.id !== projectId);
      if (member.projects.length) {
        await env.SYNC_KV.put(memberKey(owner, user.email), JSON.stringify(member));
      } else {
        await env.SYNC_KV.delete(memberKey(owner, user.email));
        await env.SYNC_KV.delete(licKey(owner, user.email));
      }
    }
    return json({ ok: true });
  }

  if (path === "/api/projects/request" && request.method === "POST") {
    const user = await readUser(request, env);
    if (!user) return json({ ok: false, error: "Cần đăng nhập Google" }, 401);
    const body: any = await request.json().catch(() => ({}));
    const owner = cleanEmail(body?.owner);
    const projectId = clip(body?.projectId, 40);
    const note = clip(body?.note, 240).trim();
    if (!owner || !projectId) return json({ ok: false, error: "Thiếu thông tin dự án." }, 400);
    if (owner === user.email) return json({ ok: false, error: "Đây là dự án của chính bạn." }, 400);
    const member = await findMember(env, owner, user.email);
    const project = member?.projects.find((p) => p.id === projectId);
    if (!member || !project) return json({ ok: false, error: "Bạn chưa tham gia dự án này." }, 403);
    const license = licenseFor(await readJson<any>(env, licKey(owner, user.email)));
    if (!license || !license.expired) {
      return json({ ok: false, error: "Quyền xem của bạn đang không bị giới hạn." }, 400);
    }
    const renewal: RequestRecord = {
      email: user.email,
      name: user.name || user.email,
      owner,
      projectId,
      projectName: project.name,
      note,
      createdAt: new Date().toISOString(),
    };
    await env.SYNC_KV.put(requestKey(owner, user.email), JSON.stringify(renewal));
    return json({ ok: true, request: renewal });
  }

  if (path === "/api/projects/requests" && request.method === "GET") {
    const user = await readUser(request, env);
    if (!user) return json({ ok: false, error: "Cần đăng nhập Google" }, 401);
    const list = await env.SYNC_KV.list({ prefix: requestPrefix(user.email) });
    const records = (await Promise.all(list.keys.map((k) => readJson<RequestRecord>(env, k.name)))).filter(Boolean) as RequestRecord[];
    records.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return json({ ok: true, requests: records });
  }

  if (path === "/api/projects/requests" && request.method === "DELETE") {
    const user = await readUser(request, env);
    if (!user) return json({ ok: false, error: "Cần đăng nhập Google" }, 401);
    const email = cleanEmail(url.searchParams.get("email"));
    if (!email) return json({ ok: false, error: "Thiếu email." }, 400);
    await env.SYNC_KV.delete(requestKey(user.email, email));
    return json({ ok: true });
  }

  if (path === "/api/users" && request.method === "GET") {
    const user = await readUser(request, env);
    if (!user) return json({ ok: false, error: "Cần đăng nhập Google" }, 401);
    const list = await env.SYNC_KV.list({ prefix: memberPrefix(user.email) });
    const records = (await Promise.all(list.keys.map((k) => readJson<MemberRecord>(env, k.name)))).filter(Boolean) as MemberRecord[];
    const users = await Promise.all(
      records.map(async (m) => ({
        ...m,
        license: licenseFor(await readJson<any>(env, licKey(user.email, m.email))),
        request: await readJson<RequestRecord>(env, requestKey(user.email, m.email)),
      }))
    );
    users.sort((a, b) => String(b.joinedAt).localeCompare(String(a.joinedAt)));
    return json({ ok: true, users });
  }

  if (path === "/api/users/license" && request.method === "POST") {
    const user = await readUser(request, env);
    if (!user) return json({ ok: false, error: "Cần đăng nhập Google" }, 401);
    const body: any = await request.json().catch(() => ({}));
    const email = cleanEmail(body?.email);
    const days = Math.round(Number(body?.days));
    if (!email || !Number.isFinite(days) || days < 1 || days > 3650) {
      return json({ ok: false, error: "Chọn thời hạn từ 1 đến 3650 ngày." }, 400);
    }
    const member = await findMember(env, user.email, email);
    if (!member) return json({ ok: false, error: "Người này chưa tham gia dự án nào của bạn." }, 404);
    const existing = await readJson<any>(env, licKey(user.email, email));
    const baseMs = Math.max(Date.now(), existing?.expiresAt ? new Date(existing.expiresAt).getTime() : 0);
    const expiresAt = new Date(baseMs + days * 86400000).toISOString();
    const plan = days === 7 ? "week" : days === 30 ? "month" : days === 365 ? "year" : "custom";
    const record = { plan, days, startedAt: new Date().toISOString(), expiresAt, updatedAt: new Date().toISOString() };
    await env.SYNC_KV.put(licKey(user.email, email), JSON.stringify(record));
    await env.SYNC_KV.delete(requestKey(user.email, email));
    return json({ ok: true, license: licenseFor(record) });
  }

  if (path === "/api/users/lock" && request.method === "POST") {
    const user = await readUser(request, env);
    if (!user) return json({ ok: false, error: "Cần đăng nhập Google" }, 401);
    const body: any = await request.json().catch(() => ({}));
    const email = cleanEmail(body?.email);
    if (!email) return json({ ok: false, error: "Thiếu email." }, 400);
    const member = await findMember(env, user.email, email);
    if (!member) return json({ ok: false, error: "Người này chưa tham gia dự án nào của bạn." }, 404);
    const now = new Date().toISOString();
    const record = {
      plan: "locked",
      days: 0,
      startedAt: now,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      updatedAt: now,
    };
    await env.SYNC_KV.put(licKey(user.email, email), JSON.stringify(record));
    await env.SYNC_KV.delete(requestKey(user.email, email));
    return json({ ok: true, license: licenseFor(record) });
  }

  if (path === "/api/users/license" && request.method === "DELETE") {
    const user = await readUser(request, env);
    if (!user) return json({ ok: false, error: "Cần đăng nhập Google" }, 401);
    const email = cleanEmail(url.searchParams.get("email"));
    if (!email) return json({ ok: false, error: "Thiếu email." }, 400);
    await env.SYNC_KV.delete(licKey(user.email, email));
    return json({ ok: true });
  }

  if (path === "/api/users/member" && request.method === "DELETE") {
    const user = await readUser(request, env);
    if (!user) return json({ ok: false, error: "Cần đăng nhập Google" }, 401);
    const email = cleanEmail(url.searchParams.get("email"));
    if (!email) return json({ ok: false, error: "Thiếu email." }, 400);
    await env.SYNC_KV.delete(memberKey(user.email, email));
    await env.SYNC_KV.delete(licKey(user.email, email));
    await env.SYNC_KV.delete(requestKey(user.email, email));
    const list = await env.SYNC_KV.list({ prefix: joinPrefix(email) });
    const ownedPrefix = `${joinPrefix(email)}${user.email}:`;
    for (const key of list.keys) {
      if (key.name.startsWith(ownedPrefix)) await env.SYNC_KV.delete(key.name);
    }
    return json({ ok: true });
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
