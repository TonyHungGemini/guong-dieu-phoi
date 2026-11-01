import { ReportItem, ReportTemplate } from '../types';

export const INITIAL_REPORTS: ReportItem[] = [
  {
    id: 'report-1',
    title: 'Báo cáo Doanh Thu & KPIs Tháng 07/2026',
    category: 'Báo cáo tháng',
    project: 'Tài chính & Thuế',
    date: '2026-07-31',
    reminderTime: '17:00',
    status: 'Done',
    path: '/Documents/Reports/2026-07_Monthly_Revenue_KPI.pdf',
    fileName: '2026-07_Monthly_Revenue_KPI.pdf',
    fileSizeFormatted: '2.4 MB',
    notes: 'Tổng doanh thu tháng đạt 108% so với chỉ tiêu kế hoạch. Đã có phê duyệt chính thức từ Giám đốc Tài chính.',
    version: 1,
    pinned: true,
    agentEnabled: true,
    submissionUrl: 'https://base.vn/',
    zaloPhone: '0912345678',
    aiSummary: '• Doanh thu thuần: +18% MoM\n• Chi phí vận hành tối ưu giảm 5.2%\n• Dự báo tăng trưởng Q3 tiếp tục khả quan',
    aiActionItems: ['Chốt số liệu kiểm toán thuế quý 2', 'Lập ngân sách dự phòng tháng 8'],
    aiQualityScore: 95,
    createdAt: '2026-07-31T09:00:00.000Z',
    updatedAt: '2026-07-31T17:30:00.000Z',
    lastSentAt: '2026-07-31T17:05:00.000Z'
  },
  {
    id: 'report-2',
    title: 'Báo cáo Tiến Độ Phát Triển Phần Mềm Tuần 30',
    category: 'Báo cáo tuần',
    project: 'Kỹ thuật IT',
    date: '2026-08-03',
    reminderTime: '09:00',
    status: 'In Progress',
    path: '/Documents/Dev/2026-W30_Software_Progress.docx',
    fileName: '2026-W30_Software_Progress.docx',
    fileSizeFormatted: '1.1 MB',
    notes: 'Đã hoàn thành module UI PWA Offline & IndexedDB. Đang chuẩn bị kiểm thử tải hệ thống.',
    version: 2,
    pinned: true,
    agentEnabled: true,
    submissionUrl: 'https://base.vn/',
    createdAt: '2026-07-28T08:00:00.000Z',
    updatedAt: '2026-08-01T06:00:00.000Z'
  },
  {
    id: 'report-3',
    title: 'Báo cáo Vận Hành Máy Chủ & Hạ Tầng Ngày 01/08/2026',
    category: 'Báo cáo ngày',
    project: 'Kỹ thuật IT',
    date: '2026-08-01',
    reminderTime: '18:00',
    status: 'To-do',
    path: '/Documents/Daily/2026-08-01_Ops_Daily_Check.xlsx',
    fileName: '2026-08-01_Ops_Daily_Check.xlsx',
    fileSizeFormatted: '850 KB',
    notes: 'Kiểm tra log server Cloud Run, uptime đạt 99.99%, bộ nhớ RAM trung bình 34%.',
    version: 1,
    pinned: true,
    agentEnabled: true,
    submissionUrl: 'https://base.vn/',
    createdAt: '2026-08-01T07:00:00.000Z',
    updatedAt: '2026-08-01T07:00:00.000Z'
  },
  {
    id: 'report-4',
    title: 'Báo cáo Kiểm Toán An Ninh Thông Tin & Bảo Mật Q3',
    category: 'Tài liệu khác',
    project: 'An ninh & Tuân thủ',
    date: '2026-07-15',
    reminderTime: '14:00',
    status: 'Pending Review',
    path: '/Documents/Security/2026_Q3_Security_Audit.pdf',
    fileName: '2026_Q3_Security_Audit.pdf',
    fileSizeFormatted: '4.8 MB',
    notes: 'Rà soát lỗ hổng bảo mật toàn bộ các điểm cuối API và chứng chỉ SSL.',
    version: 1,
    pinned: false,
    agentEnabled: false,
    submissionUrl: 'https://base.vn/',
    createdAt: '2026-07-15T14:20:00.000Z',
    updatedAt: '2026-07-15T14:20:00.000Z'
  },
  {
    id: 'report-5',
    title: 'Báo cáo Kết Quả Chiến Dịch Marketing Mùa Hè 2026',
    category: 'Báo cáo tháng',
    project: 'Marketing & Growth',
    date: '2026-07-29',
    reminderTime: '16:00',
    status: 'Sent',
    path: '/Documents/Marketing/2026-07_Summer_Campaign_Report.pdf',
    fileName: '2026-07_Summer_Campaign_Report.pdf',
    fileSizeFormatted: '3.2 MB',
    notes: 'Chiến dịch đạt 140,000 lượt chuyển đổi, chi phí CAC giảm 12% so với dự tính.',
    version: 1,
    pinned: false,
    agentEnabled: true,
    submissionUrl: 'https://base.vn/',
    createdAt: '2026-07-29T10:00:00.000Z',
    updatedAt: '2026-07-29T16:01:00.000Z',
    lastSentAt: '2026-07-29T16:01:00.000Z'
  }
];

