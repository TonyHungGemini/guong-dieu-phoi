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

  const state = {
    busy: null,
    error: "",
    draft: Object.create(null),
    suggestion: null,
    libPromise: null,
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

  async function inspectWorkbook(buffer) {
    const ExcelJS = await loadExcelJS();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const fields = new Map();
    const builtins = new Set();
    workbook.eachSheet((sheet) => {
      sheet.eachRow({ includeEmpty: false }, (row) => {
        row.eachCell({ includeEmpty: false }, (cell) => {
          const text = readCellText(cell.value);
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
    const suggestions = !fields.size && !builtins.size ? detectPairs(workbook) : [];
    if (!fields.size && !builtins.size && !suggestions.length) {
      throw new Error("Mẫu chưa có biến nào. Gõ dạng {{doanh_thu}} vào ô cần điền, hoặc dùng bảng có cặp nhãn – số liệu để GUỒNG tự tạo biến.");
    }
    return {
      fields: Array.from(fields.values()),
      builtins: Array.from(builtins),
      suggestions,
      sheetNames: workbook.worksheets.map((sheet) => sheet.name).slice(0, 8),
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
        state.suggestion = {
          reportId: report.id,
          fileName: file.name,
          buffer,
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

  async function saveVersion(report) {
    if (!apiReady()) return;
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
      A.toast(`Đã lưu “${meta.name}”.`, "success");
      const link = document.createElement("a");
      link.href = fileUrl(meta.id, true);
      link.download = meta.name;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      pruneGenerated(report.id, meta.id);
    } catch (err) {
      setError(report, err);
    }
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
          <p>Tải mẫu <b>.xlsx</b> một lần. GUỒNG dò biến <code>{{ten_bien}}</code>, hoặc tự nhận diện cặp nhãn – số liệu trong báo cáo cũ, rồi giữ số liệu cho kỳ sau.</p>
        </div>
        <button class="btn btn-accent" type="button" data-xl-pick-template data-id="${esc(report.id)}">${A.icon("upload")} Chọn mẫu .xlsx</button>
        <input type="file" data-xl-template-input data-id="${esc(report.id)}" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>
      </div>
      <div class="xl-guide">
        <div><b>1</b><span>Mở file Excel mẫu và gõ <code>{{ngay}}</code>, <code>{{du_an}}</code>, <code>{{doanh_thu}}</code> vào ô cần điền — hoặc tải lên báo cáo cũ có cặp nhãn – số liệu.</span></div>
        <div><b>2</b><span>Tải mẫu lên đây. Các biến thành ô nhập, định dạng và công thức của mẫu được giữ nguyên.</span></div>
        <div><b>3</b><span>Mỗi kỳ mở báo cáo, nhập số liệu, xem tên tệp rồi bấm <b>Lưu &amp; tải xuống</b>.</span></div>
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
    const draft = draftOf(report);
    return `<div class="rp-dr-section">
      ${errorHtml()}
      ${templateHeadHtml(report)}
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
      if (report) saveVersion(report);
      return;
    }
    const useSuggest = event.target.closest("[data-xl-use-suggest]");
    if (useSuggest) {
      const reportId = useSuggest.getAttribute("data-id");
      const report = bridge() && bridge().report(reportId);
      if (report) applySuggestion(report);
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

  document.addEventListener("input", (event) => {
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
  });

  A.excelTab = excelTab;
})();
