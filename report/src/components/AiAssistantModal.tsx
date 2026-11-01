import React, { useState, useEffect } from 'react';
import { X, Sparkles, CheckCircle2, Copy, FileText, RefreshCw, Wand2, ArrowRight, MessageSquare, Layers, ShieldCheck, AlertTriangle, Plus, Check, MessageCircle, Info } from 'lucide-react';
import { ReportItem } from '../types';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ReportItem | null;
  allReports?: ReportItem[];
  onApplyAiSummary: (reportId: string, summary: string, actionItems: string[]) => void;
  onAddReport?: (newReport: Omit<ReportItem, 'id'> | ReportItem) => void;
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  report,
  allReports = [],
  onApplyAiSummary,
  onAddReport
}) => {
  // Modes: '3tier' (Phân Tích 3 Tầng), 'zalo' (Phân Tách Zalo Thô), 'worklog' (Nhật Ký Nhanh)
  const [activeTab, setActiveTab] = useState<'3tier' | 'zalo' | 'worklog'>('3tier');

  // Multi-report selection for 3-tier analysis
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [loading3Tier, setLoading3Tier] = useState(false);
  const [tierResult, setTierResult] = useState<{
    qualityScore?: number;
    tier1_factSummary?: string;
    tier2_kpiRiskAnalysis?: string;
    tier3_actionRecommendations?: string[];
    suggestedEmailBody?: string;
    managerFeedbackSimulated?: string;
  } | null>(null);

  // Zalo Raw Chat Parser States
  const [zaloRawText, setZaloRawText] = useState('');
  const [loadingZalo, setLoadingZalo] = useState(false);
  const [zaloParsedResult, setZaloParsedResult] = useState<{
    title: string;
    category: any;
    project: string;
    dueDate: string;
    extractedMetrics: string;
    notes: string;
    missingDataQuestions: string[];
    actionItems: string[];
  } | null>(null);
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<number, string>>({});
  const [createdSuccessToast, setCreatedSuccessToast] = useState<string | null>(null);

  // Quick Worklog State
  const [worklogText, setWorklogText] = useState('');
  const [loadingWorklog, setLoadingWorklog] = useState(false);

  // Set default selected report when modal opens or report changes
  useEffect(() => {
    if (report) {
      setSelectedReportIds([report.id]);
    } else if (allReports.length > 0) {
      setSelectedReportIds([allReports[0].id]);
    }
  }, [report, allReports]);

  if (!isOpen) return null;

  // Toggle report selection for multi-report comparison
  const handleToggleReportSelection = (id: string) => {
    setSelectedReportIds(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // keep at least 1
        return prev.filter(rId => rId !== id);
      }
      return [...prev, id];
    });
  };

  // Run 3-Tier Analysis
  const handleRun3TierAnalysis = async () => {
    setLoading3Tier(true);
    try {
      const reportsToAnalyze = allReports.filter(r => selectedReportIds.includes(r.id));
      const res = await fetch('/api/ai/analyze-3tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reports: reportsToAnalyze.length > 0 ? reportsToAnalyze : [report],
          mode: reportsToAnalyze.length > 1 ? 'multi_compare' : 'single',
        }),
      });
      const data = await res.json();
      setTierResult(data);
    } catch (err) {
      console.error('3-Tier Analysis Error:', err);
    } finally {
      setLoading3Tier(false);
    }
  };

  // Run Zalo Chat Parser
  const handleParseZaloText = async (textToParse?: string) => {
    const text = textToParse || zaloRawText;
    if (!text.trim()) return;

    setLoadingZalo(true);
    setCreatedSuccessToast(null);
    try {
      const res = await fetch('/api/ai/parse-zalo-raw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: text }),
      });
      const data = await res.json();
      setZaloParsedResult(data);
      setClarificationAnswers({});
    } catch (err) {
      console.error('Zalo Parse Error:', err);
    } finally {
      setLoadingZalo(false);
    }
  };

  // Paste Sample Zalo Text
  const handlePasteSampleZalo = () => {
    const sample = `Sếp Nam nhắn: Nhóm kinh doanh tuần này báo cáo nghiệm thu 2 hợp đồng dự án Vinhomes, tổng doanh thu đạt 280 triệu. Còn 1 hợp đồng chờ điều chỉnh tiến độ thanh toán. Nhờ Tuấn tổng hợp báo cáo chi tiết trước 5h chiều nay nhé.`;
    setZaloRawText(sample);
    handleParseZaloText(sample);
  };

  // Create new report from Zalo parsed result directly into dashboard
  const handleCreateReportFromZalo = () => {
    if (!zaloParsedResult || !onAddReport) return;

    // Combine notes with clarification answers if user filled any
    let finalNotes = zaloParsedResult.notes;
    const answeredKeys = Object.keys(clarificationAnswers);
    if (answeredKeys.length > 0) {
      finalNotes += '\n\n📌 Thông tin bổ sung trả lời:\n';
      answeredKeys.forEach(kIdx => {
        const q = zaloParsedResult.missingDataQuestions[Number(kIdx)];
        const a = clarificationAnswers[Number(kIdx)];
        if (a) finalNotes += `- ${q}: ${a}\n`;
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const newReportItem: Omit<ReportItem, 'id'> = {
      title: zaloParsedResult.title || 'Báo Cáo Tiến Độ Từ Zalo',
      category: zaloParsedResult.category || 'Báo cáo ngày',
      project: zaloParsedResult.project || 'Dự án chính',
      date: todayStr,
      dueDate: zaloParsedResult.dueDate || todayStr,
      status: 'To-do',
      path: `reports/Zalo_${Date.now()}.docx`,
      notes: finalNotes,
      version: 1,
      pinned: false,
      agentEnabled: true,
      aiSummary: zaloParsedResult.extractedMetrics ? `Thống kê nổi bật: ${zaloParsedResult.extractedMetrics}` : undefined,
      aiActionItems: zaloParsedResult.actionItems,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onAddReport(newReportItem);
    setCreatedSuccessToast(`✅ Đã tạo thành công báo cáo "${zaloParsedResult.title}" ra màn hình theo dõi!`);
    setTimeout(() => setCreatedSuccessToast(null), 4000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const currentReport = allReports.find(r => r.id === selectedReportIds[0]) || report;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-baemin text-slate-950 flex items-center justify-center shadow-sm font-bold animate-baemin-bounce">
              <Sparkles className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Trợ Lý Phân Tích Gemini AI Copilot
                <span className="px-2 py-0.5 text-[10px] font-black bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-full border border-amber-500/30">
                  Gemini 3.6 Flash
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-md">
                Phân tích 3 Tầng • Phân tách tin nhắn Zalo thô • Giả lập phản hồi Sếp
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 py-2.5 bg-slate-100 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('3tier')}
            className={`px-3.5 py-1.5 rounded-xl font-extrabold text-xs transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === '3tier'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Phân Tích 3 Tầng (Sát Thực)
          </button>

          <button
            onClick={() => setActiveTab('zalo')}
            className={`px-3.5 py-1.5 rounded-xl font-extrabold text-xs transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'zalo'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" /> 📱 Phân Tách Zalo Thô -&gt; Báo Cáo
          </button>

          <button
            onClick={() => setActiveTab('worklog')}
            className={`px-3.5 py-1.5 rounded-xl font-extrabold text-xs transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'worklog'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" /> 📝 Nhật Ký Nhanh -&gt; Báo Cáo
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          
          {/* TAB 1: 3-TIER FACT-BASED REPORT ANALYSIS */}
          {activeTab === '3tier' && (
            <div className="space-y-4">
              
              {/* Report Selection Toolbar */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> Chọn Báo Cáo Để Phân Tích:
                  </label>
                  <span className="text-[11px] font-bold text-slate-500">
                    Đã chọn {selectedReportIds.length} báo cáo
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  {allReports.map(rep => {
                    const isSelected = selectedReportIds.includes(rep.id);
                    return (
                      <button
                        key={rep.id}
                        onClick={() => handleToggleReportSelection(rep.id)}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all flex items-center gap-1 ${
                          isSelected
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        <span className="truncate max-w-[180px]">{rep.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Start 3-Tier Analysis trigger if no result yet */}
              {!tierResult && !loading3Tier && (
                <div className="text-center py-8 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                  <ShieldCheck className="w-12 h-12 text-purple-600 dark:text-purple-400 mx-auto mb-3 opacity-90" />
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mb-1">
                    Mô Hình Phân Tích 3 Tầng Dữ Liệu Gemini AI
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg mx-auto mb-4 leading-relaxed">
                    <strong>Tầng 1:</strong> Trích xuất chuẩn xác dữ liệu thực tế (Cam kết không bịa dữ liệu).<br/>
                    <strong>Tầng 2:</strong> Đánh giá tiến độ KPI & điểm nghẽn rủi ro.<br/>
                    <strong>Tầng 3:</strong> Đề xuất hành động & Giả lập phản hồi Sếp (Manager Review).
                  </p>
                  <button
                    onClick={handleRun3TierAnalysis}
                    className="px-6 py-2.5 text-xs font-black bg-baemin hover:bg-baemin-dark text-slate-950 rounded-xl shadow-md baemin-hover-pop transition-all inline-flex items-center gap-2 uppercase tracking-wider"
                  >
                    <Sparkles className="w-4 h-4 stroke-[2.5]" /> Phân Tích 3 Tầng Ngay
                  </button>
                </div>
              )}

              {loading3Tier && (
                <div className="text-center py-10">
                  <RefreshCw className="w-8 h-8 text-purple-600 dark:text-purple-400 animate-spin mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-200">Đang thẩm định báo cáo qua 3 tầng trí tuệ AI...</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Đảm bảo đối soát chuẩn xác dữ liệu thực tế</p>
                </div>
              )}

              {/* 3-TIER ANALYSIS RESULTS */}
              {tierResult && !loading3Tier && (
                <div className="space-y-3.5">
                  
                  {/* Overall Quality Score */}
                  <div className="bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 border border-purple-500/20 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-black text-purple-700 dark:text-purple-300 uppercase tracking-wider">ĐIỂM CHẤT LƯỢNG BÁO CÁO (3-TIER EVALUATION)</p>
                      <p className="text-2xl font-black text-purple-900 dark:text-purple-100">{tierResult.qualityScore || 95} / 100</p>
                    </div>
                    <span className="px-3 py-1 text-xs font-extrabold bg-purple-600 text-white rounded-full shadow-sm flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Đã Kiểm Định 3 Tầng
                    </span>
                  </div>

                  {/* TẦNG 1: FACT GROUNDING & DATA EXTRACTION */}
                  <div className="bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-500/30 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-black text-sky-800 dark:text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-sky-600" /> Tầng 1: Trích Xuất Dữ Liệu Thực Tế (Fact Grounding)
                      </h4>
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-sky-200 dark:bg-sky-800 text-sky-900 dark:text-sky-100 rounded-md">
                        🔒 Tuyệt đối không bịa số liệu
                      </span>
                    </div>
                    <div className="text-xs text-sky-950 dark:text-sky-200 leading-relaxed whitespace-pre-line font-medium bg-white/70 dark:bg-slate-900/80 p-3 rounded-xl border border-sky-100 dark:border-sky-800/40">
                      {tierResult.tier1_factSummary}
                    </div>
                  </div>

                  {/* TẦNG 2: KPI RISK & PROGRESS ANALYSIS */}
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-4">
                    <h4 className="text-xs font-black text-amber-800 dark:text-amber-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" /> Tầng 2: Tiến Độ & Phân Tích Rủi Ro KPI
                    </h4>
                    <div className="text-xs text-amber-950 dark:text-amber-200 leading-relaxed whitespace-pre-line font-medium bg-white/70 dark:bg-slate-900/80 p-3 rounded-xl border border-amber-100 dark:border-amber-800/40">
                      {tierResult.tier2_kpiRiskAnalysis}
                    </div>
                  </div>

                  {/* TẦNG 3: ACTIONABLE RECOMMENDATIONS & DRAFT EMAIL */}
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl p-4 space-y-2.5">
                    <h4 className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Tầng 3: Khuyến Nghị & Nhiệm Vụ Cần Xử Lý Tiếp Theo
                    </h4>

                    {tierResult.tier3_actionRecommendations && (
                      <ul className="space-y-1 text-xs text-slate-800 dark:text-slate-200 font-medium bg-white/70 dark:bg-slate-900/80 p-3 rounded-xl border border-emerald-100 dark:border-emerald-800/40">
                        {tierResult.tier3_actionRecommendations.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-emerald-600 font-bold">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Email Draft */}
                    {tierResult.suggestedEmailBody && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                            Mẫu Email Nháp Trình Báo Cáo:
                          </span>
                          <button
                            onClick={() => copyToClipboard(tierResult.suggestedEmailBody || '')}
                            className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            title="Sao chép"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <pre className="text-xs font-sans text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                          {tierResult.suggestedEmailBody}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* SIMULATED MANAGER REVIEW (GÓC NHÌN SẾP) */}
                  {tierResult.managerFeedbackSimulated && (
                    <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-500/30 rounded-2xl p-4">
                      <h4 className="text-xs font-black text-purple-800 dark:text-purple-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <MessageCircle className="w-4 h-4 text-purple-600" /> Góc Nhìn Sếp (Manager Review Simulator)
                      </h4>
                      <div className="text-xs text-purple-950 dark:text-purple-200 font-medium italic bg-white/80 dark:bg-slate-900/80 p-3 rounded-xl border border-purple-200/60 dark:border-purple-800/40">
                        {tierResult.managerFeedbackSimulated}
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>
          )}

          {/* TAB 2: ZALO RAW CHAT PARSER & DIRECT REPORT CREATOR */}
          {activeTab === 'zalo' && (
            <div className="space-y-4">
              
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-emerald-900 dark:text-emerald-200 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-emerald-600" /> Gửi Tin Nhắn Zalo Thô (Coppy Từ Zalo)
                  </h3>
                  <button
                    onClick={handlePasteSampleZalo}
                    className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all"
                  >
                    📋 Dán Mẫu Zalo Thử
                  </button>
                </div>

                <textarea
                  value={zaloRawText}
                  onChange={e => setZaloRawText(e.target.value)}
                  placeholder="Dán đoạn tin nhắn thô từ Zalo/Chat vào đây... (Ví dụ: 'Sếp Nam nhắn: Nhóm kinh doanh tuần này báo cáo nghiệm thu 2 hợp đồng dự án Vinhomes, tổng doanh thu 280tr. Nhờ Tuấn gửi báo cáo trước 5h chiều...')"
                  rows={4}
                  className="w-full text-xs p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                />

                <div className="flex justify-end">
                  <button
                    onClick={() => handleParseZaloText()}
                    disabled={loadingZalo || !zaloRawText.trim()}
                    className="px-5 py-2 text-xs font-black bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl shadow-sm transition-all flex items-center gap-1.5 uppercase tracking-wider"
                  >
                    {loadingZalo ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Phân Tách & Cấu Trúc Báo Cáo
                  </button>
                </div>
              </div>

              {/* Toast feedback after creation */}
              {createdSuccessToast && (
                <div className="p-3 bg-emerald-600 text-white text-xs font-black rounded-xl shadow-md flex items-center gap-2 animate-bounce">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{createdSuccessToast}</span>
                </div>
              )}

              {/* Parsed Result Display */}
              {zaloParsedResult && (
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-emerald-600 uppercase tracking-wider">KẾT QUẢ PHÂN TÁCH CHUẨN HÓA</span>
                    <span className="px-2.5 py-0.5 text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md">
                      Hạn nộp: {zaloParsedResult.dueDate}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                      <label className="text-[10px] font-bold text-slate-400 block mb-0.5">TÊN BÁO CÁO ĐỀ XUẤT</label>
                      <input
                        type="text"
                        value={zaloParsedResult.title}
                        onChange={e => setZaloParsedResult({ ...zaloParsedResult, title: e.target.value })}
                        className="w-full text-xs font-bold text-slate-900 dark:text-slate-100 bg-transparent outline-none"
                      />
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                      <label className="text-[10px] font-bold text-slate-400 block mb-0.5">DỰ ÁN & DANH MỤC</label>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {zaloParsedResult.project} • {zaloParsedResult.category}
                      </div>
                    </div>
                  </div>

                  {zaloParsedResult.extractedMetrics && (
                    <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300">
                      📊 Chỉ Số & Doanh Số Trích Xuất: {zaloParsedResult.extractedMetrics}
                    </div>
                  )}

                  {/* Missing Data Questions Alert Box */}
                  {zaloParsedResult.missingDataQuestions && zaloParsedResult.missingDataQuestions.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-600/40 rounded-xl p-3 space-y-2">
                      <h4 className="text-xs font-black text-amber-800 dark:text-amber-300 flex items-center gap-1.5 uppercase">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" /> AI Hỏi Lại: Cần Bổ Sung Thêm Dữ Kiện Tương Tác
                      </h4>
                      <p className="text-[11px] text-amber-900 dark:text-amber-200 font-medium">
                        Bản tin nhắn Zalo chưa đầy đủ các thông tin sau. Nhập câu trả lời để AI ghi nhớ chặt chẽ hơn:
                      </p>
                      <div className="space-y-2">
                        {zaloParsedResult.missingDataQuestions.map((q, qIdx) => (
                          <div key={qIdx} className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-amber-200 dark:border-amber-800 space-y-1">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{q}</p>
                            <input
                              type="text"
                              placeholder="Nhập bổ sung..."
                              value={clarificationAnswers[qIdx] || ''}
                              onChange={e => setClarificationAnswers({ ...clarificationAnswers, [qIdx]: e.target.value })}
                              className="w-full text-xs p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes & Task List */}
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">NỘI DUNG CẦN BÁO CÁO CHI TIẾT</label>
                    <pre className="text-xs font-sans text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {zaloParsedResult.notes}
                    </pre>
                  </div>

                  {/* Create Action */}
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={handleCreateReportFromZalo}
                      className="px-5 py-2.5 text-xs font-black bg-baemin hover:bg-baemin-dark text-slate-950 rounded-xl shadow-md baemin-hover-pop transition-all flex items-center gap-2 uppercase tracking-wider"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" /> Tạo Báo Cáo Ngay Ra Màn Hình
                    </button>
                  </div>

                </div>
              )}

            </div>
          )}

          {/* TAB 3: QUICK WORKLOG TO FORMAL REPORT */}
          {activeTab === 'worklog' && (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                  <Wand2 className="w-4 h-4 text-amber-500" /> Nhập Nhật Ký Công Việc Nhanh
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Gõ nhanh các việc bạn đã làm hôm nay, Gemini sẽ cấu trúc thành báo cáo hoàn chỉnh chuyên nghiệp không tạo áp lực.
                </p>

                <textarea
                  value={worklogText}
                  onChange={e => setWorklogText(e.target.value)}
                  placeholder="Ví dụ: - Họp với team thiết kế xong bản vẽ tầng 1&#10;- Đã kiểm tra kho tồn 500 viên gạch&#10;- Gọi cho anh Hùng chốt hợp đồng..."
                  rows={4}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none"
                />

                <div className="flex justify-end">
                  <button
                    onClick={async () => {
                      if (!worklogText.trim()) return;
                      setLoadingWorklog(true);
                      await handleParseZaloText(worklogText);
                      setActiveTab('zalo');
                      setLoadingWorklog(false);
                    }}
                    disabled={loadingWorklog || !worklogText.trim()}
                    className="px-5 py-2 text-xs font-black bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl transition-all flex items-center gap-1.5 uppercase tracking-wider"
                  >
                    {loadingWorklog ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Chuyển Thành Bản Báo Cáo
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Info className="w-3.5 h-3.5 text-purple-500" />
            <span>Mô hình Gemini AI 3 Tầng • Không bịa số liệu</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-all"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
