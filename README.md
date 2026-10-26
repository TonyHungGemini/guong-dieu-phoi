# GUỒNG — Bàn điều phối dự án App

Ứng dụng quản lý giao việc gọn, trực quan cho tổ quản trị đang xây dựng App.
Chạy hoàn toàn trên trình duyệt, không cần máy chủ, không cần bước build. Cài được như PWA và mở lại khi mất mạng.

**Bản chạy trực tuyến:** <https://tonyhunggemini.github.io/guong-dieu-phoi/>

**Mã nguồn:** <https://github.com/TonyHungGemini/guong-dieu-phoi>

## Bắt đầu trong 3 bước

Ứng dụng mở ra với bàn làm việc trống — không có thành viên hay công việc mẫu.

1. **Thêm người vào tổ:** mở **Đội ngũ → Thêm thành viên**, nhập tên, vai trò và năng lực/tuần. Người đầu tiên tự động được chọn là **“Bạn”** (góc trên bên phải). Có thể đổi “Bạn” bất cứ lúc nào trong **Cài đặt & dữ liệu → Bạn trong tổ**.
2. **Giao việc:** bấm **Giao việc** ở góc trên, hoặc nút **+** trên điện thoại. Chọn người nhận, hạn chót, ưu tiên, mảng và ước lượng.
3. **Cài ứng dụng:** mở **Cài đặt & dữ liệu → Cài ứng dụng** để cài GUỒNG lên màn hình chính (xem hướng dẫn bên dưới).

Mẹo: trên màn **Đội ngũ**, bấm vào một thành viên để xem tải việc và giao việc nhanh cho đúng người.

## Điểm chính

- **Bảy không gian làm việc**: Tổng quan, Hôm nay, Bảng việc, Danh sách, Lịch, Đội ngũ, Báo cáo.
- **Quản lý thành viên**: thêm, sửa, xoá; chọn màu, vai trò, năng lực tuần; xem tải việc từng người.
- **Rõ người, rõ việc, rõ nhịp**: ưu tiên thông minh, hạn chót, mốc dự án, cảnh báo quá tải.
- **CRUD công việc đầy đủ**: mô tả, trạng thái, ưu tiên, người nhận, mảng, hạn, ước lượng, nhãn, việc nhỏ, liên kết, bình luận.
- **Kéo thả trên bảng việc**, đổi trạng thái nhanh trong danh sách, giao việc ngay trên màn Đội ngũ.
- **Phiên tập trung**: chọn việc, đếm ngược 15/25/45 phút, lưu số phút hôm nay và chuỗi ngày.
- **Báo cáo tuần**: nhịp hoàn thành 8 tuần, sức khỏe từng mảng, đóng góp của thành viên; sao chép báo cáo hoặc in PDF.
- **PWA**: cài lên màn hình chính, mở toàn màn hình, dùng được khi mất mạng sau lần tải đầu.
- **Dữ liệu riêng trên thiết bị**: `localStorage`, có sao lưu JSON, xuất CSV và nhập lại.
- **Giao diện sáng/tối**, font Be Vietnam Pro, bố cục responsive cho điện thoại.

## Dữ liệu nằm ở đâu — điều cần biết trước khi mời cả tổ

GUỒNG là ứng dụng tĩnh, **không có tài khoản và không có máy chủ đồng bộ**. Dữ liệu được lưu trong `localStorage` của đúng trình duyệt/thiết bị đang mở, theo khóa `guong.v2`.

- Thêm tên thành viên **không tạo tài khoản** cho họ và **không mời được** họ vào chung dữ liệu.
- Gửi đường link cho đồng nghiệp chỉ mở cùng giao diện; mỗi người có bàn làm việc riêng, trống hoặc dữ liệu riêng của họ.
- Không ai nhìn thấy thay đổi của người khác theo thời gian thực.
- Cách chuyển dữ liệu giữa các máy: **Cài đặt & dữ liệu → Xuất JSON** ở máy nguồn, rồi **Nhập JSON** ở máy đích (nhập sẽ thay thế toàn bộ dữ liệu hiện có). Xuất JSON định kỳ để sao lưu.
- Muốn cả tổ cùng cập nhật trên một bảng việc thật sự thì cần thêm backend (Firebase, Supabase, Google Sheets hoặc API riêng). Bản hiện tại chỉ chia sẻ được “bộ khung” giao diện, không chia sẻ dữ liệu.

Nếu chỉ một người phụ trách điều phối và cập nhật, mô hình hiện tại là đủ: người đó giữ bàn làm việc, cả tổ xem báo cáo qua màn hình chung hoặc bản in/CSV.

## Cài PWA

