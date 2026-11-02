/* ============================================================
   GUỒNG — trung tâm thông báo
   Việc mới, việc sắp tới hạn/quá hạn, báo cáo sắp đến giờ nộp.
   ============================================================ */
(function () {
  const A = window.App;
  if (!A) return;
  const STORE = "guong.notif.v1";
  const SETTLE_MS = 10000;
  const SECTIONS = [
    { key: "new", label: "Việc mới giao cho bạn", icon: "bell" },
    { key: "due", label: "Sắp tới hạn & quá hạn", icon: "clock" },
    { key: "report", label: "Báo cáo sắp đến giờ nộp", icon: "file" },
  ];
  const state = {
    key: "",
    seen: {},
    notified: {},
    lead: {},
    bootstrapped: false,
    muted: false,
    overlay: null,
  };
  let settleUntil = 0;

  /* ---------- lưu trạng thái đã đọc / đã báo ---------- */
  function stateKey() {
    const email = A.account && A.account.email ? String(A.account.email).toLowerCase() : "guest";
    return `${STORE}::${email}`;
  }
  function trim(map, max) {
    const keys = Object.keys(map);
    if (keys.length <= max) return;
    keys
      .sort((a, b) => String(map[a]).localeCompare(String(map[b])))
      .slice(0, keys.length - max)
      .forEach((key) => delete map[key]);
  }
  function loadState() {
    state.key = stateKey();
    state.seen = {};
    state.notified = {};
    state.lead = {};
    state.bootstrapped = false;
    state.muted = false;
    settleUntil = Date.now() + SETTLE_MS;
    try {
      const raw = JSON.parse(localStorage.getItem(state.key));
      if (raw && typeof raw === "object") {
        state.seen = raw.seen && typeof raw.seen === "object" ? raw.seen : {};
        state.notified = raw.notified && typeof raw.notified === "object" ? raw.notified : {};
        state.lead = raw.lead && typeof raw.lead === "object" ? raw.lead : {};
        state.bootstrapped = Boolean(raw.bootstrapped);
        state.muted = Boolean(raw.muted);
      }
    } catch (err) {
      /* bộ nhớ bị chặn — chạy trong phiên này */
    }
  }
  function saveState() {
    try {
      localStorage.setItem(
        state.key,
        JSON.stringify({
          seen: state.seen,
          notified: state.notified,
          lead: state.lead,
          bootstrapped: state.bootstrapped,
          muted: state.muted,
        })
      );
    } catch (err) {
      /* bỏ qua */
    }
  }

  /* ---------- gom nguồn thông báo ---------- */
  function dueLabel(gap) {
    if (gap < 0) return gap === -1 ? "Trễ 1 ngày" : `Trễ ${-gap} ngày`;
    if (gap === 0) return "Hạn hôm nay";
    if (gap === 1) return "Hạn ngày mai";
    return A.fmtShort ? A.fmtShort(A.addDays(A.todayISO(), gap)) : `${gap} ngày nữa`;
  }
  function projectNameOf(task) {
    const project = A.projectById ? A.projectById(task.projectId) : null;
    return project ? project.name : "";
  }
  function localItems() {
    const out = [];
    const me = A.meId ? A.meId() : null;
    const tasks = (A.DATA && A.DATA.tasks ? A.DATA.tasks : []).filter((task) => task.status !== "done");
    const dueIds = new Set();
    tasks
      .filter((task) => task.due && task.assignee)
      .sort((a, b) => String(a.due).localeCompare(String(b.due)))
      .forEach((task) => {
        const gap = A.daysFromToday(task.due);
        if (gap > 1) return;
        dueIds.add(task.id);
        const mine = Boolean(me && task.assignee === me);
        const member = A.memberById ? A.memberById(task.assignee) : null;
        out.push({
          kind: "due",
          sig: `due:${task.id}:${task.due}`,
          icon: gap < 0 ? "alert" : "clock",
          title: task.title || "Công việc",
          meta: [mine ? "Bạn" : member ? member.name : "Chưa giao", dueLabel(gap), projectNameOf(task)].filter(Boolean).join(" · "),
          late: gap < 0,
          at: task.due,
          action: { type: "task", id: task.id },
        });
      });
    if (me) {
      const cutoff = A.addDays(A.todayISO(), -13);
      tasks
        .filter((task) => task.assignee === me && !dueIds.has(task.id))
        .forEach((task) => {
          const created = String(task.createdAt || "").slice(0, 10);
          if (!created || created < cutoff) return;
          out.push({
            kind: "new",
            sig: `new:${task.id}:${created}`,
            icon: "bell",
            title: task.title || "Công việc mới",
            meta: ["Giao cho bạn", projectNameOf(task), created === A.todayISO() ? "Hôm nay" : A.fmtShort(created)]
              .filter(Boolean)
              .join(" · "),
            late: false,
            at: created,
            action: { type: "task", id: task.id },
          });
        });
    }
    return out;
  }
  function sharedItems() {
    const out = [];
    const cutoff = A.addDays(A.todayISO(), -13);
    (A.sharedAlerts || []).forEach((task) => {
      if (!task || !task.taskId || !task.owner || !task.projectId) return;
      const due = task.due || "";
      const gap = due ? A.daysFromToday(due) : null;
      const dueSoon = gap !== null && gap <= 1;
      const base = {
        owner: task.owner,
        projectId: task.projectId,
        projectName: task.projectName || "Dự án được mời",
      };
      if (dueSoon) {
        out.push({
          kind: "due",
          sig: `sdue:${task.owner}:${task.projectId}:${task.taskId}:${due}`,
          icon: gap < 0 ? "alert" : "clock",
          title: task.title || "Công việc",
          meta: [task.mine ? "Bạn" : task.assigneeName || "Chưa giao", dueLabel(gap), base.projectName].filter(Boolean).join(" · "),
          late: gap < 0,
          at: due,
          action: { type: "shared", owner: base.owner, projectId: base.projectId },
        });
        return;
      }
      if (!task.mine) return;
      const created = String(task.createdAt || "").slice(0, 10);
      if (!created || created < cutoff) return;
      out.push({
        kind: "new",
        sig: `snew:${task.owner}:${task.projectId}:${task.taskId}:${created}`,
        icon: "layers",
        title: task.title || "Công việc mới",
        meta: ["Giao cho bạn", base.projectName, created === A.todayISO() ? "Hôm nay" : A.fmtShort(created)]
          .filter(Boolean)
          .join(" · "),
        late: false,
        at: created,
        action: { type: "shared", owner: base.owner, projectId: base.projectId },
      });
    });
    return out;
  }
  function reportItems() {
    const out = [];
    if (typeof A.reportReminders !== "function") return out;
    const reminders = A.reportReminders();
    if (!reminders || !reminders.signedIn) return out;
    ["late", "today", "tomorrow"].forEach((bucket) => {
      (reminders[bucket] || []).forEach((report) => {
        if (!report || !report.id) return;
        const gap = typeof report.gap === "number" ? report.gap : A.daysFromToday(report.due);
        const time = report.reminderTime || "";
        out.push({
          kind: "report",
          sig: `rep:${report.id}:${report.due}:${time}`,
          icon: "file",
          title: report.title || "Báo cáo",
          meta: [report.category || report.project, dueLabel(gap), time ? `nhắc ${time}` : ""].filter(Boolean).join(" · "),
          late: gap < 0,
          at: report.due,
          gap,
          due: report.due,
          reportId: report.id,
          reminderTime: time,
          action: { type: "report", id: report.id },
        });
      });
    });
    return out;
  }
  function notificationItems() {
    const map = new Map();
    localItems()
      .concat(sharedItems(), reportItems())
      .forEach((item) => {
        if (!map.has(item.sig)) map.set(item.sig, item);
      });
    return Array.from(map.values());
  }
  function unreadCount() {
    return notificationItems().filter((item) => !state.seen[item.sig]).length;
  }

  /* ---------- badge trên chuông ---------- */
  function updateBadge() {
    const badge = document.getElementById("notifBadge");
    const btn = document.getElementById("notifBtn");
    if (!badge) return;
    const count = unreadCount();
    badge.textContent = count > 9 ? "9+" : String(count);
    badge.hidden = count === 0;
    if (btn) {
      btn.classList.toggle("has-unread", count > 0);
      btn.title = count ? `${count} thông báo mới` : "Thông báo";
      btn.setAttribute("aria-label", count ? `Thông báo, ${count} mới` : "Thông báo");
    }
  }

  /* ---------- báo ra ngoài app ---------- */
  function canNotify() {
    return !state.muted && "Notification" in window && Notification.permission === "granted";
  }
  function deliver(title, body, tag) {
    if (canNotify()) {
      try {
        new Notification(title, { body, icon: "assets/icon-192.png", tag: tag || "guong-notify" });
        return;
      } catch (err) {
        /* rơi về toast */
      }
    }
    if (document.visibilityState === "visible") A.toast(`${title} — ${body}`, "info");
  }
  function headline(item) {
    if (item.kind === "new") return "Việc mới được giao";
    if (item.kind === "report") return item.late ? "Báo cáo quá hạn" : "Báo cáo sắp đến giờ nộp";
    return item.late ? "Việc đã quá hạn" : "Việc sắp tới hạn";
  }
  function announce() {
    const items = notificationItems();
    const now = new Date().toISOString();
    if (!state.bootstrapped) {
      items.forEach((item) => {
        state.notified[item.sig] = now;
      });
      if (Date.now() < settleUntil) return;
      state.bootstrapped = true;
      trim(state.notified, 500);
      saveState();
      return;
    }
    const fresh = items.filter((item) => !state.notified[item.sig]);
    if (!fresh.length) return;
    fresh.forEach((item) => {
      state.notified[item.sig] = now;
    });
    trim(state.notified, 500);
    saveState();
    fresh.slice(0, 4).forEach((item) => {
      deliver(headline(item), item.title + (item.meta ? ` — ${item.meta}` : ""), `guong-n.${item.sig}`);
    });
    if (fresh.length > 4 && document.visibilityState === "visible") {
      A.toast(`Và ${fresh.length - 4} thông báo mới khác trong chuông.`, "info");
    }
  }
  function leadNudge() {
    const now = new Date();
    const minutesNow = now.getHours() * 60 + now.getMinutes();
    reportItems()
      .filter((item) => item.gap === 0 && item.reminderTime)
      .forEach((item) => {
        const parts = String(item.reminderTime).split(":");
        if (parts.length < 2) return;
        const target = Number(parts[0]) * 60 + Number(parts[1]);
        if (!Number.isFinite(target)) return;
        const diff = target - minutesNow;
        if (diff <= 0 || diff > 30) return;
        const key = `${item.reportId}|${A.todayISO()}`;
        if (state.lead[key]) return;
        state.lead[key] = now.toISOString();
        trim(state.lead, 200);
        saveState();
        deliver(
          `Sắp đến giờ nộp: ${item.title}`,
          `Còn ${diff} phút · hạn ${A.fmtShort(item.due)}${item.reminderTime ? ` lúc ${item.reminderTime}` : ""}.`,
          `guong-lead.${item.reportId}`
        );
      });
  }

  /* ---------- panel ---------- */
  function permissionButton() {
    if (!("Notification" in window)) {
      return `<span class="notif-perm-note">Trình duyệt không hỗ trợ nhắc ngoài app</span>`;
    }
    if (Notification.permission === "denied") {
      return `<button class="btn btn-ghost btn-sm notif-perm" type="button" data-notif-perm disabled>${A.icon("bell")} Quyền thông báo đang bị chặn</button>`;
    }
    if (!state.muted && Notification.permission === "granted") {
      return `<button class="btn btn-ghost btn-sm notif-perm is-on" type="button" data-notif-perm>${A.icon("check")} Đang nhắc trên máy</button>`;
    }
    return `<button class="btn btn-ghost btn-sm notif-perm" type="button" data-notif-perm>${A.icon("bell")} Bật nhắc trên máy</button>`;
  }
  function rowHtml(item, unread) {
    const attrs = [`data-notif-act="${item.action.type}"`];
    if (item.action.type === "task") attrs.push(`data-id="${A.esc(item.action.id)}"`);
    if (item.action.type === "report") attrs.push(`data-id="${A.esc(item.action.id)}"`);
    if (item.action.type === "shared") {
      attrs.push(`data-owner="${A.esc(item.action.owner)}"`);
      attrs.push(`data-project="${A.esc(item.action.projectId)}"`);
    }
    return `<button class="notif-row${item.late ? " is-late" : ""}${unread ? " is-unread" : ""}" type="button" ${attrs.join(" ")}>
      <span class="notif-row-ico">${A.icon(item.icon)}</span>
      <span class="notif-row-main">
        <span class="notif-row-title">${A.esc(item.title)}</span>
        <span class="notif-row-meta">${A.esc(item.meta)}</span>
      </span>
      ${unread ? `<span class="notif-unread" aria-label="Chưa đọc"></span>` : `<span class="notif-row-arrow">${A.icon("chevron-right")}</span>`}
    </button>`;
  }
  function panelHtml(items) {
    const unread = new Set(items.filter((item) => !state.seen[item.sig]).map((item) => item.sig));
    const blocks = SECTIONS.map((section) => {
      const list = items
        .filter((item) => item.kind === section.key)
        .sort((a, b) => {
          if (section.key === "new") return String(b.at).localeCompare(String(a.at));
          return String(a.at || "9999").localeCompare(String(b.at || "9999"));
        });
      if (!list.length) return "";
      const shown = list.slice(0, 8);
      const more = list.length - shown.length;
      return `<section class="notif-sec">
        <div class="notif-sec-head">
          <span class="notif-sec-label">${A.icon(section.icon)} ${section.label}</span>
          <span class="notif-sec-count">${list.length}</span>
        </div>
        <div class="notif-list">${shown.map((item) => rowHtml(item, unread.has(item.sig))).join("")}</div>
        ${more > 0 ? `<div class="notif-more">Còn ${more} mục khác — mở trang liên quan để xem đủ.</div>` : ""}
      </section>`;
    }).join("");
    const empty = items.length
      ? ""
      : `<div class="notif-empty">
          <span class="notif-empty-ico">${A.icon("check-circle")}</span>
          <strong>Chưa có nhắc nào</strong>
          <p>${
            A.account
              ? "Việc mới, việc sắp tới hạn và báo cáo sắp nộp sẽ hiện ở đây."
              : "Đăng nhập Google để nhận nhắc việc từ dự án chung và báo cáo."
          }</p>
        </div>`;
    const newCount = items.filter((item) => !state.seen[item.sig]).length;
    return `<div class="notif-pop" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="notifTitle">
      <header class="notif-head">
        <div class="notif-head-main">
          <div class="notif-eyebrow">${A.icon("bell")} GUỒNG NHẮC BẠN</div>
          <h2 class="notif-title" id="notifTitle">Thông báo</h2>
          <p class="notif-sub">${newCount ? `${newCount} mục mới cần bạn để ý.` : "Bạn đang xem hết các nhắc hiện có."}</p>
        </div>
        <button class="icon-btn notif-close" type="button" data-notif-close aria-label="Đóng">${A.icon("x")}</button>
      </header>
      <div class="notif-body">${blocks}${empty}</div>
      <footer class="notif-foot">
        ${permissionButton()}
        <button class="btn btn-ghost btn-sm" type="button" data-notif-refresh>${A.icon("refresh")} Làm mới</button>
      </footer>
    </div>`;
  }
  function markSeen(items) {
    const now = new Date().toISOString();
    items.forEach((item) => {
      if (!state.seen[item.sig]) state.seen[item.sig] = now;
    });
    trim(state.seen, 500);
    saveState();
    updateBadge();
  }
  function renderPanel(overlay) {
    const items = notificationItems();
    const html = panelHtml(items);
    const current = overlay.querySelector(".notif-pop");
    if (current) current.outerHTML = html;
    const next = overlay.querySelector(".notif-pop");
    if (next) {
      try {
        next.focus({ preventScroll: true });
      } catch (err) {
        /* noop */
      }
    }
    markSeen(items);
  }
  function closePanel() {
    if (!state.overlay) return;
    const overlay = state.overlay;
    state.overlay = null;
    A.closeOverlay(overlay);
  }
  A.openNotifications = function () {
    if (state.overlay && state.overlay.isConnected) {
      closePanel();
      return;
    }
    state.overlay = null;
    const items = notificationItems();
    const overlay = A.openOverlay(panelHtml(items), { className: "notif-overlay", focus: ".notif-pop" });
    if (!overlay) return;
    state.overlay = overlay;
    overlay.addEventListener("click", (event) => {
      if (event.target.closest("[data-notif-close]")) {
        closePanel();
        return;
      }
      if (event.target.closest("[data-notif-refresh]")) {
        const btn = event.target.closest("[data-notif-refresh]");
        btn.disabled = true;
        const done = () => {
          renderPanel(overlay);
        };
        if (typeof A.syncJoinedProjects === "function") {
          A.syncJoinedProjects().then(done, done);
        } else {
          done();
        }
        return;
      }
      if (event.target.closest("[data-notif-perm]")) {
        togglePermission(overlay);
        return;
      }
      const row = event.target.closest("[data-notif-act]");
      if (!row) return;
      const type = row.dataset.notifAct;
      const id = row.dataset.id;
      closePanel();
      if (type === "task") {
        if (A.taskById && A.taskById(id)) A.openTask(id);
        else A.toast("Công việc này không còn trong dự án của bạn.", "info");
        return;
      }
      if (type === "report") {
        if (typeof A.openReport === "function") A.openReport(id);
        else A.go("reports");
        return;
      }
      if (type === "shared") {
        if (typeof A.openSharedProject === "function") A.openSharedProject(row.dataset.owner, row.dataset.project);
        return;
      }
      if (type === "reports") A.go("reports");
    });
    markSeen(items);
  };

  async function togglePermission(overlay) {
    if (!("Notification" in window)) {
      A.toast("Trình duyệt này không hỗ trợ thông báo hệ thống.", "error");
      return;
    }
    if (Notification.permission === "denied") {
      A.toast("Bạn đã chặn quyền thông báo. Mở cài đặt trình duyệt để bật lại.", "info");
      return;
    }
    if (!state.muted && Notification.permission === "granted") {
      state.muted = true;
      saveState();
      A.toast("Đã tắt nhắc trên máy. Thông báo vẫn nằm trong chuông.", "info");
      renderPanel(overlay);
      return;
    }
    if (Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        A.toast("Chưa được cấp quyền thông báo.", "info");
        return;
      }
    }
    state.muted = false;
    saveState();
    A.toast("Đã bật nhắc trên máy cho việc mới, việc sắp hạn và báo cáo.", "success");
    renderPanel(overlay);
  }

  /* ---------- vòng đời ---------- */
  function refresh() {
    updateBadge();
    announce();
    leadNudge();
  }
  A.refreshNotifications = refresh;
  A.refreshNotifyBadge = updateBadge;
  A.notificationItems = notificationItems;

  function start() {
    loadState();
    refresh();
    window.setTimeout(refresh, SETTLE_MS + 500);
    window.setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refresh();
    });
    window.addEventListener("focus", refresh);
    window.addEventListener("guong:reports", () => {
      updateBadge();
      announce();
      leadNudge();
    });
    window.addEventListener("guong:account", () => {
      closePanel();
      A.sharedAlerts = [];
      loadState();
      refresh();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
