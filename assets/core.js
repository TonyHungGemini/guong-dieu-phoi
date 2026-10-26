/* ============================================================
   GUỒNG — core: trạng thái, thời gian, chỉ số, overlay, routing
   ============================================================ */
(function () {
  "use strict";

  const S = window.SEED;
  const App = (window.App = {});
  const KEY = "guong.v1";
  const $ = (sel, root = document) => (root || document).querySelector(sel);

  const STATUS = {
    todo: { label: "Chưa làm", short: "Chưa làm", dot: "var(--muted)" },
    doing: { label: "Đang làm", short: "Đang làm", dot: "var(--accent)" },
    review: { label: "Chờ duyệt", short: "Chờ duyệt", dot: "var(--warn)" },
    done: { label: "Hoàn thành", short: "Đã xong", dot: "var(--ok)" },
  };
  const PRIORITY = {
    high: { label: "Cao" },
    med: { label: "Vừa" },
    low: { label: "Thấp" },
  };
  const STATUS_ORDER = ["todo", "doing", "review", "done"];
  const VIEWS = ["dashboard", "today", "board", "list", "calendar", "team", "reports"];
  const VIEW_LABEL = {
    dashboard: "Tổng quan",
    today: "Hôm nay",
    board: "Bảng việc",
    list: "Danh sách",
    calendar: "Lịch",
    team: "Đội ngũ",
    reports: "Báo cáo",
  };
  const WD_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  const WD_LONG = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const MONTHS = ["tháng 1", "tháng 2", "tháng 3", "tháng 4", "tháng 5", "tháng 6", "tháng 7", "tháng 8", "tháng 9", "tháng 10", "tháng 11", "tháng 12"];

  /* ---------- tiện ích ---------- */
  function pad(n) {
    return String(n).padStart(2, "0");
  }
  function dateISO(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function parseISO(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [y, m, d] = value.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    return dt;
  }
  function todayISO() {
    return dateISO(new Date());
  }
  function addDays(isoDate, n) {
    const dt = parseISO(isoDate) || new Date();
    dt.setDate(dt.getDate() + n);
    return dateISO(dt);
  }
  function diffDays(from, to) {
    const a = parseISO(from);
    const b = parseISO(to);
    if (!a || !b) return 0;
    return Math.round((b - a) / 86400000);
  }
  function daysFromToday(isoDate) {
    return diffDays(todayISO(), isoDate);
  }
  function startOfWeek(isoDate) {
    const dt = parseISO(isoDate || todayISO());
    if (!dt) return todayISO();
    const offset = (dt.getDay() + 6) % 7;
    dt.setDate(dt.getDate() - offset);
    return dateISO(dt);
  }
  function endOfWeek(isoDate) {
    return addDays(startOfWeek(isoDate), 6);
  }
  function weekNumber(isoDate) {
    const dt = parseISO(isoDate || todayISO()) || new Date();
    const target = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    const dayNr = (target.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = new Date(target.getFullYear(), 0, 4);
    const firstDayNr = (firstThursday.getDay() + 6) % 7;
    firstThursday.setDate(firstThursday.getDate() - firstDayNr + 3);
    return 1 + Math.round((target - firstThursday) / 604800000);
  }
  function fmtShort(isoDate) {
    const dt = parseISO(isoDate);
    return dt ? `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}` : "—";
  }
  function fmtLong(isoDate) {
    const dt = parseISO(isoDate);
    return dt ? `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}` : "—";
  }
  function weekdayShort(isoDate) {
    const dt = parseISO(isoDate);
    return dt ? WD_SHORT[dt.getDay()] : "—";
  }
  function longDateVN(isoDate) {
    const dt = parseISO(isoDate);
    return dt ? `${WD_LONG[dt.getDay()]}, ${fmtShort(isoDate)}` : "—";
  }
  function monthLabel(y, m) {
    return `${MONTHS[m]}, ${y}`;
  }
  function timeAgo(ts) {
    const dt = ts ? new Date(ts) : null;
    if (!dt || Number.isNaN(dt.getTime())) return "";
    const secs = Math.max(0, (Date.now() - dt.getTime()) / 1000);
    if (secs < 60) return "vừa xong";
    if (secs < 3600) return `${Math.floor(secs / 60)} phút trước`;
    if (secs < 86400) return `${Math.floor(secs / 3600)} giờ trước`;
    if (secs < 172800) return "hôm qua";
    if (secs < 604800) return `${Math.floor(secs / 86400)} ngày trước`;
    return fmtShort(dateISO(new Date(dt)));
  }
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }
  function norm(value) {
    return String(value == null ? "" : value)
      .toLowerCase()
      .replace(/đ/g, "d")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }
  function safeUrl(value) {
    if (typeof value !== "string") return "";
    const trimmed = value.trim();
    try {
      const url = new URL(trimmed);
      return url.protocol === "http:" || url.protocol === "https:" ? trimmed : "";
    } catch (err) {
      return "";
    }
  }
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  let seq = 0;
  function uid(prefix) {
    seq += 1;
    return `${prefix || "x"}${Date.now().toString(36)}${seq.toString(36)}`;
  }
  function safeId(value, prefix) {
    const id = typeof value === "string" ? value.trim() : "";
    return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : uid(prefix || "t");
  }
  function icon(name, cls) {
    return `<svg class="ico${cls ? " " + cls : ""}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  }

  /* ---------- chuẩn hoá dữ liệu ---------- */
  const memberIds = new Set(S.members.map((m) => m.id));
  const wsIds = new Set(S.workstreams.map((w) => w.id));
  const labelSet = new Set(S.labels);

  function cleanText(value, max) {
    return String(value == null ? "" : value).trim().slice(0, max || 4000);
  }
  function cleanStamp(value) {
    const dt = value ? new Date(value) : null;
    return dt && !Number.isNaN(dt.getTime()) ? dt.toISOString() : null;
  }

  function normalizeTask(raw, usedIds) {
    if (!raw || typeof raw !== "object") return null;
    const title = cleanText(raw.title, 200);
    if (!title) return null;
    let id = safeId(raw.id, "t");
    while (usedIds.has(id)) id = uid("t");
    usedIds.add(id);
    const status = STATUS[raw.status] ? raw.status : "todo";
    const priority = PRIORITY[raw.priority] ? raw.priority : "med";
    const due = parseISO(raw.due) ? raw.due : null;
    let completedAt = parseISO(raw.completedAt) ? raw.completedAt : null;
    if (status === "done" && !completedAt) completedAt = todayISO();
    if (status !== "done") completedAt = null;
    const labels = Array.isArray(raw.labels) ? [...new Set(raw.labels.filter((l) => labelSet.has(l)))] : [];
    const subtasks = Array.isArray(raw.subtasks)
      ? raw.subtasks.slice(0, 100).map((st) => ({
          id: safeId(st && st.id, "s"),
          title: cleanText(st && st.title, 240),
          done: !!(st && st.done),
        })).filter((st) => st.title)
      : [];
    const links = Array.isArray(raw.links)
      ? raw.links.slice(0, 50).map((lk) => ({
          id: safeId(lk && lk.id, "l"),
          label: cleanText(lk && lk.label, 120),
          url: safeUrl(lk && lk.url),
        })).filter((lk) => lk.url)
      : [];
    const comments = Array.isArray(raw.comments)
      ? raw.comments.slice(0, 300).map((cm) => ({
          id: safeId(cm && cm.id, "c"),
          author: memberIds.has(cm && cm.author) ? cm.author : S.me,
          text: cleanText(cm && cm.text, 3000),
          at: cleanStamp(cm && cm.at) || new Date().toISOString(),
        })).filter((cm) => cm.text)
      : [];
    const estimate = Number(raw.estimate);
    return {
      id,
      title,
      desc: cleanText(raw.desc, 4000),
      status,
      priority,
      assignee: memberIds.has(raw.assignee) ? raw.assignee : null,
      workstream: wsIds.has(raw.workstream) ? raw.workstream : "w1",
      due,
      estimate: Number.isFinite(estimate) ? clamp(estimate, 0, 1000) : null,
      labels,
      subtasks,
      links,
      comments,
      createdAt: parseISO(raw.createdAt) ? raw.createdAt : todayISO(),
      completedAt,
      prevStatus: STATUS[raw.prevStatus] && raw.prevStatus !== "done" ? raw.prevStatus : null,
    };
  }

  function normalizeState(raw) {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.tasks)) return null;
    const used = new Set();
    const tasks = [];
    raw.tasks.slice(0, 3000).forEach((item) => {
      const task = normalizeTask(item, used);
      if (task) tasks.push(task);
    });
    const taskIds = new Set(tasks.map((t) => t.id));
    const settings = raw.settings && typeof raw.settings === "object" ? raw.settings : {};
    const activity = Array.isArray(raw.activity)
      ? raw.activity.slice(0, 300).map((item) => {
          if (!item || typeof item !== "object") return null;
          const type = ["done", "move", "add", "note"].includes(item.type) ? item.type : "note";
          return {
            id: safeId(item.id, "a"),
            type,
            taskId: taskIds.has(item.taskId) ? item.taskId : null,
            memberId: memberIds.has(item.memberId) ? item.memberId : null,
            text: cleanText(item.text, 500),
            at: cleanStamp(item.at) || new Date().toISOString(),
          };
        }).filter((item) => item && item.text)
      : [];
    const focus = Array.isArray(raw.focus)
      ? raw.focus.slice(0, 1000).map((item) => {
          if (!item || typeof item !== "object") return null;
          const minutes = Number(item.minutes);
          if (!Number.isFinite(minutes) || minutes <= 0) return null;
          return {
            id: safeId(item.id, "f"),
            taskId: taskIds.has(item.taskId) ? item.taskId : null,
            minutes: clamp(Math.round(minutes), 1, 600),
            at: cleanStamp(item.at) || new Date().toISOString(),
          };
        }).filter(Boolean)
      : [];
    return {
      version: 1,
      settings: {
        theme: settings.theme === "dark" ? "dark" : "light",
        projectName: cleanText(settings.projectName, 80) || "App Quản trị v1.0",
        startDate: parseISO(settings.startDate) ? settings.startDate : todayISO(),
        createdAt: cleanStamp(settings.createdAt) || new Date().toISOString(),
      },
      tasks,
      activity,
      focus,
    };
  }

  function persist(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state || App.DATA));
    } catch (err) {
      /* bộ nhớ bị chặn hoặc đầy — ứng dụng vẫn chạy trong phiên này */
    }
  }
  function loadState() {
    let state = null;
    try {
      state = normalizeState(JSON.parse(localStorage.getItem(KEY)));
    } catch (err) {
      state = null;
    }
    if (!state) {
      state = normalizeState(S.create());
      persist(state);
    }
    return state;
  }

  App.DATA = loadState();

  /* ---------- public: tiện ích ---------- */
  App.STATUS = STATUS;
  App.PRIORITY = PRIORITY;
  App.STATUS_ORDER = STATUS_ORDER;
  App.VIEWS = VIEWS;
  App.VIEW_LABEL = VIEW_LABEL;
  App.todayISO = todayISO;
  App.addDays = addDays;
  App.diffDays = diffDays;
  App.daysFromToday = daysFromToday;
  App.startOfWeek = startOfWeek;
  App.endOfWeek = endOfWeek;
  App.weekNumber = weekNumber;
  App.fmtShort = fmtShort;
  App.fmtLong = fmtLong;
  App.weekdayShort = weekdayShort;
  App.longDateVN = longDateVN;
  App.monthLabel = monthLabel;
  App.timeAgo = timeAgo;
  App.esc = esc;
  App.norm = norm;
  App.safeUrl = safeUrl;
  App.uid = uid;
  App.clamp = clamp;
  App.icon = icon;
  App.parseISO = parseISO;
  App.dateISO = dateISO;
  App.MONTHS = MONTHS;

  App.save = function () {
    persist(App.DATA);
  };

  /* ---------- tra cứu ---------- */
  App.members = function () {
    return S.members;
  };
  App.workstreams = function () {
    return S.workstreams;
  };
  App.labels = function () {
    return S.labels;
  };
  App.memberById = function (id) {
    return S.members.find((m) => m.id === id) || null;
  };
  App.wsById = function (id) {
    return S.workstreams.find((w) => w.id === id) || null;
  };
  App.me = function () {
    return App.memberById(S.me);
  };
  App.taskById = function (id) {
    return App.DATA.tasks.find((t) => t.id === id) || null;
  };
  App.isOverdue = function (task) {
    return !!(task && task.due && task.status !== "done" && task.due < todayISO());
  };
  App.taskScore = function (task) {
    if (!task || task.status === "done") return -1;
    let score = 0;
    const gap = task.due ? daysFromToday(task.due) : 999;
    if (gap < 0) score += 60 + Math.min(36, -gap * 3);
    else if (gap === 0) score += 45;
    else if (gap <= 2) score += 30 - gap * 4;
    else if (gap <= 7) score += 12 - gap;
    if (task.priority === "high") score += 24;
    else if (task.priority === "med") score += 11;
    if (task.status === "doing") score += 14;
    else if (task.status === "review") score += 9;
    if (task.assignee === S.me) score += 6;
    if (!task.assignee) score += 3;
    if ((task.labels || []).includes("Ưu tiên tổ")) score += 9;
    return score;
  };
  App.sortTasks = function (tasks, mode) {
    const list = (tasks || []).slice();
    if (mode === "due") {
      return list.sort((a, b) => {
        if (!a.due && !b.due) return App.taskScore(b) - App.taskScore(a);
        if (!a.due) return 1;
        if (!b.due) return -1;
        return a.due.localeCompare(b.due);
      });
    }
    if (mode === "new") {
      return list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    }
    if (mode === "priority") {
      const rank = { high: 0, med: 1, low: 2 };
      return list.sort((a, b) => (rank[a.priority] - rank[b.priority]) || (App.taskScore(b) - App.taskScore(a)));
    }
    if (mode === "title") {
      return list.sort((a, b) => a.title.localeCompare(b.title, "vi"));
    }
    return list.sort((a, b) => {
      const scoreDiff = App.taskScore(b) - App.taskScore(a);
      if (scoreDiff) return scoreDiff;
      return String(a.due || "9999").localeCompare(String(b.due || "9999"));
    });
  };
  App.openTasks = function (tasks) {
    return (tasks || App.DATA.tasks).filter((t) => t.status !== "done");
  };
  App.smartTasks = function (limit) {
    const sorted = App.sortTasks(App.openTasks(), "smart");
    return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
  };
  App.reasonFor = function (task) {
    if (!task || task.status === "done") return "Đã xong";
    if (App.isOverdue(task)) {
      const gap = -daysFromToday(task.due);
      return `Quá hạn ${gap} ngày`;
    }
    if (task.due === todayISO()) return "Đến hạn hôm nay";
    if (task.priority === "high") return "Ưu tiên cao";
    if (task.status === "doing") return "Đang giữ nhịp";
    if (!task.due) return "Chưa hẹn ngày";
    const gap = daysFromToday(task.due);
    if (gap > 0 && gap <= 3) return `Còn ${gap} ngày`;
    const ws = App.wsById(task.workstream);
    return ws ? `Mảng ${ws.name}` : "Cần giữ nhịp";
  };
  App.dueMeta = function (task) {
    if (!task || !task.due) return { cls: "none", text: "Chưa hẹn" };
    if (task.status === "done") return { cls: "done", text: `Xong ${fmtShort(task.due)}` };
    const gap = daysFromToday(task.due);
    if (gap < 0) return { cls: "late", text: gap === -1 ? "Trễ 1 ngày" : `Trễ ${-gap} ngày` };
    if (gap === 0) return { cls: "today", text: "Hôm nay" };
    if (gap === 1) return { cls: "soon", text: "Ngày mai" };
    if (gap <= 6) return { cls: "soon", text: `${gap} ngày nữa` };
    return { cls: "plain", text: fmtShort(task.due) };
  };

  /* ---------- chỉ số ---------- */
  App.metrics = function () {
    const tasks = App.DATA.tasks;
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "done").length;
    const open = total - done;
    const doing = tasks.filter((t) => t.status === "doing").length;
    const review = tasks.filter((t) => t.status === "review").length;
    const overdue = tasks.filter((t) => App.isOverdue(t));
    const dueToday = tasks.filter((t) => t.status !== "done" && t.due === todayISO());
    const thisWeekStart = startOfWeek(todayISO());
    const thisWeekEnd = endOfWeek(todayISO());
    const doneThisWeek = tasks.filter((t) => t.status === "done" && t.completedAt && t.completedAt >= thisWeekStart && t.completedAt <= thisWeekEnd).length;
    const lastWeekStart = addDays(thisWeekStart, -7);
    const lastWeekEnd = addDays(thisWeekStart, -1);
    const doneLastWeek = tasks.filter((t) => t.status === "done" && t.completedAt && t.completedAt >= lastWeekStart && t.completedAt <= lastWeekEnd).length;
    return {
      total,
      done,
      open,
      doing,
      review,
      overdue: overdue.length,
      overdueTasks: overdue,
      dueToday: dueToday.length,
      dueTodayTasks: dueToday,
      focusedToday: App.focusMinutesOn(todayISO()),
      focusedWeek: App.focusWeek(),
      doneThisWeek,
      doneLastWeek,
      rate: total ? Math.round((done / total) * 100) : 0,
      unassigned: tasks.filter((t) => t.status !== "done" && !t.assignee).length,
    };
  };
  App.focusMinutesOn = function (isoDate) {
    return App.DATA.focus.reduce((sum, f) => {
      if (!f.at) return sum;
      return dateISO(new Date(f.at)) === isoDate ? sum + Number(f.minutes || 0) : sum;
    }, 0);
  };
  App.focusWeek = function () {
    const start = startOfWeek(todayISO());
    return App.DATA.focus.reduce((sum, f) => {
      if (!f.at) return sum;
      const day = dateISO(new Date(f.at));
      return day >= start && day <= todayISO() ? sum + Number(f.minutes || 0) : sum;
    }, 0);
  };
  App.focusStreak = function () {
    const days = new Set(App.DATA.focus.map((f) => (f.at ? dateISO(new Date(f.at)) : "")));
    let cursor = todayISO();
    if (!days.has(cursor)) cursor = addDays(cursor, -1);
    let streak = 0;
    while (days.has(cursor)) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }
    return streak;
  };
  App.weeklyVelocity = function (weeks) {
    const count = weeks || 8;
    const currentStart = startOfWeek(todayISO());
    const out = [];
    for (let i = count - 1; i >= 0; i -= 1) {
      const start = addDays(currentStart, -7 * i);
      const end = addDays(start, 6);
      const value = App.DATA.tasks.filter((t) => t.status === "done" && t.completedAt && t.completedAt >= start && t.completedAt <= end).length;
      out.push({ start, end, label: fmtShort(start), value, now: i === 0, week: weekNumber(start) });
    }
    return out;
  };
  App.memberStats = function (memberId) {
    const member = App.memberById(memberId);
    if (!member) return null;
    const tasks = App.DATA.tasks.filter((t) => t.assignee === memberId);
    const active = tasks.filter((t) => t.status !== "done");
    const doing = tasks.filter((t) => t.status === "doing").length;
    const review = tasks.filter((t) => t.status === "review").length;
    const overdue = active.filter((t) => App.isOverdue(t)).length;
    const done = tasks.filter((t) => t.status === "done").length;
    const weekStart = startOfWeek(todayISO());
    const doneWeek = tasks.filter((t) => t.status === "done" && t.completedAt && t.completedAt >= weekStart).length;
    const next = App.sortTasks(active, "due")[0] || null;
    const load = member.capacity ? Math.round((active.length / member.capacity) * 100) : 0;
    return {
      member,
      tasks,
      active,
      activeCount: active.length,
      doing,
      review,
      overdue,
      done,
      doneWeek,
      next,
      load,
      state: load > 100 ? "hot" : load >= 80 ? "warn" : "ok",
    };
  };
  App.wsStats = function (wsId) {
    const ws = App.wsById(wsId);
    if (!ws) return null;
    const tasks = App.DATA.tasks.filter((t) => t.workstream === wsId);
    const done = tasks.filter((t) => t.status === "done").length;
    return {
      ws,
      total: tasks.length,
      done,
      open: tasks.length - done,
      overdue: tasks.filter((t) => App.isOverdue(t)).length,
      pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    };
  };
  App.milestones = function () {
    const start = App.DATA.settings.startDate || todayISO();
    const open = App.openTasks();
    return S.milestones(start).map((m) => ({
      ...m,
      daysLeft: daysFromToday(m.date),
      past: m.date < todayISO(),
      openBefore: open.filter((t) => t.due && t.due <= m.date).length,
    }));
  };
  App.nextMilestone = function () {
    const list = App.milestones();
    return list.find((m) => m.date >= todayISO()) || null;
  };
  App.finalMilestone = function () {
    const list = App.milestones();
    return list[list.length - 1] || null;
  };
  App.quoteOfDay = function () {
    const day = Math.floor(Date.now() / 86400000);
    return S.quotes[day % S.quotes.length];
  };
  App.log = function (type, taskId, memberId, text) {
    App.DATA.activity.unshift({
      id: uid("a"),
      type,
      taskId: taskId || null,
      memberId: memberId || null,
      text: cleanText(text, 500),
      at: new Date().toISOString(),
    });
    App.DATA.activity = App.DATA.activity.slice(0, 300);
  };

  /* ---------- mảnh UI dùng chung ---------- */
  App.avatar = function (memberOrId, size) {
    const member = typeof memberOrId === "string" ? App.memberById(memberOrId) : memberOrId;
    const cls = size || "avatar-sm";
    if (!member) return `<span class="avatar ${cls}" style="--who:var(--line-strong)" aria-hidden="true">?</span>`;
    return `<span class="avatar ${cls}" style="--who:${esc(member.color)}" title="${esc(member.name)}" aria-hidden="true">${esc(member.short)}</span>`;
  };
  App.assignee = function (memberId, size) {
    const member = App.memberById(memberId);
    if (!member) {
      return `<span class="assignee assignee-none">${App.avatar(null, size || "avatar-sm")}<span>Chưa giao</span></span>`;
    }
    return `<span class="assignee">${App.avatar(member, size || "avatar-sm")}<span>${esc(member.name)}</span></span>`;
  };
  App.wsChip = function (wsId) {
    const ws = App.wsById(wsId);
    if (!ws) return "";
    return `<span class="chip chip-ws" style="--ws:${esc(ws.color)}"><span class="dot"></span>${esc(ws.name)}</span>`;
  };
  App.dueChip = function (task) {
    const meta = App.dueMeta(task);
    const title = task && task.due ? `Hạn ${fmtLong(task.due)}` : "Chưa đặt hạn";
    return `<span class="due ${meta.cls}" title="${esc(title)}">${icon("clock")}${esc(meta.text)}</span>`;
  };
  App.priorityTag = function (priority) {
    const meta = PRIORITY[priority] || PRIORITY.med;
    return `<span class="prio-pill ${esc(priority)}">${icon("flag")}${esc(meta.label)}</span>`;
  };
  App.pf = function (priority) {
    const meta = PRIORITY[priority] || PRIORITY.med;
    return `<span class="pf ${esc(priority)}">${icon("flag")}${esc(meta.label)}</span>`;
  };
  App.tick = function (task) {
    const complete = task.status === "done";
    return `<button class="tick${complete ? " on" : ""}" type="button" data-tick-task="${esc(task.id)}" aria-pressed="${complete}" aria-label="${complete ? "Mở lại" : "Hoàn thành"}: ${esc(task.title)}">${icon("check")}</button>`;
  };
  App.subcount = function (task) {
    if (!task.subtasks || !task.subtasks.length) return "";
    const done = task.subtasks.filter((s) => s.done).length;
    return `<span class="subcount" title="${done}/${task.subtasks.length} việc nhỏ đã xong">${icon("check-circle")}${done}/${task.subtasks.length}</span>`;
  };
  App.commentCount = function (task) {
    if (!task.comments || !task.comments.length) return "";
    return `<span class="subcount" title="${task.comments.length} bình luận">${icon("message")}${task.comments.length}</span>`;
  };
  App.empty = function (iconName, title, text, action) {
    return `<div class="empty">
      <span class="e-ico">${icon(iconName || "spark")}</span>
      <strong>${esc(title || "Chưa có gì ở đây")}</strong>
      <p>${esc(text || "")}</p>
      ${action || ""}
    </div>`;
  };

  /* ---------- chủ đề ---------- */
  function syncThemeIcon() {
    const dark = document.documentElement.dataset.theme === "dark";
    const use = $("#themeIcon use");
    if (use) use.setAttribute("href", dark ? "#i-sun" : "#i-moon");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#131210" : "#f4eee3");
    const btn = $("#themeBtn");
    if (btn) btn.setAttribute("aria-pressed", String(dark));
  }
  App.applyTheme = function (theme, shouldPersist) {
    const next = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    App.DATA.settings.theme = next;
    if (shouldPersist !== false) persist();
    syncThemeIcon();
  };
  App.toggleTheme = function () {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    App.applyTheme(next);
    App.toast(next === "dark" ? "Đã bật giao diện tối." : "Đã trở lại giao diện sáng.", "info");
  };

  /* ---------- sidebar ---------- */
  App.toggleSidebar = function (force) {
    const open = typeof force === "boolean" ? force : !document.body.classList.contains("sidebar-open");
    document.body.classList.toggle("sidebar-open", open);
  };

  /* ---------- toast & confetti ---------- */
  App.toast = function (message, kind) {
    const root = document.getElementById("toastRoot");
    if (!root) return;
    while (root.children.length >= 3) root.firstElementChild.remove();
    const el = document.createElement("div");
    el.className = "toast";
    const iconName = kind === "error" ? "alert" : kind === "success" ? "check-circle" : "spark";
    el.innerHTML = `${icon(iconName)}<span>${esc(message)}</span>`;
    root.appendChild(el);
    window.setTimeout(() => {
      el.classList.add("out");
      window.setTimeout(() => el.remove(), 280);
    }, 2700);
  };
  App.confetti = function () {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.getElementById("confettiRoot");
    if (!root) return;
    const colors = ["#e14e27", "#dfec6a", "#1b1915", "#6c4ac8", "#197565", "#f2b84b"];
    for (let i = 0; i < 28; i += 1) {
      const piece = document.createElement("i");
      piece.className = "confetti-piece";
      piece.style.left = `${5 + Math.random() * 90}%`;
      piece.style.background = colors[i % colors.length];
      piece.style.width = `${5 + Math.random() * 5}px`;
      piece.style.height = `${8 + Math.random() * 7}px`;
      piece.style.setProperty("--dx", `${Math.round((Math.random() - 0.5) * 180)}px`);
      piece.style.setProperty("--rot", `${Math.round(360 + Math.random() * 540)}deg`);
      piece.style.animationDelay = `${Math.random() * 0.22}s`;
      root.appendChild(piece);
      window.setTimeout(() => piece.remove(), 2100);
    }
  };

  /* ---------- overlay stack ---------- */
  App._overlays = [];
  App.openOverlay = function (html, opts) {
    const options = opts || {};
    const root = document.getElementById("overlayRoot");
    if (!root) return null;
    const wrap = document.createElement("div");
    wrap.className = `overlay${options.className ? " " + options.className : ""}`;
    wrap.innerHTML = html;
    const entry = { el: wrap, prev: document.activeElement, opts: options };
    root.appendChild(wrap);
    App._overlays.push(entry);
    document.body.classList.add("no-scroll");
    wrap.addEventListener("click", (event) => {
      if (event.target === wrap && options.dismissible !== false) App.closeOverlay(wrap);
    });
    if (typeof options.onMount === "function") options.onMount(wrap);
    window.requestAnimationFrame(() => {
      let target = null;
      if (options.focus) target = wrap.querySelector(options.focus);
      if (!target) target = wrap.querySelector("[autofocus]");
      if (!target) target = wrap.querySelector(".modal input:not([type=hidden]):not([type=file]), .palette input");
      if (!target) target = wrap.querySelector(".modal");
      if (target) {
        try {
          target.focus({ preventScroll: true });
        } catch (err) {
          target.focus();
        }
      }
    });
    return wrap;
  };
  App.closeOverlay = function (target) {
    const wrap = typeof target === "string" ? document.getElementById(target) : target;
    const index = App._overlays.findIndex((o) => o.el === wrap);
    if (index < 0) return;
    const entry = App._overlays[index];
    App._overlays.splice(index, 1);
    entry.el.remove();
    if (typeof entry.opts.onClose === "function") {
      try {
        entry.opts.onClose();
      } catch (err) {
        /* bỏ qua lỗi trong callback đóng */
      }
    }
    if (!App._overlays.length) document.body.classList.remove("no-scroll");
    if (entry.prev && entry.prev.isConnected) {
      try {
        entry.prev.focus({ preventScroll: true });
      } catch (err) {
        /* noop */
      }
    }
  };
  App.closeTopOverlay = function () {
    const top = App._overlays[App._overlays.length - 1];
    if (top) {
      App.closeOverlay(top.el);
      return true;
    }
    return false;
  };
  App.closeAllOverlays = function () {
    while (App._overlays.length) {
      const entry = App._overlays.pop();
      entry.el.remove();
      if (typeof entry.opts.onClose === "function") {
        try {
          entry.opts.onClose();
        } catch (err) {
          /* noop */
        }
      }
    }
    document.body.classList.remove("no-scroll");
  };
  App.confirm = function (options, onConfirm) {
    const config = options || {};
    const title = cleanText(config.title || "Xác nhận", 120);
    const message = config.message || "Bạn chắc chắn muốn tiếp tục?";
    const label = cleanText(config.confirmLabel || "Xác nhận", 40);
    const cancel = cleanText(config.cancelLabel || "Huỷ", 30);
    const html = `<div class="modal modal-narrow" role="dialog" aria-modal="true" aria-labelledby="confirmTitle">
      <div class="modal-head">
        <div>
          <div class="modal-eyebrow">${icon("alert")} Thao tác cần xác nhận</div>
          <div class="modal-title" id="confirmTitle">${esc(title)}</div>
        </div>
        <button class="icon-btn modal-close" type="button" data-confirm-cancel aria-label="Đóng">${icon("x")}</button>
      </div>
      <div class="modal-body">
        <p class="confirm-msg">${message}</p>
        ${config.note ? `<div class="settings-note">${icon("spark")}<span>${esc(config.note)}</span></div>` : ""}
        <div class="confirm-actions">
          <button class="btn btn-ghost" type="button" data-confirm-cancel>${esc(cancel)}</button>
          <button class="btn ${config.danger === false ? "btn-accent" : "btn-danger"}" type="button" data-confirm-ok>${esc(label)}</button>
        </div>
      </div>
    </div>`;
    const overlay = App.openOverlay(html, { focus: "[data-confirm-cancel]", className: "confirm-wrap" });
    if (!overlay) return;
    overlay.querySelectorAll("[data-confirm-cancel]").forEach((btn) => {
      btn.addEventListener("click", () => App.closeOverlay(overlay));
    });
    const ok = overlay.querySelector("[data-confirm-ok]");
    if (ok) {
      ok.addEventListener("click", () => {
        App.closeOverlay(overlay);
        if (typeof onConfirm === "function") onConfirm();
      });
    }
  };

  /* ---------- bộ lọc ---------- */
  App.boardFilters = { q: "", assignee: "all", workstream: "all", priority: "all" };
  App.listFilters = { q: "", status: "all", assignee: "all", workstream: "all", priority: "all", sort: "smart" };
  App.filterTasks = function (tasks, filters) {
    const f = filters || {};
    const q = norm(f.q || "").trim();
    return (tasks || []).filter((task) => {
      if (f.status && f.status !== "all" && task.status !== f.status) return false;
      if (f.assignee && f.assignee !== "all") {
        if (f.assignee === "none" ? task.assignee : task.assignee !== f.assignee) return false;
      }
      if (f.workstream && f.workstream !== "all" && task.workstream !== f.workstream) return false;
      if (f.priority && f.priority !== "all" && task.priority !== f.priority) return false;
      if (!q) return true;
      const member = App.memberById(task.assignee);
      const ws = App.wsById(task.workstream);
      const haystack = norm([
        task.title,
        task.desc,
        (task.labels || []).join(" "),
        member ? member.name : "",
        ws ? ws.name : "",
        (task.subtasks || []).map((s) => s.title).join(" "),
        STATUS[task.status] ? STATUS[task.status].label : "",
      ].join(" "));
      return haystack.includes(q);
    });
  };
  App.activeFilters = function (scope) {
    const f = scope === "list" ? App.listFilters : App.boardFilters;
    return Object.keys(f).filter((k) => k !== "sort" && f[k] && f[k] !== "all").length;
  };
  App.clearFilters = function (scope) {
    if (scope === "list") {
      App.listFilters = { q: "", status: "all", assignee: "all", workstream: "all", priority: "all", sort: App.listFilters.sort || "smart" };
    } else {
      App.boardFilters = { q: "", assignee: "all", workstream: "all", priority: "all" };
    }
    App.render();
  };
  App.drill = function (kind, id) {
    if (kind === "member") {
      App.listFilters.status = "all";
      App.listFilters.assignee = id;
      App.go("list");
      return;
    }
    if (kind === "workstream") {
      App.listFilters.status = "all";
      App.listFilters.workstream = id;
      App.go("list");
    }
  };

  /* ---------- shell ---------- */
  App.updateShell = function () {
    if (!App.DATA) return;
    const metrics = App.metrics();
    const projectName = App.DATA.settings.projectName;
    const projectLabel = document.querySelector(".sp-name");
    if (projectLabel) projectLabel.textContent = projectName;
    const progress = metrics.rate;
    const bar = document.getElementById("sideProg");
    if (bar) bar.style.width = `${progress}%`;
    const progressText = document.getElementById("sideProgText");
    if (progressText) progressText.textContent = `${metrics.done}/${metrics.total} việc · ${progress}%`;
    const finalMs = App.finalMilestone();
    const days = document.getElementById("sideDays");
    if (days) {
      if (!finalMs) days.textContent = "—";
      else if (finalMs.daysLeft > 0) days.textContent = `còn ${finalMs.daysLeft} ngày`;
      else if (finalMs.daysLeft === 0) days.textContent = "về đích hôm nay";
      else days.textContent = `quá ${-finalMs.daysLeft} ngày`;
    }
    document.querySelectorAll(".nav-item[data-view]").forEach((btn) => {
      const active = btn.dataset.view === App.view;
      btn.classList.toggle("active", active);
      if (active) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
    const badge = document.getElementById("navTodayBadge");
    if (badge) {
      const urgent = new Set(metrics.overdueTasks.map((t) => t.id).concat(metrics.dueTodayTasks.map((t) => t.id))).size;
      badge.textContent = String(urgent);
      badge.hidden = urgent === 0;
      badge.title = `${urgent} việc cần chú ý hôm nay`;
    }
    const next = App.nextMilestone();
    const msTitle = document.getElementById("sideMsTitle");
    const msMeta = document.getElementById("sideMsMeta");
    if (msTitle) msTitle.textContent = next ? next.title : "Đã chạm mọi mốc";
    if (msMeta) {
      if (next) msMeta.textContent = `${next.daysLeft === 0 ? "Hôm nay" : "Còn " + next.daysLeft + " ngày"} · ${fmtShort(next.date)}`;
      else msMeta.textContent = "Tổ đã đi hết các mốc đã đặt";
    }
    const stack = document.getElementById("sideTeamStack");
    if (stack) {
      const members = S.members;
      const shown = members.slice(0, 5).map((m) => App.avatar(m, "avatar-sm")).join("");
      const more = members.length > 5 ? `<span class="more">+${members.length - 5}</span>` : "";
      stack.innerHTML = shown + more;
    }
    const teamText = document.getElementById("sideTeamText");
    if (teamText) teamText.textContent = `${S.members.length} người · ${metrics.doing} đang làm`;
    const crumb = document.getElementById("crumbNow");
    if (crumb) crumb.textContent = VIEW_LABEL[App.view] || "Tổng quan";
    const avatar = document.getElementById("meAvatar");
    const me = App.me();
    if (avatar && me) {
      avatar.textContent = me.short;
      avatar.style.setProperty("--who", me.color);
      avatar.title = `${me.name} · ${me.role}`;
    }
    syncThemeIcon();
    document.title = `${VIEW_LABEL[App.view] || "Tổng quan"} · GUỒNG — ${projectName}`;
  };

  /* ---------- render & routing ---------- */
  function parseHash() {
    const raw = (location.hash || "").replace(/^#\/?/, "").trim();
    return VIEWS.includes(raw) ? raw : null;
  }
  App.changed = function (options) {
    persist();
    App.updateShell();
    App.render(options);
  };
  App.refresh = function () {
    App.save();
    App.updateShell();
    App.render({ animate: false });
  };
  App.render = function (options) {
    const config = options || {};
    const viewEl = document.getElementById("view");
    if (!viewEl) return;
    const renderer = App["render" + App.view.charAt(0).toUpperCase() + App.view.slice(1)];
    viewEl.innerHTML = typeof renderer === "function" ? renderer() : App.empty("spark", "Đang dựng màn hình", "Phần này sẽ có ngay sau khi hoàn tất.");
    if (config.animate) {
      viewEl.classList.remove("anim");
      void viewEl.offsetWidth;
      viewEl.classList.add("anim");
    }
  };
  App.go = function (view, opts) {
    if (!VIEWS.includes(view)) view = "dashboard";
    const options = opts || {};
    App.toggleSidebar(false);
    App.closeAllOverlays();
    if (options.filter && options.filter.scope) {
      const target = options.filter.scope === "list" ? App.listFilters : App.boardFilters;
      Object.assign(target, options.filter.values || {});
    }
    if ((location.hash || "").replace(/^#\/?/, "") === view) {
      App.view = view;
      App.updateShell();
      App.render({ animate: true });
      if (!options.keepScroll) window.scrollTo({ top: 0, behavior: "instant" });
    } else {
      location.hash = `#/${view}`;
    }
  };
  App.route = function () {
    const target = parseHash() || "dashboard";
    App.view = target;
    if (!location.hash) {
      try {
        history.replaceState(null, "", `#/${target}`);
      } catch (err) {
        /* noop */
      }
    }
    App.updateShell();
    App.render({ animate: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  App.view = "dashboard";
  App.focus = { duration: 1500, remaining: 1500, running: false, taskId: null, interval: null, lastTick: 0 };

  window.addEventListener("hashchange", () => {
    App.closeAllOverlays();
    App.route();
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== KEY || !event.newValue) return;
    try {
      const incoming = normalizeState(JSON.parse(event.newValue));
      if (!incoming) return;
      App.DATA = incoming;
      App.applyTheme(incoming.settings.theme, false);
      App.view = parseHash() || App.view;
      App.updateShell();
      App.render({ animate: false });
      App.toast("Dữ liệu vừa được cập nhật từ một tab khác.", "info");
    } catch (err) {
      /* bỏ qua dữ liệu hỏng từ tab khác */
    }
  });

  App.loadState = loadState;
  App.normalizeState = normalizeState;
  App.KEY = KEY;
})();
