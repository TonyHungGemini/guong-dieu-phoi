/* ============================================================
   GUỒNG — hướng dẫn nhanh cho người mới
   ============================================================ */
(function () {
  "use strict";
  const A = window.App;
  if (!A) return;

  const STORE_BASE = "guong.tour.v1";
  let overlayEl = null;
  let autoTimer = null;

  const scope = () => (A.account && A.account.email ? String(A.account.email).toLowerCase() : "guest");
  const storeKey = () => `${STORE_BASE}::${scope()}`;
  function seen() {
    try {
      return localStorage.getItem(storeKey()) === "done";
    } catch (err) {
      return true;
    }
  }
  function markSeen() {
    try {
      localStorage.setItem(storeKey(), "done");
    } catch (err) {
      /* bộ nhớ bị khoá — hướng dẫn sẽ hiện lại lần sau */
    }
  }

  const ICON = (name) => `<svg class="ico" aria-hidden="true"><use href="#i-${name}"/></svg>`;

  const slides = [
    {
      eyebrow: "Bước 1 · Làm quen",
      title: "Một bàn việc, cả tổ cùng nhìn.",
      text: "GUỒNG gom việc, người và báo cáo về một màn hình. Dữ liệu nằm trong tài khoản Google của bạn, không cần cài thêm gì.",
      list: ["Bảng việc theo từng dự án", "Hạn chót, ưu tiên và người nhận rõ ràng"],
      visual: `<div class="tv-board">
        <div class="tv-board-head"><i class="tv-dot"></i><i class="tv-line"></i></div>
        <div class="tv-cols">
          <div class="tv-col"><span class="tv-col-t">Chờ làm</span><span class="tv-chip">Brief chiến dịch</span><span class="tv-chip short">Duyệt ngân sách</span></div>
          <div class="tv-col on"><span class="tv-col-t">Đang làm</span><span class="tv-chip hot">Landing page</span></div>
          <div class="tv-col"><span class="tv-col-t">Xong</span><span class="tv-chip done">Kế hoạch tuần</span></div>
        </div>
      </div>`,
    },
    {
      eyebrow: "Bước 2 · Giao việc",
      title: "Vài chạm là có việc mới.",
      text: "Bấm nút Giao việc ở thanh dưới (hoặc phím N). Chọn người nhận, hạn và mức ưu tiên — thẻ việc xuất hiện ngay trên bảng.",
      list: ["Bấm giữ thẻ để kéo sang trạng thái khác", "Mọi thay đổi được lưu tự động"],
      visual: `<div class="tv-task">
        <div class="tv-task-top"><span class="tv-pill">Ưu tiên cao</span><span class="tv-task-date">Hạn 05/11</span></div>
        <strong>Chốt nội dung video ra mắt</strong>
        <div class="tv-task-meta"><span class="tv-avatar">LH</span> Lan Hương · Thiết kế</div>
        <div class="tv-task-actions"><span class="tv-mini-btn">Giao việc</span><span class="tv-mini-btn ghost">Huỷ</span></div>
      </div>`,
    },
    {
      eyebrow: "Bước 3 · Mỗi ngày",
      title: "Hôm nay biết ngay cần làm gì.",
      text: "Tab Hôm nay gom việc quá hạn, việc đến hạn và mốc kế tiếp của dự án. Chấm đỏ trên thanh dưới nhắc bạn khi có việc cần chú ý.",
      list: ["Chú Ong nhắc việc trước hạn", "Mốc dự án hiển thị ngay trên thanh bên"],
      visual: `<div class="tv-today">
        <div class="tv-today-head"><span>Hôm nay</span><span class="tv-badge">3</span></div>
        <div class="tv-day-row"><i class="tv-check late"></i><span class="tv-day-main"><b>Gửi báo giá cho khách</b><small>Quá hạn 1 ngày · Lan Hương</small></span><span class="tv-day-tag late">Gấp</span></div>
        <div class="tv-day-row"><i class="tv-check"></i><span class="tv-day-main"><b>Chốt ảnh banner</b><small>Hạn hôm nay · Minh Quân</small></span><span class="tv-day-tag">Hôm nay</span></div>
        <div class="tv-day-row"><i class="tv-check"></i><span class="tv-day-main"><b>Họp tiến độ tuần</b><small>16:00 · Cả tổ</small></span><span class="tv-day-tag">Chiều</span></div>
      </div>`,
    },
    {
      eyebrow: "Bước 4 · Cùng tổ",
      title: "Rủ người vào cùng một bàn.",
      text: "Mở Đội ngũ, copy mã G-XXXXXX hoặc gửi lời mời qua email. Người nhận đăng nhập Google rồi nhập mã để xem bảng việc của bạn.",
      list: ["Mỗi dự án có mã tham gia riêng", "Nhập mã ở Đội ngũ → Tham gia bằng mã"],
      visual: `<div class="tv-invite">
        <span class="tv-invite-label">MÃ THAM GIA DỰ ÁN</span>
        <strong>G-7K2M9Q</strong>
        <div class="tv-invite-mail">${ICON("send")}<span>gui.ban@congty.com</span><span class="tv-send">Gửi</span></div>
      </div>`,
    },
    {
      eyebrow: "Bước 5 · Trưởng dự án",
      title: "Bạn giữ quyền, người khác theo dõi.",
      text: "Người tạo dự án là trưởng dự án: sửa bảng việc, cấp hoặc gia hạn thời gian xem, gỡ người tham gia. Thành viên xem bản chỉ đọc và có thể xin gia hạn ngay trong dự án.",
      list: ["Quản lý người xem ở Tài khoản → Người dùng & thời hạn", "Hết thời hạn là quyền xem tự khoá"],
      visual: `<div class="tv-roles">
        <div class="tv-role lead"><span class="tv-role-tag">Trưởng dự án</span><strong>Bạn</strong><span class="tv-role-row">Sửa bảng việc · Cấp thời hạn · Gia hạn</span></div>
        <div class="tv-role"><span class="tv-role-tag">Thành viên</span><strong>Chỉ xem</strong><span class="tv-role-row">Gửi yêu cầu gia hạn · Rời dự án</span></div>
      </div>`,
    },
  ];

  function tourHtml() {
    return `<div class="tour-shell" role="dialog" aria-modal="true" aria-label="Hướng dẫn sử dụng GUỒNG">
      <div class="tour-rail"><i data-tour-rail style="width:${100 / slides.length}%"></i></div>
      <div class="tour-top">
        <div class="tour-brand">
          <span class="tour-mark">G</span>
          <div><strong>GUỒNG</strong><em>Hướng dẫn nhanh · 1 phút</em></div>
        </div>
        <button class="tour-skip" type="button" data-tour-skip>Bỏ qua ${ICON("x")}</button>
      </div>
      <div class="tour-stage" data-tour-stage>
        <div class="tour-track">
          ${slides.map((slide, i) => `<section class="tour-slide${i === 0 ? " is-active" : ""}" data-tour-slide aria-hidden="${i === 0 ? "false" : "true"}">
            <div class="tour-visual">${slide.visual}</div>
            <div class="tour-copy">
              <span class="tour-eyebrow">${ICON("spark")} ${slide.eyebrow}</span>
              <h2 class="tour-title">${slide.title}</h2>
              <p class="tour-text">${slide.text}</p>
              <ul class="tour-list">${slide.list.map((item) => `<li>${ICON("check-circle")}<span>${item}</span></li>`).join("")}</ul>
            </div>
          </section>`).join("")}
        </div>
      </div>
      <div class="tour-foot">
        <div class="tour-progress">
          <div class="tour-dots" data-tour-dots>
            ${slides.map((_, i) => `<button class="tour-dot${i === 0 ? " on" : ""}" type="button" data-tour-dot="${i}" aria-label="Tới bước ${i + 1}"></button>`).join("")}
          </div>
          <span class="tour-count"><b data-tour-current>1</b> / ${slides.length}</span>
        </div>
        <div class="tour-btns">
          <button class="btn btn-ghost" type="button" data-tour-back hidden>Quay lại</button>
          <button class="btn btn-accent" type="button" data-tour-next>Tiếp tục ${ICON("arrow-right")}</button>
        </div>
      </div>
    </div>`;
  }

  function startTour(opts) {
    const options = opts || {};
    if (overlayEl || A._overlays.length) return null;
    const wrap = A.openOverlay(tourHtml(), {
      className: "tour-wrap",
      dismissible: false,
      focus: "[data-tour-next]",
      onClose: () => {
        markSeen();
        overlayEl = null;
      },
    });
    if (!wrap) return null;
    overlayEl = wrap;
    bindTour(wrap, options);
    return wrap;
  }

  function bindTour(wrap, options) {
    const stage = wrap.querySelector("[data-tour-stage]");
    const slidesEls = [...wrap.querySelectorAll("[data-tour-slide]")];
    const dots = [...wrap.querySelectorAll("[data-tour-dot]")];
    const rail = wrap.querySelector("[data-tour-rail]");
    const current = wrap.querySelector("[data-tour-current]");
    const backBtn = wrap.querySelector("[data-tour-back]");
    const nextBtn = wrap.querySelector("[data-tour-next]");
    let index = 0;

    function render(next) {
      index = Math.max(0, Math.min(slidesEls.length - 1, next));
      slidesEls.forEach((slide, i) => {
        slide.classList.toggle("is-active", i === index);
        slide.classList.toggle("is-before", i < index);
        slide.setAttribute("aria-hidden", i === index ? "false" : "true");
      });
      dots.forEach((dot, i) => dot.classList.toggle("on", i === index));
      current.textContent = String(index + 1);
      if (rail) rail.style.width = `${((index + 1) / slidesEls.length) * 100}%`;
      backBtn.hidden = index === 0;
      const last = index === slidesEls.length - 1;
      nextBtn.innerHTML = last ? `${ICON("spark")} Bắt đầu làm việc` : `Tiếp tục ${ICON("arrow-right")}`;
      nextBtn.classList.toggle("is-done", last);
    }

    function finish() {
      markSeen();
      A.closeOverlay(wrap);
      if (options.fromSettings) A.toast("Đã xem lại hướng dẫn. Làm việc thôi!", "success");
      else A.toast("Chúc bạn ít việc hơn mỗi ngày.", "success");
    }

    wrap.querySelector("[data-tour-skip]").addEventListener("click", () => {
      markSeen();
      A.closeOverlay(wrap);
      A.toast("Đã bỏ qua hướng dẫn. Xem lại trong Cài đặt.", "info");
    });
    backBtn.addEventListener("click", () => render(index - 1));
    nextBtn.addEventListener("click", () => {
      if (index >= slidesEls.length - 1) finish();
      else render(index + 1);
    });
    dots.forEach((dot) => dot.addEventListener("click", () => render(Number(dot.dataset.tourDot))));

    wrap.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (index < slidesEls.length - 1) render(index + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (index > 0) render(index - 1);
      }
    });

    let startX = null;
    let startY = 0;
    stage.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse") return;
      startX = event.clientX;
      startY = event.clientY;
    });
    stage.addEventListener("pointerup", (event) => {
      if (startX == null) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      startX = null;
      if (Math.abs(dx) < 44 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx < 0 && index < slidesEls.length - 1) render(index + 1);
      if (dx > 0 && index > 0) render(index - 1);
    });

    if (options.startAt) render(options.startAt);
  }

  A.startTour = startTour;

  function scheduleAuto(delay) {
    if (autoTimer) clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      autoTimer = null;
      if (overlayEl || A._overlays.length || seen()) return;
      startTour({ auto: true });
    }, delay);
  }

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-replay-tour]");
    if (!trigger) return;
    event.preventDefault();
    if (A._overlays.length) A.closeAllOverlays();
    window.setTimeout(() => startTour({ fromSettings: true }), 60);
  });

  window.addEventListener("guong:account", () => {
    if (overlayEl) return;
    scheduleAuto(900);
  });

  function boot() {
    if (!seen()) scheduleAuto(1000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
