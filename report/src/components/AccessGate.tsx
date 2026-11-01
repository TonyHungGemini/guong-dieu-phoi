import React, { useEffect, useState } from 'react';
import { KeyRound, Loader2, LockKeyhole } from 'lucide-react';

type GateState = 'checking' | 'locked' | 'open';

export function AccessGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GateState>('checking');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/auth/status', { credentials: 'same-origin' })
      .then((res) => {
        if (!alive) return;
        setState(res.status === 401 ? 'locked' : 'open');
      })
      .catch(() => {
        // Tĩnh không có API (GitHub Pages) hoặc đang offline: không chặn app.
        if (alive) setState('open');
      });
    return () => {
      alive = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!code.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (res.ok) {
        setState('open');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Mã truy cập không đúng.');
      }
    } catch {
      setError('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  if (state === 'open') return <>{children}</>;

  if (state === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070d14] text-slate-300">
        <div className="flex items-center gap-3 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-[#2AC1BC]" />
          Đang kiểm tra quyền truy cập…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#070d14] px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d1622] p-7 shadow-2xl shadow-black/40"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-[#2AC1BC]/15 flex items-center justify-center">
            <LockKeyhole className="w-5 h-5 text-[#2AC1BC]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100">GUỒNG · Bee Report</h1>
            <p className="text-xs text-slate-400">Khu vực báo cáo riêng tư</p>
          </div>
        </div>

        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2" htmlFor="access-code">
          Mã truy cập
        </label>
        <div className="relative">
          <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="access-code"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Nhập mã được chia sẻ"
            className="w-full rounded-xl border border-white/10 bg-[#070d14] py-2.5 pl-9 pr-3 text-sm text-slate-100 outline-none focus:border-[#2AC1BC]/60 focus:ring-2 focus:ring-[#2AC1BC]/20"
          />
        </div>

        {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 w-full rounded-xl bg-[#2AC1BC] py-2.5 text-sm font-bold text-[#04211f] transition hover:bg-[#20A39E] disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Mở kho báo cáo
        </button>

        <a href="/" className="mt-4 block text-center text-xs text-slate-500 hover:text-slate-300">
          ← Về GUỒNG điều phối
        </a>
      </form>
    </div>
  );
}
