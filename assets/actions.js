/* ============================================================
   GUỒNG — actions: CRUD, kéo thả, tìm nhanh, focus, dữ liệu
   ============================================================ */
(function () {
  "use strict";

  const A = window.App;
  const esc = A.esc;
  const icon = A.icon;
  const $ = (sel, root) => (root || document).querySelector(sel);
  let filterTimer = null;
  let paletteOverlay = null;
  let paletteItems = [];
  let paletteIndex = 0;
  let paletteQuery = "";

  /* ============================================================
     ĐIỀU HƯỚNG NHANH
     ============================================================ */
  function go(view) {
    A.go(view);
  }

  function openNewTask(preset) {
    openTask(null, preset);
  }

  /* ============================================================
     CẬP NHẬT CÔNG VIỆC
     ============================================================ */
  function toggleTaskDone(id) {
    const task = A.taskById(id);
    if (!task) return;
    const me = window.SEED.me;
    if (task.status === "done") {
      task.status = task.prevStatus || "todo";
      task.prevStatus = null;
      task.completedAt = null;
      A.log("move", task.id, me, `đã mở lại «${task.title}»`);
      A.toast("Đã mở lại công việc.", "info");
    } else {
      task.prevStatus = task.status;
      task.status = "done";
      task.completedAt = A.todayISO();
      A.log("done", task.id, me, `đã hoàn thành «${task.title}»`);
      A.toast("Một việc nữa được gạch.", "success");
      A.confetti();
    }
    A.refresh();
  }

  function setTaskStatus(id, status) {
    const task = A.taskById(id);
    if (!task || !A.STATUS[status] || task.status === status) return;
    const me = window.SEED.me;
    const old = task.status;
    task.status = status;
    if (status === "done") {
      task.completedAt = A.todayISO();
      task.prevStatus = old;
      A.log("done", task.id, me, `đã hoàn thành «${task.title}»`);
      A.confetti();
    } else {
      if (old === "done") {
        task.completedAt = null;
        task.prevStatus = null;
      }
      A.log("move", task.id, me, `đã chuyển «${task.title}» sang ${A.STATUS[status].label}`);
    }
    A.toast(`Đã chuyển sang «${A.STATUS[status].label}».`, status === "done" ? "success" : "info");
    A.refresh();
  }

  function assignTask(id, memberId) {
    const task = A.taskById(id);
    if (!task) return;
    const member = A.memberById(memberId);
    if (!member) return;
    task.assignee = member.id;
    A.log("note", task.id, window.SEED.me, `đã giao «${task.title}» cho ${member.name}`);
    A.toast(`Đã giao việc cho ${member.name}.`, "success");
    A.refresh();
  }

  /* ============================================================
     BỘ LỌC
     ============================================================ */
  function setFilter(scope, key, value) {
    const target = scope === "list" ? A.listFilters : A.boardFilters;
    if (!target || !(key in target)) return;
    target[key] = value;
  }
  function rerenderFilters(scope) {
    if (filterTimer) {
      window.clearTimeout(filterTimer);
      filterTimer = null;
    }
    A.render({ animate: false });
    const active = document.activeElement;
    if (active && active.matches && active.matches(`[data-filter-scope="${scope}"][data-filter-key="q"]`)) return;
    const input = document.querySelector(`[data-filter-scope="${scope}"][data-filter-key="q"]`);
    if (input && input.value) {
      input.focus({ preventScroll: true });
      try {
        input.setSelectionRange(input.value.length, input.value.length);
      } catch (err) {
        /* noop */
      }
    }
  }

  /* ============================================================
     LỊCH
     ============================================================ */
  function ensureCalMonth() {
    const now = new Date();
    if (!A.calMonth) A.calMonth = { y: now.getFullYear(), m: now.getMonth() };
    if (!A.parseISO(A.calSelected)) A.calSelected = A.todayISO();
  }
  function shiftCalendar(delta) {
    ensureCalMonth();
    const next = new Date(A.calMonth.y, A.calMonth.m + Number(delta), 1);
    A.calMonth = { y: next.getFullYear(), m: next.getMonth() };
    const selected = A.parseISO(A.calSelected);
    if (!selected || selected.getMonth() !== A.calMonth.m || selected.getFullYear() !== A.calMonth.y) {
      const now = new Date();
      A.calSelected = now.getFullYear() === A.calMonth.y && now.getMonth() === A.calMonth.m
        ? A.todayISO()
        : A.dateISO(new Date(A.calMonth.y, A.calMonth.m, 1));
    }
    A.render({ animate: false });
  }
  function calendarToday() {
    const now = new Date();
    A.calMonth = { y: now.getFullYear(), m: now.getMonth() };
    A.calSelected = A.todayISO();
    A.render({ animate: false });
  }
  function selectCalendarDay(day) {
    const dt = A.parseISO(day);
    if (!dt) return;
    A.calSelected = day;
    A.calMonth = { y: dt.getFullYear(), m: dt.getMonth() };
    A.render({ animate: false });
  }

  /* ============================================================
     TASK MODAL
     ============================================================ */
  function cloneTask(task) {
    return JSON.parse(JSON.stringify(task));
  }
  function defaultDraft(preset) {
    const p = preset || {};
    const initial = {
      id: null,
      title: "",
      desc: "",
      status: A.STATUS[p.status] ? p.status : "todo",
      priority: A.PRIORITY[p.priority] ? p.priority : "med",
      assignee: A.memberById(p.assignee) ? p.assignee : window.SEED.me,
      workstream: A.wsById(p.workstream) ? p.workstream : "w1",
      due: A.parseISO(p.due) ? p.due : A.todayISO(),
      estimate: null,
      labels: [],
      subtasks: [],
      links: [],
      comments: [],
      createdAt: A.todayISO(),
      completedAt: null,
      prevStatus: null,
    };
    return initial;
  }
  function statusSelect(draft) {
    return A.STATUS_ORDER.map((s) => `<option value="${s}"${draft.status === s ? " selected" : ""}>${esc(A.STATUS[s].label)}</option>`).join("");
  }
  function assigneeSelect(draft) {
    return `<option value=""${!draft.assignee ? " selected" : ""}>Chưa giao</option>`
      + A.members().map((m) => `<option value="${esc(m.id)}"${draft.assignee === m.id ? " selected" : ""}>${esc(m.name)} · ${esc(m.role)}</option>`).join("");
  }
  function wsPicker(draft) {
    return A.workstreams().map((ws) => `<button class="ws-opt${draft.workstream === ws.id ? " on" : ""}" type="button" data-task-action="pick-ws" data-id="${esc(ws.id)}" style="--ws:${esc(ws.color)}"><i></i>${esc(ws.name)}</button>`).join("");
  }
  function labelPicker(draft) {
    return A.labels().map((label) => `<button class="label-opt${draft.labels.includes(label) ? " on" : ""}" type="button" data-task-action="pick-label" data-label="${esc(label)}">${esc(label)}</button>`).join("");
  }
  function taskModalHTML(draft, isNew) {
    const doneSubs = draft.subtasks.filter((s) => s.done).length;
    const subPct = draft.subtasks.length ? Math.round((doneSubs / draft.subtasks.length) * 100) : 0;
    const commentRows = draft.comments.map((comment) => {
      const member = A.memberById(comment.author) || A.me();
      return `<div class="comment-row">
        ${A.avatar(member, "avatar-sm")}
        <div class="comment-main">
          <div class="comment-head"><span class="comment-name">${esc(member.name)}</span><span class="comment-time">${esc(A.timeAgo(comment.at))}</span></div>
          <div class="comment-text">${esc(comment.text)}</div>
        </div>
      </div>`;
    }).join("");
    const linkRows = draft.links.map((link) => `<div class="link-row">
      ${icon("link")}
      <a href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${esc(link.label || link.url)}</a>
      <button type="button" data-task-action="remove-link" data-id="${esc(link.id)}" aria-label="Xoá liên kết">${icon("x")}</button>
    </div>`).join("");
    return `<form class="modal task-form" id="taskForm" role="dialog" aria-modal="true" aria-labelledby="taskModalTitle">
      <div class="modal-head">
        <div>
          <div class="modal-eyebrow">${icon(isNew ? "plus" : "pencil")} ${isNew ? "Công việc mới" : "Chi tiết công việc"}</div>
          <div class="modal-title" id="taskModalTitle">${isNew ? "Giao một việc mới" : "Giữ mọi thứ rõ ràng"}</div>
          <div class="modal-sub">${isNew ? "Đủ rõ để người nhận bắt tay ngay, không phải hỏi lại." : `Mã ${esc(draft.id)} · ${draft.createdAt ? "tạo " + A.fmtShort(draft.createdAt) : "trên bàn điều phối"}`}</div>
        </div>
        <button class="icon-btn modal-close" type="button" data-close-overlay aria-label="Đóng">${icon("x")}</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label class="f-label" for="taskTitle">Việc cần làm</label>
          <input class="input f-title" id="taskTitle" data-field="title" value="${esc(draft.title)}" maxlength="200" placeholder="Ví dụ: Hoàn thiện luồng giao việc trên mobile" autocomplete="off">
        </div>
        <div class="field" style="margin-top:12px">
          <label class="f-label" for="taskDesc">Mô tả ngắn</label>
          <textarea class="textarea" id="taskDesc" data-field="desc" rows="3" placeholder="Bối cảnh, kết quả mong đợi, điều cần lưu ý…">${esc(draft.desc)}</textarea>
        </div>
        <div class="meta-grid">
          <div class="field">
            <label class="f-label" for="taskStatus">Trạng thái</label>
            <select class="select" id="taskStatus" data-field="status">${statusSelect(draft)}</select>
          </div>
          <div class="field">
            <label class="f-label" for="taskAssignee">Người nhận</label>
            <select class="select" id="taskAssignee" data-field="assignee">${assigneeSelect(draft)}</select>
          </div>
          <div class="field">
            <label class="f-label" for="taskDue">Hạn chót</label>
            <input class="input" id="taskDue" data-field="due" type="date" value="${esc(draft.due || "")}">
          </div>
          <div class="field">
            <label class="f-label" for="taskEstimate">Ước lượng (giờ)</label>
            <input class="input" id="taskEstimate" data-field="estimate" type="number" min="0" max="1000" step="0.5" value="${draft.estimate == null ? "" : draft.estimate}" placeholder="—" inputmode="decimal">
          </div>
        </div>

        <div class="form-section">
          <div class="form-sec-title"><span>${icon("layers")} Mảng công việc</span></div>
          <div class="ws-picker">${wsPicker(draft)}</div>
          <div class="label-picker" style="margin-top:9px">${labelPicker(draft)}</div>
        </div>

        <div class="form-section">
          <div class="form-sec-title">
            <span>${icon("list")} Việc nhỏ</span>
            <div class="sub-tools">
              <span class="sub-progress"><i style="width:${subPct}%"></i></span>
              <span class="count">${doneSubs}/${draft.subtasks.length}</span>
            </div>
          </div>
          <div class="sub-list">
            ${draft.subtasks.map((sub) => `<div class="sub-row${sub.done ? " done" : ""}">
              <button class="mini-check" type="button" data-task-action="toggle-subtask" data-id="${esc(sub.id)}" aria-label="${sub.done ? "Mở lại" : "Đánh dấu xong"}: ${esc(sub.title)}">${icon("check")}</button>
              <span class="sub-text">${esc(sub.title)}</span>
              <button class="sub-del" type="button" data-task-action="remove-subtask" data-id="${esc(sub.id)}" aria-label="Xoá việc nhỏ">${icon("x")}</button>
            </div>`).join("") || `<div class="comment-empty">Chưa có việc nhỏ. Chia nhỏ để dễ bắt đầu.</div>`}
          </div>
          <div class="sub-add">
            <input class="input" data-subtask-input placeholder="Thêm việc nhỏ rồi nhấn Enter…" maxlength="240" autocomplete="off">
            <button class="btn btn-quiet" type="button" data-task-action="add-subtask">${icon("plus")} Thêm</button>
          </div>
        </div>

        <div class="form-section">
          <div class="form-sec-title"><span>${icon("link")} Liên kết</span></div>
          ${linkRows ? `<div class="link-list">${linkRows}</div>` : ""}
          <div class="link-add">
            <input class="input" data-link-label placeholder="Nhãn" maxlength="120" autocomplete="off">
            <input class="input" data-link-url placeholder="https://…" maxlength="800" autocomplete="off" inputmode="url">
            <button class="btn btn-quiet" type="button" data-task-action="add-link">${icon("plus")} Thêm</button>
          </div>
          <div class="link-hint">Chỉ nhận liên kết http hoặc https.</div>
        </div>

        ${!isNew ? `<div class="form-section">
          <div class="form-sec-title">
            <span>${icon("message")} Bình luận</span>
            <span class="count">${draft.comments.length}</span>
          </div>
          ${commentRows ? `<div class="comment-list">${commentRows}</div>` : `<div class="comment-empty">Chưa có bình luận. Ghi lại quyết định để cả tổ cùng biết.</div>`}
          <div class="comment-form">
            ${A.avatar(A.me(), "avatar-sm")}
            <textarea class="textarea" data-comment-input rows="1" placeholder="Viết cập nhật cho tổ…" aria-label="Bình luận"></textarea>
            <button class="btn btn-ink" type="button" data-task-action="send-comment">${icon("arrow-right")}<span>Gửi</span></button>
          </div>
        </div>` : ""}

        <div class="task-created">
          <span>${isNew ? "Việc sẽ xuất hiện ngay trên bảng sau khi lưu." : "Mọi thay đổi được lưu trên thiết bị này."}</span>
          <span>${isNew ? "Chưa lưu" : `${esc(A.STATUS[draft.status].label)} · ${A.fmtShort(draft.createdAt)}`}</span>
        </div>
      </div>
      <div class="modal-foot">
        <div>
          ${!isNew ? `<button class="btn btn-danger btn-sm" type="button" data-task-action="delete-task">${icon("trash")} Xoá việc</button>` : `<span class="foot-note">Ctrl/⌘ + Enter để lưu nhanh</span>`}
        </div>
        <div class="foot-right">
          <button class="btn btn-ghost" type="button" data-close-overlay>Huỷ</button>
          <button class="btn btn-accent" type="submit">${icon("check")} ${isNew ? "Giao việc" : "Lưu thay đổi"}</button>
        </div>
      </div>
    </form>`;
  }

  function openTask(id, preset) {
    if (A._overlays.length) A.closeAllOverlays();
    let draft;
    let isNew = false;
    if (id) {
      const task = A.taskById(id);
      if (!task) {
        A.toast("Không tìm thấy công việc này.", "error");
        return;
      }
      draft = cloneTask(task);
    } else {
      draft = defaultDraft(preset);
      isNew = true;
    }
    A._taskDraft = draft;
    A._taskIsNew = isNew;
    const overlay = A.openOverlay(taskModalHTML(draft, isNew), {
      focus: "#taskTitle",
      onClose: () => {
        if (A._taskOverlay === overlay) {
          A._taskOverlay = null;
          A._taskDraft = null;
        }
      },
    });
    A._taskOverlay = overlay;
  }
  A.openTask = openTask;

  function syncDraftField(el) {
    if (!A._taskDraft || !el || !el.dataset || !el.dataset.field) return;
    const field = el.dataset.field;
    if (!["title", "desc", "status", "priority", "assignee", "due", "estimate"].includes(field)) return;
    let value = el.value;
    if (field === "assignee") value = value || null;
    if (field === "due") value = A.parseISO(value) ? value : null;
    if (field === "estimate") {
      const num = Number.parseFloat(value);
      value = Number.isFinite(num) ? A.clamp(num, 0, 1000) : null;
    }
    A._taskDraft[field] = value;
  }
  function syncDraftFromForm() {
    const form = document.getElementById("taskForm");
    if (!form || !A._taskDraft) return;
    form.querySelectorAll("[data-field]").forEach((el) => syncDraftField(el));
  }
  function rerenderTaskForm(focusSelector) {
    if (!A._taskOverlay || !A._taskDraft) return;
    syncDraftFromForm();
    const modal = A._taskOverlay.querySelector(".modal");
    if (!modal) return;
    const body = modal.querySelector(".modal-body");
    const scrollTop = body ? body.scrollTop : 0;
    const tmp = document.createElement("div");
    tmp.innerHTML = taskModalHTML(A._taskDraft, A._taskIsNew);
    const next = tmp.firstElementChild;
    modal.replaceWith(next);
    const nextBody = next.querySelector(".modal-body");
    if (nextBody) nextBody.scrollTop = scrollTop;
    if (focusSelector) {
      window.requestAnimationFrame(() => {
        const target = A._taskOverlay && A._taskOverlay.querySelector(focusSelector);
        if (target) {
          try {
            target.focus({ preventScroll: true });
          } catch (err) {
            target.focus();
          }
        }
      });
    }
  }

  function addSubtask() {
    if (!A._taskDraft) return;
    const input = A._taskOverlay.querySelector("[data-subtask-input]");
    const title = input ? input.value.trim().slice(0, 240) : "";
    if (!title) {
      if (input) input.focus();
      return;
    }
    A._taskDraft.subtasks.push({ id: A.uid("s"), title, done: false });
    rerenderTaskForm("[data-subtask-input]");
  }
  function toggleSubtask(id) {
    const sub = A._taskDraft && A._taskDraft.subtasks.find((x) => x.id === id);
    if (!sub) return;
    sub.done = !sub.done;
    rerenderTaskForm();
  }
  function removeSubtask(id) {
    if (!A._taskDraft) return;
    A._taskDraft.subtasks = A._taskDraft.subtasks.filter((x) => x.id !== id);
    rerenderTaskForm();
  }
  function addLink() {
    if (!A._taskDraft) return;
    const labelEl = A._taskOverlay.querySelector("[data-link-label]");
    const urlEl = A._taskOverlay.querySelector("[data-link-url]");
    const url = A.safeUrl(urlEl ? urlEl.value : "");
    if (!url) {
      A.toast("Liên kết phải bắt đầu bằng http:// hoặc https://", "error");
      if (urlEl) urlEl.focus();
      return;
    }
    let label = labelEl ? labelEl.value.trim() : "";
    if (!label) {
      try {
        label = new URL(url).hostname.replace(/^www\./, "");
      } catch (err) {
        label = "Liên kết";
      }
    }
    A._taskDraft.links.push({ id: A.uid("l"), label: label.slice(0, 120), url: url.slice(0, 800) });
    rerenderTaskForm("[data-link-label]");
  }
  function removeLink(id) {
    if (!A._taskDraft) return;
    A._taskDraft.links = A._taskDraft.links.filter((x) => x.id !== id);
    rerenderTaskForm();
  }
  function sendComment() {
    if (!A._taskDraft) return;
    const input = A._taskOverlay.querySelector("[data-comment-input]");
    const text = input ? input.value.trim().slice(0, 3000) : "";
    if (!text) {
      if (input) input.focus();
      return;
    }
    A._taskDraft.comments.push({
      id: A.uid("c"),
      author: window.SEED.me,
      text,
      at: new Date().toISOString(),
    });
    rerenderTaskForm("[data-comment-input]");
  }

  function saveTask(event) {
    event.preventDefault();
    if (!A._taskDraft) return;
    syncDraftFromForm();
    const draft = A._taskDraft;
    const title = String(draft.title || "").trim().slice(0, 200);
    if (!title) {
      A.toast("Cần đặt tên cho công việc trước khi lưu.", "error");
      const input = document.getElementById("taskTitle");
      if (input) input.focus();
      return;
    }
    const isNew = !draft.id;
    const original = isNew ? null : A.taskById(draft.id);
    if (!isNew && !original) {
      A.toast("Công việc này không còn tồn tại.", "error");
      return;
    }
    const status = A.STATUS[draft.status] ? draft.status : "todo";
    const estimateRaw = draft.estimate;
    const normalized = {
      id: isNew ? A.uid("t") : draft.id,
      title,
      desc: String(draft.desc || "").trim().slice(0, 4000),
      status,
      priority: A.PRIORITY[draft.priority] ? draft.priority : "med",
      assignee: A.memberById(draft.assignee) ? draft.assignee : null,
      workstream: A.wsById(draft.workstream) ? draft.workstream : "w1",
      due: A.parseISO(draft.due) ? draft.due : null,
      estimate: estimateRaw === null || estimateRaw === "" || !Number.isFinite(Number(estimateRaw)) ? null : A.clamp(Number(estimateRaw), 0, 1000),
      labels: draft.labels.filter((l) => A.labels().includes(l)),
      subtasks: draft.subtasks.map((s) => ({ id: s.id || A.uid("s"), title: String(s.title || "").trim().slice(0, 240), done: !!s.done })).filter((s) => s.title),
      links: draft.links.map((l) => ({ id: l.id || A.uid("l"), label: String(l.label || "").trim().slice(0, 120), url: A.safeUrl(l.url) })).filter((l) => l.url),
      comments: draft.comments.map((c) => ({
        id: c.id || A.uid("c"),
        author: A.memberById(c.author) ? c.author : window.SEED.me,
        text: String(c.text || "").trim().slice(0, 3000),
        at: c.at || new Date().toISOString(),
      })).filter((c) => c.text),
      createdAt: isNew ? A.todayISO() : original.createdAt,
      completedAt: null,
      prevStatus: null,
    };
    let newComments = [];
    if (isNew) {
      normalized.completedAt = status === "done" ? A.todayISO() : null;
      A.DATA.tasks.push(normalized);
      A.log("add", normalized.id, window.SEED.me, `đã thêm việc «${title}»`);
      A.toast("Đã giao việc mới.", "success");
    } else {
      const oldStatus = original.status;
      const oldCompleted = original.completedAt;
      const oldCommentIds = new Set((original.comments || []).map((c) => c.id));
      newComments = normalized.comments.filter((c) => !oldCommentIds.has(c.id));
      if (status === "done") {
        normalized.completedAt = oldStatus === "done" ? oldCompleted || A.todayISO() : A.todayISO();
        normalized.prevStatus = oldStatus === "done" ? original.prevStatus : oldStatus;
      } else {
        normalized.completedAt = null;
        normalized.prevStatus = oldStatus === "done" ? null : original.prevStatus;
      }
      Object.assign(original, normalized);
      if (oldStatus !== status) {
        if (status === "done") {
          A.log("done", normalized.id, window.SEED.me, `đã hoàn thành «${title}»`);
          A.confetti();
        } else {
          A.log("move", normalized.id, window.SEED.me, `đã chuyển «${title}» sang ${A.STATUS[status].label}`);
        }
      } else if (newComments.length) {
        A.log("note", normalized.id, window.SEED.me, `đã bình luận trong «${title}»`);
      } else {
        A.log("note", normalized.id, window.SEED.me, `đã cập nhật «${title}»`);
      }
      A.toast("Đã lưu thay đổi.", "success");
    }
    A.save();
    if (A._taskOverlay) A.closeOverlay(A._taskOverlay);
    A.updateShell();
    A.render({ animate: false });
  }

  function requestDeleteTask() {
    const draft = A._taskDraft;
    if (!draft || !draft.id) return;
    const task = A.taskById(draft.id);
    if (!task) return;
    A.confirm({
      title: "Xoá công việc?",
      message: `Việc <b>${esc(task.title)}</b> sẽ bị xoá khỏi bàn điều phối cùng các bình luận và việc nhỏ bên trong.`,
      note: "Không thể hoàn tác. Hãy chắc rằng không còn ai đang phụ trách việc này.",
      confirmLabel: "Xoá công việc",
      danger: true,
    }, () => {
      A.DATA.tasks = A.DATA.tasks.filter((t) => t.id !== task.id);
      A.DATA.focus = A.DATA.focus.filter((f) => f.taskId !== task.id);
      A.DATA.activity = A.DATA.activity.filter((a) => a.taskId !== task.id);
      if (A.focus.taskId === task.id) {
        A.focus.taskId = null;
        A.focus.running = false;
        A.focus.remaining = A.focus.duration;
        if (A.focus.interval) window.clearInterval(A.focus.interval);
        A.focus.interval = null;
      }
      if (A._taskOverlay) A.closeOverlay(A._taskOverlay);
      A.save();
      A.updateShell();
      A.render({ animate: false });
      A.toast("Đã xoá công việc.", "info");
    });
  }

  /* ============================================================
     FOCUS TIMER
     ============================================================ */
  function formatClock(seconds) {
    const mm = Math.floor(Math.max(0, seconds) / 60);
    const ss = Math.max(0, seconds) % 60;
    return `${String(mm).padStart(2, "0")}<span>:</span>${String(ss).padStart(2, "0")}`;
  }
  function updateFocusUI() {
    const card = document.querySelector("[data-focus-card]");
    if (!card) return;
    const focus = A.focus;
    const paused = !focus.running && focus.remaining < focus.duration && focus.remaining > 0;
    card.classList.toggle("running", focus.running);
    const time = card.querySelector("[data-focus-time]");
    if (time) time.innerHTML = formatClock(focus.remaining);
    const fill = card.querySelector("[data-focus-fill]");
    if (fill) {
      const pct = focus.duration ? Math.round(((focus.duration - focus.remaining) / focus.duration) * 100) : 0;
      fill.style.width = `${A.clamp(pct, 0, 100)}%`;
    }
    const state = card.querySelector("[data-focus-state]");
    if (state) state.innerHTML = `<span class="dot"></span>${focus.running ? "Đang chạy" : paused ? "Tạm dừng" : "Sẵn sàng"}`;
    const sub = card.querySelector("[data-focus-sub]");
    if (sub) {
      sub.textContent = focus.running
        ? "Giữ một việc, để chuông sang một bên."
        : paused
          ? `Đang tạm dừng · còn ${Math.ceil(focus.remaining / 60)} phút.`
          : `Phiên ${Math.round(focus.duration / 60)} phút · không ngắt quãng.`;
    }
    const toggle = card.querySelector("[data-focus-toggle]");
    if (toggle) {
      toggle.innerHTML = `${icon(focus.running ? "pause" : "play")}<span data-focus-toggle-label>${focus.running ? "Tạm dừng" : paused ? "Tiếp tục" : "Bắt đầu"}</span>`;
    }
    card.querySelectorAll("[data-focus-preset]").forEach((btn) => {
      btn.classList.toggle("on", Number(btn.dataset.focusPreset) * 60 === focus.duration);
    });
  }
  function startTicker() {
    if (A.focus.interval) window.clearInterval(A.focus.interval);
    A.focus.lastTick = Date.now();
    A.focus.interval = window.setInterval(tickFocus, 1000);
  }
  function tickFocus() {
    if (!A.focus.running) {
      if (A.focus.interval) window.clearInterval(A.focus.interval);
      A.focus.interval = null;
      return;
    }
    const now = Date.now();
    const elapsed = Math.floor((now - A.focus.lastTick) / 1000);
    if (elapsed <= 0) return;
    A.focus.lastTick += elapsed * 1000;
    A.focus.remaining = Math.max(0, A.focus.remaining - elapsed);
    updateFocusUI();
    if (A.focus.remaining <= 0) finishFocus();
  }
  function finishFocus() {
    if (A.focus.interval) window.clearInterval(A.focus.interval);
    A.focus.interval = null;
    const wasRunning = A.focus.running;
    const minutes = Math.max(1, Math.round(A.focus.duration / 60));
    const taskId = A.focus.taskId && A.taskById(A.focus.taskId) ? A.focus.taskId : null;
    A.focus.running = false;
    A.focus.remaining = A.focus.duration;
    A.DATA.focus.unshift({ id: A.uid("f"), taskId, minutes, at: new Date().toISOString() });
    A.DATA.focus = A.DATA.focus.slice(0, 1000);
    A.save();
    A.confetti();
    A.toast(wasRunning ? `Xong phiên ${minutes} phút. Nghỉ 5 phút nhé.` : "Phiên tập trung đã hoàn tất.", "success");
    A.updateShell();
    if (A.view === "today") A.render({ animate: false });
    else updateFocusUI();
  }
  function toggleFocus() {
    if (A.focus.running) {
      A.focus.running = false;
      if (A.focus.interval) window.clearInterval(A.focus.interval);
      A.focus.interval = null;
      updateFocusUI();
      return;
    }
    if (A.focus.remaining <= 0) A.focus.remaining = A.focus.duration;
    A.focus.running = true;
    startTicker();
    updateFocusUI();
  }
  function setFocusDuration(minutes) {
    const mins = Number(minutes);
    if (!Number.isFinite(mins) || mins < 1 || mins > 180) return;
    if (A.focus.interval) window.clearInterval(A.focus.interval);
    A.focus.interval = null;
    A.focus.running = false;
    A.focus.duration = Math.round(mins * 60);
    A.focus.remaining = A.focus.duration;
    updateFocusUI();
  }
  function resetFocus() {
    if (A.focus.interval) window.clearInterval(A.focus.interval);
    A.focus.interval = null;
    A.focus.running = false;
    A.focus.remaining = A.focus.duration;
    updateFocusUI();
  }

  /* ============================================================
     SETTINGS & DỮ LIỆU
     ============================================================ */
  function openSettings() {
    if (A._overlays.length) A.closeAllOverlays();
    const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const html = `<div class="modal modal-narrow" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">
      <div class="modal-head">
        <div>
          <div class="modal-eyebrow">${icon("settings")} Cài đặt</div>
          <div class="modal-title" id="settingsTitle">Bàn làm việc của bạn</div>
          <div class="modal-sub">Tên dự án, giao diện và dữ liệu trên thiết bị này.</div>
        </div>
        <button class="icon-btn modal-close" type="button" data-close-overlay aria-label="Đóng">${icon("x")}</button>
      </div>
      <div class="modal-body">
        <div class="settings-sec">
          <div class="settings-title">${icon("layers")} Tên dự án</div>
          <label class="f-label" for="projectName" style="margin-top:8px">Hiển thị trên bàn điều phối</label>
          <input class="input" id="projectName" value="${esc(A.DATA.settings.projectName)}" maxlength="80" autocomplete="off">
          <div class="settings-desc">Tên mới sẽ cập nhật ở thanh bên và tiêu đề trình duyệt.</div>
        </div>
        <div class="settings-sec">
          <div class="settings-title">${icon(theme === "dark" ? "moon" : "sun")} Giao diện</div>
          <div class="settings-desc">Chọn tông nền phù hợp với ánh sáng phòng làm việc.</div>
          <div class="theme-choice">
            <button class="theme-opt${theme === "light" ? " on" : ""}" type="button" data-set-theme="light">
              <span class="theme-swatch"><i style="background:#f4eee3"></i><i style="background:#e14e27"></i><i style="background:#1b1915"></i></span>
              Sáng
            </button>
            <button class="theme-opt${theme === "dark" ? " on" : ""}" type="button" data-set-theme="dark">
              <span class="theme-swatch"><i style="background:#131210"></i><i style="background:#ff6b3d"></i><i style="background:#f5eee2"></i></span>
              Tối
            </button>
          </div>
        </div>
        <div class="settings-sec">
          <div class="settings-title">${icon("download")} Dữ liệu của tổ</div>
          <div class="settings-desc">Dữ liệu nằm trong trình duyệt này. Xuất tệp JSON để sao lưu hoặc chuyển sang máy khác.</div>
          <div class="settings-actions">
            <button class="btn btn-ghost" type="button" data-data-action="export-json">${icon("download")} Xuất JSON</button>
            <button class="btn btn-ghost" type="button" data-data-action="export-csv">${icon("download")} Xuất CSV</button>
            <button class="btn btn-ghost" type="button" data-data-action="import-json">${icon("upload")} Nhập JSON</button>
            <button class="btn btn-danger" type="button" data-data-action="reset-demo">${icon("reset")} Dữ liệu mẫu</button>
          </div>
          <input id="importFile" type="file" accept="application/json,.json" hidden>
          <div class="settings-note">${icon("alert")}<span>Nhập JSON sẽ thay thế toàn bộ dữ liệu hiện tại. Hãy xuất bản sao lưu trước.</span></div>
        </div>
        <div class="settings-sec">
          <div class="settings-title">${icon("command")} Phím tắt</div>
          <div class="shortcut-list">
            <div class="shortcut-row"><span>Tìm nhanh</span><span><kbd>⌘</kbd> <kbd>K</kbd></span></div>
            <div class="shortcut-row"><span>Giao việc mới</span><kbd>N</kbd></div>
            <div class="shortcut-row"><span>Đóng hộp thoại</span><kbd>Esc</kbd></div>
            <div class="shortcut-row"><span>Di chuyển trong tìm nhanh</span><span><kbd>↑</kbd> <kbd>↓</kbd></span></div>
            <div class="shortcut-row"><span>Mở kết quả đang chọn</span><kbd>↵</kbd></div>
            <div class="shortcut-row"><span>Lưu nhanh khi đang sửa việc</span><span><kbd>⌘</kbd> <kbd>↵</kbd></span></div>
          </div>
        </div>
        <div class="settings-sec settings-about">
          GUỒNG v1.0 · Bàn điều phối của tổ quản trị.<br>
          Một sản phẩm tĩnh chạy trên GitHub Pages, không gửi dữ liệu ra ngoài.
        </div>
      </div>
      <div class="modal-foot">
        <span class="foot-note">Thay đổi tên dự án được lưu khi rời ô nhập.</span>
        <div class="foot-right"><button class="btn btn-ink" type="button" data-close-overlay>Xong</button></div>
      </div>
    </div>`;
    A.openOverlay(html, { focus: "#projectName" });
  }
  A.openSettings = openSettings;

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  }
  function exportJSON() {
    const file = `guong-du-lieu-${A.todayISO()}.json`;
    downloadFile(file, JSON.stringify(A.DATA, null, 2), "application/json;charset=utf-8");
    A.toast("Đã xuất bản sao lưu JSON.", "success");
  }
  function csvCell(value) {
    let text = String(value == null ? "" : value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }
  function exportCSV() {
    const headers = ["Mã", "Tiêu đề", "Mô tả", "Trạng thái", "Ưu tiên", "Người nhận", "Mảng", "Hạn", "Ước lượng (giờ)", "Nhãn", "Ngày tạo", "Ngày hoàn thành"];
    const rows = A.DATA.tasks.map((t) => {
      const member = A.memberById(t.assignee);
      const ws = A.wsById(t.workstream);
      return [
        t.id,
        t.title,
        t.desc,
        A.STATUS[t.status].label,
        A.PRIORITY[t.priority].label,
        member ? member.name : "Chưa giao",
        ws ? ws.name : "",
        t.due || "",
        t.estimate == null ? "" : t.estimate,
        (t.labels || []).join("; "),
        t.createdAt || "",
        t.completedAt || "",
      ];
    });
    const csv = "\ufeff" + [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    downloadFile(`guong-cong-viec-${A.todayISO()}.csv`, csv, "text/csv;charset=utf-8");
    A.toast("Đã xuất danh sách công việc CSV.", "success");
  }
  function handleImportFile(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ""));
        const wrapper = Array.isArray(parsed)
          ? { version: 1, settings: A.DATA.settings, tasks: parsed, activity: [], focus: [] }
          : parsed;
        const normalized = A.normalizeState(wrapper);
        if (!normalized) throw new Error("bad-shape");
        A.confirm({
          title: "Thay thế dữ liệu hiện tại?",
          message: `Tệp có <b>${normalized.tasks.length} công việc</b>. Toàn bộ dữ liệu đang có trên thiết bị này sẽ bị thay thế.`,
          note: "Hãy xuất JSON bản sao lưu trước nếu bạn chưa chắc.",
          confirmLabel: "Nhập dữ liệu",
          danger: true,
        }, () => {
          A.DATA = normalized;
          A.applyTheme(normalized.settings.theme);
          A.save();
          A.boardFilters = { q: "", assignee: "all", workstream: "all", priority: "all" };
          A.listFilters = { q: "", status: "all", assignee: "all", workstream: "all", priority: "all", sort: "smart" };
          A.calMonth = null;
          A.calSelected = null;
          A.closeAllOverlays();
          A.updateShell();
          A.render({ animate: true });
          A.toast(`Đã nhập ${normalized.tasks.length} công việc.`, "success");
        });
      } catch (err) {
        A.toast("Tệp JSON không đúng định dạng của GUỒNG.", "error");
      }
    };
    reader.onerror = () => A.toast("Không đọc được tệp. Thử lại giúp mình.", "error");
    reader.readAsText(file, "utf-8");
    input.value = "";
  }
  function resetDemo() {
    A.confirm({
      title: "Dùng lại dữ liệu mẫu?",
      message: "Toàn bộ công việc, bình luận và phiên tập trung hiện tại sẽ được thay bằng bộ dữ liệu mẫu mới.",
      note: "Nếu muốn giữ dữ liệu thật, hãy xuất JSON trước.",
      confirmLabel: "Dùng dữ liệu mẫu",
      danger: true,
    }, () => {
      if (A.focus.interval) window.clearInterval(A.focus.interval);
      A.closeAllOverlays();
      A.DATA = A.normalizeState(window.SEED.create());
      A.boardFilters = { q: "", assignee: "all", workstream: "all", priority: "all" };
      A.listFilters = { q: "", status: "all", assignee: "all", workstream: "all", priority: "all", sort: "smart" };
      A.calMonth = null;
      A.calSelected = null;
      A.focus = { duration: 1500, remaining: 1500, running: false, taskId: null, interval: null, lastTick: 0 };
      A.applyTheme("light");
      A.save();
      A.updateShell();
      A.route();
      A.toast("Đã nạp lại dữ liệu mẫu.", "success");
    });
  }
  function updateProjectName(input) {
    const name = String(input.value || "").trim().slice(0, 80);
    if (!name) {
      input.value = A.DATA.settings.projectName;
      A.toast("Tên dự án không được để trống.", "error");
      return;
    }
    A.DATA.settings.projectName = name;
    A.save();
    A.updateShell();
    A.toast("Đã đổi tên dự án.", "success");
  }

  /* ============================================================
     COMMAND PALETTE
     ============================================================ */
  function paletteTaskItem(task) {
    const member = A.memberById(task.assignee);
    const ws = A.wsById(task.workstream);
    const statusIcon = { todo: "layers", doing: "play", review: "clock", done: "check-circle" }[task.status] || "layers";
    return {
      group: paletteQuery ? "Công việc phù hợp" : "Việc nên chạm",
      icon: statusIcon,
      title: task.title,
      sub: `${ws ? ws.name : "Chưa phân mảng"} · ${member ? member.name : "Chưa giao"} · ${A.dueMeta(task).text}`,
      run: () => openTask(task.id),
    };
  }
  function buildPalette() {
    const q = A.norm(paletteQuery).trim();
    const navItems = A.VIEWS.map((view) => ({
      group: "Đi nhanh",
      icon: { dashboard: "grid", today: "sun", board: "board", list: "list", calendar: "calendar", team: "users", reports: "chart" }[view],
      title: A.VIEW_LABEL[view],
      sub: view === A.view ? "Màn hình hiện tại" : "Chuyển không gian",
      run: () => go(view),
    })).filter((item) => !q || A.norm(`${item.title} ${item.sub}`).includes(q));
    let tasks;
    if (q) {
      tasks = A.sortTasks(A.DATA.tasks.filter((task) => {
        const member = A.memberById(task.assignee);
        const ws = A.wsById(task.workstream);
        const haystack = A.norm([task.title, task.desc, (task.labels || []).join(" "), member ? member.name : "", ws ? ws.name : ""].join(" "));
        return haystack.includes(q);
      }), "smart").slice(0, 8);
    } else {
      tasks = A.smartTasks(6);
    }
    const taskItems = tasks.map(paletteTaskItem);
    const actionItems = [
      { group: "Thao tác", icon: "plus", title: "Giao việc mới", sub: "Mở biểu mẫu công việc", run: () => openTask() },
      { group: "Thao tác", icon: "moon", title: "Đổi giao diện sáng / tối", sub: "Chuyển nhanh tông nền", run: () => A.toggleTheme() },
      { group: "Thao tác", icon: "settings", title: "Cài đặt & dữ liệu", sub: "Sao lưu, nhập hoặc đổi tên dự án", run: () => openSettings() },
    ].filter((item) => !q || A.norm(`${item.title} ${item.sub}`).includes(q));
    return [...navItems, ...taskItems, ...actionItems];
  }
  function paletteSelect(index) {
    if (!paletteItems.length) return;
    paletteIndex = (index + paletteItems.length) % paletteItems.length;
    const body = document.getElementById("paletteBody");
    if (!body) return;
    body.querySelectorAll("[data-palette-index]").forEach((el) => {
      el.classList.toggle("sel", Number(el.dataset.paletteIndex) === paletteIndex);
    });
    const sel = body.querySelector(".palette-item.sel");
    if (sel) sel.scrollIntoView({ block: "nearest" });
  }
  function paletteRender() {
    const body = document.getElementById("paletteBody");
    if (!body) return;
    paletteItems = buildPalette();
    paletteIndex = 0;
    let lastGroup = "";
    let html = "";
    paletteItems.forEach((item, index) => {
      if (item.group !== lastGroup) {
        html += `<div class="palette-label">${esc(item.group)}</div>`;
        lastGroup = item.group;
      }
      html += `<button class="palette-item${index === 0 ? " sel" : ""}" type="button" data-palette-index="${index}">
        <span class="pi-ico">${icon(item.icon)}</span>
        <span class="pi-main"><span class="pi-title">${esc(item.title)}</span><span class="pi-sub">${esc(item.sub)}</span></span>
        <span class="pi-enter">${icon("arrow-right")}</span>
      </button>`;
    });
    body.innerHTML = html || `<div class="palette-empty">Không tìm thấy kết quả. Thử một từ khóa khác.</div>`;
    body.querySelectorAll("[data-palette-index]").forEach((btn) => {
      btn.addEventListener("click", () => paletteRun(Number(btn.dataset.paletteIndex)));
    });
  }
  function paletteRun(index) {
    const item = paletteItems[index];
    if (!item) return;
    if (paletteOverlay) {
      A.closeOverlay(paletteOverlay);
      paletteOverlay = null;
    }
    window.setTimeout(() => item.run(), 0);
  }
  function paletteMove(delta) {
    if (!paletteItems.length) return;
    paletteSelect(paletteIndex + delta);
  }
  function openPalette() {
    if (A._overlays.length) {
      const top = A._overlays[A._overlays.length - 1];
      if (top.el.classList.contains("palette-wrap")) {
        A.closeOverlay(top.el);
        paletteOverlay = null;
        return;
      }
      A.closeAllOverlays();
    }
    paletteQuery = "";
    paletteIndex = 0;
    const html = `<div class="palette" role="dialog" aria-modal="true" aria-label="Tìm nhanh">
      <div class="palette-search">
        ${icon("search")}
        <input id="paletteInput" type="text" placeholder="Tìm việc, người, mảng hoặc đi nhanh…" autocomplete="off" spellcheck="false">
        <kbd>ESC</kbd>
      </div>
      <div class="palette-body" id="paletteBody"></div>
      <div class="palette-foot">
        <span><kbd>↑</kbd><kbd>↓</kbd> di chuyển</span>
        <span><kbd>↵</kbd> mở</span>
        <span><kbd>Esc</kbd> đóng</span>
        <span style="margin-left:auto">GUỒNG · tìm nhanh</span>
      </div>
    </div>`;
    paletteOverlay = A.openOverlay(html, {
      className: "palette-wrap",
      focus: "#paletteInput",
      onClose: () => {
        paletteOverlay = null;
        paletteItems = [];
      },
    });
    paletteRender();
    const input = document.getElementById("paletteInput");
    if (input) {
      input.addEventListener("input", () => {
        paletteQuery = input.value;
        paletteRender();
      });
    }
  }
  A.openPalette = openPalette;

  /* ============================================================
     EVENT DELEGATION
     ============================================================ */
  let dragClickGuard = false;

  document.addEventListener("click", (event) => {
    const closeBtn = event.target.closest("[data-close-overlay]");
    if (closeBtn) {
      const overlay = closeBtn.closest(".overlay");
      A.closeOverlay(overlay);
      return;
    }

    const goBtn = event.target.closest("[data-go]");
    if (goBtn) {
      go(goBtn.dataset.go);
      return;
    }

    const newBtn = event.target.closest("[data-new-task]");
    if (newBtn) {
      openNewTask({
        status: newBtn.dataset.status || undefined,
        due: newBtn.dataset.due || undefined,
        assignee: newBtn.dataset.assignee || undefined,
        workstream: newBtn.dataset.workstream || undefined,
      });
      return;
    }

    const tick = event.target.closest("[data-tick-task]");
    if (tick) {
      event.preventDefault();
      toggleTaskDone(tick.dataset.tickTask);
      return;
    }

    if (!dragClickGuard) {
      const openBtn = event.target.closest("[data-open-task]");
      if (openBtn) {
        openTask(openBtn.dataset.openTask);
        return;
      }
    }

    const wsFilter = event.target.closest("[data-ws-filter]");
    if (wsFilter) {
      A.drill("workstream", wsFilter.dataset.wsFilter);
      return;
    }
    const memberFilter = event.target.closest("[data-member-filter]");
    if (memberFilter) {
      A.drill("member", memberFilter.dataset.memberFilter);
      return;
    }

    const boardAdd = event.target.closest("[data-board-add]");
    if (boardAdd) {
      const preset = { status: boardAdd.dataset.boardAdd };
      if (A.boardFilters.assignee !== "all" && A.boardFilters.assignee !== "none") preset.assignee = A.boardFilters.assignee;
      if (A.boardFilters.workstream !== "all") preset.workstream = A.boardFilters.workstream;
      openNewTask(preset);
      return;
    }

    const clear = event.target.closest("[data-clear-filters]");
    if (clear) {
      A.clearFilters(clear.dataset.clearFilters);
      return;
    }

    const calNav = event.target.closest("[data-cal-nav]");
    if (calNav) {
      shiftCalendar(Number(calNav.dataset.calNav));
      return;
    }
    if (event.target.closest("[data-cal-today]")) {
      calendarToday();
      return;
    }
    const calDay = event.target.closest("[data-cal-day]");
    if (calDay) {
      selectCalendarDay(calDay.dataset.calDay);
      return;
    }

    const focusPreset = event.target.closest("[data-focus-preset]");
    if (focusPreset) {
      setFocusDuration(Number(focusPreset.dataset.focusPreset));
      return;
    }
    if (event.target.closest("[data-focus-toggle]")) {
      toggleFocus();
      return;
    }
    if (event.target.closest("[data-focus-reset]")) {
      resetFocus();
      return;
    }

    const taskAction = event.target.closest("[data-task-action]");
    if (taskAction) {
      const action = taskAction.dataset.taskAction;
      if (action === "pick-ws" && A._taskDraft) {
        A._taskDraft.workstream = A.wsById(taskAction.dataset.id) ? taskAction.dataset.id : A._taskDraft.workstream;
        rerenderTaskForm();
      } else if (action === "pick-label" && A._taskDraft) {
        const label = taskAction.dataset.label;
        if (A.labels().includes(label)) {
          A._taskDraft.labels = A._taskDraft.labels.includes(label)
            ? A._taskDraft.labels.filter((l) => l !== label)
            : [...A._taskDraft.labels, label];
        }
        rerenderTaskForm();
      } else if (action === "add-subtask") {
        addSubtask();
      } else if (action === "toggle-subtask") {
        toggleSubtask(taskAction.dataset.id);
      } else if (action === "remove-subtask") {
        removeSubtask(taskAction.dataset.id);
      } else if (action === "add-link") {
        addLink();
      } else if (action === "remove-link") {
        removeLink(taskAction.dataset.id);
      } else if (action === "send-comment") {
        sendComment();
      } else if (action === "delete-task") {
        requestDeleteTask();
      }
      return;
    }

    const themeBtn = event.target.closest("[data-set-theme]");
    if (themeBtn) {
      const theme = themeBtn.dataset.setTheme;
      A.applyTheme(theme);
      document.querySelectorAll("[data-set-theme]").forEach((btn) => btn.classList.toggle("on", btn.dataset.setTheme === theme));
      A.toast(theme === "dark" ? "Đã bật giao diện tối." : "Đã bật giao diện sáng.", "info");
      return;
    }

    const dataAction = event.target.closest("[data-data-action]");
    if (dataAction) {
      const action = dataAction.dataset.dataAction;
      if (action === "export-json") exportJSON();
      else if (action === "export-csv") exportCSV();
      else if (action === "import-json") {
        const input = document.getElementById("importFile");
        if (input) input.click();
      } else if (action === "reset-demo") resetDemo();
      return;
    }

    if (event.target.closest("[data-copy-report]")) {
      copyText(A.weeklyReportText());
      return;
    }
    if (event.target.closest("[data-print-report]")) {
      window.print();
      return;
    }
  });

  document.addEventListener("input", (event) => {
    const el = event.target;
    if (el.matches("[data-filter-scope][data-filter-key]") && el.tagName === "INPUT") {
      setFilter(el.dataset.filterScope, el.dataset.filterKey, el.value);
      if (filterTimer) window.clearTimeout(filterTimer);
      const scope = el.dataset.filterScope;
      filterTimer = window.setTimeout(() => {
        filterTimer = null;
        A.render({ animate: false });
        const input = document.querySelector(`[data-filter-scope="${scope}"][data-filter-key="q"]`);
        if (input) {
          input.focus({ preventScroll: true });
          try {
            input.setSelectionRange(input.value.length, input.value.length);
          } catch (err) {
            /* noop */
          }
        }
      }, 230);
      return;
    }
    if (el.closest("#taskForm") && el.dataset.field) syncDraftField(el);
  });

  document.addEventListener("change", (event) => {
    const el = event.target;
    if (el.closest("#taskForm") && el.dataset.field) {
      syncDraftField(el);
      return;
    }
    const filter = el.closest("[data-filter-scope][data-filter-key]");
    if (filter) {
      setFilter(filter.dataset.filterScope, filter.dataset.filterKey, filter.value);
      const scope = filter.dataset.filterScope;
      if (filterTimer) {
        window.clearTimeout(filterTimer);
        filterTimer = null;
      }
      A.render({ animate: false });
      if (scope) A.updateShell();
      return;
    }
    const statusSelect = el.closest("[data-status-task]");
    if (statusSelect) {
      setTaskStatus(statusSelect.dataset.statusTask, statusSelect.value);
      return;
    }
    const assignSelect = el.closest("[data-assign-task]");
    if (assignSelect) {
      assignTask(assignSelect.dataset.assignTask, assignSelect.value);
      return;
    }
    const focusTask = el.closest("[data-focus-task]");
    if (focusTask) {
      A.focus.taskId = A.taskById(focusTask.value) ? focusTask.value : null;
      return;
    }
    if (el.id === "projectName") {
      updateProjectName(el);
      return;
    }
    if (el.id === "importFile") {
      handleImportFile(el);
    }
  });

  document.addEventListener("submit", (event) => {
    if (event.target.matches("#taskForm")) {
      saveTask(event);
    }
  });

  /* ---------- kéo thả bảng việc ---------- */
  document.addEventListener("dragstart", (event) => {
    const card = event.target.closest(".kcard[data-board-task]");
    if (!card) return;
    event.dataTransfer.setData("text/plain", card.dataset.boardTask);
    event.dataTransfer.effectAllowed = "move";
    card.classList.add("dragging");
    dragClickGuard = true;
  });
  document.addEventListener("dragover", (event) => {
    const column = event.target.closest(".kcol[data-drop-status]");
    if (!column) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    document.querySelectorAll(".kcol.drag-over").forEach((col) => {
      if (col !== column) col.classList.remove("drag-over");
    });
    column.classList.add("drag-over");
  });
  document.addEventListener("dragleave", (event) => {
    const column = event.target.closest(".kcol[data-drop-status]");
    if (column && !column.contains(event.relatedTarget)) column.classList.remove("drag-over");
  });
  document.addEventListener("drop", (event) => {
    const column = event.target.closest(".kcol[data-drop-status]");
    if (!column) return;
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain");
    document.querySelectorAll(".kcol.drag-over").forEach((col) => col.classList.remove("drag-over"));
    document.querySelectorAll(".kcard.dragging").forEach((card) => card.classList.remove("dragging"));
    if (id) setTaskStatus(id, column.dataset.dropStatus);
    window.setTimeout(() => { dragClickGuard = false; }, 120);
  });
  document.addEventListener("dragend", () => {
    document.querySelectorAll(".kcol.drag-over").forEach((col) => col.classList.remove("drag-over"));
    document.querySelectorAll(".kcard.dragging").forEach((card) => card.classList.remove("dragging"));
    window.setTimeout(() => { dragClickGuard = false; }, 120);
  });

  /* ---------- bàn phím ---------- */
  function isTyping(target) {
    if (!target) return false;
    return target.matches("input, textarea, select, [contenteditable='true'], [contenteditable='']");
  }
  function topOverlay() {
    return A._overlays[A._overlays.length - 1] || null;
  }
  function trapFocus(event) {
    const top = topOverlay();
    if (!top) return;
    const nodes = [...top.el.querySelectorAll("a[href], button:not([disabled]), input:not([disabled]):not([type='hidden']), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")]
      .filter((el) => el.offsetParent !== null);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (A._overlays.length) {
        event.preventDefault();
        A.closeTopOverlay();
        return;
      }
      if (document.body.classList.contains("sidebar-open")) {
        event.preventDefault();
        A.toggleSidebar(false);
        return;
      }
      if (isTyping(event.target) && event.target.blur) event.target.blur();
      return;
    }
    const top = topOverlay();
    const topIsPalette = top && top.el.classList.contains("palette-wrap");
    if (topIsPalette) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        paletteMove(1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        paletteMove(-1);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        paletteRun(paletteIndex);
        return;
      }
    }
    if (event.key === "Tab") {
      trapFocus(event);
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (topIsPalette) {
        A.closeOverlay(top.el);
      } else if (!A._overlays.length) {
        openPalette();
      }
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      if (event.target.matches("[data-comment-input]")) {
        event.preventDefault();
        sendComment();
        return;
      }
      if (event.target.closest("#taskForm")) {
        event.preventDefault();
        const form = document.getElementById("taskForm");
        if (form) form.requestSubmit();
        return;
      }
    }
    if (!A._overlays.length && !isTyping(event.target) && !event.metaKey && !event.ctrlKey && !event.altKey) {
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        openNewTask();
        return;
      }
      if (event.key === "/") {
        event.preventDefault();
        openPalette();
        return;
      }
    }
    if (event.key === "Enter" || event.key === " ") {
      if (event.target.matches("[data-cal-day]")) {
        event.preventDefault();
        selectCalendarDay(event.target.dataset.calDay);
        return;
      }
      if (event.target.matches(".kcard[data-open-task]")) {
        event.preventDefault();
        openTask(event.target.dataset.openTask);
        return;
      }
    }
    if (event.key === "Enter" && event.target.matches("[data-subtask-input]")) {
      event.preventDefault();
      addSubtask();
      return;
    }
    if (event.key === "Enter" && (event.target.matches("[data-link-label]") || event.target.matches("[data-link-url]"))) {
      event.preventDefault();
      addLink();
    }
  });

  /* ============================================================
     COPY BÁO CÁO
     ============================================================ */
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
      A.toast("Đã sao chép báo cáo tuần.", "success");
    } catch (err) {
      A.toast("Trình duyệt không cho sao chép. Thử in / PDF.", "error");
    }
  }

  /* ============================================================
     KHỞI ĐỘNG
     ============================================================ */
  function init() {
    A.applyTheme(A.DATA.settings.theme);
    if (!A.focus.taskId) {
      const first = A.smartTasks(1)[0];
      A.focus.taskId = first ? first.id : null;
    }
    A.route();
    window.addEventListener("beforeunload", () => A.save());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
