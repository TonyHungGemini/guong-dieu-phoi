/* ============================================================
   GUỒNG — views 2: Bảng việc, Danh sách, Lịch, Đội ngũ, Báo cáo
   ============================================================ */
(function () {
  "use strict";

  const A = window.App;
  const esc = A.esc;
  const icon = A.icon;
  const WD_LONG = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const DOW = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

  function pageHead(eyebrow, title, subtitle, actions, extraClass) {
    return `<div class="page-head${extraClass ? " " + extraClass : ""}">
      <div class="head-main">
        <div class="eyebrow">${eyebrow}</div>
        <h1 class="page-title">${title}</h1>
        <p class="page-sub">${subtitle}</p>
      </div>
      <div class="head-actions">${actions || ""}</div>
    </div>`;
  }

  function opt(value, label, current) {
    return `<option value="${esc(value)}"${String(value) === String(current) ? " selected" : ""}>${esc(label)}</option>`;
  }
  function memberOptions(current, allLabel) {
    return opt("all", allLabel || "Mọi người", current)
      + A.members().map((m) => opt(m.id, m.name, current)).join("")
      + opt("none", "Chưa giao", current);
  }
  function wsOptions(current, allLabel) {
    return opt("all", allLabel || "Mọi mảng", current) + A.workstreams().map((w) => opt(w.id, w.name, current)).join("");
  }
  function priorityOptions(current, allLabel) {
    return opt("all", allLabel || "Mọi ưu tiên", current)
      + opt("high", "Ưu tiên cao", current)
      + opt("med", "Ưu tiên vừa", current)
      + opt("low", "Ưu tiên thấp", current);
  }
  function statusOptions(current, allLabel) {
    return opt("all", allLabel || "Mọi trạng thái", current) + A.STATUS_ORDER.map((s) => opt(s, A.STATUS[s].label, current)).join("");
  }
  function clearBtn(scope) {
    return `<button class="btn btn-ghost btn-sm tool-reset" type="button" data-clear-filters="${scope}">${icon("reset")} Xoá lọc</button>`;
  }

  /* ============================================================
     BOARD
     ============================================================ */
  function boardCard(task) {
    const doneSubs = (task.subtasks || []).filter((s) => s.done).length;
    const totalSubs = (task.subtasks || []).length;
    const comments = (task.comments || []).length;
    return `<article class="kcard${task.status === "done" ? " is-done" : ""}${A.isOverdue(task) ? " is-late" : ""}" draggable="true" data-board-task="${esc(task.id)}" data-open-task="${esc(task.id)}" tabindex="0" role="button" aria-label="Mở công việc: ${esc(task.title)}">
      <div class="kcard-top">
        ${A.wsChip(task.workstream)}
        ${A.pf(task.priority)}
        <span class="kcard-grip" aria-hidden="true">${icon("grip")}</span>
      </div>
      <div class="kcard-title">${esc(task.title)}</div>
      ${totalSubs ? `<div class="kcard-prog"><span class="bar"><i style="width:${Math.round((doneSubs / totalSubs) * 100)}%"></i></span><small>${doneSubs}/${totalSubs}</small></div>` : ""}
      <div class="kcard-foot">
        ${A.assignee(task.assignee)}
        ${A.dueChip(task)}
        ${comments ? `<span class="kcard-notes">${icon("message")}${comments}</span>` : ""}
      </div>
    </article>`;
  }

  A.renderBoard = function () {
    const filters = A.boardFilters;
    const total = A.DATA.tasks.length;
    const filtered = A.filterTasks(A.DATA.tasks, filters);
    const m = A.metrics();
    const active = A.activeFilters("board");
    const head = pageHead(
      `${icon("board")} Kanban · ${m.open} việc mở · ${m.doing} đang làm`,
      "Bảng việc",
      "Kéo một thẻ sang cột khác để đổi trạng thái. Trên mobile, chạm vào thẻ để cập nhật.",
      `<button class="btn btn-accent" type="button" data-new-task>${icon("plus")} Giao việc</button>`
    );
    const tools = `<div class="page-tools page-tools-board">
      <label class="tool-search">
        ${icon("search")}
        <input class="input" type="search" value="${esc(filters.q)}" placeholder="Tìm việc, người, mảng…" data-filter-scope="board" data-filter-key="q" aria-label="Tìm trong bảng việc">
      </label>
      <select class="select tool-select${filters.assignee !== "all" ? " is-set" : ""}" data-filter-scope="board" data-filter-key="assignee" aria-label="Lọc theo người">${memberOptions(filters.assignee)}</select>
      <select class="select tool-select${filters.workstream !== "all" ? " is-set" : ""}" data-filter-scope="board" data-filter-key="workstream" aria-label="Lọc theo mảng">${wsOptions(filters.workstream)}</select>
      <select class="select tool-select${filters.priority !== "all" ? " is-set" : ""}" data-filter-scope="board" data-filter-key="priority" aria-label="Lọc theo ưu tiên">${priorityOptions(filters.priority)}</select>
      ${clearBtn("board")}
      <span class="tool-count"><b>${filtered.length}</b> / ${total} việc${active ? " · đang lọc" : ""}</span>
    </div>`;
    const columns = A.STATUS_ORDER.map((status) => {
      const tasks = A.sortTasks(filtered.filter((t) => t.status === status), "smart");
      return `<section class="kcol" data-status="${status}" data-drop-status="${status}" aria-label="Cột ${esc(A.STATUS[status].label)}">
        <div class="kcol-head">
          <span class="kcol-dot"></span>
          <span class="kcol-title">${esc(A.STATUS[status].label)}</span>
          <span class="kcol-count">${tasks.length}</span>
          <button class="kcol-add" type="button" data-board-add="${status}" title="Thêm việc vào ${esc(A.STATUS[status].label)}" aria-label="Thêm việc vào ${esc(A.STATUS[status].label)}">${icon("plus")}</button>
        </div>
        <div class="kcol-body">
          ${tasks.length ? tasks.map(boardCard).join("") : `<button class="kcol-empty" type="button" data-board-add="${status}">${icon("plus")} ${filters.q || active ? "Không có thẻ khớp lọc" : "Thêm việc đầu tiên"}</button>`}
        </div>
        <button class="kcol-foot" type="button" data-board-add="${status}">${icon("plus")} Thêm việc</button>
      </section>`;
    }).join("");
    return `${head}${tools}<div class="board">${columns}</div>`;
  };

  /* ============================================================
     LIST
     ============================================================ */
  function listRow(task) {
    const meta = [
      A.pf(task.priority),
      A.subcount(task),
      A.commentCount(task),
      A.dueChip(task).replace('class="due ', 'class="due meta-due '),
    ].filter(Boolean).join("");
    return `<div class="lrow${task.status === "done" ? " is-complete" : ""}${A.isOverdue(task) ? " is-late" : ""}">
      ${A.tick(task)}
      <div class="lrow-main">
        <button class="lrow-title" type="button" data-open-task="${esc(task.id)}">${esc(task.title)}</button>
        <div class="lrow-meta">${meta}</div>
      </div>
      <div class="lrow-cell ws">${A.wsChip(task.workstream)}</div>
      <div class="lrow-cell who">${A.assignee(task.assignee)}</div>
      <div class="lrow-cell due-cell">${A.dueChip(task)}</div>
      <div class="lrow-status">
        <select class="select status-select" data-status-task="${esc(task.id)}" data-s="${task.status}" aria-label="Trạng thái của ${esc(task.title)}">
          ${A.STATUS_ORDER.map((s) => `<option value="${s}"${s === task.status ? " selected" : ""}>${esc(A.STATUS[s].label)}</option>`).join("")}
        </select>
      </div>
    </div>`;
  }

  A.renderList = function () {
    const filters = A.listFilters;
    const total = A.DATA.tasks.length;
    const filtered = A.filterTasks(A.DATA.tasks, filters);
    const m = A.metrics();
    const active = A.activeFilters("list");
    const head = pageHead(
      `${icon("list")} Toàn bộ công việc · ${m.open} đang mở`,
      "Danh sách",
      "Một bảng gọn để rà soát mọi việc, đổi trạng thái ngay tại chỗ và không bỏ sót hạn.",
      `<button class="btn btn-accent" type="button" data-new-task>${icon("plus")} Giao việc</button>`
    );
    const tools = `<div class="page-tools page-tools-list">
      <label class="tool-search">
        ${icon("search")}
        <input class="input" type="search" value="${esc(filters.q)}" placeholder="Tìm việc, nhãn, người…" data-filter-scope="list" data-filter-key="q" aria-label="Tìm trong danh sách">
      </label>
      <select class="select tool-select${filters.status !== "all" ? " is-set" : ""}" data-filter-scope="list" data-filter-key="status" aria-label="Lọc trạng thái">${statusOptions(filters.status)}</select>
      <select class="select tool-select${filters.assignee !== "all" ? " is-set" : ""}" data-filter-scope="list" data-filter-key="assignee" aria-label="Lọc người nhận">${memberOptions(filters.assignee)}</select>
      <select class="select tool-select${filters.workstream !== "all" ? " is-set" : ""}" data-filter-scope="list" data-filter-key="workstream" aria-label="Lọc mảng">${wsOptions(filters.workstream)}</select>
      <select class="select tool-select${filters.priority !== "all" ? " is-set" : ""}" data-filter-scope="list" data-filter-key="priority" aria-label="Lọc ưu tiên">${priorityOptions(filters.priority)}</select>
      <span class="tool-sep"></span>
      <select class="select tool-select" data-filter-scope="list" data-filter-key="sort" aria-label="Sắp xếp danh sách">
        ${opt("smart", "Thông minh", filters.sort)}
        ${opt("due", "Hạn gần nhất", filters.sort)}
        ${opt("priority", "Ưu tiên cao", filters.sort)}
        ${opt("new", "Mới tạo", filters.sort)}
        ${opt("title", "Tên A–Z", filters.sort)}
      </select>
      ${clearBtn("list")}
      <span class="tool-count"><b>${filtered.length}</b> / ${total} việc${active ? " · đang lọc" : ""}</span>
    </div>`;
    const summary = `<div class="list-summary"><b>${filtered.length}</b> việc <span class="dot"></span> ${filtered.filter((t) => t.status !== "done").length} đang mở <span class="dot"></span> ${filtered.filter((t) => A.isOverdue(t)).length} quá hạn <span class="dot"></span> ${filtered.filter((t) => t.status === "done").length} đã xong</div>`;
    if (!filtered.length) {
      const empty = total === 0
        ? (A.members().length
          ? A.empty("layers", "Chưa có việc nào", "Bàn đang trống. Tạo việc đầu tiên để bắt đầu giữ nhịp.", `<button class="btn btn-accent btn-sm" type="button" data-new-task>${icon("plus")} Giao việc đầu tiên</button>`)
          : A.empty("users", "Chưa có thành viên nào", "Thêm người vào tổ trước, rồi giao việc đầu tiên cho họ.", `<button class="btn btn-accent btn-sm" type="button" data-go="team">${icon("users")} Thêm thành viên</button>`))
        : A.empty("search", "Không tìm thấy việc nào", "Thử bỏ một vài bộ lọc, hoặc tạo việc mới để bắt đầu.", `<button class="btn btn-ghost btn-sm" type="button" data-clear-filters="list">Xoá bộ lọc</button>`);
      return `${head}${tools}<div style="margin-top:16px">${empty}</div>`;
    }
    const groups = A.STATUS_ORDER.map((status) => {
      let tasks = filtered.filter((t) => t.status === status);
      if (!tasks.length) return "";
      tasks = status === "done"
        ? tasks.slice().sort((a, b) => String(b.completedAt || "").localeCompare(String(a.completedAt || "")))
        : A.sortTasks(tasks, filters.sort);
      return `<section class="lgroup">
        <div class="lgroup-head">
          <span class="kcol-dot" style="background:${A.STATUS[status].dot}"></span>
          <span class="lgroup-title">${esc(A.STATUS[status].label)}</span>
          <span class="lgroup-count">${tasks.length}</span>
          <span class="rule"></span>
          <span class="lgroup-total">${tasks.reduce((sum, t) => sum + (Number(t.estimate) || 0), 0)} giờ ước lượng</span>
        </div>
        <div class="lrows">${tasks.map(listRow).join("")}</div>
      </section>`;
    }).join("");
    return `${head}${tools}${summary}<div class="list-wrap" style="margin-top:10px">${groups}</div>`;
  };

  /* ============================================================
     CALENDAR
     ============================================================ */
  function ensureCal() {
    const now = new Date();
    if (!A.calMonth || typeof A.calMonth.y !== "number" || typeof A.calMonth.m !== "number") {
      A.calMonth = { y: now.getFullYear(), m: now.getMonth() };
    }
    if (!A.parseISO(A.calSelected)) A.calSelected = A.todayISO();
  }

  function calPill(task) {
    const ws = A.wsById(task.workstream);
    const cls = task.status === "done" ? " done" : A.isOverdue(task) ? " late" : "";
    return `<span class="cal-pill${cls}" style="--ws:${esc(ws ? ws.color : "#e14e27")}" title="${esc(task.title)} · ${esc(A.STATUS[task.status].label)}"><span>${esc(task.title)}</span></span>`;
  }

  A.renderCalendar = function () {
    ensureCal();
    const { y, m } = A.calMonth;
    const today = A.todayISO();
    const first = new Date(y, m, 1);
    const lead = (first.getDay() + 6) % 7;
    const gridStart = A.addDays(A.dateISO(first), -lead);
    const tasksByDue = new Map();
    A.DATA.tasks.forEach((t) => {
      if (!t.due) return;
      if (!tasksByDue.has(t.due)) tasksByDue.set(t.due, []);
      tasksByDue.get(t.due).push(t);
    });
    tasksByDue.forEach((tasks, day) => {
      tasksByDue.set(day, tasks.slice().sort((a, b) => {
        if (a.status === "done" && b.status !== "done") return 1;
        if (b.status === "done" && a.status !== "done") return -1;
        return A.taskScore(b) - A.taskScore(a);
      }));
    });
    const msByDate = new Map();
    A.milestones().forEach((ms) => msByDate.set(ms.date, ms));
    const cells = [];
    for (let i = 0; i < 42; i += 1) {
      const day = A.addDays(gridStart, i);
      const dt = A.parseISO(day);
      const inMonth = dt.getMonth() === m;
      const weekend = i % 7 >= 5;
      const tasks = tasksByDue.get(day) || [];
      const ms = msByDate.get(day);
      cells.push(`<div class="cal-cell${inMonth ? "" : " out"}${weekend ? " weekend" : ""}${day === today ? " today" : ""}${day === A.calSelected ? " selected" : ""}" data-cal-day="${day}" role="button" tabindex="0" aria-label="${esc(WD_LONG[dt.getDay()])} ${A.fmtLong(day)}, ${tasks.length} việc">
        <span class="cal-daynum${day === today ? " today" : ""}">${dt.getDate()}</span>
        ${ms ? `<span class="cal-ms-mark" title="Mốc: ${esc(ms.title)}"></span>` : ""}
        <div class="cal-pills">
          ${tasks.slice(0, 3).map(calPill).join("")}
          ${tasks.length > 3 ? `<span class="cal-more">+${tasks.length - 3}</span>` : ""}
        </div>
      </div>`);
    }
    const selectedTasks = (tasksByDue.get(A.calSelected) || []).slice();
    const selectedDate = A.parseISO(A.calSelected) || A.parseISO(today);
    const selectedMs = msByDate.get(A.calSelected);
    const upcoming = A.DATA.tasks
      .filter((t) => t.status !== "done" && t.due && t.due >= today && t.due <= A.addDays(today, 10))
      .sort((a, b) => a.due.localeCompare(b.due) || A.taskScore(b) - A.taskScore(a))
      .slice(0, 6);
    const head = pageHead(
      `${icon("calendar")} ${esc(A.longDateVN(today))} · Tuần ${A.weekNumber(today)}`,
      "Lịch công việc",
      "Nhìn hạn theo tháng, chạm vào một ngày để xem việc và thêm nhanh.",
      `<button class="btn btn-ghost" type="button" data-go="board">${icon("board")} Bảng việc</button>
       <button class="btn btn-accent" type="button" data-new-task data-due="${today}">${icon("plus")} Giao việc</button>`
    );
    const calendar = `<section class="card cal-card">
      <div class="cal-head">
        <div class="cal-title-wrap">
          <span class="cal-title">${esc(A.monthLabel(y, m))}</span>
          <button class="btn btn-ghost cal-today-btn" type="button" data-cal-today>Hôm nay</button>
        </div>
        <div class="cal-nav">
          <button class="icon-btn" type="button" data-cal-nav="-1" aria-label="Tháng trước">${icon("chevron-left")}</button>
          <button class="icon-btn" type="button" data-cal-nav="1" aria-label="Tháng sau">${icon("chevron-right")}</button>
        </div>
      </div>
      <div class="cal-dow">${DOW.map((d, i) => `<span class="${i >= 5 ? "weekend" : ""}">${d}</span>`).join("")}</div>
      <div class="cal-grid">${cells.join("")}</div>
      <div class="cal-legend">
        <span><i style="background:var(--ink);transform:rotate(45deg)"></i> Mốc dự án</span>
        <span><i style="background:var(--accent)"></i> Hôm nay</span>
        <span><i style="background:var(--danger)"></i> Quá hạn</span>
        <span><i style="background:var(--ok)"></i> Đã xong</span>
      </div>
    </section>`;
    const dayPanel = `<section class="card day-panel">
      <div class="day-panel-head">
        <div class="day-panel-date">
          <span class="day-panel-num${A.calSelected === today ? " is-today" : ""}">${selectedDate.getDate()}</span>
          <div>
            <div class="day-panel-wd">${esc(WD_LONG[selectedDate.getDay()])}</div>
            <div class="day-panel-month">${esc(A.monthLabel(selectedDate.getFullYear(), selectedDate.getMonth()))}</div>
          </div>
          <span class="day-panel-count">${selectedTasks.length} việc</span>
        </div>
      </div>
      <div class="day-panel-body">
        ${selectedTasks.length ? selectedTasks.slice(0, 8).map((t) => A.taskLine(t, { compact: true, who: false, due: false, why: A.reasonFor(t) })).join("") : `<div class="day-empty">Ngày này đang trống. Một khoảng thở tốt.</div>`}
      </div>
      ${selectedMs ? `<div class="day-ms-note">${icon("flag")}<span><b>${esc(selectedMs.title)}</b><br>${esc(selectedMs.note)}</span></div>` : ""}
      <div class="day-panel-add">
        <button class="btn btn-ghost btn-sm" type="button" data-new-task data-due="${A.calSelected}">${icon("plus")} Thêm việc ngày này</button>
      </div>
    </section>`;
    const upcomingCard = `<section class="card">
      <div class="card-h">
        <div>
          <div class="card-t">Hạn sắp tới</div>
          <div class="card-sub">10 ngày kế tiếp · ${upcoming.length} việc</div>
        </div>
        <button class="card-link" type="button" data-go="list">Danh sách ${icon("arrow-right")}</button>
      </div>
      ${upcoming.length ? `<div class="report-list">${upcoming.map((t) => `<div class="report-row">
        <div class="main">
          <button class="title" type="button" data-open-task="${esc(t.id)}">${esc(t.title)}</button>
          <div class="sub">${A.assignee(t.assignee)}${A.wsChip(t.workstream)}</div>
        </div>
        ${A.dueChip(t)}
      </div>`).join("")}</div>` : `<div class="report-empty">Không có hạn nào trong 10 ngày tới. Tranh thủ dọn việc tồn.</div>`}
    </section>`;
    return `${head}<div class="cal-layout">${calendar}<aside class="cal-side">${dayPanel}${upcomingCard}</aside></div>`;
  };

  /* ============================================================
     TEAM
     ============================================================ */
  function statCard(label, value, small, sub, iconName) {
    return `<div class="stat-card">
      <div class="stat-label">${icon(iconName)} ${esc(label)}</div>
      <div class="stat-value">${value}${small ? `<small>${esc(small)}</small>` : ""}</div>
      <div class="stat-sub">${esc(sub)}</div>
    </div>`;
  }

  A.renderTeam = function () {
    const m = A.metrics();
    const members = A.members();
    const stats = members.map((x) => A.memberStats(x.id)).filter(Boolean);
    const avgLoad = stats.length ? Math.round(stats.reduce((sum, s) => sum + s.load, 0) / stats.length) : 0;
    const overloaded = stats.filter((s) => s.load > 100);
    const unassigned = A.openTasks().filter((t) => !t.assignee).sort((a, b) => String(a.due || "9999").localeCompare(String(b.due || "9999")));
    const meId = A.meId();
    const head = pageHead(
      `${icon("users")} ${members.length} người · ${m.unassigned} việc chưa giao`,
      "Đội ngũ",
      "Thêm người, chỉnh vai trò và năng lực tuần. Tải vượt 100% là tín hiệu cần san việc.",
      `<button class="btn btn-ghost" type="button" data-go="reports">${icon("chart")} Báo cáo tuần</button>
       <button class="btn btn-accent" type="button" data-add-member>${icon("plus")} Thêm thành viên</button>`
    );

    if (!members.length) {
      const step = (num, title, text) => `<li class="setup-step">
        <span class="setup-dot">${num}</span>
        <div><b>${esc(title)}</b><small>${esc(text)}</small></div>
      </li>`;
      return `${head}<section class="card team-empty">
        <div class="te-main">
          <div class="setup-eyebrow">${icon("spark")} Bắt đầu</div>
          <h2 class="te-title">Bàn đã sẵn.<br><span>Thêm người vào tổ.</span></h2>
          <p class="te-text">Chỉ cần tên và vai trò là có thể giao việc. Năng lực tuần giúp bạn thấy ai đang quá tải trước khi nhận thêm việc.</p>
          <div class="setup-actions">
            <button class="btn btn-accent" type="button" data-add-member>${icon("plus")} Thêm thành viên đầu tiên</button>
            <button class="btn btn-ghost" type="button" data-go="dashboard">${icon("grid")} Về tổng quan</button>
          </div>
        </div>
        <ol class="setup-steps te-steps">
          ${step("1", "Thêm tên & vai trò", "Ví dụ: Lan Hương · Thiết kế")}
          ${step("2", "Đặt năng lực tuần", "Số việc một người giữ thoải mái")}
          ${step("3", "Giao việc đầu tiên", "Chọn người nhận, hạn và ưu tiên")}
        </ol>
      </section>
      <div class="team-foot-note">${icon("alert")} Dữ liệu chỉ nằm trên thiết bị này. Thêm tên không tạo tài khoản đăng nhập cho người khác.</div>`;
    }

    const summary = `<div class="team-summary">
      ${statCard("Quân số", String(members.length), "người", `${m.doing} người đang giữ việc`, "users")}
      ${statCard("Việc đang mở", String(m.open), "việc", `${m.review} việc chờ duyệt`, "layers")}
      ${statCard("Quá hạn", String(m.overdue), "việc", m.overdue ? "Cần chốt sớm trong tuần" : "Không có việc trễ", "alert")}
      ${statCard("Tải trung bình", `${avgLoad}%`, "", overloaded.length ? `${overloaded.length} người đang vượt tải` : "Nhịp tải đang cân", "target")}
    </div>`;
    const cards = `<div class="team-grid">
      ${stats.map((s) => `<article class="member-card${s.load > 100 ? " over" : ""}">
        <div class="mc-head">
          ${A.avatar(s.member, "avatar-lg")}
          <div class="mc-id">
            <div class="mc-name">${esc(s.member.name)}${s.member.id === meId ? `<span class="mc-you">Bạn</span>` : ""}</div>
            <div class="mc-role">${esc(s.member.role)} · năng lực ${s.member.capacity} việc</div>
          </div>
          <div class="mc-head-side">
            <span class="mc-load${s.state === "ok" ? "" : " " + s.state}" title="${s.activeCount} việc mở / ${s.member.capacity} năng lực">${s.load}%</span>
            <button class="icon-btn mc-edit" type="button" data-edit-member="${esc(s.member.id)}" aria-label="Sửa ${esc(s.member.name)}" title="Sửa thành viên">${icon("pencil")}</button>
          </div>
        </div>
        <div class="mc-meter"><i class="${s.state === "ok" ? "" : s.state}" style="width:${Math.min(100, s.load)}%"></i></div>
        <div class="mc-stats">
          <div class="mc-stat"><b>${s.activeCount}</b><small>đang mở</small></div>
          <div class="mc-stat"><b>${s.overdue}</b><small>quá hạn</small></div>
          <div class="mc-stat"><b>${s.doneWeek}</b><small>xong tuần</small></div>
        </div>
        <div class="mc-foot">
          ${s.next ? A.dueChip(s.next) : `<span class="micro">Đã sạch việc</span>`}
          <button class="btn btn-ghost" type="button" data-member-filter="${esc(s.member.id)}">Xem việc ${icon("arrow-right")}</button>
        </div>
      </article>`).join("")}
      <button class="member-add-card" type="button" data-add-member>
        <span class="mac-ico">${icon("plus")}</span>
        <strong>Thêm thành viên</strong>
        <small>Người mới có thể nhận việc ngay sau khi thêm.</small>
      </button>
    </div>`;
    const unassignedCard = unassigned.length ? `<section class="card unassigned-card">
      <div class="card-h">
        <div>
          <div class="card-t">Việc chưa giao người <span class="done-head-num" style="background:var(--accent-soft);color:var(--accent)">${unassigned.length}</span></div>
          <div class="card-sub">Giao đúng người ngay tại đây, không cần mở từng việc.</div>
        </div>
        <button class="card-link" type="button" data-go="board">Bảng việc ${icon("arrow-right")}</button>
      </div>
      <div class="unassigned-list">
        ${unassigned.map((t) => `<div class="unassigned-row">
          <div class="ur-main">
            <button class="ur-title" type="button" data-open-task="${esc(t.id)}">${esc(t.title)}</button>
            <div class="ur-meta">${A.wsChip(t.workstream)}<span class="tl-why">${esc(A.reasonFor(t))}</span></div>
          </div>
          ${A.dueChip(t)}
          <select class="select" data-assign-task="${esc(t.id)}" aria-label="Giao việc cho thành viên">
            <option value="">Giao cho…</option>
            ${members.map((x) => `<option value="${esc(x.id)}">${esc(x.name)} · ${x.capacity} việc</option>`).join("")}
          </select>
        </div>`).join("")}
      </div>
    </section>` : "";
    const note = `<div class="team-foot-note">${icon("spark")} Tải = việc đang mở / năng lực tuần. Khi một người vượt 100%, hãy xem lại thứ tự ưu tiên trước khi giao thêm.</div>`;
    return `${head}${summary}${cards}${unassignedCard}${note}`;
  };

  /* ============================================================
     REPORTS
     ============================================================ */
  A.weeklyReportText = function () {
    const m = A.metrics();
    const weekStart = A.startOfWeek(A.todayISO());
    const weekEnd = A.endOfWeek(A.todayISO());
    const wn = A.weekNumber(A.todayISO());
    const next = A.nextMilestone();
    const doneTasks = A.DATA.tasks.filter((t) => t.status === "done" && t.completedAt && t.completedAt >= weekStart && t.completedAt <= weekEnd);
    const overdue = A.sortTasks(A.metrics().overdueTasks, "due");
    const lines = [];
    lines.push(`GUỒNG — BÁO CÁO TUẦN ${wn}`);
    lines.push(`${A.DATA.settings.projectName} · ${A.fmtShort(weekStart)} – ${A.fmtShort(weekEnd)}/${A.parseISO(weekEnd).getFullYear()}`);
    lines.push("");
    lines.push(`Tổng quan: ${m.done}/${m.total} việc đã xong (${m.rate}%).`);
    lines.push(`• Tuần này hoàn thành: ${m.doneThisWeek} việc (tuần trước: ${m.doneLastWeek}).`);
    lines.push(`• Đang làm: ${m.doing} · Chờ duyệt: ${m.review} · Quá hạn: ${m.overdue}.`);
    lines.push(`• Tập trung: ${m.focusedWeek} phút trong tuần, chuỗi ${A.focusStreak()} ngày.`);
    lines.push("");
    if (doneTasks.length) {
      lines.push("ĐÃ XONG TUẦN NÀY");
      doneTasks.slice(0, 8).forEach((t) => {
        const member = A.memberById(t.assignee);
        lines.push(`- ${t.title}${member ? ` (${member.name})` : ""}`);
      });
      lines.push("");
    }
    if (overdue.length) {
      lines.push("ĐANG QUÁ HẠN");
      overdue.slice(0, 8).forEach((t) => {
        const member = A.memberById(t.assignee);
        const late = Math.max(0, -A.daysFromToday(t.due));
        lines.push(`- ${t.title}${member ? ` (${member.name})` : ""} · trễ ${late} ngày`);
      });
      lines.push("");
    }
    lines.push(`Mốc kế tiếp: ${next ? `${next.title} · ${A.fmtLong(next.date)} (còn ${Math.max(0, next.daysLeft)} ngày)` : "Chưa đặt mốc dự án"}.`);
    lines.push("Nguồn: GUỒNG — dữ liệu lưu trên thiết bị của tổ quản trị.");
    return lines.join("\n");
  };

  A.renderReports = function () {
    const m = A.metrics();
    const today = A.todayISO();
    const weekStart = A.startOfWeek(today);
    const weekEnd = A.endOfWeek(today);
    const wn = A.weekNumber(today);
    const velocity = A.weeklyVelocity(8);
    const maxV = Math.max(1, ...velocity.map((v) => v.value));
    const avg = Math.round(velocity.reduce((sum, v) => sum + v.value, 0) / velocity.length * 10) / 10;
    const compare = m.doneThisWeek - m.doneLastWeek;
    const contrib = A.members().map((x) => A.memberStats(x.id)).filter(Boolean).sort((a, b) => b.doneWeek - a.doneWeek || b.done - a.done);
    const top = contrib[0];
    const maxContrib = Math.max(1, ...contrib.map((s) => s.doneWeek));
    const wsStats = A.workstreams().map((w) => A.wsStats(w.id)).filter(Boolean);
    const overdue = A.sortTasks(m.overdueTasks, "due");
    const doneWeek = A.DATA.tasks.filter((t) => t.status === "done" && t.completedAt && t.completedAt >= weekStart && t.completedAt <= weekEnd)
      .slice().sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
    const next = A.nextMilestone();
    const narrative = `Tuần này tổ hoàn thành <b>${m.doneThisWeek} việc</b>, ${compare > 0 ? `nhiều hơn tuần trước <b>${compare} việc</b>` : compare === 0 ? "ngang nhịp tuần trước" : `ít hơn tuần trước <b>${-compare} việc</b>`}. ${top && top.doneWeek ? `<b>${esc(top.member.name)}</b> dẫn nhịp với ${top.doneWeek} việc xong.` : "Chưa ai gạch việc trong tuần này — bắt đầu từ việc nhỏ nhất."} ${m.overdue ? `Còn <b>${m.overdue} việc quá hạn</b> cần chốt sớm để không dồn sang tuần sau.` : "Không có việc quá hạn — một tuần giữ nhịp rất tốt."}`;
    const banner = `<section class="report-banner">
      <div class="rb-main">
        <div class="rb-eyebrow">${icon("chart")} Báo cáo tuần ${wn} · ${A.fmtShort(weekStart)} – ${A.fmtShort(weekEnd)}</div>
        <h1 class="rb-title">Tuần ${wn},<br><span>${m.doneThisWeek} việc đi về đích.</span></h1>
        <p class="rb-text">${narrative}</p>
      </div>
      <div class="rb-actions">
        <button class="btn btn-solid" type="button" data-copy-report>${icon("copy")} Sao chép báo cáo</button>
        <button class="btn btn-line" type="button" data-print-report>${icon("download")} In / PDF</button>
      </div>
      <span class="rb-week">W${wn}</span>
    </section>`;
    const stats = `<div class="stat-cards">
      ${statCard("Hoàn thành dự án", `${m.rate}%`, "", `${m.done}/${m.total} việc đã xong`, "target")}
      ${statCard("Tốc độ tuần này", String(m.doneThisWeek), "việc", compare > 0 ? `+${compare} so với tuần trước` : compare === 0 ? "Ngang tuần trước" : `${compare} so với tuần trước`, "spark")}
      ${statCard("Thời gian tập trung", String(m.focusedWeek), "phút", `Chuỗi ${A.focusStreak()} ngày liên tiếp`, "clock")}
      ${statCard("Mốc kế tiếp", next ? String(Math.max(0, next.daysLeft)) : "—", next ? "ngày" : "", next ? next.title : "Chưa đặt mốc dự án", "flag")}
    </div>`;
    const velocityCard = `<section class="card rg-velocity">
      <div class="card-h">
        <div>
          <div class="card-t"><span class="card-idx">01</span> Nhịp hoàn thành</div>
          <div class="card-sub">8 tuần gần nhất · tính theo ngày hoàn thành.</div>
        </div>
        <span class="chip chip-line">TB ${avg} việc/tuần</span>
      </div>
      <div class="chart-wrap">
        <div class="chart">
          ${velocity.map((v) => `<div class="chart-col${v.now ? " now" : ""}" title="Tuần ${v.week}: ${v.value} việc">
            <span class="chart-val">${v.value}</span>
            <span class="chart-bar" style="height:${v.value ? Math.max(4, Math.round((v.value / maxV) * 100)) : 2}%"></span>
          </div>`).join("")}
        </div>
        <div class="chart-x">${velocity.map((v) => `<span>${v.label}</span>`).join("")}</div>
      </div>
      <div class="chart-note"><span class="dot"></span> Tuần này <b>${m.doneThisWeek} việc</b> · ${compare > 0 ? "đang nhích lên" : compare === 0 ? "giữ nhịp" : "chậm lại"} so với tuần trước.</div>
    </section>`;
    const streamsCard = `<section class="card rg-streams">
      <div class="card-h">
        <div>
          <div class="card-t"><span class="card-idx">02</span> Sức khỏe các mảng</div>
          <div class="card-sub">Tỉ lệ hoàn thành trên toàn dự án.</div>
        </div>
      </div>
      <div class="ws-report-list">
        ${wsStats.map((s) => `<div class="ws-report-row" style="--ws:${esc(s.ws.color)}">
          <span class="wsr-mark"></span>
          <div class="wsr-main">
            <div class="wsr-top"><span class="wsr-name">${esc(s.ws.name)}</span><span class="wsr-count"><b>${s.done}</b>/${s.total}${s.overdue ? ` · ${s.overdue} trễ` : ""}</span></div>
            <div class="wsr-bar"><i style="width:${s.pct}%"></i></div>
          </div>
          <span class="wsr-pct">${s.pct}%</span>
        </div>`).join("")}
      </div>
    </section>`;
    const contribCard = `<section class="card rg-contrib">
      <div class="card-h">
        <div>
          <div class="card-t"><span class="card-idx">03</span> Đóng góp tuần</div>
          <div class="card-sub">Việc hoàn thành theo người.</div>
        </div>
      </div>
      ${contrib.some((s) => s.doneWeek) ? `<div class="contrib-list">${contrib.map((s, i) => `<div class="contrib-row">
        <span class="contrib-rank">${String(i + 1).padStart(2, "0")}</span>
        <div class="contrib-main">
          <div class="contrib-top"><span class="contrib-name">${esc(s.member.name)}</span><span class="contrib-count">${s.doneWeek} việc</span></div>
          <div class="contrib-bar"><i style="width:${Math.round((s.doneWeek / maxContrib) * 100)}%"></i></div>
        </div>
      </div>`).join("")}</div>` : `<div class="report-empty">Chưa có việc nào được gạch trong tuần. Một việc nhỏ cũng đủ để mở nhịp.</div>`}
      <div class="report-foot">Tính từ ngày hoàn thành, không tính việc mới tạo.</div>
    </section>`;
    const overdueCard = `<section class="card rg-overdue">
      <div class="card-h">
        <div>
          <div class="card-t"><span class="card-idx">04</span> Đang quá hạn</div>
          <div class="card-sub">Cần xử lý trước khi nhận việc mới.</div>
        </div>
        <span class="chip ${overdue.length ? "chip-danger" : "chip-ok"}">${overdue.length}</span>
      </div>
      ${overdue.length ? `<div class="report-list">${overdue.slice(0, 6).map((t) => `<div class="report-row">
        <div class="main">
          <button class="title" type="button" data-open-task="${esc(t.id)}">${esc(t.title)}</button>
          <div class="sub">${A.assignee(t.assignee)}<span>·</span><span>${esc(A.reasonFor(t))}</span></div>
        </div>
        ${A.dueChip(t)}
      </div>`).join("")}</div>` : `<div class="report-empty">Không có việc quá hạn. Đây là chỉ số đáng giữ nhất.</div>`}
    </section>`;
    const doneCard = `<section class="card rg-done">
      <div class="card-h">
        <div>
          <div class="card-t"><span class="card-idx">05</span> Đã xong tuần này</div>
          <div class="card-sub">${doneWeek.length} việc · ghi nhận nỗ lực của tổ.</div>
        </div>
      </div>
      ${doneWeek.length ? `<div class="report-list">${doneWeek.slice(0, 6).map((t) => `<div class="report-row">
        <div class="main">
          <button class="title" type="button" data-open-task="${esc(t.id)}">${esc(t.title)}</button>
          <div class="sub">${A.assignee(t.assignee)}<span>·</span><span>${esc(A.fmtShort(t.completedAt))}</span></div>
        </div>
        <span class="due done">${icon("check")} Xong</span>
      </div>`).join("")}</div>` : `<div class="report-empty">Chưa có việc xong trong tuần. Chọn một việc nhỏ, gạch trước, rồi tính tiếp.</div>`}
      <div class="report-foot">Mốc kế: ${next ? `${esc(next.title)} · ${A.fmtLong(next.date)}` : "Chưa đặt mốc dự án"}.</div>
    </section>`;
    return `${banner}${stats}<div class="report-grid">${velocityCard}${streamsCard}${contribCard}${overdueCard}${doneCard}</div>`;
  };
})();