export const BUILTIN_TEMPLATES: ReportTemplate[] = [
  {
    id: 'tpl-daily-standup',
    title: 'Báo Cáo Giao Ban Hằng Ngày (Daily Standup)',
    category: 'Báo cáo ngày',
    project: 'Vận hành chung',
    description: 'Mẫu báo cáo nhanh công việc ngày gồm: Đã làm hôm qua, Kế hoạch hôm nay và Các vướng mắc (Blockers).',
    suggestedFilenameConvention: 'YYYY-MM-DD_{Project}_Daily_Report_v1',
    sampleContent: `=== BÁO CÁO GIAO BAN NGÀY {DATE} ===
Dự án / Phòng ban: {PROJECT}
Người lập: {AUTHOR}

1. CÔNG VIỆC ĐÃ HOÀN THÀNH HÔM QUA:
- [x] Hoàn thiện giao diện PWA và cài đặt Service Worker.
- [x] Tối ưu hóa truy vấn IndexedDB lưu trữ file báo cáo local.

2. KẾ HOẠCH HÔM NAY:
- [ ] Tích hợp Gemini AI API tóm tắt nội dung báo cáo tự động.
- [ ] Kiểm thử Automation Agent gửi webhook Zapier/Make.

3. KHOẢN VƯỚNG MẮC (BLOCKERS):
- Không có vướng mắc nghiêm trọng.`
  },
  {
    id: 'tpl-weekly-progress',
    title: 'Báo Cáo Tiến Độ Công Việc Tuần (Weekly Status)',
    category: 'Báo cáo tuần',
    project: 'Kỹ thuật IT',
    description: 'Mẫu báo cáo tuần đánh giá phần trăm hoàn thành, KPIs, danh sách deliverables và kế hoạch tuần tiếp theo.',
    suggestedFilenameConvention: 'YYYY-W{WEEK}_{Project}_Weekly_Progress_v1',
    sampleContent: `=== BÁO CÁO TIẾN ĐỘ TUẦN {WEEK} / 2026 ===
Dự án: {PROJECT}

I. ĐÁNH GIÁ TỔNG QUAN:
- Tiến độ tổng thể: 95% (Đạt kế hoạch)
- Chất lượng sản phẩm: Đảm bảo kiểm thử 0 lỗi critical

II. CHI TIẾT KẾT QUẢ ĐẠT ĐƯỢC:
1. Tính năng PWA Offline: Đã nghiệm thu
2. Tích hợp Lịch làm việc & Nhắc nhở Web Push Notification: Hoàn tất
3. Automation Agent tự động cập nhật trạng thái "Sent": Đạt 100%

III. KẾ HOẠCH TUẦN TIẾP THEO:
- Bàn giao tài liệu hướng dẫn vận hành cho người dùng cuối.`
  },
  {
    id: 'tpl-monthly-financial',
    title: 'Báo Cáo Tài Chính & Doanh Thu Tháng (Monthly Revenue)',
    category: 'Báo cáo tháng',
    project: 'Tài chính & Thuế',
    description: 'Báo cáo tổng kết doanh thu, chi phí vận hành, lợi nhuận ròng và so sánh kế hoạch KPIs tháng.',
    suggestedFilenameConvention: 'YYYY-MM_{Project}_Financial_Report_v1',
    sampleContent: `=== BÁO CÁO TÀI CHÍNH THÁNG {MONTH} / 2026 ===
Đơn vị tính: VNĐ

1. DOANH THU THUẦN: 2,450,000,000 VNĐ (Đạt 108% kế hoạch)
2. CHI PHÍ VẬN HÀNH: 1,120,000,000 VNĐ
3. LỢI NHUẬN TRƯỚC THUẾ: 1,330,000,000 VNĐ

ĐÁNH GIÁ CỦA TRƯỞNG PHÒNG:
Doanh thu tăng trưởng ổn định ở mảng dịch vụ trực tuyến. Cần tiếp tục duy trì chính sách tối ưu chi phí hạ tầng.`
  }
];

