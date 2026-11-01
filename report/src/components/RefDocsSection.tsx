import React, { useState } from 'react';
import { 
  FolderKanban, 
  Plus, 
  Search, 
  Copy, 
  Check, 
  Download, 
  ExternalLink, 
  FileSpreadsheet, 
  FileText, 
  FileCode, 
  Link2, 
  Trash2, 
  Edit, 
  Star, 
  Tag, 
  Sparkles,
  Upload,
  X,
  FileCheck
} from 'lucide-react';
import { RefDocument, RefDocCategory, StoredFileBlob } from '../types';
import { dbService } from '../lib/db';

interface RefDocsSectionProps {
  refDocs: RefDocument[];
  onSaveRefDoc: (doc: RefDocument) => void;
  onDeleteRefDoc: (id: string) => void;
  onTogglePinRefDoc: (id: string) => void;
  showToast: (msg: string) => void;
}

const CATEGORIES: ('Tất cả' | RefDocCategory)[] = [
  'Tất cả',
  'Số liệu tài chính',
  'KPIs & Doanh số',
  'Hợp đồng & Văn bản',
  'Mẫu biểu & Hướng dẫn',
  'Tài liệu kỹ thuật',
  'Khác'
];

export const RefDocsSection: React.FC<RefDocsSectionProps> = ({
  refDocs,
  onSaveRefDoc,
  onDeleteRefDoc,
  onTogglePinRefDoc,
  showToast
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'Tất cả' | RefDocCategory>('Tất cả');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<RefDocument | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<RefDocCategory>('Số liệu tài chính');
  const [description, setDescription] = useState('');
  const [keyMetrics, setKeyMetrics] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [fileBlobId, setFileBlobId] = useState<string | undefined>(undefined);
  const [fileSizeFormatted, setFileSizeFormatted] = useState<string | undefined>(undefined);

  const handleOpenModal = (doc?: RefDocument) => {
    if (doc) {
      setEditingDoc(doc);
      setTitle(doc.title);
      setCategory(doc.category);
      setDescription(doc.description || '');
      setKeyMetrics(doc.keyMetrics || '');
      setExternalUrl(doc.externalUrl || '');
      setTagsStr((doc.tags || []).join(', '));
      setFileBlobId(doc.fileBlobId);
      setFileSizeFormatted(doc.fileSizeFormatted);
      setUploadingFile(null);
    } else {
      setEditingDoc(null);
      setTitle('');
      setCategory('Số liệu tài chính');
      setDescription('');
      setKeyMetrics('');
      setExternalUrl('');
      setTagsStr('');
      setFileBlobId(undefined);
      setFileSizeFormatted(undefined);
      setUploadingFile(null);
    }
    setIsModalOpen(true);
  };

  const handleFileDrop = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(file);
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
    setFileSizeFormatted(`${sizeInMB} MB`);

    // Convert file to base64 for IndexedDB blob store
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      const blobRecord: StoredFileBlob = {
        id: 'ref-blob-' + Date.now(),
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        base64Data,
        updatedAt: new Date().toISOString()
      };
      await dbService.saveFileBlob(blobRecord);
      setFileBlobId(blobRecord.id);
      showToast(`Đã lưu file "${file.name}" vào bộ nhớ tạm!`);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Vui lòng nhập tên tài liệu tham khảo!');
      return;
    }

    let detectedType = 'txt';
    if (uploadingFile) {
      const ext = uploadingFile.name.split('.').pop()?.toLowerCase();
      if (ext) detectedType = ext;
    } else if (editingDoc?.fileType) {
      detectedType = editingDoc.fileType;
    } else if (externalUrl) {
      detectedType = 'link';
    }

    const tagsArray = tagsStr
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const docToSave: RefDocument = {
      id: editingDoc ? editingDoc.id : 'ref-' + Date.now(),
      title,
      category,
      description,
      keyMetrics,
      externalUrl,
      fileName: uploadingFile ? uploadingFile.name : editingDoc?.fileName,
      fileSizeFormatted: fileSizeFormatted || editingDoc?.fileSizeFormatted,
      fileBlobId: fileBlobId || editingDoc?.fileBlobId,
      fileType: detectedType,
      pinned: editingDoc ? editingDoc.pinned : false,
      tags: tagsArray,
      createdAt: editingDoc ? editingDoc.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSaveRefDoc(docToSave);
    setIsModalOpen(false);
    showToast(editingDoc ? 'Đã cập nhật tài liệu tham khảo!' : 'Đã thêm tài liệu tham khảo mới!');
  };

  const handleCopyMetrics = async (doc: RefDocument) => {
    const textToCopy = doc.keyMetrics || doc.description || doc.title;
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedId(doc.id);
      setTimeout(() => setCopiedId(null), 2500);
      showToast(`⚡ Đã sao chép số liệu từ "${doc.title}"! Bạn có thể Dán (Ctrl+V) vào bài báo cáo.`);
    } catch (err) {
      showToast('Không thể sao chép vào bộ nhớ tạm');
    }
  };

  const handleDownloadFile = async (doc: RefDocument) => {
    // 1. Try retrieving original binary Blob from IndexedDB
    if (doc.fileBlobId) {
      try {
        const blobRecord = await dbService.getFileBlob(doc.fileBlobId);
        if (blobRecord) {
          let blob: Blob | null = null;
          if (blobRecord.blob instanceof Blob && blobRecord.blob.size > 0) {
            blob = blobRecord.blob;
          } else if (blobRecord.base64Data) {
            const rawBase64 = blobRecord.base64Data;
            const base64Clean = rawBase64.includes(',') ? rawBase64.split(',')[1] : rawBase64;
            const byteString = atob(base64Clean);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
            }
            blob = new Blob([ab], { type: blobRecord.type || 'application/octet-stream' });
          }

          if (blob) {
            const filename = doc.fileName || `${doc.title}.${doc.fileType || 'xlsx'}`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 10000);
            showToast(`Đã tải xuống file gốc "${filename}"`);
            return;
          }
        }
      } catch (err) {
        console.warn('IndexedDB file blob fetch error:', err);
      }
    }

    // 2. Try Google Drive Direct Link / Export Link
    if (doc.webContentLink || doc.driveFileId || doc.webViewLink) {
      const driveUrl = doc.webContentLink || (doc.driveFileId ? `https://drive.google.com/uc?id=${doc.driveFileId}&export=download` : doc.webViewLink);
      if (driveUrl) {
        const a = document.createElement('a');
        a.href = driveUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.download = doc.fileName || `${doc.title}.${doc.fileType || 'xlsx'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast(`Đã mở / tải xuống file gốc từ Google Drive!`);
        return;
      }
    }

    // 3. Fallback: Generate structured reference text file if no file was uploaded
    const content = `=== TÀI LIỆU THAM KHẢO & SỐ LIỆU: ${doc.title.toUpperCase()} ===
Danh mục: ${doc.category}
Ngày tạo: ${new Date(doc.createdAt).toLocaleString('vi-VN')}
Thẻ Tags: ${(doc.tags && doc.tags.length > 0) ? doc.tags.join(', ') : 'Không có'}

1. MÔ TẢ TÀI LIỆU:
${doc.description || 'Chưa cập nhật mô tả.'}

2. SỐ LIỆU TRÍCH XUẤT QUAN TRỌNG:
${doc.keyMetrics || 'Chưa cập nhật số liệu trích xuất.'}

${doc.externalUrl ? `Liên kết tham chiếu: ${doc.externalUrl}\n` : ''}
--------------------------------------------------
Được xuất từ Quản lý Báo cáo (Design by Tony Hung)
`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title.replace(/[^a-zA-Z0-9_\-]/g, '_')}_TrichXuat.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showToast(`Đã tải file số liệu trích xuất!`);
  };

  const getDocIcon = (fileType?: string) => {
    switch (fileType) {
      case 'xlsx':
      case 'xls':
      case 'csv':
        return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
      case 'pdf':
        return <FileText className="w-5 h-5 text-rose-400" />;
      case 'docx':
      case 'doc':
        return <FileText className="w-5 h-5 text-blue-400" />;
      case 'link':
        return <Link2 className="w-5 h-5 text-amber-400" />;
      default:
        return <FolderKanban className="w-5 h-5 text-baemin" />;
    }
  };

  const filteredDocs = refDocs.filter(doc => {
    const matchesCategory = selectedCategory === 'Tất cả' || doc.category === selectedCategory;
    const matchesSearch = 
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.description && doc.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (doc.keyMetrics && doc.keyMetrics.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (doc.tags && doc.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* BANNER HEADER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-emerald-500/5 blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 shadow-sm">
              <FolderKanban className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Nơi Chứa File Tài Liệu Liên Quan
                <span className="text-[11px] font-bold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Kho Số Liệu Nhanh
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Lưu trữ các bảng Excel, PDFs, hợp đồng & số liệu tham khảo để tra cứu, copy dữ liệu nhanh vào báo cáo đang làm.
              </p>
            </div>
          </div>

          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 shrink-0 uppercase tracking-wider active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Thêm Tài Liệu Tham Khảo</span>
          </button>
        </div>

        {/* SEARCH & CATEGORY FILTER */}
        <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm số liệu, tên tài liệu, tags..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-200 focus:border-emerald-500 focus:outline-none placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                    : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800/80'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* DOCUMENT LIST / GRID */}
      {filteredDocs.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-6">
          <FolderKanban className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Chưa có tài liệu tham khảo nào</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
            Thêm tài liệu tham khảo đầu tiên (bảng tính Excel, file báo cáo tài chính, chỉ số KPIs) để sẵn sàng tra cứu & sao chép số liệu.
          </p>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition-all inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Thêm Ngay
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className={`bg-white dark:bg-slate-900/90 border rounded-2xl p-4 transition-all hover:border-emerald-500/50 flex flex-col justify-between shadow-sm relative group ${
                doc.pinned ? 'border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/10' : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div>
                {/* TOP HEADER */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shrink-0">
                      {getDocIcon(doc.fileType)}
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {doc.category}
                      </span>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate mt-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors">
                        {doc.title}
                      </h3>
                    </div>
                  </div>

                  <button
                    onClick={() => onTogglePinRefDoc(doc.id)}
                    className={`p-1.5 rounded-lg transition-all ${
                      doc.pinned ? 'text-amber-500 bg-amber-500/10' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                    title={doc.pinned ? 'Bỏ ghim' : 'Ghim ưu tiên'}
                  >
                    <Star className={`w-4 h-4 ${doc.pinned ? 'fill-amber-400 text-amber-500' : ''}`} />
                  </button>
                </div>

                {/* DESCRIPTION */}
                {doc.description && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-3 font-sans">
                    {doc.description}
                  </p>
                )}

                {/* KEY METRICS BOX (SỐ LIỆU TRÍCH XUẤT) */}
                {doc.keyMetrics && (
                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 mb-3 relative">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-500" /> Số liệu trích xuất nhanh
                      </span>
                      <button
                        onClick={() => handleCopyMetrics(doc)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all flex items-center gap-1 ${
                          copiedId === doc.id
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-300 hover:bg-emerald-500 hover:text-slate-950'
                        }`}
                        title="Sao chép toàn bộ số liệu vào Clipboard"
                      >
                        {copiedId === doc.id ? (
                          <>
                            <Check className="w-3 h-3 stroke-[3]" /> Đã Copy
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> Copy Số Liệu
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto pr-1 scrollbar-thin">
                      {doc.keyMetrics}
                    </pre>
                  </div>
                )}

                {/* TAGS */}
                {doc.tags && doc.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 mb-3">
                    {doc.tags.map((t, idx) => (
                      <span key={idx} className="text-[10px] text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Tag className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500" /> {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* FOOTER ACTIONS */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-2 mt-2">
                <div className="text-[11px] text-slate-500 font-mono truncate">
                  {doc.fileName ? (
                    <span className="text-slate-600 dark:text-slate-400 font-medium truncate block max-w-[130px]" title={doc.fileName}>
                      {doc.fileName} ({doc.fileSizeFormatted || 'Doc'})
                    </span>
                  ) : (
                    <span>Chưa đính kèm file</span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDownloadFile(doc)}
                    className="p-1.5 text-slate-500 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                    title="Tải xuống tài liệu/số liệu"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  {doc.externalUrl && (
                    <a
                      href={doc.externalUrl.startsWith('http') ? doc.externalUrl : `https://${doc.externalUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all"
                      title="Mở đường dẫn ngoài (Base.vn / Google Sheet)"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}

                  <button
                    onClick={() => handleOpenModal(doc)}
                    className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                    title="Chỉnh sửa"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onDeleteRefDoc(doc.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                    title="Xóa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ADD / EDIT DOCUMENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-fade-in">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  <FolderKanban className="w-5 h-5" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  {editingDoc ? 'Chỉnh Sửa Tài Liệu Tham Khảo' : 'Thêm Tài Liệu Tham Khảo Mới'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tên Tài Liệu / Số Liệu <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Bảng Cân Đối Tài Chính Q2/2026..."
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Danh Mục</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as RefDocCategory)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                >
                  {CATEGORIES.filter(c => c !== 'Tất cả').map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Số Liệu Trích Xuất Nhanh (Sẽ dùng để Copy 1-Click khi làm báo cáo)
                </label>
                <textarea
                  value={keyMetrics}
                  onChange={(e) => setKeyMetrics(e.target.value)}
                  rows={4}
                  placeholder={`• Doanh thu Q2: 15.8 tỷ VNĐ\n• Lợi nhuận gộp: 3.2 tỷ VNĐ (20%)\n• Chi phí vận hành: 1.1 tỷ VNĐ`}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-emerald-800 dark:text-emerald-300 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Ghi Chú / Mô Tả Thêm</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Ghi chú tóm tắt nội dung file..."
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Liên Kết Ngoài (Google Sheet, Base.vn Portal, OneDrive)
                </label>
                <input
                  type="url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://base.vn/..."
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Thẻ Tags (Cách nhau bằng dấu phẩy)</label>
                <input
                  type="text"
                  value={tagsStr}
                  onChange={(e) => setTagsStr(e.target.value)}
                  placeholder="Tài chính, KPIs, Q2-2026..."
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* FILE UPLOAD BOX */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Đính Kèm File Tài Liệu (Excel, PDF, Word)</label>
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-800 hover:border-emerald-500/50 rounded-2xl p-4 text-center bg-slate-50 dark:bg-slate-950 transition-colors relative">
                  <input
                    type="file"
                    onChange={handleFileDrop}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  {uploadingFile ? (
                    <div className="flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                      <FileCheck className="w-4 h-4" />
                      <span>{uploadingFile.name} ({fileSizeFormatted})</span>
                    </div>
                  ) : editingDoc?.fileName ? (
                    <div className="text-slate-700 dark:text-slate-300 text-xs">
                      File hiện tại: <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">{editingDoc.fileName}</span>. Nhấp để thay đổi.
                    </div>
                  ) : (
                    <div className="text-slate-500 text-xs space-y-1">
                      <Upload className="w-5 h-5 mx-auto text-slate-400 mb-1" />
                      <span>Kéo thả hoặc nhấp để chọn file từ máy tính</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl transition-all"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-extrabold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl shadow-lg uppercase tracking-wider"
                >
                  Lưu Tài Liệu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
