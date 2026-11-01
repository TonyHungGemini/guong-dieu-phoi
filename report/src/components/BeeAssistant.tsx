import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, CheckCircle2, Clock, X, Bell, Crown, Volume2, VolumeX, ArrowRight, Award, RefreshCw, Music, Heart, Coffee, Play, Pause, Copy, Check, RotateCcw, Timer, Settings, FastForward, Info, MessageSquare, ExternalLink, Tv } from 'lucide-react';
import { ReportItem } from '../types';
import { getSmartMessage, BeeMessage, playPianoMelody } from '../lib/beeLibrary';
import { sendNotification } from '../lib/notificationService';
import { playPomodoroAlarmSound } from '../lib/pomoAudioService';

interface BeeAssistantProps {
  reports: ReportItem[];
  onOpenAddModal: () => void;
  onOpenPendingModal?: () => void;
  onNavigateView: (view: 'dashboard' | 'grid' | 'calendar') => void;
  onTriggerSimulatedUpdate?: () => void;
  onOpenNotifConfigModal?: () => void;
}

export const BeeAssistant: React.FC<BeeAssistantProps> = ({
  reports,
  onOpenAddModal,
  onOpenPendingModal,
  onNavigateView,
  onTriggerSimulatedUpdate,
  onOpenNotifConfigModal,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'pomodoro'>('chat');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFlying, setIsFlying] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [activeMessage, setActiveMessage] = useState<BeeMessage | null>(null);

  // Interactive widget states
  const [isPlayingMelody, setIsPlayingMelody] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [copiedQuote, setCopiedQuote] = useState(false);

  // Pomodoro States
  const [pomoPhase, setPomoPhase] = useState<'focus' | 'break'>('focus');
  const [pomoFocusMinutes, setPomoFocusMinutes] = useState<number>(25);
  const [pomoBreakMinutes, setPomoBreakMinutes] = useState<number>(5);
  const [pomoSecondsLeft, setPomoSecondsLeft] = useState<number>(25 * 60);
  const [pomoIsRunning, setPomoIsRunning] = useState<boolean>(false);
  const [pomoCompletedCount, setPomoCompletedCount] = useState<number>(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('docureport_pomo_count');
        return stored ? parseInt(stored, 10) : 0;
      }
    } catch { }
    return 0;
  });
  const [showPomoSettings, setShowPomoSettings] = useState<boolean>(false);
  const [customFocusInput, setCustomFocusInput] = useState<string>('25');
  const [customBreakInput, setCustomBreakInput] = useState<string>('5');

  // Picture-in-Picture Floating Window States
  const pipWindowRef = useRef<Window | null>(null);
  const [isPipActive, setIsPipActive] = useState<boolean>(false);

  // Synchronize Tab Title & Live PiP Window with Pomodoro Countdown
  useEffect(() => {
    if (pomoIsRunning) {
      const minutesStr = Math.floor(pomoSecondsLeft / 60).toString().padStart(2, '0');
      const secondsStr = (pomoSecondsLeft % 60).toString().padStart(2, '0');
      const timeFormatted = `${minutesStr}:${secondsStr}`;
      document.title = `🍅 ${timeFormatted} (${pomoPhase === 'focus' ? 'Tập Trung' : 'Nghỉ'}) - DocuReport AI`;
    } else {
      document.title = 'DocuReport AI - Báo Cáo Thông Minh';
    }

    // Update Picture-in-Picture window content dynamically if active
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      const doc = pipWindowRef.current.document;
      const timeEl = doc.getElementById('pip-pomo-time');
      const phaseEl = doc.getElementById('pip-pomo-phase');
      const statusEl = doc.getElementById('pip-pomo-status');
      const toggleBtn = doc.getElementById('pip-btn-toggle');
      if (timeEl) timeEl.textContent = formatTimer(pomoSecondsLeft);
      if (phaseEl) phaseEl.textContent = pomoPhase === 'focus' ? '🍅 TẬP TRUNG' : '☕ NGHỈ NGƠI';
      if (statusEl) statusEl.textContent = pomoIsRunning ? '● Đang đếm ngược' : '⏸️ Tạm dừng';
      if (toggleBtn) toggleBtn.textContent = pomoIsRunning ? 'Tạm Dừng' : 'Bắt Đầu';
    }

    return () => {
      document.title = 'DocuReport AI - Báo Cáo Thông Minh';
    };
  }, [pomoSecondsLeft, pomoIsRunning, pomoPhase]);

  // Handle Request Desktop Picture-in-Picture Floating Window
  const handleToggleDesktopPipWindow = async () => {
    try {
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        pipWindowRef.current.close();
        pipWindowRef.current = null;
        setIsPipActive(false);
        return;
      }

      // Check for Document Picture-in-Picture API
      if (typeof window !== 'undefined' && 'documentPictureInPicture' in window) {
        const pipWin = await (window as any).documentPictureInPicture.requestWindow({
          width: 320,
          height: 240,
        });

        pipWindowRef.current = pipWin;
        setIsPipActive(true);

        pipWin.document.body.innerHTML = `
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 16px;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              background: #0f172a;
              color: #f8fafc;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              user-select: none;
              text-align: center;
            }
            .badge {
              font-size: 11px;
              font-weight: 800;
              padding: 4px 12px;
              border-radius: 9999px;
              background: #be123c;
              color: white;
              margin-bottom: 8px;
              letter-spacing: 0.5px;
            }
            .time {
              font-size: 44px;
              font-weight: 900;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              color: #ffffff;
              margin: 2px 0;
              letter-spacing: 2px;
            }
            .status {
              font-size: 11px;
              color: #94a3b8;
              margin-bottom: 12px;
              font-weight: 700;
            }
            .btn-group {
              display: flex;
              gap: 8px;
            }
            button {
              padding: 8px 16px;
              border-radius: 12px;
              border: none;
              font-weight: 800;
              font-size: 12px;
              cursor: pointer;
              transition: all 0.2s;
            }
            .btn-toggle {
              background: #f59e0b;
              color: #0f172a;
            }
            .btn-reset {
              background: #334155;
              color: #f8fafc;
            }
          </style>
          <div class="badge" id="pip-pomo-phase">${pomoPhase === 'focus' ? '🍅 TẬP TRUNG' : '☕ NGHỈ NGƠI'}</div>
          <div class="time" id="pip-pomo-time">${formatTimer(pomoSecondsLeft)}</div>
          <div class="status" id="pip-pomo-status">${pomoIsRunning ? '● Đang đếm ngược' : '⏸️ Tạm dừng'}</div>
          <div class="btn-group">
            <button class="btn-toggle" id="pip-btn-toggle">${pomoIsRunning ? 'Tạm Dừng' : 'Bắt Đầu'}</button>
            <button class="btn-reset" id="pip-btn-reset">Đặt Lại</button>
          </div>
        `;

        pipWin.document.getElementById('pip-btn-toggle')?.addEventListener('click', () => {
          setPomoIsRunning(prev => !prev);
        });
        pipWin.document.getElementById('pip-btn-reset')?.addEventListener('click', () => {
          handleResetPomoTimer();
        });

        pipWin.addEventListener('pagehide', () => {
          setIsPipActive(false);
          pipWindowRef.current = null;
        });
      } else {
        // Standalone Window Fallback
        const popup = window.open(
          'about:blank',
          'pomodoro_pip_popup',
          'width=340,height=260,menubar=no,toolbar=no,location=no,status=no,resizable=yes'
        );
        if (popup) {
          pipWindowRef.current = popup;
          setIsPipActive(true);
          popup.document.body.innerHTML = `
            <style>
              body { margin:0; padding:16px; background:#0f172a; color:#fff; font-family:sans-serif; text-align:center; }
              .time { font-size:42px; font-weight:bold; font-family:monospace; }
            </style>
            <h3>🍅 Đồng Hồ Pomodoro Nổi</h3>
            <div class="time" id="pip-pomo-time">${formatTimer(pomoSecondsLeft)}</div>
          `;
        }
      }
    } catch (e: any) {
      console.warn('[PiP] Error requesting window:', e);
      alert('Vui lòng cho phép quyền mở Pop-up / Picture-in-Picture trên trình duyệt để sử dụng tính năng này.');
    }
  };

  // Calculate report metrics
  const totalCount = reports.length;
  const doneCount = reports.filter(r => r.status === 'Done' || r.status === 'Sent').length;
  const pendingCount = reports.filter(r => r.status !== 'Done' && r.status !== 'Sent').length;
  const isAllDone = totalCount > 0 && pendingCount === 0;
  const completionPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 100;

  // Determine late reports (due date strictly before today and status not done)
  const todayStr = new Date().toISOString().split('T')[0];
  const hasLateReports = reports.some(r => {
    const reportDate = (r.dueDate || r.date || '').split('T')[0];
    return r.status !== 'Done' && r.status !== 'Sent' && reportDate < todayStr;
  });

  // Bee Emotional State: success | late | missed | idle
  const beeState: 'success' | 'late' | 'missed' = isAllDone
    ? 'success'
    : hasLateReports
      ? 'late'
      : 'missed';

  // Realtime clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      setCurrentTime(`${hours}:${mins}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  // Quick Timer countdown effect (Break Timer)
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds !== null && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else if (timerSeconds === 0) {
      setIsTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

  // Pomodoro Countdown Effect
  useEffect(() => {
    let interval: any = null;
    if (pomoIsRunning && pomoSecondsLeft > 0) {
      interval = setInterval(() => {
        setPomoSecondsLeft(prev => prev - 1);
      }, 1000);
    } else if (pomoSecondsLeft === 0 && pomoIsRunning) {
      setPomoIsRunning(false);
      if (pomoPhase === 'focus') {
        const nextCount = pomoCompletedCount + 1;
        setPomoCompletedCount(nextCount);
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('docureport_pomo_count', nextCount.toString());
          }
        } catch (e) {
          console.warn(e);
        }

        playBeeChime('victory');
        playPomodoroAlarmSound('focus_done');
        sendNotification('🍅 Hoàn Thành 25 Phút Tập Trung Pomodoro!', {
          body: 'Chú Ong Chăm Chỉ nhắc bạn: Đã hết phiên tập trung! Hãy nghỉ ngơi 5 phút, vươn vai hoặc uống nước nhé.',
          tag: 'pomo-focus-done',
        });

        // Switch to break phase
        setPomoPhase('break');
        setPomoSecondsLeft(pomoBreakMinutes * 60);
      } else {
        playBeeChime('buzz');
        playPomodoroAlarmSound('break_done');
        sendNotification('☕ Hết 5 Phút Nghỉ Ngơi!', {
          body: 'Chú Ong Chăm Chỉ hỏi: Bạn đã sẵn sàng bắt đầu phiên tập trung Pomodoro tiếp theo chưa?',
          tag: 'pomo-break-done',
        });

        // Switch to focus phase
        setPomoPhase('focus');
        setPomoSecondsLeft(pomoFocusMinutes * 60);
      }
    }
    return () => clearInterval(interval);
  }, [pomoIsRunning, pomoSecondsLeft, pomoPhase, pomoFocusMinutes, pomoBreakMinutes, pomoCompletedCount]);

  // Sound effects
  const playBeeChime = (type: 'buzz' | 'victory') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      if (type === 'buzz') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(260, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else {
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
          gain.gain.setValueAtTime(0.1, ctx.currentTime + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.08);
          osc.stop(ctx.currentTime + idx * 0.08 + 0.25);
        });
      }
    } catch (e) {
      console.warn('Audio play exception:', e);
    }
  };

  // Refresh message on click
  const refreshSmartMessage = () => {
    const msg = getSmartMessage(beeState);
    setActiveMessage(msg);
    setIsPlayingMelody(false);
    setIsTimerRunning(false);
    setTimerSeconds(null);
  };

  const handleBeeClick = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      setIsFlying(true);
      setTimeout(() => setIsFlying(false), 600);
      refreshSmartMessage();
      playBeeChime(isAllDone ? 'victory' : 'buzz');
    }
  };

  const triggerReminderAlert = () => {
    setIsOpen(true);
    setIsFlying(true);
    setTimeout(() => setIsFlying(false), 600);
    refreshSmartMessage();
    playBeeChime(isAllDone ? 'victory' : 'buzz');
  };

  // Interactive reward action handlers
  const handleTriggerPiano = () => {
    if (!soundEnabled) setSoundEnabled(true);
    setIsPlayingMelody(true);
    playPianoMelody(activeMessage?.rewardPayload);
    setTimeout(() => setIsPlayingMelody(false), 2000);
  };

  const handleStartBreakTimer = (minutes: number) => {
    setTimerSeconds(minutes * 60);
    setIsTimerRunning(true);
  };

  const handleCopyQuote = (quoteText: string) => {
    navigator.clipboard.writeText(quoteText);
    setCopiedQuote(true);
    setTimeout(() => setCopiedQuote(false), 2000);
  };

  const formatTimer = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleApplyPomoSettings = (focusMins: number, breakMins: number) => {
    const f = Math.max(1, Math.min(180, focusMins));
    const b = Math.max(1, Math.min(60, breakMins));
    setPomoFocusMinutes(f);
    setPomoBreakMinutes(b);
    setCustomFocusInput(f.toString());
    setCustomBreakInput(b.toString());
    setPomoIsRunning(false);
    if (pomoPhase === 'focus') {
      setPomoSecondsLeft(f * 60);
    } else {
      setPomoSecondsLeft(b * 60);
    }
    setShowPomoSettings(false);
  };

  const handleResetPomoTimer = () => {
    setPomoIsRunning(false);
    if (pomoPhase === 'focus') {
      setPomoSecondsLeft(pomoFocusMinutes * 60);
    } else {
      setPomoSecondsLeft(pomoBreakMinutes * 60);
    }
  };

  const handleSwitchPomoPhase = (newPhase: 'focus' | 'break') => {
    setPomoIsRunning(false);
    setPomoPhase(newPhase);
    if (newPhase === 'focus') {
      setPomoSecondsLeft(pomoFocusMinutes * 60);
    } else {
      setPomoSecondsLeft(pomoBreakMinutes * 60);
    }
  };

  return (
    <aside aria-label="Chú Ong Chăm Chỉ Virtual Assistant" className="fixed bottom-4 right-4 z-50 flex flex-col items-end pointer-events-none">
      
      {/* SPEECH BUBBLE & DIALOG DIALOG */}
      {isOpen && (
        <div 
          className={`pointer-events-auto mb-3 max-w-sm w-78 sm:w-84 bg-white dark:bg-slate-900 rounded-3xl p-4.5 shadow-2xl border ${
            beeState === 'success'
              ? 'border-amber-400/80 dark:border-amber-500/60 shadow-amber-500/15 ring-2 ring-amber-400/20' 
              : beeState === 'late'
                ? 'border-rose-400/80 dark:border-rose-500/60 shadow-rose-500/15 ring-2 ring-rose-400/20' 
                : 'border-indigo-400/80 dark:border-indigo-500/60 shadow-indigo-500/15'
          } transition-all duration-300 transform animate-in fade-in slide-in-from-bottom-5`}
        >
          {/* Top Bar of Bubble */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-1.5">
              {beeState === 'success' ? (
                <span className="flex items-center gap-1 text-xs font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                  <Crown className="w-3.5 h-3.5 text-amber-500 animate-bounce" /> Ong Vàng Hero 👑
                </span>
              ) : beeState === 'late' ? (
                <span className="flex items-center gap-1 text-xs font-black text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
                  <Heart className="w-3.5 h-3.5 text-rose-500" /> Ong Đồng Cảm 🐝❤️
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                  <Sparkles className="w-3.5 h-3.5" /> Chú Ong Chăm Chỉ 🐝
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={refreshSmartMessage}
                className="p-1 text-slate-400 hover:text-amber-500 rounded-md transition-colors"
                title="Đổi thông điệp / Quà tặng khác"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition-colors"
                title={soundEnabled ? "Tắt âm thanh" : "Bật âm thanh"}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition-colors"
                title="Đóng hội thoại"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* TAB SWITCHER HEADER */}
          <div className="flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800/80 pb-2 mb-3">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-3 py-1 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1 ${
                activeTab === 'chat'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" /> Lời Nhắn
            </button>
            <button
              onClick={() => setActiveTab('pomodoro')}
              className={`px-3 py-1 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === 'pomodoro'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Timer className="w-3.5 h-3.5" /> 🍅 Pomodoro
              {pomoIsRunning && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-0.5" />
              )}
            </button>
          </div>

          {/* TAB CONTENT: CHAT & MESSAGES */}
          {activeTab === 'chat' && (
            <div className="space-y-3">
              {activeMessage ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 leading-snug">
                      {activeMessage.title}
                    </h4>
                    {pendingCount > 0 && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 bg-rose-500/15 text-rose-600 dark:text-rose-400 rounded-full border border-rose-500/30">
                        {pendingCount} Chờ nộp
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                    {activeMessage.body}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Buzz buzz! Ong Vàng luôn đồng hành cùng bạn!
                </p>
              )}

              {/* INTERACTIVE REWARD WIDGETS */}
              {activeMessage?.rewardType === 'pomodoro' && (
                <div className="p-2.5 bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/30 rounded-2xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center animate-pulse">
                      <Timer className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-extrabold text-rose-900 dark:text-rose-200">Pomodoro Tập Trung 🍅</p>
                      <p className="text-[10px] text-rose-700 dark:text-rose-300">25 phút tập trung + 5 phút nghỉ</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('pomodoro');
                      if (!pomoIsRunning && pomoSecondsLeft === pomoFocusMinutes * 60) {
                        setPomoIsRunning(true);
                      }
                    }}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1"
                  >
                    <Play className="w-3 h-3 fill-current" /> Bật
                  </button>
                </div>
              )}

              {activeMessage?.rewardType === 'piano_melody' && (
                <div className="p-2.5 bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center ${isPlayingMelody ? 'animate-bounce' : ''}`}>
                      <Music className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-extrabold text-amber-900 dark:text-amber-200">Bản Nhạc Thu Thư Giãn</p>
                      <p className="text-[10px] text-amber-700 dark:text-amber-300">Phát âm piano êm dịu</p>
                    </div>
                  </div>
                  <button
                    onClick={handleTriggerPiano}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1"
                  >
                    <Play className="w-3 h-3 fill-current" /> Phát
                  </button>
                </div>
              )}

              {activeMessage?.rewardType === 'break_timer' && (
                <div className="p-2.5 bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-emerald-900 dark:text-emerald-200 flex items-center gap-1">
                      <Coffee className="w-3.5 h-3.5 text-emerald-600" /> Đếm Giờ Nghỉ Thư Giãn
                    </span>
                    {timerSeconds !== null && (
                      <span className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">
                        {formatTimer(timerSeconds)}
                      </span>
                    )}
                  </div>
                  {timerSeconds === null ? (
                    <button
                      onClick={() => handleStartBreakTimer(Number(activeMessage.rewardPayload) || 5)}
                      className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1"
                    >
                      {activeMessage.rewardLabel || '⏱️ Bắt Đầu Hẹn Giờ'}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsTimerRunning(!isTimerRunning)}
                        className="flex-1 py-1 bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1"
                      >
                        {isTimerRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        {isTimerRunning ? 'Tạm Dừng' : 'Tiếp Tục'}
                      </button>
                      <button
                        onClick={() => { setTimerSeconds(null); setIsTimerRunning(false); }}
                        className="px-2 py-1 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-lg"
                      >
                        Đặt Lại
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeMessage?.rewardType === 'stretch_timer' && (
                <div className="p-2.5 bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-500/30 rounded-2xl text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
                  <p className="font-extrabold flex items-center gap-1">
                    🧘 Bài Tập 5 Động Tác Nhanh:
                  </p>
                  <ul className="text-[11px] list-disc list-inside space-y-0.5 opacity-90">
                    <li>Xoay cổ nhẹ nhàng 3 vòng.</li>
                    <li>Đẩy vai lùi về sau & mở ngực.</li>
                    <li>Duỗi 10 ngón tay và xoay cổ tay.</li>
                  </ul>
                </div>
              )}

              {activeMessage?.rewardType === 'quote' && activeMessage.rewardPayload && (
                <div className="p-2.5 bg-purple-500/10 dark:bg-purple-500/20 border border-purple-500/30 rounded-2xl space-y-1">
                  <p className="text-xs italic font-medium text-purple-900 dark:text-purple-200">
                    "{activeMessage.rewardPayload}"
                  </p>
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleCopyQuote(activeMessage.rewardPayload!)}
                      className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                    >
                      {copiedQuote ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      {copiedQuote ? 'Đã sao chép' : 'Sao chép câu nói'}
                    </button>
                  </div>
                </div>
              )}

              {/* Progress Mini Bar */}
              <div className="pt-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  <span>Tiến độ hoàn thành hôm nay</span>
                  <span>{doneCount}/{totalCount} ({completionPercent}%)</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 rounded-full ${
                      completionPercent === 100 
                        ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 animate-pulse' 
                        : 'bg-gradient-to-r from-indigo-500 to-amber-500'
                    }`}
                    style={{ width: `${completionPercent}%` }}
                  ></div>
                </div>
              </div>

              {/* Quick Action Buttons inside Speech Bubble */}
              <div className="pt-1 flex flex-wrap items-center gap-2">
                {pendingCount > 0 && (
                  <button
                    onClick={() => {
                      if (onOpenPendingModal) {
                        onOpenPendingModal();
                      } else {
                        onOpenAddModal();
                      }
                      setIsOpen(false);
                    }}
                    className="flex-1 py-1.5 px-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-1 active:scale-95"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Nộp Báo Cáo Ngay
                  </button>
                )}
                <button
                  onClick={() => {
                    onNavigateView('dashboard');
                    setIsOpen(false);
                  }}
                  className="py-1.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1 shrink-0"
                  title="Xem Thống Kê Dashboard"
                >
                  <Award className="w-3.5 h-3.5 text-amber-500" /> Thống kê
                </button>

                {onOpenNotifConfigModal && (
                  <button
                    onClick={() => {
                      onOpenNotifConfigModal();
                      setIsOpen(false);
                    }}
                    className="w-full py-1.5 px-3 bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 border border-amber-500/30"
                    title="Tùy chỉnh mốc giờ thông báo nhắc nhở"
                  >
                    <Settings className="w-3.5 h-3.5 text-amber-500" /> ⚙️ Tùy Chỉnh Mốc Giờ Thông Báo
                  </button>
                )}

                {onTriggerSimulatedUpdate && (
                  <button
                    onClick={() => {
                      onTriggerSimulatedUpdate();
                      setIsOpen(false);
                    }}
                    className="w-full py-1 px-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-bold text-[11px] rounded-lg transition-all flex items-center justify-center gap-1 border border-slate-200 dark:border-slate-700"
                    title="Thử nghiệm hiển thị thông báo cập nhật phiên bản mới"
                  >
                    <RefreshCw className="w-3 h-3" /> Kiểm tra Cập Nhật PWA
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB CONTENT: POMODORO FOCUS TIMER */}
          {activeTab === 'pomodoro' && (
            <div className="space-y-3">
              {/* Description Card with user prompt's exact statement */}
              <div className="p-3 bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/30 rounded-2xl text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-black text-rose-700 dark:text-rose-300 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5" /> Kỹ Thuật Pomodoro 🍅
                  </span>
                  <button
                    onClick={() => setShowPomoSettings(!showPomoSettings)}
                    className="p-1 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 rounded-md transition-colors"
                    title="Cài đặt số phút mong muốn"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-700 dark:text-slate-200 leading-relaxed italic">
                  "Phương pháp Pomodoro (quả cà chua) là kỹ thuật quản lý thời gian chia nhỏ công việc thành các khoảng 25 phút làm việc tập trung tối đa, xen giữa là 5 phút nghỉ ngắn."
                </p>
              </div>

              {/* Settings Drawer / Form if open */}
              {showPomoSettings ? (
                <div className="p-3 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3 text-xs animate-in fade-in">
                  <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-100">
                    <span>⚙️ Cài Đặt Số Phút Mong Muốn</span>
                    <button onClick={() => setShowPomoSettings(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Focus time setting */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Thời gian Tập Trung (phút):
                    </label>
                    <div className="flex flex-wrap gap-1.5 mb-1.5">
                      {[15, 25, 30, 45, 60].map(m => (
                        <button
                          key={m}
                          onClick={() => setCustomFocusInput(m.toString())}
                          className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                            customFocusInput === m.toString()
                              ? 'bg-rose-500 text-white'
                              : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600'
                          }`}
                        >
                          {m}p {m === 25 ? '(Chuẩn)' : ''}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min="1"
                      max="180"
                      value={customFocusInput}
                      onChange={e => setCustomFocusInput(e.target.value)}
                      className="w-full px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold"
                      placeholder="Nhập số phút tập trung mong muốn..."
                    />
                  </div>

                  {/* Break time setting */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Thời gian Nghỉ Ngơi (phút):
                    </label>
                    <div className="flex flex-wrap gap-1.5 mb-1.5">
                      {[3, 5, 10, 15].map(m => (
                        <button
                          key={m}
                          onClick={() => setCustomBreakInput(m.toString())}
                          className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                            customBreakInput === m.toString()
                              ? 'bg-emerald-500 text-white'
                              : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600'
                          }`}
                        >
                          {m}p {m === 5 ? '(Chuẩn)' : ''}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={customBreakInput}
                      onChange={e => setCustomBreakInput(e.target.value)}
                      className="w-full px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold"
                      placeholder="Nhập số phút nghỉ mong muốn..."
                    />
                  </div>

                  <button
                    onClick={() => handleApplyPomoSettings(parseInt(customFocusInput) || 25, parseInt(customBreakInput) || 5)}
                    className="w-full py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-xl shadow-md transition-all text-xs"
                  >
                    Lưu & Áp Dụng Cài Đặt
                  </button>
                </div>
              ) : (
                /* Main Pomodoro Clock Card */
                <div className="flex flex-col items-center justify-center p-4 bg-gradient-to-b from-rose-50 via-white to-amber-50 dark:from-slate-800 dark:via-slate-850 dark:to-slate-900 border border-rose-200/80 dark:border-rose-900/50 rounded-3xl relative shadow-sm">
                  {/* Phase Selector Pills */}
                  <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-800 rounded-full mb-2">
                    <button
                      onClick={() => handleSwitchPomoPhase('focus')}
                      className={`px-3 py-0.5 rounded-full text-xs font-extrabold transition-all flex items-center gap-1 ${
                        pomoPhase === 'focus'
                          ? 'bg-rose-500 text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      🍅 Tập Trung ({pomoFocusMinutes}p)
                    </button>
                    <button
                      onClick={() => handleSwitchPomoPhase('break')}
                      className={`px-3 py-0.5 rounded-full text-xs font-extrabold transition-all flex items-center gap-1 ${
                        pomoPhase === 'break'
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      ☕ Nghỉ ({pomoBreakMinutes}p)
                    </button>
                  </div>

                  {/* Huge Digital Clock */}
                  <div className="text-4xl sm:text-5xl font-black font-mono tracking-wider text-slate-900 dark:text-white my-1 drop-shadow-sm">
                    {formatTimer(pomoSecondsLeft)}
                  </div>

                  {/* Interactive Controls */}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => setPomoIsRunning(!pomoIsRunning)}
                      className={`px-4 py-2 font-black text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 ${
                        pomoIsRunning
                          ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                          : pomoPhase === 'focus'
                            ? 'bg-rose-600 hover:bg-rose-500 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      }`}
                    >
                      {pomoIsRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                      {pomoIsRunning ? 'Tạm Dừng' : 'Bắt Đầu Tập Trung'}
                    </button>

                    <button
                      onClick={handleResetPomoTimer}
                      className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-all"
                      title="Đặt lại đếm giờ"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleSwitchPomoPhase(pomoPhase === 'focus' ? 'break' : 'focus')}
                      className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-all"
                      title="Bỏ qua sang phiên tiếp"
                    >
                      <FastForward className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Desktop Float Window & Audio Alarm Action Row */}
                  <div className="w-full mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800 flex flex-col gap-1.5">
                    <button
                      onClick={handleToggleDesktopPipWindow}
                      className={`w-full py-1.5 px-3 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 ${
                        isPipActive
                          ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400'
                          : 'bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-950'
                      }`}
                      title="Mở cửa sổ đếm giờ nổi luôn nằm trên cùng màn hình máy tính ngay cả khi thu nhỏ ứng dụng"
                    >
                      <Tv className="w-3.5 h-3.5" />
                      {isPipActive ? '📌 Đang Bật Cửa Sổ Nổi Màn Hình' : '🖥️ Bật Cửa Sổ Nổi Màn Hình (Always on Top)'}
                    </button>

                    <button
                      onClick={() => playPomodoroAlarmSound('test')}
                      className="w-full py-1 px-3 text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-all flex items-center justify-center gap-1"
                      title="Phát thử âm thanh chuông báo hiệu kết thúc"
                    >
                      <Volume2 className="w-3 h-3 text-rose-500" /> 🔊 Thử Âm Thanh Chuông Báo
                    </button>
                  </div>

                  {/* Counter footer */}
                  <div className="mt-2.5 text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <span>Đã hoàn thành hôm nay:</span>
                    <span className="px-2 py-0.5 bg-rose-500/15 text-rose-600 dark:text-rose-400 rounded-full font-black border border-rose-500/30">
                      🍅 {pomoCompletedCount} quả Pomodoro
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* BEE CHARACTER BUTTON / MASCOT CONTAINER */}
      <div className="relative pointer-events-auto group">
        
        {/* Live Floating Pomodoro Countdown Badge next to Bee */}
        {pomoIsRunning && !isOpen && (
          <button
            onClick={() => {
              setIsOpen(true);
              setActiveTab('pomodoro');
            }}
            className="absolute -top-3 -right-2 z-20 px-2.5 py-1 bg-rose-600 text-white font-mono font-black text-xs rounded-full border-2 border-white dark:border-slate-900 shadow-lg flex items-center gap-1 animate-pulse hover:scale-105 transition-transform"
            title="Đang chạy đếm giờ Pomodoro. Bấm để xem chi tiết."
          >
            <span>🍅</span>
            <span>{formatTimer(pomoSecondsLeft)}</span>
          </button>
        )}

        {/* Reminder Badge Indicator */}
        {pendingCount > 0 && !isOpen && !pomoIsRunning && (
          <button
            onClick={triggerReminderAlert}
            className="absolute -top-2 -left-2 z-10 w-6 h-6 rounded-full bg-rose-500 text-white font-black text-[11px] flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-md animate-bounce"
            title={`${pendingCount} Báo cáo chưa hoàn thành. Bấm để nghe lời nhắn từ Ong.`}
          >
            {pendingCount}
          </button>
        )}

        {/* Crown Indicator on top of Bee when 100% Done */}
        {beeState === 'success' && (
          <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 z-10 animate-bounce">
            <Crown className="w-6 h-6 text-amber-400 fill-amber-300 drop-shadow-md" />
          </div>
        )}

        {/* Dynamic SVG Mascot Button */}
        <button
          onClick={handleBeeClick}
          className={`relative p-2 rounded-full bg-slate-900/10 dark:bg-white/5 hover:bg-amber-500/20 transition-all duration-300 active:scale-95 ${
            isFlying ? 'animate-bounce' : beeState === 'success' ? 'animate-bounce' : 'animate-bee-float'
          }`}
          title={
            beeState === 'success'
              ? "Ong Hero 👑: Nhận quà thưởng thành tích!"
              : beeState === 'late'
                ? "Ong Đồng Cảm 🐝❤️: Cần chia sẻ vướng mắc?"
                : "Chú Ong Chăm Chỉ 🐝: Bấm để nghe lời nhắc vui vẻ"
          }
        >
          {/* DYNAMIC EMOTIONAL SVG BEE */}
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 512 512" 
            className="w-14 h-14 sm:w-16 sm:h-16 drop-shadow-xl"
          >
            <defs>
              <linearGradient id="widgetBeeBody" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fbbf24"/>
                <stop offset="100%" stopColor="#f59e0b"/>
              </linearGradient>
              <linearGradient id="widgetWing" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95"/>
                <stop offset="100%" stopColor="#c7d2fe" stopOpacity="0.7"/>
              </linearGradient>
            </defs>
            
            {/* Flapping Wings */}
            <ellipse cx="205" cy="165" rx="55" ry="90" fill="url(#widgetWing)" className="animate-wing-left" />
            <ellipse cx="307" cy="165" rx="55" ry="90" fill="url(#widgetWing)" className="animate-wing-right" />

            {/* Superhero Cape (Success State) */}
            {beeState === 'success' && (
              <path d="M180 220 Q256 180 332 220 L370 360 Q256 400 142 360 Z" fill="#ef4444" fillOpacity="0.85" />
            )}

            {/* Bee Body */}
            <ellipse cx="256" cy="275" rx="120" ry="100" fill="url(#widgetBeeBody)"/>
            
            {/* Body Stripes */}
            <path d="M175 240 Q256 220 337 240 Q335 275 337 310 Q256 290 175 310 Z" fill="#1e1b4b"/>
            <path d="M195 340 Q256 325 317 340 Q310 355 290 368 Q256 375 222 368 Z" fill="#1e1b4b"/>
            
            {/* Stinger */}
            <path d="M370 275 Q410 275 425 270 Q410 285 370 285 Z" fill="#1e1b4b"/>

            {/* Bee Head */}
            <circle cx="256" cy="185" r="70" fill="url(#widgetBeeBody)"/>
            
            {/* Antennae */}
            <path d="M225 125 Q205 75 175 85" stroke="#1e1b4b" strokeWidth="12" strokeLinecap="round" fill="none"/>
            <circle cx="170" cy="85" r="14" fill="#fbbf24"/>
            <path d="M287 125 Q307 75 337 85" stroke="#1e1b4b" strokeWidth="12" strokeLinecap="round" fill="none"/>
            <circle cx="342" cy="85" r="14" fill="#fbbf24"/>

            {/* EYES BY EMOTIONAL STATE */}
            {beeState === 'success' ? (
              /* Joyful Eyes (Curved Arc) */
              <g>
                <path d="M210 175 Q225 155 240 175" stroke="#1e1b4b" strokeWidth="9" strokeLinecap="round" fill="none" />
                <path d="M272 175 Q287 155 302 175" stroke="#1e1b4b" strokeWidth="9" strokeLinecap="round" fill="none" />
              </g>
            ) : beeState === 'late' ? (
              /* Thoughtful / Empathetic Eyes */
              <g>
                <circle cx="225" cy="175" r="12" fill="#1e1b4b"/>
                <circle cx="227" cy="172" r="5" fill="#ffffff"/>
                <circle cx="287" cy="175" r="12" fill="#1e1b4b"/>
                <circle cx="289" cy="172" r="5" fill="#ffffff"/>
              </g>
            ) : (
              /* Playful Wink (Missed) */
              <g>
                <circle cx="225" cy="175" r="12" fill="#1e1b4b"/>
                <circle cx="229" cy="170" r="4" fill="#ffffff"/>
                {/* Winking right eye */}
                <path d="M275 175 Q287 165 299 175" stroke="#1e1b4b" strokeWidth="8" strokeLinecap="round" fill="none" />
              </g>
            )}

            {/* Cheeks */}
            <circle cx="205" cy="192" r="11" fill="#f43f5e" fillOpacity="0.5"/>
            <circle cx="307" cy="192" r="11" fill="#f43f5e" fillOpacity="0.5"/>

            {/* SMILE EXPRESSION */}
            {beeState === 'success' ? (
              /* Open Happy Smile */
              <path d="M235 198 Q256 222 277 198 Z" fill="#1e1b4b"/>
            ) : beeState === 'late' ? (
              /* Gentle Empathetic Curve */
              <path d="M242 204 Q256 210 270 204" stroke="#1e1b4b" strokeWidth="7" strokeLinecap="round" fill="none"/>
            ) : (
              /* Teasing Tongue-out Smile */
              <g>
                <path d="M238 200 Q256 218 274 200" stroke="#1e1b4b" strokeWidth="7" strokeLinecap="round" fill="none"/>
                <ellipse cx="256" cy="210" rx="6" ry="7" fill="#f43f5e" />
              </g>
            )}

            {/* PROPS / HELD ITEMS BY STATE */}
            {activeTab === 'pomodoro' || pomoIsRunning ? (
              /* Holding Juicy Tomato 🍅 */
              <g transform="translate(285, 250) rotate(-5)">
                <circle cx="30" cy="30" r="28" fill="#ef4444" stroke="#dc2626" strokeWidth="3" />
                <circle cx="22" cy="22" r="6" fill="#fca5a5" fillOpacity="0.6" />
                <path d="M30 5 L25 12 L30 10 L35 12 Z" fill="#16a34a" />
                <path d="M30 5 Q38 -2 42 2 Q35 5 30 5 Z" fill="#22c55e" />
              </g>
            ) : beeState === 'success' ? (
              /* Holding Gift Box */
              <g transform="translate(290, 260) rotate(5)">
                <rect x="0" y="0" width="60" height="60" rx="8" fill="#ef4444" />
                <rect x="25" y="0" width="10" height="60" fill="#fbbf24" />
                <rect x="0" y="25" width="60" height="10" fill="#fbbf24" />
                <circle cx="30" cy="-5" r="12" fill="#fbbf24" />
              </g>
            ) : beeState === 'late' ? (
              /* Holding Red Heart */
              <g transform="translate(295, 260)">
                <path d="M20 10 Q10 -10 0 10 Q-10 -10 -20 10 Q-20 30 0 45 Q20 30 20 10 Z" fill="#f43f5e" />
              </g>
            ) : (
              /* Holding Clipboard */
              <g transform="translate(290, 260) rotate(12)">
                <rect x="0" y="0" width="65" height="85" rx="8" fill="#ffffff" stroke="#94a3b8" strokeWidth="6" />
                <path d="M15 20 L50 20 M15 35 L45 35 M15 50 L38 50" stroke="#475569" strokeWidth="5" strokeLinecap="round" />
              </g>
            )}
            
            {/* Crown overlay if Hero Bee */}
            {beeState === 'success' && (
              <g transform="translate(180, 45)">
                <path d="M20 50 L35 15 L55 35 L76 10 L97 35 L117 15 L132 50 Z" fill="#fbbf24" stroke="#d97706" strokeWidth="6" strokeLinejoin="round"/>
                <circle cx="35" cy="20" r="7" fill="#ef4444"/>
                <circle cx="76" cy="15" r="8" fill="#3b82f6"/>
                <circle cx="117" cy="20" r="7" fill="#ef4444"/>
              </g>
            )}
          </svg>
        </button>
      </div>

    </aside>
  );
};
