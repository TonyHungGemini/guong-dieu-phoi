// Web Audio API Sound Synthesizer for Pomodoro Alarm Bell

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Play energetic alarm chime sound when Pomodoro countdown finishes
 */
export function playPomodoroAlarmSound(type: 'focus_done' | 'break_done' | 'test' = 'focus_done') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (type === 'focus_done') {
      // Pleasant 4-note victory chime (C5 -> E5 -> G5 -> C6)
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + index * 0.18);

        gain.gain.setValueAtTime(0, now + index * 0.18);
        gain.gain.linearRampToValueAtTime(0.4, now + index * 0.18 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.18 + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + index * 0.18);
        osc.stop(now + index * 0.18 + 0.65);
      });
    } else if (type === 'break_done') {
      // Double beep reminder (A5 -> A5)
      const notes = [880, 880, 1174.66];
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + index * 0.2);

        gain.gain.setValueAtTime(0, now + index * 0.2);
        gain.gain.linearRampToValueAtTime(0.3, now + index * 0.2 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.2 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + index * 0.2);
        osc.stop(now + index * 0.2 + 0.4);
      });
    } else {
      // Test chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    }

    // Also trigger device vibration if supported
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 400]);
    }
  } catch (e) {
    console.warn('[PomoAudio] Sound playback error:', e);
  }
}
