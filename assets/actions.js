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
    const me = A.meId();
    if (task.status === "done") {
      task.status = task.prevStatus || "todo";
      task.prevStatus = null;
      task.completedAt = null;
      A.touchTask(task);
      A.log("move", task.id, me, `đã mở lại «${task.title}»`);
      A.toast("Đã mở lại công việc.", "info");
    } else {
      task.prevStatus = task.status;
      task.status = "done";
      task.completedAt = A.todayISO();
      A.touchTask(task);
      A.log("done", task.id, me, `đã hoàn thành «${task.title}»`);
      A.toast("Một việc nữa được gạch.", "success");
      A.confetti();
    }
    A.refresh();
  }

  function setTaskStatus(id, status) {
    const task = A.taskById(id);
    if (!task || !A.STATUS[status] || task.status === status) return;
    const me = A.meId();
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
    A.touchTask(task);
    A.toast(`Đã chuyển sang «${A.STATUS[status].label}».`, status === "done" ? "success" : "info");
    A.refresh();
  }

  function assignTask(id, memberId) {
    const task = A.taskById(id);
    if (!task) return;
    const member = A.memberById(memberId);
    if (!member) return;
    task.assignee = member.id;
    A.touchTask(task);
    A.log("note", task.id, A.meId(), `đã giao «${task.title}» cho ${member.name}`);
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
      assignee: A.memberById(p.assignee) ? p.assignee : (A.meId() || null),
      workstream: A.wsById(p.workstream) ? p.workstream : "w1",
      due: A.parseISO(p.due) ? p.due : A.todayISO(),
      estimate: null,
      labels: [],
      subtasks: [],
      links: [],
      comments: [],
      createdAt: A.todayISO(),
      completedAt: null,
      updatedAt: "",
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
      const member = A.memberById(comment.author);
      const authorName = member ? member.name : comment.author ? "Thành viên cũ" : "Bạn";
      return `<div class="comment-row">
        ${A.avatar(member, "avatar-sm")}
        <div class="comment-main">
          <div class="comment-head"><span class="comment-name">${esc(authorName)}</span><span class="comment-time">${esc(A.timeAgo(comment.at))}</span></div>
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
            ${!A.members().length ? `<div class="field-hint">Chưa có thành viên. Vào <b>Đội ngũ</b> để thêm người trước khi giao việc.</div>` : ""}
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
      author: A.meId(),
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
      projectId: original && original.projectId ? original.projectId : (A.DATA.settings.activeProjectId || null),
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
        author: A.memberById(c.author) ? c.author : null,
        text: String(c.text || "").trim().slice(0, 3000),
        at: c.at || new Date().toISOString(),
      })).filter((c) => c.text),
      createdAt: isNew ? A.todayISO() : original.createdAt,
      completedAt: null,
      updatedAt: new Date().toISOString(),
      prevStatus: null,
    };
    let newComments = [];
    if (isNew) {
      normalized.completedAt = status === "done" ? A.todayISO() : null;
      A.DATA.tasks.push(normalized);
      A.log("add", normalized.id, A.meId(), `đã thêm việc «${title}»`);
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
          A.log("done", normalized.id, A.meId(), `đã hoàn thành «${title}»`);
          A.confetti();
        } else {
          A.log("move", normalized.id, A.meId(), `đã chuyển «${title}» sang ${A.STATUS[status].label}`);
        }
      } else if (newComments.length) {
        A.log("note", normalized.id, A.meId(), `đã bình luận trong «${title}»`);
      } else {
        A.log("note", normalized.id, A.meId(), `đã cập nhật «${title}»`);
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
      A.markTaskDeleted(task.id);
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
     THÀNH VIÊN
     ============================================================ */
  function memberInitials(name) {
    const words = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "?";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  function memberFormHTML(member) {
    const isNew = !member;
    const colors = A.memberColors();
    const color = member ? member.color : colors[A.members().length % colors.length];
    const name = member ? member.name : "";
    const role = member ? member.role : "";
    const capacity = member ? member.capacity : 8;
    const email = member ? member.email || "" : "";
    const note = isNew
      ? (A.members().length ? "Thêm email để gửi lời mời kèm mã dự án; bỏ trống nếu chỉ muốn ghi tên vào bảng việc." : "Bạn là người đầu tiên — tên này sẽ được chọn làm “Bạn” trong tổ. Thêm email nếu muốn mời người khác sau này.")
      : "Những việc đang nhận vẫn giữ nguyên khi bạn đổi tên, vai trò hoặc email.";
    return `<form class="modal modal-narrow member-form" id="memberForm" data-member-id="${member ? esc(member.id) : ""}" role="dialog" aria-modal="true" aria-labelledby="memberTitle">
      <div class="modal-head">
        <div>
          <div class="modal-eyebrow">${icon("users")} ${isNew ? "Thành viên mới" : "Hồ sơ thành viên"}</div>
          <div class="modal-title" id="memberTitle">${isNew ? "Thêm người vào tổ" : "Chỉnh thông tin"}</div>
          <div class="modal-sub">${isNew ? "Chỉ cần tên và vai trò để bắt đầu giao việc." : "Tên, vai trò, màu nhận diện và năng lực tuần."}</div>
        </div>
        <button class="icon-btn modal-close" type="button" data-close-overlay aria-label="Đóng">${icon("x")}</button>
      </div>
      <div class="modal-body">
        <div class="member-preview">
          <span class="avatar avatar-lg" data-member-preview-avatar style="--who:${esc(color)}">${esc(memberInitials(name))}</span>
          <div class="member-preview-main">
            <b data-member-preview-name>${esc(name || "Tên thành viên")}</b>
            <small data-member-preview-role>${esc(role || "Thành viên")} · ${capacity} việc/tuần</small>
          </div>
        </div>
        <div class="field">
          <label class="f-label" for="memberName">Tên hiển thị</label>
          <input class="input" id="memberName" name="name" value="${esc(name)}" maxlength="60" placeholder="Ví dụ: Lan Hương" autocomplete="off">
        </div>
        <div class="meta-grid" style="margin-top:12px">
          <div class="field">
            <label class="f-label" for="memberRole">Vai trò</label>
            <input class="input" id="memberRole" name="role" value="${esc(role)}" maxlength="60" placeholder="Kinh doanh, Vận hành, Kỹ thuật…" autocomplete="off">
          </div>
          <div class="field">
            <label class="f-label" for="memberCapacity">Năng lực tuần (việc)</label>
            <input class="input" id="memberCapacity" name="capacity" type="number" min="1" max="40" step="1" value="${capacity}" inputmode="numeric">
          </div>
        </div>
        <div class="field" style="margin-top:12px">
          <label class="f-label" for="memberEmail">Email mời (tuỳ chọn)</label>
          <input class="input" id="memberEmail" name="email" type="email" value="${esc(email)}" maxlength="120" placeholder="ten@congty.com" autocomplete="email">
          <div class="settings-desc">Lưu email để gửi lời mời kèm mã tham gia dự án đang chọn.</div>
        </div>
        <div class="field" style="margin-top:12px">
          <span class="f-label">Màu nhận diện</span>
          <div class="member-colors">
            ${colors.map((c) => `<button class="member-color${c === color ? " on" : ""}" type="button" data-member-color="${esc(c)}" style="--sw:${esc(c)}" aria-label="Chọn màu ${esc(c)}" aria-pressed="${c === color}"><span></span></button>`).join("")}
          </div>
          <input type="hidden" name="color" value="${esc(color)}">
        </div>
        <div class="settings-note" style="margin-top:14px">${icon("spark")}<span>${esc(note)}</span></div>
      </div>
      <div class="modal-foot">
        <div>
          ${member ? `<button class="btn btn-danger btn-sm" type="button" data-member-action="delete-member">${icon("trash")} Xoá khỏi tổ</button>` : `<span class="foot-note">Có thể sửa lại bất cứ lúc nào.</span>`}
        </div>
        <div class="foot-right">
          <button class="btn btn-ghost" type="button" data-close-overlay>Huỷ</button>
          <button class="btn btn-accent" type="submit">${icon("check")} ${isNew ? "Thêm vào tổ" : "Lưu thay đổi"}</button>
        </div>
      </div>
    </form>`;
  }
  function openMember(id) {
    if (A._overlays.length) A.closeAllOverlays();
    const member = id ? A.memberById(id) : null;
    if (id && !member) {
      A.toast("Không tìm thấy thành viên này.", "error");
      return;
    }
    A.openOverlay(memberFormHTML(member), { focus: "#memberName" });
  }
  A.openMember = openMember;

  /* ============================================================
     DỰ ÁN & LỜI MỜI
     ============================================================ */
  function copyText(text, message) {
    if (!navigator.clipboard) {
      A.toast("Trình duyệt không cho copy tự động.", "error");
      return;
    }
    navigator.clipboard
      .writeText(text)
      .then(() => A.toast(message || "Đã copy.", "success"))
      .catch(() => A.toast("Chưa copy được — hãy chọn và copy thủ công.", "error"));
  }

  const APP_LINK = "https://guong.tonyhung.workers.dev/";

  function inviteSubject(project) {
    return `Mời bạn vào dự án ${project.name} trên GUỒNG`;
  }

  function inviteText(project, member) {
    const name = member && member.name ? member.name : "bạn";
    return [
      `Chào ${name},`,
      "",
      `Mình mời bạn vào dự án “${project.name}” trên GUỒNG — nơi cả nhóm theo dõi việc và báo cáo trong cùng một màn hình.`,
      "",
      "Làm 3 bước là vào được:",
      `1) Mở link: ${APP_LINK}`,
      "2) Bấm “Đăng nhập Google” và chọn đúng email này — không cần tạo mật khẩu.",
      `3) Vào mục Đội ngũ → bấm “Tham gia bằng mã” → nhập: ${project.joinCode}`,
      "",
      "Mẹo: sau khi đăng nhập, bấm “Cài đặt” để thêm GUỒNG ra màn hình chính, mở nhanh như app điện thoại.",
      "",
      "Cần gì cứ nhắn mình nhé.",
    ].join("\n");
  }

  function openInvite(projectId, memberId) {
    const project = A.projectById(projectId) || A.activeProject();
    if (!project) {
      A.toast("Chưa có dự án để mời.", "error");
      return;
    }
    const member = memberId ? A.memberById(memberId) : null;
    const email = member ? member.email || "" : "";
    const html = `<form class="modal modal-narrow project-invite" id="inviteForm" data-project-id="${esc(project.id)}" data-member-id="${esc(member ? member.id : "")}" role="dialog" aria-modal="true" aria-labelledby="inviteTitle">
      <div class="modal-head">
        <div>
          <div class="modal-eyebrow">${icon("send")} Lời mời dự án</div>
          <div class="modal-title" id="inviteTitle">Mời vào “${esc(project.name)}”</div>
          <div class="modal-sub">Gửi email kèm mã tham gia riêng của dự án.</div>
        </div>
        <button class="icon-btn modal-close" type="button" data-close-overlay aria-label="Đóng">${icon("x")}</button>
      </div>
      <div class="modal-body">
        <div class="invite-code">
          <span>MÃ THAM GIA DỰ ÁN</span>
          <strong>${esc(project.joinCode)}</strong>
          <button class="btn btn-ghost btn-sm" type="button" data-invite-action="copy-code">${icon("copy")} Copy mã</button>
        </div>
        <div class="field" style="margin-top:14px">
          <label class="f-label" for="inviteEmail">Email người nhận</label>
          <input class="input" id="inviteEmail" name="email" type="email" value="${esc(email)}" maxlength="120" placeholder="ten@congty.com" autocomplete="email">
        </div>
        <div class="field" style="margin-top:12px">
          <label class="f-label" for="invitePreview">Nội dung lời mời</label>
          <textarea class="input invite-preview" id="invitePreview" rows="11" readonly>${esc(inviteText(project, member))}</textarea>
        </div>
        <div class="settings-note" style="margin-top:12px">${icon("spark")}<span>Thư mời soạn sẵn 3 bước: mở link, đăng nhập Google, nhập mã ở mục Đội ngũ. Mã tham gia là duy nhất cho từng dự án.</span></div>
      </div>
      <div class="modal-foot">
        <span class="foot-note">Chưa gửi gì cho đến khi bạn bấm gửi trong ứng dụng email.</span>
        <div class="foot-right">
          <button class="btn btn-ghost" type="button" data-invite-action="copy">${icon("copy")} Copy lời mời</button>
          <button class="btn btn-ghost" type="button" data-invite-action="gmail">${icon("send")} Soạn Gmail</button>
          <button class="btn btn-accent" type="submit">${icon("send")} Mở email</button>
        </div>
      </div>
    </form>`;
    A.openOverlay(html, { focus: "#inviteEmail" });
  }

  function openJoinProject() {
    if (!A.account) {
      A.toast("Đăng nhập Google trước để tham gia dự án.", "info");
      if (A.openAccount) A.openAccount();
      return;
    }
    const html = `<form class="modal modal-narrow" id="joinForm" role="dialog" aria-modal="true" aria-labelledby="joinTitle">
      <div class="modal-head">
        <div>
          <div class="modal-eyebrow">${icon("users")} Tham gia dự án</div>
          <div class="modal-title" id="joinTitle">Nhập mã tham gia</div>
          <div class="modal-sub">Mã do người mời gửi, dạng G-XXXXXX.</div>
        </div>
        <button class="icon-btn modal-close" type="button" data-close-overlay aria-label="Đóng">${icon("x")}</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label class="f-label" for="joinCode">Mã dự án</label>
          <input class="input" id="joinCode" name="code" placeholder="G-ABC123" maxlength="20" autocomplete="off" required>
        </div>
        <div class="settings-note" style="margin-top:12px">${icon("spark")}<span>Trưởng dự án nhận thông báo và xác nhận bạn vào dự án. Khi được duyệt, dự án nằm ở mục “Dự án đang theo dõi”; nếu được bổ nhiệm làm người giao việc, bạn có thể giao việc và chấm hoàn thành cho đội ngay trong dự án.</span></div>
      </div>
      <div class="modal-foot">
        <span class="foot-note">Mã dùng một lần cho mỗi tài khoản Google.</span>
        <div class="foot-right">
          <button class="btn btn-ghost" type="button" data-close-overlay>Đóng</button>
          <button class="btn btn-accent" type="submit">${icon("send")} Gửi yêu cầu tham gia</button>
        </div>
      </div>
    </form>`;
    A.openOverlay(html, { focus: "#joinCode" });
  }

  function sharedTaskRow(task, memberName, mine, opts) {
    const o = opts || {};
    const canAssign = !!o.canAssign;
    const canEdit = canAssign || (mine && task.assignee === o.meId);
    const late = task.status !== "done" && task.due && task.due < A.todayISO();
    const due = task.status === "done"
      ? (task.completedAt ? `Xong ${A.fmtShort(task.completedAt)}` : "Đã xong")
      : task.due
        ? `${late ? "Quá hạn " : "Hạn "}${A.fmtShort(task.due)}`
        : "Chưa hẹn";
    const status = A.STATUS[task.status] ? A.STATUS[task.status].label : task.status;
    const statusControl = canEdit && !(task.status === "done" && !canAssign)
      ? `<select class="select shared-select" data-shared-status="${esc(task.id)}" aria-label="Trạng thái ${esc(task.title)}">
          ${(canAssign ? A.STATUS_ORDER : ["todo", "doing", "review"]).map((s) => `<option value="${s}"${s === task.status ? " selected" : ""}>${esc(A.STATUS[s].label)}</option>`).join("")}
        </select>`
      : `<span class="shared-status s-${esc(task.status)}${late ? " is-late" : ""}">${esc(status)}</span>`;
    const assigneeControl = canAssign
      ? `<select class="select shared-select" data-shared-assignee="${esc(task.id)}" aria-label="Người nhận ${esc(task.title)}">
          <option value=""${!task.assignee ? " selected" : ""}>Chưa giao</option>
          ${(o.members || []).map((m) => `<option value="${esc(m.id)}"${m.id === task.assignee ? " selected" : ""}>${esc(m.name)}</option>`).join("")}
        </select>`
      : "";
    return `<div class="shared-row${task.status === "done" ? " is-done" : ""}${mine ? " is-mine" : ""}">
      <div class="shared-main">
        <strong>${esc(task.title)}</strong>
        <span>${esc(memberName)} · ${esc(due)}${mine ? " · Bạn" : ""}</span>
      </div>
      ${assigneeControl || statusControl ? `<div class="shared-controls">${assigneeControl}${statusControl}</div>` : `<span class="shared-status s-${esc(task.status)}${late ? " is-late" : ""}">${esc(status)}</span>`}
    </div>`;
  }

  function sharedCreateForm(data) {
    const members = data.members || [];
    return `<form class="shared-create" data-shared-create>
      <div class="sc-head">${icon("send")}<span>Giao việc cho đội</span><em>Việc mới vào cột Chưa làm</em></div>
      <div class="sc-grid">
        <label class="sc-title"><span>Tên việc</span><input class="input" name="title" maxlength="200" placeholder="Ví dụ: Chốt bảng giá gói tháng" autocomplete="off" required></label>
        <label><span>Giao cho</span>
          <select class="select" name="assignee">
            <option value="">Chưa giao</option>
            ${members.map((m) => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join("")}
          </select>
        </label>
        <label><span>Hạn</span><input class="input" type="date" name="due"></label>
        <label><span>Ưu tiên</span>
          <select class="select" name="priority">
            <option value="high">Cao</option>
            <option value="med" selected>Vừa</option>
            <option value="low">Thấp</option>
          </select>
        </label>
      </div>
      <button class="btn btn-accent btn-sm" type="submit">${icon("plus")} Giao việc</button>
    </form>`;
  }

  function sharedProjectBody(data) {
    const tasks = data.tasks || [];
    const members = data.members || [];
    const canAssign = Boolean(data.me && data.me.assigner);
    const meId = data.me ? data.me.id : "";
    const mineTask = (t) => Boolean(meId && t.assignee === meId);
    const done = tasks.filter((t) => t.status === "done").length;
    const overdue = tasks.filter((t) => t.status !== "done" && t.due && t.due < A.todayISO()).length;
    const nameOf = (id) => (members.find((m) => m.id === id) || {}).name || "Chưa giao";
    const sorted = tasks.slice().sort((a, b) => {
      const doneA = a.status === "done" ? 1 : 0;
      const doneB = b.status === "done" ? 1 : 0;
      if (doneA !== doneB) return doneA - doneB;
      return String(a.due || "9999-12-31").localeCompare(String(b.due || "9999-12-31"));
    });
    const licenseNote = data.license
      ? `Bạn xem dự án này ${data.license.expired ? "đã hết hạn" : `còn ${data.license.daysLeft} ngày`}.`
      : "Trưởng dự án chưa đặt thời hạn cho bạn.";
    const assignerNames = (data.assigners || []).map((x) => x.name).filter(Boolean).join(", ");
    const roleNote = canAssign
      ? `Bạn là người giao việc trong dự án: được giao việc, đổi người nhận và chấm hoàn thành. Bạn không quản lý thành viên hay đóng dự án.${data.me && data.me.role ? ` Vai trò: ${data.me.role} · năng lực ${data.me.capacity} việc/tuần.` : ""}`
      : data.me && data.me.role
        ? `Vai trò của bạn: ${data.me.role} · năng lực ${data.me.capacity} việc/tuần.${assignerNames ? ` Người giao việc: ${assignerNames}.` : ""}`
        : assignerNames
          ? `Người giao việc: ${assignerNames}.`
          : "";
    const mineCount = meId ? tasks.filter((t) => t.assignee === meId).length : 0;
    const opts = { canAssign, meId, members };
    return `${canAssign ? sharedCreateForm(data) : ""}
      <div class="shared-stats">
        <div class="shared-stat"><b>${tasks.length}</b><span>việc</span></div>
        <div class="shared-stat"><b>${tasks.length - done}</b><span>đang mở</span></div>
        <div class="shared-stat${overdue ? " is-late" : ""}"><b>${overdue}</b><span>quá hạn</span></div>
        <div class="shared-stat${meId ? " is-mine" : ""}"><b>${meId ? mineCount : members.length}</b><span>${meId ? "việc của bạn" : "thành viên"}</span></div>
      </div>
      <div class="settings-note" style="margin-top:12px">${icon("alert")}<span>${esc(roleNote + licenseNote)}</span></div>
      ${sorted.length
        ? `<div class="shared-list">${sorted.map((task) => sharedTaskRow(task, nameOf(task.assignee), mineTask(task), opts)).join("")}</div>`
        : `<div class="lic-empty">${icon("layers")}<span>Dự án chưa có việc nào.${canAssign ? " Giao việc đầu tiên ở khung phía trên." : ""}</span></div>`}`;
  }

  function openSharedProject(owner, projectId) {
    if (!owner || !projectId) return;
    const entry = A.joinedProjects().find((x) => x.owner === owner && x.projectId === projectId);
    const html = `<div class="modal account-modal shared-modal" role="dialog" aria-modal="true" aria-labelledby="sharedTitle">
      <div class="modal-head">
        <div>
          <div class="modal-eyebrow">${icon("layers")} Dự án đang theo dõi</div>
          <div class="modal-title" id="sharedTitle">${esc(entry ? entry.projectName : "Dự án được mời")}</div>
          <div class="modal-sub" data-shared-sub>Đang tải bảng việc…</div>
        </div>
        <button class="icon-btn modal-close" type="button" data-close-overlay aria-label="Đóng">${icon("x")}</button>
      </div>
      <div class="modal-body" data-shared-body>
        <div class="lic-empty">${icon("refresh")}<span>Đang tải…</span></div>
      </div>
      <div class="modal-foot">
        <span class="foot-note" data-shared-footnote>Chế độ chỉ xem — trưởng dự án giữ quyền sửa.</span>
        <div class="foot-right">
          <button class="btn btn-ghost" type="button" data-leave-current="${esc(owner)}|${esc(projectId)}">Rời dự án</button>
          <button class="btn btn-ghost" type="button" data-shared-refresh>${icon("refresh")} Làm mới</button>
          <button class="btn btn-ghost" type="button" data-close-overlay>Đóng</button>
        </div>
      </div>
    </div>`;
    const overlay = A.openOverlay(html, { className: "account-overlay" });
    if (!overlay) return;
    const body = overlay.querySelector("[data-shared-body]");
    const sub = overlay.querySelector("[data-shared-sub]");
    const footnote = overlay.querySelector("[data-shared-footnote]");
    const load = async () => {
      A._sharedCtx = null;
      body.innerHTML = `<div class="lic-empty">${icon("refresh")}<span>Đang tải…</span></div>`;
      try {
        const data = await apiJson(`/api/project/view?owner=${encodeURIComponent(owner)}&projectId=${encodeURIComponent(projectId)}`);
        if (entry && entry.status !== "joined") {
          A.setJoinedStatus(owner, projectId, "joined");
          A.render({ animate: false });
        }
        A._sharedCtx = { owner, projectId, data };
        sub.textContent = `Trưởng dự án: ${data.owner.name} · cập nhật ${A.timeAgo(data.updatedAt)}`;
        if (footnote) {
          footnote.textContent = data.me && data.me.assigner
            ? "Bạn là người giao việc — không quản lý thành viên hay đóng dự án."
            : data.me
              ? "Bạn cập nhật trạng thái việc của mình; người giao việc chấm hoàn thành."
              : "Chế độ chỉ xem.";
        }
        body.innerHTML = sharedProjectBody(data);
      } catch (err) {
        sub.textContent = "Chưa tải được dự án";
        const joinPending = err.data && err.data.code === "join_pending";
        const expired = err.data && err.data.code === "license_expired";
        const locked = expired && err.data.license && err.data.license.plan === "locked";
        const removed = err.status === 403 && !expired && !joinPending;
        const message = joinPending
          ? "Yêu cầu tham gia đã gửi tới trưởng dự án. Khi họ xác nhận, vai trò và việc được giao sẽ hiện ở đây."
          : expired
            ? locked
              ? "Trưởng dự án đã tạm khoá quyền xem của bạn. Gửi yêu cầu để được mở lại."
              : "Thời hạn xem dự án đã hết. Gửi yêu cầu để trưởng dự án gia hạn."
            : removed
              ? "Bạn không còn trong danh sách thành viên. Xin mã tham gia mới từ trưởng dự án để xem lại."
              : err.status === 404
                ? "Trưởng dự án chưa đồng bộ bảng việc, hoặc dự án đã đổi mã."
                : err.message;
        const pending = expired && err.data ? err.data.request : null;
        const lockTitle = joinPending
          ? "Đang chờ trưởng dự án xác nhận"
          : locked
            ? "Quyền xem đang bị tạm khoá"
            : expired
              ? "Quyền xem đã hết hạn"
              : removed
                ? "Không còn trong dự án"
                : "Chưa mở được dự án";
        const lockIcon = joinPending ? "clock" : locked ? "pause" : expired ? "clock" : removed ? "users" : "alert";
        body.innerHTML = `<div class="shared-lock">
          <span class="shared-lock-ico">${icon(lockIcon)}</span>
          <strong>${esc(lockTitle)}</strong>
          <p>${esc(message)}</p>
          ${joinPending
            ? `<div class="shared-req-state">${icon("clock")} Đã gửi ${esc(A.timeAgo(err.data.requestedAt))} — bấm “Làm mới” để kiểm tra.</div>`
            : pending
              ? `<div class="shared-req-state">${icon("bell")} Đã gửi yêu cầu ${esc(A.timeAgo(pending.createdAt))} — chờ trưởng dự án phản hồi.</div>`
              : expired
                ? `<form class="shared-request" data-request-form data-owner="${esc(owner)}" data-project="${esc(projectId)}">
                    <label class="f-label" for="requestNote">Lời nhắn cho trưởng dự án (không bắt buộc)</label>
                    <textarea class="input" id="requestNote" name="note" rows="2" maxlength="240" placeholder="Ví dụ: em cần xem thêm 2 tuần để chốt báo cáo."></textarea>
                    <button class="btn btn-accent" type="submit">${icon("bell")} Gửi yêu cầu gia hạn</button>
                  </form>`
                : ""}
        </div>`;
      }
    };
    overlay.querySelector("[data-shared-refresh]").addEventListener("click", load);
    const leaveBtn = overlay.querySelector("[data-leave-current]");
    if (leaveBtn) {
      leaveBtn.addEventListener("click", () => {
        const [leaveOwner, leaveProject] = String(leaveBtn.dataset.leaveCurrent || "").split("|");
        const name = entry ? entry.projectName : "dự án này";
        if (!window.confirm(`Rời dự án “${name}”? Bạn cần mã tham gia để vào lại.`)) return;
        A.closeOverlay(overlay);
        leaveSharedProject(leaveOwner, leaveProject);
      });
    }
    body.addEventListener("submit", async (event) => {
      const form = event.target.closest("[data-request-form]");
      if (!form) return;
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      try {
        const data = await apiJson("/api/projects/request", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            owner: form.dataset.owner,
            projectId: form.dataset.project,
            note: String(form.elements.note.value || "").trim(),
          }),
        });
        form.outerHTML = `<div class="shared-req-state">${icon("bell")} Đã gửi yêu cầu ${esc(A.timeAgo(data.request.createdAt))} — chờ trưởng dự án phản hồi.</div>`;
        A.toast("Đã gửi yêu cầu gia hạn tới trưởng dự án.", "success");
      } catch (err) {
        if (submit) submit.disabled = false;
        A.toast(err.message || "Chưa gửi được yêu cầu.", "error");
      }
    });

    body.addEventListener("submit", async (event) => {
      const form = event.target.closest("[data-shared-create]");
      if (!form) return;
      event.preventDefault();
      const ctx = A._sharedCtx;
      if (!ctx) return;
      const title = String(form.elements.title.value || "").trim();
      if (!title) {
        form.elements.title.focus();
        return;
      }
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      try {
        await apiJson("/api/project/task", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            owner: ctx.owner,
            projectId: ctx.projectId,
            title,
            assignee: form.elements.assignee.value || null,
            due: form.elements.due.value || null,
            priority: form.elements.priority.value || "med",
          }),
        });
        A.toast(`Đã giao việc «${title}».`, "success");
        const scroll = body.scrollTop;
        await load();
        body.scrollTop = scroll;
      } catch (err) {
        if (submit) submit.disabled = false;
        A.toast(err.message || "Chưa giao được việc.", "error");
      }
    });

    body.addEventListener("change", async (event) => {
      const statusEl = event.target.closest("[data-shared-status]");
      const assigneeEl = event.target.closest("[data-shared-assignee]");
      if (!statusEl && !assigneeEl) return;
      const ctx = A._sharedCtx;
      if (!ctx) return;
      const taskId = statusEl ? statusEl.dataset.sharedStatus : assigneeEl.dataset.sharedAssignee;
      const el = statusEl || assigneeEl;
      el.disabled = true;
      try {
        if (statusEl) {
          await apiJson("/api/project/status", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ owner: ctx.owner, projectId: ctx.projectId, taskId, status: statusEl.value }),
          });
        } else {
          await apiJson("/api/project/task", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ owner: ctx.owner, projectId: ctx.projectId, taskId, assignee: assigneeEl.value || null }),
          });
        }
        const scroll = body.scrollTop;
        await load();
        body.scrollTop = scroll;
      } catch (err) {
        el.disabled = false;
        A.toast(err.message || "Chưa cập nhật được.", "error");
      }
    });
    load();
  }
  A.openSharedProject = openSharedProject;

  async function leaveSharedProject(owner, projectId) {
    A.removeJoinedProject(owner, projectId);
    A.render({ animate: false });
    try {
      await apiJson(`/api/projects/leave?owner=${encodeURIComponent(owner)}&projectId=${encodeURIComponent(projectId)}`, { method: "DELETE" });
    } catch (err) {
      /* vẫn gỡ khỏi máy này; máy chủ dọn khi có mạng */
    }
    A.toast("Đã rời dự án khỏi danh sách theo dõi.", "info");
  }

  async function joinProject(code) {
    return apiJson("/api/projects/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
  }

  function openProjectForm() {
    const html = `<form class="modal modal-narrow" id="projectForm" role="dialog" aria-modal="true" aria-labelledby="projectTitle">
      <div class="modal-head">
        <div>
          <div class="modal-eyebrow">${icon("layers")} Dự án mới</div>
          <div class="modal-title" id="projectTitle">Đặt tên dự án</div>
          <div class="modal-sub">Mỗi dự án có một mã tham gia riêng để mời người liên quan.</div>
        </div>
        <button class="icon-btn modal-close" type="button" data-close-overlay aria-label="Đóng">${icon("x")}</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label class="f-label" for="projectTitleInput">Tên dự án</label>
          <input class="input" id="projectTitleInput" name="projectName" maxlength="80" placeholder="Ví dụ: Ra mắt cửa hàng quận 3" autocomplete="off">
        </div>
        <div class="settings-note" style="margin-top:14px">${icon("spark")}<span>Mã tham gia được tạo tự động sau khi lưu. Bạn có thể copy mã và gửi lời mời qua email ngay sau đó.</span></div>
      </div>
      <div class="modal-foot">
        <span class="foot-note">Dự án mới trở thành dự án đang chọn.</span>
        <div class="foot-right">
          <button class="btn btn-ghost" type="button" data-close-overlay>Huỷ</button>
          <button class="btn btn-accent" type="submit">${icon("check")} Tạo dự án</button>
        </div>
      </div>
    </form>`;
    A.openOverlay(html, { focus: "#projectTitleInput" });
  }

  function updateMemberPreview() {
    const form = document.getElementById("memberForm");
    if (!form) return;
    const name = String(form.elements.name.value || "").trim();
    const role = String(form.elements.role.value || "").trim();
    const capacity = A.clamp(Math.round(Number(form.elements.capacity.value) || 8), 1, 40);
    const color = form.elements.color.value;
    const avatar = form.querySelector("[data-member-preview-avatar]");
    const nameEl = form.querySelector("[data-member-preview-name]");
    const roleEl = form.querySelector("[data-member-preview-role]");
    if (avatar) {
      avatar.textContent = memberInitials(name);
      avatar.style.setProperty("--who", color);
    }
    if (nameEl) nameEl.textContent = name || "Tên thành viên";
    if (roleEl) roleEl.textContent = `${role || "Thành viên"} · ${capacity} việc/tuần`;
  }

  function saveMember(event) {
    event.preventDefault();
    const form = event.target;
    const name = String(form.elements.name.value || "").trim().slice(0, 60);
    if (!name) {
      A.toast("Cần nhập tên thành viên.", "error");
      form.elements.name.focus();
      return;
    }
    const role = String(form.elements.role.value || "").trim().slice(0, 60) || "Thành viên";
    const capacityRaw = Number.parseInt(form.elements.capacity.value, 10);
    const capacity = Number.isFinite(capacityRaw) ? A.clamp(capacityRaw, 1, 40) : 8;
    const rawColor = String(form.elements.color.value || "");
    const color = /^#[0-9a-fA-F]{6}$/.test(rawColor) ? rawColor.toUpperCase() : A.memberColors()[0];
    const emailRaw = String(form.elements.email.value || "").trim().toLowerCase().slice(0, 120);
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailRaw) ? emailRaw : "";
    if (emailRaw && !email) {
      A.toast("Email chưa đúng định dạng.", "error");
      form.elements.email.focus();
      return;
    }
    const id = form.dataset.memberId || "";
    const editing = id ? A.memberById(id) : null;
    if (id && !editing) {
      A.toast("Thành viên này không còn tồn tại.", "error");
      return;
    }
    const actor = A.meId();
    if (editing) {
      const emailChanged = editing.email !== email;
      editing.name = name;
      editing.short = memberInitials(name);
      editing.role = role;
      editing.capacity = capacity;
      editing.color = color;
      editing.email = email;
      if (email && (emailChanged || editing.inviteStatus !== "joined")) {
        editing.invitedAt = new Date().toISOString();
        editing.inviteStatus = "invited";
      }
      if (!email) {
        editing.invitedAt = null;
        editing.inviteStatus = "";
      }
      A.log("note", null, actor, `đã cập nhật hồ sơ ${name}`);
      A.toast(email ? "Đã lưu hồ sơ — dùng nút Mời trong thẻ thành viên để gửi email." : "Đã lưu thông tin thành viên.", "success");
    } else {
      const wasEmpty = !A.DATA.members.length;
      const member = {
        id: A.uid("m"),
        name,
        short: memberInitials(name),
        role,
        color,
        capacity,
        email,
        invitedAt: email ? new Date().toISOString() : null,
        inviteStatus: email ? "invited" : "",
      };
      A.DATA.members.push(member);
      if (!A.meId()) A.DATA.settings.ownerId = member.id;
      A.log("add", null, actor, `đã thêm thành viên ${name}`);
      A.toast(email ? `Đã thêm ${name}. Gửi lời mời kèm mã dự án từ thẻ thành viên.` : `Đã thêm ${name} vào tổ.`, "success");
      if (wasEmpty) A.confetti();
    }
    A.closeAllOverlays();
    A.save();
    A.updateShell();
    A.render({ animate: false });
  }

  function requestDeleteMember(memberId) {
    const member = A.memberById(memberId);
    if (!member) return;
    const assigned = A.DATA.tasks.filter((t) => t.assignee === member.id);
    const open = assigned.filter((t) => t.status !== "done");
    const done = assigned.length - open.length;
    const parts = [];
    if (open.length) parts.push(`<b>${open.length} việc đang mở</b>`);
    if (done) parts.push(`${done} việc đã xong`);
    A.confirm({
      title: `Xoá ${member.name} khỏi tổ?`,
      message: assigned.length
        ? `${parts.join(" và ")} sẽ chuyển về “Chưa giao”. Bình luận cũ vẫn được giữ làm dấu vết.`
        : "Thành viên này chưa giữ việc nào. Hồ sơ sẽ bị xoá khỏi thiết bị này.",
      note: "Không thể hoàn tác. Hãy xuất JSON trước nếu cần sao lưu.",
      confirmLabel: "Xoá thành viên",
      danger: true,
    }, () => {
      A.DATA.members = A.DATA.members.filter((m) => m.id !== member.id);
      A.DATA.tasks.forEach((t) => {
        if (t.assignee === member.id) t.assignee = null;
      });
      if (A.DATA.settings.ownerId === member.id) {
        A.DATA.settings.ownerId = A.DATA.members[0] ? A.DATA.members[0].id : null;
      }
      if (A.listFilters.assignee === member.id) A.listFilters.assignee = "all";
      if (A.boardFilters.assignee === member.id) A.boardFilters.assignee = "all";
      A.closeAllOverlays();
      A.save();
      A.updateShell();
      A.render({ animate: false });
      A.toast("Đã xoá thành viên khỏi tổ.", "info");
    });
  }

  function updateOwner(select) {
    const member = A.memberById(select.value);
    if (!member) return;
    A.DATA.settings.ownerId = member.id;
    A.save();
    A.updateShell();
    A.render({ animate: false });
    A.toast(`Đã chọn ${member.name} là “Bạn”.`, "success");
  }

  /* ============================================================
     CÀI ỨNG DỤNG (PWA)
     ============================================================ */
  function isStandalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  }
  async function promptInstall() {
    const prompt = A._installPrompt;
    if (!prompt) {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      A.toast(ios ? "Trên iPhone: mở Safari → Chia sẻ → “Thêm vào Màn hình chính”." : "Mở menu trình duyệt → “Cài đặt ứng dụng” hoặc “Thêm vào màn hình chính”.", "info");
      return;
    }
    prompt.prompt();
    try {
      await prompt.userChoice;
    } catch (err) {
      /* người dùng đóng hộp thoại cài đặt */
    }
    A._installPrompt = null;
  }
  function setupPWA() {
    if ("serviceWorker" in navigator) {
      const secure = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
      if (secure) {
        const register = async () => {
          try {
            const reg = await navigator.serviceWorker.register("./sw.js");
            const hadController = Boolean(navigator.serviceWorker.controller);
            let reloading = false;
            navigator.serviceWorker.addEventListener("controllerchange", () => {
              if (!hadController || reloading) return;
              if (document.querySelector(".overlay")) {
                A.toast("Đã có bản GUỒNG mới. Tải lại trang khi đóng cửa sổ để dùng bản mới.", "info");
                return;
              }
              reloading = true;
              location.reload();
            });
            const check = () => reg.update().catch(() => {});
            setInterval(check, 30 * 60 * 1000);
            window.addEventListener("online", check);
            document.addEventListener("visibilitychange", () => {
              if (document.visibilityState === "visible") check();
            });
          } catch (err) {
            /* PWA không khả dụng — ứng dụng vẫn chạy bình thường */
          }
        };
        if (document.readyState === "complete") register();
        else window.addEventListener("load", register, { once: true });
      }
    }
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      A._installPrompt = event;
    });
    window.addEventListener("appinstalled", () => {
      A._installPrompt = null;
      A.toast("Đã cài GUỒNG lên thiết bị.", "success");
    });
  }

  /* ============================================================
     SETTINGS & DỮ LIỆU
     ============================================================ */
  function openSettings() {
    if (A._overlays.length) A.closeAllOverlays();
    const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const members = A.members();
    const meId = A.meId();
    const installed = isStandalone();
    const ownerSection = members.length
      ? `<select class="select" id="ownerSelect" aria-label="Chọn bạn trong tổ">
          ${members.map((m) => `<option value="${esc(m.id)}"${m.id === meId ? " selected" : ""}>${esc(m.name)} · ${esc(m.role)}</option>`).join("")}
        </select>
        <div class="settings-desc">Việc của bạn được ưu tiên nhẹ trên bảng và nhật ký ghi đúng tên người thao tác.</div>`
      : `<div class="settings-note">${icon("users")}<span>Chưa có thành viên nào. Thêm người vào tổ để chọn “Bạn” và bắt đầu giao việc.</span></div>
        <div class="settings-actions"><button class="btn btn-ghost" type="button" data-add-member>${icon("plus")} Thêm thành viên</button></div>`;
    const installSection = installed
      ? `<div class="settings-sec">
          <div class="settings-title">${icon("download")} Cài ứng dụng</div>
          <div class="settings-note">${icon("check-circle")}<span>Bạn đang mở GUỒNG ở chế độ ứng dụng đã cài. Dữ liệu vẫn nằm trên thiết bị này.</span></div>
        </div>`
      : `<div class="settings-sec">
          <div class="settings-title">${icon("download")} Cài ứng dụng</div>
          <div class="settings-desc">Cài GUỒNG lên màn hình chính để mở nhanh và dùng khi mất mạng. Dữ liệu vẫn nằm trên thiết bị này.</div>
          <div class="settings-actions">
            <button class="btn btn-accent" type="button" data-install-app>${icon("download")} Cài ứng dụng</button>
          </div>
          <div class="settings-note">${icon("spark")}<span><b>iPhone / iPad:</b> mở bằng Safari → nút Chia sẻ → “Thêm vào Màn hình chính”.<br><b>Android:</b> menu ⋮ → “Cài đặt ứng dụng” hoặc “Thêm vào màn hình chính”.<br><b>Máy tính:</b> biểu tượng cài đặt trên thanh địa chỉ Chrome / Edge.</span></div>
        </div>`;
    const html = `<div class="modal modal-narrow" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">
      <div class="modal-head">
        <div>
          <div class="modal-eyebrow">${icon("settings")} Cài đặt</div>
          <div class="modal-title" id="settingsTitle">Bàn làm việc của bạn</div>
          <div class="modal-sub">Bạn là ai, giao diện, cài ứng dụng và dữ liệu trên thiết bị này.</div>
        </div>
        <button class="icon-btn modal-close" type="button" data-close-overlay aria-label="Đóng">${icon("x")}</button>
      </div>
      <div class="modal-body">
        <div class="settings-sec">
          <div class="settings-title">${icon("users")} Bạn trong tổ</div>
          ${members.length ? `<label class="f-label" for="ownerSelect" style="margin-top:8px">Chọn tên của bạn</label>` : ""}
          ${ownerSection}
        </div>
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
        ${installSection}
        <div class="settings-sec">
          <div class="settings-title">${icon("download")} Dữ liệu của tổ</div>
          <div class="settings-desc">Dữ liệu chỉ nằm trong trình duyệt này, không tự đồng bộ giữa các máy. Xuất JSON để sao lưu hoặc chuyển sang máy khác.</div>
          <div class="settings-actions">
            <button class="btn btn-ghost" type="button" data-data-action="export-json">${icon("download")} Xuất JSON</button>
            <button class="btn btn-ghost" type="button" data-data-action="export-csv">${icon("download")} Xuất CSV</button>
            <button class="btn btn-ghost" type="button" data-data-action="import-json">${icon("upload")} Nhập JSON</button>
            <button class="btn btn-danger" type="button" data-data-action="reset-all">${icon("trash")} Xoá toàn bộ</button>
          </div>
          <input id="importFile" type="file" accept="application/json,.json" hidden>
          <div class="settings-note">${icon("alert")}<span>Nhập JSON hoặc xoá dữ liệu sẽ thay thế toàn bộ nội dung hiện tại. Hãy xuất bản sao lưu trước.</span></div>
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
          <div class="settings-title">${icon("spark")} Về GUỒNG</div>
          <p class="about-lead">GUỒNG giúp tổ nhóm nhìn rõ việc, giao đúng người và chốt báo cáo trong một chạm — để mỗi ngày bớt việc hơn.</p>
          <p>Thiết kế &amp; xây dựng bởi <strong>Tony Hùng</strong>. Chạy trên Cloudflare Workers, dữ liệu tách riêng theo tài khoản Google.</p>
          <div class="settings-actions">
            <button class="btn btn-ghost" type="button" data-replay-tour>${icon("play")} Xem lại hướng dẫn</button>
          </div>
          <p class="about-ver">GUỒNG v1.2 · Ít việc hơn mỗi ngày.</p>
        </div>
      </div>
      <div class="modal-foot">
        <span class="foot-note">Tên dự án được lưu khi rời ô nhập.</span>
        <div class="foot-right"><button class="btn btn-ink" type="button" data-close-overlay>Xong</button></div>
      </div>
    </div>`;
    A.openOverlay(html, { focus: members.length ? "#ownerSelect" : "#projectName" });
  }
  A.openSettings = openSettings;

  /* ============================================================
     NGƯỜI DÙNG & THỜI HẠN
     ============================================================ */
  const LICENSE_LABEL = { week: "1 tuần", month: "1 tháng", year: "1 năm" };

  async function apiJson(url, options) {
    const res = await fetch(url, Object.assign({ credentials: "same-origin" }, options || {}));
    let data = null;
    try {
      data = await res.json();
    } catch (err) {
      data = null;
    }
    if (!res.ok) {
      const failure = new Error((data && data.error) || `Máy chủ trả về ${res.status}`);
      failure.status = res.status;
      failure.data = data;
      throw failure;
    }
    return data;
  }

  function licenseDate(iso) {
    const dt = iso ? new Date(iso) : null;
    return dt && !Number.isNaN(dt.getTime()) ? A.fmtShort(A.dateISO(dt)) : "—";
  }

  async function refreshLeadRequests() {
    if (!A.account || !A.account.email) {
      A.pendingRequests = 0;
      A.pendingJoins = [];
      A.updateShell();
      return;
    }
    try {
      const [reqData, joinData] = await Promise.all([
        apiJson("/api/projects/requests").catch(() => ({ requests: [] })),
        apiJson("/api/projects/pending").catch(() => ({ joins: [] })),
      ]);
      const joins = joinData.joins || [];
      const previous = Array.isArray(A.pendingJoins) ? A.pendingJoins : [];
      const changed = joins.length !== previous.length;
      A.pendingJoins = joins;
      A.pendingRequests = (reqData.requests || []).length + joins.length;
      A.updateShell();
      if (!joins.length) {
        A._joinsNotified = 0;
      } else if (!A._joinsNotified || joins.length > A._joinsNotified) {
        A._joinsNotified = joins.length;
        A.toast(`${joins.length} người xin tham gia dự án — xác nhận ở trang Đội ngũ.`, "info");
      }
      if (changed && A.view === "team" && !A._overlays.length) A.render({ animate: false });
    } catch (err) {
      A.pendingRequests = 0;
      A.pendingJoins = [];
      A.updateShell();
    }
  }
  A.refreshLeadRequests = refreshLeadRequests;

  A.sharedAlerts = [];
  async function syncJoinedProjects() {
    if (!A.account || !A.account.email) return;
    try {
      const data = await apiJson("/api/projects/joined");
      const local = A.joinedProjects().slice();
      const approved = [];
      const alerts = [];
      (data.projects || []).forEach((p) => {
        const existing = local.find((x) => x.owner === p.owner && x.projectId === p.projectId);
        (p.alerts || []).forEach((task) => {
          if (!task || !task.taskId) return;
          alerts.push({
            ...task,
            owner: p.owner,
            ownerName: p.ownerName,
            projectId: p.projectId,
            projectName: p.projectName,
          });
        });
        if (existing) {
          const wasPending = existing.status === "pending";
          A.addJoinedProject({
            owner: p.owner,
            ownerName: p.ownerName,
            projectId: p.projectId,
            projectName: p.projectName,
            status: wasPending ? "joined" : existing.status,
            joinedAt: p.joinedAt,
            assigner: Boolean(p.assigner),
          });
          if (wasPending) approved.push(p);
        } else {
          A.addJoinedProject({
            owner: p.owner,
            ownerName: p.ownerName,
            projectId: p.projectId,
            projectName: p.projectName,
            status: "joined",
            joinedAt: p.joinedAt,
            assigner: Boolean(p.assigner),
          });
        }
      });
      (data.pending || []).forEach((p) => {
        A.addJoinedProject({
          owner: p.owner,
          ownerName: p.ownerName,
          projectId: p.projectId,
          projectName: p.projectName,
          status: "pending",
          requestedAt: p.requestedAt,
        });
      });
      const waiting = new Set((data.pending || []).map((p) => `${p.owner}|${p.projectId}`));
      local.forEach((item) => {
        if (item.status !== "pending") return;
        if (waiting.has(`${item.owner}|${item.projectId}`)) return;
        if (approved.some((p) => p.owner === item.owner && p.projectId === item.projectId)) return;
        A.setJoinedStatus(item.owner, item.projectId, "declined");
      });
      if (approved.length) {
        A.toast(`Đã được duyệt vào “${approved[0].projectName}”${approved.length > 1 ? ` và ${approved.length - 1} dự án khác` : ""}.`, "success");
        A.render({ animate: false });
      }
      A.sharedAlerts = alerts;
      if (typeof A.refreshNotifications === "function") A.refreshNotifications();
    } catch (err) {
      /* offline — giữ trạng thái đang lưu trên máy */
    }
  }
  A.syncJoinedProjects = syncJoinedProjects;

  async function approveJoinRequest(btn) {
    const card = btn.closest("[data-join-email]");
    if (!card) return;
    const email = card.dataset.joinEmail;
    const join = (A.pendingJoins || []).find((j) => j.email === email) || {};
    const roleInput = card.querySelector("[data-join-role]");
    const capacityInput = card.querySelector("[data-join-capacity]");
    const role = roleInput ? roleInput.value.trim().slice(0, 60) : "";
    const capacity = capacityInput ? Math.max(1, Math.min(40, Math.round(Number(capacityInput.value) || 8))) : 8;
    const known = A.members().find((m) => m.email && m.email === email);
    const memberId = known ? known.id : A.uid("m");
    const manager = btn.closest(".user-manager");
    btn.disabled = true;
    try {
      const data = await apiJson("/api/projects/pending", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role, capacity, memberId }),
      });
      const name = (data.member && data.member.name) || join.name || email;
      const member = A.addMemberFromJoin({ id: memberId, email, name, role: role || "Thành viên", capacity });
      A.pendingJoins = (A.pendingJoins || []).filter((j) => j.email !== email);
      A.pendingRequests = Math.max(0, Number(A.pendingRequests || 0) - 1);
      A.updateShell();
      if (manager) await loadUsers(manager);
      else A.render({ animate: false });
      A.toast(`Đã xác nhận ${name} · ${role || "Thành viên"} · ${capacity} việc/tuần.`, "success");
      if (member) {
        const memberName = member.name;
        const memberId = member.id;
        A.confirm({
          title: `Đã thêm ${memberName} vào tổ`,
          message: `Vai trò <b>${esc(role || member.role)}</b> · năng lực <b>${capacity} việc/tuần</b>. Giao việc đầu tiên cho ${esc(memberName)} ngay?`,
          confirmLabel: "Giao việc ngay",
          cancelLabel: "Để sau",
          danger: false,
        }, () => A.openTask(null, { assignee: memberId }));
      }
    } catch (err) {
      btn.disabled = false;
      A.toast(err.message || "Chưa xác nhận được người này.", "error");
    }
  }

  async function declineJoinRequest(btn) {
    const card = btn.closest("[data-join-email]");
    if (!card) return;
    const email = card.dataset.joinEmail;
    const join = (A.pendingJoins || []).find((j) => j.email === email) || {};
    const name = join.name || email;
    if (!window.confirm(`Từ chối ${name} tham gia dự án? Họ có thể gửi lại mã nếu cần.`)) return;
    const manager = btn.closest(".user-manager");
    btn.disabled = true;
    try {
      await apiJson(`/api/projects/pending?email=${encodeURIComponent(email)}`, { method: "DELETE" });
      A.pendingJoins = (A.pendingJoins || []).filter((j) => j.email !== email);
      A.pendingRequests = Math.max(0, Number(A.pendingRequests || 0) - 1);
      A.updateShell();
      if (manager) await loadUsers(manager);
      else A.render({ animate: false });
      A.toast(`Đã từ chối ${name}.`, "info");
    } catch (err) {
      btn.disabled = false;
      A.toast(err.message || "Chưa từ chối được.", "error");
    }
  }

  function userRow(user) {
    const license = user.license || null;
    const days = license ? license.daysLeft : null;
    const locked = Boolean(license && license.plan === "locked");
    const state = !license ? "none" : license.expired ? "off" : days <= 7 ? "warn" : "ok";
    const status = !license
      ? "Chưa đặt hạn — xem không giới hạn"
      : locked
        ? "Đang bị khoá quyền xem"
        : license.expired
          ? `Đã hết hạn ${licenseDate(license.expiresAt)}`
          : `Còn ${days} ngày · đến ${licenseDate(license.expiresAt)}`;
    const projects = (user.projects || []).map((p) => `<span class="um-chip${(user.assignerProjects || []).includes(p.id) ? " is-role" : ""}">${esc(p.name)}</span>`).join("");
    const seen = user.lastSeen ? A.timeAgo(user.lastSeen) : "vừa tham gia";
    const request = user.request;
    const requestLine = request
      ? `<div class="um-req-line">${icon("bell")} Xin gia hạn${request.projectName ? ` “${esc(request.projectName)}”` : ""} · ${esc(A.timeAgo(request.createdAt))}${request.note ? ` · “${esc(request.note)}”` : ""}</div>`
      : "";
    const roleButtons = (user.projects || []).map((p) => {
      const on = (user.assignerProjects || []).includes(p.id);
      return `<button class="um-role-toggle${on ? " on" : ""}" type="button" data-um-assigner="${esc(user.email)}" data-project="${esc(p.id)}" data-on="${on ? 1 : 0}" title="${on ? "Bãi miễn người giao việc" : "Bổ nhiệm người giao việc"}">${icon(on ? "check" : "plus")} ${on ? "Đang giao việc" : "Bổ nhiệm giao việc"} · ${esc(p.name)}</button>`;
    }).join("");
    return `<div class="lic-row">
      <span class="lic-state ${state === "none" ? "" : state}" aria-hidden="true"></span>
      <div class="lic-main">
        <strong>${esc(user.name || user.email)}</strong>
        <span>${esc(user.email)} · xem lần cuối ${esc(seen)} · tham gia ${esc(licenseDate(user.joinedAt))}</span>
        <em class="${state}">${esc(status)}</em>
        ${requestLine}
        <div class="um-chips">${projects}</div>
        ${roleButtons ? `<div class="um-roles"><span class="um-roles-label">${icon("send")} Người giao việc</span>${roleButtons}</div>` : ""}
      </div>
      <div class="lic-acts">
        <select class="select lic-days" data-lic-days="${esc(user.email)}" aria-label="Thời hạn cấp thêm">
          <option value="7">+1 tuần</option>
          <option value="30" selected>+1 tháng</option>
          <option value="365">+1 năm</option>
        </select>
        <button class="btn ${request ? "btn-accent" : "btn-ghost"} btn-sm" type="button" data-um-grant="${esc(user.email)}">${icon("refresh")} ${license ? "Gia hạn" : "Cấp hạn"}</button>
        ${license && !license.expired ? `<button class="icon-btn lic-del" type="button" data-um-lock="${esc(user.email)}" aria-label="Khoá quyền xem của ${esc(user.email)}" title="Khoá quyền xem">${icon("pause")}</button>` : ""}
        ${license ? `<button class="icon-btn lic-del" type="button" data-um-revoke="${esc(user.email)}" aria-label="Bỏ hạn của ${esc(user.email)}" title="Bỏ hạn">${icon("x")}</button>` : ""}
        <button class="icon-btn lic-del" type="button" data-um-remove="${esc(user.email)}" aria-label="Xoá ${esc(user.email)}" title="Xoá khỏi dự án">${icon("trash")}</button>
      </div>
    </div>`;
  }

  function requestCard(user) {
    const req = user.request;
    return `<article class="um-req-card">
      <div class="um-req-main">
        <strong>${esc(user.name || user.email)}</strong>
        <span>${esc(user.email)}${req.projectName ? ` · ${esc(req.projectName)}` : ""} · ${esc(A.timeAgo(req.createdAt))}</span>
        ${req.note ? `<em>“${esc(req.note)}”</em>` : ""}
      </div>
      <div class="um-req-acts">
        <button class="btn btn-accent btn-sm" type="button" data-um-answer="${esc(user.email)}" data-days="7">+7 ngày</button>
        <button class="btn btn-ghost btn-sm" type="button" data-um-answer="${esc(user.email)}" data-days="30">+30 ngày</button>
        <button class="icon-btn lic-del" type="button" data-um-dismiss="${esc(user.email)}" aria-label="Bỏ yêu cầu của ${esc(user.email)}" title="Bỏ qua yêu cầu">${icon("x")}</button>
      </div>
    </article>`;
  }

  function usersModalHtml(state) {
    const users = state.users || [];
    const requests = users.filter((u) => u.request);
    const pending = state.pending || [];
    const active = users.filter((u) => !u.license || !u.license.expired).length;
    const owner = state.owner || "chưa đăng nhập";
    let body = "";
    if (state.loading) {
      body = `<div class="lic-empty">${icon("refresh")}<span>Đang tải danh sách người tham gia…</span></div>`;
    } else if (state.error) {
      body = `<div class="lic-empty">${icon("alert")}<span>${esc(state.error)}</span></div>`;
    } else if (!users.length) {
      body = `<div class="lic-empty">${icon("users")}<span>Chưa ai tham gia. Gửi mã dự án cho người liên quan — khi họ đăng nhập Google và nhập mã, họ xuất hiện ở đây.</span></div>`;
    } else {
      body = `<div class="lic-list">${users.map(userRow).join("")}</div>`;
    }
    const pendingSection = pending.length
      ? `<div class="um-requests um-joins">
          <div class="um-req-title">${icon("users")} Chờ xác nhận tham gia <span>${pending.length}</span></div>
          ${pending.map((join) => A.joinPendingCard(join)).join("")}
        </div>`
      : "";
    const reqSection = requests.length
      ? `<div class="um-requests">
          <div class="um-req-title">${icon("bell")} Yêu cầu gia hạn <span>${requests.length}</span></div>
          ${requests.map(requestCard).join("")}
        </div>`
      : "";
    return `<div class="modal account-modal user-manager" role="dialog" aria-modal="true" aria-labelledby="usersTitle">
      <div class="modal-head">
        <div>
          <div class="modal-eyebrow">${icon("users")} QUẢN LÝ NGƯỜI DÙNG</div>
          <div class="modal-title" id="usersTitle">Người tham gia dự án</div>
          <div class="modal-sub">${users.length} người · ${active} đang xem được${requests.length ? ` · ${requests.length} yêu cầu gia hạn` : ""}${pending.length ? ` · ${pending.length} người xin tham gia` : ""} · ${esc(owner)}</div>
        </div>
        <button class="icon-btn modal-close" type="button" data-close-overlay aria-label="Đóng">${icon("x")}</button>
      </div>
      <div class="modal-body">
        ${pendingSection}${reqSection}${body}
        <div class="settings-note" style="margin-top:14px">${icon("alert")}<span>Bạn là trưởng dự án: xác nhận người xin tham gia kèm vai trò và năng lực, cấp hoặc gia hạn thời gian xem, khoá khi cần và gỡ người khỏi danh sách. Có thể bổ nhiệm nhiều người giao việc cho từng dự án — họ được giao việc và chấm hoàn thành thay bạn, nhưng không quản lý thành viên hay đóng dự án.</span></div>
      </div>
      <div class="modal-foot">
        <span class="foot-note">Múi giờ tính theo thiết bị này.</span>
        <div class="foot-right">
          <button class="btn btn-ghost" type="button" data-um-refresh>${icon("refresh")} Làm mới</button>
          <button class="btn btn-ghost" type="button" data-close-overlay>Đóng</button>
        </div>
      </div>
    </div>`;
  }

  async function loadUsers(overlay) {
    const owner = A.account ? A.account.email : "";
    overlay.innerHTML = usersModalHtml({ loading: true, owner });
    wireUsers(overlay);
    try {
      const data = await apiJson("/api/users");
      const users = data.users || [];
      const pending = data.pending || [];
      A.pendingJoins = pending;
      A.pendingRequests = users.filter((u) => u.request).length + pending.length;
      A.updateShell();
      overlay.innerHTML = usersModalHtml({ users, pending, owner });
    } catch (err) {
      overlay.innerHTML = usersModalHtml({
        error: err.status === 401 ? "Đăng nhập Google để xem người tham gia dự án của bạn." : err.message,
        owner,
      });
    }
    wireUsers(overlay);
  }

  function wireUsers(overlay) {
    const refresh = overlay.querySelector("[data-um-refresh]");
    if (refresh) refresh.addEventListener("click", () => loadUsers(overlay));

    overlay.querySelectorAll("[data-um-answer]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const email = btn.dataset.umAnswer;
        const days = Number(btn.dataset.days) || 7;
        btn.disabled = true;
        try {
          const data = await apiJson("/api/users/license", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email, days }),
          });
          A.toast(`Đã duyệt yêu cầu: ${LICENSE_LABEL[data.license?.plan] || `${days} ngày`} cho ${email}.`, "success");
          await loadUsers(overlay);
        } catch (err) {
          btn.disabled = false;
          A.toast(err.message, "error");
        }
      });
    });

    overlay.querySelectorAll("[data-um-dismiss]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const email = btn.dataset.umDismiss;
        btn.disabled = true;
        try {
          await apiJson(`/api/projects/requests?email=${encodeURIComponent(email)}`, { method: "DELETE" });
          A.toast(`Đã bỏ yêu cầu của ${email}.`, "info");
          await loadUsers(overlay);
        } catch (err) {
          btn.disabled = false;
          A.toast(err.message, "error");
        }
      });
    });

    overlay.querySelectorAll("[data-um-lock]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const email = btn.dataset.umLock;
        if (!window.confirm(`Khoá quyền xem của ${email}? Họ vẫn ở danh sách và có thể gửi yêu cầu gia hạn.`)) return;
        btn.disabled = true;
        try {
          await apiJson("/api/users/lock", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email }),
          });
          A.toast(`Đã khoá quyền xem của ${email}.`, "info");
          await loadUsers(overlay);
        } catch (err) {
          btn.disabled = false;
          A.toast(err.message, "error");
        }
      });
    });

    overlay.querySelectorAll("[data-um-grant]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const email = btn.dataset.umGrant;
        const select = overlay.querySelector(`[data-lic-days="${email}"]`);
        const days = select ? Number(select.value) || 30 : 30;
        btn.disabled = true;
        try {
          const data = await apiJson("/api/users/license", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email, days }),
          });
          A.toast(`Đã cấp ${LICENSE_LABEL[data.license?.plan] || `${days} ngày`} cho ${email}.`, "success");
          await loadUsers(overlay);
        } catch (err) {
          btn.disabled = false;
          A.toast(err.message, "error");
        }
      });
    });

    overlay.querySelectorAll("[data-um-revoke]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const email = btn.dataset.umRevoke;
        if (!window.confirm(`Bỏ giới hạn thời hạn của ${email}?`)) return;
        try {
          await apiJson(`/api/users/license?email=${encodeURIComponent(email)}`, { method: "DELETE" });
          A.toast(`Đã bỏ thời hạn của ${email}.`, "info");
          await loadUsers(overlay);
        } catch (err) {
          A.toast(err.message, "error");
        }
      });
    });

    overlay.querySelectorAll("[data-um-assigner]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const email = btn.dataset.umAssigner;
        const projectId = btn.dataset.project;
        const enabled = btn.dataset.on !== "1";
        btn.disabled = true;
        try {
          const known = A.members().find((m) => m.email && m.email === email);
          const data = await apiJson("/api/projects/assigner", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email, projectId, enabled, memberId: known ? known.id : "" }),
          });
          const member = data.member || {};
          A.addMemberFromJoin({ id: member.memberId, email, name: member.name, role: member.role, capacity: member.capacity });
          A.render({ animate: false });
          A.toast(
            enabled ? `Đã bổ nhiệm ${member.name || email} làm người giao việc.` : `Đã bãi miễn quyền giao việc của ${member.name || email}.`,
            enabled ? "success" : "info"
          );
          await loadUsers(overlay);
        } catch (err) {
          btn.disabled = false;
          A.toast(err.message || "Chưa đổi được quyền giao việc.", "error");
        }
      });
    });

    overlay.querySelectorAll("[data-um-remove]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const email = btn.dataset.umRemove;
        if (!window.confirm(`Xoá ${email} khỏi danh sách người tham gia? Họ mở lại được nếu còn mã dự án.`)) return;
        try {
          await apiJson(`/api/users/member?email=${encodeURIComponent(email)}`, { method: "DELETE" });
          A.toast(`Đã xoá ${email} khỏi danh sách.`, "info");
          await loadUsers(overlay);
        } catch (err) {
          A.toast(err.message, "error");
        }
      });
    });
  }

  function openUserManager() {
    if (A._overlays.length) A.closeAllOverlays();
    const overlay = A.openOverlay(usersModalHtml({ loading: true }), { className: "account-overlay" });
    if (!overlay) return;
    loadUsers(overlay);
  }
  A.openUserManager = openUserManager;
  A.apiJson = apiJson;

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
          ? { version: 2, settings: A.DATA.settings, members: A.DATA.members, tasks: parsed, activity: [], focus: [], milestones: A.DATA.milestones }
          : parsed;
        const normalized = A.normalizeState(wrapper);
        if (!normalized) throw new Error("bad-shape");
        A.confirm({
          title: "Thay thế dữ liệu hiện tại?",
          message: `Tệp có <b>${normalized.tasks.length} công việc</b> và <b>${normalized.members.length} thành viên</b>. Toàn bộ dữ liệu đang có trên thiết bị này sẽ bị thay thế.`,
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
          A.toast(`Đã nhập ${normalized.tasks.length} công việc và ${normalized.members.length} thành viên.`, "success");
        });
      } catch (err) {
        A.toast("Tệp JSON không đúng định dạng của GUỒNG.", "error");
      }
    };
    reader.onerror = () => A.toast("Không đọc được tệp. Thử lại giúp mình.", "error");
    reader.readAsText(file, "utf-8");
    input.value = "";
  }
  function resetAll() {
    A.confirm({
      title: "Xoá toàn bộ dữ liệu?",
      message: "Mọi thành viên, công việc, bình luận và phiên tập trung trên thiết bị này sẽ bị xoá. Bạn sẽ bắt đầu lại từ một bàn trống.",
      note: "Không thể hoàn tác. Hãy xuất JSON trước nếu muốn giữ dữ liệu.",
      confirmLabel: "Xoá tất cả",
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
      A.toast("Đã xoá toàn bộ dữ liệu. Bàn của bạn đang trống.", "success");
    });
  }
  function updateProjectName(input) {
    const name = String(input.value || "").trim().slice(0, 80);
    if (!name) {
      input.value = A.DATA.settings.projectName;
      A.toast("Tên dự án không được để trống.", "error");
      return;
    }
    if (!A.renameActiveProject(name)) {
      A.DATA.settings.projectName = name;
      A.save();
    }
    A.updateShell();
    A.render({ animate: false });
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

    if (event.target.closest("[data-refresh-joins]")) {
      A.refreshLeadRequests();
      A.toast("Đang làm mới danh sách người xin tham gia.", "info");
      return;
    }
    const approveJoinBtn = event.target.closest("[data-join-approve]");
    if (approveJoinBtn) {
      approveJoinRequest(approveJoinBtn);
      return;
    }
    const declineJoinBtn = event.target.closest("[data-join-decline]");
    if (declineJoinBtn) {
      declineJoinRequest(declineJoinBtn);
      return;
    }
    const addMemberBtn = event.target.closest("[data-add-member]");
    if (addMemberBtn) {
      openMember(null);
      return;
    }
    const editMemberBtn = event.target.closest("[data-edit-member]");
    if (editMemberBtn) {
      openMember(editMemberBtn.dataset.editMember);
      return;
    }
    const inviteMemberBtn = event.target.closest("[data-invite-member]");
    if (inviteMemberBtn) {
      openInvite(A.DATA.settings.activeProjectId, inviteMemberBtn.dataset.inviteMember);
      return;
    }
    if (event.target.closest("[data-manage-members]")) {
      A.openUserManager();
      return;
    }
    if (event.target.closest("[data-add-project]")) {
      openProjectForm();
      return;
    }
    if (event.target.closest("[data-join-project]")) {
      openJoinProject();
      return;
    }
    const openSharedBtn = event.target.closest("[data-open-shared]");
    if (openSharedBtn) {
      const [owner, projectId] = String(openSharedBtn.dataset.openShared || "").split("|");
      openSharedProject(owner, projectId);
      return;
    }
    const leaveSharedBtn = event.target.closest("[data-leave-shared]");
    if (leaveSharedBtn) {
      const [owner, projectId] = String(leaveSharedBtn.dataset.leaveShared || "").split("|");
      const entry = A.joinedProjects().find((x) => x.owner === owner && x.projectId === projectId);
      if (!window.confirm(`Rời dự án “${entry ? entry.projectName : "này"}”? Bạn cần mã tham gia để vào lại.`)) return;
      leaveSharedProject(owner, projectId);
      return;
    }
    const inviteProjectBtn = event.target.closest("[data-invite-project]");
    if (inviteProjectBtn) {
      openInvite(inviteProjectBtn.dataset.inviteProject);
      return;
    }
    const copyCodeBtn = event.target.closest("[data-copy-code]");
    if (copyCodeBtn) {
      copyText(copyCodeBtn.dataset.copyCode, "Đã copy mã tham gia dự án.");
      return;
    }
    const setProjectBtn = event.target.closest("[data-set-project]");
    if (setProjectBtn) {
      const project = A.setProject(setProjectBtn.dataset.setProject);
      if (project) {
        A.render({ animate: false });
        A.toast(`Đang xem dự án “${project.name}”.`, "success");
      }
      return;
    }
    const inviteAction = event.target.closest("[data-invite-action]");
    if (inviteAction) {
      const form = inviteAction.closest("#inviteForm");
      const kind = inviteAction.dataset.inviteAction;
      if (kind === "copy-code" && form) {
        const project = A.projectById(form.dataset.projectId);
        if (project) copyText(project.joinCode, "Đã copy mã tham gia dự án.");
      }
      if (kind === "copy" && form) {
        const preview = form.querySelector("#invitePreview");
        if (preview) copyText(preview.value, "Đã copy lời mời.");
      }
      if (kind === "gmail" && form) {
        const emailInput = form.querySelector("#inviteEmail");
        const email = (emailInput ? emailInput.value : "").trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
          A.toast("Nhập email người nhận trước khi gửi.", "error");
          if (emailInput) emailInput.focus();
          return;
        }
        const project = A.projectById(form.dataset.projectId);
        if (!project) {
          A.toast("Dự án không còn tồn tại.", "error");
          return;
        }
        const member = form.dataset.memberId ? A.memberById(form.dataset.memberId) : null;
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(inviteSubject(project))}&body=${encodeURIComponent(inviteText(project, member))}`;
        window.open(gmailUrl, "_blank", "noopener");
        A.toast("Đã mở Gmail với thư mời soạn sẵn.", "info");
      }
      return;
    }
    const settingsBtn = event.target.closest("[data-open-settings]");
    if (settingsBtn) {
      openSettings();
      return;
    }
    if (event.target.closest("[data-account-login]")) {
      A.openAccount();
      return;
    }
    if (event.target.closest("[data-install-app]")) {
      promptInstall();
      return;
    }

    const colorBtn = event.target.closest("[data-member-color]");
    if (colorBtn) {
      const form = colorBtn.closest("#memberForm");
      if (!form) return;
      form.elements.color.value = colorBtn.dataset.memberColor;
      form.querySelectorAll("[data-member-color]").forEach((btn) => {
        const on = btn === colorBtn;
        btn.classList.toggle("on", on);
        btn.setAttribute("aria-pressed", String(on));
      });
      updateMemberPreview();
      return;
    }

    const memberAction = event.target.closest("[data-member-action]");
    if (memberAction) {
      if (memberAction.dataset.memberAction === "delete-member") {
        const form = memberAction.closest("#memberForm");
        const id = form ? form.dataset.memberId : "";
        if (id) requestDeleteMember(id);
      }
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
      } else if (action === "reset-all") resetAll();
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
    if (el.closest("#memberForm")) {
      updateMemberPreview();
      return;
    }
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
    if (el.id === "ownerSelect") {
      updateOwner(el);
      return;
    }
    if (el.id === "importFile") {
      handleImportFile(el);
    }
  });

  document.addEventListener("submit", (event) => {
    if (event.target.matches("#taskForm")) {
      saveTask(event);
    } else if (event.target.matches("#memberForm")) {
      saveMember(event);
    } else if (event.target.matches("#projectForm")) {
      event.preventDefault();
      const form = event.target;
      const name = String(form.elements.projectName.value || "").trim();
      if (!name) {
        A.toast("Cần đặt tên dự án.", "error");
        form.elements.projectName.focus();
        return;
      }
      const project = A.addProject(name);
      A.closeAllOverlays();
      A.render({ animate: false });
      A.toast(project ? `Đã tạo dự án “${project.name}”. Mã tham gia: ${project.joinCode}` : "Chưa tạo được dự án.", project ? "success" : "error");
      if (project) A.confetti();
    } else if (event.target.matches("#inviteForm")) {
      event.preventDefault();
      const form = event.target;
      const email = String(form.elements.email.value || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        A.toast("Nhập email người nhận trước khi gửi.", "error");
        form.elements.email.focus();
        return;
      }
      const project = A.projectById(form.dataset.projectId);
      if (!project) {
        A.toast("Dự án không còn tồn tại.", "error");
        return;
      }
      const member = form.dataset.memberId ? A.memberById(form.dataset.memberId) : null;
      const subject = inviteSubject(project);
      const body = inviteText(project, member);
      window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      A.toast("Đang mở ứng dụng email với nội dung soạn sẵn.", "info");
    } else if (event.target.matches("#joinForm")) {
      event.preventDefault();
      const form = event.target;
      const code = String(form.elements.code.value || "").trim().toUpperCase();
      if (!code) {
        form.elements.code.focus();
        return;
      }
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      joinProject(code)
        .then((data) => {
          const pending = data.status === "pending";
          A.addJoinedProject({
            owner: data.owner,
            ownerName: data.ownerName,
            projectId: data.project.id,
            projectName: data.project.name,
            status: pending ? "pending" : "joined",
            requestedAt: data.requestedAt || new Date().toISOString(),
          });
          A.closeAllOverlays();
          A.render({ animate: false });
          A.refreshLeadRequests();
          if (pending) {
            A.toast(`Đã gửi yêu cầu tham gia “${data.project.name}” — chờ trưởng dự án xác nhận.`, "info");
          } else {
            A.toast(`Bạn đã ở trong “${data.project.name}”.`, "success");
            openSharedProject(data.owner, data.project.id);
          }
        })
        .catch((err) => {
          if (submit) submit.disabled = false;
          A.toast(err.message || "Chưa tham gia được dự án.", "error");
          form.elements.code.focus();
        });
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
  A.onBoardPulled = function () {
    A.render({ animate: false });
    A.updateShell();
    if (!A._overlays || !A._overlays.length) {
      A.toast("Đội dự án vừa cập nhật bảng việc.", "info");
    }
  };

  function init() {
    A.applyTheme(A.DATA.settings.theme);
    setupPWA();
    if (!A.focus.taskId) {
      const first = A.smartTasks(1)[0];
      A.focus.taskId = first ? first.id : null;
    }
    A.route();
    A.refreshLeadRequests();
    A.syncJoinedProjects();
    A.pullBoard();
    window.addEventListener("guong:account", () => {
      window.setTimeout(() => {
        A.refreshLeadRequests();
        A.syncJoinedProjects();
        A.pullBoard();
      }, 500);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible" || !A.account) return;
      A.refreshLeadRequests();
      A.syncJoinedProjects();
      A.pullBoard();
    });
    window.setInterval(() => {
      if (document.visibilityState !== "visible" || !A.account) return;
      A.refreshLeadRequests();
      A.syncJoinedProjects();
      A.pullBoard();
    }, 60000);
    window.addEventListener("beforeunload", () => A.save());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
