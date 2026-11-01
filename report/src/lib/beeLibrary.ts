export type BeeState = 'success' | 'missed' | 'late' | 'idle';

export type ActionType = 'piano_melody' | 'stretch_timer' | 'break_timer' | 'quote' | 'pomodoro' | 'none';

export interface BeeMessage {
  id: string;
  category: 'success' | 'missed' | 'late';
  title: string;
  body: string;
  rewardType?: ActionType;
  rewardLabel?: string;
  rewardPayload?: string; // e.g. quote text or audio note frequencies
}

// ----------------------------------------------------------------------
// RICH MESSAGE LIBRARY (15+ examples per category)
// ----------------------------------------------------------------------
export const BEE_MESSAGES: BeeMessage[] = [
  {
    id: 'pomo-001',
    category: 'success',
    title: 'Phương Pháp Pomodoro Tập Trung 🍅',
    body: 'Phương pháp Pomodoro (quả cà chua) là kỹ thuật quản lý thời gian chia nhỏ công việc thành các khoảng 25 phút làm việc tập trung tối đa, xen giữa là 5 phút nghỉ ngắn. Chú Ong sẵn sàng đồng hành cùng bạn!',
    rewardType: 'pomodoro',
    rewardLabel: '🍅 Mở Đếm Giờ Pomodoro 25 Phút',
    rewardPayload: '25-5',
  },
  // ================= SUCCESS / REWARD (15+ Items) =================
  {
    id: 'succ-001',
    category: 'success',
    title: 'Thưởng 15 phút nghỉ ngơi! ☕',
    body: 'Buzz buzz! Bạn nộp báo cáo chuẩn giờ tuyệt vời! Hãy nhâm nhi một tách trà hoặc cà phê và thư giãn 15 phút nhé!',
    rewardType: 'break_timer',
    rewardLabel: '⏱️ Mở Hẹn Giờ Nghỉ 15 Phút',
    rewardPayload: '15',
  },
  {
    id: 'succ-002',
    category: 'success',
    title: 'Giai điệu Piano thư giãn 🎹',
    body: 'Âm nhạc giúp não bộ hồi phục năng lượng! Bấm bên dưới để nghe một bản nhạc piano êm dịu Ong tặng bạn.',
    rewardType: 'piano_melody',
    rewardLabel: '🎵 Phát Nhạc Piano Thư Giãn',
    rewardPayload: 'C4-E4-G4-B4-C5',
  },
  {
    id: 'succ-003',
    category: 'success',
    title: 'Vươn vai 5 động tác 🧘‍♀️',
    body: 'Hoàn thành công việc rồi! Đứng dậy xoay vai, duỗi lưng và vươn vai 5 nhịp để bảo vệ cột sống nào!',
    rewardType: 'stretch_timer',
    rewardLabel: '🧘 Động Tác Vươn Vai Thư Giãn',
    rewardPayload: '5-stretches',
  },
  {
    id: 'succ-004',
    category: 'success',
    title: 'Lời nhắn cảm hứng hôm nay ✨',
    body: '"Sự kiên trì và kỷ luật hôm nay là nền tảng cho thành công tự do ngày mai." Bạn đang làm vô cùng tốt!',
    rewardType: 'quote',
    rewardLabel: '🌟 Đọc Thông Điệp Tích Cực',
    rewardPayload: 'Sự kiên trì và kỷ luật hôm nay là nền tảng cho thành công tự do ngày mai.',
  },
  {
    id: 'succ-005',
    category: 'success',
    title: 'Thưởng Đi Dạo Ngắn 🚶‍♂️',
    body: 'Bạn xứng đáng rời bàn làm việc 5 phút, hít thở không khí trong lành hoặc uống một ngụm nước mát lạnh!',
    rewardType: 'break_timer',
    rewardLabel: '🚶 Hẹn Giờ Đi Dạo 5 Phút',
    rewardPayload: '5',
  },
  {
    id: 'succ-006',
    category: 'success',
    title: 'Bản hợp xướng Ong Vàng 🐝🎶',
    body: 'Buzz buzz! Đội ngũ Ong Vàng cất tiếng hát vinh danh bạn vì tinh thần trách nhiệm tuyệt vời!',
    rewardType: 'piano_melody',
    rewardLabel: '🎶 Nghe Điệu Nhạc Ong Vàng',
    rewardPayload: 'G4-C5-E5-G5',
  },
  {
    id: 'succ-007',
    category: 'success',
    title: 'Huy Hiệu "Chiến Binh Đúng Hạn" 🏆',
    body: 'Bạn đã ghi tên mình vào bảng vàng đúng hạn hôm nay! Tiếp tục giữ vững phong độ đỉnh cao này nhé!',
    rewardType: 'none',
  },
  {
    id: 'succ-008',
    category: 'success',
    title: 'Xoay cổ & chớp mắt 👁️',
    body: 'Mắt bạn đã làm việc chăm chỉ. Hãy nhắm mắt 30 giây và xoay cổ nhẹ nhàng để nạp lại năng lượng nhé!',
    rewardType: 'stretch_timer',
    rewardLabel: '👁️ Bài Tập Nhắm Mắt Thư Giãn',
    rewardPayload: '30s-eye-rest',
  },
  {
    id: 'succ-009',
    category: 'success',
    title: 'Giai điệu Chuông Thủy Tinh 🔔',
    body: 'Thả lỏng đôi vai! Lắng nghe tiếng chuông thủy tinh trong trẻoOng gảy tặng bạn.',
    rewardType: 'piano_melody',
    rewardLabel: '🔔 Tiếng Chuông Thủy Tinh',
    rewardPayload: 'A4-C5-E5-A5',
  },
  {
    id: 'succ-010',
    category: 'success',
    title: 'Trà Sữa Hoặc Cà Phê? 🧋',
    body: 'Công việc hoàn thành xuất sắc! Bây giờ là lúc tự thưởng cho mình một thức uống yêu thích!',
    rewardType: 'none',
  },
  {
    id: 'succ-011',
    category: 'success',
    title: 'Gió Mới & Nắng Ấm 🌤️',
    body: 'Hướng mắt ra cửa sổ ngắm bầu trời trong 1 phút. Sự tập trung của bạn thật đáng khâm phục!',
    rewardType: 'break_timer',
    rewardLabel: '🌤️ 1 Phút Ngắm Bầu Trời',
    rewardPayload: '1',
  },
  {
    id: 'succ-012',
    category: 'success',
    title: 'Hơi Thở Sâu 4-7-8 🧘‍♂️',
    body: 'Hít vào 4s, giữ 7s, thở ra 8s. Bạn vừa vượt qua một cột mốc công việc quan trọng!',
    rewardType: 'stretch_timer',
    rewardLabel: '🧘 Bài Tập Hít Thở 4-7-8',
    rewardPayload: '478-breath',
  },
  {
    id: 'succ-013',
    category: 'success',
    title: 'Lời Nhắn Từ Tương Lai 🔮',
    body: '"Phiên bản tương lai của bạn đang mỉm cười cảm ơn vì nỗ lực nộp báo cáo hoàn hảo hôm nay!"',
    rewardType: 'quote',
    rewardLabel: '✨ Đọc Lời Nhắn Tương Lai',
    rewardPayload: 'Phiên bản tương lai của bạn đang mỉm cười cảm ơn vì nỗ lực hoàn hảo hôm nay!',
  },
  {
    id: 'succ-014',
    category: 'success',
    title: 'Bản Nhạc Hòa Tấu Êm Đềm 🎼',
    body: 'Lắng nghe những nốt nhạc du dương xua tan mọi mệt mỏi sau giờ làm việc căng thẳng.',
    rewardType: 'piano_melody',
    rewardLabel: '🎼 Nghe Bản Nhạc Thư Giãn',
    rewardPayload: 'D4-F#4-A4-D5',
  },
  {
    id: 'succ-015',
    category: 'success',
    title: 'Siêu Hùng Công Việc 🦸‍♂️',
    body: 'Buzz buzz! Hôm nay bạn chính là vị thần hiệu suất của team! Thả tim cho sự chăm chỉ này nào!',
    rewardType: 'none',
  },

  // ================= MISSED / PLAYFUL REMINDER (15+ Items) =================
  {
    id: 'miss-001',
    category: 'missed',
    title: 'Buzz! Báo cáo đang "khóc" vì nhớ bạn! 🥺',
    body: 'Chào bạn thân mến! Có vẻ báo cáo hôm nay hơi bị ngượng ngùng nên chưa tự nộp được. Bạn bấm nộp giúp nó nha!',
    rewardType: 'none',
  },
  {
    id: 'miss-002',
    category: 'missed',
    title: 'Mật ong chưa ngọt bằng báo cáo nộp xong! 🍯',
    body: 'Ong Vàng bay qua đống báo cáo chưa nộp và thì thầm: "Nộp xong là thong thả lướt web luôn bạn ơi!"',
    rewardType: 'none',
  },
  {
    id: 'miss-003',
    category: 'missed',
    title: 'Có ai đó quên mất Ong Vàng rồi sao? 🐝💭',
    body: 'Cún cưng cần đồ ăn, còn Ong Vàng chỉ cần bạn bấm "Nộp Báo Cáo" thôi! Nhanh tay kẻo hết giờ nè!',
    rewardType: 'none',
  },
  {
    id: 'miss-004',
    category: 'missed',
    title: 'Trạm Vũ Trụ Gọi Báo Cáo! 🚀',
    body: 'Tàu vũ trụ đang chờ tín hiệu báo cáo từ bạn để cất cánh! Chỉ cần 1 cú click nữa thôi!',
    rewardType: 'none',
  },
  {
    id: 'miss-005',
    category: 'missed',
    title: 'Nhắc nhẹ thôi nha, đừng giật mình! ⏰',
    body: 'Ong Vàng đến bằng sự dịu dàng nhất quả đất để nhắc bạn hoàn tất nốt báo cáo còn tồn đọng!',
    rewardType: 'none',
  },
  {
    id: 'miss-006',
    category: 'missed',
    title: 'Deadline đang gõ cửa nhẹ nhàng 🚪',
    body: 'Đừng lo lắng, Ong Vàng ở đây đồng hành cùng bạn! Hoàn thành ngay để có một buổi tối thật thảnh thơi nhé!',
    rewardType: 'none',
  },
  {
    id: 'miss-007',
    category: 'missed',
    title: 'Một cú click giải thoát tâm trí! 💡',
    body: 'Để báo cáo dở dang làm não mình tốn dung lượng lắm. Nộp luôn để xả bộ nhớ làm việc thôi!',
    rewardType: 'none',
  },
  {
    id: 'miss-008',
    category: 'missed',
    title: 'Ong Vàng mang theo chút năng lượng ⚡',
    body: 'Cần tiếp thêm động lực không? Nộp xong báo cáo này Ong Vàng sẽ tặng bạn một giai điệu siêu êm tai!',
    rewardType: 'piano_melody',
    rewardLabel: '🎵 Nghe Nhạc Lấy Động Lực',
    rewardPayload: 'E4-G#4-B4-E5',
  },
  {
    id: 'miss-009',
    category: 'missed',
    title: 'Báo cáo trốn dưới đống tab trình duyệt? 🔍',
    body: 'Buzz buzz! Hãy kiểm tra lại các tab đang mở nhé, có một em báo cáo ngoan ngoãn đang chờ bạn gửi đi đấy!',
    rewardType: 'none',
  },
  {
    id: 'miss-0010',
    category: 'missed',
    title: 'Uống ngụm nước rồi giải quyết nào! 💧',
    body: 'Uống một ngụm nước mát, vươn vai một cái và dứt điểm báo cáo trong 2 phút nào bạn ơi!',
    rewardType: 'none',
  },
  {
    id: 'miss-0011',
    category: 'missed',
    title: 'Sếp chưa nhắn nhưng Ong đã nhắc! 😉',
    body: 'Nộp trước khi bị hỏi là cảm giác siêu ngầu! Hãy trải nghiệm cảm giác chủ động ngầu lòi này ngay!',
    rewardType: 'none',
  },
  {
    id: 'miss-0012',
    category: 'missed',
    title: 'Báo cáo này ngắn lắm, làm xíu là xong! 📝',
    body: 'Chỉ mất vài phút thôi mà giải tỏa được cả sự lo lắng. Cùng Ong Vàng hoàn thành ngay nào!',
    rewardType: 'none',
  },
  {
    id: 'miss-0013',
    category: 'missed',
    title: 'Bật chế độ Siêu Tập Trung 🎯',
    body: 'Ong Vàng hóa thân thành HLV làm việc: Tập trung 3 phút dứt điểm báo cáo nào!',
    rewardType: 'none',
  },
  {
    id: 'miss-0014',
    category: 'missed',
    title: 'Cùng Ong dọn dẹp danh sách To-do 🧹',
    body: 'Nộp xong 1 báo cáo là bớt đi 1 gánh nặng. Bấm nút Nộp ngay bên dưới nha!',
    rewardType: 'none',
  },
  {
    id: 'miss-0015',
    category: 'missed',
    title: 'Hôm nay bạn làm rất tuyệt rồi! 🌟',
    body: 'Chỉ còn nốt báo cáo này nữa thôi là ngày làm việc tròn xòe hoàn hảo! Cố lên nào!',
    rewardType: 'none',
  },

  // ================= LATE / EMPATHETIC SUPPORT (15+ Items) =================
  {
    id: 'late-001',
    category: 'late',
    title: 'Có vướng mắc gì Ong hỗ trợ không? 🫂',
    body: 'Hôm nay bạn có nhiều việc quá tải phải không? Đừng quá căng thẳng nhé, muộn một chút không sao, miễn là mình giữ sức khỏe!',
    rewardType: 'none',
  },
  {
    id: 'late-002',
    category: 'late',
    title: 'Ong Vàng gửi một cái ôm đồng cảm 🐝🤍',
    body: 'Công việc đôi khi bị trễ vì những lý do khách quan. Bạn đã cố gắng hết sức rồi! Cùng dứt điểm từng bước nhé.',
    rewardType: 'none',
  },
  {
    id: 'late-003',
    category: 'late',
    title: 'Hít thở sâu & thả lỏng đôi vai 🍃',
    body: 'Đừng tự trách mình nhé! Hãy hít một hơi thật sâu, gạt bỏ lo âu và làm nốt phần việc còn lại nhé.',
    rewardType: 'stretch_timer',
    rewardLabel: '🧘 Thả Lỏng & Hít Thở Sâu',
    rewardPayload: 'deep-breath-soothe',
  },
  {
    id: 'late-004',
    category: 'late',
    title: 'Bạn không cô đơn đâu! 🤝',
    body: 'Khó khăn nào rồi cũng sẽ qua! Ong Vàng luôn ở đây cổ vũ bạn. Cần Ong hỗ trợ mở file hay duyệt nhanh không?',
    rewardType: 'none',
  },
  {
    id: 'late-005',
    category: 'late',
    title: 'Tập trung giải quyết từng việc một 🎯',
    body: 'Đừng nhìn vào độ dài công việc. Hãy chỉ tập trung viết dòng tiếp theo của báo cáo thôi, Ong tin bạn làm được!',
    rewardType: 'none',
  },
  {
    id: 'late-006',
    category: 'late',
    title: 'Thả lỏng tâm trí với nhạc êm 🎶',
    body: 'Bật một chút giai điệu nhẹ nhàng giúp xoa dịu áp lực công việc cho bạn lúc này.',
    rewardType: 'piano_melody',
    rewardLabel: '🎵 Âm Nhạc Xoa Dịu Căng Thẳng',
    rewardPayload: 'F4-A4-C5-F5',
  },
  {
    id: 'late-007',
    category: 'late',
    title: 'Nghỉ 2 phút rồi làm tiếp nha! ☕',
    body: 'Nếu đầu óc đang quá tải, hãy nhắm mắt nghỉ 2 phút. Ong Vàng sẽ canh giờ cho bạn!',
    rewardType: 'break_timer',
    rewardLabel: '⏱️ Hẹn Giờ Nghỉ 2 Phút',
    rewardPayload: '2',
  },
  {
    id: 'late-008',
    category: 'late',
    title: 'Mọi chuyện rồi sẽ ổn thôi! ✨',
    body: '"Mỗi ngày là một cơ hội mới. Báo cáo nộp trễ một chút vẫn tốt hơn là bỏ cuộc." Cố lên bạn nhé!',
    rewardType: 'quote',
    rewardLabel: '🌟 Đọc Lời Động Viên',
    rewardPayload: 'Mỗi ngày là một cơ hội mới. Báo cáo trễ một chút vẫn tốt hơn là bỏ cuộc!',
  },
  {
    id: 'late-009',
    category: 'late',
    title: 'Cố lên! Sắp tới đích rồi! 🏁',
    body: 'Bạn đã đi được 80% quãng đường rồi, chỉ còn chặng cuối thôi. Ong Vàng đang reo hò cổ vũ bạn đây!',
    rewardType: 'none',
  },
  {
    id: 'late-010',
    category: 'late',
    title: 'Chia nhỏ báo cáo ra làm 🧩',
    body: 'Hãy ghi lại những ý chính trước, chi tiết bổ sung sau. Đừng áp lực hoàn hảo quá nhé!',
    rewardType: 'none',
  },
  {
    id: 'late-011',
    category: 'late',
    title: 'Ong Vàng luôn đứng về phía bạn! 💛',
    body: 'Ai cũng có lúc bị chậm tiến độ. Điều quan trọng là bạn vẫn đang kiên trì xử lý nó. Bạn rất tuyệt vời!',
    rewardType: 'none',
  },
  {
    id: 'late-012',
    category: 'late',
    title: 'Một ly nước ấm sẽ giúp bạn tỉnh táo 🍵',
    body: 'Rót một ly nước ấm, uống từng ngụm nhỏ để giải xơ căng thần kinh trước khi tiếp tục công việc nhé.',
    rewardType: 'none',
  },
  {
    id: 'late-013',
    category: 'late',
    title: 'Ong gởi năng lượng tích cực ⚡✨',
    body: 'Tất cả năng lượng may mắn của tổ ong đang hướng về bàn làm việc của bạn! Tiến lên nào!',
    rewardType: 'none',
  },
  {
    id: 'late-014',
    category: 'late',
    title: 'Đừng ngần ngại nhờ đồng đội! 👥',
    body: 'Nếu thông tin báo cáo chưa đủ, hãy gửi tin nhắn nhờ đồng đội hỗ trợ một tay nhé!',
    rewardType: 'none',
  },
  {
    id: 'late-015',
    category: 'late',
    title: 'Hoàn thành tốt hơn hoàn hảo! 🏆',
    body: 'Nộp báo cáo ngay bây giờ là giải pháp tốt nhất. Đừng ngần ngại gửi đi bạn nhé!',
    rewardType: 'none',
  },
];

