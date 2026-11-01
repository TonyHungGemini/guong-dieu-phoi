import React, { useState } from 'react';
import { Sparkles, RefreshCw, X, ShieldCheck, ArrowUpCircle } from 'lucide-react';
import { APP_VERSION } from '../lib/version';

interface UpdateNotificationBannerProps {
  hasUpdate: boolean;
  isUpdating: boolean;
  onUpdate: () => void;
  onDismiss?: () => void;
}

export const UpdateNotificationBanner: React.FC<UpdateNotificationBannerProps> = ({
  hasUpdate,
  isUpdating,
  onUpdate,
  onDismiss
}) => {
  const [dismissed, setDismissed] = useState(false);

  if (!hasUpdate || dismissed) return null;

  return (
    <aside 
      aria-label="Thông báo cập nhật ứng dụng Bee Report"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-[9999] sm:max-w-md w-auto bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-indigo-500/40 backdrop-blur-md animate-in slide-in-from-bottom-5 duration-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/30 animate-pulse mt-0.5">
            <ArrowUpCircle className="w-6 h-6 stroke-[2.5]" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                Phiên bản mới {APP_VERSION}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-bold">
                <ShieldCheck className="w-3.5 h-3.5" /> Dữ liệu an toàn 100%
              </span>
            </div>

            <h4 className="text-sm font-extrabold text-white leading-snug">
              Có phiên bản ứng dụng Bee Report mới!
            </h4>

            <p className="text-xs text-slate-300 leading-relaxed">
              Vui lòng cập nhật ngay để trải nghiệm các cải tiến mới. Lịch sử báo cáo & dữ liệu của bạn được bảo toàn tuyệt đối.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setDismissed(true);
            if (onDismiss) onDismiss();
          }}
          className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors shrink-0"
          title="Để sau"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-end gap-2">
        <button
          onClick={() => setDismissed(true)}
          className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors"
        >
          Để sau
        </button>

        <button
          onClick={onUpdate}
          disabled={isUpdating}
          className="px-4 py-2 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
        >
          {isUpdating ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang cập nhật...
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" /> Cập Nhật Ngay
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
