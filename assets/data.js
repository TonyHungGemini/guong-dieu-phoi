/* ============================================================
   GUỒNG — dữ liệu khung: mảng việc, nhãn, màu thành viên
   Bản sạch: chưa có thành viên hay công việc mẫu.
   ============================================================ */
(function () {
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const workstreams = [
    { id: "w1", name: "Chiến lược & Kế hoạch", color: "#D94A1E" },
    { id: "w2", name: "Kinh doanh & Khách hàng", color: "#6C4AC8" },
    { id: "w3", name: "Thiết kế & Trải nghiệm", color: "#197565" },
    { id: "w4", name: "Kỹ thuật & Công nghệ", color: "#A9700A" },
    { id: "w5", name: "Nội dung & Thương hiệu", color: "#A63C6B" },
    { id: "w6", name: "Vận hành & Hỗ trợ", color: "#2F49C4" },
    { id: "w7", name: "Tài chính & Pháp lý", color: "#566F32" },
    { id: "w8", name: "Nhân sự & Đào tạo", color: "#B5482A" },
  ];

  const labels = ["Kế hoạch", "Khách hàng", "Thiết kế", "Kỹ thuật", "Nội dung", "Vận hành", "Tài chính", "Nhân sự", "Bug", "Ưu tiên tổ"];

  const memberColors = ["#D94A1E", "#6C4AC8", "#197565", "#A9700A", "#2F49C4", "#A63C6B", "#566F32", "#B5482A", "#3B6E8F", "#7A5C3E"];

  function makeJoinCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let body = "";
    for (let i = 0; i < 6; i += 1) body += alphabet[Math.floor(Math.random() * alphabet.length)];
    return `G-${body}`;
  }

  const quotes = [
    "Việc nhỏ chạy đều, dự án lớn về đích.",
    "Một ngày tốt là một ngày có ba việc được gạch.",
    "Không cần nhanh hơn. Cần rõ hơn.",
    "Giao đúng người, hẹn đúng ngày.",
    "Bớt họp lại, thêm vài lần chạm.",
    "Tiến độ tốt nhất là tiến độ nhìn thấy được.",
    "Giữ nhịp quan trọng hơn giữ kế hoạch.",
  ];

  function create() {
    const createdAt = new Date().toISOString();
    return {
      version: 2,
      settings: {
        theme: "light",
        projectName: "Dự án App",
        startDate: iso(new Date()),
        createdAt,
        ownerId: null,
        projects: [{ id: "p-main", name: "Dự án App", joinCode: makeJoinCode(), createdAt }],
        activeProjectId: "p-main",
        licenses: [],
      },
      members: [],
      tasks: [],
      activity: [],
      focus: [],
      milestones: [],
    };
  }

  window.SEED = {
    workstreams,
    labels,
    memberColors,
    quotes,
    makeJoinCode,
    create,
  };
})();
