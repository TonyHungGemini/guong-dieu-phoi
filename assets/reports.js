/* ============================================================
   GUỒNG — Kho báo cáo (nền dữ liệu Bee: KV + SSE + AI)
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

  const weeklyRenderer = A.renderReports;
  const esc = A.esc;

  const R = {
    booted: false,
    loading: false,
    loaded: false,
    offline: false,
    needCode: false,
    user: null,
    reports: [],
    refDocs: [],
    tombstones: [],
    tab: "vault",
    q: "",
    status: "all",
    category: "all",
    sync: "idle",
    signingIn: false,
    tokenClient: null,
    sse: null,
    refreshTimer: null,
  };

  /* ---------- tiện ích ---------- */
  function reportId() {
    return A.uid ? A.uid("rp") : `rp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
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
  function refresh() {
    if (A.view === "reports") A.render({ animate: false });
  }
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

  /* ---------- kết nối dữ liệu ---------- */
  async function boot() {
    R.loading = true;
    refresh();
    try {
      await jfetch("/api/auth/status");
    } catch (err) {
      if (err.status === 401) {
        R.needCode = true;
      } else if (err.offline) {
        R.offline = true;
      } else {
        A.toast(err.message || "Không kiểm tra được máy chủ.", "error");
      }
      R.loading = false;
      refresh();
      return;
    }
    await loadSession();
    if (R.user) {
      try {
        await loadData();
        subscribe();
      } catch (err) {
        if (err.status === 401) R.needCode = true;
        else A.toast(err.message || "Không tải được báo cáo.", "error");
      }
    }
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
          deletedReportIds: deleted || [],
          lastUpdated: new Date().toISOString(),
        }),
      });
      R.reports = sortReports(data.reports || R.reports);
      R.refDocs = Array.isArray(data.refDocs) ? data.refDocs : R.refDocs;
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
          R.loaded = false;
          await loadData();
          subscribe();
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
    R.loaded = false;
    refresh();
    A.toast("Đã đăng xuất khỏi kho báo cáo.", "info");
  }

  /* ---------- hiển thị ---------- */
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
      <a class="btn btn-accent" href="https://guong-dieu-phoi.tonyhunggemini.workers.dev/#/reports">Mở bản Cloudflare</a>
    </section>`;
  }

  function renderSignIn() {
    return `<div class="rp-grid">
      <section class="rp-hero card">
        <div class="rp-kicker">${A.icon("spark")} KHO BÁO CÁO · NỀN DỮ LIỆU BEE</div>
        <h1 class="rp-hero-title">Báo cáo của bạn,<br><span>nằm ngay trong GUỒNG.</span></h1>
        <p class="rp-hero-text">Đăng nhập Google để mở đúng kho báo cáo của tài khoản bạn. Dữ liệu đồng bộ giữa máy tính và điện thoại qua KV, có AI phân tích 3 tầng và tách tin nhắn Zalo.</p>
        <div class="rp-hero-actions">${renderAccount()}</div>
        <ul class="rp-hero-list">
          <li>${A.icon("check-circle")} Tạo, sửa, xoá báo cáo và tài liệu tham chiếu</li>
          <li>${A.icon("check-circle")} Đồng bộ tức thời bằng SSE, dữ liệu giữ theo email</li>
          <li>${A.icon("check-circle")} AI tóm tắt, phân tích rủi ro, soạn email</li>
        </ul>
      </section>
      <aside class="rp-side card">
        <h3>Chuẩn bị một lần</h3>
        <p>Nếu Google báo <b>origin_mismatch</b>, thêm địa chỉ này vào <b>Authorized JavaScript origins</b> của OAuth client:</p>
        <code>https://guong-dieu-phoi.tonyhunggemini.workers.dev</code>
        <p class="rp-side-note">Bản chạy máy: <code>http://localhost:3100</code>. Sau khi thêm, đăng nhập lại.</p>
      </aside>
    </div>`;
  }

  function renderLoading() {
    return `<div class="rp-loading"><span class="rp-spinner"></span> Đang tải kho báo cáo…</div>`;
  }

  function renderToolbar() {
    const counts = { total: R.reports.length, done: 0, review: 0, doing: 0 };
    R.reports.forEach((r) => {
      if (r.status === "Done" || r.status === "Sent") counts.done++;
      else if (r.status === "Pending Review") counts.review++;
      else counts.doing++;
    });
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
      </div>
      <div class="rp-toolbar-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-rp="zalo">${A.icon("message")} Tách Zalo</button>
        <button class="btn btn-ghost btn-sm" type="button" data-rp="drive">${A.icon("layers")} Nhập từ Bee Drive</button>
        <button class="btn btn-ghost btn-sm" type="button" data-rp="import">${A.icon("upload")} Nhập JSON</button>
        <button class="btn btn-ghost btn-sm" type="button" data-rp="export">${A.icon("download")} Xuất</button>
        <button class="btn btn-accent btn-sm" type="button" data-rp="create">${A.icon("plus")} Báo cáo mới</button>
      </div>
    </div>
    <div class="rp-metrics">
      <span><b data-rp-count>${counts.total}</b> báo cáo</span>
      <span class="rp-dot ok"></span><span>${counts.done} xong</span>
      <span class="rp-dot warn"></span><span>${counts.review} chờ duyệt</span>
      <span class="rp-dot accent"></span><span>${counts.doing} đang chạy</span>
      <span class="rp-sync rp-sync-${R.sync}" data-rp-sync>${syncLabel()}</span>
    </div>`;
  }

  function renderCard(report) {
    const notes = String(report.notes || "").trim();
    const meta = [report.project, report.date ? A.fmtLong(report.date) : "", report.dueDate ? `hạn ${A.fmtLong(report.dueDate)}` : ""];
    return `<article class="rp-card" data-rp-card="${esc(report.id)}">
      <div class="rp-card-top">
        <span class="rp-cat">${esc(report.category || "Báo cáo")}</span>
        ${statusChip(report.status)}
        ${report.pinned ? `<span class="rp-pin">${A.icon("flag")} Ghim</span>` : ""}
      </div>
      <h3 class="rp-card-title">${esc(report.title || "Báo cáo chưa đặt tên")}</h3>
      <div class="rp-meta">${meta.filter(Boolean).map((item) => `<span>${esc(item)}</span>`).join("<i>·</i>")}</div>
      ${notes ? `<p class="rp-notes">${esc(notes.length > 220 ? `${notes.slice(0, 220)}…` : notes)}</p>` : `<p class="rp-notes rp-notes-empty">Chưa có ghi chú.</p>`}
      <div class="rp-card-foot">
        <span class="rp-ver">v${Number(report.version) || 1}</span>
        <div class="rp-card-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-rp="edit" data-id="${esc(report.id)}">${A.icon("pencil")} Sửa</button>
          <button class="btn btn-ghost btn-sm" type="button" data-rp="ai" data-id="${esc(report.id)}">${A.icon("spark")} AI</button>
          <button class="btn btn-ghost btn-sm rp-danger" type="button" data-rp="delete" data-id="${esc(report.id)}">${A.icon("trash")} Xoá</button>
        </div>
      </div>
    </article>`;
  }

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
      ${renderToolbar()}
      <div class="rp-list" data-rp-list>${cards}</div>`;
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

  /* ---------- lọc tại chỗ ---------- */
  function applyFilter() {
    const q = A.norm(R.q).trim();
    let shown = 0;
    document.querySelectorAll("[data-rp-card]").forEach((card) => {
      const id = card.getAttribute("data-rp-card");
      const report = R.reports.find((item) => item.id === id);
      if (!report) return;
      const haystack = A.norm([report.title, report.project, report.category, report.notes].join(" "));
      const ok =
        (!q || haystack.includes(q)) &&
        (R.status === "all" || report.status === R.status) &&
        (R.category === "all" || report.category === R.category);
      card.hidden = !ok;
      if (ok) shown++;
    });
    const count = document.querySelector("[data-rp-count]");
    if (count) count.textContent = String(shown);
  }

  /* ---------- modal báo cáo ---------- */
  function reportFormHtml(report) {
    const r = report || {};
    return `<div class="modal rp-modal" role="dialog" aria-modal="true">
      <div class="modal-head">
        <div>
          <div class="modal-eyebrow">${A.icon("spark")} ${r.id ? "Cập nhật báo cáo" : "Báo cáo mới"}</div>
          <div class="modal-title">${r.id ? "Sửa báo cáo" : "Tạo báo cáo"}</div>
          <div class="modal-sub">Dữ liệu lưu vào kho KV theo tài khoản Google.</div>
        </div>
        <button class="icon-btn modal-close" type="button" data-rp-close aria-label="Đóng">${A.icon("x")}</button>
      </div>
      <div class="modal-body">
        <div class="rp-form">
          <label class="field"><span>Tiêu đề</span><input class="input" id="rpTitle" value="${esc(r.title || "")}" placeholder="Báo cáo tiến độ tuần 44"></label>
          <div class="rp-form-row">
            <label class="field"><span>Danh mục</span><select class="select" id="rpCategory">${CATEGORIES.map((c) => `<option value="${esc(c)}"${(r.category || CATEGORIES[1]) === c ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
            <label class="field"><span>Trạng thái</span><select class="select" id="rpStatus">${STATUSES.map((s) => `<option value="${esc(s)}"${(r.status || "To-do") === s ? " selected" : ""}>${esc(STATUS_LABEL[s])}</option>`).join("")}</select></label>
          </div>
          <div class="rp-form-row">
            <label class="field"><span>Dự án</span><input class="input" id="rpProject" value="${esc(r.project || "")}" placeholder="Dự án App"></label>
            <label class="field"><span>Ngày báo cáo</span><input class="input" id="rpDate" type="date" value="${esc(r.date || A.todayISO())}"></label>
          </div>
          <div class="rp-form-row">
            <label class="field"><span>Hạn nộp</span><input class="input" id="rpDue" type="date" value="${esc(r.dueDate || "")}"></label>
            <label class="field"><span>Giờ nhắc</span><input class="input" id="rpTime" type="time" value="${esc(r.reminderTime || "17:00")}"></label>
          </div>
          <label class="field"><span>Ghi chú / nội dung</span><textarea class="textarea" id="rpNotes" rows="6" placeholder="Số liệu, tiến độ, việc cần làm tiếp…">${esc(r.notes || "")}</textarea></label>
        </div>
        <div class="rp-form-foot">
          <button class="btn btn-ghost" type="button" data-rp-close>Huỷ</button>
          <button class="btn btn-accent" type="button" data-rp-save>${A.icon("check")} Lưu báo cáo</button>
        </div>
      </div>
    </div>`;
  }

  function openForm(id, prefill) {
    const current = id ? R.reports.find((item) => item.id === id) : null;
    const overlay = A.openOverlay(reportFormHtml(current || prefill || {}), { className: "rp-overlay" });
    if (!overlay) return;
    overlay.querySelectorAll("[data-rp-close]").forEach((btn) => btn.addEventListener("click", () => A.closeOverlay(overlay)));
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
        const report = {
          ...(current || {}),
          id: current ? current.id : reportId(),
          title,
          category: value("#rpCategory").value,
          status: value("#rpStatus").value,
          project: value("#rpProject").value.trim(),
          date: value("#rpDate").value || A.todayISO(),
          dueDate: value("#rpDue").value || "",
          reminderTime: value("#rpTime").value || "17:00",
          notes: value("#rpNotes").value.trim(),
          path: (current && current.path) || "",
          version: (Number(current && current.version) || 0) + 1,
          pinned: Boolean(current && current.pinned),
          agentEnabled: Boolean(current && current.agentEnabled),
          updatedAt: new Date().toISOString(),
        };
        R.reports = sortReports(R.reports.filter((item) => item.id !== report.id).concat(report));
        A.closeOverlay(overlay);
        refresh();
        try {
          await push();
          A.toast("Đã lưu báo cáo.", "success");
          refresh();
        } catch (err) {
          A.toast(err.message || "Chưa lưu được lên máy chủ.", "error");
        }
      });
    }
  }

  async function removeReport(id) {
    const report = R.reports.find((item) => item.id === id);
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

  /* ---------- AI ---------- */
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

  async function openAi(id) {
    const report = R.reports.find((item) => item.id === id);
    if (!report) return;
    const overlay = A.openOverlay(aiModalHtml(report.title || "Báo cáo", `<div class="rp-loading"><span class="rp-spinner"></span> Đang phân tích 3 tầng…</div>`), { className: "rp-overlay" });
    if (!overlay) return;
    overlay.querySelectorAll("[data-rp-close]").forEach((btn) => btn.addEventListener("click", () => A.closeOverlay(overlay)));
    try {
      const data = await jfetch("/api/ai/analyze-3tier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reports: [report] }),
      });
      const body = overlay.querySelector("[data-rp-ai-body]");
      const actions = Array.isArray(data.tier3_actionRecommendations) ? data.tier3_actionRecommendations : [];
      body.innerHTML = `<div class="rp-ai-score"><b>${Number(data.qualityScore) || 0}</b><span>/100 chất lượng</span></div>
        <section class="rp-ai-block"><h4>Tầng 1 · Dữ liệu thực tế</h4><p>${esc(data.tier1_factSummary || "")}</p></section>
        <section class="rp-ai-block"><h4>Tầng 2 · Tiến độ & rủi ro</h4><p>${esc(data.tier2_kpiRiskAnalysis || "")}</p></section>
        <section class="rp-ai-block"><h4>Tầng 3 · Hành động</h4><ul>${actions.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></section>
        <section class="rp-ai-block"><h4>Email gợi ý</h4><pre class="rp-ai-mail">${esc(data.suggestedEmailBody || "")}</pre></section>
        <section class="rp-ai-block rp-ai-manager"><h4>Phản hồi thử nghiệm từ Sếp</h4><p>${esc(data.managerFeedbackSimulated || "")}</p></section>
        <div class="rp-ai-actions">
          <button class="btn btn-ghost" type="button" data-rp="ai-save" data-id="${esc(id)}">${A.icon("check")} Lưu nhận xét vào báo cáo</button>
          <button class="btn btn-ghost" type="button" data-rp-close>Đóng</button>
        </div>`;
      body.querySelectorAll("[data-rp-close]").forEach((btn) => btn.addEventListener("click", () => A.closeOverlay(overlay)));
      const save = body.querySelector('[data-rp="ai-save"]');
      if (save) {
        save.addEventListener("click", async () => {
          const target = R.reports.find((item) => item.id === id);
          if (!target) return;
          target.aiSummary = [data.tier1_factSummary, data.tier2_kpiRiskAnalysis].filter(Boolean).join("\n\n");
          target.aiActionItems = actions;
          target.aiQualityScore = Number(data.qualityScore) || 0;
          target.updatedAt = new Date().toISOString();
          R.reports = sortReports(R.reports);
          try {
            await push();
            A.toast("Đã lưu nhận xét AI vào báo cáo.", "success");
            A.closeOverlay(overlay);
            refresh();
          } catch (err) {
            A.toast(err.message || "Chưa lưu được nhận xét.", "error");
          }
        });
      }
    } catch (err) {
      const body = overlay.querySelector("[data-rp-ai-body]");
      if (body) body.innerHTML = `<div class="rp-ai-error">${A.icon("alert")} ${esc(err.message || "AI chưa phản hồi.")}</div>`;
    }
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
        const notes = [data.notes || rawText, questions.length ? `\n\nCần bổ sung:\n${questions.map((q) => `- ${q}`).join("\n")}` : ""].join("");
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
    const payload = { exportedAt: new Date().toISOString(), reports: R.reports, refDocs: R.refDocs };
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
    const trigger = event.target.closest("[data-rp]");
    if (!trigger) return;
    const action = trigger.getAttribute("data-rp");
    const id = trigger.getAttribute("data-id");
    if (action === "signin") signIn();
    else if (action === "signout") signOut();
    else if (action === "create") openForm();
    else if (action === "edit") openForm(id);
    else if (action === "delete") removeReport(id);
    else if (action === "ai") openAi(id);
    else if (action === "zalo") openZalo();
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
})();
