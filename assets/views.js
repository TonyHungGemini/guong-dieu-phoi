/* ============================================================
   GUỒNG — views 1: Tổng quan & Hôm nay
   ============================================================ */
(function () {
  "use strict";

  const A = window.App;
  const esc = A.esc;
  const icon = A.icon;

  function pad2(n) {
    return String(n).padStart(2, "0");
  }
  function uniQ(ids) {
    return [...new Set(ids)].length;
  }

  A.taskLine = function (task, options) {
    const o = options || {};
    const meta = [];
    if (!o.compact) meta.push(A.wsChip(task.workstream));
    if (o.why !== false) meta.push(`<span class="tl-why">${esc(o.why || A.reasonFor(task))}</span>`);
    const sub = A.subcount(task);
    if (sub) meta.push(sub);
    if (o.comments) {
      const comments = A.commentCount(task);
      if (comments) meta.push(comments);
    }
    const side = [];
    if (o.who) side.push(A.assignee(task.assignee));
    if (o.due !== false) side.push(A.dueChip(task));
    return `<div class="task-line${A.isOverdue(task) ? " late" : ""}${task.status === "done" ? " is-complete" : ""}">
      ${A.tick(task)}
      <button class="tl-main" type="button" data-open-task="${esc(task.id)}">
        <span class="tl-title">${esc(task.title)}</span>
        <span class="tl-meta">${meta.join("")}</span>
      </button>
      <div class="tl-side">${side.join("")}</div>
    </div>`;
  };

  function activityRow(activity) {
    const member = A.memberById(activity.memberId);
    const name = member ? esc(member.name) : "Hệ thống";
    const icons = { done: "check", move: "arrow-right", add: "plus", note: "message" };
    const type = icons[activity.type] ? activity.type : "note";
    return `<div class="act-row">
      <span class="act-ico ${type}">${icon(icons[type])}</span>
      <div>
        <div class="act-text"><b>${name}</b> ${esc(activity.text)}</div>
        <div class="act-time">${esc(A.timeAgo(activity.at))}</div>
      </div>
    </div>`;
  }
  A.activityRow = activityRow;

  function priorityRow(task, index) {
    return `<div class="prio-row">
      <span class="prio-rank">${pad2(index + 1)}</span>
      ${A.tick(task)}
      <button class="prio-body" type="button" data-open-task="${esc(task.id)}">
        <span class="prio-title">${esc(task.title)}</span>
        <span class="prio-meta">
          ${A.wsChip(task.workstream)}
          <span class="tl-why">${esc(A.reasonFor(task))}</span>
          ${A.subcount(task)}
        </span>
      </button>
      <div class="prio-side">
        ${A.dueChip(task)}
        ${A.pf(task.priority)}
      </div>
    </div>`;
  }

  function kpiCard(num, label, hint, iconName, cls) {
    return `<div class="kpi${cls ? " " + cls : ""}">
      <div class="kpi-main">
        <div class="kpi-num">${num}</div>
        <div class="kpi-label">${esc(label)}</div>
        <div class="kpi-hint">${esc(hint)}</div>
      </div>
      <div class="kpi-ico">${icon(iconName)}</div>
    </div>`;
  }

  function setupCard(members, m) {
    const hasMembers = members.length > 0;
    const hasTasks = m.total > 0;
    const step = (done, title, text) => `<li class="setup-step${done ? " done" : ""}">
      <span class="setup-dot">${done ? icon("check") : ""}</span>
      <div><b>${esc(title)}</b><small>${esc(text)}</small></div>
    </li>`;
    return `<section class="card setup-card">
      <div class="setup-main">
        <div class="setup-eyebrow">${icon("spark")} Bắt đầu</div>
        <h2 class="setup-title">${hasMembers ? "Giao việc đầu tiên." : "Thêm người vào tổ."}</h2>
        <p class="setup-text">${hasMembers
          ? `${members.length} người đã sẵn sàng. Tạo một việc, chọn người nhận và hẹn ngày để mở nhịp đầu tiên.`
          : "Thêm tên, vai trò và năng lực tuần của từng người. Sau đó bạn có thể giao việc, lọc theo người và xem tải của tổ."}</p>
        <div class="setup-actions">
          ${hasMembers
            ? `<button class="btn btn-accent" type="button" data-new-task>${icon("plus")} Giao việc đầu tiên</button>`
            : `<button class="btn btn-accent" type="button" data-go="team">${icon("users")} Thêm thành viên</button>`}
          <button class="btn btn-ghost" type="button" data-open-settings>${icon("download")} Cài ứng dụng</button>
        </div>
      </div>
      <ol class="setup-steps">
        ${step(hasMembers, "Thêm thành viên", "Tên, vai trò, năng lực tuần")}
        ${step(hasTasks, "Giao việc đầu tiên", "Người nhận, hạn chót, ưu tiên")}
      </ol>
    </section>`;
  }

  function dailySpark() {
    const today = A.todayISO();
    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const day = A.addDays(today, -i);
      const value = A.DATA.tasks.filter((t) => t.status === "done" && t.completedAt === day).length;
      const dt = A.parseISO(day);
      days.push({ day, value, label: dt ? ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][dt.getDay()] : "—", today: i === 0 });
    }
    const max = Math.max(1, ...days.map((d) => d.value));
    const bars = days.map((d) => `<i class="${d.value ? "has" : ""}${d.today ? " is-today" : ""}" style="height:${Math.max(7, Math.round((d.value / max) * 100))}%"></i>`).join("");
    const labels = days.map((d) => `<span class="${d.today ? "is-today" : ""}">${d.label}</span>`).join("");
    return { bars, labels, total: days.reduce((sum, d) => sum + d.value, 0) };
  }

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

  /* ============================================================
     DASHBOARD
     ============================================================ */
  A.renderDashboard = function () {
    const m = A.metrics();
    const me = A.me();
    const now = A.todayISO();
    const firstName = me ? me.name.split(" ")[0] : "bạn";
    const urgent = uniQ(m.overdueTasks.map((t) => t.id).concat(m.dueTodayTasks.map((t) => t.id)));
    const smart = A.smartTasks(5);
    const msList = A.milestones();
    const next = A.nextMilestone();
    const final = A.finalMilestone();
    const spark = dailySpark();
    const circumference = 351.86;
    const ringOffset = (circumference * (1 - m.rate / 100)).toFixed(1);
    const doneToday = A.DATA.tasks.filter((t) => t.status === "done" && t.completedAt === now);
    const compare = m.doneThisWeek - m.doneLastWeek;
    const compareText = compare > 0 ? `+${compare} so với tuần trước` : compare === 0 ? "Ngang tuần trước" : `${compare} so với tuần trước`;
    const memberStats = A.members().map((x) => A.memberStats(x.id)).filter(Boolean).sort((a, b) => b.load - a.load);
    const overloaded = memberStats.filter((s) => s.load > 100);
    const members = A.members();

    const heroTitle = m.total === 0
      ? (members.length
        ? `Bàn đã sẵn,<br>giao <span class="hl">việc đầu tiên.</span>`
        : `Bắt đầu<br>từ <span class="hl">người trong tổ.</span>`)
      : urgent > 0
        ? `Chào ${esc(firstName)},<br>hôm nay chạm <span class="hl">${urgent} việc.</span>`
        : `Hôm nay,<br>giữ <span class="hl">nhịp thật đều.</span>`;
    const heroSub = m.total === 0
      ? (members.length
        ? `<b>${members.length} người</b> đã sẵn sàng · <b>0 việc</b> trên bàn. Tạo việc đầu tiên để mở nhịp.`
        : `<b>Thêm thành viên</b> để giao việc, tính tải và lọc theo người. Mọi dữ liệu nằm trên thiết bị này.`)
      : m.overdue
        ? `<b>${m.overdue} việc quá hạn</b> cần chốt sớm · <b>${m.dueToday} việc</b> đến hạn hôm nay · <b>${m.doing} việc</b> đang được giữ nhịp.`
        : `<b>${m.dueToday} việc</b> đến hạn hôm nay · <b>${m.doing} việc</b> đang làm · <b>${doneToday.length} việc</b> đã gạch trong ngày.`;

    const hero = `<section class="hero" aria-label="Tóm tắt dự án">
      <div class="hero-main">
        <div class="hero-eyebrow"><span class="live-dot"></span> Tuần ${A.weekNumber(now)} · ${esc(A.longDateVN(now))}</div>
        <h1 class="hero-title">${heroTitle}</h1>
        <p class="hero-sub">${heroSub}</p>
        <div class="hero-actions">
          ${m.total === 0
            ? (members.length
              ? `<button class="btn btn-solid" type="button" data-new-task>${icon("plus")} Giao việc đầu tiên</button>`
              : `<button class="btn btn-solid" type="button" data-go="team">${icon("users")} Thêm thành viên</button>`)
            : `<button class="btn btn-solid" type="button" data-go="today">${icon("sun")} Xem hôm nay</button>`}
          <button class="btn btn-line" type="button" data-go="board">${icon("board")} Mở bảng việc</button>
          ${members.length && m.total > 0 ? `<button class="btn btn-line" type="button" data-new-task>${icon("plus")} Giao việc</button>` : ""}
        </div>
      </div>
      <div class="hero-side">
        <div class="hero-ring-wrap">
          <div class="ring">
            <svg viewBox="0 0 128 128" aria-hidden="true">
              <circle class="ring-track" cx="64" cy="64" r="56"/>
              <circle class="ring-fill" cx="64" cy="64" r="56" stroke-dasharray="${circumference}" stroke-dashoffset="${ringOffset}"/>
            </svg>
            <div class="ring-center">
              <strong>${m.rate}<span>%</span></strong>
              <em>hoàn thành</em>
            </div>
          </div>
          <div class="ring-meta">
            ${m.total ? `Đã xong <b>${m.done}/${m.total}</b> việc<br><span class="up">+${m.doneThisWeek}</span> việc trong tuần` : "Chưa có việc nào<br>để đo tiến độ"}
          </div>
        </div>
        <div class="hero-spark">
          <div class="spark-head"><span>7 ngày gần nhất</span><span>${spark.total} việc xong</span></div>
          <div class="spark-bars">${spark.bars}</div>
          <div class="spark-days">${spark.labels}</div>
        </div>
      </div>
      <div class="hero-foot">
        <span class="hero-quote">“${esc(A.quoteOfDay())}”</span>
        ${next ? `<button class="hero-ms" type="button" data-go="reports">
          <span class="micro">Mốc kế</span>
          <strong>${esc(next.title)}</strong>
          <span class="chip">${next.daysLeft === 0 ? "Hôm nay" : `Còn ${next.daysLeft} ngày`}</span>
        </button>` : ""}
      </div>
    </section>`;

    const kpis = `<div class="kpi-row">
      ${kpiCard(m.overdue, "Quá hạn", m.overdue ? "Cần chốt trước khi thêm việc mới" : "Không có việc nào trễ", "alert", m.overdue ? "alert" : "ok")}
      ${kpiCard(m.dueToday, "Đến hạn hôm nay", m.doing ? `${m.doing} việc đang được giữ nhịp` : "Hôm nay không có việc đang chạy", "sun", "review")}
      ${kpiCard(m.doing, "Đang làm", `${m.review} việc đang chờ duyệt`, "play", "doing")}
      ${kpiCard(m.doneThisWeek, "Xong tuần này", compareText, "check-circle", "ok")}
    </div>`;

    const priorityEmpty = m.total === 0
      ? (members.length
        ? A.empty("spark", "Bàn đang trống", "Tạo việc đầu tiên, chọn người nhận và hẹn ngày để mở nhịp.", `<button class="btn btn-accent btn-sm" type="button" data-new-task>${icon("plus")} Giao việc đầu tiên</button>`)
        : A.empty("users", "Chưa có ai để giao việc", "Thêm thành viên vào tổ trước, rồi mọi việc sẽ có người nhận rõ ràng.", `<button class="btn btn-accent btn-sm" type="button" data-go="team">${icon("users")} Thêm thành viên</button>`))
      : A.empty("check-circle", "Không còn việc gấp", "Danh sách đang sạch. Dành chút thời gian nhìn lại chặng vừa qua.");
    const priorityCard = `<section class="card dash-priorities">
      <div class="card-h">
        <div>
          <div class="card-t"><span class="card-idx">01</span> Ưu tiên hôm nay</div>
          <div class="card-sub">Xếp theo hạn, mức ưu tiên và nhịp đang giữ.</div>
        </div>
        <button class="card-link" type="button" data-go="board">Tất cả ${icon("arrow-right")}</button>
      </div>
      ${smart.length ? `<div class="prio-list">${smart.map(priorityRow).join("")}</div>` : priorityEmpty}
      <div class="prio-card-foot">
        <span class="inline">${icon("spark")} ${doneToday.length} việc xong hôm nay</span>
        <button class="card-link" type="button" data-go="today">Mở hôm nay ${icon("arrow-right")}</button>
      </div>
    </section>`;

    const msCard = msList.length ? `<section class="card card-ms dash-ms">
      <div class="card-h">
        <div>
          <div class="card-t"><span class="card-idx">02</span> Cột mốc dự án</div>
          <div class="card-sub">${final ? `Về đích ${A.fmtLong(final.date)}` : "Chặng đường đang mở"}</div>
        </div>
        <button class="card-link" type="button" data-go="calendar">Lịch ${icon("arrow-right")}</button>
      </div>
      <div class="ms-list">
        ${msList.map((ms) => `<div class="ms-item${next && next.id === ms.id ? " nearest" : ""}">
          <span class="ms-dot"></span>
          <div>
            <div class="ms-title">${esc(ms.title)}</div>
            <div class="ms-date">${A.fmtShort(ms.date)} · ${ms.daysLeft > 0 ? `còn ${ms.daysLeft} ngày` : ms.daysLeft === 0 ? "hôm nay" : "đã qua"}</div>
          </div>
          <span class="ms-count">${ms.openBefore} việc</span>
        </div>`).join("")}
      </div>
      <div class="ms-foot">
        <div class="ms-foot-top"><span>Tiến độ tổng</span><span>${m.done}/${m.total} · ${m.rate}%</span></div>
        <div class="ms-track"><i style="width:${m.rate}%"></i></div>
      </div>
    </section>` : "";

    const streams = A.workstreams().map((ws) => A.wsStats(ws.id)).filter(Boolean);
    const streamsCard = `<section class="card dash-streams">
      <div class="card-h">
        <div>
          <div class="card-t"><span class="card-idx">${msList.length ? "03" : "02"}</span> Nhịp các mảng</div>
          <div class="card-sub">Tỉ lệ hoàn thành · chạm để lọc danh sách.</div>
        </div>
        <button class="card-link" type="button" data-go="team">Đội ngũ ${icon("arrow-right")}</button>
      </div>
      ${m.total ? `<div class="stream-list">
        ${streams.map((s) => `<button class="stream-row" type="button" data-ws-filter="${esc(s.ws.id)}" style="--ws:${esc(s.ws.color)}">
          <span class="ws-mark"></span>
          <span class="stream-body">
            <span class="stream-top"><span class="stream-name">${esc(s.ws.name)}</span><span class="stream-num"><b>${s.done}</b>/${s.total}${s.overdue ? ` · ${s.overdue} trễ` : ""}</span></span>
            <span class="stream-bar"><i style="width:${s.pct}%"></i></span>
          </span>
        </button>`).join("")}
      </div>` : A.empty("layers", "Chưa có việc để chia mảng", "Mỗi việc mới sẽ được xếp vào một mảng để bạn nhìn được nhịp của từng phần.", `<button class="btn btn-ghost btn-sm" type="button" data-go="board">Mở bảng việc</button>`)}
    </section>`;

    const pulseCard = `<section class="card dash-pulse">
      <div class="card-h">
        <div>
          <div class="card-t"><span class="card-idx">${msList.length ? "04" : "03"}</span> Tải của tổ</div>
          <div class="card-sub">Việc đang mở / năng lực.</div>
        </div>
        <button class="card-link" type="button" data-go="team">Xem ${icon("arrow-right")}</button>
      </div>
      ${memberStats.length ? `<div class="pulse-list">
        ${memberStats.map((s) => `<button class="pulse-row" type="button" data-member-filter="${esc(s.member.id)}">
          ${A.avatar(s.member, "avatar-sm")}
          <span class="pulse-main">
            <span class="pulse-name"><span>${esc(s.member.name.split(" ")[0])}</span><b>${s.activeCount}/${s.member.capacity}</b></span>
            <span class="pulse-meter"><i class="${s.state === "ok" ? "" : s.state}" style="width:${Math.min(100, s.load)}%"></i></span>
          </span>
          <span class="pulse-flag${s.load > 100 ? " on" : ""}"></span>
        </button>`).join("")}
      </div>` : A.empty("users", "Tổ chưa có người", "Thêm thành viên để thấy tải của từng người ngay tại đây.", `<button class="btn btn-accent btn-sm" type="button" data-go="team">${icon("users")} Thêm thành viên</button>`)}
      <div class="pulse-note">${icon(overloaded.length ? "alert" : "spark")}
        <span>${!memberStats.length ? "Khi có người và việc, nhịp tải sẽ xuất hiện tại đây." : overloaded.length ? `${esc(overloaded[0].member.name)} đang vượt năng lực — cân nhắc san việc.` : `Tổ đang giữ ${m.open} việc mở, nhịp tải tương đối đều.`}</span>
      </div>
    </section>`;

    const activities = A.DATA.activity.slice(0, 7);
    const actCard = `<section class="card dash-act">
      <div class="card-h">
        <div>
          <div class="card-t"><span class="card-idx">${msList.length ? "05" : "04"}</span> Nhật ký tổ</div>
          <div class="card-sub">Cập nhật gần đây trên thiết bị này.</div>
        </div>
      </div>
      ${activities.length ? `<div class="act-list">${activities.map(activityRow).join("")}</div>` : A.empty("inbox", "Chưa có cập nhật", "Mọi thay đổi trong tổ sẽ xuất hiện tại đây.")}
      <div class="act-more"><button class="btn-link" type="button" data-go="reports">Xem báo cáo tuần ${icon("arrow-right")}</button></div>
    </section>`;

    const setup = !members.length || m.total === 0 ? setupCard(members, m) : "";
    return `${hero}${kpis}${setup}<div class="dash-grid${msList.length ? "" : " no-ms"}">${priorityCard}${msCard}${streamsCard}${pulseCard}${actCard}</div>`;
  };

  /* ============================================================
     TODAY
     ============================================================ */
  function focusCard() {
    const today = A.todayISO();
    const open = A.sortTasks(A.openTasks(), "smart");
    const valid = A.focus.taskId && A.taskById(A.focus.taskId) && A.taskById(A.focus.taskId).status !== "done" ? A.focus.taskId : null;
    const fallback = open[0] ? open[0].id : null;
    A.focus.taskId = valid || fallback;
    const task = A.taskById(A.focus.taskId);
    const mm = Math.floor(A.focus.remaining / 60);
    const ss = A.focus.remaining % 60;
    const pct = A.focus.duration ? Math.round(((A.focus.duration - A.focus.remaining) / A.focus.duration) * 100) : 0;
    const canFocus = open.length > 0;
    const options = open.slice(0, 20).map((t) => `<option value="${esc(t.id)}"${t.id === A.focus.taskId ? " selected" : ""}>${esc(t.title)}</option>`).join("");
    return `<section class="focus-card${A.focus.running ? " running" : ""}" data-focus-card>
      <div class="fc-head">
        <span class="fc-label">${icon("target")} Phiên tập trung</span>
        <span class="fc-state" data-focus-state><span class="dot"></span>${A.focus.running ? "Đang chạy" : "Sẵn sàng"}</span>
      </div>
      <div class="fc-time" data-focus-time>${pad2(mm)}<span>:</span>${pad2(ss)}</div>
      <div class="fc-sub" data-focus-sub>${A.focus.running ? "Giữ một việc, để chuông sang một bên." : `Phiên ${A.focus.duration / 60} phút · không ngắt quãng.`}</div>
      <div class="fc-track"><i data-focus-fill style="width:${pct}%"></i></div>
      <div class="fc-task">
        <select class="select" data-focus-task aria-label="Chọn việc để tập trung"${canFocus ? "" : " disabled"}>
          ${options || `<option value="">Chưa có việc để chọn</option>`}
        </select>
      </div>
      <div class="fc-row">
        <div class="fc-presets">
          ${[15, 25, 45].map((min) => `<button class="fc-pill${A.focus.duration === min * 60 ? " on" : ""}" type="button" data-focus-preset="${min}">${min}′</button>`).join("")}
        </div>
        ${canFocus ? `<button class="fc-start" type="button" data-focus-toggle>
          ${icon(A.focus.running ? "pause" : "play")}<span data-focus-toggle-label>${A.focus.running ? "Tạm dừng" : A.focus.remaining < A.focus.duration && A.focus.remaining > 0 ? "Tiếp tục" : "Bắt đầu"}</span>
        </button>` : `<button class="fc-start" type="button" data-new-task>${icon("plus")}<span>Tạo việc</span></button>`}
        <button class="fc-reset" type="button" data-focus-reset title="Đặt lại phiên" aria-label="Đặt lại phiên">${icon("reset")}</button>
      </div>
      <div class="fc-foot">
        <span>${A.focusMinutesOn(today)} phút hôm nay</span>
        <span>${A.focusStreak()} ngày liên tiếp</span>
      </div>
      ${task ? `<div class="sr-only">Đang chọn: ${esc(task.title)}</div>` : ""}
    </section>`;
  }

  A.renderToday = function () {
    const now = A.todayISO();
    const m = A.metrics();
    const doneToday = A.DATA.tasks.filter((t) => t.status === "done" && t.completedAt === now).slice().reverse();
    const open = A.openTasks();
    const urgent = A.sortTasks(open.filter((t) => t.due && t.due <= now), "smart");
    const top3 = A.smartTasks(3);
    const topIds = new Set(top3.map((t) => t.id));
    const rest = urgent.filter((t) => !topIds.has(t.id));
    const restIds = new Set(rest.map((t) => t.id));
    const holding = A.sortTasks(open.filter((t) => !topIds.has(t.id) && !restIds.has(t.id) && (t.status === "doing" || t.status === "review")), "smart").slice(0, 5);
    const urgentCount = uniQ(m.overdueTasks.map((t) => t.id).concat(m.dueTodayTasks.map((t) => t.id)));
    const review = open.filter((t) => t.status === "review").length;
    const quote = A.quoteOfDay();
    const headline = urgentCount
      ? `Hôm nay,<br><span>${urgentCount} việc</span> cần chạm.`
      : `Hôm nay,<br><span>giữ nhịp</span> thật đều.`;

    const head = pageHead(
      `${icon("sun")} ${esc(A.longDateVN(now))} · Tuần ${A.weekNumber(now)}`,
      headline,
      `<span>${m.overdue} quá hạn</span><span class="dot"></span><span>${m.dueToday} đến hạn</span><span class="dot"></span><span>${m.doing} đang làm</span><span class="dot"></span><span>${review} chờ duyệt</span>`,
      `<button class="btn btn-ghost" type="button" data-go="board">${icon("board")} Bảng việc</button>
       <button class="btn btn-accent" type="button" data-new-task>${icon("plus")} Giao việc</button>`,
      "today-head"
    );

    const topCard = `<section class="card card-three">
      <div class="card-h">
        <div>
          <div class="card-t"><span class="card-idx">01</span> Ba việc đáng chạm nhất</div>
          <div class="card-sub">Đã cân theo hạn, ưu tiên và việc đang dở.</div>
        </div>
        <button class="card-link" type="button" data-go="board">Bảng việc ${icon("arrow-right")}</button>
      </div>
      ${top3.length ? `<div class="three-list">
        ${top3.map((t, i) => `<div class="three-row">
          <span class="three-num">${pad2(i + 1)}</span>
          ${A.tick(t)}
          <button class="tl-main" type="button" data-open-task="${esc(t.id)}">
            <span class="three-title">${esc(t.title)}</span>
            <span class="three-meta">${A.wsChip(t.workstream)}<span class="tl-why">${esc(A.reasonFor(t))}</span>${A.subcount(t)}</span>
          </button>
          <div class="tl-side">${A.assignee(t.assignee)}${A.dueChip(t)}</div>
        </div>`).join("")}
      </div>` : A.empty("check-circle", "Không còn việc nào gấp", "Một ngày hiếm có. Dành 10 phút nhìn lại tuần và chọn việc tiếp theo.", `<button class="btn btn-accent btn-sm" type="button" data-new-task>${icon("plus")} Giao việc mới</button>`)}
    </section>`;

    const dueCard = `<section class="card">
      <div class="card-h">
        <div>
          <div class="card-t"><span class="card-idx">02</span> Còn lại đến hạn</div>
          <div class="card-sub">Quá hạn và đến hạn hôm nay, trừ 3 việc phía trên.</div>
        </div>
        <span class="chip ${rest.length ? "chip-accent" : "chip-ok"}">${rest.length} việc</span>
      </div>
      ${rest.length ? `<div class="day-list">${rest.map((t) => A.taskLine(t, { why: A.reasonFor(t), who: false })).join("")}</div>` : `<div class="day-empty">Không còn gì gấp. Nhịp hôm nay đang sạch.</div>`}
    </section>`;

    const holdingCard = holding.length ? `<section class="card">
      <div class="card-h">
        <div>
          <div class="card-t"><span class="card-idx">03</span> Đang giữ nhịp</div>
          <div class="card-sub">Những việc đang làm hoặc chờ duyệt, ngoài danh sách gấp.</div>
        </div>
        <button class="card-link" type="button" data-go="board">${icon("board")} Xem bảng</button>
      </div>
      <div class="day-list">${holding.map((t) => A.taskLine(t, { why: A.reasonFor(t), who: false, comments: true })).join("")}</div>
    </section>` : "";

    const doneCard = `<section class="card">
      <div class="card-h">
        <div>
          <div class="card-t">Đã xong hôm nay <span class="done-head-num">${doneToday.length}</span></div>
          <div class="card-sub">Gạch được một việc là một lần nhẹ đi.</div>
        </div>
      </div>
      ${doneToday.length ? doneToday.slice(0, 6).map((t) => `<div class="done-row">${icon("check-circle")}<span>${esc(t.title)}</span></div>`).join("") : `<div class="day-empty">Chưa có việc nào được gạch. Bắt đầu từ việc nhỏ nhất.</div>`}
    </section>`;

    const tipCard = `<section class="card tip-card">
      <div class="tip-label">${icon("spark")} Gợi ý hôm nay</div>
      <div class="tip-text">“${esc(quote)}”</div>
      <div class="tip-meta">GUỒNG · Một câu mỗi ngày</div>
    </section>`;

    return `${head}
    <div class="today-grid">
      <div class="today-col">${topCard}${dueCard}${holdingCard}</div>
      <aside class="today-aside">${focusCard()}${doneCard}${tipCard}</aside>
    </div>`;
  };
})();
