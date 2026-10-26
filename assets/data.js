/* ============================================================
   GUỒNG — dữ liệu khung: mảng việc, nhãn, màu thành viên
   Bản sạch: chưa có thành viên hay công việc mẫu.
   ============================================================ */
(function () {
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const workstreams = [
    { id: "w1", name: "Sản phẩm", color: "#D94A1E" },
    { id: "w2", name: "Thiết kế", color: "#6C4AC8" },
    { id: "w3", name: "Phát triển", color: "#197565" },
    { id: "w4", name: "Nội dung", color: "#A9700A" },
    { id: "w5", name: "Kiểm thử", color: "#A63C6B" },
    { id: "w6", name: "Phát hành", color: "#2F49C4" },
  ];

  const labels = ["Giao diện", "Kỹ thuật", "Nội dung", "Phát hành", "Bug", "Ưu tiên tổ"];

  const memberColors = ["#D94A1E", "#6C4AC8", "#197565", "#A9700A", "#2F49C4", "#A63C6B", "#566F32", "#B5482A", "#3B6E8F", "#7A5C3E"];

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
    return {
      version: 2,
      settings: {
        theme: "light",
        projectName: "Dự án App",
        startDate: iso(new Date()),
        createdAt: new Date().toISOString(),
        ownerId: null,
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
    create,
  };
})();
