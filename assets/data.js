/* ============================================================
   GUỒNG — dữ liệu mẫu cho dự án App Quản trị v1.0
   Ngày tháng được tính tương đối so với lần chạy đầu tiên
   ============================================================ */
(function () {
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const now = new Date();
  const TODAY = iso(now);

  function shift(n) {
    return iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + n));
  }
  function dateAt(isoDate, h, m) {
    const [y, mo, d] = isoDate.split("-").map(Number);
    return new Date(y, mo - 1, d, h, m).toISOString();
  }
  function hoursAgo(h) {
    return new Date(Date.now() - h * 3600 * 1000).toISOString();
  }
  function daysBetween(a, b) {
    const pa = a.split("-").map(Number);
    const pb = b.split("-").map(Number);
    return Math.round(
      (new Date(pb[0], pb[1] - 1, pb[2]) - new Date(pa[0], pa[1] - 1, pa[2])) / 86400000
    );
  }

  const members = [
    { id: "m1", name: "Minh Anh", short: "MA", role: "Trưởng tổ", color: "#D94A1E", capacity: 8 },
    { id: "m2", name: "Lan Hương", short: "LH", role: "Thiết kế", color: "#6C4AC8", capacity: 5 },
    { id: "m3", name: "Hùng Lê", short: "HL", role: "Lập trình giao diện", color: "#197565", capacity: 8 },
    { id: "m4", name: "Mai Phạm", short: "MP", role: "Nội dung", color: "#A9700A", capacity: 4 },
    { id: "m5", name: "Nam Võ", short: "NV", role: "Lập trình máy chủ", color: "#2F49C4", capacity: 8 },
    { id: "m6", name: "Vy Trần", short: "VT", role: "Kiểm thử", color: "#A63C6B", capacity: 7 },
    { id: "m7", name: "Thảo Nguyễn", short: "TN", role: "Vận hành", color: "#566F32", capacity: 5 },
  ];

  const workstreams = [
    { id: "w1", name: "Sản phẩm", color: "#D94A1E" },
    { id: "w2", name: "Thiết kế", color: "#6C4AC8" },
    { id: "w3", name: "Phát triển", color: "#197565" },
    { id: "w4", name: "Nội dung", color: "#A9700A" },
    { id: "w5", name: "Kiểm thử", color: "#A63C6B" },
    { id: "w6", name: "Phát hành", color: "#2F49C4" },
  ];

  const labels = ["Giao diện", "Kỹ thuật", "Nội dung", "Phát hành", "Bug", "Ưu tiên tổ"];

  const quotes = [
    "Việc nhỏ chạy đều, dự án lớn về đích.",
    "Một ngày tốt là một ngày có ba việc được gạch.",
    "Không cần nhanh hơn. Cần rõ hơn.",
    "Giao đúng người, hẹn đúng ngày.",
    "Bớt họp lại, thêm vài lần chạm.",
    "Tiến độ tốt nhất là tiến độ nhìn thấy được.",
    "Giữ nhịp quan trọng hơn giữ kế hoạch.",
  ];

  function milestones(startDate) {
    const defs = [
      { id: "ms1", title: "Chốt phạm vi v1", offset: 14, note: "Đặc tả & 4 luồng lõi được duyệt" },
      { id: "ms2", title: "Bản thử nội bộ", offset: 28, note: "Tổ quản trị dùng thử trong 1 tuần" },
      { id: "ms3", title: "Beta cho ban giám đốc", offset: 45, note: "Mời 10 người dùng thật trải nghiệm" },
      { id: "ms4", title: "Ra mắt v1.0", offset: 60, note: "Chính thức đưa GUỒNG vào vận hành" },
    ];
    return defs.map((m) => ({
      id: m.id,
      title: m.title,
      note: m.note,
      date: (() => {
        const [y, mo, d] = startDate.split("-").map(Number);
        return iso(new Date(y, mo - 1, d + m.offset));
      })(),
    }));
  }

  function create() {
    let uid = 0;
    const id = (p) => p + ++uid;
    const sub = (title, done) => ({ id: id("s"), title, done: !!done });
    const comm = (author, text, h) => ({ id: id("c"), author, text, at: hoursAgo(h) });
    const link = (label, url) => ({ id: id("l"), label, url });

    const tasks = [];
    const add = (t) => {
      tasks.push({
        id: id("t"),
        title: t.title,
        desc: t.desc || "",
        status: t.status || "todo",
        priority: t.priority || "med",
        assignee: t.assignee === undefined ? "m1" : t.assignee,
        workstream: t.workstream || "w1",
        due: t.due || null,
        estimate: t.estimate || null,
        labels: t.labels || [],
        subtasks: t.subtasks || [],
        links: t.links || [],
        comments: t.comments || [],
        createdAt: t.createdAt || shift(-14),
        completedAt: t.completedAt || null,
        prevStatus: null,
      });
    };

    /* ---------- đã xong ---------- */
    add({ title: "Thu thập yêu cầu từ 4 bộ phận", workstream: "w1", assignee: "m7", status: "done", priority: "med", due: shift(-36), completedAt: shift(-34), createdAt: shift(-42), estimate: 6, labels: ["Ưu tiên tổ"], desc: "Ghi lại những điểm đau khi giao việc qua nhóm chat và bảng tính." });
    add({ title: "So sánh 3 công cụ quản lý việc", workstream: "w1", assignee: "m1", status: "done", priority: "low", due: shift(-27), completedAt: shift(-27), createdAt: shift(-33), estimate: 5, desc: "Chấm theo 4 tiêu chí: giao việc, trạng thái, báo cáo, chi phí." });
    add({ title: "Chọn ngăn xếp công nghệ", workstream: "w3", assignee: "m5", status: "done", priority: "high", due: shift(-33), completedAt: shift(-33), createdAt: shift(-38), estimate: 4, labels: ["Kỹ thuật"] });
    add({ title: "Kiểm tra hạ tầng & quyền truy cập", workstream: "w6", assignee: "m7", status: "done", priority: "med", due: shift(-24), completedAt: shift(-25), createdAt: shift(-31), estimate: 3, desc: "Chắc chắn mọi thành viên vào được môi trường thử mà không cần hỗ trợ riêng." });
    add({ title: "Chốt tên gọi & định vị sản phẩm", workstream: "w4", assignee: "m4", status: "done", priority: "med", due: shift(-26), completedAt: shift(-27), createdAt: shift(-34), estimate: 4 });
    add({ title: "Bản đồ hành trình người dùng", workstream: "w2", assignee: "m2", status: "done", priority: "high", due: shift(-24), completedAt: shift(-23), createdAt: shift(-32), estimate: 8, labels: ["Giao diện"] });
    add({ title: "Dựng môi trường phát triển & CI", workstream: "w3", assignee: "m5", status: "done", priority: "high", due: shift(-22), completedAt: shift(-20), createdAt: shift(-30), estimate: 10, labels: ["Kỹ thuật"] });
    add({ title: "Hệ thống màu, chữ & lưới nền", workstream: "w2", assignee: "m2", status: "done", priority: "high", due: shift(-17), completedAt: shift(-18), createdAt: shift(-26), estimate: 10, labels: ["Giao diện"] });
    add({ title: "Đặc tả luồng tạo & giao việc", workstream: "w1", assignee: "m1", status: "done", priority: "high", due: shift(-15), completedAt: shift(-16), createdAt: shift(-24), estimate: 6, labels: ["Ưu tiên tổ"] });
    add({ title: "Khung ứng dụng & điều hướng chính", workstream: "w3", assignee: "m3", status: "done", priority: "high", due: shift(-12), completedAt: shift(-13), createdAt: shift(-21), estimate: 12, labels: ["Kỹ thuật"] });
    add({ title: "Khảo sát nhanh 7 thành viên tổ", workstream: "w1", assignee: "m7", status: "done", priority: "med", due: shift(-11), completedAt: shift(-11), createdAt: shift(-16), estimate: 3, desc: "Hỏi 3 câu: việc gì hay bị quên nhất, muốn thấy gì mỗi sáng, ngại thao tác gì." });
    add({ title: "Thiết kế luồng xem & cập nhật trạng thái", workstream: "w2", assignee: "m2", status: "done", priority: "high", due: shift(-8), completedAt: shift(-9), createdAt: shift(-15), estimate: 8, labels: ["Giao diện"] });
    add({ title: "Kịch bản kiểm thử 4 luồng lõi", workstream: "w5", assignee: "m6", status: "done", priority: "med", due: shift(-6), completedAt: shift(-7), createdAt: shift(-13), estimate: 6, labels: ["Kỹ thuật"] });
    add({ title: "Dựng API công việc & phân quyền", workstream: "w3", assignee: "m5", status: "done", priority: "high", due: shift(-4), completedAt: shift(-4), createdAt: shift(-12), estimate: 12, labels: ["Kỹ thuật"] });
    add({ title: "Viết hướng dẫn nhanh cho người mới", workstream: "w4", assignee: "m4", status: "done", priority: "med", due: shift(-4), completedAt: shift(-5), createdAt: shift(-10), estimate: 4, labels: ["Nội dung"] });
    add({ title: "Đo nhịp làm việc tuần đầu tiên", workstream: "w1", assignee: "m1", status: "done", priority: "low", due: shift(-1), completedAt: shift(-2), createdAt: shift(-8), estimate: 2, desc: "So sánh số việc mở mỗi ngày và số việc bị dồn sang hôm sau." });
    add({ title: "Kiểm thử luồng giao việc trên Chrome", workstream: "w5", assignee: "m6", status: "done", priority: "med", due: shift(0), completedAt: shift(0), createdAt: shift(-6), estimate: 3, labels: ["Kỹ thuật"] });
    add({ title: "Chốt câu chữ thông báo trong app", workstream: "w4", assignee: "m4", status: "done", priority: "med", due: shift(0), completedAt: shift(0), createdAt: shift(-4), estimate: 2, labels: ["Nội dung"] });

    /* ---------- đang làm ---------- */
    add({
      title: "UI chi tiết bảng điều khiển", workstream: "w2", assignee: "m2", status: "doing", priority: "high",
      due: shift(0), estimate: 8, createdAt: shift(-8), labels: ["Giao diện", "Ưu tiên tổ"],
      desc: "Bảng tổng quan phải kể được câu chuyện của tuần trong 5 giây đầu: hôm nay chạm việc gì, ai đang giữ nhịp.",
      subtasks: [sub("Phác thảo nhịp tuần & vòng tiến độ", true), sub("Lên bố cục ưu tiên hôm nay", true), sub("Thiết kế trạng thái trống", false), sub("Bàn giao bản tĩnh cho Hùng", false)],
      links: [link("Figma — Bản thiết kế", "https://www.figma.com")],
      comments: [
        comm("m1", "Phần nhịp tuần cho nổi hơn một chút nhé, mở app là thấy ngay tiến độ.", 9),
        comm("m2", "Đã lên bản 2, mình đang chỉnh khoảng thở giữa các khối. Chiều gửi cả tổ xem.", 3),
      ],
    });
    add({
      title: "Luồng kéo–thả bảng Kanban", workstream: "w3", assignee: "m3", status: "doing", priority: "high",
      due: shift(1), estimate: 12, createdAt: shift(-7), labels: ["Kỹ thuật", "Giao diện"],
      desc: "Bảng bốn cột, kéo thả có phản hồi rõ. Trên mobile sẽ dùng menu trạng thái thay cho kéo thả.",
      subtasks: [sub("Khung 4 cột trạng thái", true), sub("Kéo thả trên Chrome", true), sub("Hiệu ứng thả & cuộn", true), sub("Xử lý cảm ứng trên mobile", false), sub("Lưu thứ tự sau khi thả", false)],
      links: [link("GitHub — Nhánh kanban", "https://github.com")],
      comments: [
        comm("m3", "Kéo thả mượt trên Chrome rồi. Safari đang lệch toạ độ khi cuộn trang.", 20),
        comm("m5", "Mình nhận phần lệch ngày, chiều nay đẩy bản sửa cho Hùng test lại.", 5),
      ],
    });
    add({
      title: "Sửa lỗi lệch ngày khi lọc theo hạn", workstream: "w3", assignee: "m5", status: "doing", priority: "high",
      due: shift(0), estimate: 4, createdAt: shift(-2), labels: ["Bug", "Kỹ thuật"],
      desc: "Lỗi hiển thị lệch một ngày khi hạn rơi vào cuối tuần ở múi giờ UTC+7.",
      comments: [
        comm("m6", "Lỗi xảy ra khi hạn rơi vào Chủ nhật, mình đã gửi ảnh chụp trong nhóm kỹ thuật.", 10),
        comm("m5", "Đã tái hiện được. Nguyên nhân do đổi múi giờ khi parse ngày, mình đang sửa.", 2),
      ],
    });
    add({
      title: "Kiểm thử mobile 375px", workstream: "w5", assignee: "m6", status: "doing", priority: "med",
      due: shift(0), estimate: 3, createdAt: shift(-4), labels: ["Kỹ thuật"],
      subtasks: [sub("Kiểm tra 375px dọc", true), sub("Kiểm tra bàn phím ảo che form", false), sub("Chụp lại các điểm vỡ", false)],
      comments: [comm("m6", "375px ổn, nhưng nút Giao việc bị che ở màn hình thấp. Mình đang ghi lại từng màn.", 7)],
    });
    add({
      title: "Viết hướng dẫn sử dụng nhanh", workstream: "w4", assignee: "m4", status: "doing", priority: "med",
      due: shift(2), estimate: 5, createdAt: shift(-6), labels: ["Nội dung"],
      desc: "Một trang hướng dẫn đủ để người mới tự giao việc, đổi trạng thái và đọc báo cáo tuần.",
      subtasks: [sub("Viết phần giao việc", true), sub("Viết phần hạn & ưu tiên", true), sub("Ảnh chụp từng bước", false), sub("Nhờ Vy đọc lại", false)],
    });

    /* ---------- chờ duyệt ---------- */
    add({
      title: "Bộ icon & minh hoạ nhỏ", workstream: "w2", assignee: "m2", status: "review", priority: "med",
      due: shift(-1), estimate: 6, createdAt: shift(-9), labels: ["Giao diện"],
      desc: "Bộ icon 24px cho toàn bộ trạng thái, ưu tiên và mảng việc.",
      comments: [comm("m2", "Còn 3 icon trạng thái, mình gửi duyệt nốt trong sáng nay.", 6)],
    });
    add({
      title: "Đặc tả luồng duyệt công việc v1", workstream: "w1", assignee: "m1", status: "review", priority: "high",
      due: shift(1), estimate: 3, createdAt: shift(-5), labels: ["Ưu tiên tổ"],
      desc: "Chốt 2 bước duyệt: người làm gửi kết quả, người giao xác nhận hoàn thành.",
      comments: [comm("m1", "Đã chốt luồng hai bước. Mọi người xem lại giúp mình trước buổi họp chiều thứ Sáu.", 12)],
    });
    add({
      title: "Checklist phát hành v1.0", workstream: "w6", assignee: "m7", status: "review", priority: "med",
      due: shift(4), estimate: 4, createdAt: shift(-6), labels: ["Phát hành"],
      desc: "Danh sách những việc phải xong trước khi bấm nút phát hành. Không có mục nào được bỏ qua.",
      subtasks: [
        sub("Chạy kiểm thử hồi quy", true), sub("Kiểm tra sao lưu dữ liệu", true), sub("Chốt nội dung thông báo", true),
        sub("Rà soát quyền truy cập", true), sub("Chuẩn bị kênh hỗ trợ", true), sub("Chạy thử 24 giờ", false),
        sub("Tập huấn tổ quản trị", false), sub("Thông báo nội bộ", false), sub("Chốt ngày phát hành", false),
      ],
      links: [link("GitHub Pages — Hướng dẫn", "https://pages.github.com")],
      comments: [comm("m7", "Còn thiếu bước sao lưu dữ liệu trước khi phát hành, mình đã thêm vào cuối danh sách.", 30)],
    });

    /* ---------- chưa làm ---------- */
    add({ title: "Thiết kế trạng thái trống & lỗi", workstream: "w2", assignee: "m2", status: "todo", priority: "high", due: shift(2), estimate: 6, createdAt: shift(-4), labels: ["Giao diện"], desc: "Không có việc, không có kết quả tìm kiếm, mất kết nối — vẫn phải dễ chịu và chỉ rõ bước tiếp theo." });
    add({ title: "Đồng bộ trạng thái & nhật ký hoạt động", workstream: "w3", assignee: "m5", status: "todo", priority: "high", due: shift(5), estimate: 10, createdAt: shift(-5), labels: ["Kỹ thuật"] });
    add({ title: "Bộ lọc & tìm kiếm công việc", workstream: "w3", assignee: "m3", status: "todo", priority: "med", due: shift(6), estimate: 8, createdAt: shift(-4), labels: ["Kỹ thuật"] });
    add({ title: "Nội dung email nhắc việc hằng ngày", workstream: "w4", assignee: "m4", status: "todo", priority: "med", due: shift(4), estimate: 4, createdAt: shift(-3), labels: ["Nội dung"], desc: "Một email ngắn, đọc trong 30 giây: việc quá hạn, việc hôm nay, một câu động viên.", subtasks: [sub("Chốt tiêu đề email", false), sub("Viết bản nháp", false), sub("Duyệt cùng cả tổ", false)] });
    add({ title: "Kịch bản kiểm thử đăng nhập & phân quyền", workstream: "w5", assignee: "m6", status: "todo", priority: "high", due: shift(3), estimate: 5, createdAt: shift(-5), labels: ["Kỹ thuật"] });
    add({ title: "Cấu hình GitHub Pages & tên miền", workstream: "w6", assignee: "m7", status: "todo", priority: "high", due: shift(5), estimate: 3, createdAt: shift(-4), labels: ["Phát hành"], desc: "Đưa bản thử lên một đường dẫn cố định để cả tổ cùng mở, không cần chạy máy cá nhân." });
    add({ title: "Kế hoạch tập huấn tổ quản trị", workstream: "w6", assignee: "m7", status: "todo", priority: "med", due: shift(8), estimate: 4, createdAt: shift(-3), labels: ["Phát hành"] });
    add({ title: "Chế độ tối & ghi nhớ tùy chọn", workstream: "w3", assignee: "m5", status: "todo", priority: "low", due: shift(9), estimate: 5, createdAt: shift(-2) });
    add({ title: "Trang giới thiệu nội bộ", workstream: "w4", assignee: "m4", status: "todo", priority: "low", due: shift(10), estimate: 6, createdAt: shift(-2), labels: ["Nội dung"] });
    add({ title: "Rà soát khả năng tiếp cận", workstream: "w5", assignee: "m6", status: "todo", priority: "med", due: shift(9), estimate: 6, createdAt: shift(-2), labels: ["Kỹ thuật"] });
    add({ title: "Tối ưu hiệu năng danh sách dài", workstream: "w3", assignee: "m3", status: "todo", priority: "med", due: shift(12), estimate: 8, createdAt: shift(-1), labels: ["Kỹ thuật"] });
    add({ title: "Đo lường tuần đầu sau ra mắt", workstream: "w6", assignee: "m7", status: "todo", priority: "low", due: shift(21), estimate: 3, createdAt: shift(-1) });
    add({ title: "Bộ thông điệp ra mắt beta", workstream: "w4", assignee: "m4", status: "todo", priority: "low", due: shift(14), estimate: 5, createdAt: shift(-1), labels: ["Nội dung"] });
    add({ title: "Prototype tương tác cho beta", workstream: "w2", assignee: "m2", status: "todo", priority: "high", due: shift(7), estimate: 12, createdAt: shift(-2), labels: ["Giao diện"] });
    add({ title: "Cổng phản hồi người dùng", workstream: "w3", assignee: "m5", status: "todo", priority: "low", due: shift(13), estimate: 6, createdAt: shift(-1) });
    add({ title: "Bài học & chốt vòng lặp tiếp theo", workstream: "w1", assignee: "m1", status: "todo", priority: "low", due: shift(16), estimate: 3, createdAt: shift(0) });
    add({ title: "Chuẩn bị nội dung buổi demo nội bộ", workstream: "w4", assignee: null, status: "todo", priority: "med", due: shift(6), estimate: 4, createdAt: shift(-1), labels: ["Nội dung"] });
    add({ title: "Lên lịch buổi dùng thử với ban giám đốc", workstream: "w6", assignee: null, status: "todo", priority: "low", due: shift(12), estimate: 2, createdAt: shift(-1), labels: ["Phát hành"] });

    /* ---------- hoạt động ---------- */
    const activity = [];
    let aid = 0;
    const act = (type, taskId, memberId, text, at) =>
      activity.push({ id: "a" + ++aid, type, taskId, memberId, text, at });

    tasks
      .filter((t) => t.completedAt)
      .forEach((t, i) => {
        const at =
          t.completedAt === TODAY
            ? hoursAgo(3.5 + i * 0.6)
            : dateAt(t.completedAt, 9 + (i % 8), (i * 11) % 60);
        act("done", t.id, t.assignee || "m1", `đã hoàn thành «${t.title}»`, at);
      });

    tasks
      .filter((t) => t.status === "doing")
      .forEach((t, i) => {
        act("move", t.id, t.assignee || "m1", `đã chuyển «${t.title}» sang Đang làm`, dateAt(shift(-1), 9 + i, 10));
      });

    tasks
      .filter((t) => t.comments.length)
      .forEach((t) => {
        const last = t.comments[t.comments.length - 1];
        act("note", t.id, last.author, `đã bình luận trong «${t.title}»`, last.at);
      });

    act("add", tasks[tasks.length - 1].id, "m1", `đã thêm việc «${tasks[tasks.length - 1].title}»`, hoursAgo(6));
    act("note", null, null, "Mốc «Chốt phạm vi v1» sẽ tới hạn sau 4 ngày.", hoursAgo(1.2));

    activity.sort((a, b) => new Date(b.at) - new Date(a.at));

    /* ---------- phiên tập trung ---------- */
    const focus = [
      { id: "f1", taskId: tasks[18].id, minutes: 25, at: hoursAgo(4.2) },
      { id: "f2", taskId: tasks[19].id, minutes: 25, at: hoursAgo(2.1) },
      { id: "f3", taskId: tasks[18].id, minutes: 45, at: dateAt(shift(-1), 15, 10) },
      { id: "f4", taskId: tasks[13].id, minutes: 25, at: dateAt(shift(-2), 10, 30) },
      { id: "f5", taskId: tasks[19].id, minutes: 50, at: dateAt(shift(-3), 14, 5) },
    ];

    return {
      version: 1,
      settings: {
        theme: "light",
        projectName: "App Quản trị v1.0",
        startDate: shift(-10),
        createdAt: new Date().toISOString(),
      },
      tasks,
      activity,
      focus,
    };
  }

  window.SEED = {
    me: "m1",
    today: TODAY,
    members,
    workstreams,
    labels,
    quotes,
    milestones,
    create,
    daysBetween,
    shift,
  };
})();