// ----------------------------------------------------------------------
// ANTI-REPETITION SHUFFLE & RANDOMIZATION ENGINE
// ----------------------------------------------------------------------
const STORAGE_PREFIX = 'docureport_bee_used_';

function getUsedIds(category: string): string[] {
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_PREFIX + category);
      return raw ? JSON.parse(raw) : [];
    }
  } catch (e) {
    console.warn('Error reading used message ids:', e);
  }
  return [];
}

function saveUsedIds(category: string, ids: string[]): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_PREFIX + category, JSON.stringify(ids));
    }
  } catch (e) {
    console.warn('Error saving used message ids:', e);
  }
}

/**
 * Gets a smart non-repeating message for a given state (success | missed | late).
 * Ensures every message in the category is used before repeating.
 */
export function getSmartMessage(state: 'success' | 'missed' | 'late'): BeeMessage {
  const categoryMessages = BEE_MESSAGES.filter(m => m.category === state);

  if (categoryMessages.length === 0) {
    // Fallback message
    return {
      id: 'fallback',
      category: state,
      title: 'Buzz buzz!',
      body: 'Ong Vàng luôn đồng hành cùng bạn trong mọi báo cáo!',
    };
  }

  let usedIds = getUsedIds(state);

  // If all messages in category have been used, reset the pool!
  if (usedIds.length >= categoryMessages.length) {
    usedIds = [];
  }

  // Filter available messages that have NOT been used yet
  const available = categoryMessages.filter(m => !usedIds.includes(m.id));

  // Pick random message from available list
  const selected = available[Math.floor(Math.random() * available.length)];

  // Record selected ID and update storage
  usedIds.push(selected.id);
  saveUsedIds(state, usedIds);

  return selected;
}

/**
 * Web Audio API relaxation melody synthesizer
 */
export function playPianoMelody(payload?: string) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Map note names to frequencies
    const noteFreqs: Record<string, number> = {
      'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.00, 'B4': 493.88,
      'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00, 'B5': 987.77, 'C6': 1046.50
    };

    const notes = payload ? payload.split('-') : ['C4', 'E4', 'G4', 'B4', 'C5'];

    notes.forEach((note, idx) => {
      const freq = noteFreqs[note.trim()] || 523.25;
      const startTime = ctx.currentTime + idx * 0.18;

      // Soft Sine + Triangle tone mimicking gentle piano chimes
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      // Envelope with smooth decay
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.18, startTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.82);
    });
  } catch (e) {
    console.warn('Piano audio synthesis error:', e);
  }
}
