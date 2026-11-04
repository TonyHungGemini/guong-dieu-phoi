/* ============================================================
   GUỒNG — Excel mẫu: điền biến, lưu bản mới, giữ số liệu kỳ sau
   ============================================================ */
(function () {
  "use strict";

  const A = window.App;
  if (!A) return;

  const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const MAX_BYTES = 8 * 1024 * 1024;
  const DEFAULT_PATTERN = "{{title}} - {{date}}";
  const TOKEN_RE = /\{\{\s*([\p{L}\p{N}_\-. ]{1,60}?)\s*\}\}/gu;
  const EXACT_TOKEN_RE = /^\{\{\s*([^{}]+?)\s*\}\}$/u;
  const esc = A.esc;

  const BUILTIN_KEYS = new Map([
    ["title", "title"],
    ["tieu_de", "title"],
    ["ten_bao_cao", "title"],
    ["project", "project"],
    ["du_an", "project"],
    ["date", "date"],
    ["ngay", "date"],
    ["ngay_bao_cao", "date"],
    ["due", "due"],
    ["han", "due"],
    ["han_nop", "due"],
    ["due_date", "due"],
    ["category", "category"],
    ["danh_muc", "category"],
    ["month", "month"],
    ["thang", "month"],
    ["year", "year"],
    ["nam", "year"],
    ["week", "week"],
    ["tuan", "week"],
    ["period", "period"],
    ["ky", "period"],
    ["ky_bao_cao", "period"],
    ["status", "status"],
    ["trang_thai", "status"],
    ["notes", "notes"],
    ["ghi_chu", "notes"],
    ["noi_dung", "notes"],
    ["report_type", "report_type"],
    ["loai_bao_cao", "report_type"],
  ]);

  const BUILTIN_TOKEN = {
    title: "title",
    project: "du_an",
    date: "ngay",
    due: "han_nop",
    category: "danh_muc",
    month: "thang",
    year: "nam",
    week: "tuan",
    period: "ky",
    status: "trang_thai",
    notes: "ghi_chu",
    report_type: "loai_bao_cao",
  };

  const STATUS_LABEL = {
    "To-do": "Chờ làm",
    "In Progress": "Đang làm",
    "Pending Review": "Chờ duyệt",
    Done: "Hoàn thành",
    Sent: "Đã gửi",
  };
  const FREQ_LABEL = { none: "Không định kỳ", daily: "Hàng ngày", weekly: "Hàng tuần", monthly: "Hàng tháng", yearly: "Hàng năm" };

  const COLS_PER_PAGE = 16;
  const ROWS_PER_PAGE = 60;

  const state = {
    busy: null,
    error: "",
    draft: Object.create(null),
    suggestion: null,
    libPromise: null,
    grid: null,
    gridLoading: null,
    gridFailed: null,
    aiScan: null,
  };

  function bridge() {
    return A.excelBridge || null;
  }

  function normalizeKey(raw) {
    return String(raw || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/đ/g, "d")
      .replace(/[\s.-]+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 60);
  }

  function labelFor(key) {
    const text = String(key || "")
      .split("_")
      .filter(Boolean)
      .join(" ");
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Số liệu";
  }

  function parseISO(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
    return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
  }

  function fmtDate(iso, sep) {
    const date = parseISO(iso);
    if (!date) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(date.getUTCDate())}${sep}${pad(date.getUTCMonth() + 1)}${sep}${date.getUTCFullYear()}`;
  }

  function isoWeek(iso) {
    const date = parseISO(iso);
    if (!date) return "";
    const target = new Date(date.getTime());
    const day = (target.getUTCDay() + 6) % 7;
    target.setUTCDate(target.getUTCDate() - day + 1);
    const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
    const firstDay = (firstThursday.getUTCDay() + 6) % 7;
    firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 1);
    return String(1 + Math.round((target - firstThursday) / (7 * 86400000)));
  }

  function builtinValue(key, report, filename) {
    const iso = report.date || A.todayISO();
    const sep = filename ? "-" : "/";
    switch (key) {
      case "title":
        return report.title || "";
      case "project":
        return report.project || "";
      case "date":
        return fmtDate(iso, sep);
      case "due":
        return report.dueDate ? fmtDate(report.dueDate, sep) : "";
      case "category":
      case "report_type":
        return report.category || "";
      case "month":
        return iso.slice(5, 7);
      case "year":
        return iso.slice(0, 4);
      case "week":
        return `Tuần ${isoWeek(iso)}`;
      case "period": {
        const freq = report.frequency || "none";
        if (freq === "weekly") return `Tuần ${isoWeek(iso)}`;
        if (freq === "monthly") return `Tháng ${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
        if (freq === "yearly") return iso.slice(0, 4);
        return fmtDate(iso, sep);
      }
      case "status":
        return STATUS_LABEL[report.status] || report.status || "";
      case "notes":
        return report.notes || "";
      default:
        return "";
    }
  }

  function builtinToken(key) {
    return BUILTIN_TOKEN[key] || key;
  }

  function draftOf(report) {
    const id = report.id;
    if (!state.draft[id]) {
      const excel = report.excel || {};
      state.draft[id] = {
        values: Object.assign({}, excel.values || {}),
        filenamePattern: String(excel.filenamePattern || DEFAULT_PATTERN),
      };
    }
    return state.draft[id];
  }

  function resolveToken(raw, report, values, filename) {
    const key = normalizeKey(raw);
    if (!key) return "";
    const builtin = BUILTIN_KEYS.get(key);
    if (builtin) return builtinValue(builtin, report, filename);
    const value = values && Object.prototype.hasOwnProperty.call(values, key) ? values[key] : "";
    return value === null || value === undefined ? "" : String(value);
  }

  function sanitizeFilename(value) {
    return String(value || "")
      .normalize("NFC")
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
      .replace(/\s+/g, " ")
      .replace(/^[\s._-]+|[\s._-]+$/g, "")
      .replace(/-{2,}/g, "-")
      .slice(0, 150)
      .trim();
  }

  function filenameFor(report, pattern) {
    const draft = draftOf(report);
    const raw = String(pattern === undefined ? draft.filenamePattern : pattern).trim() || DEFAULT_PATTERN;
    const filled = raw.replace(TOKEN_RE, (_, token) => resolveToken(token, report, draft.values, true));
    let name = sanitizeFilename(filled);
    if (!name) name = `Bao-cao-${fmtDate(report.date || A.todayISO(), "-")}`;
    if (!/\.xlsx$/i.test(name)) name += ".xlsx";
    return name;
  }

  function fileUrl(id, download) {
    return `/api/files/${encodeURIComponent(id)}${download ? "?download=1" : ""}`;
  }

  function fileSize(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1048576) return `${Math.round(n / 1024)} KB`;
    return `${(n / 1048576).toFixed(1)} MB`;
  }

  function apiReady() {
    if (location.hostname.endsWith("github.io")) {
      A.toast("Bản GitHub Pages không có kho tệp. Mở guong.tonyhung.workers.dev để dùng Excel mẫu.", "error");
      return false;
    }
    return true;
  }

  function loadExcelJS() {
    if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
    if (!state.libPromise) {
      state.libPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "assets/vendor/exceljs.min.js";
        script.async = true;
        script.onload = () => {
          if (window.ExcelJS) resolve(window.ExcelJS);
          else reject(new Error("Thư viện Excel chưa sẵn sàng."));
        };
        script.onerror = () => {
          state.libPromise = null;
          reject(new Error("Chưa tải được thư viện Excel. Kiểm tra mạng rồi thử lại."));
        };
        document.head.appendChild(script);
      });
    }
    return state.libPromise;
  }

  function readCellText(value) {
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object") return "";
    if (value.formula || value.sharedFormula) return "";
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || "").join("");
    if (typeof value.text === "string") return value.text;
    return "";
  }

  function pairText(value) {
    return readCellText(value).replace(/\s+/g, " ").trim();
  }

  function cellDisplay(value) {
    if (typeof value === "number") return String(value);
    if (value instanceof Date) return fmtDate(value.toISOString().slice(0, 10), "/");
    return pairText(value);
  }

  function pairId(pair) {
    return `${pair.sheet}!${pair.address}`;
  }

  function detectPairs(workbook) {
    const pairs = [];
    const used = new Set();
    workbook.eachSheet((sheet) => {
      sheet.eachRow({ includeEmpty: false }, (row) => {
        const cells = [];
        row.eachCell({ includeEmpty: false }, (cell, col) => cells.push({ cell, col }));
        if (cells.length !== 2) return;
        const [left, right] = cells;
        if (right.col - left.col > 2) return;
        const label = pairText(left.cell.value).replace(/[:\s]+$/, "");
        if (label.length < 2 || label.length > 60 || !/\p{L}/u.test(label)) return;
        if (!/\p{Ll}/u.test(label)) return;
        if (/\bngày\b.*\btháng\b.*\bnăm\b/iu.test(label)) return;
        const rawValue = right.cell.value;
        if (rawValue && typeof rawValue === "object" && (rawValue.formula || rawValue.sharedFormula)) return;
        const value = cellDisplay(rawValue);
        if (!value || value.includes("{{")) return;
        if (value.length > 80 || value === label) return;
        const base = normalizeKey(label);
        if (!base) return;
        const builtin = BUILTIN_KEYS.get(base) || "";
        let key = builtin || base;
        if (!builtin) {
          let n = 2;
          while (used.has(key)) key = `${base}_${n++}`;
        }
        used.add(key);
        pairs.push({
          label,
          key,
          builtin,
          sheet: sheet.name,
          address: String(right.cell.address || ""),
          value,
          token: builtin ? `{{${BUILTIN_TOKEN[builtin]}}}` : `{{${key}}}`,
        });
      });
    });
    return pairs.slice(0, 40);
  }

  function sheetStats(sheet) {
    let cells = 0;
    let formulas = 0;
    let dates = 0;
    let rows = 0;
    let cols = 0;
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const value = cell.value;
        if (value === null || value === undefined || value === "") return;
        cells += 1;
        if (rowNumber > rows) rows = rowNumber;
        if (colNumber > cols) cols = colNumber;
        if (value instanceof Date) dates += 1;
        else if (typeof value === "object" && (value.formula || value.sharedFormula)) formulas += 1;
      });
    });
    return { rows, cols, cells, formulas, dates, merges: (sheet.model.merges || []).length };
  }

  function dateHint(text) {
    const match = /(^|[^\d])(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{4})(?!\d)/.exec(String(text || ""));
    if (!match) return "";
    const day = Number(match[2]);
    const month = Number(match[3]);
    const year = Number(match[4]);
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000 || year > 2100) return "";
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function monthHint(text) {
    const match = /\b(THÁNG|Tháng|tháng)\s+(\d{1,2})\s*[/\-]\s*(\d{4})\b/u.exec(String(text || ""));
    if (!match) return "";
    const month = Number(match[2]);
    const year = Number(match[3]);
    if (month < 1 || month > 12 || year < 2000 || year > 2100) return "";
    return `${year}-${String(month).padStart(2, "0")}-01`;
  }

  async function inspectWorkbook(buffer) {
    const ExcelJS = await loadExcelJS();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const fields = new Map();
    const builtins = new Set();
    const sheetNames = [];
    let dateGuess = "";
    let monthGuess = "";
    let totalCells = 0;
    let totalFormulas = 0;
    let totalMerges = 0;
    let maxRows = 0;
    let maxCols = 0;
    let gridSheet = "";
    let gridCells = -1;
    workbook.eachSheet((sheet) => {
      const stats = sheetStats(sheet);
      sheetNames.push(sheet.name);
      totalCells += stats.cells;
      totalFormulas += stats.formulas;
      totalMerges += stats.merges;
      if (stats.rows > maxRows) maxRows = stats.rows;
      if (stats.cols > maxCols) maxCols = stats.cols;
      if (stats.cells > gridCells) {
        gridCells = stats.cells;
        gridSheet = sheet.name;
      }
      sheet.eachRow({ includeEmpty: false }, (row) => {
        row.eachCell({ includeEmpty: false }, (cell) => {
          const text = readCellText(cell.value);
          if (!dateGuess && text) dateGuess = dateHint(text);
          if (!monthGuess && text) monthGuess = monthHint(text);
          if (!text || !text.includes("{{")) return;
          for (const match of text.matchAll(TOKEN_RE)) {
            const key = normalizeKey(match[1]);
            if (!key) continue;
            const builtin = BUILTIN_KEYS.get(key);
            if (builtin) {
              builtins.add(builtin);
              continue;
            }
            let field = fields.get(key);
            if (!field) {
              if (fields.size >= 120) continue;
              field = { key, label: labelFor(key), count: 0, sheets: [] };
              fields.set(key, field);
            }
            field.count += 1;
            if (field.sheets.length < 3 && !field.sheets.includes(sheet.name)) field.sheets.push(sheet.name);
          }
        });
      });
    });
    if (!totalCells) {
      throw new Error("Tệp Excel không có dữ liệu. Kiểm tra lại tệp rồi thử lại.");
    }
    const suggestions = !fields.size && !builtins.size ? detectPairs(workbook) : [];
    return {
      fields: Array.from(fields.values()),
      builtins: Array.from(builtins),
      suggestions,
      sheetNames: sheetNames.slice(0, 20),
      gridSheet,
      dateGuess,
      monthGuess,
      stats: {
        sheets: sheetNames.length,
        rows: maxRows,
        cols: maxCols,
        cells: totalCells,
        formulas: totalFormulas,
        merges: totalMerges,
      },
    };
  }

  async function fillWorkbook(buffer, report, values) {
    const ExcelJS = await loadExcelJS();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    workbook.eachSheet((sheet) => {
      sheet.eachRow({ includeEmpty: false }, (row) => {
        row.eachCell({ includeEmpty: false }, (cell) => {
          const value = cell.value;
          if (typeof value === "string") {
            if (!value.includes("{{")) return;
            const exact = value.trim().match(EXACT_TOKEN_RE);
            const next = value.replace(TOKEN_RE, (_, token) => resolveToken(token, report, values, false));
            if (exact) {
              const resolved = resolveToken(exact[1], report, values, false).trim();
              if (/^-?\d+(\.\d+)?$/.test(resolved)) {
                cell.value = Number(resolved);
                return;
              }
            }
            cell.value = next;
            return;
          }
          if (value && typeof value === "object" && Array.isArray(value.richText)) {
            const text = readCellText(value);
            if (!text.includes("{{")) return;
            cell.value = text.replace(TOKEN_RE, (_, token) => resolveToken(token, report, values, false));
          }
        });
      });
    });
    workbook.calcProperties.fullCalcOnLoad = true;
    return workbook.xlsx.writeBuffer();
  }

  async function fetchTemplate(report) {
    const id = report.excel && report.excel.templateId;
    if (!id) throw new Error("Báo cáo chưa có tệp mẫu Excel.");
    const res = await fetch(fileUrl(id, true), { credentials: "same-origin", cache: "no-store" });
    if (!res.ok) {
      throw new Error(res.status === 404 ? "Tệp mẫu không còn trong kho. Hãy tải mẫu lại." : `Không tải được tệp mẫu (${res.status}).`);
    }
    return res.arrayBuffer();
  }

  async function fetchFileBuffer(id) {
    if (!id) throw new Error("Chưa có tệp Excel để mở.");
    const res = await fetch(fileUrl(id, true), { credentials: "same-origin", cache: "no-store" });
    if (!res.ok) {
      const err = new Error(res.status === 404 ? "Tệp Excel không còn trong kho. Hãy tải lại tệp gốc hoặc đổi tệp mẫu." : `Không tải được tệp Excel (${res.status}).`);
      err.status = res.status;
      throw err;
    }
    return res.arrayBuffer();
  }

  async function postFile(report, blob, name, role) {
    const res = await fetch("/api/files", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/octet-stream",
        "x-file-name": encodeURIComponent(name),
        "x-file-type": XLSX_MIME,
        "x-report-id": report.id,
        "x-file-role": role,
      },
      body: blob,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.file) throw new Error(data.error || `Máy chủ trả về ${res.status}`);
    const meta = data.file;
    const bridgeRef = bridge();
    if (bridgeRef) bridgeRef.addFile(meta);
    return meta;
  }

  async function deleteFile(id) {
    if (!id) return;
    const res = await fetch(`/api/files/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "same-origin" });
    if (!res.ok) throw new Error(`Không xoá được tệp (${res.status})`);
    const bridgeRef = bridge();
    if (bridgeRef) bridgeRef.removeFile(id);
  }

  function setBusy(report, text) {
    state.busy = text ? { id: report.id, text } : null;
    state.error = "";
    const bridgeRef = bridge();
    if (bridgeRef) bridgeRef.refreshDetail();
  }

  function setError(report, err) {
    state.busy = null;
    state.error = err && err.message ? err.message : "Chưa xử lý được tệp Excel.";
    const bridgeRef = bridge();
    if (bridgeRef) bridgeRef.refreshDetail();
    A.toast(state.error, "error");
  }

  async function uploadTemplate(report, file) {
    if (!apiReady()) return;
    state.suggestion = null;
    if (!/\.xlsx$/i.test(file.name)) {
      A.toast("Chỉ nhận tệp .xlsx. Tệp .xls hoặc .xlsm cần lưu lại thành .xlsx trước.", "error");
      return;
    }
    if (file.size > MAX_BYTES) {
      A.toast("Tệp mẫu vượt quá 8MB. Nén ảnh hoặc bớt sheet rồi thử lại.", "error");
      return;
    }
    setBusy(report, "Đang đọc mẫu Excel…");
    try {
      const buffer = await file.arrayBuffer();
      const info = await inspectWorkbook(buffer);
      if (!info.fields.length && !info.builtins.length) {
        const pairs = info.suggestions || [];
        if (!pairs.length) {
          setBusy(report, "Đang lưu bảng lên kho…");
          await installGridTemplate(report, buffer, file.name, info);
          return;
        }
        state.suggestion = {
          reportId: report.id,
          fileName: file.name,
          buffer,
          info,
          pairs,
          selected: new Set(pairs.map(pairId)),
        };
        state.busy = null;
        state.error = "";
        if (bridge()) bridge().refreshDetail();
        A.toast(`Tệp chưa có biến. GUỒNG thấy ${pairs.length} cặp nhãn – số liệu, chọn rồi dùng làm mẫu.`, "info");
        return;
      }
      setBusy(report, "Đang lưu mẫu lên kho…");
      await installTemplate(report, buffer, file.name, info, {});
    } catch (err) {
      const hint = /zip|central directory|corrupt|end of data|signature/i.test(String(err && err.message))
        ? "Tệp không phải .xlsx hợp lệ. Mở bằng Excel rồi Lưu thành .xlsx."
        : err.message || "Chưa đọc được mẫu Excel.";
      setError(report, new Error(hint));
    }
  }

  async function installTemplate(report, buffer, name, info, defaults) {
    const meta = await postFile(report, new Blob([buffer], { type: XLSX_MIME }), name, "excel-template");
    const old = report.excel || {};
    const values = {};
    info.fields.forEach((field) => {
      const key = String(field.key);
      if (defaults && Object.prototype.hasOwnProperty.call(defaults, key)) values[key] = String(defaults[key] ?? "");
      else if (old.values && Object.prototype.hasOwnProperty.call(old.values, key)) values[key] = String(old.values[key] ?? "");
      else values[key] = "";
    });
    report.excel = {
      templateId: meta.id,
      templateName: meta.name,
      templateSize: meta.size,
      templateSheets: info.sheetNames,
      fields: info.fields,
      builtins: info.builtins,
      values,
      filenamePattern: String(old.filenamePattern || DEFAULT_PATTERN),
      latestId: old.latestId || "",
      latestName: old.latestName || "",
      latestAt: old.latestAt || "",
      latestSize: old.latestSize || 0,
      lastSavedAt: old.lastSavedAt || "",
      updatedAt: new Date().toISOString(),
    };
    delete state.draft[report.id];
    const bridgeRef = bridge();
    if (bridgeRef) {
      bridgeRef.log(report, "excel", `Mẫu ${meta.name} · ${info.fields.length} biến`);
      await bridgeRef.save(report);
    }
    if (old.templateId && old.templateId !== meta.id) {
      deleteFile(old.templateId).catch(() => {});
    }
    state.busy = null;
    state.suggestion = null;
    state.error = "";
    if (bridgeRef) bridgeRef.refreshDetail();
    A.toast(`Đã nhận mẫu “${meta.name}”.`, "success");
  }

  async function installGridTemplate(report, buffer, name, info) {
    const old = report.excel || {};
    const meta = await postFile(report, new Blob([buffer], { type: XLSX_MIME }), name, "excel-template");
    let gridDate = report.date || A.todayISO();
    const anchor = gridDate;
    const near = (iso, days) => Boolean(iso && A.diffDays && Math.abs(A.diffDays(iso, anchor)) <= days);
    if (near(info.dateGuess, 183)) gridDate = info.dateGuess;
    else if (near(info.monthGuess, 400)) gridDate = info.monthGuess;
    report.excel = {
      mode: "grid",
      templateId: meta.id,
      templateName: meta.name,
      templateSize: meta.size,
      templateSheets: info.sheetNames,
      gridSheet: info.gridSheet,
      gridDate,
      gridStats: info.stats,
      fields: [],
      builtins: [],
      values: {},
      filenamePattern: String(old.filenamePattern || DEFAULT_PATTERN),
      latestId: "",
      latestName: "",
      latestAt: "",
      latestSize: 0,
      lastSavedAt: "",
      updatedAt: new Date().toISOString(),
    };
    delete state.draft[report.id];
    resetGrid();
    const bridgeRef = bridge();
    if (bridgeRef) {
      bridgeRef.log(report, "excel", `Bảng trực tiếp ${meta.name} · ${info.stats.rows} hàng`);
      await bridgeRef.save(report);
    }
    if (old.templateId && old.templateId !== meta.id) deleteFile(old.templateId).catch(() => {});
    state.busy = null;
    state.suggestion = null;
    state.error = "";
    if (bridgeRef) bridgeRef.refreshDetail();
    A.toast(`Đã nhận bảng “${meta.name}”. Sửa trực tiếp rồi bấm Lưu.`, "success");
  }

  async function useGridSuggestion(report) {
    if (!apiReady()) return;
    const suggestion = state.suggestion;
    if (!suggestion || suggestion.reportId !== report.id) return;
    setBusy(report, "Đang mở bảng trực tiếp…");
    try {
      const info = suggestion.info || (await inspectWorkbook(suggestion.buffer));
      setBusy(report, "Đang lưu bảng lên kho…");
      await installGridTemplate(report, suggestion.buffer, suggestion.fileName, info);
    } catch (err) {
      setError(report, err);
    }
  }

  async function applySuggestion(report) {
    if (!apiReady()) return;
    const suggestion = state.suggestion;
    if (!suggestion || suggestion.reportId !== report.id) return;
    const selected = suggestion.pairs.filter((pair) => suggestion.selected.has(pairId(pair)));
    if (!selected.length) {
      A.toast("Chọn ít nhất một ô cần nhập lại mỗi kỳ.", "error");
      return;
    }
    setBusy(report, "Đang tạo mẫu từ báo cáo…");
    try {
      const ExcelJS = await loadExcelJS();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(suggestion.buffer);
      selected.forEach((pair) => {
        const sheet = workbook.getWorksheet(pair.sheet);
        if (sheet) sheet.getCell(pair.address).value = pair.token;
      });
      workbook.calcProperties.fullCalcOnLoad = true;
      const output = await workbook.xlsx.writeBuffer();
      const info = await inspectWorkbook(output);
      if (!info.fields.length && !info.builtins.length) {
        throw new Error("Chưa tạo được biến từ các ô đã chọn. Thử chọn ô khác hoặc thêm {{ten_bien}} vào Excel.");
      }
      const defaults = {};
      selected.forEach((pair) => {
        if (!pair.builtin) defaults[pair.key] = pair.value;
      });
      setBusy(report, "Đang lưu mẫu lên kho…");
      await installTemplate(report, output, suggestion.fileName, info, defaults);
    } catch (err) {
      setError(report, err);
    }
  }

  async function saveVersion(report, options) {
    const opts = options || {};
    if (!apiReady()) return null;
    const bridgeRef = bridge();
    const draft = draftOf(report);
    setBusy(report, "Đang ghép số liệu vào mẫu…");
    try {
      const buffer = await fetchTemplate(report);
      const output = await fillWorkbook(buffer, report, draft.values);
      const name = filenameFor(report);
      setBusy(report, "Đang lưu bản Excel mới…");
      const blob = new Blob([output], { type: XLSX_MIME });
      const meta = await postFile(report, blob, name, "excel-latest");
      const old = report.excel || {};
      report.excel = Object.assign({}, old, {
        values: Object.assign({}, draft.values),
        filenamePattern: draft.filenamePattern || DEFAULT_PATTERN,
        latestId: meta.id,
        latestName: meta.name,
        latestAt: meta.uploadedAt,
        latestSize: meta.size,
        latestVersion: meta.version,
        lastSavedAt: meta.uploadedAt,
        updatedAt: new Date().toISOString(),
      });
      if (bridgeRef) {
        bridgeRef.log(report, "excel", `Lưu ${meta.name}`);
        await bridgeRef.save(report);
      }
      delete state.draft[report.id];
      state.busy = null;
      if (bridgeRef) bridgeRef.refreshDetail();
      if (opts.toast !== false) A.toast(`Đã lưu “${meta.name}”.`, "success");
      if (opts.download === false) {
        pruneGenerated(report.id, meta.id);
        return { id: meta.id, name: meta.name };
      }
      const link = document.createElement("a");
      link.href = fileUrl(meta.id, true);
      link.download = meta.name;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      pruneGenerated(report.id, meta.id);
      return { id: meta.id, name: meta.name };
    } catch (err) {
      setError(report, err);
      return null;
    }
  }

  /* ---------- chế độ sửa bảng trực tiếp ---------- */
  function resetGrid(reportId) {
    if (!reportId || (state.grid && state.grid.reportId === reportId)) {
      state.grid = null;
      state.aiScan = null;
    }
  }

  function parseAddress(address) {
    const match = /^([A-Z]+)(\d+)$/i.exec(String(address || "").trim());
    if (!match) return null;
    let col = 0;
    const letters = match[1].toUpperCase();
    for (let i = 0; i < letters.length; i += 1) col = col * 26 + (letters.charCodeAt(i) - 64);
    return { col, row: Number(match[2]) };
  }

  function prepareGridSheet(cache, sheet) {
    cache.sheet = sheet.name;
    cache.sheetRef = sheet;
    let usedRows = 0;
    let usedCols = 0;
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const value = cell.value;
        if (value === null || value === undefined || value === "") return;
        if (rowNumber > usedRows) usedRows = rowNumber;
        if (colNumber > usedCols) usedCols = colNumber;
      });
    });
    cache.maxRow = Math.max(1, Math.min(usedRows || sheet.rowCount || 1, 500));
    cache.maxCol = Math.max(1, Math.min(usedCols || sheet.columnCount || 1, 5000));
    cache.spans = new Map();
    const merges = sheet.model && Array.isArray(sheet.model.merges) ? sheet.model.merges : [];
    merges.forEach((range) => {
      const parts = String(range).split(":");
      const start = parseAddress(parts[0]);
      const end = parseAddress(parts[1] || parts[0]);
      if (!start || !end) return;
      cache.spans.set(`${start.row}:${start.col}`, { rows: end.row - start.row + 1, cols: end.col - start.col + 1 });
    });
    cache.dayGroups = [];
    cache.fixedCols = 0;
    let best = null;
    const lastRow = Math.min(cache.maxRow, 12);
    for (let row = 1; row <= lastRow; row += 1) {
      const groups = [];
      for (let col = 1; col <= cache.maxCol; col += 1) {
        const text = pairText(sheet.getCell(row, col).value);
        if (!/^ngày\s+\d{1,2}/iu.test(text)) continue;
        const last = groups[groups.length - 1];
        if (!last || last.label !== text) groups.push({ label: text, col });
      }
      if (!best || groups.length > best.length) best = groups;
    }
    if (best && best.length >= 3) {
      cache.dayGroups = best.map((group, index) => ({
        label: group.label,
        col: group.col,
        end: index + 1 < best.length ? best[index + 1].col - 1 : Math.min(cache.maxCol, group.col + 3),
      }));
      cache.fixedCols = Math.min(cache.dayGroups[0].col - 1, 6);
    }
    cache.page = 0;
    cache.rowPage = 0;
    cache.dayFocus = 0;
  }

  async function loadGrid(report) {
    const excel = report.excel || {};
    let baseId = excel.latestId || excel.templateId;
    if (!baseId) throw new Error("Báo cáo chưa có tệp Excel.");
    if (state.grid && state.grid.reportId === report.id && state.grid.baseId === baseId) return state.grid;
    if (state.gridLoading && state.gridLoading.id === report.id) return state.gridLoading.promise;
    const promise = (async () => {
      const ExcelJS = await loadExcelJS();
      let buffer = null;
      try {
        buffer = await fetchFileBuffer(baseId);
      } catch (err) {
        const canFallback = err && err.status === 404 && excel.latestId && excel.templateId && baseId === excel.latestId;
        if (!canFallback) throw err;
        buffer = await fetchFileBuffer(excel.templateId);
        report.excel = Object.assign({}, report.excel, {
          latestId: "",
          latestName: "",
          latestAt: "",
          latestSize: 0,
          latestVersion: 0,
        });
        const bridgeRef = bridge();
        if (bridgeRef) bridgeRef.save(report).catch(() => {});
        baseId = excel.templateId;
      }
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const target =
        workbook.getWorksheet(excel.gridSheet) ||
        workbook.worksheets.find((sheet) => (sheet.rowCount || 0) > 0) ||
        workbook.worksheets[0];
      if (!target) throw new Error("Tệp Excel không có trang tính nào.");
      const cache = {
        reportId: report.id,
        baseId,
        workbook,
        sheet: target.name,
        sheetRef: target,
        page: 0,
        rowPage: 0,
        dirty: false,
        sel: null,
        active: null,
        dragging: false,
        maxed: false,
        calc: new Map(),
      };
      prepareGridSheet(cache, target);
      state.grid = cache;
      state.gridFailed = null;
      return cache;
    })();
    state.gridLoading = { id: report.id, promise };
    try {
      return await promise;
    } finally {
      if (state.gridLoading && state.gridLoading.promise === promise) state.gridLoading = null;
    }
  }

  function startGridLoad(report) {
    if (state.gridLoading && state.gridLoading.id === report.id) return;
    loadGrid(report)
      .then(() => {
        if (bridge()) bridge().refreshDetail();
      })
      .catch((err) => {
        state.gridFailed = {
          id: report.id,
          message: err && err.message ? err.message : "Chưa mở được bảng Excel.",
        };
        const bridgeRef = bridge();
        if (bridgeRef) bridgeRef.refreshDetail();
        A.toast(state.gridFailed.message, "error");
      });
  }

  function gridColumnWindow(cache) {
    if (cache.dayGroups.length) {
      const per = 5;
      const pages = Math.max(Math.ceil(cache.dayGroups.length / per), 1);
      const page = Math.min(Math.max(cache.page, 0), pages - 1);
      const from = cache.dayGroups[page * per].col;
      const next = cache.dayGroups[(page + 1) * per];
      const to = next ? next.col - 1 : cache.dayGroups[cache.dayGroups.length - 1].end;
      return { page, pages, from, to: Math.min(to, cache.maxCol) };
    }
    const first = cache.fixedCols + 1;
    const pages = Math.max(Math.ceil(Math.max(cache.maxCol - cache.fixedCols, 1) / COLS_PER_PAGE), 1);
    const page = Math.min(Math.max(cache.page, 0), pages - 1);
    const from = first + page * COLS_PER_PAGE;
    return { page, pages, from, to: Math.min(cache.maxCol, from + COLS_PER_PAGE - 1) };
  }

  function gridRowWindow(cache) {
    const pages = Math.max(Math.ceil(cache.maxRow / ROWS_PER_PAGE), 1);
    const page = Math.min(Math.max(cache.rowPage, 0), pages - 1);
    const from = page * ROWS_PER_PAGE + 1;
    return { page, pages, from, to: Math.min(cache.maxRow, from + ROWS_PER_PAGE - 1) };
  }

  function gridColumns(cache, win) {
    const list = [];
    for (let col = 1; col <= cache.fixedCols; col += 1) list.push(col);
    for (let col = win.from; col <= win.to; col += 1) {
      if (!list.includes(col)) list.push(col);
    }
    return list;
  }

  function gridCellHtml(cache, row, col, colspan, rowspan) {
    const cell = cache.sheetRef.getCell(row, col);
    const spanAttr = `${rowspan > 1 ? ` rowspan="${rowspan}"` : ""}${colspan > 1 ? ` colspan="${colspan}"` : ""}`;
    const selected = cache.sel && row >= cache.sel.r1 && row <= cache.sel.r2 && col >= cache.sel.c1 && col <= cache.sel.c2;
    const active = cache.active && cache.active.row === row && cache.active.col === col;
    const selCls = `${selected ? " is-sel" : ""}${active ? " is-active" : ""}`;
    const value = cell.value;
    if (value && typeof value === "object" && (value.formula || value.sharedFormula)) {
      const result = value.result;
      let shown = `=${value.formula || ""}`;
      if (result instanceof Date) shown = fmtDate(result.toISOString().slice(0, 10), "/");
      else if (result !== undefined && result !== null) shown = String(result);
      const title = `Công thức =${value.formula || value.sharedFormula || ""}`;
      return `<td${spanAttr} class="xl-grid-ro${selCls}" data-xl-cell="${row}:${col}" data-xl-fcell="${row}:${col}" title="${esc(title)}">${esc(shown)}</td>`;
    }
    if (value instanceof Date) {
      const iso = value.toISOString().slice(0, 10);
      return `<td${spanAttr} class="xl-grid-ro xl-grid-date${selCls}" data-xl-cell="${row}:${col}" title="Tự đổi theo ngày báo cáo">${esc(fmtDate(iso, "/"))}</td>`;
    }
    let text = "";
    let kind = "s";
    if (typeof value === "number") {
      text = String(value);
      kind = "n";
    } else if (typeof value === "boolean") {
      text = value ? "TRUE" : "FALSE";
    } else if (value && typeof value === "object" && Array.isArray(value.richText)) {
      text = readCellText(value);
      kind = "r";
    } else if (typeof value === "string") {
      text = value;
    } else if (value && typeof value === "object" && typeof value.text === "string") {
      text = value.text;
    }
    return `<td${spanAttr} class="xl-grid-edit${selCls}" data-xl-cell="${row}:${col}"><input class="xl-grid-input${kind === "n" ? " is-num" : ""}" data-xl-grid-cell="${row}:${col}" data-xl-kind="${kind}" value="${esc(text)}" inputmode="${kind === "n" ? "decimal" : "text"}" autocomplete="off" spellcheck="false"></td>`;
  }

  function gridTableHtml(cache) {
    const rows = gridRowWindow(cache);
    const cols = gridColumnWindow(cache);
    const list = gridColumns(cache, cols);
    const head = `<colgroup><col class="xl-grid-numcol">${list
      .map((col) => {
        const width = cache.sheetRef.getColumn(col).width;
        const px = Math.max(44, Math.min(Math.round((Number(width) || 12) * 7), 240));
        return `<col style="width:${px}px">`;
      })
      .join("")}</colgroup>`;
    let body = "";
    for (let row = rows.from; row <= rows.to; row += 1) {
      let cells = "";
      for (let index = 0; index < list.length; index += 1) {
        const col = list[index];
        const cell = cache.sheetRef.getCell(row, col);
        const master = cell.master || cell;
        if (master.address !== cell.address) continue;
        const span = cache.spans.get(`${row}:${col}`);
        let colspan = 1;
        let rowspan = 1;
        if (span) {
          rowspan = Math.max(1, Math.min(span.rows, rows.to - row + 1));
          while (
            index + colspan < list.length &&
            list[index + colspan] === col + colspan &&
            colspan < span.cols
          ) {
            colspan += 1;
          }
        }
        cells += gridCellHtml(cache, row, col, colspan, rowspan);
      }
      body += `<tr><th class="xl-grid-rowno">${row}</th>${cells}</tr>`;
    }
    return `<div class="xl-grid-wrap${cache.maxed ? " is-max" : ""}"><table class="xl-grid-table">${head}<tbody>${body}</tbody></table></div>`;
  }

  /* ---------- chọn ô, sao chép/dán, tự tính công thức ---------- */

  function parseNum(value) {
    let raw = String(value == null ? "" : value).trim();
    if (!raw) return null;
    let sign = 1;
    if (raw[0] === "-" || raw[0] === "−") {
      sign = -1;
      raw = raw.slice(1);
    } else if (raw[0] === "+") {
      raw = raw.slice(1);
    }
    raw = raw.replace(/\s+/g, "");
    if (!/^\d[\d.,]*$/.test(raw)) return null;
    const lastDot = raw.lastIndexOf(".");
    const lastComma = raw.lastIndexOf(",");
    let decimal = -1;
    if (lastDot >= 0 && lastComma >= 0) {
      decimal = Math.max(lastDot, lastComma);
    } else if (lastComma >= 0) {
      if (!/^\d{1,3}(,\d{3}){2,}$/.test(raw)) decimal = lastComma;
    } else if (lastDot >= 0) {
      if (!/^\d{1,3}(\.\d{3})+$/.test(raw)) decimal = lastDot;
    }
    let digits = "";
    for (let index = 0; index < raw.length; index += 1) {
      const ch = raw[index];
      if (ch >= "0" && ch <= "9") digits += ch;
      else if (index === decimal) digits += ".";
    }
    if (!digits || !/\d/.test(digits)) return null;
    const num = Number(digits) * sign;
    return Number.isFinite(num) ? num : null;
  }

  function looksNumericText(value) {
    const raw = String(value == null ? "" : value).trim();
    if (!raw) return false;
    if (!/^[-+−]?[\d.,\s]+$/.test(raw)) return false;
    if (/^[-+−]?0\d/.test(raw)) return false;
    return parseNum(raw) !== null;
  }

  function readCellRawText(value) {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return fmtDate(value.toISOString().slice(0, 10), "/");
    if (typeof value === "number") return String(value);
    if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
    if (typeof value === "string") return value;
    if (typeof value === "object" && Array.isArray(value.richText)) return readCellText(value);
    if (typeof value === "object" && typeof value.text === "string") return value.text;
    if (typeof value === "object" && (value.formula || value.sharedFormula)) {
      return value.result === undefined || value.result === null ? "" : String(value.result);
    }
    return "";
  }

  function coerceCellText(text, cell) {
    const raw = String(text == null ? "" : text);
    if (raw === "") return null;
    if (cell.value && typeof cell.value === "object" && Array.isArray(cell.value.richText)) {
      const font = (cell.value.richText[0] || {}).font;
      return { richText: [{ font: font ? Object.assign({}, font) : undefined, text: raw }] };
    }
    const num = looksNumericText(raw) ? parseNum(raw) : null;
    return num === null ? raw : num;
  }

  function cellAddressLabel(row, col) {
    return `${columnName(col)}${row}`;
  }

  function gridRange(cache) {
    return cache.sel
      ? {
          r1: Math.min(cache.sel.r1, cache.sel.r2),
          r2: Math.max(cache.sel.r1, cache.sel.r2),
          c1: Math.min(cache.sel.c1, cache.sel.c2),
          c2: Math.max(cache.sel.c1, cache.sel.c2),
        }
      : null;
  }

  function cellPosOf(node) {
    const hit = node && node.closest ? node.closest("[data-xl-cell]") : null;
    if (!hit) return null;
    const parts = String(hit.getAttribute("data-xl-cell") || "").split(":");
    const row = Number(parts[0]);
    const col = Number(parts[1]);
    return row && col ? { row, col } : null;
  }

  function selectGridCell(cache, pos, extend) {
    if (!pos) return;
    if (extend && cache.active) {
      cache.sel = {
        r1: Math.min(cache.active.row, pos.row),
        r2: Math.max(cache.active.row, pos.row),
        c1: Math.min(cache.active.col, pos.col),
        c2: Math.max(cache.active.col, pos.col),
      };
    } else {
      cache.active = { row: pos.row, col: pos.col };
      cache.sel = { r1: pos.row, r2: pos.row, c1: pos.col, c2: pos.col };
    }
  }

  function gridSelLabel(cache) {
    const range = gridRange(cache);
    if (!range) return "Chọn ô để xem vùng";
    const cells = (range.r2 - range.r1 + 1) * (range.c2 - range.c1 + 1);
    return cells > 1
      ? `${cellAddressLabel(range.r1, range.c1)}:${cellAddressLabel(range.r2, range.c2)} · ${cells} ô`
      : cellAddressLabel(range.r1, range.c1);
  }

  function paintGridSel(cache) {
    const range = gridRange(cache);
    document.querySelectorAll(".xl-grid-wrap td[data-xl-cell]").forEach((td) => {
      const pos = cellPosOf(td);
      if (!pos) return;
      td.classList.toggle(
        "is-sel",
        !!range && pos.row >= range.r1 && pos.row <= range.r2 && pos.col >= range.c1 && pos.col <= range.c2
      );
      td.classList.toggle("is-active", !!cache.active && cache.active.row === pos.row && cache.active.col === pos.col);
    });
    const info = document.querySelector("[data-xl-sel-info]");
    if (info) info.textContent = gridSelLabel(cache);
  }

  function gridCellText(cache, row, col) {
    const td = document.querySelector(`.xl-grid-wrap td[data-xl-cell="${row}:${col}"]`);
    if (td) {
      const input = td.querySelector(".xl-grid-input");
      return input ? input.value : td.textContent || "";
    }
    return readCellRawText(cache.sheetRef.getCell(row, col).value);
  }

  function selectionTsv(cache) {
    const range = gridRange(cache);
    if (!range) return "";
    const lines = [];
    for (let row = range.r1; row <= range.r2; row += 1) {
      const line = [];
      for (let col = range.c1; col <= range.c2; col += 1) line.push(gridCellText(cache, row, col));
      lines.push(line.join("\t"));
    }
    return lines.join("\n");
  }

  function flattenFormulaValues(value, out) {
    if (value && value.__range) {
      value.__range.forEach((line) => line.forEach((item) => flattenFormulaValues(item, out)));
      return out;
    }
    out.push(value);
    return out;
  }

  function formulaNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "boolean") return value ? 1 : 0;
    if (typeof value === "string") return parseNum(value);
    return null;
  }

  function formulaTruthy(value) {
    if (value && value.__range) return false;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const text = value.trim().toUpperCase();
      if (text === "TRUE") return true;
      if (text === "FALSE" || text === "") return false;
      const num = parseNum(text);
      return num === null ? true : num !== 0;
    }
    return false;
  }

  function formulaCompare(op, left, right) {
    if (op === "&") return readCellRawText(left) + readCellRawText(right);
    const a = formulaNumber(left);
    const b = formulaNumber(right);
    const x = a === null ? String(left == null ? "" : left) : a;
    const y = b === null ? String(right == null ? "" : right) : b;
    switch (op) {
      case "=":
        return x === y;
      case "<>":
        return x !== y;
      case "<":
        return x < y;
      case ">":
        return x > y;
      case "<=":
        return x <= y;
      case ">=":
        return x >= y;
      default:
        throw new Error("formula compare");
    }
  }

  function formulaFunction(name, args) {
    if (name === "IF") {
      if (args.length < 2) throw new Error("formula IF");
      return formulaTruthy(args[0]) ? args[1] : args.length > 2 ? args[2] : false;
    }
    if (name === "ROUND") {
      const num = formulaNumber(args[0]);
      const digits = Math.trunc(formulaNumber(args[1]) || 0);
      if (num === null) return 0;
      const factor = 10 ** digits;
      return Math.round(num * factor) / factor;
    }
    if (name === "ABS") {
      const num = formulaNumber(args[0]);
      return num === null ? 0 : Math.abs(num);
    }
    if (name === "NOT") return !formulaTruthy(args[0]);
    const flat = [];
    args.forEach((arg) => flattenFormulaValues(arg, flat));
    const nums = [];
    flat.forEach((item) => {
      const num = formulaNumber(item);
      if (num !== null) nums.push(num);
    });
    switch (name) {
      case "SUM":
        return nums.reduce((sum, num) => sum + num, 0);
      case "AVERAGE":
        return nums.length ? nums.reduce((sum, num) => sum + num, 0) / nums.length : 0;
      case "MIN":
        return nums.length ? nums.reduce((min, num) => Math.min(min, num), Infinity) : 0;
      case "MAX":
        return nums.length ? nums.reduce((max, num) => Math.max(max, num), -Infinity) : 0;
      case "COUNT":
        return nums.length;
      case "COUNTA":
        return flat.filter((item) => readCellRawText(item) !== "").length;
      case "AND":
        return flat.every((item) => formulaTruthy(item));
      case "OR":
        return flat.some((item) => formulaTruthy(item));
      default:
        throw new Error(`formula function ${name}`);
    }
  }

  function formulaCellValue(cache, row, col, depth) {
    const key = `${row}:${col}`;
    if (cache.calc.has(key)) return cache.calc.get(key);
    if (depth > 24) throw new Error("formula cycle");
    const value = cache.sheetRef.getCell(row, col).value;
    let out = null;
    if (value instanceof Date) out = (value.getTime() - Date.UTC(1899, 11, 30)) / 86400000;
    else if (value && typeof value === "object" && value.formula) out = evalFormulaText(value.formula, cache, depth + 1);
    else if (value && typeof value === "object" && value.sharedFormula) {
      out = value.result === undefined ? null : value.result;
    } else if (typeof value === "number" || typeof value === "boolean") out = value;
    else out = readCellRawText(value);
    cache.calc.set(key, out);
    return out;
  }

  function evalFormulaText(text, cache, depth) {
    const tokens = [];
    const src = String(text || "");
    let index = 0;
    while (index < src.length) {
      const ch = src[index];
      if (/\s/.test(ch)) {
        index += 1;
        continue;
      }
      if (ch === '"') {
        let out = "";
        let cursor = index + 1;
        while (cursor < src.length) {
          if (src[cursor] === '"') {
            if (src[cursor + 1] === '"') {
              out += '"';
              cursor += 2;
              continue;
            }
            break;
          }
          out += src[cursor];
          cursor += 1;
        }
        if (cursor >= src.length) throw new Error("formula string");
        tokens.push({ t: "str", v: out });
        index = cursor + 1;
        continue;
      }
      const num = /^(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(index));
      if (num) {
        tokens.push({ t: "num", v: Number(num[0]) });
        index += num[0].length;
        continue;
      }
      const ref = /^\$?[A-Za-z]{1,3}\$?\d+/.exec(src.slice(index));
      if (ref) {
        tokens.push({ t: "ref", v: ref[0].replace(/\$/g, "").toUpperCase() });
        index += ref[0].length;
        continue;
      }
      const name = /^[A-Za-z_][A-Za-z0-9._]*/.exec(src.slice(index));
      if (name) {
        tokens.push({ t: "name", v: name[0].toUpperCase() });
        index += name[0].length;
        continue;
      }
      if ("+-*/^%(),;:&<>=".includes(ch)) {
        tokens.push({ t: "op", v: ch });
        index += 1;
        continue;
      }
      throw new Error("formula token");
    }

    let pos = 0;
    const peek = () => tokens[pos];
    const isOp = (token, values) => !!token && token.t === "op" && values.includes(token.v);
    function eat(value) {
      const token = tokens[pos];
      if (!token || !(token.t === "op" && token.v === value)) throw new Error(`formula expect ${value}`);
      pos += 1;
      return token;
    }
    function eatOp(values) {
      const token = peek();
      if (!isOp(token, values)) return null;
      pos += 1;
      return token.v;
    }
    function numeric(value) {
      if (value && value.__range) throw new Error("formula range math");
      const num = formulaNumber(value);
      return num === null ? 0 : num;
    }
    function rangeValue(from, to) {
      const a = parseAddress(from);
      const b = parseAddress(to);
      if (!a || !b) throw new Error("formula range");
      const rows = Math.min(a.row, b.row);
      const rowsEnd = Math.max(a.row, b.row);
      const cols = Math.min(a.col, b.col);
      const colsEnd = Math.max(a.col, b.col);
      if ((rowsEnd - rows + 1) * (colsEnd - cols + 1) > 20000) throw new Error("formula range big");
      const out = [];
      for (let row = rows; row <= rowsEnd; row += 1) {
        const line = [];
        for (let col = cols; col <= colsEnd; col += 1) line.push(formulaCellValue(cache, row, col, depth));
        out.push(line);
      }
      return { __range: out };
    }
    function primary() {
      const token = peek();
      if (!token) throw new Error("formula primary");
      if (token.t === "num" || token.t === "str") {
        pos += 1;
        return token.v;
      }
      if (token.t === "ref") {
        pos += 1;
        if (isOp(peek(), [":"])) {
          pos += 1;
          const end = peek();
          if (!end || end.t !== "ref") throw new Error("formula range end");
          pos += 1;
          return rangeValue(token.v, end.v);
        }
        const addr = parseAddress(token.v);
        if (!addr) throw new Error("formula ref");
        return formulaCellValue(cache, addr.row, addr.col, depth);
      }
      if (isOp(token, ["("])) {
        pos += 1;
        const out = compare();
        eat(")");
        return out;
      }
      if (token.t === "name") {
        pos += 1;
        if (!isOp(peek(), ["("])) {
          if (token.v === "TRUE") return true;
          if (token.v === "FALSE") return false;
          throw new Error("formula name");
        }
        pos += 1;
        const args = [];
        if (!isOp(peek(), [")"])) {
          for (;;) {
            args.push(compare());
            if (!eatOp([",", ";"])) break;
          }
        }
        eat(")");
        return formulaFunction(token.v, args);
      }
      throw new Error("formula primary");
    }
    function unary() {
      const op = eatOp(["+", "-"]);
      if (op) {
        const value = numeric(unary());
        return op === "-" ? -value : value;
      }
      let out = primary();
      if (eatOp(["%"])) out = numeric(out) / 100;
      return out;
    }
    function power() {
      const base = unary();
      if (eatOp(["^"])) return numeric(base) ** numeric(unary());
      return base;
    }
    function term() {
      let left = power();
      for (;;) {
        const op = eatOp(["*", "/"]);
        if (!op) return left;
        const right = numeric(power());
        if (op === "*") left = numeric(left) * right;
        else left = right === 0 ? NaN : numeric(left) / right;
      }
    }
    function additive() {
      let left = term();
      for (;;) {
        const op = eatOp(["+", "-"]);
        if (!op) return left;
        const right = numeric(term());
        left = op === "+" ? numeric(left) + right : numeric(left) - right;
      }
    }
    function compare() {
      let left = additive();
      for (;;) {
        const op = eatOp(["=", "<>", "<=", ">=", "<", ">", "&"]);
        if (!op) return left;
        left = formulaCompare(op, left, additive());
      }
    }
    if (!tokens.length) throw new Error("formula empty");
    const result = compare();
    if (pos < tokens.length) throw new Error("formula trailing");
    return result;
  }

  function formatCalcValue(value) {
    if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(Math.round(value * 1e6) / 1e6);
    if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
    return value === null || value === undefined ? "" : String(value);
  }

  function recalcGrid(cache) {
    if (!cache || !cache.sheetRef) return;
    cache.calc = new Map();
    document.querySelectorAll(".xl-grid-wrap td[data-xl-fcell]").forEach((td) => {
      const parts = String(td.getAttribute("data-xl-fcell") || "").split(":");
      const row = Number(parts[0]);
      const col = Number(parts[1]);
      if (!row || !col) return;
      const cell = cache.sheetRef.getCell(row, col);
      const value = cell.value;
      if (!value || typeof value !== "object" || !value.formula) return;
      let result;
      try {
        result = evalFormulaText(value.formula, cache, 0);
      } catch (err) {
        return;
      }
      if (result && typeof result === "object") return;
      if (typeof result === "number" && !Number.isFinite(result)) return;
      cell.value = Object.assign({}, value, { result });
      td.textContent = formatCalcValue(result);
      td.classList.add("is-calc");
    });
  }

  function markGridDirty(cache) {
    cache.dirty = true;
    document.querySelectorAll(".xl-grid-wrap").forEach((el) => el.classList.add("is-dirty"));
    const save = document.querySelector(`[data-xl-save][data-id="${cache.reportId}"]`);
    if (save && !save.classList.contains("is-dirty")) {
      save.classList.add("is-dirty");
      save.innerHTML = `${A.icon("pencil")} Lưu thay đổi`;
    }
  }

  function syncInputValue(input, value) {
    if (!input) return;
    let text = "";
    let kind = "s";
    if (typeof value === "number") {
      text = String(value);
      kind = "n";
    } else if (typeof value === "boolean") {
      text = value ? "TRUE" : "FALSE";
    } else if (value && typeof value === "object" && Array.isArray(value.richText)) {
      text = readCellText(value);
      kind = "r";
    } else if (typeof value === "string") {
      text = value;
    } else if (value && typeof value === "object" && typeof value.text === "string") {
      text = value.text;
    }
    input.value = text;
    input.setAttribute("data-xl-kind", kind);
    input.classList.toggle("is-num", kind === "n");
  }

  function pasteGridText(cache, text) {
    const matrix = String(text)
      .replace(/\r\n?/g, "\n")
      .replace(/\n+$/, "")
      .split("\n")
      .map((line) => line.split("\t"));
    const range = gridRange(cache);
    const anchor = cache.active || (range ? { row: range.r1, col: range.c1 } : null);
    if (!anchor || !matrix.length) return 0;
    const single = matrix.length === 1 && matrix[0].length === 1;
    const targets = [];
    if (single && range && (range.r2 > range.r1 || range.c2 > range.c1)) {
      for (let row = range.r1; row <= range.r2; row += 1) {
        for (let col = range.c1; col <= range.c2; col += 1) targets.push({ row, col, text: matrix[0][0] });
      }
    } else {
      matrix.forEach((line, r) => {
        line.forEach((value, c) => targets.push({ row: anchor.row + r, col: anchor.col + c, text: value }));
      });
    }
    let count = 0;
    targets.forEach((item) => {
      if (item.row < 1 || item.col < 1 || item.row > 500 || item.col > 5000) return;
      const cell = cache.sheetRef.getCell(item.row, item.col);
      const master = cell.master || cell;
      if (master.address !== cell.address) return;
      const current = cell.value;
      if (current instanceof Date) return;
      if (current && typeof current === "object" && (current.formula || current.sharedFormula)) return;
      cell.value = coerceCellText(item.text, cell);
      if (item.row > cache.maxRow) cache.maxRow = item.row;
      if (item.col > cache.maxCol) cache.maxCol = item.col;
      count += 1;
    });
    if (!count) return 0;
    markGridDirty(cache);
    document.querySelectorAll(".xl-grid-wrap td[data-xl-cell]").forEach((td) => {
      const parts = String(td.getAttribute("data-xl-cell") || "").split(":");
      const row = Number(parts[0]);
      const col = Number(parts[1]);
      if (!row || !col) return;
      syncInputValue(td.querySelector(".xl-grid-input"), cache.sheetRef.getCell(row, col).value);
    });
    recalcGrid(cache);
    return count;
  }

  function ensureCellVisible(cache, row, col) {
    let changed = false;
    if (col > cache.fixedCols) {
      if (cache.dayGroups.length) {
        let index = cache.dayGroups.findIndex((group) => col >= group.col && col <= group.end);
        if (index < 0) index = col < cache.dayGroups[0].col ? 0 : cache.dayGroups.length - 1;
        const page = Math.floor(index / 5);
        if (page !== cache.page) {
          cache.page = page;
          changed = true;
        }
        cache.dayFocus = index;
      } else {
        const page = Math.floor((col - cache.fixedCols - 1) / COLS_PER_PAGE);
        if (page !== cache.page) {
          cache.page = Math.max(page, 0);
          changed = true;
        }
      }
    }
    const rowPage = Math.floor((row - 1) / ROWS_PER_PAGE);
    if (rowPage !== cache.rowPage) {
      cache.rowPage = rowPage;
      changed = true;
    }
    return changed;
  }

  function focusGridCell(cache, row, col) {
    if (ensureCellVisible(cache, row, col) && bridge()) bridge().refreshDetail();
    paintGridSel(cache);
    const input = document.querySelector(`.xl-grid-wrap .xl-grid-input[data-xl-grid-cell="${row}:${col}"]`);
    if (input) {
      input.focus();
      input.select();
      return true;
    }
    const td = document.querySelector(`.xl-grid-wrap td[data-xl-cell="${row}:${col}"]`);
    if (td) td.scrollIntoView({ block: "nearest", inline: "nearest" });
    return false;
  }

  /* ---------- AI phối hợp nhận diện cấu trúc tệp ---------- */

  function postJson(url, payload) {
    return fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async (res) => {
      const type = res.headers.get("content-type") || "";
      if (!type.includes("application/json")) throw new Error("API chưa sẵn sàng trên địa chỉ này.");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Máy chủ trả về ${res.status}`);
      return data;
    });
  }

  function columnName(col) {
    let name = "";
    let n = Math.max(1, Number(col) || 1);
    while (n > 0) {
      const rem = (n - 1) % 26;
      name = String.fromCharCode(65 + rem) + name;
      n = Math.floor((n - 1) / 26);
    }
    return name;
  }

  function sampleSheetText(sheet, maxRow, maxCol, dayGroups) {
    const out = [];
    const seen = new Set();
    const push = (row, col) => {
      if (row < 1 || col < 1) return;
      const key = `${row}:${col}`;
      if (seen.has(key)) return;
      seen.add(key);
      let text = pairText(sheet.getCell(row, col).value);
      if (!text) return;
      if (text.length > 80) text = `${text.slice(0, 80)}…`;
      out.push({ a: `${columnName(col)}${row}`, t: text });
    };
    const headRows = Math.min(maxRow, 14);
    const headCols = Math.min(maxCol, 12);
    for (let r = 1; r <= headRows; r += 1) {
      for (let c = 1; c <= headCols; c += 1) push(r, c);
    }
    const first = dayGroups && dayGroups[0];
    if (first && Number(first.col) > headCols) {
      const toCol = Math.min(maxCol, Number(first.col) + 8);
      for (let r = 1; r <= Math.min(maxRow, 10); r += 1) {
        for (let c = Number(first.col); c <= toCol; c += 1) push(r, c);
      }
    }
    return out.slice(0, 160);
  }

  function buildRecognizePayload(report) {
    const excel = report.excel || {};
    const payload = {
      report: {
        title: String(report.title || ""),
        date: String(report.date || ""),
        category: String(report.category || ""),
      },
      excel: {
        mode: String(excel.mode || ""),
        gridSheet: String(excel.gridSheet || ""),
        gridDate: String(excel.gridDate || ""),
        dateGuess: "",
        monthGuess: "",
        sheetNames: (Array.isArray(excel.templateSheets) ? excel.templateSheets : []).slice(0, 20),
        dayGroups: [],
        fields: (Array.isArray(excel.fields) ? excel.fields : [])
          .slice(0, 30)
          .map((f) => ({ key: f.key, label: f.label, count: f.count })),
        samples: [],
      },
    };
    const cache = state.grid && state.grid.reportId === report.id ? state.grid : null;
    if (cache && cache.sheetRef) {
      payload.excel.gridSheet = cache.sheet;
      payload.excel.dayGroups = cache.dayGroups.slice(0, 10).map((g) => ({ label: g.label, col: g.col }));
      payload.excel.samples = sampleSheetText(cache.sheetRef, cache.maxRow, cache.maxCol, cache.dayGroups);
    }
    return payload;
  }

  async function runAiScan(reportId) {
    const bridgeRef = bridge();
    const report = bridgeRef && bridgeRef.report(reportId);
    if (!report) return;
    if (state.aiScan && state.aiScan.id === reportId && state.aiScan.status === "busy") return;
    state.aiScan = { id: reportId, status: "busy", result: null, message: "" };
    if (bridgeRef) bridgeRef.refreshDetail();
    try {
      const data = await postJson("/api/ai/recognize-excel", buildRecognizePayload(report));
      state.aiScan = { id: reportId, status: "done", result: data, message: "" };
    } catch (err) {
      state.aiScan = { id: reportId, status: "error", result: null, message: (err && err.message) || "AI chưa phản hồi." };
    }
    if (bridge()) bridge().refreshDetail();
  }

  function aiScanHtml(report) {
    const scan = state.aiScan;
    if (!scan || scan.id !== report.id) return "";
    if (scan.status === "busy") {
      return `<div class="xl-ai is-busy">${A.icon("spark")}<span>AI đang đọc cấu trúc tệp…</span></div>`;
    }
    if (scan.status === "error") {
      return `<div class="xl-ai is-error">${A.icon("alert")}<span>${esc(scan.message || "AI chưa phản hồi.")}</span>
        <button class="btn btn-ghost btn-sm" type="button" data-xl-ai-dismiss data-id="${esc(report.id)}">Đóng</button></div>`;
    }
    const result = scan.result || {};
    const cache = state.grid && state.grid.reportId === report.id ? state.grid : null;
    const excel = report.excel || {};
    const actions = [];
    if (cache && result.gridSheet && result.gridSheet !== cache.sheet && cache.workbook.getWorksheet(result.gridSheet)) {
      actions.push(
        `<button class="btn btn-ghost btn-sm" type="button" data-xl-ai-use-sheet data-id="${esc(report.id)}" data-value="${esc(result.gridSheet)}">${A.icon("check")} Dùng sheet “${esc(result.gridSheet)}”</button>`
      );
    }
    if (excel.mode === "grid" && /^\d{4}-\d{2}-\d{2}$/.test(String(result.dateAnchor || "")) && result.dateAnchor !== excel.gridDate) {
      actions.push(
        `<button class="btn btn-ghost btn-sm" type="button" data-xl-ai-use-date data-id="${esc(report.id)}" data-value="${esc(result.dateAnchor)}">${A.icon("check")} Mốc ngày ${esc(result.dateAnchor)}</button>`
      );
    }
    const list = (items, cls) =>
      Array.isArray(items) && items.length
        ? `<ul class="xl-ai-list ${cls}">${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`
        : "";
    const confidence = Math.max(0, Math.min(100, Number(result.confidence) || 0));
    const confClass = confidence >= 70 ? "is-good" : confidence >= 40 ? "is-mid" : "is-low";
    return `<div class="xl-ai">
      <div class="xl-ai-head">
        ${A.icon("spark")}<strong>AI nhận diện</strong>
        <span class="xl-ai-conf ${confClass}">${confidence}%</span>
        <button class="icon-btn bare" type="button" data-xl-ai-dismiss data-id="${esc(report.id)}" aria-label="Đóng">${A.icon("x")}</button>
      </div>
      ${result.summary ? `<p class="xl-ai-summary">${esc(result.summary)}</p>` : ""}
      ${list(result.inputAreas, "is-input")}
      ${list(result.warnings, "is-warn")}
      ${list(result.suggestions, "is-tip")}
      ${actions.length ? `<div class="xl-ai-acts">${actions.join("")}</div>` : ""}
    </div>`;
  }

  function gridTab(report) {
    const excel = report.excel || {};
    const cache = state.grid && state.grid.reportId === report.id ? state.grid : null;
    if (!cache) {
      if (state.gridFailed && state.gridFailed.id === report.id) {
        return `<div class="rp-dr-section">
          ${errorHtml()}
          <div class="xl-hero">
            <span class="xl-hero-ico">${A.icon("alert")}</span>
            <div class="xl-hero-main">
              <h4>Chưa mở được bảng Excel</h4>
              <p>${esc(state.gridFailed.message)}</p>
            </div>
            <button class="btn btn-accent" type="button" data-xl-grid-retry data-id="${esc(report.id)}">${A.icon("refresh")} Thử lại</button>
          </div>
          <div class="xl-suggest-alt">
            <button class="btn btn-ghost btn-sm" type="button" data-xl-pick-template data-id="${esc(report.id)}">${A.icon("upload")} Đổi tệp mẫu</button>
            <input type="file" data-xl-template-input data-id="${esc(report.id)}" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>
          </div>
        </div>`;
      }
      startGridLoad(report);
      return `<div class="rp-dr-section">${busyHtml("Đang mở bảng Excel…")}</div>`;
    }
    const colWin = gridColumnWindow(cache);
    const rowWin = gridRowWindow(cache);
    setTimeout(() => {
      const current = state.grid;
      if (current && current.reportId === report.id) recalcGrid(current);
    }, 0);
    const stats = excel.gridStats || {};
    const sheetNames = Array.isArray(excel.templateSheets) && excel.templateSheets.length
      ? excel.templateSheets
      : [cache.sheet];
    const dayBase = colWin.page * 5;
    const dayIndex = cache.dayGroups.length
      ? Math.min(cache.dayGroups.length - 1, cache.dayFocus >= dayBase && cache.dayFocus < dayBase + 5 ? cache.dayFocus : dayBase)
      : 0;
    const sheetPicker = sheetNames.length > 1
      ? `<label class="xl-grid-pick"><span>Trang tính</span><select data-xl-grid-sheet data-id="${esc(report.id)}">${sheetNames
          .map((name) => `<option value="${esc(name)}"${name === cache.sheet ? " selected" : ""}>${esc(name)}</option>`)
          .join("")}</select></label>`
      : "";
    const dayPicker = cache.dayGroups.length
      ? `<label class="xl-grid-pick"><span>Nhảy tới ngày</span><select data-xl-grid-day data-id="${esc(report.id)}">${cache.dayGroups
          .map(
            (group, index) =>
              `<option value="${index}"${index === dayIndex ? " selected" : ""}>${esc(`${group.label} · cột ${group.col}`)}</option>`
          )
          .join("")}</select></label>`
      : `<label class="xl-grid-pick"><span>Tới trang cột</span><input class="input" type="number" min="1" max="${colWin.pages}" value="${colWin.page + 1}" data-xl-grid-page-input data-id="${esc(report.id)}"></label>`;
    const rowBar = rowWin.pages > 1
      ? `<div class="xl-grid-page">
          <button type="button" class="icon-btn bare" data-xl-grid-rowpage="-1" data-id="${esc(report.id)}" title="Trang trước"${rowWin.page === 0 ? " disabled" : ""}>${A.icon("chevron-left")}</button>
          <span>Hàng ${rowWin.from}–${rowWin.to} / ${cache.maxRow}</span>
          <button type="button" class="icon-btn bare" data-xl-grid-rowpage="1" data-id="${esc(report.id)}" title="Trang sau"${rowWin.page >= rowWin.pages - 1 ? " disabled" : ""}>${A.icon("chevron-right")}</button>
        </div>`
      : "";
    return `<div class="rp-dr-section">
      ${errorHtml()}
      ${aiScanHtml(report)}
      <div class="xl-head">
        <span class="xl-head-ico">${A.icon("grid")}</span>
        <div class="xl-head-main">
          <strong title="${esc(excel.templateName || "Bảng Excel")}">${esc(excel.templateName || "Bảng Excel")}</strong>
          <span>Bảng trực tiếp · ${Number(stats.rows) || cache.maxRow} hàng · ${Number(stats.cols) || cache.maxCol} cột${
            Number(stats.formulas) ? ` · ${Number(stats.formulas)} công thức` : ""
          }</span>
        </div>
        <div class="xl-head-acts">
          <a class="btn btn-ghost btn-sm" href="${fileUrl(excel.templateId, true)}" title="Tải tệp gốc">${A.icon("download")} Gốc</a>
          <button class="btn btn-ghost btn-sm" type="button" data-xl-pick-template data-id="${esc(report.id)}">${A.icon("refresh")} Đổi mẫu</button>
          <button class="btn btn-ghost btn-sm" type="button" data-xl-ai-scan data-id="${esc(report.id)}">${A.icon("spark")} AI nhận diện</button>
          <button class="btn ${cache.maxed ? "btn-accent" : "btn-ghost"} btn-sm" type="button" data-xl-grid-max data-id="${esc(report.id)}" title="${cache.maxed ? "Thu nhỏ bảng" : "Mở rộng bảng toàn màn hình"}">${A.icon(cache.maxed ? "collapse" : "expand")} ${cache.maxed ? "Thu nhỏ" : "Toàn màn hình"}</button>
        </div>
        <input type="file" data-xl-template-input data-id="${esc(report.id)}" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>
      </div>
      <div class="xl-grid-note">${A.icon("calendar")} Ngày báo cáo <b>${esc(fmtDate(report.date, "/") || "—")}</b>. GUỒNG tự thay ngày, tháng trong tệp khi lưu bản mới.</div>
      <div class="xl-grid-bar">
        ${sheetPicker}
        <span class="xl-grid-sel" data-xl-sel-info>${esc(gridSelLabel(cache))}</span>
        ${dayPicker}
        <div class="xl-grid-page">
          <button type="button" class="icon-btn bare" data-xl-grid-colpage="-1" data-id="${esc(report.id)}" title="Lùi"${colWin.page === 0 ? " disabled" : ""}>${A.icon("chevron-left")}</button>
          <span>${cache.dayGroups.length ? `Ngày ${esc(cache.dayGroups[dayIndex].label.replace(/^ngày\s+/iu, ""))}` : `Cột ${colWin.from}–${colWin.to}`} / ${cache.maxCol} cột</span>
          <button type="button" class="icon-btn bare" data-xl-grid-colpage="1" data-id="${esc(report.id)}" title="Tiến"${colWin.page >= colWin.pages - 1 ? " disabled" : ""}>${A.icon("chevron-right")}</button>
        </div>
        ${rowBar}
      </div>
      ${gridTableHtml(cache)}
      <div class="xl-grid-hint">${A.icon("alert")} Ô trắng là nhập được, ô xám là công thức hoặc ngày tự động. Kéo chuột hoặc Shift+bấm để chọn nhiều ô, Cmd/Ctrl+C và Cmd/Ctrl+V dán thẳng từ Excel. Cột tổng tự tính lại khi sửa số. Định dạng, gộp ô và công thức giữ nguyên như tệp gốc.</div>
      ${filenameHtml(report, draftOf(report))}
      <div class="xl-save">
        <p>${A.icon("alert")} Mỗi lần lưu tạo một bản mới trong kho. Bản sau mở lại từ bản mới nhất để giữ số liệu vừa nhập.</p>
        <div class="xl-save-acts">
          <button class="btn btn-ghost btn-sm" type="button" data-xl-grid-reload data-id="${esc(report.id)}">${A.icon("refresh")} Bỏ thay đổi</button>
          <button class="btn btn-accent" type="button" data-xl-save data-id="${esc(report.id)}">${A.icon("download")} Lưu &amp; tải xuống</button>
        </div>
      </div>
    </div>`;
  }

  function applyGridInput(cache, target) {
    const parts = String(target.getAttribute("data-xl-grid-cell") || "").split(":");
    const row = Number(parts[0]);
    const col = Number(parts[1]);
    if (!row || !col) return;
    const cell = cache.sheetRef.getCell(row, col);
    cell.value = coerceCellText(target.value, cell);
    const numeric = typeof cell.value === "number";
    target.classList.toggle("is-num", numeric);
    if (numeric) target.setAttribute("data-xl-kind", "n");
    else if (target.getAttribute("data-xl-kind") === "n") target.setAttribute("data-xl-kind", "s");
    markGridDirty(cache);
    recalcGrid(cache);
  }

  function dateParts(iso) {
    const date = parseISO(iso);
    if (!date) return null;
    const day = date.getUTCDate();
    const month = date.getUTCMonth() + 1;
    return {
      day,
      month,
      year: date.getUTCFullYear(),
      dd: String(day).padStart(2, "0"),
      mm: String(month).padStart(2, "0"),
    };
  }

  function replaceDateText(text, oldIso, newIso) {
    if (!text) return text;
    const a = dateParts(oldIso);
    const b = dateParts(newIso);
    if (!a || !b) return text;
    let out = text;
    const pairs = [
      [`${a.dd}/${a.mm}/${a.year}`, `${b.dd}/${b.mm}/${b.year}`],
      [`${a.day}/${a.month}/${a.year}`, `${b.day}/${b.month}/${b.year}`],
      [`${a.dd}-${a.mm}-${a.year}`, `${b.dd}-${b.mm}-${b.year}`],
      [`${a.dd}.${a.mm}.${a.year}`, `${b.dd}.${b.mm}.${b.year}`],
      [`${a.year}-${a.mm}-${a.dd}`, `${b.year}-${b.mm}-${b.dd}`],
    ];
    pairs.forEach(([from, to]) => {
      if (from !== to) out = out.split(from).join(to);
    });
    if (a.month !== b.month || a.year !== b.year) {
      out = out.replace(/\b(THÁNG|Tháng|tháng)\s+(\d{1,2})\s*[/\-]\s*(\d{4})\b/gu, (match, word, month, year) => {
        if (Number(month) !== a.month || Number(year) !== a.year) return match;
        return `${word} ${b.mm}/${b.year}`;
      });
    }
    return out;
  }

  function replaceWorkbookDates(workbook, oldIso, newIso) {
    if (!oldIso || !newIso || oldIso === newIso) return 0;
    const a = dateParts(oldIso);
    const b = dateParts(newIso);
    if (!a || !b) return 0;
    let changed = 0;
    workbook.eachSheet((sheet) => {
      sheet.eachRow({ includeEmpty: false }, (row) => {
        row.eachCell({ includeEmpty: false }, (cell) => {
          const value = cell.value;
          if (value instanceof Date) {
            if (
              value.getUTCFullYear() === a.year &&
              value.getUTCMonth() + 1 === a.month &&
              value.getUTCDate() === a.day
            ) {
              cell.value = new Date(Date.UTC(b.year, b.month - 1, b.day));
              changed += 1;
            }
            return;
          }
          if (typeof value === "string") {
            const next = replaceDateText(value, oldIso, newIso);
            if (next !== value) {
              cell.value = next;
              changed += 1;
            }
            return;
          }
          if (value && typeof value === "object" && Array.isArray(value.richText)) {
            let touched = false;
            const runs = value.richText.map((run) => {
              const text = String(run.text || "");
              const next = replaceDateText(text, oldIso, newIso);
              if (next === text) return run;
              touched = true;
              return Object.assign({}, run, { text: next });
            });
            if (touched) {
              cell.value = { richText: runs };
              changed += 1;
            }
          }
        });
      });
    });
    return changed;
  }

  async function saveGridVersion(report, options) {
    const opts = options || {};
    if (!apiReady()) return null;
    const bridgeRef = bridge();
    setBusy(report, "Đang mở bảng Excel…");
    try {
      const cache = await loadGrid(report);
      const oldDate = (report.excel && report.excel.gridDate) || report.date || "";
      setBusy(report, "Đang cập nhật ngày và số liệu…");
      replaceWorkbookDates(cache.workbook, oldDate, report.date || oldDate);
      cache.workbook.calcProperties.fullCalcOnLoad = true;
      const output = await cache.workbook.xlsx.writeBuffer();
      const name = filenameFor(report);
      setBusy(report, "Đang lưu bản Excel mới…");
      const meta = await postFile(report, new Blob([output], { type: XLSX_MIME }), name, "excel-latest");
      const old = report.excel || {};
      report.excel = Object.assign({}, old, {
        mode: "grid",
        gridDate: report.date || oldDate,
        gridSheet: cache.sheet,
        latestId: meta.id,
        latestName: meta.name,
        latestAt: meta.uploadedAt,
        latestSize: meta.size,
        latestVersion: meta.version,
        lastSavedAt: meta.uploadedAt,
        updatedAt: new Date().toISOString(),
      });
      if (bridgeRef) {
        bridgeRef.log(report, "excel", `Lưu ${meta.name}`);
        await bridgeRef.save(report);
      }
      resetGrid(report.id);
      state.busy = null;
      if (bridgeRef) bridgeRef.refreshDetail();
      if (opts.toast !== false) A.toast(`Đã lưu “${meta.name}”.`, "success");
      if (opts.download !== false) {
        const link = document.createElement("a");
        link.href = fileUrl(meta.id, true);
        link.download = meta.name;
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      pruneGenerated(report.id, meta.id);
      return { id: meta.id, name: meta.name };
    } catch (err) {
      setError(report, err);
      return null;
    }
  }

  function buildFresh(report, options) {
    const excel = report && report.excel;
    if (!excel || !excel.templateId) return null;
    if (excel.mode === "grid") return saveGridVersion(report, options || {});
    return saveVersion(report, options || {});
  }

  function pruneGenerated(reportId, keepId) {
    const bridgeRef = bridge();
    if (!bridgeRef) return;
    const old = bridgeRef
      .excelFiles(reportId)
      .filter((file) => file.role === "excel-latest" && file.id !== keepId)
      .sort((a, b) => String(b.uploadedAt || "").localeCompare(String(a.uploadedAt || "")))
      .slice(4);
    old.forEach((file) => deleteFile(file.id).catch(() => {}));
  }

  function errorHtml() {
    return state.error
      ? `<div class="xl-error">${A.icon("alert")}<span>${esc(state.error)}</span></div>`
      : "";
  }

  function busyHtml(text) {
    return `<div class="xl-busy"><span class="rp-spinner"></span><strong>${esc(text)}</strong><span>Đừng đóng bảng trong lúc GUỒNG xử lý.</span></div>`;
  }

  function suggestionHtml(report) {
    const suggestion = state.suggestion && state.suggestion.reportId === report.id ? state.suggestion : null;
    if (!suggestion) return "";
    const rows = suggestion.pairs
      .map((pair) => {
        const id = pairId(pair);
        const checked = suggestion.selected.has(id);
        const value = pair.value.length > 50 ? `${pair.value.slice(0, 50)}…` : pair.value;
        return `<label class="xl-suggest-item">
          <input type="checkbox" data-xl-suggest="${esc(id)}" data-id="${esc(report.id)}" ${checked ? "checked" : ""}>
          <span class="xl-suggest-main">
            <span class="xl-suggest-title"><b>${esc(pair.label)}</b>${pair.builtin ? `<i>tự động</i>` : ""}<code>${esc(pair.token)}</code></span>
            <small>${esc(pair.sheet)} · ${esc(pair.address)} · ${esc(value)}</small>
          </span>
        </label>`;
      })
      .join("");
    return `<div class="xl-suggest">
      <div class="xl-suggest-head">
        <span class="xl-head-ico">${A.icon("grid")}</span>
        <div>
          <h4>Tệp “${esc(suggestion.fileName)}” chưa có biến</h4>
          <p>GUỒNG thấy ${suggestion.pairs.length} cặp nhãn – số liệu. Chọn ô cần nhập lại mỗi kỳ; số liệu hiện tại sẽ được điền sẵn cho kỳ sau.</p>
        </div>
      </div>
      <div class="xl-suggest-list">${rows}</div>
      <div class="xl-suggest-acts">
        <button class="btn btn-ghost btn-sm" type="button" data-xl-dismiss-suggest data-id="${esc(report.id)}">Bỏ qua</button>
        <button class="btn btn-ghost btn-sm" type="button" data-xl-use-grid data-id="${esc(report.id)}">${A.icon("grid")} Sửa trực tiếp bảng</button>
        <button class="btn btn-accent btn-sm" type="button" data-xl-use-suggest data-id="${esc(report.id)}">${A.icon("check")} Dùng tệp này làm mẫu</button>
      </div>
    </div>`;
  }

  function emptyHtml(report) {
    if (state.suggestion && state.suggestion.reportId === report.id) {
      return `<div class="rp-dr-section">
        ${errorHtml()}
        ${suggestionHtml(report)}
        <div class="xl-suggest-alt">
          <button class="btn btn-ghost btn-sm" type="button" data-xl-pick-template data-id="${esc(report.id)}">${A.icon("upload")} Chọn tệp khác</button>
          <input type="file" data-xl-template-input data-id="${esc(report.id)}" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>
        </div>
      </div>`;
    }
    return `<div class="rp-dr-section">
      ${errorHtml()}
      <div class="xl-hero">
        <span class="xl-hero-ico">${A.icon("grid")}</span>
        <div class="xl-hero-main">
          <h4>Báo cáo Excel lặp lại</h4>
          <p>Tải báo cáo <b>.xlsx</b> một lần. GUỒNG dò biến <code>{{ten_bien}}</code>, nhận diện cặp nhãn – số liệu, hoặc mở luôn bảng để sửa trực tiếp như trong Excel.</p>
        </div>
        <button class="btn btn-accent" type="button" data-xl-pick-template data-id="${esc(report.id)}">${A.icon("upload")} Chọn mẫu .xlsx</button>
        <input type="file" data-xl-template-input data-id="${esc(report.id)}" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>
      </div>
      <div class="xl-guide">
        <div><b>1</b><span>Tải lên file Excel bạn vẫn dùng hằng ngày — có biến hay không đều được.</span></div>
        <div><b>2</b><span>GUỒNG giữ định dạng, gộp ô và công thức. Có biến thì hiện ô nhập; không có thì mở bảng sửa trực tiếp.</span></div>
        <div><b>3</b><span>Mỗi kỳ sửa số liệu, ngày/tháng tự cập nhật, rồi bấm <b>Lưu &amp; tải xuống</b>.</span></div>
      </div>
      <p class="xl-note">${A.icon("alert")} Giữ định dạng ô, gộp ô, công thức và số liệu. Biểu đồ hoặc đối tượng đặc biệt trong mẫu có thể không được giữ.</p>
    </div>`;
  }

  function templateHeadHtml(report) {
    const excel = report.excel || {};
    const fieldCount = Array.isArray(excel.fields) ? excel.fields.length : 0;
    const builtinCount = Array.isArray(excel.builtins) ? excel.builtins.length : 0;
    return `<div class="xl-head">
      <span class="xl-head-ico">${A.icon("grid")}</span>
      <div class="xl-head-main">
        <strong title="${esc(excel.templateName || "Mẫu Excel")}">${esc(excel.templateName || "Mẫu Excel")}</strong>
        <span>${fieldCount} biến nhập · ${builtinCount} biến tự động${excel.templateSize ? ` · ${esc(fileSize(excel.templateSize))}` : ""}</span>
      </div>
      <div class="xl-head-acts">
        <a class="btn btn-ghost btn-sm" href="${fileUrl(excel.templateId, true)}" title="Tải tệp mẫu">${A.icon("download")} Mẫu</a>
        <button class="btn btn-ghost btn-sm" type="button" data-xl-pick-template data-id="${esc(report.id)}">${A.icon("refresh")} Đổi mẫu</button>
        <button class="btn btn-ghost btn-sm" type="button" data-xl-ai-scan data-id="${esc(report.id)}">${A.icon("spark")} AI nhận diện</button>
      </div>
      <input type="file" data-xl-template-input data-id="${esc(report.id)}" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>
    </div>`;
  }

  function builtinsHtml(report) {
    const builtins = Array.isArray(report.excel && report.excel.builtins) ? report.excel.builtins : [];
    if (!builtins.length) return "";
    return `<div class="xl-builtins">
      <div class="xl-label">Tự động điền theo báo cáo</div>
      <div class="xl-chips">${builtins
        .map((key) => {
          const value = builtinValue(key, report, false);
          return `<span class="xl-chip"><b>{{${esc(builtinToken(key))}}}</b><span>${esc(value.length > 80 ? `${value.slice(0, 80)}…` : value || "—")}</span></span>`;
        })
        .join("")}</div>
    </div>`;
  }

  function fieldsHtml(report, draft) {
    const fields = Array.isArray(report.excel && report.excel.fields) ? report.excel.fields.filter((item) => item && item.key) : [];
    if (!fields.length) {
      return `<div class="xl-empty-fields">${A.icon("layers")}<span>Mẫu chỉ dùng biến tự động. Thêm <code>{{ten_bien}}</code> vào ô Excel nếu muốn nhập tay.</span></div>`;
    }
    return `<div class="xl-fields">
      <div class="xl-label">Số liệu bạn nhập <span>được giữ lại cho kỳ sau</span></div>
      <div class="xl-field-grid">
        ${fields
          .map((field) => {
            const key = String(field.key);
            const value = Object.prototype.hasOwnProperty.call(draft.values, key) ? draft.values[key] : "";
            const sheets = Array.isArray(field.sheets) && field.sheets.length ? field.sheets.join(", ") : "";
            return `<label class="xl-field">
              <span class="xl-field-label">${esc(field.label || labelFor(key))} <code>{{${esc(key)}}}</code>${Number(field.count) > 1 ? `<i>${Number(field.count)} ô</i>` : ""}</span>
              <input class="input" type="text" data-xl-field="${esc(key)}" data-id="${esc(report.id)}" value="${esc(value)}" placeholder="Nhập số liệu…" autocomplete="off">
              ${sheets ? `<small>${esc(sheets)}</small>` : ""}
            </label>`;
          })
          .join("")}
      </div>
    </div>`;
  }

  function filenameHtml(report, draft) {
    return `<div class="xl-name">
      <div class="xl-label">Tên tệp chuẩn bị xuất</div>
      <div class="xl-name-preview">${A.icon("file")}<strong data-xl-name>${esc(filenameFor(report))}</strong></div>
      <label class="xl-pattern"><span>Quy tắc đặt tên</span>
        <input class="input" type="text" data-xl-pattern data-id="${esc(report.id)}" value="${esc(draft.filenamePattern)}" placeholder="${esc(DEFAULT_PATTERN)}" autocomplete="off">
      </label>
      <p class="xl-hint">Dùng <code>{{title}}</code>, <code>{{date}}</code>, <code>{{du_an}}</code> hoặc tên biến bạn đã tạo. Đuôi .xlsx được tự thêm.</p>
    </div>`;
  }

  function latestHtml(report) {
    const excel = report.excel || {};
    const bridgeRef = bridge();
    const generated = bridgeRef
      ? bridgeRef
          .excelFiles(report.id)
          .filter((file) => file.role === "excel-latest")
          .sort((a, b) => String(b.uploadedAt || "").localeCompare(String(a.uploadedAt || "")))
          .slice(0, 3)
      : [];
    const latest = excel.latestId
      ? `<div class="xl-latest">
          <span class="xl-latest-ico">${A.icon("check-circle")}</span>
          <div class="xl-latest-main">
            <span>Bản mới nhất</span>
            <strong title="${esc(excel.latestName || "")}">${esc(excel.latestName || "Tệp Excel")}</strong>
            <small>${esc(A.timeAgo(excel.latestAt) || "đã lưu")}${excel.latestSize ? ` · ${esc(fileSize(excel.latestSize))}` : ""}</small>
          </div>
          <a class="btn btn-ghost btn-sm" href="${fileUrl(excel.latestId, true)}">${A.icon("download")} Tải</a>
        </div>`
      : `<div class="xl-latest xl-latest-off"><span class="xl-latest-ico">${A.icon("clock")}</span><div class="xl-latest-main"><span>Chưa có bản nào</span><strong>Bản đầu tiên sẽ được lưu khi bạn bấm nút bên dưới.</strong></div></div>`;
    const history = generated.length > 1
      ? `<div class="xl-history">
          <span class="xl-label">Bản đã lưu</span>
          ${generated
            .map(
              (file) => `<a href="${fileUrl(file.id, true)}" title="Tải ${esc(file.name || "tệp")}">${A.icon("download")}<span>${esc(file.name || "Tệp Excel")}</span><small>${esc(A.timeAgo(file.uploadedAt) || "")}</small></a>`
            )
            .join("")}
        </div>`
      : "";
    return latest + history;
  }

  function excelTab(report) {
    if (!report) return "";
    const busy = state.busy && state.busy.id === report.id ? state.busy : null;
    if (busy) return `<div class="rp-dr-section">${busyHtml(busy.text)}</div>`;
    const suggesting = state.suggestion && state.suggestion.reportId === report.id;
    if (!report.excel || !report.excel.templateId || suggesting) return emptyHtml(report);
    if (report.excel.mode === "grid") return gridTab(report);
    const draft = draftOf(report);
    return `<div class="rp-dr-section">
      ${errorHtml()}
      ${templateHeadHtml(report)}
      ${aiScanHtml(report)}
      ${builtinsHtml(report)}
      ${fieldsHtml(report, draft)}
      ${filenameHtml(report, draft)}
      ${latestHtml(report)}
      <div class="xl-save">
        <p>${A.icon("alert")} Mỗi lần lưu tạo một bản mới trong kho. Số liệu đã nhập tự điền sẵn cho kỳ sau.</p>
        <div class="xl-save-acts">
          <button class="btn btn-ghost btn-sm" type="button" data-xl-reset data-id="${esc(report.id)}">${A.icon("refresh")} Xoá số liệu</button>
          <button class="btn btn-accent" type="button" data-xl-save data-id="${esc(report.id)}">${A.icon("download")} Lưu &amp; tải xuống</button>
        </div>
      </div>
    </div>`;
  }

  function updateFilename(report, node) {
    if (!report || !node) return;
    const drawer = node.closest(".rp-dr-body") || document;
    const nameEl = drawer.querySelector("[data-xl-name]");
    if (nameEl) nameEl.textContent = filenameFor(report);
  }

  document.addEventListener("click", (event) => {
    const pick = event.target.closest("[data-xl-pick-template]");
    if (pick) {
      event.preventDefault();
      const drawer = pick.closest(".rp-drawer") || document;
      const input = drawer.querySelector("[data-xl-template-input]");
      if (input) input.click();
      return;
    }
    const save = event.target.closest("[data-xl-save]");
    if (save) {
      const reportId = save.getAttribute("data-id");
      const report = bridge() && bridge().report(reportId);
      if (report) {
        if (report.excel && report.excel.mode === "grid") saveGridVersion(report);
        else saveVersion(report);
      }
      return;
    }
    const useSuggest = event.target.closest("[data-xl-use-suggest]");
    if (useSuggest) {
      const reportId = useSuggest.getAttribute("data-id");
      const report = bridge() && bridge().report(reportId);
      if (report) applySuggestion(report);
      return;
    }
    const useGrid = event.target.closest("[data-xl-use-grid]");
    if (useGrid) {
      const reportId = useGrid.getAttribute("data-id");
      const report = bridge() && bridge().report(reportId);
      if (report) useGridSuggestion(report);
      return;
    }
    const aiScanBtn = event.target.closest("[data-xl-ai-scan]");
    if (aiScanBtn) {
      runAiScan(aiScanBtn.getAttribute("data-id"));
      return;
    }
    const aiUseSheet = event.target.closest("[data-xl-ai-use-sheet]");
    if (aiUseSheet) {
      const reportId = aiUseSheet.getAttribute("data-id");
      const cache = state.grid && state.grid.reportId === reportId ? state.grid : null;
      const report = bridge() && bridge().report(reportId);
      if (cache && report) {
        const sheet = cache.workbook.getWorksheet(aiUseSheet.getAttribute("data-value"));
        if (sheet) {
          prepareGridSheet(cache, sheet);
          report.excel = Object.assign({}, report.excel, { gridSheet: sheet.name });
          bridge().save(report).catch(() => {});
          if (bridge()) bridge().refreshDetail();
          A.toast(`Đã đổi sang sheet “${sheet.name}”.`, "success");
        }
      }
      return;
    }
    const aiUseDate = event.target.closest("[data-xl-ai-use-date]");
    if (aiUseDate) {
      const reportId = aiUseDate.getAttribute("data-id");
      const dateAnchor = aiUseDate.getAttribute("data-value");
      const report = bridge() && bridge().report(reportId);
      if (report && /^\d{4}-\d{2}-\d{2}$/.test(dateAnchor)) {
        report.excel = Object.assign({}, report.excel, { gridDate: dateAnchor });
        if (bridge()) bridge().save(report).catch(() => {});
        if (bridge()) bridge().refreshDetail();
        A.toast(`Đã đặt mốc ngày ${dateAnchor}.`, "success");
      }
      return;
    }
    const aiDismiss = event.target.closest("[data-xl-ai-dismiss]");
    if (aiDismiss) {
      state.aiScan = null;
      if (bridge()) bridge().refreshDetail();
      return;
    }
    const retryGrid = event.target.closest("[data-xl-grid-retry]");
    if (retryGrid) {
      const reportId = retryGrid.getAttribute("data-id");
      state.gridFailed = null;
      resetGrid(reportId);
      if (bridge()) bridge().refreshDetail();
      return;
    }
    const reloadGrid = event.target.closest("[data-xl-grid-reload]");
    if (reloadGrid) {
      const reportId = reloadGrid.getAttribute("data-id");
      resetGrid(reportId);
      state.gridFailed = null;
      if (bridge()) bridge().refreshDetail();
      A.toast("Đã bỏ các thay đổi chưa lưu và mở lại bảng.", "info");
      return;
    }
    const colPage = event.target.closest("[data-xl-grid-colpage]");
    if (colPage) {
      const reportId = colPage.getAttribute("data-id");
      const cache = state.grid && state.grid.reportId === reportId ? state.grid : null;
      if (!cache) return;
      const win = gridColumnWindow(cache);
      cache.page = Math.min(Math.max(win.page + Number(colPage.getAttribute("data-xl-grid-colpage") || 0), 0), win.pages - 1);
      cache.dayFocus = cache.page * 5;
      if (bridge()) bridge().refreshDetail();
      return;
    }
    const rowPage = event.target.closest("[data-xl-grid-rowpage]");
    if (rowPage) {
      const reportId = rowPage.getAttribute("data-id");
      const cache = state.grid && state.grid.reportId === reportId ? state.grid : null;
      if (!cache) return;
      const win = gridRowWindow(cache);
      cache.rowPage = Math.min(Math.max(win.page + Number(rowPage.getAttribute("data-xl-grid-rowpage") || 0), 0), win.pages - 1);
      if (bridge()) bridge().refreshDetail();
      return;
    }
    const maxGrid = event.target.closest("[data-xl-grid-max]");
    if (maxGrid) {
      const cache = state.grid;
      if (!cache) return;
      cache.maxed = !cache.maxed;
      if (bridge()) bridge().refreshDetail();
      return;
    }
    const dismissSuggest = event.target.closest("[data-xl-dismiss-suggest]");
    if (dismissSuggest) {
      state.suggestion = null;
      state.error = "";
      if (bridge()) bridge().refreshDetail();
      return;
    }
    const reset = event.target.closest("[data-xl-reset]");
    if (reset) {
      const reportId = reset.getAttribute("data-id");
      const report = bridge() && bridge().report(reportId);
      if (!report) return;
      const draft = draftOf(report);
      state.draft[report.id] = { values: {}, filenamePattern: draft.filenamePattern };
      state.error = "";
      if (bridge()) bridge().refreshDetail();
      A.toast("Đã xoá số liệu đang nhập. Bấm Lưu để áp dụng.", "info");
    }
  });

  document.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    const cache = state.grid;
    if (!cache) return;
    const td = event.target.closest ? event.target.closest(".xl-grid-wrap td[data-xl-cell]") : null;
    if (!td) return;
    const pos = cellPosOf(td);
    if (!pos) return;
    const input = event.target.closest(".xl-grid-input");
    event.preventDefault();
    selectGridCell(cache, pos, event.shiftKey);
    cache.dragging = true;
    if (input) {
      input.focus();
      if (!event.shiftKey) input.select();
    }
    paintGridSel(cache);
  });

  document.addEventListener("mouseover", (event) => {
    const cache = state.grid;
    if (!cache || !cache.dragging) return;
    const td = event.target.closest ? event.target.closest(".xl-grid-wrap td[data-xl-cell]") : null;
    if (!td) return;
    selectGridCell(cache, cellPosOf(td), true);
    paintGridSel(cache);
  });

  document.addEventListener("mouseup", () => {
    if (state.grid) state.grid.dragging = false;
  });

  document.addEventListener("copy", (event) => {
    const cache = state.grid;
    if (!cache || !cache.sel) return;
    const grid = document.querySelector(".xl-grid-wrap");
    if (!grid) return;
    const active = document.activeElement;
    const tag = active ? active.tagName : "";
    const editable = tag === "INPUT" || tag === "TEXTAREA" || (active && active.isContentEditable);
    if (editable && !grid.contains(active)) return;
    const range = gridRange(cache);
    const multi = !!(range && (range.r2 > range.r1 || range.c2 > range.c1));
    if (!multi && editable && active.selectionStart !== active.selectionEnd) return;
    const text = selectionTsv(cache);
    if (!text) return;
    if (event.clipboardData) {
      event.clipboardData.setData("text/plain", text);
      event.preventDefault();
    }
  });

  document.addEventListener("paste", (event) => {
    const cache = state.grid;
    if (!cache) return;
    const grid = document.querySelector(".xl-grid-wrap");
    const target = event.target;
    if (!grid || !target || !grid.contains(target)) return;
    const text = event.clipboardData ? event.clipboardData.getData("text/plain") : "";
    if (!text) return;
    const range = gridRange(cache);
    const multi = !!(range && (range.r2 > range.r1 || range.c2 > range.c1));
    const input = target.closest ? target.closest(".xl-grid-input") : null;
    if (!/[\t\r\n]/.test(text) && !multi && input) return;
    event.preventDefault();
    const count = pasteGridText(cache, text);
    if (count) A.toast(`Đã dán ${count} ô từ bộ nhớ tạm.`, "success");
  });

  document.addEventListener("keydown", (event) => {
    const cache = state.grid;
    if (!cache) return;
    const target = event.target;
    const grid = document.querySelector(".xl-grid-wrap");
    if (!grid || !target || !grid.contains(target)) return;
    if (event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
    const input = target.classList && target.classList.contains("xl-grid-input") ? target : null;
    const base = cache.active || cellPosOf(target);
    if (!base) return;
    const moveTo = (row, col) => {
      const targetRow = Math.min(Math.max(row, 1), cache.maxRow);
      const targetCol = Math.min(Math.max(col, 1), cache.maxCol);
      cache.active = { row: targetRow, col: targetCol };
      cache.sel = { r1: targetRow, r2: targetRow, c1: targetCol, c2: targetCol };
      event.preventDefault();
      focusGridCell(cache, targetRow, targetCol);
    };
    if (event.key === "Enter") {
      moveTo(base.row + (event.shiftKey ? -1 : 1), base.col);
      return;
    }
    if (event.key === "ArrowDown") {
      moveTo(base.row + 1, base.col);
      return;
    }
    if (event.key === "ArrowUp") {
      moveTo(base.row - 1, base.col);
      return;
    }
    if (!input && event.key === "ArrowLeft") {
      moveTo(base.row, base.col - 1);
      return;
    }
    if (!input && event.key === "ArrowRight") {
      moveTo(base.row, base.col + 1);
      return;
    }
    if (event.key === "Escape" && cache.active) {
      cache.sel = { r1: cache.active.row, r2: cache.active.row, c1: cache.active.col, c2: cache.active.col };
      paintGridSel(cache);
    }
  });

  document.addEventListener("input", (event) => {
    const gridCell = event.target.closest("[data-xl-grid-cell]");
    if (gridCell && state.grid) {
      applyGridInput(state.grid, gridCell);
      return;
    }
    const field = event.target.closest("[data-xl-field]");
    if (field) {
      const reportId = field.getAttribute("data-id");
      const report = bridge() && bridge().report(reportId);
      if (!report) return;
      const draft = draftOf(report);
      draft.values[String(field.getAttribute("data-xl-field") || "")] = field.value;
      updateFilename(report, field);
      return;
    }
    const pattern = event.target.closest("[data-xl-pattern]");
    if (pattern) {
      const reportId = pattern.getAttribute("data-id");
      const report = bridge() && bridge().report(reportId);
      if (!report) return;
      draftOf(report).filenamePattern = pattern.value;
      updateFilename(report, pattern);
    }
  });

  document.addEventListener("change", (event) => {
    const sheetPick = event.target.closest("[data-xl-grid-sheet]");
    if (sheetPick && state.grid) {
      const sheet = state.grid.workbook.getWorksheet(sheetPick.value);
      if (sheet) {
        prepareGridSheet(state.grid, sheet);
        if (bridge()) bridge().refreshDetail();
      }
      return;
    }
    const dayPick = event.target.closest("[data-xl-grid-day]");
    if (dayPick && state.grid) {
      const index = Math.max(Number(dayPick.value || 0), 0);
      state.grid.dayFocus = index;
      state.grid.page = Math.floor(index / 5);
      if (bridge()) bridge().refreshDetail();
      return;
    }
    const pageInput = event.target.closest("[data-xl-grid-page-input]");
    if (pageInput && state.grid) {
      const win = gridColumnWindow(state.grid);
      state.grid.page = Math.min(Math.max(Number(pageInput.value || 1), 1), win.pages) - 1;
      state.grid.dayFocus = state.grid.page * 5;
      if (bridge()) bridge().refreshDetail();
      return;
    }
    const toggle = event.target.closest("[data-xl-suggest]");
    if (toggle) {
      const suggestion = state.suggestion;
      if (!suggestion) return;
      const id = toggle.getAttribute("data-xl-suggest");
      if (toggle.checked) suggestion.selected.add(id);
      else suggestion.selected.delete(id);
      return;
    }
    const input = event.target.closest("[data-xl-template-input]");
    if (!input) return;
    const file = input.files && input.files[0];
    input.value = "";
    if (!file) return;
    const reportId = input.getAttribute("data-id");
    const report = bridge() && bridge().report(reportId);
    if (report) uploadTemplate(report, file);
  });

  window.addEventListener("guong:account", () => {
    state.busy = null;
    state.error = "";
    state.draft = Object.create(null);
    state.suggestion = null;
    state.grid = null;
    state.gridLoading = null;
    state.gridFailed = null;
  });

  A.excelTab = excelTab;
  if (A.excelBridge) {
    A.excelBridge.regenerate = (report) => buildFresh(report, { download: false, toast: false });
  }
})();