Sau khi mở trang bằng HTTPS (bản GitHub Pages) hoặc `localhost`:

- **Android / Chrome, Edge:** bấm nút **Cài ứng dụng** trong Cài đặt, hoặc menu ⋮ → **Cài đặt ứng dụng / Thêm vào màn hình chính**.
- **iPhone / iPad:** mở bằng **Safari** → nút **Chia sẻ** → **Thêm vào Màn hình chính**.
- **Máy tính:** bấm biểu tượng cài đặt trên thanh địa chỉ Chrome / Edge, hoặc nút **Cài ứng dụng** trong Cài đặt.

Sau lần tải đầu, service worker giữ sẵn bộ khung ứng dụng để mở lại khi mất mạng. Dữ liệu vẫn nằm trong trình duyệt của thiết bị đó. Khi cập nhật mã nguồn, tăng `VERSION` trong `sw.js` để bộ đệm cũ được thay thế.

## Chạy thử trên máy

Mở trực tiếp `index.html` bằng trình duyệt là được. Nên chạy qua HTTP để PWA và mọi tính năng lưu trữ hoạt động đúng:

```bash
cd "App Quản lý giao việc"
python3 -m http.server 4173
```

Sau đó mở <http://localhost:4173>.

## Đưa lên GitHub Pages

Repo công khai: <https://github.com/TonyHungGemini/guong-dieu-phoi>, GitHub Pages bật từ nhánh `main`, thư mục `/ (root)`. Mỗi lần cập nhật nhánh này, trang tự phát hành lại sau khoảng một phút.

Cách cập nhật bằng Git:

```bash
git clone https://github.com/TonyHungGemini/guong-dieu-phoi.git
cd guong-dieu-phoi
# sao chép các tệp đã sửa vào đây, gồm cả manifest.webmanifest và sw.js
git add .
git commit -m "Cập nhật GUỒNG"
git push origin main
```

Hoặc vào repo, chọn **Add file → Upload files**, tải các tệp cần cập nhật rồi **Commit changes**. Lưu ý GitHub web tải thư mục sẽ làm phẳng cấu trúc: tải tệp gốc và thư mục `assets/` riêng.

Kiểm tra **Settings → Pages**: nguồn **Deploy from a branch**, nhánh `main`, thư mục `/ (root)`. Tệp `.nojekyll` đã có sẵn.

## Sao lưu và xuất dữ liệu

- **Cài đặt & dữ liệu → Xuất JSON**: toàn bộ thành viên, công việc, nhật ký, phiên tập trung, mốc và cài đặt.
- **Xuất CSV**: mở bằng Excel/Google Sheets để báo cáo nhanh.
- **Nhập JSON**: thay thế toàn bộ dữ liệu hiện có; nên xuất bản sao lưu trước.
- **Xoá toàn bộ**: đưa ứng dụng về bàn làm việc trống (không thể hoàn tác nếu chưa sao lưu).
- Xoá dữ liệu trình duyệt cũng sẽ xoá dữ liệu ứng dụng.

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
index.html              Khung ứng dụng, SVG icon, nạp CSS/JS
manifest.webmanifest    Khai báo PWA (tên, màu, icon, chế độ standalone)
sw.js                   Service worker: precache bộ khung, điều phối bộ đệm
assets/data.js          Dữ liệu khung (mảng việc, nhãn, màu) và hàm tạo trạng thái trống
assets/core.js          Trạng thái, lưu trữ, tính toán, router, tiện ích
assets/views.js         Tổng quan và Hôm nay
assets/views2.js        Bảng việc, Danh sách, Lịch, Đội ngũ, Báo cáo
assets/actions.js       Hộp thoại công việc, thành viên, tương tác, tìm kiếm, cài đặt
assets/base.css         Nền tảng giao diện, biến màu sáng/tối, responsive
assets/views*.css       Giao diện riêng cho từng màn hình
assets/favicon.svg      Biểu tượng vector
assets/icon-*.png       Icon PWA 192/512 và bản maskable
assets/apple-touch-icon.png
```

## Tùy chỉnh nhanh

- Đổi tên dự án ngay trong **Cài đặt & dữ liệu**; tên mới được lưu cùng dữ liệu.
- Sửa mảng công việc và nhãn trong `assets/data.js`; màu thành viên nằm cùng tệp.
- Sửa bảng màu, font, khoảng cách trong `assets/base.css` (phần biến `:root` và `[data-theme="dark"]`).
- Đổi icon: thay các tệp PNG trong `assets/`, cập nhật `manifest.webmanifest` và danh sách `SHELL` trong `sw.js`.

Không có thư viện ngoài, không có API, không cần cài đặt phụ thuộc.
