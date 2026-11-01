import React, { useState, useEffect } from 'react';
import { X, Upload, Folder, Calendar, Clock, Link2, Bot, FileText, Check, AlertCircle, MessageCircle, Download, RefreshCw, Trash2, CloudUpload, CheckCircle, WifiOff, Loader2, RotateCw } from 'lucide-react';
import { ReportItem, ReportCategory, ReportStatus, ReportFrequency, StoredFileBlob, RefDocument, GoogleUserProfile } from '../types';
import { dbService } from '../lib/db';
import { openOrDownloadReportFile } from '../lib/submitWorkflow';
import { uploadFileToDrive } from '../lib/googleDriveService';
import { inferFrequencyFromCategory, getFrequencyLabel } from '../lib/scheduleUtils';

interface DocFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportToEdit?: ReportItem | null;
  onSaveReport: (report: ReportItem) => Promise<void>;
  defaultDate?: string;
  defaultCategory?: string;
  initialTemplateContent?: string;
  refDocs?: RefDocument[];
  userProfile?: GoogleUserProfile | null;
  onRequireLogin?: () => void;
}

export const DocFormModal: React.FC<DocFormModalProps> = ({
  isOpen,
  onClose,
  reportToEdit,
  onSaveReport,
  defaultDate,
  defaultCategory,
  initialTemplateContent,
  refDocs = [],
  userProfile,
  onRequireLogin,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ReportCategory>('Báo cáo ngày');
  const [frequency, setFrequency] = useState<ReportFrequency>('daily');
  const [project, setProject] = useState('Kỹ thuật IT');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reminderTime, setReminderTime] = useState('17:00');
  const [status, setStatus] = useState<ReportStatus>('To-do');
  const [path, setPath] = useState('/Documents/Reports/baocao.pdf');
  const [notes, setNotes] = useState('');
  const [pinned, setPinned] = useState(false);

  // Drive Cloud Links & Sync state
  const [driveFileId, setDriveFileId] = useState<string | undefined>(undefined);
  const [webViewLink, setWebViewLink] = useState<string | undefined>(undefined);
  const [webContentLink, setWebContentLink] = useState<string | undefined>(undefined);
  const [pendingSync, setPendingSync] = useState(false);
  const [isUploadingDrive, setIsUploadingDrive] = useState(false);
  const [driveStatusText, setDriveStatusText] = useState('');

  // One-Click Submission Fields
  const [agentEnabled, setAgentEnabled] = useState(true);
  const [submissionUrl, setSubmissionUrl] = useState('https://base.vn/');
  const [zaloPhone, setZaloPhone] = useState('0912345678');

  // Drag & drop file state
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [fileBlobId, setFileBlobId] = useState<string | undefined>(undefined);
  const [fileSizeFormatted, setFileSizeFormatted] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (reportToEdit) {
      setTitle(reportToEdit.title);
      setCategory(reportToEdit.category);
      setFrequency(reportToEdit.frequency || inferFrequencyFromCategory(reportToEdit.category, reportToEdit.frequency));
      setProject(reportToEdit.project);
      setDate(reportToEdit.dueDate || reportToEdit.date);
      setReminderTime(reportToEdit.reminderTime || '17:00');
      setStatus(reportToEdit.status);
      setPath(reportToEdit.path);
      setNotes(reportToEdit.notes || '');
      setPinned(!!reportToEdit.pinned);
      setAgentEnabled(!!reportToEdit.agentEnabled);
      setSubmissionUrl(reportToEdit.submissionUrl || 'https://base.vn/');
      setZaloPhone(reportToEdit.zaloPhone || '0912345678');
      setFileBlobId(reportToEdit.fileBlobId);
      setFileSizeFormatted(reportToEdit.fileSizeFormatted);
      setDriveFileId(reportToEdit.driveFileId);
      setWebViewLink(reportToEdit.webViewLink);
      setWebContentLink(reportToEdit.webContentLink);
      setPendingSync(!!reportToEdit.pendingSync);
      setDriveStatusText(reportToEdit.webViewLink ? 'Đã lưu trên Google Drive' : (reportToEdit.pendingSync ? 'Chờ đồng bộ Drive (Offline)' : ''));
    } else {
      const today = defaultDate || new Date().toISOString().split('T')[0];
      const initialCat = (defaultCategory as ReportCategory) || 'Báo cáo ngày';
      setDate(today);
      setCategory(initialCat);
      setFrequency(inferFrequencyFromCategory(initialCat));
      const initTitle = initialTemplateContent ? 'Báo cáo mới từ mẫu' : '';
      setTitle(initTitle);
      setNotes(initialTemplateContent || '');
      setProject('Kỹ thuật IT');
      setReminderTime('17:00');
      setStatus('To-do');
      setPath(`/Documents/Reports/${today}_Report.pdf`);
      setPinned(false);
      setAgentEnabled(true);
      setSubmissionUrl('https://base.vn/');
      setZaloPhone('0912345678');
      setUploadingFile(null);
      setFileBlobId(undefined);
      setFileSizeFormatted(undefined);
      setDriveFileId(undefined);
      setWebViewLink(undefined);
      setWebContentLink(undefined);
      setPendingSync(false);
      setDriveStatusText('');
    }
  }, [reportToEdit, isOpen, defaultDate, defaultCategory, initialTemplateContent]);

  if (!isOpen) return null;

  const handleFileUpload = async (file: File) => {
    setUploadingFile(file);
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    const sizeFormatted = file.size > 1024 * 1024 ? `${sizeMb} MB` : `${Math.round(file.size / 1024)} KB`;
    setFileSizeFormatted(sizeFormatted);

    // Read base64Data for reliable cross-device and cloud sync
    let base64Data: string | undefined = undefined;
    try {
      base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } catch (e) {
      console.warn('Could not read base64 data:', e);
    }

    // 1. Save local blob to IndexedDB
    const blobId = 'blob-' + Date.now();
    const fileBlobRecord: StoredFileBlob = {
      id: blobId,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      blob: file,
      base64Data,
      updatedAt: new Date().toISOString()
    };

    await dbService.saveFileBlob(fileBlobRecord);
    setFileBlobId(blobId);

    // Auto set path & title if empty
    setPath(`/Documents/Uploads/${file.name}`);
    if (!title) {
      const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      setTitle(nameWithoutExt.replace(/_/g, ' ').replace(/-/g, ' '));
    }

    // 2. Google Drive Auto-Upload Execution
    if (userProfile?.accessToken && navigator.onLine) {
      setIsUploadingDrive(true);
      setDriveStatusText('Uploading to Drive...');
      try {
        const driveResult = await uploadFileToDrive(
          userProfile.accessToken,
          file,
          file.name,
          file.type
        );
        setDriveFileId(driveResult.fileId);
        setWebViewLink(driveResult.webViewLink);
        setWebContentLink(driveResult.webContentLink);
        setPendingSync(false);
        setDriveStatusText('Upload Google Drive Thành Công!');
        setPath(driveResult.webViewLink); // Auto set drive link to path
      } catch (err: any) {
        console.warn('Google Drive Upload Warning:', err);
        setPendingSync(true);
        setDriveStatusText('Lưu Offline - Chờ đồng bộ Drive (Pending Sync)');
      } finally {
        setIsUploadingDrive(false);
      }
    } else {
      setPendingSync(true);
      setDriveStatusText(navigator.onLine ? 'Đã lưu local (Đăng nhập Google để tự động upload Drive)' : 'Chế độ Offline - Chờ đồng bộ Drive');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const updatedReport: ReportItem = {
      id: reportToEdit ? reportToEdit.id : 'report-' + Date.now(),
      title: title || 'Báo cáo không tên',
      category,
      frequency,
      dueDate: date,
      project: project || 'Chung',
      date,
      reminderTime,
      status,
      path: path || `/Documents/${date}_Report.pdf`,
      fileName: uploadingFile ? uploadingFile.name : (reportToEdit?.fileName || path.split('/').pop()),
      fileBlobId: fileBlobId || reportToEdit?.fileBlobId,
      fileSizeFormatted: fileSizeFormatted || reportToEdit?.fileSizeFormatted || '1.2 MB',
      notes,
      version: reportToEdit ? reportToEdit.version + 1 : 1,
      pinned,
      driveFileId: driveFileId || reportToEdit?.driveFileId,
      webViewLink: webViewLink || reportToEdit?.webViewLink,
      webContentLink: webContentLink || reportToEdit?.webContentLink,
      pendingSync: pendingSync !== undefined ? pendingSync : (reportToEdit?.pendingSync || false),
      lastLocalBackupDate: reportToEdit?.lastLocalBackupDate,
      agentEnabled,
      submissionUrl: submissionUrl || 'https://base.vn/',
      zaloPhone: zaloPhone || '0912345678',
      createdAt: reportToEdit ? reportToEdit.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await onSaveReport(updatedReport);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-baemin text-slate-950 flex items-center justify-center shadow-baemin font-bold">
              <FileText className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                {reportToEdit ? 'Chỉnh Sửa Báo Cáo' : 'Thêm Báo Cáo & Đặt Lịch Tự Động'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nhập thông tin, tải file đính kèm và cài đặt Automation Agent
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Tên Báo Cáo / Tài Liệu <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Báo cáo doanh thu & KPIs Tháng 08/2026..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
              required
            />
          </div>

          {/* Row 2: Category, Project, Schedule Frequency, Date Picker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Danh Mục Báo Cáo
              </label>
              <select
                value={category}
                onChange={(e) => {
                  const newCat = e.target.value as ReportCategory;
                  setCategory(newCat);
                  setFrequency(inferFrequencyFromCategory(newCat));
                }}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
              >
                <option value="Báo cáo ngày">Báo cáo ngày</option>
                <option value="Báo cáo tuần">Báo cáo tuần</option>
                <option value="Báo cáo tháng">Báo cáo tháng</option>
                <option value="Tài liệu khác">Tài liệu khác</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                <RotateCw className="w-3 h-3 text-indigo-500" /> Chu kỳ Tự động Chuyển (Auto-Advance)
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as ReportFrequency)}
                className="w-full px-3.5 py-2 bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300 focus:border-indigo-500 focus:outline-none"
              >
                <option value="daily">🔁 Hàng ngày (Daily - Auto advance at 0:00)</option>
                <option value="weekly">🔁 Hàng tuần (Weekly - Next Monday)</option>
                <option value="monthly">🔁 Hàng tháng (Monthly - 1st of next month)</option>
                <option value="yearly">🔁 Hàng năm (Yearly - Jan 1st of next year)</option>
                <option value="none">Thủ công (None - Không tự chuyển)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Dự Án / Mục Đích
              </label>
              <input
                type="text"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                placeholder="Ví dụ: Kỹ thuật IT, Tài chính, Marketing..."
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Hạn Chót (Manual Date Picker)</span>
                <span className="text-[10px] text-indigo-500 font-normal">Có thể chỉnh thủ công</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Auto-Advance Schedule Info Alert */}
          {frequency !== 'none' && (
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-start gap-2.5 text-xs text-indigo-900 dark:text-indigo-200">
              <RotateCw className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5 animate-spin-slow" />
              <div>
                <p className="font-bold">Lịch Lập Lại Tự Động ({getFrequencyLabel(frequency)}):</p>
                <p className="text-[11px] opacity-80 mt-0.5">
                  Khi báo cáo được đánh dấu <strong className="text-emerald-600 dark:text-emerald-400">Done</strong> hoặc <strong className="text-blue-600 dark:text-blue-400">Sent</strong>, PWA sẽ tự động nhận biết khi bước sang ngày/tuần/tháng mới (0:00 AM) để cập nhật Hạn Chót và reset trạng thái về <strong className="text-rose-600 dark:text-rose-400">To-do</strong>.
                </p>
              </div>
            </div>
          )}

          {/* File Management & Upload Area */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Upload File Báo Cáo (Tự động tải lên Google Drive folder PWA_Report_Manager)
              </label>
              {isUploadingDrive && (
                <span className="text-xs font-bold text-amber-500 flex items-center gap-1.5 animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                  Uploading to Drive...
                </span>
              )}
            </div>

            {/* Hidden File Input */}
            <input
              type="file"
              id="filePickerInput"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              className="hidden"
            />

            {(fileBlobId || uploadingFile || reportToEdit?.fileName || webViewLink) ? (
              /* Attached File Card with Direct Access & Replace Controls */
              <div className="bg-emerald-50/50 dark:bg-slate-950 border border-emerald-500/30 dark:border-emerald-500/40 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-xl shrink-0 border border-emerald-500/20">
                      <FileText className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                          File Đã Tải
                        </span>
                        {webViewLink ? (
                          <span className="text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <CloudUpload className="w-3 h-3 text-blue-500" /> Google Drive
                          </span>
                        ) : pendingSync ? (
                          <span className="text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <WifiOff className="w-3 h-3 text-amber-500" /> Pending Sync
                          </span>
                        ) : null}
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {fileSizeFormatted || '1.2 MB'}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate mt-0.5">
                        {uploadingFile ? uploadingFile.name : (reportToEdit?.fileName || path.split('/').pop() || 'BaoCao.pdf')}
                      </p>
                      {driveStatusText && (
                        <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">
                          {driveStatusText}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setUploadingFile(null);
                      setFileBlobId(undefined);
                      setFileSizeFormatted(undefined);
                      setWebViewLink(undefined);
                      setWebContentLink(undefined);
                      setDriveFileId(undefined);
                      setDriveStatusText('');
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                    title="Xóa file đính kèm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* File Action Buttons */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-800/80">
                  <button
                    type="button"
                    onClick={async () => {
                      if (uploadingFile) {
                        const url = URL.createObjectURL(uploadingFile);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = uploadingFile.name;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        setTimeout(() => URL.revokeObjectURL(url), 10000);
                      } else if (reportToEdit) {
                        await openOrDownloadReportFile(reportToEdit);
                      } else if (webViewLink) {
                        window.open(webViewLink, '_blank');
                      }
                    }}
                    className="flex-1 py-2 px-3 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Tải File / Xem File</span>
                  </button>

                  <label
                    htmlFor="filePickerInput"
                    className="flex-1 py-2 px-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Thay Thế File Mới</span>
                  </label>
                </div>
              </div>
            ) : (
              /* Drag & Drop Area if no file is attached */
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="border-2 border-dashed border-slate-300 dark:border-slate-800 hover:border-baemin/60 bg-slate-50 dark:bg-slate-950/60 rounded-2xl p-4 text-center cursor-pointer transition-all"
              >
                <label htmlFor="filePickerInput" className="cursor-pointer block">
                  <CloudUpload className="w-8 h-8 text-indigo-500 mx-auto mb-2 opacity-90 animate-bounce" />
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Kéo thả file vào đây hoặc <span className="text-indigo-600 dark:text-indigo-400 underline font-extrabold">chọn file từ máy tính</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Hệ thống sẽ <strong className="text-indigo-600 dark:text-indigo-400">tự động tải lên thư mục PWA_Report_Manager</strong> trên Google Drive.
                  </p>
                  {!userProfile && (
                    <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 mt-1">
                      💡 Mẹo: Đăng nhập Google để tự động upload trực tiếp lên Drive.
                    </p>
                  )}
                </label>
              </div>
            )}
          </div>

          {/* File Path input */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Đường dẫn File / URL Tham Chiếu
            </label>
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-300 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Report Submission URL & Zalo Approver Configuration */}
          <div className="bg-baemin-light/20 dark:bg-baemin-light/30 border border-baemin/30 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-baemin-dark dark:text-baemin uppercase tracking-wider flex items-center gap-1.5">
                <Link2 className="w-4 h-4 text-baemin" /> Cấu hình Đường Dẫn Nộp Báo Cáo & Zalo Duyệt
              </span>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={agentEnabled}
                  onChange={(e) => setAgentEnabled(e.target.checked)}
                  className="w-4 h-4 accent-baemin rounded"
                />
                Bật Quy Trình Nộp 1-Click
              </label>
            </div>

            {agentEnabled && (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Đường dẫn Nộp báo cáo (Report Submission URL) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="url"
                    value={submissionUrl}
                    onChange={(e) => setSubmissionUrl(e.target.value)}
                    placeholder="https://base.vn/..."
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-baemin focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-sky-600 dark:text-sky-400 mb-1 flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" /> SĐT Zalo Người Duyệt Báo Cáo (Zalo Approver Phone) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={zaloPhone}
                    onChange={(e) => setZaloPhone(e.target.value)}
                    placeholder="e.g. 0912345678 hoặc 0987654321"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-sky-400 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    ⚡ Nhập số điện thoại người duyệt (ví dụ: <code className="text-sky-600 dark:text-sky-300 font-bold">0912345678</code>). Khi bấm <span className="text-sky-600 dark:text-sky-400 font-bold">"Gửi Zalo Duyệt"</span>, hệ thống tự động tải file chuẩn <code className="text-emerald-700 dark:text-emerald-400 font-bold">Duyet_...</code>, copy câu xin duyệt và tự mở chat Zalo với SĐT này.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Notes & Quick Reference Document Insert */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Ghi Chú / Trích Yếu Nội Dung
              </label>
              
              {refDocs && refDocs.length > 0 && (
                <div className="relative group">
                  <select
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      if (!selectedId) return;
                      const ref = refDocs.find(r => r.id === selectedId);
                      if (ref) {
                        const snippet = `\n[Số liệu từ ${ref.title}]:\n${ref.keyMetrics || ref.description || ''}\n`;
                        setNotes(prev => (prev ? prev + snippet : snippet));
                      }
                      e.target.value = '';
                    }}
                    className="text-[11px] font-bold bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-lg cursor-pointer hover:bg-emerald-500 hover:text-slate-950 transition-all"
                  >
                    <option value="" className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300">⚡ Chèn số liệu từ Kho Tài Liệu...</option>
                    {refDocs.map(rd => (
                      <option key={rd.id} value={rd.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                        {rd.title} ({rd.category})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Ghi chú thêm về báo cáo, người duyệt, kết quả nổi bật..."
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-200 focus:border-blue-500 focus:outline-none resize-none font-mono"
            />
          </div>

          {/* Pin Checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="pinCheckbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="w-4 h-4 accent-blue-600 rounded"
            />
            <label htmlFor="pinCheckbox" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
              Ghim vào mục "Truy cập nhanh" ở trang chủ
            </label>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-all"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-black bg-baemin hover:bg-baemin-dark text-slate-950 rounded-xl shadow-baemin baemin-hover-pop transition-all uppercase tracking-wider"
            >
              Lưu Báo Cáo
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