export const INITIAL_REF_DOCS: any[] = [
  {
    id: 'ref-001',
    title: 'Bảng Cân Đối Số Liệu Tài Chính & KPIs Q2/2026',
    category: 'Số liệu tài chính',
    description: 'Bảng tổng hợp doanh thu, biên lợi nhuận gộp và chi phí vận hành chi tiết các phòng ban Q2.',
    keyMetrics: '• Doanh thu Q2: 15.8 tỷ VNĐ (+14% YoYo)\n• Lợi nhuận trước thuế: 3.2 tỷ VNĐ\n• Margin: 20.2%\n• Chi phí Marketing: 1.1 tỷ VNĐ (tối ưu 8.5%)',
    fileName: 'Bang_So_Lieu_Tai_Chinh_Q2_2026.xlsx',
    fileSizeFormatted: '1.4 MB',
    fileType: 'xlsx',
    externalUrl: 'https://base.vn/',
    pinned: true,
    tags: ['Tài chính', 'KPIs', 'Q2-2026'],
    createdAt: '2026-07-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z'
  },
  {
    id: 'ref-002',
    title: 'Quy Trình & Mẫu Biểu Nộp Báo Cáo Chuẩn Base.vn',
    category: 'Mẫu biểu & Hướng dẫn',
    description: 'Hướng dẫn chuẩn hóa tên file báo cáo [DD-MM-YYYY]_[TênBáoCáo]_[TrạngThái] và quy cách đính kèm văn bản.',
    keyMetrics: 'Cú pháp chuẩn: [DD-MM-YYYY]_[Title]_[Status].xlsx\nCổng tiếp nhận: Base.vn Workflow Management System',
    fileName: 'Quy_Trinh_Nop_Bao_Cao_BaseVN.pdf',
    fileSizeFormatted: '850 KB',
    fileType: 'pdf',
    externalUrl: 'https://base.vn/',
    pinned: true,
    tags: ['Base.vn', 'Quy trình', 'Chuẩn hóa'],
    createdAt: '2026-07-10T09:30:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z'
  },
  {
    id: 'ref-003',
    title: 'Chỉ Số KPIs & Mục Tiêu Doanh Số Khối Kinh Doanh 2026',
    category: 'KPIs & Doanh số',
    description: 'Hồ sơ chỉ tiêu KPIs chi tiết cho từng nhóm kinh doanh, tỷ lệ chuyển đổi khách hàng và kế hoạch mở rộng thị trường.',
    keyMetrics: '• Chỉ tiêu năm 2026: 60 tỷ VNĐ\n• KPIs Tháng 8: 5.2 tỷ VNĐ\n• Tỷ lệ chốt hợp đồng mục tiêu: > 18%',
    fileName: 'Muc_Tieu_Doanh_So_Khoi_KD_2026.docx',
    fileSizeFormatted: '2.1 MB',
    fileType: 'docx',
    externalUrl: '',
    pinned: false,
    tags: ['Doanh số', 'Kinh doanh', 'KPIs'],
    createdAt: '2026-07-15T10:00:00.000Z',
    updatedAt: '2026-07-15T10:00:00.000Z'
  }
];
