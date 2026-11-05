/* ============================================================
   GUỒNG — Kho báo cáo (nền tảng Bee: KV + SSE + tệp + AI + Chú Ong)
   ============================================================ */
(function () {
  "use strict";

  const A = window.App;
  if (!A) return;

  const GOOGLE_CLIENT_ID = "777663854457-0ghqdqjn3hoahavpthcafafn741etg8v.apps.googleusercontent.com";
  const CATEGORIES = ["Báo cáo ngày", "Báo cáo tuần", "Báo cáo tháng", "Tài liệu khác"];
  const STATUSES = ["To-do", "In Progress", "Pending Review", "Done", "Sent"];
  const STATUS_LABEL = {
    "To-do": "Chờ làm",
    "In Progress": "Đang làm",
    "Pending Review": "Chờ duyệt",
    Done: "Hoàn thành",
    Sent: "Đã gửi",
  };
  const STATUS_CLASS = {
    "To-do": "todo",
    "In Progress": "doing",
    "Pending Review": "review",
    Done: "done",
    Sent: "sent",
  };
  const FREQ_LABEL = { none: "Không định kỳ", daily: "Hàng ngày", weekly: "Hàng tuần", monthly: "Hàng tháng", yearly: "Hàng năm" };
  const FREQ_VALUES = ["none", "daily", "weekly", "monthly", "yearly"];
  const ACTION_LABEL = {
    create: "Tạo báo cáo",
    update: "Cập nhật",
    submit: "Nộp báo cáo",
    upload: "Tải tệp lên",
    removefile: "Xoá tệp",
    pin: "Ghim / bỏ ghim",
    delete: "Xoá báo cáo",
    ai: "Chấm điểm AI",
    cycle: "Chuyển kỳ",
    import: "Nhập dữ liệu",
    excel: "Bảng tính Excel",
  };
  const MAX_FILE_BYTES = 8 * 1024 * 1024;

  const weeklyRenderer = A.renderReports;
  const esc = A.esc;

  const R = {
    booted: false,
    loading: false,
    loaded: false,
    offline: false,
    needCode: false,
    codeRequired: false,
    user: null,
    reports: [],
    refDocs: [],
    fileBlobs: [],
    auditLogs: [],
    tombstones: [],
    tab: "vault",
    q: "",
    status: "all",
    category: "all",
    focusFilter: "all",
    sync: "idle",
    signingIn: false,
    tokenClient: null,
    sse: null,
    refreshTimer: null,
    timer: null,
    detailId: null,
    detailTab: "content",
    detailOverlay: null,
    extendOverlay: null,
    beeOpen: false,
    pinOpen: false,
    beePulse: 0,
    notify: false,
    aiBusy: null,
    aiError: "",
    dayStamp: "",
  };

  /* ---------- tiện ích ---------- */
  function reportId() {
    return A.uid ? A.uid("rp") : `rp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }
  function findReport(id) {
    return R.reports.find((item) => item.id === id) || null;
  }
  function sortReports(list) {
    return (list || []).slice().sort((a, b) => {
      if (Boolean(b.pinned) !== Boolean(a.pinned)) return b.pinned ? 1 : -1;
      return String(b.date || "").localeCompare(String(a.date || ""));
    });
  }
  function statusChip(status) {
    return `<span class="rp-st rp-st-${STATUS_CLASS[status] || "todo"}">${esc(STATUS_LABEL[status] || status || "Chờ làm")}</span>`;
  }
  function shortDate(iso) {
    const parts = String(iso || "").split("-");
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(iso || "");
  }
  function fileDate(iso) {
    const parts = String(iso || "").split("-");
    return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : "";
  }
  function removeDiacritics(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  }
  function driveUrl(report) {
    const link = A.safeUrl ? A.safeUrl(report.webViewLink) : report.webViewLink;
    if (link) return link;
    if (report.driveFileId) return `https://drive.google.com/file/d/${encodeURIComponent(report.driveFileId)}/view`;
    return "";
  }
  function safeHref(value) {
    const url = A.safeUrl ? A.safeUrl(value) : "";
    return url || "";
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function downloadReportCsv(report) {
    rollRecurringReports({ silent: true });
    const rows = [
      ["Tiêu đề", report.title || ""],
      ["Dự án", report.project || ""],
      ["Danh mục", report.category || ""],
      ["Ngày", shortDate(report.date)],
      ["Hạn nộp", shortDate(report.dueDate)],
      ["Trạng thái", STATUS_LABEL[report.status] || report.status || ""],
      ["Phiên bản", `v${Number(report.version) || 1}`],
      ["Nội dung", report.notes || ""],
      ["Tóm tắt AI", report.aiSummary || ""],
      ["Việc tiếp theo", (report.aiActionItems || []).join("; ")],
    ];
    const csv = "\uFEFF" + rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const name = `${fileDate(report.date)}_${removeDiacritics(report.title) || "BaoCao"}.csv`;
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), name);
    return name;
  }
  function zaloPhone(value) {
    let clean = String(value || "").replace(/\D/g, "");
    if (!clean) return "84912345678";
    if (clean.startsWith("0")) clean = `84${clean.slice(1)}`;
    else if (!clean.startsWith("84")) clean = `84${clean}`;
    return clean;
  }
  function isDone(report) {
    return report.status === "Sent" || report.status === "Done";
  }
  function inferFrequency(category) {
    if (category === "Báo cáo ngày") return "daily";
    if (category === "Báo cáo tuần") return "weekly";
    if (category === "Báo cáo tháng") return "monthly";
    return "none";
  }
  function shiftCycle(baseIso, freq, step) {
    const dt = A.parseISO(baseIso) || new Date();
    if (freq === "monthly" || freq === "yearly") {
      const day = dt.getDate();
      const month = dt.getMonth();
      const target = freq === "monthly" ? new Date(dt.getFullYear(), month + step, 1) : new Date(dt.getFullYear() + step, month, 1);
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
      target.setDate(Math.min(day, lastDay));
      return A.dateISO(target);
    }
    return A.addDays(baseIso, step * (freq === "weekly" ? 7 : 1));
  }
  function nextDueDate(report) {
    const freq = report.frequency;
    if (!freq || freq === "none") return "";
    const base = report.dueDate || report.date || A.todayISO();
    const today = A.todayISO();
    if (base > today) return base;
    const gap = A.diffDays(base, today);
    if (freq === "daily") return shiftCycle(base, "daily", gap + 1);
    if (freq === "weekly") return shiftCycle(base, "weekly", Math.floor(gap / 7) + 1);
    let step = 1;
    let out = shiftCycle(base, freq, step);
    while (out <= today && step < 600) {
      step += 1;
      out = shiftCycle(base, freq, step);
    }
    return out;
  }

  /* Số kỳ cần cộng để mốc báo cáo bắt kịp kỳ hiện tại (không vượt quá hôm nay). */
  function periodSteps(baseIso, freq, today) {
    if (!baseIso || !today || baseIso >= today) return 0;
    const gap = A.diffDays(baseIso, today);
    if (gap <= 0) return 0;
    if (freq === "daily") return gap;
    if (freq === "weekly") return Math.floor(gap / 7);
    let steps = 0;
    while (steps < 600 && shiftCycle(baseIso, freq, steps + 1) <= today) steps += 1;
    return steps;
  }

  function rollReportToPeriod(report, today) {
    const freq = report.frequency;
    if (!freq || freq === "none") return "";
    const base = report.date || "";
    if (!base) return "";
    const steps = periodSteps(base, freq, today);
    if (steps <= 0) return "";
    const next = shiftCycle(base, freq, steps);
    const oldDue = report.dueDate || "";
    report.date = next;
    report.dueDate = oldDue ? shiftCycle(oldDue, freq, steps) : next;
    report.updatedAt = new Date().toISOString();
    logAction(report, "cycle", `Tự chuyển kỳ ${shortDate(base)} → ${shortDate(next)}`);
    return next;
  }

  /* Báo cáo định kỳ tự bắt kịp ngày/tuần/tháng/năm hiện tại; báo cáo đã chốt chỉ
     quay lại kỳ mới khi chuỗi chưa có báo cáo đang mở kế tiếp. */
  function rollRecurringReports(options) {
    const opts = options || {};
    if (!R.loaded || !R.reports.length) return 0;
    const today = A.todayISO();
    R.dayStamp = today;
    const openSeries = new Set();
    R.reports.forEach((report) => {
      if (!report.frequency || report.frequency === "none") return;
      if (!isDone(report)) openSeries.add(report.seriesId || report.id);
    });
    let count = 0;
    R.reports.forEach((report) => {
      if (!report.frequency || report.frequency === "none") return;
      const done = isDone(report);
      if (done && openSeries.has(report.seriesId || report.id)) return;
      const next = rollReportToPeriod(report, today);
      if (!next) return;
      if (done) {
        report.status = "To-do";
        report.lastProcessedDate = today;
      }
      count += 1;
    });
    if (!count) return 0;
    R.reports = sortReports(R.reports);
    broadcastReminders();
    push().catch(() => {});
    if (opts.silent) scheduleRefresh();
    else refresh();
    if (opts.notify) {
      A.toast(`Đã tự chuyển ${count} báo cáo định kỳ sang kỳ mới.`, "success");
    }
    return count;
  }

  function refresh() {
    broadcastReminders();
    if (A.view !== "reports") return;
    A.render({ animate: false });
    if (R.detailId) refreshDetail();
  }

  /* ---------- nhắc báo cáo cho trang Tổng quan ---------- */
  function reminderSummary() {
    const today = A.todayISO();
    const buckets = { today: [], tomorrow: [], late: [], week: [] };
    R.reports.forEach((report) => {
      if (isDone(report)) return;
      const iso = report.dueDate || report.date;
      if (!iso) return;
      const gap = A.daysFromToday(iso);
      const item = {
        id: report.id,
        title: report.title || "Báo cáo",
        project: report.project || "",
        category: report.category || "",
        due: iso,
        gap,
        reminderTime: report.reminderTime || "",
        frequency: report.frequency || "none",
      };
      if (gap < 0) buckets.late.push(item);
      else if (gap === 0) buckets.today.push(item);
      else if (gap === 1) buckets.tomorrow.push(item);
      else if (gap <= 7) buckets.week.push(item);
    });
    const byDue = (a, b) => a.due.localeCompare(b.due) || String(a.reminderTime).localeCompare(String(b.reminderTime));
    Object.keys(buckets).forEach((key) => buckets[key].sort(byDue));
    return Object.assign({ loaded: R.loaded, signedIn: Boolean(R.user) }, buckets);
  }
  function broadcastReminders() {
    try {
      window.dispatchEvent(new CustomEvent("guong:reports", { detail: reminderSummary() }));
    } catch (err) {
      /* trình duyệt cũ — bỏ qua */
    }
  }
  A.reportReminders = reminderSummary;
  A.openReport = function (id) {
    const go = () => {
      if (!findReport(id)) {
        A.toast("Chưa tải được báo cáo này. Đăng nhập Google để xem kho báo cáo.", "info");
        return;
      }
      openDetail(id);
    };
    if (A.view !== "reports") {
      A.go("reports");
      window.setTimeout(go, 90);
    } else {
      go();
    }
  };
  function scheduleRefresh() {
    window.clearTimeout(R.refreshTimer);
    R.refreshTimer = window.setTimeout(refresh, 250);
  }
  function jfetch(url, options) {
    const opts = Object.assign({ credentials: "same-origin" }, options || {});
    return fetch(url, opts).then(async (res) => {
      const type = res.headers.get("content-type") || "";
      if (!type.includes("application/json")) {
        const err = new Error("API chưa sẵn sàng trên địa chỉ này.");
        err.offline = true;
        throw err;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data.error || `Máy chủ trả về ${res.status}`);
        err.status = res.status;
        throw err;
      }
      return data;
    });
  }

  /* ---------- audit ---------- */
  function logAction(report, action, detail) {
    const entry = {
      id: A.uid ? A.uid("log") : `log-${Date.now().toString(36)}`,
      reportId: report ? report.id : "",
      reportTitle: report ? report.title || "" : "",
      action,
      detail: detail || "",
      actor: R.user ? R.user.email : "",
      timestamp: new Date().toISOString(),
    };
    R.auditLogs = [entry].concat(R.auditLogs || []).slice(0, 200);
    return entry;
  }

  /* ---------- kiểm tra sẵn sàng ---------- */
  function isExcelFile(file) {
    return Boolean(file && String(file.role || "").startsWith("excel-"));
  }
  function excelReady(report) {
    const excel = report && report.excel;
    if (!excel || !excel.templateId) return false;
    return Boolean(excel.latestId) || excel.mode === "grid";
  }
  function reportFiles(report) {
    return (R.fileBlobs || [])
      .filter((file) => file && file.reportId === report.id && !isExcelFile(file))
      .sort((a, b) => String(b.uploadedAt || "").localeCompare(String(a.uploadedAt || "")));
  }
  function readiness(report) {
    const issues = [];
    const files = reportFiles(report);
    if (!files.length && !driveUrl(report) && !excelReady(report)) {
      issues.push({ key: "file", label: "Chưa có tệp đính kèm", severity: "high", fix: "files" });
    }
    if (!String(report.notes || "").trim()) {
      issues.push({ key: "notes", label: "Chưa có nội dung", severity: "high", fix: "edit" });
    }
    if (!String(report.submissionUrl || "").trim()) {
      issues.push({ key: "submit", label: "Chưa có link nộp", severity: "medium", fix: "schedule" });
    }
    if (!String(report.zaloPhone || "").trim()) {
      issues.push({ key: "zalo", label: "Chưa có SĐT Zalo duyệt", severity: "medium", fix: "schedule" });
    }
    if (!isDone(report) && report.dueDate && report.dueDate < A.todayISO()) {
      issues.push({ key: "late", label: "Đã quá hạn nộp", severity: "high", fix: "submit" });
    }
    if (!Number(report.aiQualityScore)) {
      issues.push({ key: "ai", label: "Chưa chấm điểm AI", severity: "low", fix: "ai" });
    }
    return issues;
  }
  function dueBadge(report) {
    const iso = report.dueDate || report.date;
    if (!iso) return null;
    if (isDone(report)) return { cls: "ok", text: `Xong ${shortDate(iso)}` };
    const gap = A.daysFromToday(iso);
    if (gap < 0) return { cls: "late", text: `Quá hạn ${-gap} ngày` };
    if (gap === 0) return { cls: "today", text: "Hạn hôm nay" };
    if (gap <= 3) return { cls: "soon", text: `Còn ${gap} ngày` };
    return { cls: "", text: `Hạn ${shortDate(iso)}` };
  }
  function fileSize(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1048576) return `${Math.round(n / 1024)} KB`;
    return `${(n / 1048576).toFixed(1)} MB`;
  }

  /* ---------- số liệu ---------- */
  function metrics() {
    const today = A.todayISO();
    const total = R.reports.length;
    const pinned = R.reports.filter((r) => r.pinned).length;
    const todayList = R.reports.filter((r) => !isDone(r) && (r.dueDate === today || (!r.dueDate && r.date === today)));
    const late = R.reports.filter((r) => !isDone(r) && r.dueDate && r.dueDate < today);
    const sent = R.reports.filter((r) => r.status === "Sent");
    const done = R.reports.filter((r) => r.status === "Done");
    const scored = R.reports.filter((r) => Number(r.aiQualityScore) > 0);
    const avgScore = scored.length ? Math.round(scored.reduce((sum, r) => sum + Number(r.aiQualityScore), 0) / scored.length) : 0;
    const missing = R.reports.filter((r) => !isDone(r) && readiness(r).some((i) => i.severity !== "low"));
    return { total, pinned, todayList, late, sent, done, avgScore, scored, missing };
  }
  function categoryStats() {
    const map = new Map(CATEGORIES.map((c) => [c, 0]));
    R.reports.forEach((r) => {
      const key = CATEGORIES.includes(r.category) ? r.category : "Tài liệu khác";
      map.set(key, (map.get(key) || 0) + 1);
    });
    const rows = Array.from(map.entries()).filter(([, n]) => n > 0);
    const max = rows.reduce((m, [, n]) => Math.max(m, n), 1);
    return rows.map(([label, count]) => ({ label, count, pct: Math.round((count / max) * 100) }));
  }
  function attention() {
    const m = metrics();
    const ids = new Set();
    m.todayList.concat(m.late, m.missing).forEach((r) => ids.add(r.id));
    return Array.from(ids).map(findReport).filter(Boolean);
  }

  /* ---------- chỉ số trực quan ---------- */
  const FOCUS_LABEL = { all: "Tất cả báo cáo", today: "Cần xử lý hôm nay", late: "Quá hạn", sent: "Đã gửi" };

  function readinessScore(report) {
    const issues = readiness(report);
    let score = 100;
    issues.forEach((item) => {
      score -= item.severity === "high" ? 22 : item.severity === "medium" ? 11 : 4;
    });
    return Math.max(0, Math.min(100, score));
  }

  function readinessParts(report) {
    const files = reportFiles(report);
    return [
      { key: "file", label: "Tệp đính kèm", ok: Boolean(files.length || driveUrl(report) || excelReady(report)) },
      { key: "notes", label: "Nội dung", ok: Boolean(String(report.notes || "").trim()) },
      { key: "submit", label: "Link nộp", ok: Boolean(String(report.submissionUrl || "").trim()) },
      { key: "zalo", label: "SĐT Zalo duyệt", ok: Boolean(String(report.zaloPhone || "").trim()) },
    ];
  }

  function healthSnapshot() {
    const m = metrics();
    const active = R.reports.filter((r) => !isDone(r));
    const ready = active.filter((r) => readinessScore(r) >= 78).length;
    const avgReady = R.reports.length
      ? Math.round(R.reports.reduce((sum, r) => sum + readinessScore(r), 0) / R.reports.length)
      : 0;
    const submitted = R.reports.filter((r) => r.status === "Sent" || r.status === "Done").length;
    const share = R.reports.length ? Math.round((submitted / R.reports.length) * 100) : 0;
    const score = Math.max(0, Math.min(100, Math.round(avgReady * 0.7 + share * 0.3 - m.late.length * 4)));
    const label = score >= 85 ? "Rất tốt" : score >= 65 ? "Ổn định" : score >= 40 ? "Cần chú ý" : "Rủi ro";
    const tone = score >= 85 ? "ok" : score >= 65 ? "accent" : score >= 40 ? "warn" : "danger";
    return Object.assign({}, m, { active, ready, avgReady, submitted, share, score, label, tone });
  }

  function weekPulse() {
    const days = [];
    const map = new Map();
    for (let i = 6; i >= 0; i -= 1) {
      const iso = A.addDays(A.todayISO(), -i);
      const row = { iso, label: A.weekdayShort(iso), sent: 0, due: 0, isToday: i === 0 };
      days.push(row);
      map.set(iso, row);
    }
    R.reports.forEach((report) => {
      const sentIso = report.lastSentAt
        ? String(report.lastSentAt).slice(0, 10)
        : report.status === "Sent"
          ? String(report.date || "")
          : "";
      const sentSlot = map.get(sentIso);
      if (sentSlot) sentSlot.sent += 1;
      const dueSlot = map.get(String(report.dueDate || ""));
      if (dueSlot) dueSlot.due += 1;
    });
    const max = days.reduce((top, row) => Math.max(top, row.sent), 0);
    return {
      days: days.map((row) => Object.assign({}, row, { pct: max ? Math.round((row.sent / max) * 100) : 0 })),
      total: days.reduce((sum, row) => sum + row.sent, 0),
      max,
    };
  }

  function weekLabel() {
    return `TUẦN ${A.weekNumber(A.todayISO())} · ${A.longDateVN(A.todayISO()).toUpperCase()}`;
  }

  function greetingName() {
    const raw = String((R.user && R.user.name) || "").trim();
    if (!raw || raw.includes("@")) return "";
    const words = raw.split(/\s+/);
    return words[words.length - 1];
  }

  function greetingTime() {
    const hour = new Date().getHours();
    if (hour < 11) return "Chào buổi sáng";
    if (hour < 14) return "Chào buổi trưa";
    if (hour < 18) return "Chào buổi chiều";
    return "Chào buổi tối";
  }

  function statusCounts() {
    const counts = { "To-do": 0, "In Progress": 0, "Pending Review": 0, Done: 0, Sent: 0 };
    R.reports.forEach((report) => {
      const key = counts[report.status] !== undefined ? report.status : "To-do";
      counts[key] += 1;
    });
    return counts;
  }

  function categoryShare() {
    const total = R.reports.length || 1;
    return categoryStats().map((row) => ({
      label: row.label,
      count: row.count,
      pct: Math.max(3, Math.round((row.count / total) * 100)),
    }));
  }

  /* ---------- kết nối dữ liệu ---------- */
  async function boot() {
    R.loading = true;
    R.needCode = false;
    R.codeRequired = false;
    refresh();
    try {
      await jfetch("/api/auth/status");
    } catch (err) {
      if (err.status === 401) {
        // Có mã dùng chung nhưng người dùng vẫn có thể đăng nhập Google trước.
        R.codeRequired = true;
      } else if (err.offline) {
        R.offline = true;
        R.loading = false;
        refresh();
        return;
      } else {
        A.toast(err.message || "Không kiểm tra được máy chủ.", "error");
        R.loading = false;
        refresh();
        return;
      }
    }
    await loadSession();
    if (R.user) {
      try {
        await loadData();
        subscribe();
        autoAdvance();
      } catch (err) {
        if (err.status === 401) R.needCode = true;
        else A.toast(err.message || "Không tải được báo cáo.", "error");
      }
    }
    startClock();
    R.loading = false;
    refresh();
  }

  async function loadSession() {
    try {
      const data = await jfetch("/api/auth/me");
      R.user = { email: data.email, name: data.name, picture: data.picture };
    } catch (err) {
      if (err.offline) R.offline = true;
      R.user = null;
    }
  }

  async function loadData() {
    const data = await jfetch("/api/sync/data");
    R.reports = sortReports(Array.isArray(data.reports) ? data.reports : []);
    R.refDocs = Array.isArray(data.refDocs) ? data.refDocs : [];
    R.fileBlobs = Array.isArray(data.fileBlobs) ? data.fileBlobs : [];
    R.auditLogs = Array.isArray(data.auditLogs) ? data.auditLogs : [];
    R.tombstones = Array.isArray(data.deletedReportIds) ? data.deletedReportIds : [];
    R.loaded = true;
  }

  async function push(deleted) {
    R.sync = "syncing";
    updateSyncBadge();
    try {
      const data = await jfetch("/api/sync/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reports: R.reports,
          refDocs: R.refDocs,
          auditLogs: R.auditLogs,
          deletedReportIds: deleted || [],
          lastUpdated: new Date().toISOString(),
        }),
      });
      R.reports = sortReports(data.reports || R.reports);
      R.refDocs = Array.isArray(data.refDocs) ? data.refDocs : R.refDocs;
      R.fileBlobs = Array.isArray(data.fileBlobs) ? data.fileBlobs : R.fileBlobs;
      R.auditLogs = Array.isArray(data.auditLogs) ? data.auditLogs : R.auditLogs;
      R.tombstones = Array.isArray(data.deletedReportIds) ? data.deletedReportIds : R.tombstones;
      R.sync = "synced";
      updateSyncBadge();
      return data;
    } catch (err) {
      R.sync = "error";
      updateSyncBadge();
      if (err.status === 401) R.needCode = true;
      throw err;
    }
  }

  function updateSyncBadge() {
    document.querySelectorAll("[data-rp-sync]").forEach((el) => {
      el.className = `rp-sync rp-sync-${R.sync}`;
      el.textContent = syncLabel();
    });
  }

  function syncLabel() {
    return R.sync === "syncing" ? "Đang đồng bộ…" : R.sync === "error" ? "Lỗi đồng bộ" : R.sync === "synced" ? "Đã đồng bộ KV" : "Sẵn sàng";
  }

  function subscribe() {
    if (R.sse) return;
    try {
      R.sse = new EventSource("/api/sync/stream");
      R.sse.onmessage = (event) => {
        if (!event.data) return;
        try {
          const payload = JSON.parse(event.data);
          if ((payload.type === "SYNC_INIT" || payload.type === "SYNC_UPDATE") && Array.isArray(payload.reports)) {
            const before = JSON.stringify(R.reports);
            R.reports = sortReports(payload.reports);
            R.refDocs = Array.isArray(payload.refDocs) ? payload.refDocs : R.refDocs;
            R.fileBlobs = Array.isArray(payload.fileBlobs) ? payload.fileBlobs : R.fileBlobs;
            R.auditLogs = Array.isArray(payload.auditLogs) ? payload.auditLogs : R.auditLogs;
            R.tombstones = Array.isArray(payload.deletedReportIds) ? payload.deletedReportIds : R.tombstones;
            R.loaded = true;
            R.sync = "synced";
            updateSyncBadge();
            if (JSON.stringify(R.reports) !== before) scheduleRefresh();
          }
        } catch (err) {
          /* bỏ qua gói tin hỏng */
        }
      };
      R.sse.onerror = () => {
        R.sync = "error";
        updateSyncBadge();
      };
    } catch (err) {
      /* EventSource không hỗ trợ */
    }
  }

  function autoAdvance() {
    return rollRecurringReports();
  }

  function touchDay() {
    if (!R.loaded) return;
    if (R.dayStamp === A.todayISO()) return;
    rollRecurringReports({ notify: true });
  }

  /* ---------- thao tác 1 chạm: hoàn thành / gia hạn ---------- */
  function cycleReminder(report) {
    const freq = report.frequency;
    if (!freq || freq === "none") return null;
    const base = report.dueDate || report.date || A.todayISO();
    const next = base > A.todayISO() ? shiftCycle(base, freq, 1) : nextDueDate(report);
    if (!next) return null;
    const seriesId = report.seriesId || report.id;
    const exists = R.reports.some(
      (item) => item.id !== report.id && !isDone(item) && (item.seriesId === seriesId || item.id === seriesId) && (item.dueDate || item.date) === next
    );
    if (exists) return null;
    const now = new Date().toISOString();
    const reminder = {
      id: reportId(),
      seriesId,
      title: report.title || "Báo cáo",
      project: report.project || "",
      category: report.category || "",
      frequency: freq,
      date: next,
      dueDate: next,
      status: "To-do",
      pinned: Boolean(report.pinned),
      reminderTime: report.reminderTime || "",
      submissionUrl: report.submissionUrl || "",
      zaloPhone: report.zaloPhone || "",
      agentEnabled: Boolean(report.agentEnabled),
      notes: "",
      excel: report.excel ? JSON.parse(JSON.stringify(report.excel)) : null,
      createdAt: now,
      updatedAt: now,
      previousId: report.id,
    };
    R.reports.push(reminder);
    logAction(reminder, "create", `Nhắc kỳ tới ${shortDate(next)} · từ «${report.title || "Báo cáo"}»`);
    return reminder;
  }

  /* Kỳ mới nhận bản sao mẫu Excel, bản đã lưu và đính kèm của kỳ trước. */
  async function inheritFiles(source, target) {
    const files = (R.fileBlobs || []).filter((file) => file && file.reportId === source.id);
    if (!files.length) return;
    /* Tuần tự để máy chủ không ghi đè kho tệp khi nhiều bản sao cùng lúc. */
    for (const file of files) {
      try {
        const res = await fetch(`/api/files/${encodeURIComponent(file.id)}/copy`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "x-report-id": target.id },
        });
        if (!res.ok) continue;
        const data = await res.json().catch(() => null);
        const copy = data && data.file;
        if (!copy || !copy.id) continue;
        R.fileBlobs = R.fileBlobs.filter((item) => item.id !== copy.id).concat(copy);
        if (!target.excel) continue;
        if (copy.role === "excel-template" && file.id === target.excel.templateId) {
          target.excel.templateId = copy.id;
          target.excel.templateName = copy.name;
          target.excel.templateSize = copy.size;
        } else if (copy.role === "excel-latest" && file.id === target.excel.latestId) {
          target.excel.latestId = copy.id;
          target.excel.latestName = copy.name;
          target.excel.latestSize = copy.size;
          target.excel.latestAt = copy.uploadedAt;
          target.excel.latestVersion = copy.version;
        }
      } catch (err) {
        /* Giữ tham chiếu kỳ trước nếu chưa sao chép được. */
      }
    }
  }

  async function completeReport(report) {
    if (!report) return;
    if (isDone(report)) {
      A.toast("Báo cáo này đã chốt rồi.", "info");
      return;
    }
    const today = A.todayISO();
    const now = new Date().toISOString();
    const reminder = cycleReminder(report);
    report.status = "Done";
    report.completedAt = today;
    report.lastProcessedDate = today;
    report.updatedAt = now;
    logAction(report, "done", reminder ? `Hoàn thành · nhắc kỳ tới ${shortDate(reminder.dueDate)}` : "Hoàn thành báo cáo");
    R.reports = sortReports(R.reports);
    window.setTimeout(() => A.confetti(), 40);
    A.toast(
      reminder
        ? `Đã chốt «${report.title || "báo cáo"}». Nhắc mới: ${shortDate(reminder.dueDate)}.`
        : `Đã chốt «${report.title || "báo cáo"}».`,
      "success"
    );
    refresh();
    try {
      if (reminder) await inheritFiles(report, reminder);
      await push();
    } catch (err) {
      A.toast(err.message || "Chưa đồng bộ được — thay đổi vẫn lưu trên máy này.", "error");
    }
  }

  async function extendReport(report, days) {
    if (!report) return;
    if (isDone(report)) {
      A.toast("Báo cáo đã chốt — không cần gia hạn.", "info");
      return;
    }
    const step = Math.max(1, Math.min(90, Math.round(Number(days) || 1)));
    const today = A.todayISO();
    const base = report.dueDate || report.date || today;
    const start = base < today ? today : base;
    const next = A.addDays(start, step);
    const shiftDate = !report.date || report.date === report.dueDate || report.date < today;
    report.dueDate = next;
    if (shiftDate) report.date = next;
    report.updatedAt = new Date().toISOString();
    logAction(report, "cycle", `Gia hạn ${step} ngày đến ${shortDate(next)}`);
    if (R.extendOverlay) {
      A.closeOverlay(R.extendOverlay);
      R.extendOverlay = null;
    }
    await saveReport(report, `Đã dời hạn đến ${shortDate(next)}${report.reminderTime ? ` · nhắc ${report.reminderTime}` : ""}.`);
  }

  function openExtendMenu(report) {
    if (!report) return;
    if (isDone(report)) {
      A.toast("Báo cáo đã chốt — không cần gia hạn.", "info");
      return;
    }
    const current = report.dueDate || report.date;
    const options = [
      { days: 1, label: "Thêm 1 ngày", hint: "Dời sang ngày mai" },
      { days: 3, label: "Thêm 3 ngày", hint: "Giữ nhịp trong tuần" },
      { days: 7, label: "Thêm 1 tuần", hint: "Sang tuần sau" },
      { days: 30, label: "Thêm 1 tháng", hint: "Dời sang tháng sau" },
    ];
    const html = `<div class="modal modal-narrow rp-modal rp-extend-modal" role="dialog" aria-modal="true" aria-labelledby="rpExtendTitle">
      <div class="modal-head">
        <div>
          <div class="modal-eyebrow">${A.icon("clock")} Gia hạn báo cáo</div>
          <div class="modal-title" id="rpExtendTitle">${esc(report.title || "Báo cáo")}</div>
          <div class="modal-sub">Hạn hiện tại ${esc(shortDate(current) || "chưa đặt")} · chọn mốc dời nhanh.</div>
        </div>
        <button class="icon-btn modal-close" type="button" data-rp-close aria-label="Đóng">${A.icon("x")}</button>
      </div>
      <div class="modal-body">
        <div class="rp-extend-grid">
          ${options.map((option) => `<button class="rp-extend-opt" type="button" data-rp="extend" data-id="${esc(report.id)}" data-days="${option.days}">
            <b>${esc(option.label)}</b><span>${esc(option.hint)}</span>
          </button>`).join("")}
        </div>
        <p class="rp-muted-note">Gia hạn chỉ dời hạn nộp, không đánh dấu đã gửi. Báo cáo quá hạn sẽ tính lại từ hôm nay.</p>
      </div>
    </div>`;
    const overlay = A.openOverlay(html, { className: "rp-overlay" });
    if (!overlay) return;
    R.extendOverlay = overlay;
    overlay.querySelectorAll("[data-rp-close]").forEach((btn) => btn.addEventListener("click", () => A.closeOverlay(overlay)));
  }

  /* ---------- Chú Ong: nhắc việc ---------- */
  function notify(title, body) {
    if (R.notify && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, { body, icon: "assets/icon-192.png", tag: "guong-bee" });
        return;
      } catch (err) {
        /* rơi về toast */
      }
    }
    A.toast(`${title} — ${body}`, "info");
  }
  function checkReminders() {
    touchDay();
    if (!R.user || !R.reports.length) return;
    const now = new Date();
    const minutesNow = now.getHours() * 60 + now.getMinutes();
    let fired = false;
    R.reports.forEach((report) => {
      if (isDone(report) || !report.agentEnabled) return;
      const time = String(report.reminderTime || "17:00");
      const parts = time.split(":");
      if (parts.length < 2) return;
      const target = Number(parts[0]) * 60 + Number(parts[1]);
      const diff = minutesNow - target;
      if (diff < 0 || diff > 5) return;
      const key = `guong.bee.rem.${report.id}.${A.todayISO()}`;
      try {
        if (localStorage.getItem(key)) return;
        localStorage.setItem(key, "1");
      } catch (err) {
        /* bộ nhớ bị chặn */
      }
      notify(`Nhắc nộp: ${report.title || "Báo cáo"}`, `Hạn ${shortDate(report.dueDate || report.date)} lúc ${time}. Mở GUỒNG để nộp.`);
      R.beePulse += 1;
      fired = true;
    });
    if (fired && A.view === "reports") scheduleRefresh();
  }
  function startClock() {
    if (R.timer) return;
    R.timer = window.setInterval(checkReminders, 60000);
    window.setTimeout(checkReminders, 1500);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") touchDay();
    });
    window.addEventListener("focus", touchDay);
  }
  async function enableReminders() {
    if (!("Notification" in window)) {
      A.toast("Trình duyệt này không hỗ trợ thông báo hệ thống.", "error");
      return;
    }
    const permission = await Notification.requestPermission();
    R.notify = permission === "granted";
    refresh();
    A.toast(
      permission === "granted" ? "Chú Ong sẽ nhắc đúng giờ bạn đặt cho báo cáo bật nhắc." : "Chưa được cấp quyền thông báo.",
      permission === "granted" ? "success" : "info"
    );
  }

  /* ---------- Google login ---------- */
  function googleReady() {
    return Boolean(window.google && window.google.accounts && window.google.accounts.oauth2);
  }

  function ensureTokenClient() {
    if (R.tokenClient || !googleReady()) return R.tokenClient;
    R.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "openid email profile",
      callback: async (response) => {
        if (!response || !response.access_token) {
          R.signingIn = false;
          refresh();
          A.toast("Google không trả về quyền truy cập.", "error");
          return;
        }
        try {
          R.user = await jfetch("/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ access_token: response.access_token }),
          });
          R.codeRequired = false;
          R.needCode = false;
          R.loaded = false;
          await loadData();
          subscribe();
          startClock();
          autoAdvance();
          if (A.setAccount) A.setAccount(R.user);
          A.toast(`Đã đăng nhập ${R.user.email}`, "success");
        } catch (err) {
          A.toast(err.message || "Đăng nhập Google thất bại.", "error");
        }
        R.signingIn = false;
        refresh();
      },
    });
    return R.tokenClient;
  }

  function signIn() {
    if (!googleReady()) {
      A.toast("Google chưa tải xong. Thử lại sau 1–2 giây.", "error");
      return;
    }
    const client = ensureTokenClient();
    if (!client) return;
    R.signingIn = true;
    refresh();
    try {
      client.requestAccessToken({ prompt: "select_account" });
    } catch (err) {
      R.signingIn = false;
      refresh();
      A.toast("Không mở được hộp thoại Google.", "error");
    }
  }

  async function signOut() {
    try {
      await jfetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      /* vẫn xoá trạng thái cục bộ */
    }
    if (R.sse) {
      R.sse.close();
      R.sse = null;
    }
    R.user = null;
    R.reports = [];
    R.refDocs = [];
    R.fileBlobs = [];
    R.auditLogs = [];
    R.detailId = null;
    R.needCode = false;
    R.codeRequired = false;
    if (R.detailOverlay) A.closeOverlay(R.detailOverlay);
    R.loaded = false;
    refresh();
    if (A.clearAccount) A.clearAccount();
    A.toast("Đã đăng xuất khỏi kho báo cáo.", "info");
  }

  /* ---------- hiển thị chung ---------- */
  function renderAccount() {
    if (R.user) {
      const initial = (R.user.name || R.user.email || "?").trim().charAt(0).toUpperCase();
      return `<div class="rp-user">
        ${R.user.picture ? `<img class="rp-avatar" src="${esc(R.user.picture)}" alt="">` : `<span class="rp-avatar rp-avatar-fallback">${esc(initial)}</span>`}
        <div class="rp-user-meta"><strong>${esc(R.user.name || "Tài khoản Google")}</strong><span>${esc(R.user.email)}</span></div>
        <button class="btn btn-ghost btn-sm" type="button" data-rp="signout">${A.icon("external")} Đăng xuất</button>
      </div>`;
    }
    return `<div class="rp-signin">
      <button class="btn btn-accent" type="button" data-rp="signin"${R.signingIn ? " disabled" : ""}>
        ${A.icon("users")} ${R.signingIn ? "Đang đăng nhập…" : "Đăng nhập Google"}
      </button>
      <span class="rp-signin-note">Báo cáo gắn với email Google của bạn.</span>
    </div>`;
  }

  function renderCodeGate() {
    return `<section class="rp-gate card">
      <div class="rp-gate-icon">${A.icon("alert")}</div>
      <h2>Kho báo cáo đang khoá</h2>
      <p>Nhập mã truy cập của GUỒNG để mở dữ liệu báo cáo.</p>
      <form class="rp-gate-form" data-rp-code-form>
        <input class="input" type="password" name="code" placeholder="Mã truy cập" autocomplete="current-password" autofocus>
        <button class="btn btn-accent" type="submit">Mở kho</button>
      </form>
    </section>`;
  }

  function renderOffline() {
    return `<section class="rp-gate card">
      <div class="rp-gate-icon">${A.icon("link")}</div>
      <h2>Bản này chưa có API</h2>
      <p>GitHub Pages chỉ chạy phần tĩnh. Mở bản đầy đủ trên Cloudflare để dùng kho báo cáo.</p>
      <a class="btn btn-accent" href="https://guong.tonyhung.workers.dev/#/reports">Mở bản Cloudflare</a>
    </section>`;
  }

  function renderSignIn() {
    return `<div class="rp-grid">
      <section class="rp-hero card">
        <div class="rp-kicker">${A.icon("spark")} KHO BÁO CÁO · NỀN DỮ LIỆU BEE</div>
        <h1 class="rp-hero-title">Báo cáo của bạn,<br><span>nằm ngay trong GUỒNG.</span></h1>
        <p class="rp-hero-text">Đăng nhập Google để mở đúng kho báo cáo của tài khoản bạn. Dữ liệu đồng bộ giữa máy tính và điện thoại qua KV, có tệp đính kèm, AI phân tích 3 tầng và Chú Ong nhắc việc.</p>
        <div class="rp-hero-actions">${renderAccount()}</div>
        <ul class="rp-hero-list">
          <li>${A.icon("check-circle")} Tạo, sửa, xoá báo cáo và tải tệp đính kèm</li>
          <li>${A.icon("check-circle")} Đồng bộ tức thời bằng SSE, dữ liệu giữ theo email</li>
          <li>${A.icon("check-circle")} Chú Ong nhắc đúng giờ và kiểm tra hồ sơ trước khi nộp</li>
        </ul>
        ${R.codeRequired
          ? `<details class="rp-code-details">
              <summary>${A.icon("settings")} Tôi có mã truy cập GUỒNG</summary>
              <form class="rp-gate-form" data-rp-code-form>
                <input class="input" type="password" name="code" placeholder="Mã truy cập" autocomplete="current-password">
                <button class="btn btn-ghost" type="submit">Mở kho</button>
              </form>
            </details>`
          : ""}
      </section>
      <aside class="rp-side card">
        <h3>Mỗi người một kho</h3>
        <p>Gửi link cho bạn bè — họ đăng nhập bằng Google của họ và làm việc trong không gian riêng. Không tài khoản nào đọc được dữ liệu của tài khoản khác.</p>
        <ul class="rp-side-list">
          <li>${A.icon("check-circle")} Kho báo cáo khoá theo email Google</li>
          <li>${A.icon("check-circle")} Tệp đính kèm và lịch nhắc đi kèm tài khoản</li>
          <li>${A.icon("check-circle")} Đăng xuất là ẩn toàn bộ dữ liệu khỏi giao diện</li>
        </ul>
        <p class="rp-side-note">Bản chạy máy: <code>http://localhost:3100</code>. Sau khi đăng nhập, kho tự tải lại theo đúng email.</p>
      </aside>
    </div>`;
  }

  function renderLoading() {
    return `<div class="rp-loading"><span class="rp-spinner"></span> Đang tải kho báo cáo…</div>`;
  }

  /* ---------- dashboard ---------- */
  function kpiCard(label, value, sub, focus, cls, iconName, pct) {
    const active = focus !== "all" && R.focusFilter === focus ? " on" : "";
    const width = Math.max(3, Math.min(100, Math.round(pct || 0)));
    return `<button class="rp-kpi ${cls || ""}${active}" type="button" data-rp="focus" data-focus="${focus}">
      <span class="rp-kpi-top">
        <span class="rp-kpi-ico">${A.icon(iconName)}</span>
        <span class="rp-kpi-label">${esc(label)}</span>
        <b class="rp-kpi-value">${value}</b>
      </span>
      <span class="rp-kpi-sub">${esc(sub)}</span>
      <span class="rp-kpi-bar" aria-hidden="true"><i style="width:${width}%"></i></span>
    </button>`;
  }

  function pulseChart(pulse) {
    return `<div class="rp-pulse" role="img" aria-label="Nhịp nộp báo cáo 7 ngày gần nhất">
      ${pulse.days.map((day) => `<div class="rp-pulse-col${day.isToday ? " is-today" : ""}" title="${esc(`${A.fmtShort(day.iso)}: ${day.sent} gửi · ${day.due} hạn`)}">
        <span class="rp-pulse-val">${day.sent || ""}</span>
        <span class="rp-pulse-bar"><i style="height:${Math.max(day.sent ? 14 : 3, day.pct)}%"></i></span>
        <span class="rp-pulse-label">${esc(day.label)}</span>
      </div>`).join("")}
    </div>`;
  }

  function priorityList() {
    const today = A.todayISO();
    const rank = (report) => {
      const gap = report.dueDate ? A.daysFromToday(report.dueDate) : null;
      if (!isDone(report) && gap !== null && gap < 0) return gap;
      if (!isDone(report) && (report.dueDate === today || (!report.dueDate && report.date === today))) return 0;
      return 50 + readiness(report).filter((item) => item.severity !== "low").length;
    };
    return attention().slice().sort((a, b) => rank(a) - rank(b)).slice(0, 4);
  }

  function priorityRow(report) {
    const due = dueBadge(report);
    const today = A.todayISO();
    const gap = report.dueDate ? A.daysFromToday(report.dueDate) : null;
    const overdue = !isDone(report) && gap !== null && gap < 0;
    const isToday = !isDone(report) && (report.dueDate === today || (!report.dueDate && report.date === today));
    const missing = readiness(report).filter((item) => item.severity !== "low");
    const reason = overdue
      ? `Quá hạn ${-gap} ngày`
      : isToday
        ? "Tới hạn hôm nay"
        : missing.length
          ? missing.map((item) => item.label).slice(0, 2).join(" · ")
          : "Cần kiểm tra hồ sơ";
    const tone = overdue ? "danger" : isToday ? "warn" : "accent";
    return `<article class="rp-priority-row">
      <span class="rp-priority-pin ${tone}" aria-hidden="true"></span>
      <button class="rp-priority-main" type="button" data-rp="open" data-id="${esc(report.id)}">
        <strong>${esc(report.title || "Báo cáo")}</strong>
        <span>${esc(reason)}${report.project ? ` · ${esc(report.project)}` : ""}</span>
      </button>
      ${statusChip(report.status)}
      ${due ? `<span class="rp-due ${due.cls}">${A.icon("clock")} ${esc(due.text)}</span>` : ""}
      <div class="rp-priority-acts">
        <button class="rp-priority-act rp-act-done" type="button" data-rp="complete" data-id="${esc(report.id)}" title="Chốt báo cáo, tự tạo nhắc kỳ tới">${A.icon("check")} Xong</button>
        <button class="rp-priority-act rp-act-ext" type="button" data-rp="extend" data-id="${esc(report.id)}" data-days="1" title="Dời hạn thêm 1 ngày">${A.icon("clock")} +1</button>
        <button class="rp-priority-act rp-act-more" type="button" data-rp="extend-menu" data-id="${esc(report.id)}" title="Gia hạn tuỳ chọn" aria-label="Gia hạn tuỳ chọn">${A.icon("chevron-down")}</button>
      </div>
    </article>`;
  }

  function renderDash() {
    const h = healthSnapshot();
    const pulse = weekPulse();
    const counts = statusCounts();
    const shares = categoryShare();
    const total = h.total || 1;
    const priority = priorityList();
    const doing = counts["In Progress"] + counts["Pending Review"];
    const dueWeek = pulse.days.reduce((sum, day) => sum + day.due, 0);
    const bestDay = pulse.days.reduce((top, day) => (day.sent > top.sent ? day : top), pulse.days[0]);
    const beeBadge = attention().length;
    const name = greetingName();
    const summary = h.total
      ? [
          `<b>${h.total}</b> báo cáo trong kho`,
          h.todayList.length ? `<b>${h.todayList.length}</b> cần nộp hôm nay` : "",
          h.late.length ? `<b class="is-danger">${h.late.length}</b> quá hạn` : "",
          h.missing.length ? `<b>${h.missing.length}</b> thiếu hồ sơ` : "",
        ].filter(Boolean).join("<i>·</i>")
      : "Kho đang trống — tạo báo cáo đầu tiên để Chú Ong bắt đầu nhắc việc.";
    return `<section class="rp-dash">
      <div class="rp-herobar">
        <div class="rp-hb-main">
          <div class="rp-hb-eyebrow"><span class="rp-hb-dot"></span> KHO BÁO CÁO · ${esc(weekLabel())}</div>
          <h1 class="rp-hb-title">${esc(greetingTime())}${name ? `, ${esc(name)}` : ""} — <span>hôm nay chốt gì?</span></h1>
          <p class="rp-hb-sub">${summary}</p>
          <div class="rp-hb-actions">
            <button class="btn btn-accent btn-sm" type="button" data-rp="create">${A.icon("plus")} Báo cáo mới</button>
            <button class="btn btn-ghost btn-sm" type="button" data-rp="bee-toggle">${A.icon("bee")} Chú Ong${beeBadge ? ` · ${beeBadge} việc` : ""}</button>
            <button class="btn btn-ghost btn-sm" type="button" data-rp="tab-weekly">${A.icon("chart")} Tổng hợp tuần</button>
          </div>
        </div>
        <div class="rp-hb-side">
          <div class="rp-health tone-${h.tone}" style="--p:${h.score}">
            <div class="rp-health-in"><b>${h.score}</b><span>${esc(h.label)}</span></div>
          </div>
          <div class="rp-hb-side-main">
            <span class="rp-hb-side-label">Điểm sẵn sàng</span>
            <strong>${h.ready} báo cáo đủ hồ sơ</strong>
            <span>trên ${h.active.length} đang xử lý</span>
          </div>
        </div>
      </div>

      <div class="rp-kpi-grid">
        ${kpiCard("Tất cả báo cáo", h.total, `${h.pinned} đang ghim`, "all", "", "inbox", 100)}
        ${kpiCard("Cần xử lý hôm nay", h.todayList.length, "theo hạn và giờ nhắc", "today", "accent", "target", (h.todayList.length / total) * 100)}
        ${kpiCard("Quá hạn", h.late.length, "cần nộp gấp", "late", "danger", "alert", (h.late.length / total) * 100)}
        ${kpiCard("Đã gửi", h.sent.length, `${h.done.length} hoàn thành`, "sent", "ok", "send", h.share)}
      </div>

      <section class="rp-insights" aria-label="Tổng quan trực quan">
        <article class="rp-insight">
          <header class="rp-insight-head">
            <div><h3>Nhịp nộp 7 ngày</h3><span>${pulse.total} báo cáo gửi · ${dueWeek} hạn rơi vào tuần</span></div>
            <span class="rp-insight-ico accent">${A.icon("chart")}</span>
          </header>
          ${pulseChart(pulse)}
          <p class="rp-insight-foot">${A.icon("send")} Trung bình <b>${(pulse.total / 7).toFixed(1)}</b> báo cáo/ngày · cao nhất <b>${bestDay.sent}</b> vào ${esc(bestDay.label)}</p>
        </article>

        <article class="rp-insight">
          <header class="rp-insight-head">
            <div><h3>Tỷ lệ hoàn tất</h3><span>${h.submitted}/${h.total || 0} báo cáo đã chốt</span></div>
            <span class="rp-insight-ico ok">${A.icon("check-circle")}</span>
          </header>
          <div class="rp-insight-split">
            <div class="rp-donut" style="--p:${h.share}">
              <span><b>${h.share}%</b><em>đã chốt</em></span>
            </div>
            <ul class="rp-legend">
              <li><i class="sent"></i><span>Đã gửi</span><b>${counts.Sent}</b></li>
              <li><i class="done"></i><span>Hoàn thành</span><b>${counts.Done}</b></li>
              <li><i class="doing"></i><span>Đang xử lý</span><b>${doing}</b></li>
              <li><i class="todo"></i><span>Chờ làm</span><b>${counts["To-do"]}</b></li>
            </ul>
          </div>
          ${h.avgScore ? `<p class="rp-insight-foot">${A.icon("spark")} Điểm AI trung bình <b>${h.avgScore}/100</b> trên ${h.scored.length} báo cáo</p>` : ""}
        </article>

        <article class="rp-insight">
          <header class="rp-insight-head">
            <div><h3>Phân bổ danh mục</h3><span>${h.total} báo cáo</span></div>
            <span class="rp-insight-ico info">${A.icon("layers")}</span>
          </header>
          ${shares.length
            ? `<ul class="rp-share">
                ${shares.map((row) => `<li>
                  <span class="rp-share-label">${esc(row.label)}</span>
                  <span class="rp-share-track"><i style="width:${row.pct}%"></i></span>
                  <span class="rp-share-count">${row.count}</span>
                </li>`).join("")}
              </ul>`
            : `<p class="rp-insight-empty">Chưa có dữ liệu danh mục.</p>`}
        </article>
      </section>

      ${priority.length
        ? `<section class="rp-priority" aria-label="Việc cần chạm hôm nay">
            <header class="rp-priority-head">
              <h3>${A.icon("target")} Cần chạm hôm nay <em>${priority.length} việc ưu tiên</em></h3>
              <button class="rp-link" type="button" data-rp="focus" data-focus="today">Lọc hôm nay ${A.icon("arrow-right")}</button>
            </header>
            <div class="rp-priority-list">${priority.map(priorityRow).join("")}</div>
          </section>`
        : ""}
    </section>`;
  }

  /* ---------- truy cập nhanh ---------- */
  function renderQuickCard(report) {
    const freq = FREQ_LABEL[report.frequency] || "";
    const files = reportFiles(report);
    const parts = readinessParts(report);
    const ready = parts.filter((part) => part.ok).length;
    const score = readinessScore(report);
    const tone = score >= 78 ? "ok" : score >= 55 ? "warn" : "danger";
    return `<article class="rp-q-card">
      <div class="rp-q-top">
        <div class="rp-q-chips">
          <span class="rp-cat">${esc(report.category || "Báo cáo")}</span>
          ${statusChip(report.status)}
          ${freq ? `<span class="rp-q-freq">${esc(freq)}</span>` : ""}
        </div>
        <button class="rp-q-star" type="button" data-rp="pin" data-id="${esc(report.id)}" title="Bỏ ghim" aria-label="Bỏ ghim">${A.icon("flag")}</button>
      </div>
      <h3 class="rp-q-title" data-rp="open" data-id="${esc(report.id)}">${esc(report.title || "Báo cáo chưa đặt tên")}</h3>
      <div class="rp-q-proj">${A.icon("layers")}<span>${esc(report.project || "Chưa gán dự án")}</span></div>
      <div class="rp-q-ready tone-${tone}">
        <div class="rp-q-ready-head"><span>Sẵn sàng nộp</span><b>${score}%</b></div>
        <span class="rp-q-meter" aria-hidden="true">
          ${parts.map((part) => `<i class="${part.ok ? "on" : "off"}" title="${esc(part.label)}"></i>`).join("")}
        </span>
        <span class="rp-q-ready-note">${ready}/${parts.length} hồ sơ đủ</span>
      </div>
      <div class="rp-q-meta">
        <span>${A.icon("calendar")}${esc(shortDate(report.date) || "—")}</span>
        ${report.reminderTime ? `<span class="rp-q-time">${A.icon("clock")}${esc(report.reminderTime)}</span>` : ""}
        ${files.length ? `<span class="rp-q-files">${A.icon("paperclip")}${files.length}</span>` : ""}
      </div>
      <div class="rp-q-actions">
        ${isDone(report) ? "" : `<button class="rp-q-act rp-q-done" type="button" data-rp="complete" data-id="${esc(report.id)}" title="Chốt báo cáo, tự tạo nhắc kỳ tới">${A.icon("check")}<span>Xong</span></button>
        <button class="rp-q-act rp-q-ext" type="button" data-rp="extend" data-id="${esc(report.id)}" data-days="1" title="Dời hạn thêm 1 ngày">${A.icon("clock")}<span>+1 ngày</span></button>`}
        <button class="rp-q-act rp-q-submit" type="button" data-rp="submit" data-id="${esc(report.id)}" title="Mở tệp, copy nội dung và mở trang nộp">${A.icon("upload")}<span>Sẵn sàng Nộp</span></button>
        <button class="rp-q-act rp-q-zalo" type="button" data-rp="zalo-send" data-id="${esc(report.id)}" title="Copy lời nhắn và mở Zalo của người duyệt">${A.icon("message")}<span>Zalo Duyệt</span></button>
        <button class="rp-q-act rp-q-file" type="button" data-rp="file" data-id="${esc(report.id)}" title="Mở tệp báo cáo">${A.icon("external")}<span>View File</span></button>
      </div>
    </article>`;
  }

  function renderQuickAccess() {
    const pinned = R.reports.filter((item) => item.pinned);
    if (!pinned.length) return "";
    const limit = 6;
    const shown = R.pinOpen ? pinned : pinned.slice(0, limit);
    const more = pinned.length > limit
      ? `<button class="rp-link" type="button" data-rp="pin-more">${R.pinOpen ? "Thu gọn" : `Xem tất cả ${pinned.length} báo cáo ghim`} ${A.icon(R.pinOpen ? "chevron-down" : "arrow-right")}</button>`
      : "";
    return `<section class="rp-quick">
      <div class="rp-quick-head">
        <h2>${A.icon("flag")} Truy cập nhanh <em>(báo cáo ghim)</em></h2>
        <span class="rp-quick-count">${shown.length}/${pinned.length} báo cáo ưu tiên</span>
      </div>
      <div class="rp-quick-grid">${shown.map(renderQuickCard).join("")}</div>
      ${more ? `<div class="rp-quick-foot">${more}</div>` : ""}
    </section>`;
  }

  /* ---------- toolbar ---------- */
  function renderToolbar() {
    const focusChip = R.focusFilter !== "all"
      ? `<span class="rp-focus-chip">${A.icon("filter")} ${esc(FOCUS_LABEL[R.focusFilter] || "Đang lọc")}
          <button type="button" data-rp="focus" data-focus="all" aria-label="Bỏ lọc">${A.icon("x")}</button>
        </span>`
      : "";
    return `<div class="rp-toolbar">
      <div class="rp-toolbar-main">
        <label class="rp-search">
          ${A.icon("search")}
          <input type="search" data-rp-q placeholder="Tìm báo cáo, dự án, ghi chú…" value="${esc(R.q)}">
        </label>
        <select class="select input-sm" data-rp-status>
          <option value="all">Mọi trạng thái</option>
          ${STATUSES.map((s) => `<option value="${esc(s)}"${R.status === s ? " selected" : ""}>${esc(STATUS_LABEL[s])}</option>`).join("")}
        </select>
        <select class="select input-sm" data-rp-category>
          <option value="all">Mọi danh mục</option>
          ${CATEGORIES.map((c) => `<option value="${esc(c)}"${R.category === c ? " selected" : ""}>${esc(c)}</option>`).join("")}
        </select>
        ${focusChip}
      </div>
      <div class="rp-toolbar-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-rp="zalo">${A.icon("message")} Tách Zalo</button>
        <details class="rp-menu">
          <summary class="btn btn-ghost btn-sm">${A.icon("layers")} Nhập / xuất</summary>
          <div class="rp-menu-pop">
            <button class="rp-menu-item" type="button" data-rp="drive">${A.icon("layers")} Nhập từ Bee Drive</button>
            <button class="rp-menu-item" type="button" data-rp="import">${A.icon("upload")} Nhập tệp JSON</button>
            <button class="rp-menu-item" type="button" data-rp="export">${A.icon("download")} Xuất toàn bộ JSON</button>
          </div>
        </details>
        <button class="btn btn-accent btn-sm" type="button" data-rp="create">${A.icon("plus")} Báo cáo mới</button>
      </div>
    </div>
    <div class="rp-metrics">
      <span><b data-rp-count>${R.reports.length}</b> báo cáo</span>
      <span class="rp-dot ok"></span><span>${metrics().sent.length} đã gửi</span>
      <span class="rp-dot warn"></span><span>${metrics().todayList.length} hôm nay</span>
      <span class="rp-dot accent"></span><span>${metrics().late.length} quá hạn</span>
      <span class="rp-sync rp-sync-${R.sync}" data-rp-sync>${syncLabel()}</span>
    </div>`;
  }

  /* ---------- thẻ báo cáo ---------- */
  function renderCard(report) {
    const notes = String(report.notes || "").trim();
    const files = reportFiles(report);
    const issues = readiness(report).filter((item) => item.severity !== "low");
    const due = dueBadge(report);
    const meta = [report.project, report.date ? A.fmtLong(report.date) : ""];
    const ready = readinessScore(report);
    const readyTone = ready >= 78 ? "ok" : ready >= 55 ? "warn" : "danger";
    const statusClass = STATUS_CLASS[report.status] || "todo";
    return `<article class="rp-card${report.pinned ? " is-pinned" : ""}" data-rp-card="${esc(report.id)}" data-status="${statusClass}">
      <span class="rp-card-rail rp-rail-${statusClass}" aria-hidden="true"></span>
      <div class="rp-card-main" data-rp="open" data-id="${esc(report.id)}" role="button" tabindex="0">
        <div class="rp-card-top">
          <span class="rp-cat">${esc(report.category || "Báo cáo")}</span>
          ${statusChip(report.status)}
          ${report.frequency && report.frequency !== "none" ? `<span class="rp-q-freq">${esc(FREQ_LABEL[report.frequency] || "")}</span>` : ""}
          ${report.agentEnabled ? `<span class="rp-chip-bee">${A.icon("bee")} Chú Ong</span>` : ""}
          ${report.pinned ? `<span class="rp-pin">${A.icon("flag")} Ghim</span>` : ""}
          ${due ? `<span class="rp-due ${due.cls}">${A.icon("clock")} ${esc(due.text)}</span>` : ""}
        </div>
        <h3 class="rp-card-title">${esc(report.title || "Báo cáo chưa đặt tên")}</h3>
        <div class="rp-meta">${meta.filter(Boolean).map((item) => `<span>${esc(item)}</span>`).join("<i>·</i>")}</div>
        ${notes ? `<p class="rp-notes">${esc(notes.length > 200 ? `${notes.slice(0, 200)}…` : notes)}</p>` : `<p class="rp-notes rp-notes-empty">Chưa có nội dung.</p>`}
        <div class="rp-card-tags">
          ${files.length ? `<span class="rp-tag file">${A.icon("paperclip")} ${files.length} tệp</span>` : `<span class="rp-tag muted">${A.icon("paperclip")} Chưa có tệp</span>`}
          ${Number(report.aiQualityScore) ? `<span class="rp-tag ai">${A.icon("spark")} AI ${Math.round(Number(report.aiQualityScore))}/100</span>` : ""}
          ${issues.length ? `<span class="rp-tag warn">${A.icon("alert")} ${issues.length} mục cần bổ sung</span>` : `<span class="rp-tag ok">${A.icon("check-circle")} Đủ hồ sơ</span>`}
        </div>
      </div>
      <div class="rp-card-foot">
        <span class="rp-ver">v${Number(report.version) || 1} · <b class="rp-ver-ready rp-tone-${readyTone}">${ready}%</b> sẵn sàng${report.lastSentAt ? ` · gửi ${esc(A.timeAgo(report.lastSentAt))}` : ""}</span>
        <div class="rp-card-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-rp="submit" data-id="${esc(report.id)}">${A.icon("send")} Nộp</button>
          <button class="btn btn-ghost btn-sm" type="button" data-rp="edit" data-id="${esc(report.id)}">${A.icon("pencil")} Sửa</button>
          <button class="btn btn-ghost btn-sm" type="button" data-rp="open" data-id="${esc(report.id)}">${A.icon("file")} Chi tiết</button>
          <button class="btn btn-ghost btn-sm rp-danger" type="button" data-rp="delete" data-id="${esc(report.id)}">${A.icon("trash")} Xoá</button>
        </div>
      </div>
    </article>`;
  }

  /* ---------- Chú Ong panel ---------- */
  function beeRow(report, label, tone) {
    const due = dueBadge(report);
    return `<button class="rp-bee-row" type="button" data-rp="open" data-id="${esc(report.id)}">
      <span class="rp-bee-dot ${tone}"></span>
      <span class="rp-bee-row-main">
        <strong>${esc(report.title || "Báo cáo")}</strong>
        <span>${esc(label)}${due ? ` · ${esc(due.text)}` : ""}</span>
      </span>
      ${A.icon("chevron-right")}
    </button>`;
  }

  function renderBee() {
    if (!R.user || !R.loaded) return "";
    const m = metrics();
    const ring = m.total ? Math.round((m.sent.length / m.total) * 100) : 0;
    const missing = m.missing.slice(0, 5);
    const badge = attention().length;
    const todayRows = m.todayList.slice(0, 4);
    const lateRows = m.late.slice(0, 4);
    const empty = !todayRows.length && !lateRows.length && !missing.length;
    return `<div class="rp-bee${R.beeOpen ? " open" : ""}">
      <button class="rp-bee-fab" type="button" data-rp="bee-toggle" aria-label="Mở Chú Ong trợ lý" aria-expanded="${R.beeOpen}">
        ${A.icon("bee")}
        ${badge ? `<span class="rp-bee-badge">${badge > 9 ? "9+" : badge}</span>` : ""}
      </button>
      <section class="rp-bee-panel"${R.beeOpen ? "" : " hidden"}>
        <header class="rp-bee-head">
          <span class="rp-bee-avatar">${A.icon("bee")}</span>
          <div class="rp-bee-title"><strong>Chú Ong</strong><span>Nhắc việc &amp; kiểm tra báo cáo</span></div>
          <button class="icon-btn bare" type="button" data-rp="bee-close" aria-label="Đóng">${A.icon("x")}</button>
        </header>
        <div class="rp-bee-progress">
          <div class="rp-ring sm" style="--p:${ring}"><span><b>${ring}%</b><em>đã gửi</em></span></div>
          <div class="rp-bee-progress-main">
            <strong>${m.total} báo cáo trong kho</strong>
            <span>${m.sent.length} đã gửi · ${m.late.length} quá hạn · ${m.missing.length} thiếu hồ sơ</span>
            ${m.avgScore ? `<span class="rp-bee-score">${A.icon("spark")} Điểm AI trung bình ${m.avgScore}/100</span>` : ""}
          </div>
        </div>
        ${empty
          ? `<div class="rp-bee-empty">${A.icon("check-circle")}<strong>Kho đang gọn gàng</strong><span>Không có việc gấp. Chú Ong sẽ nhắc khi tới giờ.</span></div>`
          : `<div class="rp-bee-body">
              ${todayRows.length ? `<div class="rp-bee-group"><h4>Hôm nay cần nộp</h4>${todayRows.map((r) => beeRow(r, "Tới hạn hôm nay", "accent")).join("")}</div>` : ""}
              ${lateRows.length ? `<div class="rp-bee-group"><h4>Quá hạn</h4>${lateRows.map((r) => beeRow(r, r.dueDate ? `Hạn ${shortDate(r.dueDate)}` : "Đã quá hạn", "danger")).join("")}</div>` : ""}
              ${missing.length ? `<div class="rp-bee-group"><h4>Thiếu hồ sơ</h4>${missing.map((r) => beeRow(r, readiness(r).filter((i) => i.severity !== "low").map((i) => i.label).join(" · "), "warn")).join("")}</div>` : ""}
            </div>`}
        <footer class="rp-bee-foot">
          <button class="btn btn-ghost btn-sm" type="button" data-rp="bee-notify">${A.icon(R.notify ? "check-circle" : "bell")} ${R.notify ? "Đã bật nhắc nhở" : "Bật nhắc nhở"}</button>
          <button class="btn btn-accent btn-sm" type="button" data-rp="create">${A.icon("plus")} Báo cáo mới</button>
        </footer>
      </section>
    </div>`;
  }

  /* ---------- vault ---------- */
  function renderVault() {
    if (R.offline) return renderOffline();
    if (R.needCode) return renderCodeGate();
    if (R.loading && !R.loaded) return renderLoading();
    if (!R.user) return renderSignIn();
    if (!R.loaded) return renderLoading();
    const cards = R.reports.length
      ? R.reports.map(renderCard).join("")
      : `<div class="rp-empty card">
          <div class="rp-empty-icon">${A.icon("inbox")}</div>
          <h3>Kho đang trống</h3>
          <p>Tạo báo cáo đầu tiên hoặc nhập tệp JSON xuất từ Bee.</p>
          <div class="rp-empty-actions">
            <button class="btn btn-accent" type="button" data-rp="create">${A.icon("plus")} Tạo báo cáo</button>
            <button class="btn btn-ghost" type="button" data-rp="drive">${A.icon("layers")} Nhập từ Bee Drive</button>
            <button class="btn btn-ghost" type="button" data-rp="import">${A.icon("upload")} Nhập JSON</button>
          </div>
        </div>`;
    return `<div class="rp-accountbar">${renderAccount()}</div>
      ${renderDash()}
      ${renderQuickAccess()}
      ${renderToolbar()}
      <div class="rp-list" data-rp-list>${cards}</div>
      ${renderBee()}`;
  }

  A.renderReports = function () {
    const tabs = `<nav class="rp-tabs" aria-label="Chế độ xem báo cáo">
      <button class="rp-tab${R.tab === "vault" ? " on" : ""}" type="button" data-rp="tab-vault">${A.icon("inbox")} Kho báo cáo</button>
      <button class="rp-tab${R.tab === "weekly" ? " on" : ""}" type="button" data-rp="tab-weekly">${A.icon("chart")} Tổng hợp tuần</button>
    </nav>`;
    if (R.tab === "weekly" && typeof weeklyRenderer === "function") {
      return `<div class="rp-root">${tabs}<div class="rp-weekly">${weeklyRenderer()}</div></div>`;
    }
    return `<div class="rp-root" id="rpRoot">${tabs}${renderVault()}</div>`;
  };

  // Mô-đun Excel mẫu dùng chung dữ liệu báo cáo và kho tệp với kho báo cáo.
  A.excelBridge = {
    report: findReport,
    save: saveReport,
    log: logAction,
    refresh,
    refreshDetail,
    addFile(meta) {
      if (!meta || !meta.id) return;
      R.fileBlobs = R.fileBlobs.filter((item) => item.id !== meta.id).concat(meta);
    },
    removeFile(id) {
      R.fileBlobs = R.fileBlobs.filter((item) => item.id !== id);
    },
    fileFor(reportId, role) {
      return (R.fileBlobs || []).find((file) => file && file.reportId === reportId && file.role === role) || null;
    },
    excelFiles(reportId) {
      return (R.fileBlobs || []).filter(
        (file) => file && file.reportId === reportId && String(file.role || "").startsWith("excel-")
      );
    },
  };

  /* ---------- lọc tại chỗ ---------- */
  function applyFilter() {
    const q = A.norm(R.q).trim();
    const today = A.todayISO();
    let shown = 0;
    document.querySelectorAll("[data-rp-card]").forEach((card) => {
      const id = card.getAttribute("data-rp-card");
      const report = findReport(id);
      if (!report) return;
      const haystack = A.norm([report.title, report.project, report.category, report.notes].join(" "));
      let focusOk = true;
      if (R.focusFilter === "today") focusOk = !isDone(report) && (report.dueDate === today || (!report.dueDate && report.date === today));
      else if (R.focusFilter === "late") focusOk = !isDone(report) && Boolean(report.dueDate && report.dueDate < today);
      else if (R.focusFilter === "sent") focusOk = report.status === "Sent";
      const ok =
        focusOk &&
        (!q || haystack.includes(q)) &&
        (R.status === "all" || report.status === R.status) &&
        (R.category === "all" || report.category === R.category);
      card.hidden = !ok;
      if (ok) shown++;
    });
    const count = document.querySelector("[data-rp-count]");
    if (count) count.textContent = String(shown);
  }

  /* ---------- drawer chi tiết ---------- */
  function fileRow(report, file) {
    const id = encodeURIComponent(file.id);
    return `<div class="rp-file">
      <span class="rp-file-ico">${A.icon("file")}</span>
      <div class="rp-file-main">
        <strong>${esc(file.name || "Tệp đính kèm")}</strong>
        <span>v${Number(file.version) || 1} · ${esc(fileSize(file.size))} · ${esc(A.timeAgo(file.uploadedAt) || shortDate(report.date))}</span>
      </div>
      <div class="rp-file-acts">
        <a class="icon-btn bare" href="/api/files/${id}" target="_blank" rel="noopener" title="Mở tệp">${A.icon("external")}</a>
        <a class="icon-btn bare" href="/api/files/${id}?download=1" title="Tải xuống">${A.icon("download")}</a>
        <button class="icon-btn bare rp-danger" type="button" data-rp="file-del" data-id="${esc(report.id)}" data-file="${esc(file.id)}" title="Xoá tệp">${A.icon("trash")}</button>
      </div>
    </div>`;
  }

  function detailContentTab(report) {
    const notes = String(report.notes || "").trim();
    const actions = Array.isArray(report.aiActionItems) ? report.aiActionItems : [];
    const linkedDocs = (Array.isArray(report.docRefs) ? report.docRefs : [])
      .map((docId) => R.refDocs.find((doc) => doc && doc.id === docId))
      .filter(Boolean);
    return `<div class="rp-dr-section">
      <div class="rp-dr-section-head">
        <h4>${A.icon("file")} Nội dung báo cáo</h4>
        <div class="rp-dr-section-acts">
          <button class="btn btn-ghost btn-sm" type="button" data-rp="insert-metrics" data-id="${esc(report.id)}"${R.refDocs.length ? "" : " disabled"} title="${R.refDocs.length ? "Chèn số liệu từ Kho tài liệu Bee" : "Kho tài liệu Bee đang trống"}">${A.icon("layers")} Chèn số liệu</button>
          <button class="btn btn-ghost btn-sm" type="button" data-rp="edit" data-id="${esc(report.id)}">${A.icon("pencil")} Sửa</button>
        </div>
      </div>
      ${notes ? `<div class="rp-dr-notes">${esc(notes)}</div>` : `<p class="rp-notes rp-notes-empty">Chưa có nội dung. Bấm Sửa để nhập số liệu, tiến độ và việc tiếp theo.</p>`}
    </div>
    ${linkedDocs.length
      ? `<div class="rp-dr-section">
          <div class="rp-dr-section-head"><h4>${A.icon("layers")} Tài liệu tham chiếu</h4><span class="rp-muted-note">${linkedDocs.length} tài liệu · Kho Bee</span></div>
          <div class="rp-doc-refs">
            ${linkedDocs.map((doc) => `<article class="rp-doc-ref">
              <span class="rp-doc-ref-ico">${A.icon("file")}</span>
              <div class="rp-doc-ref-main">
                <strong>${esc(doc.title || "Tài liệu")}</strong>
                <span>${esc(doc.category || "Tài liệu")}${doc.fileName ? ` · ${esc(doc.fileName)}` : ""}</span>
              </div>
              ${safeHref(doc.externalUrl) ? `<a class="icon-btn bare" href="${esc(safeHref(doc.externalUrl))}" target="_blank" rel="noopener noreferrer" title="Mở nguồn">${A.icon("external")}</a>` : ""}
            </article>`).join("")}
          </div>
        </div>`
      : ""}
    ${report.aiSummary
      ? `<div class="rp-dr-section">
          <div class="rp-dr-section-head"><h4>${A.icon("spark")} Nhận xét AI đã lưu</h4>${Number(report.aiQualityScore) ? `<span class="rp-tag ai">${Math.round(Number(report.aiQualityScore))}/100</span>` : ""}</div>
          <div class="rp-dr-notes mono">${esc(report.aiSummary)}</div>
          ${actions.length ? `<ul class="rp-dr-list">${actions.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : ""}
        </div>`
      : ""}
    ${report.aiEmailBody ? `<div class="rp-dr-section"><div class="rp-dr-section-head"><h4>${A.icon("send")} Email gợi ý</h4><button class="btn btn-ghost btn-sm" type="button" data-rp="copy-email" data-id="${esc(report.id)}">${A.icon("copy")} Copy</button></div><pre class="rp-ai-mail">${esc(report.aiEmailBody)}</pre></div>` : ""}`;
  }

  function detailFilesTab(report) {
    const files = reportFiles(report);
    const drive = driveUrl(report);
    return `<div class="rp-dr-section">
      <div class="rp-dr-upload">
        <span class="rp-dr-upload-icon">${A.icon("upload")}</span>
        <div class="rp-dr-upload-main"><strong>Tải tệp đính kèm</strong><span>PDF, Excel, ảnh, tài liệu… tối đa 8MB mỗi tệp. Bản cũ vẫn được lưu theo phiên bản.</span></div>
        <button class="btn btn-accent btn-sm" type="button" data-rp="pick-file" data-id="${esc(report.id)}">Chọn tệp</button>
        <input type="file" data-rp-file-input hidden multiple>
      </div>
      ${files.length
        ? `<div class="rp-files">${files.map((file) => fileRow(report, file)).join("")}</div>`
        : `<div class="rp-dr-empty">${A.icon("paperclip")}<span>Chưa có tệp nào trên máy chủ. Tải bản báo cáo lên để Chú Ong kiểm tra hồ sơ.</span></div>`}
      <div class="rp-dr-alt">
        ${drive ? `<a class="btn btn-ghost btn-sm" href="${esc(drive)}" target="_blank" rel="noopener noreferrer">${A.icon("layers")} Mở bản Drive</a>` : ""}
        <button class="btn btn-ghost btn-sm" type="button" data-rp="csv" data-id="${esc(report.id)}">${A.icon("download")} Tải CSV từ nội dung</button>
      </div>
    </div>`;
  }

  function detailScheduleTab(report) {
    const next = nextDueDate(report);
    return `<div class="rp-dr-section">
      <div class="rp-dr-section-head"><h4>${A.icon("calendar")} Lịch &amp; quy trình</h4><span class="rp-muted-note">Tự lưu khi đổi</span></div>
      <div class="rp-dr-grid">
        <label class="rp-dr-field"><span>Chu kỳ</span>
          <select class="select" data-rp-field="frequency" data-id="${esc(report.id)}">
            ${FREQ_VALUES.map((value) => `<option value="${value}"${(report.frequency || "none") === value ? " selected" : ""}>${esc(FREQ_LABEL[value])}</option>`).join("")}
          </select>
        </label>
        <label class="rp-dr-field"><span>Giờ nhắc</span>
          <input class="input" type="time" data-rp-field="reminderTime" data-id="${esc(report.id)}" value="${esc(report.reminderTime || "17:00")}">
        </label>
        <label class="rp-dr-field"><span>Hạn nộp</span>
          <input class="input" type="date" data-rp-field="dueDate" data-id="${esc(report.id)}" value="${esc(report.dueDate || "")}">
        </label>
        <label class="rp-dr-field"><span>Ngày báo cáo</span>
          <input class="input" type="date" data-rp-field="date" data-id="${esc(report.id)}" value="${esc(report.date || "")}">
        </label>
        <label class="rp-dr-field wide"><span>Link nộp báo cáo</span>
          <input class="input" type="url" data-rp-field="submissionUrl" data-id="${esc(report.id)}" value="${esc(report.submissionUrl || "")}" placeholder="https://base.vn/…">
        </label>
        <label class="rp-dr-field wide"><span>Số điện thoại Zalo người duyệt</span>
          <input class="input" type="tel" data-rp-field="zaloPhone" data-id="${esc(report.id)}" value="${esc(report.zaloPhone || "")}" placeholder="0912345678">
        </label>
      </div>
      <div class="rp-dr-toggle-row">
        <div><strong>Chú Ong nhắc việc</strong><span>Nhắc đúng giờ trên khi báo cáo chưa gửi.</span></div>
        <button class="rp-switch${report.agentEnabled ? " on" : ""}" type="button" data-rp="agent-toggle" data-id="${esc(report.id)}" aria-pressed="${report.agentEnabled ? "true" : "false"}"><i></i></button>
      </div>
      ${next
        ? `<div class="rp-dr-next">
            <div><span>Kỳ kế tiếp</span><strong>${esc(shortDate(next))} · ${esc(FREQ_LABEL[report.frequency] || "")}</strong></div>
            <button class="btn btn-ghost btn-sm" type="button" data-rp="advance" data-id="${esc(report.id)}">${A.icon("refresh")} Chuyển kỳ</button>
          </div>`
        : `<p class="rp-muted-note">Bật chu kỳ để Chú Ong tự chuyển kỳ sau khi bạn nộp xong.</p>`}
    </div>`;
  }

  function detailAiTab(report) {
    if (R.aiBusy === report.id) {
      return `<div class="rp-loading"><span class="rp-spinner"></span> Bee AI đang phân tích 3 tầng…</div>`;
    }
    const actions = Array.isArray(report.aiActionItems) ? report.aiActionItems : [];
    return `<div class="rp-dr-section">
      <div class="rp-dr-section-head">
        <h4>${A.icon("spark")} Trợ lý phân tích 3 tầng</h4>
        <button class="btn btn-accent btn-sm" type="button" data-rp="ai-run" data-id="${esc(report.id)}">${A.icon("spark")} ${report.aiSummary ? "Phân tích lại" : "Chạy phân tích"}</button>
      </div>
      ${R.aiError ? `<div class="rp-ai-error">${A.icon("alert")} ${esc(R.aiError)}</div>` : ""}
      ${report.aiSummary
        ? `<div class="rp-ai-score"><b>${Math.round(Number(report.aiQualityScore) || 0)}</b><span>/100 chất lượng · ${esc(A.timeAgo(report.aiAnalyzedAt) || "đã phân tích")}</span></div>
           <div class="rp-ai-block"><h4>Tầng 1 · Dữ liệu thực tế</h4><p>${esc(report.aiTier1 || "")}</p></div>
           <div class="rp-ai-block"><h4>Tầng 2 · Tiến độ &amp; rủi ro</h4><p>${esc(report.aiTier2 || "")}</p></div>
           <div class="rp-ai-block"><h4>Tầng 3 · Hành động</h4><ul>${actions.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div>
           ${report.managerFeedback ? `<section class="rp-ai-block rp-ai-manager"><h4>Phản hồi thử từ Sếp</h4><p>${esc(report.managerFeedback)}</p></section>` : ""}
           ${report.aiEmailBody ? `<section class="rp-ai-block"><h4>Email gợi ý</h4><pre class="rp-ai-mail">${esc(report.aiEmailBody)}</pre><button class="btn btn-ghost btn-sm" type="button" data-rp="copy-email" data-id="${esc(report.id)}">${A.icon("copy")} Copy email</button></section>` : ""}`
        : `<div class="rp-dr-empty">${A.icon("spark")}<span>Chưa có nhận xét AI. Chạy phân tích để trích xuất dữ liệu, đánh giá rủi ro và nhận gợi ý trước khi nộp.</span></div>`}
    </div>`;
  }

  function detailActivityTab(report) {
    const logs = (R.auditLogs || []).filter((log) => log.reportId === report.id).slice(0, 30);
    return `<div class="rp-dr-section">
      <div class="rp-dr-section-head"><h4>${A.icon("history")} Hoạt động</h4><span class="rp-muted-note">v${Number(report.version) || 1}</span></div>
      ${logs.length
        ? `<div class="rp-timeline">${logs.map((log) => `<div class="rp-tl-item">
            <span class="rp-tl-dot"></span>
            <div class="rp-tl-main"><strong>${esc(ACTION_LABEL[log.action] || log.action || "Cập nhật")}</strong><span>${esc(log.detail || "")}</span></div>
            <span class="rp-tl-time">${esc(A.timeAgo(log.timestamp) || "")}</span>
          </div>`).join("")}</div>`
        : `<div class="rp-dr-empty">${A.icon("history")}<span>Chưa có hoạt động nào được ghi cho báo cáo này.</span></div>`}
      <div class="rp-dr-facts">
        <div><span>Ngày tạo</span><strong>${esc(report.createdAt ? A.fmtLong(String(report.createdAt).slice(0, 10)) : "—")}</strong></div>
        <div><span>Cập nhật</span><strong>${esc(A.timeAgo(report.updatedAt) || "—")}</strong></div>
        <div><span>Lần gửi gần nhất</span><strong>${esc(report.lastSentAt ? A.timeAgo(report.lastSentAt) : "Chưa gửi")}</strong></div>
      </div>
    </div>`;
  }

  const DETAIL_TABS = [
    { key: "content", label: "Nội dung", icon: "file" },
    { key: "files", label: "Tệp đính kèm", icon: "paperclip" },
    { key: "excel", label: "Excel mẫu", icon: "grid" },
    { key: "schedule", label: "Lịch & quy trình", icon: "calendar" },
    { key: "ai", label: "Trợ lý AI", icon: "spark" },
    { key: "activity", label: "Hoạt động", icon: "history" },
  ];

  function detailHtml(report) {
    const files = reportFiles(report).length;
    const issues = readiness(report);
    const due = dueBadge(report);
    const tab = DETAIL_TABS.some((item) => item.key === R.detailTab) ? R.detailTab : "content";
    const body =
      tab === "files"
        ? detailFilesTab(report)
        : tab === "excel"
        ? typeof A.excelTab === "function"
          ? A.excelTab(report)
          : `<div class="rp-dr-empty">${A.icon("grid")}<span>Mô-đun Excel chưa tải xong. Đóng rồi mở lại phần chi tiết.</span></div>`
        : tab === "schedule"
        ? detailScheduleTab(report)
        : tab === "ai"
        ? detailAiTab(report)
        : tab === "activity"
        ? detailActivityTab(report)
        : detailContentTab(report);
    return `<div class="rp-drawer" role="dialog" aria-modal="true" aria-label="Chi tiết báo cáo">
      <header class="rp-dr-head">
        <div class="rp-dr-head-top">
          <span class="rp-cat">${esc(report.category || "Báo cáo")}</span>
          ${statusChip(report.status)}
          ${report.frequency && report.frequency !== "none" ? `<span class="rp-q-freq">${esc(FREQ_LABEL[report.frequency] || "")}</span>` : ""}
          ${due ? `<span class="rp-due ${due.cls}">${A.icon("clock")} ${esc(due.text)}</span>` : ""}
          <button class="icon-btn modal-close" type="button" data-rp-close aria-label="Đóng">${A.icon("x")}</button>
        </div>
        <h2 class="rp-dr-title">${esc(report.title || "Báo cáo chưa đặt tên")}</h2>
        <div class="rp-dr-meta">
          <span>${A.icon("layers")} ${esc(report.project || "Chưa gán dự án")}</span>
          <span>${A.icon("calendar")} ${esc(shortDate(report.date) || "—")}</span>
          ${report.reminderTime ? `<span>${A.icon("clock")} ${esc(report.reminderTime)}</span>` : ""}
          <span>${A.icon("history")} v${Number(report.version) || 1}</span>
        </div>
        <div class="rp-dr-actions">
          ${isDone(report) ? "" : `<button class="btn btn-ghost btn-sm" type="button" data-rp="complete" data-id="${esc(report.id)}">${A.icon("check")} Hoàn thành</button>
          <button class="btn btn-ghost btn-sm" type="button" data-rp="extend" data-id="${esc(report.id)}" data-days="1">${A.icon("clock")} +1 ngày</button>`}
          <button class="btn btn-accent btn-sm" type="button" data-rp="submit" data-id="${esc(report.id)}">${A.icon("send")} Nộp báo cáo</button>
          <button class="btn btn-ghost btn-sm" type="button" data-rp="zalo-send" data-id="${esc(report.id)}">${A.icon("message")} Zalo duyệt</button>
          <button class="btn btn-ghost btn-sm" type="button" data-rp="pin" data-id="${esc(report.id)}">${A.icon("flag")} ${report.pinned ? "Bỏ ghim" : "Ghim"}</button>
          <button class="btn btn-ghost btn-sm" type="button" data-rp="edit" data-id="${esc(report.id)}">${A.icon("pencil")} Sửa</button>
          <button class="btn btn-ghost btn-sm rp-danger" type="button" data-rp="delete" data-id="${esc(report.id)}">${A.icon("trash")} Xoá</button>
        </div>
        <div class="rp-ready">
          ${issues.length
            ? issues.map((item) => `<span class="rp-ready-chip ${item.severity}">${A.icon("alert")} ${esc(item.label)}</span>`).join("")
            : `<span class="rp-ready-chip ok">${A.icon("check-circle")} Hồ sơ sẵn sàng nộp</span>`}
        </div>
      </header>
      <nav class="rp-dr-tabs" aria-label="Chi tiết báo cáo">
        ${DETAIL_TABS.map((item) => `<button class="rp-dr-tab${tab === item.key ? " on" : ""}" type="button" data-rp-dtab="${item.key}">
          ${A.icon(item.icon)}<span>${esc(item.label)}</span>${item.key === "files" && files ? `<b>${files}</b>` : ""}
        </button>`).join("")}
      </nav>
      <div class="rp-dr-body" data-rp-dbody>${body}</div>
    </div>`;
  }

  function openDetail(id, tab) {
    const report = findReport(id);
    if (!report) return;
    if (R.detailOverlay) {
      R.detailId = null;
      A.closeOverlay(R.detailOverlay);
      R.detailOverlay = null;
    }
    R.detailId = id;
    R.detailTab = tab || "content";
    R.aiError = "";
    const overlay = A.openOverlay(detailHtml(report), {
      className: "rp-drawer-wrap",
      onClose: () => {
        R.detailId = null;
        R.detailOverlay = null;
        R.aiBusy = null;
        R.aiError = "";
      },
    });
    if (!overlay) return;
    R.detailOverlay = overlay;
    overlay.querySelectorAll("[data-rp-close]").forEach((btn) => btn.addEventListener("click", () => A.closeOverlay(overlay)));
  }

  function refreshDetail() {
    if (!R.detailId) return;
    const report = findReport(R.detailId);
    const overlay = R.detailOverlay;
    if (!report || !overlay || !document.body.contains(overlay)) {
      R.detailId = null;
      R.detailOverlay = null;
      return;
    }
    overlay.innerHTML = detailHtml(report);
    overlay.querySelectorAll("[data-rp-close]").forEach((btn) => btn.addEventListener("click", () => A.closeOverlay(overlay)));
  }

  /* ---------- modal báo cáo ---------- */
  function reportFormHtml(report) {
    const r = report || {};
    const category = r.category || "Báo cáo tuần";
    const frequency = r.frequency || inferFrequency(category);
    return `<div class="modal rp-modal" role="dialog" aria-modal="true">
      <div class="modal-head">
        <div>
          <div class="modal-eyebrow">${A.icon("spark")} ${r.id ? "Cập nhật báo cáo" : "Báo cáo mới"}</div>
          <div class="modal-title">${r.id ? "Sửa báo cáo" : "Tạo báo cáo"}</div>
          <div class="modal-sub">Dữ liệu lưu vào kho KV theo tài khoản Google, kèm tệp và lịch nhắc.</div>
        </div>
        <button class="icon-btn modal-close" type="button" data-rp-close aria-label="Đóng">${A.icon("x")}</button>
      </div>
      <div class="modal-body">
        <div class="rp-form">
          <label class="field"><span>Tiêu đề</span><input class="input" id="rpTitle" value="${esc(r.title || "")}" placeholder="Báo cáo tiến độ tuần 44"></label>
          <div class="rp-form-row">
            <label class="field"><span>Danh mục</span><select class="select" id="rpCategory">${CATEGORIES.map((c) => `<option value="${esc(c)}"${category === c ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
            <label class="field"><span>Trạng thái</span><select class="select" id="rpStatus">${STATUSES.map((s) => `<option value="${esc(s)}"${(r.status || "To-do") === s ? " selected" : ""}>${esc(STATUS_LABEL[s])}</option>`).join("")}</select></label>
          </div>
          <div class="rp-form-row">
            <label class="field"><span>Dự án</span><input class="input" id="rpProject" value="${esc(r.project || "")}" placeholder="Dự án App"></label>
            <label class="field"><span>Chu kỳ</span><select class="select" id="rpFreq">${FREQ_VALUES.map((value) => `<option value="${value}"${frequency === value ? " selected" : ""}>${esc(FREQ_LABEL[value])}</option>`).join("")}</select></label>
          </div>
          <div class="rp-form-row">
            <label class="field"><span>Ngày báo cáo</span><input class="input" id="rpDate" type="date" value="${esc(r.date || A.todayISO())}"></label>
            <label class="field"><span>Hạn nộp</span><input class="input" id="rpDue" type="date" value="${esc(r.dueDate || "")}"></label>
          </div>
          <div class="rp-form-row">
            <label class="field"><span>Giờ nhắc</span><input class="input" id="rpTime" type="time" value="${esc(r.reminderTime || "17:00")}"></label>
            <label class="field"><span>SĐT Zalo người duyệt</span><input class="input" id="rpZalo" type="tel" value="${esc(r.zaloPhone || "")}" placeholder="0912345678"></label>
          </div>
          <label class="field"><span>Link nộp báo cáo</span><input class="input" id="rpSubmitUrl" type="url" value="${esc(r.submissionUrl || "")}" placeholder="https://base.vn/…"></label>
          <label class="field"><span>Ghi chú / nội dung</span><textarea class="textarea" id="rpNotes" rows="6" placeholder="Số liệu, tiến độ, việc cần làm tiếp…">${esc(r.notes || "")}</textarea></label>
          <div class="rp-form-row rp-form-checks">
            <label class="rp-check"><input type="checkbox" id="rpPinned"${r.pinned ? " checked" : ""}> <span>Ghim vào truy cập nhanh</span></label>
            <label class="rp-check"><input type="checkbox" id="rpAgent"${r.agentEnabled ? " checked" : ""}> <span>Chú Ong nhắc việc</span></label>
          </div>
          <label class="field"><span>Tệp đính kèm (tuỳ chọn, tối đa 8MB)</span>
            <input type="file" id="rpFile" hidden>
            <button class="rp-file-pick" type="button" data-rp-file-pick>${A.icon("paperclip")} <span data-rp-file-name>Chọn tệp từ máy</span></button>
          </label>
        </div>
        <div class="rp-form-foot">
          <button class="btn btn-ghost" type="button" data-rp-close>Huỷ</button>
          <button class="btn btn-accent" type="button" data-rp-save>${A.icon("check")} Lưu báo cáo</button>
        </div>
      </div>
    </div>`;
  }

  function openForm(id, prefill) {
    const current = id ? findReport(id) : null;
    const overlay = A.openOverlay(reportFormHtml(current || prefill || {}), { className: "rp-overlay" });
    if (!overlay) return;
    overlay.querySelectorAll("[data-rp-close]").forEach((btn) => btn.addEventListener("click", () => A.closeOverlay(overlay)));
    const fileInput = overlay.querySelector("#rpFile");
    const fileNameEl = overlay.querySelector("[data-rp-file-name]");
    const pick = overlay.querySelector("[data-rp-file-pick]");
    if (pick && fileInput) pick.addEventListener("click", () => fileInput.click());
    if (fileInput && fileNameEl) {
      fileInput.addEventListener("change", () => {
        const file = fileInput.files && fileInput.files[0];
        fileNameEl.textContent = file ? `${file.name} · ${fileSize(file.size)}` : "Chọn tệp từ máy";
      });
    }
    const categorySelect = overlay.querySelector("#rpCategory");
    const freqSelect = overlay.querySelector("#rpFreq");
    if (categorySelect && freqSelect) {
      categorySelect.addEventListener("change", () => {
        freqSelect.value = inferFrequency(categorySelect.value);
      });
    }
    const save = overlay.querySelector("[data-rp-save]");
    if (save) {
      save.addEventListener("click", async () => {
        const value = (sel) => overlay.querySelector(sel);
        const title = value("#rpTitle").value.trim();
        if (!title) {
          A.toast("Cần đặt tiêu đề báo cáo.", "error");
          value("#rpTitle").focus();
          return;
        }
        const submissionUrl = value("#rpSubmitUrl").value.trim();
        if (submissionUrl && !safeHref(/^https?:\/\//i.test(submissionUrl) ? submissionUrl : `https://${submissionUrl}`)) {
          A.toast("Link nộp chưa hợp lệ (chỉ nhận http/https).", "error");
          value("#rpSubmitUrl").focus();
          return;
        }
        const now = new Date().toISOString();
        const report = {
          ...(current || {}),
          id: current ? current.id : reportId(),
          title,
          category: value("#rpCategory").value,
          status: value("#rpStatus").value,
          project: value("#rpProject").value.trim(),
          frequency: value("#rpFreq").value,
          date: value("#rpDate").value || A.todayISO(),
          dueDate: value("#rpDue").value || "",
          reminderTime: value("#rpTime").value || "17:00",
          zaloPhone: value("#rpZalo").value.trim(),
          submissionUrl,
          notes: value("#rpNotes").value.trim(),
          path: (current && current.path) || "",
          version: (Number(current && current.version) || 0) + 1,
          pinned: value("#rpPinned").checked,
          agentEnabled: value("#rpAgent").checked,
          createdAt: (current && current.createdAt) || now,
          updatedAt: now,
        };
        R.reports = sortReports(R.reports.filter((item) => item.id !== report.id).concat(report));
        logAction(report, current ? "update" : "create", `v${report.version} · ${report.category}`);
        A.closeOverlay(overlay);
        refresh();
        try {
          await push();
          const pending = fileInput && fileInput.files && fileInput.files[0];
          if (pending) await uploadFiles(report, [pending]);
          A.toast(current ? "Đã cập nhật báo cáo." : "Đã tạo báo cáo.", "success");
          refresh();
        } catch (err) {
          A.toast(err.message || "Chưa lưu được lên máy chủ.", "error");
        }
      });
    }
  }

  /* ---------- tệp ---------- */
  async function uploadFiles(report, files) {
    const list = (files || []).filter(Boolean);
    if (!list.length) return;
    for (const file of list) {
      if (file.size > MAX_FILE_BYTES) {
        A.toast(`“${file.name}” vượt quá 8MB.`, "error");
        continue;
      }
      A.toast(`Đang tải “${file.name}”…`, "info");
      try {
        const res = await fetch("/api/files", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "content-type": "application/octet-stream",
            "x-file-name": encodeURIComponent(file.name),
            "x-file-type": file.type || "application/octet-stream",
            "x-report-id": report.id,
          },
          body: file,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.file) throw new Error(data.error || `Máy chủ trả về ${res.status}`);
        const meta = data.file;
        R.fileBlobs = R.fileBlobs.filter((item) => item.id !== meta.id).concat(meta);
        report.fileName = meta.name;
        report.fileBlobId = meta.id;
        report.fileSize = meta.size;
        report.fileType = meta.type;
        report.fileVersion = meta.version;
        report.updatedAt = new Date().toISOString();
        logAction(report, "upload", `${meta.name} · v${meta.version} · ${fileSize(meta.size)}`);
        R.reports = sortReports(R.reports.map((item) => (item.id === report.id ? report : item)));
        await push();
        A.toast(`Đã tải “${meta.name}” lên kho.`, "success");
      } catch (err) {
        A.toast(err.message || "Chưa tải được tệp.", "error");
      }
    }
    refresh();
  }

  function openPrimaryFile(report) {
    const files = reportFiles(report);
    if (files.length) {
      window.open(`/api/files/${encodeURIComponent(files[0].id)}`, "_blank", "noopener,noreferrer");
      A.toast(`Đang mở “${files[0].name}”.`, "info");
      return;
    }
    if (excelReady(report)) {
      window.open(`/api/files/${encodeURIComponent(report.excel.latestId)}?download=1`, "_blank", "noopener,noreferrer");
      A.toast(`Đang mở “${report.excel.latestName || "bản Excel mới nhất"}”.`, "info");
      return;
    }
    const drive = driveUrl(report);
    if (drive) {
      window.open(drive, "_blank", "noopener,noreferrer");
      A.toast(`Đang mở “${report.fileName || report.title}”.`, "info");
      return;
    }
    const name = downloadReportCsv(report);
    A.toast(`Chưa có tệp gốc — đã tải bản CSV ${name}.`, "info");
  }

  function deleteFile(id, report) {
    const file = R.fileBlobs.find((item) => item.id === id);
    if (!file) return;
    A.confirm(
      {
        title: "Xoá tệp đính kèm?",
        message: `“${esc(file.name || "Tệp")}” sẽ bị xoá khỏi kho KV. Bản trên máy bạn vẫn còn.`,
        confirmLabel: "Xoá tệp",
      },
      async () => {
        try {
          const res = await fetch(`/api/files/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "same-origin" });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || `Máy chủ trả về ${res.status}`);
          R.fileBlobs = R.fileBlobs.filter((item) => item.id !== id);
          if (report.fileBlobId === id) {
            const next = reportFiles(report)[0];
            report.fileBlobId = next ? next.id : "";
            report.fileName = next ? next.name : "";
            report.updatedAt = new Date().toISOString();
          }
          logAction(report, "removefile", file.name || id);
          await push();
          A.toast("Đã xoá tệp.", "success");
          refresh();
        } catch (err) {
          A.toast(err.message || "Chưa xoá được tệp.", "error");
        }
      }
    );
  }

  /* ---------- hành động ---------- */
  async function removeReport(id) {
    const report = findReport(id);
    if (!report) return;
    A.confirm(
      {
        title: "Xoá báo cáo?",
        message: `“${esc(report.title || "Báo cáo")}” sẽ bị xoá khỏi kho và đồng bộ trên mọi thiết bị.`,
        confirmLabel: "Xoá báo cáo",
      },
      async () => {
        R.reports = R.reports.filter((item) => item.id !== id);
        if (!R.tombstones.includes(id)) R.tombstones.push(id);
        logAction(report, "delete", report.title || "");
        if (R.detailId === id && R.detailOverlay) A.closeOverlay(R.detailOverlay);
        refresh();
        try {
          await push([id]);
          A.toast("Đã xoá báo cáo.", "success");
        } catch (err) {
          A.toast(err.message || "Chưa xoá được trên máy chủ.", "error");
          await loadData().catch(() => {});
          refresh();
        }
      }
    );
  }

  async function togglePin(id) {
    const report = findReport(id);
    if (!report) return;
    report.pinned = !report.pinned;
    report.updatedAt = new Date().toISOString();
    logAction(report, "pin", report.pinned ? "Ghim báo cáo" : "Bỏ ghim");
    R.reports = sortReports(R.reports);
    refresh();
    try {
      await push();
      A.toast(report.pinned ? "Đã ghim báo cáo." : "Đã bỏ ghim báo cáo.", "success");
    } catch (err) {
      A.toast(err.message || "Chưa lưu được trạng thái ghim.", "error");
      await loadData().catch(() => {});
      refresh();
    }
  }

  async function saveReport(report, toastText) {
    report.updatedAt = new Date().toISOString();
    R.reports = sortReports(R.reports.map((item) => (item.id === report.id ? report : item)));
    refresh();
    try {
      await push();
      if (toastText) A.toast(toastText, "success");
    } catch (err) {
      A.toast(err.message || "Chưa lưu được thay đổi.", "error");
    }
  }

  async function readyToSubmit(report) {
    const target = String(report.submissionUrl || "").trim();
    if (target) window.open(/^https?:\/\//i.test(target) ? target : `https://${target}`, "_blank", "noopener,noreferrer");
    let fresh = null;
    if (report.excel && report.excel.templateId && A.excelBridge && typeof A.excelBridge.regenerate === "function") {
      fresh = await A.excelBridge.regenerate(report).catch(() => null);
    }
    if (fresh && fresh.id) {
      const link = document.createElement("a");
      link.href = `/api/files/${encodeURIComponent(fresh.id)}?download=1`;
      link.download = fresh.name || "bao-cao.xlsx";
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      A.toast(`Đã tạo bản Excel mới cho ngày nộp: “${fresh.name}”.`, "info");
    } else {
      openPrimaryFile(report);
    }
    const content = report.notes || report.aiSummary || report.title || "";
    if (content && navigator.clipboard) navigator.clipboard.writeText(content).catch(() => {});
    const live = findReport(report.id) || report;
    const now = new Date().toISOString();
    const wasDone = isDone(live);
    live.status = "Sent";
    live.lastSentAt = now;
    live.updatedAt = now;
    logAction(live, "submit", `Nộp báo cáo${target ? ` tại ${target}` : ""}`);
    R.reports = sortReports(R.reports);
    refresh();
    try {
      await push();
      if (!wasDone) A.toast("Đã đánh dấu Đã gửi và ghi vào hoạt động.", "success");
    } catch (err) {
      A.toast(err.message || "Chưa đồng bộ được trạng thái Đã gửi.", "error");
      return;
    }
    if (live.frequency && live.frequency !== "none") autoAdvance();
  }

  function sendZalo(report) {
    openPrimaryFile(report);
    const message = `Dạ anh/chị duyệt giúp em báo cáo ${report.title} nhé!${report.notes ? `\n\nNội dung tóm tắt:\n${report.notes}` : ""}`;
    if (navigator.clipboard) navigator.clipboard.writeText(message).catch(() => {});
    const phone = zaloPhone(report.zaloPhone);
    window.open(`https://zalo.me/${phone}`, "_blank", "noopener,noreferrer");
    A.toast(`Đã copy lời nhắn và mở Zalo 0${phone.slice(2)}.`, "success");
  }

  async function advanceCycle(report) {
    const next = nextDueDate(report);
    if (!next) {
      A.toast("Bật chu kỳ trước khi chuyển kỳ.", "error");
      return;
    }
    report.date = next;
    report.dueDate = next;
    report.status = "To-do";
    report.lastProcessedDate = A.todayISO();
    logAction(report, "cycle", `Chuyển kỳ mới ${shortDate(next)}`);
    await saveReport(report, `Đã chuyển kỳ sang ${shortDate(next)}.`);
  }

  /* ---------- chèn số liệu từ Kho tài liệu Bee ---------- */
  function docsPickerHtml(report) {
    const docs = R.refDocs || [];
    return `<div class="modal rp-modal rp-docs-modal" role="dialog" aria-modal="true">
      <div class="modal-head">
        <div>
          <div class="modal-eyebrow">${A.icon("layers")} Kho tài liệu Bee</div>
          <div class="modal-title">Chèn số liệu</div>
          <div class="modal-sub">${esc(report.title || "Báo cáo")} · ${docs.length} tài liệu tham chiếu</div>
        </div>
        <button class="icon-btn modal-close" type="button" data-rp-close aria-label="Đóng">${A.icon("x")}</button>
      </div>
      <div class="modal-body">
        ${docs.length
          ? `<div class="rp-docs">
              ${docs.map((doc) => `<article class="rp-doc">
                <div class="rp-doc-head">
                  <span class="rp-doc-ico">${A.icon("file")}</span>
                  <div class="rp-doc-main">
                    <strong>${esc(doc.title || "Tài liệu")}</strong>
                    <span>${esc(doc.category || "Tài liệu")}${doc.fileName ? ` · ${esc(doc.fileName)}` : ""}${doc.fileSizeFormatted ? ` · ${esc(doc.fileSizeFormatted)}` : ""}</span>
                  </div>
                  ${doc.pinned ? `<span class="rp-tag warn">${A.icon("flag")} Ghim</span>` : ""}
                </div>
                ${doc.keyMetrics || doc.description ? `<pre class="rp-doc-metrics">${esc(doc.keyMetrics || doc.description)}</pre>` : ""}
                ${Array.isArray(doc.tags) && doc.tags.length ? `<div class="rp-doc-tags">${doc.tags.map((tag) => `<span class="rp-tag muted">${esc(tag)}</span>`).join("")}</div>` : ""}
                <div class="rp-doc-foot">
                  ${safeHref(doc.externalUrl) ? `<a class="btn btn-ghost btn-sm" href="${esc(safeHref(doc.externalUrl))}" target="_blank" rel="noopener noreferrer">${A.icon("external")} Mở nguồn</a>` : `<span class="rp-muted-note">Lưu trong kho Bee</span>`}
                  <button class="btn btn-accent btn-sm" type="button" data-rp="insert-doc" data-id="${esc(report.id)}" data-doc="${esc(doc.id)}">${A.icon("plus")} Chèn vào báo cáo</button>
                </div>
              </article>`).join("")}
            </div>`
          : `<div class="rp-dr-empty">${A.icon("layers")}<span>Kho tài liệu Bee chưa có tài liệu nào. Nhập dữ liệu Bee để dùng tính năng này.</span></div>`}
        <p class="rp-muted-note">Số liệu được thêm vào cuối nội dung, kèm nguồn tài liệu. Bạn vẫn sửa lại được trước khi nộp.</p>
      </div>
    </div>`;
  }

  function openMetricsPicker(report) {
    if (!report) return;
    if (!R.refDocs.length) {
      A.toast("Kho tài liệu Bee đang trống.", "error");
      return;
    }
    const overlay = A.openOverlay(docsPickerHtml(report), { className: "rp-overlay" });
    if (!overlay) return;
    overlay.querySelectorAll("[data-rp-close]").forEach((btn) => btn.addEventListener("click", () => A.closeOverlay(overlay)));
  }

  async function insertDocMetrics(report, docId) {
    const doc = R.refDocs.find((item) => item && item.id === docId);
    if (!report || !doc) return;
    const block = [
      `Số liệu tham chiếu · ${doc.title || "Tài liệu Bee"}`,
      String(doc.keyMetrics || doc.description || "").trim(),
      `Nguồn: ${doc.fileName || doc.category || "Kho tài liệu Bee"}`,
    ].filter(Boolean).join("\n");
    const notes = String(report.notes || "").trim();
    report.notes = notes ? `${notes}\n\n${block}` : block;
    report.docRefs = Array.from(new Set((Array.isArray(report.docRefs) ? report.docRefs : []).concat(doc.id)));
    report.version = (Number(report.version) || 0) + 1;
    logAction(report, "insert", `${doc.title || doc.id} → v${report.version}`);
    const picker = document.querySelector(".rp-docs-modal");
    if (picker && picker.closest(".overlay")) A.closeOverlay(picker.closest(".overlay"));
    R.detailTab = "content";
    await saveReport(report, "Đã chèn số liệu từ Kho tài liệu Bee.");
  }

  /* ---------- AI ---------- */
  async function runAnalyze(id) {
    const report = findReport(id);
    if (!report) return;
    R.aiBusy = id;
    R.aiError = "";
    if (R.detailId === id) R.detailTab = "ai";
    refreshDetail();
    try {
      const data = await jfetch("/api/ai/analyze-3tier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reports: [report] }),
      });
      const actions = Array.isArray(data.tier3_actionRecommendations) ? data.tier3_actionRecommendations : [];
      report.aiSummary = [data.tier1_factSummary, data.tier2_kpiRiskAnalysis].filter(Boolean).join("\n\n");
      report.aiTier1 = data.tier1_factSummary || "";
      report.aiTier2 = data.tier2_kpiRiskAnalysis || "";
      report.aiActionItems = actions;
      report.aiQualityScore = Number(data.qualityScore) || 0;
      report.aiEmailBody = data.suggestedEmailBody || "";
      report.managerFeedback = data.managerFeedbackSimulated || "";
      report.aiAnalyzedAt = new Date().toISOString();
      report.updatedAt = report.aiAnalyzedAt;
      logAction(report, "ai", `Điểm chất lượng ${Math.round(report.aiQualityScore)}/100`);
      R.aiBusy = null;
      R.reports = sortReports(R.reports.map((item) => (item.id === id ? report : item)));
      refresh();
      await push();
      A.toast("Bee AI đã phân tích và lưu nhận xét.", "success");
    } catch (err) {
      R.aiBusy = null;
      R.aiError = err.message || "AI chưa phản hồi.";
      if (R.detailId === id) refreshDetail();
      A.toast(R.aiError, "error");
    }
  }

  function aiModalHtml(title, body) {
    return `<div class="modal rp-modal rp-ai-modal" role="dialog" aria-modal="true">
      <div class="modal-head">
        <div>
          <div class="modal-eyebrow">${A.icon("spark")} Bee AI</div>
          <div class="modal-title">${esc(title)}</div>
        </div>
        <button class="icon-btn modal-close" type="button" data-rp-close aria-label="Đóng">${A.icon("x")}</button>
      </div>
      <div class="modal-body" data-rp-ai-body>${body}</div>
    </div>`;
  }

  function openZalo() {
    const overlay = A.openOverlay(
      aiModalHtml(
        "Tách tin nhắn Zalo",
        `<p class="rp-ai-lead">Dán nội dung tin nhắn thô, AI sẽ chuyển thành báo cáo có cấu trúc.</p>
        <textarea class="textarea" id="rpZalo" rows="8" placeholder="Ví dụ: Anh ơi chiều nay gửi báo cáo nghiệm thu tầng 3, doanh thu 150tr, còn thiếu biên bản…"></textarea>
        <div class="rp-ai-actions">
          <button class="btn btn-ghost" type="button" data-rp-close>Huỷ</button>
          <button class="btn btn-accent" type="button" id="rpZaloRun">${A.icon("spark")} Tách thành báo cáo</button>
        </div>`
      ),
      { className: "rp-overlay" }
    );
    if (!overlay) return;
    overlay.querySelectorAll("[data-rp-close]").forEach((btn) => btn.addEventListener("click", () => A.closeOverlay(overlay)));
    const run = overlay.querySelector("#rpZaloRun");
    if (!run) return;
    run.addEventListener("click", async () => {
      const rawText = overlay.querySelector("#rpZalo").value.trim();
      if (!rawText) {
        A.toast("Chưa có nội dung để tách.", "error");
        return;
      }
      run.disabled = true;
      run.textContent = "Đang tách…";
      try {
        const data = await jfetch("/api/ai/parse-zalo-raw", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawText }),
        });
        const questions = Array.isArray(data.missingDataQuestions) ? data.missingDataQuestions : [];
        const actions = Array.isArray(data.actionItems) ? data.actionItems : [];
        const notes = [
          data.notes || rawText,
          actions.length ? `\n\nViệc cần làm:\n${actions.map((item) => `- [ ] ${item}`).join("\n")}` : "",
          questions.length ? `\n\nCần bổ sung:\n${questions.map((q) => `- ${q}`).join("\n")}` : "",
        ].join("");
        A.closeOverlay(overlay);
        openForm(null, {
          title: data.title || "",
          category: CATEGORIES.includes(data.category) ? data.category : "Báo cáo ngày",
          project: data.project || "",
          dueDate: data.dueDate || "",
          notes,
          status: "To-do",
        });
      } catch (err) {
        A.toast(err.message || "AI chưa tách được nội dung.", "error");
        run.disabled = false;
        run.textContent = "Tách thành báo cáo";
      }
    });
  }

  /* ---------- nhập / xuất ---------- */
  const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
  let driveClient = null;

  function extractReports(payload) {
    const source =
      Array.isArray(payload) ? payload : payload && payload.data && Array.isArray(payload.data.reports) ? payload.data : payload;
    const reports = Array.isArray(source) ? source : Array.isArray(source && source.reports) ? source.reports : [];
    const refDocs = Array.isArray(source && source.refDocs) ? source.refDocs : [];
    return { reports, refDocs };
  }

  function mergeIncoming(incoming, refDocs) {
    const map = new Map(R.reports.map((item) => [item.id, item]));
    let added = 0;
    incoming.forEach((raw) => {
      if (!raw || typeof raw !== "object" || !raw.title) return;
      const id = String(raw.id || reportId());
      const existing = map.get(id);
      const existingTime = existing ? new Date(existing.updatedAt || existing.date || 0).getTime() : 0;
      const incomingTime = new Date(raw.updatedAt || raw.date || 0).getTime();
      if (!existing || incomingTime >= existingTime) {
        map.set(id, {
          status: "To-do",
          category: "Báo cáo tuần",
          project: "",
          frequency: "none",
          date: A.todayISO(),
          version: 1,
          pinned: false,
          agentEnabled: false,
          ...raw,
          id,
          updatedAt: new Date().toISOString(),
        });
        added++;
      }
    });
    const docMap = new Map(R.refDocs.map((doc) => [doc.id, doc]));
    (Array.isArray(refDocs) ? refDocs : []).forEach((doc) => {
      if (doc && doc.id) docMap.set(doc.id, doc);
    });
    R.refDocs = Array.from(docMap.values());
    R.reports = sortReports(Array.from(map.values()));
    return added;
  }

  async function commitImport(payload, label) {
    const { reports, refDocs } = extractReports(payload);
    if (!reports.length) throw new Error("Không tìm thấy báo cáo nào để nhập.");
    const added = mergeIncoming(reports, refDocs);
    logAction(null, "import", `${added} báo cáo ${label}`);
    await push();
    refresh();
    A.toast(`Đã nhập ${added} báo cáo ${label}.`, "success");
  }

  function openImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        A.toast("Tệp quá lớn (giới hạn 2MB).", "error");
        return;
      }
      try {
        await commitImport(JSON.parse(await file.text()), "từ tệp JSON");
      } catch (err) {
        A.toast(err.message || "Không đọc được tệp JSON.", "error");
      }
    });
    input.click();
  }

  function importFromDrive() {
    if (!R.user) {
      A.toast("Đăng nhập Google trước khi nhập từ Drive.", "error");
      return;
    }
    if (!googleReady()) {
      A.toast("Google chưa tải xong. Thử lại sau 1–2 giây.", "error");
      return;
    }
    if (!driveClient) {
      driveClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: `openid email profile ${DRIVE_SCOPE}`,
        callback: async (response) => {
          if (!response || !response.access_token) {
            A.toast("Google không cấp quyền đọc Drive.", "error");
            return;
          }
          A.toast("Đang tìm bản sao Bee trên Drive…", "info");
          const auth = { authorization: `Bearer ${response.access_token}` };
          try {
            const query = encodeURIComponent("name='bee_report_data.json' and trashed=false");
            const listRes = await fetch(
              `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime)`,
              { headers: auth }
            );
            if (listRes.status === 401 || listRes.status === 403) {
              throw new Error("Chưa được cấp quyền đọc Drive. Thử đăng nhập lại rồi nhập lại.");
            }
            if (!listRes.ok) throw new Error(`Drive trả về ${listRes.status}.`);
            const list = await listRes.json();
            const file = Array.isArray(list.files) ? list.files[0] : null;
            if (!file) throw new Error("Không thấy bee_report_data.json trong Drive. Hãy bật đồng bộ Drive trong Bee một lần.");
            const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`, {
              headers: auth,
            });
            if (!fileRes.ok) throw new Error(`Không tải được tệp Bee (${fileRes.status}).`);
            await commitImport(await fileRes.json(), "từ Bee Drive");
          } catch (err) {
            A.toast(err.message || "Chưa nhập được từ Drive.", "error");
          }
        },
      });
    }
    driveClient.requestAccessToken({ prompt: "consent" });
  }

  function exportJson() {
    const payload = { exportedAt: new Date().toISOString(), reports: R.reports, refDocs: R.refDocs, auditLogs: R.auditLogs };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `guong-bao-cao-${A.todayISO()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    A.toast("Đã xuất tệp JSON.", "success");
  }

  /* ---------- sự kiện ---------- */
  document.addEventListener("click", (event) => {
    const tabTrigger = event.target.closest("[data-rp-dtab]");
    if (tabTrigger) {
      R.detailTab = tabTrigger.getAttribute("data-rp-dtab");
      R.aiError = "";
      refreshDetail();
      return;
    }
    const trigger = event.target.closest("[data-rp]");
    if (!trigger) return;
    const action = trigger.getAttribute("data-rp");
    const id = trigger.getAttribute("data-id");
    const report = id ? findReport(id) : null;
    if (action === "signin") signIn();
    else if (action === "signout") signOut();
    else if (action === "create") openForm();
    else if (action === "open") {
      if (id) openDetail(id);
    } else if (action === "edit") openForm(id);
    else if (action === "delete") removeReport(id);
    else if (action === "pin") togglePin(id);
    else if (action === "focus") {
      R.focusFilter = trigger.getAttribute("data-focus") || "all";
      refresh();
    } else if (action === "file") {
      if (report) openPrimaryFile(report);
    } else if (action === "submit") {
      if (report) readyToSubmit(report);
    } else if (action === "complete") {
      if (report) completeReport(report);
    } else if (action === "extend") {
      if (report) extendReport(report, trigger.getAttribute("data-days"));
    } else if (action === "extend-menu") {
      if (report) openExtendMenu(report);
    } else if (action === "zalo-send") {
      if (report) sendZalo(report);
    } else if (action === "ai-run") {
      runAnalyze(id);
    } else if (action === "insert-metrics") {
      if (report) openMetricsPicker(report);
    } else if (action === "insert-doc") {
      if (report) insertDocMetrics(report, trigger.getAttribute("data-doc"));
    } else if (action === "ai") {
      openDetail(id, "ai");
    } else if (action === "copy-email") {
      if (report && report.aiEmailBody && navigator.clipboard) {
        navigator.clipboard.writeText(report.aiEmailBody).catch(() => {});
        A.toast("Đã copy email gợi ý.", "success");
      }
    } else if (action === "csv") {
      if (report) {
        const name = downloadReportCsv(report);
        A.toast(`Đã tải ${name}.`, "success");
      }
    } else if (action === "pick-file") {
      const input = document.querySelector("[data-rp-file-input]");
      if (input) input.click();
    } else if (action === "file-del") {
      deleteFile(trigger.getAttribute("data-file"), report);
    } else if (action === "advance") {
      if (report) advanceCycle(report);
    } else if (action === "agent-toggle") {
      if (report) {
        report.agentEnabled = !report.agentEnabled;
        logAction(report, "update", report.agentEnabled ? "Bật Chú Ong nhắc việc" : "Tắt Chú Ong nhắc việc");
        saveReport(report, report.agentEnabled ? "Chú Ong sẽ nhắc báo cáo này." : "Đã tắt nhắc việc.");
      }
    } else if (action === "bee-toggle") {
      R.beeOpen = !R.beeOpen;
      refresh();
    } else if (action === "bee-close") {
      R.beeOpen = false;
      refresh();
    } else if (action === "pin-more") {
      R.pinOpen = !R.pinOpen;
      refresh();
    } else if (action === "bee-notify") {
      if (R.notify) A.toast("Nhắc nhở hệ thống đã bật.", "info");
      else enableReminders();
    } else if (action === "zalo") openZalo();
    else if (action === "drive") importFromDrive();
    else if (action === "import") openImport();
    else if (action === "export") exportJson();
    else if (action === "tab-vault") {
      R.tab = "vault";
      refresh();
    } else if (action === "tab-weekly") {
      R.tab = "weekly";
      refresh();
    }
  });

  document.addEventListener("change", async (event) => {
    const fileInput = event.target.closest("[data-rp-file-input]");
    if (fileInput) {
      const list = fileInput.files ? Array.from(fileInput.files) : [];
      fileInput.value = "";
      if (!list.length || !R.detailId) return;
      const report = findReport(R.detailId);
      if (report) await uploadFiles(report, list);
      return;
    }
    const field = event.target.closest("[data-rp-field]");
    if (!field) return;
    const id = field.getAttribute("data-id");
    const report = findReport(id);
    if (!report) return;
    const key = field.getAttribute("data-rp-field");
    const value = field.value;
    if (key === "submissionUrl" && value && !safeHref(/^https?:\/\//i.test(value) ? value : `https://${value}`)) {
      A.toast("Link nộp chưa hợp lệ (chỉ nhận http/https).", "error");
      field.value = report.submissionUrl || "";
      return;
    }
    report[key] = value;
    logAction(report, "update", `${key}: ${value || "(trống)"}`);
    await saveReport(report);
    if (key === "frequency" && value !== "none") {
      A.toast(`Đã bật chu kỳ ${FREQ_LABEL[value] || value}.`, "success");
    }
  });

  document.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-rp-code-form]");
    if (!form) return;
    event.preventDefault();
    const input = form.querySelector("input[name=code]");
    const button = form.querySelector("button");
    const code = input ? input.value.trim() : "";
    if (!code) return;
    button.disabled = true;
    try {
      await jfetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      R.needCode = false;
      R.booted = false;
      boot();
    } catch (err) {
      A.toast(err.message || "Mã truy cập không đúng.", "error");
      button.disabled = false;
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const trigger = event.target.closest('[data-rp="open"][role="button"]');
    if (!trigger) return;
    event.preventDefault();
    const id = trigger.getAttribute("data-id");
    if (id) openDetail(id);
  });

  /* ---------- đồng bộ tài khoản toàn app ---------- */
  function resetReportState() {
    if (R.sse) {
      R.sse.close();
      R.sse = null;
    }
    R.detailId = null;
    R.loaded = false;
    R.loading = false;
    R.pinOpen = false;
    R.reports = [];
    R.refDocs = [];
    R.fileBlobs = [];
    R.auditLogs = [];
    R.tombstones = [];
    if (R.detailOverlay) {
      A.closeOverlay(R.detailOverlay);
      R.detailOverlay = null;
    }
  }

  async function applyAccount(user) {
    resetReportState();
    R.user = { email: user.email, name: user.name || user.email, picture: user.picture || "" };
    R.needCode = false;
    R.codeRequired = false;
    R.loading = true;
    refresh();
    try {
      await loadData();
      subscribe();
      startClock();
      autoAdvance();
    } catch (err) {
      if (err.status === 401) R.needCode = true;
      else A.toast(err.message || "Không tải được báo cáo.", "error");
    }
    R.loading = false;
    refresh();
  }

  window.addEventListener("guong:account", (event) => {
    if (!R.booted) return;
    const user = event.detail;
    if (!user) {
      if (!R.user && !R.reports.length) return;
      resetReportState();
      R.user = null;
      R.needCode = false;
      R.codeRequired = false;
      refresh();
      return;
    }
    const email = String(user.email || "").toLowerCase();
    if (R.user && String(R.user.email || "").toLowerCase() === email) {
      R.user = { email: R.user.email, name: user.name || R.user.name, picture: user.picture || R.user.picture };
      refresh();
      return;
    }
    applyAccount(user);
  });

  function mount() {
    const root = document.getElementById("rpRoot");
    if (!root) return;
    const q = root.querySelector("[data-rp-q]");
    if (q) {
      q.value = R.q;
      q.addEventListener("input", () => {
        R.q = q.value;
        applyFilter();
      });
    }
    const status = root.querySelector("[data-rp-status]");
    if (status) {
      status.value = R.status;
      status.addEventListener("change", () => {
        R.status = status.value;
        applyFilter();
      });
    }
    const category = root.querySelector("[data-rp-category]");
    if (category) {
      category.value = R.category;
      category.addEventListener("change", () => {
        R.category = category.value;
        applyFilter();
      });
    }
    if (!R.booted) {
      R.booted = true;
      boot();
    }
  }

  const baseRender = A.render;
  A.render = function (options) {
    baseRender(options);
    if (A.view === "reports") mount();
  };

  // Nạp sẵn kho báo cáo để thẻ nhắc trên Tổng quan có dữ liệu ngay từ đầu.
  function startBackground() {
    if (R.booted) return;
    R.booted = true;
    boot();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startBackground, { once: true });
  else startBackground();
})();
