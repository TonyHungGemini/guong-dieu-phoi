# GUỒNG — Bàn điều phối dự án App

Một ứng dụng quản lý giao việc gọn, trực quan cho tổ quản trị đang xây dựng App.
Chạy hoàn toàn trên trình duyệt, không cần máy chủ, không cần bước build.

## Điểm chính

- **Bảy không gian làm việc**: Tổng quan, Hôm nay, Bảng việc, Danh sách, Lịch, Đội ngũ, Báo cáo.
- **Rõ người, rõ việc, rõ nhịp**: ưu tiên thông minh, hạn chót, tải của từng thành viên, mốc dự án.
- **CRUD công việc đầy đủ**: mô tả, trạng thái, ưu tiên, người nhận, mảng, hạn, ước lượng, nhãn, việc nhỏ, liên kết, bình luận.
- **Kéo thả trên bảng việc**, đổi trạng thái nhanh trong danh sách, gán người ngay trên màn Đội ngũ.
- **Phiên tập trung**: chọn việc, đếm ngược 15/25/45 phút, lưu số phút hôm nay và chuỗi ngày.
- **Báo cáo tuần**: nhịp hoàn thành 8 tuần, sức khỏe từng mảng, đóng góp của thành viên; sao chép báo cáo hoặc in PDF.
- **Lưu trên thiết bị**: dữ liệu nằm trong `localStorage`, có sao lưu JSON, xuất CSV và nhập lại.
- **Giao diện sáng/tối**, font Be Vietnam Pro, bố cục responsive cho điện thoại.

## Chạy thử trên máy

Mở trực tiếp `index.html` bằng trình duyệt là được. Nếu muốn chạy qua HTTP (khuyến nghị để mọi tính năng lưu trữ hoạt động ổn định):

```bash
cd "App Quản lý giao việc"
python3 -m http.server 4173
```

Sau đó mở <http://localhost:4173>.

## Đưa lên GitHub Pages

1. Tạo repository mới trên GitHub, ví dụ `guong-task-board`.
2. Tải toàn bộ thư mục này lên nhánh `main` (không cần đưa thư mục `.git` bên ngoài vào).
3. Vào **Settings → Pages**.
4. Ở **Build and deployment**, chọn **Deploy from a branch**.
5. Chọn nhánh `main`, thư mục `/ (root)`, bấm **Save**.
6. Chờ khoảng 1 phút, trang sẽ có tại `https://<tên-tài-khoản>.github.io/guong-task-board/`.

Nếu dùng dòng lệnh, từ thư mục dự án:

```bash
git init
git add .
git commit -m "GUỒNG - bàn điều phối dự án App"
git branch -M main
git remote add origin https://github.com/<tên-tài-khoản>/guong-task-board.git
git push -u origin main
```

Tệp `.nojekyll` đã có sẵn để GitHub Pages phục vụ đúng các tệp tĩnh.

## Dữ liệu và sao lưu

- Dữ liệu được lưu riêng trên từng trình duyệt/thiết bị theo khóa `guong.v1`. Không có dữ liệu nào được gửi lên máy chủ.
- **Cài đặt & dữ liệu → Tải JSON** để sao lưu toàn bộ công việc, nhật ký, phiên tập trung và cài đặt.
- **Tải CSV** để mở bằng Excel/Google Sheets.
- **Nhập JSON** sẽ thay thế toàn bộ dữ liệu hiện có. Nên sao lưu trước khi nhập.
- **Khôi phục dữ liệu mẫu** đưa ứng dụng về 44 công việc ban đầu.
- Xóa dữ liệu trình duyệt cũng sẽ xóa dữ liệu ứng dụng; hãy sao lưu JSON định kỳ.

## Phím tắt

| Phím | Tác dụng |
| --- | --- |
| `⌘K` / `Ctrl K` | Mở tìm kiếm nhanh |
| `/` | Mở tìm kiếm nhanh |
| `N` | Tạo việc mới |
| `↑` `↓` | Di chuyển trong kết quả tìm kiếm |
| `Enter` | Mở kết quả đang chọn |
| `Esc` | Đóng hộp thoại/thanh bên |
| `⌘Enter` / `Ctrl Enter` | Lưu công việc hoặc gửi bình luận |

## Cấu trúc

```text
index.html          Khung ứng dụng, SVG icon, nạp CSS/JS
assets/data.js      Dữ liệu mẫu và hằng số
assets/core.js      Trạng thái, lưu trữ, tính toán, router, tiện ích
assets/views.js     Tổng quan và Hôm nay
assets/views2.js    Bảng việc, Danh sách, Lịch, Đội ngũ, Báo cáo
assets/actions.js   Hộp thoại công việc, tương tác, tìm kiếm, cài đặt
assets/base.css     Nền tảng giao diện và responsive
assets/views*.css   Giao diện riêng cho từng màn hình
```

## Tùy chỉnh nhanh

- Sửa dữ liệu mẫu trong `assets/data.js` để đổi thành viên, mảng công việc, mốc dự án và công việc.
- Sửa bảng màu, font và khoảng cách trong `assets/base.css` (phần biến `:root`).
- Đổi tên dự án ngay trong **Cài đặt & dữ liệu**; tên mới được lưu cùng dữ liệu.

Không có thư viện ngoài, không có API, không cần cài đặt phụ thuộc.
