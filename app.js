"use strict";

const STORAGE_KEY = "life_os_daily_reviews_v1";
const GOALS = {
  standardizationPerWeek: 2,
  englishDaysPerWeek: 5,
  sleepHoursPerDay: 6.5,
  familyMinutesPerDay: 60
};

const form = document.getElementById("dailyForm");
const entryIdInput = document.getElementById("entryId");
const recordsBody = document.getElementById("recordsBody");
const summaryMonthInput = document.getElementById("summaryMonth");
const summaryOutput = document.getElementById("summaryOutput");
const dashboardCards = document.getElementById("dashboardCards");
const promptPreview = document.getElementById("promptPreview");
const toast = document.getElementById("toast");

const clearButton = document.getElementById("clearButton");
const fillSampleButton = document.getElementById("fillSampleButton");
const resetFormButton = document.getElementById("resetFormButton");
const copyDailyPromptButton = document.getElementById("copyDailyPromptButton");
const copyMonthlyPromptButton = document.getElementById("copyMonthlyPromptButton");
const exportButton = document.getElementById("exportButton");

const TEXT_FIELDS = [
  "task1",
  "task2",
  "task3",
  "achievedReason",
  "missedReason",
  "good1",
  "good2",
  "good3",
  "improvement",
  "seedAction"
];

const NUMBER_FIELDS = [
  "achievedCount",
  "standardizationCount",
  "familyMinutes",
  "sleepHours",
  "weight",
  "scoreWork",
  "scoreLife",
  "scoreConsistency",
  "scoreTotal"
];

let entries = [];
let editingId = null;
let latestSummaryText = "";

function pad2(num) {
  return String(num).padStart(2, "0");
}

function toISODate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function fromISODate(isoDate) {
  const [y, m, d] = (isoDate || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getMonday(date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

function parseNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatValue(value, suffix = "") {
  return value === null || value === undefined || Number.isNaN(value) ? "-" : `${value}${suffix}`;
}

function average(numbers) {
  if (!numbers.length) return null;
  const sum = numbers.reduce((acc, cur) => acc + cur, 0);
  return sum / numbers.length;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => {
    toast.classList.remove("show");
  }, 1800);
}

function loadEntries() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    entries = Array.isArray(parsed) ? parsed : [];
  } catch (_err) {
    entries = [];
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function ensureDefaultDate() {
  if (form.entryDate.value) return;
  form.entryDate.value = toISODate(new Date());
}

function setDefaultMonthIfEmpty() {
  if (summaryMonthInput.value) return;
  const today = new Date();
  summaryMonthInput.value = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}`;
}

function resetForm(keepDate = true) {
  const savedDate = form.entryDate.value;
  form.reset();
  editingId = null;
  entryIdInput.value = "";
  if (keepDate && savedDate) {
    form.entryDate.value = savedDate;
  } else {
    ensureDefaultDate();
  }
}

function collectFormData() {
  const item = {
    id: entryIdInput.value || String(Date.now()),
    entryDate: form.entryDate.value,
    assetCheck: form.assetCheck.value || "",
    englishDone: form.englishDone.value || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  for (const key of TEXT_FIELDS) {
    item[key] = (form[key].value || "").trim();
  }
  for (const key of NUMBER_FIELDS) {
    item[key] = parseNumber(form[key].value);
  }

  return item;
}

function fillForm(item) {
  editingId = item.id;
  entryIdInput.value = item.id;
  form.entryDate.value = item.entryDate || "";
  form.assetCheck.value = item.assetCheck || "";
  form.englishDone.value = item.englishDone || "";

  for (const key of TEXT_FIELDS) {
    form[key].value = item[key] || "";
  }
  for (const key of NUMBER_FIELDS) {
    form[key].value = item[key] ?? "";
  }
}

function sortEntries() {
  entries.sort((a, b) => {
    if (a.entryDate === b.entryDate) return a.id.localeCompare(b.id);
    return a.entryDate < b.entryDate ? -1 : 1;
  });
}

function getEntryById(id) {
  return entries.find((item) => item.id === id) || null;
}

function handleSubmit(event) {
  event.preventDefault();
  const item = collectFormData();
  if (!item.entryDate) {
    showToast("日付を入力してください。");
    return;
  }

  const duplicate = entries.find((entry) => entry.entryDate === item.entryDate && entry.id !== item.id);
  if (duplicate) {
    const ok = window.confirm("この日付の入力は既にあります。上書きしますか？");
    if (!ok) return;
    item.id = duplicate.id;
  }

  const idx = entries.findIndex((entry) => entry.id === item.id);
  if (idx >= 0) {
    item.createdAt = entries[idx].createdAt || item.createdAt;
    entries[idx] = item;
    showToast("日次レビューを更新しました。");
  } else {
    entries.push(item);
    showToast("日次レビューを保存しました。");
  }

  sortEntries();
  saveEntries();
  resetForm(false);
  renderAll();
}

function renderRecords() {
  if (!entries.length) {
    recordsBody.innerHTML = '<tr><td colspan="7">まだ日次レビューがありません。</td></tr>';
    return;
  }

  const rows = [...entries]
    .sort((a, b) => (a.entryDate > b.entryDate ? -1 : 1))
    .map((item) => {
      const assetClass = item.assetCheck === "実施" ? "ok" : item.assetCheck === "対象外" ? "" : "ng";
      const englishClass = item.englishDone === "実施" ? "ok" : "ng";
      return `
        <tr>
          <td>${escapeHtml(item.entryDate)}</td>
          <td>${formatValue(item.achievedCount, "/3")}</td>
          <td>${formatValue(item.standardizationCount)}</td>
          <td><span class="chip ${englishClass}">${escapeHtml(item.englishDone || "-")}</span></td>
          <td>${formatValue(item.scoreTotal)}</td>
          <td><span class="chip ${assetClass}">${escapeHtml(item.assetCheck || "-")}</span></td>
          <td>
            <button class="btn btn-ghost" data-action="edit" data-id="${item.id}" type="button">編集</button>
            <button class="btn btn-ghost" data-action="delete" data-id="${item.id}" type="button">削除</button>
          </td>
        </tr>`;
    })
    .join("");

  recordsBody.innerHTML = rows;
}

function getMonthRange(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { start, end };
}

function getEntriesInMonth(monthValue) {
  return entries
    .filter((item) => {
      if (!item.entryDate) return false;
      return item.entryDate.startsWith(monthValue);
    })
    .sort((a, b) => (a.entryDate < b.entryDate ? -1 : 1));
}

function getExpectedDaysInMonth(monthValue) {
  const { start, end } = getMonthRange(monthValue);
  const today = new Date();
  const isCurrentMonth = start.getFullYear() === today.getFullYear() && start.getMonth() === today.getMonth();
  if (isCurrentMonth) return today.getDate();
  return end.getDate();
}

function summarizeMonth(monthValue) {
  const monthEntries = getEntriesInMonth(monthValue);
  const expectedDays = getExpectedDaysInMonth(monthValue);

  const achievedValues = monthEntries.map((e) => e.achievedCount).filter((v) => v !== null);
  const standardizationSum = monthEntries.reduce((acc, e) => acc + (e.standardizationCount || 0), 0);
  const familySumMinutes = monthEntries.reduce((acc, e) => acc + (e.familyMinutes || 0), 0);
  const sleepValues = monthEntries.map((e) => e.sleepHours).filter((v) => v !== null);
  const scoreValues = monthEntries.map((e) => e.scoreTotal).filter((v) => v !== null);
  const englishDoneCount = monthEntries.filter((e) => e.englishDone === "実施").length;

  const assetApplicable = monthEntries.filter((e) => e.assetCheck === "実施" || e.assetCheck === "未実施");
  const assetCheckedCount = assetApplicable.filter((e) => e.assetCheck === "実施").length;
  const assetRate = assetApplicable.length ? Math.round((assetCheckedCount / assetApplicable.length) * 100) : null;

  const withWeight = monthEntries.filter((e) => e.weight !== null);
  let weightChange = null;
  if (withWeight.length >= 2) {
    weightChange = Number((withWeight[withWeight.length - 1].weight - withWeight[0].weight).toFixed(1));
  }

  let achievedRate = null;
  if (achievedValues.length) {
    const achievedSum = achievedValues.reduce((acc, cur) => acc + cur, 0);
    achievedRate = Math.round((achievedSum / (achievedValues.length * 3)) * 100);
  }

  return {
    monthValue,
    expectedDays,
    reviewCount: monthEntries.length,
    standardizationSum,
    familySumMinutes,
    sleepAvg: average(sleepValues),
    scoreAvg: average(scoreValues),
    englishDoneCount,
    assetRate,
    weightChange,
    achievedRate
  };
}

function monthLabel(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  return `${year}年${month}月`;
}

function renderSummary() {
  const monthValue = summaryMonthInput.value;
  if (!monthValue) return;
  const s = summarizeMonth(monthValue);

  if (!s.reviewCount) {
    latestSummaryText = `${monthLabel(monthValue)}のデータはまだありません。`;
    summaryOutput.innerHTML = `<p>${escapeHtml(latestSummaryText)}</p>`;
    return;
  }

  const familyTotalHours = (s.familySumMinutes / 60).toFixed(1);
  const familyAvgMinutes = (s.familySumMinutes / s.reviewCount).toFixed(0);
  const sleepAvgText = s.sleepAvg === null ? "-" : s.sleepAvg.toFixed(1);
  const scoreAvgText = s.scoreAvg === null ? "-" : s.scoreAvg.toFixed(1);
  const weightDelta = s.weightChange === null ? "-" : `${s.weightChange > 0 ? "+" : ""}${s.weightChange}kg`;

  summaryOutput.innerHTML = [
    `<p><strong>入力日数:</strong> ${s.reviewCount} / ${s.expectedDays}日</p>`,
    `<p><strong>タスク達成率:</strong> ${s.achievedRate ?? "-"}%</p>`,
    `<p><strong>業務標準化 合計:</strong> ${s.standardizationSum}件</p>`,
    `<p><strong>家族時間 合計:</strong> ${familyTotalHours}h（平均 ${familyAvgMinutes}分/日）</p>`,
    `<p><strong>睡眠 平均:</strong> ${sleepAvgText}h/日</p>`,
    `<p><strong>英語実施日数:</strong> ${s.englishDoneCount}日</p>`,
    `<p><strong>資産確認 実施率:</strong> ${s.assetRate ?? "-"}%</p>`,
    `<p><strong>総合点 平均:</strong> ${scoreAvgText}</p>`,
    `<p><strong>体重 月間増減:</strong> ${weightDelta}</p>`
  ].join("");

  latestSummaryText = [
    `【月末サマリー】${monthLabel(monthValue)}`,
    `- 入力日数: ${s.reviewCount}/${s.expectedDays}`,
    `- タスク達成率: ${s.achievedRate ?? "-"}%`,
    `- 業務標準化 合計件数: ${s.standardizationSum}`,
    `- 家族時間 合計（h）: ${familyTotalHours}`,
    `- 家族時間 平均（分/日）: ${familyAvgMinutes}`,
    `- 睡眠 平均（h/日）: ${sleepAvgText}`,
    `- 英語実施日数: ${s.englishDoneCount}`,
    `- 資産確認 実施率: ${s.assetRate ?? "-"}%`,
    `- 総合点 平均: ${scoreAvgText}`,
    `- 体重の月間増減: ${weightDelta}`,
    "",
    "■ 今月の結論",
    "- 継続できた仕組み:",
    "- 崩れたポイント:",
    "- 来月の重点1つ:"
  ].join("\n");
}

function getEntriesInCurrentWeek() {
  const today = new Date();
  const monday = getMonday(today);
  const sunday = addDays(monday, 6);
  const startIso = toISODate(monday);
  const endIso = toISODate(sunday);

  return entries
    .filter((item) => item.entryDate >= startIso && item.entryDate <= endIso)
    .sort((a, b) => (a.entryDate < b.entryDate ? -1 : 1));
}

function renderDashboard() {
  const weekEntries = getEntriesInCurrentWeek();
  const inputDays = weekEntries.length;
  const standardizationSum = weekEntries.reduce((acc, e) => acc + (e.standardizationCount || 0), 0);
  const englishDoneCount = weekEntries.filter((e) => e.englishDone === "実施").length;
  const familySumMinutes = weekEntries.reduce((acc, e) => acc + (e.familyMinutes || 0), 0);
  const sleepAvg = average(weekEntries.map((e) => e.sleepHours).filter((v) => v !== null));

  let achievedRate = null;
  const achievedValues = weekEntries.map((e) => e.achievedCount).filter((v) => v !== null);
  if (achievedValues.length) {
    achievedRate = Math.round((achievedValues.reduce((acc, cur) => acc + cur, 0) / (achievedValues.length * 3)) * 100);
  }

  const items = [
    { label: "日次入力", value: `${inputDays}/7日` },
    { label: "タスク達成率", value: `${achievedRate ?? "-"}%` },
    { label: "標準化進捗", value: `${standardizationSum}/${GOALS.standardizationPerWeek}件` },
    { label: "英語実施", value: `${englishDoneCount}/${GOALS.englishDaysPerWeek}日` },
    { label: "家族時間", value: `${(familySumMinutes / 60).toFixed(1)}h/週` },
    {
      label: "睡眠平均",
      value: `${sleepAvg === null ? "-" : sleepAvg.toFixed(1)}h (目標${GOALS.sleepHoursPerDay})`
    }
  ];

  dashboardCards.innerHTML = items
    .map((item) => `<div class="metric"><div class="label">${escapeHtml(item.label)}</div><div class="value">${escapeHtml(item.value)}</div></div>`)
    .join("");
}

function buildDailyPrompt(item) {
  const goods = [item.good1, item.good2, item.good3].filter(Boolean);
  const goodLines = goods.length ? goods.map((line, idx) => `${idx + 1}. ${line}`).join("\n") : "1.\n2.\n3.";

  return [
    "【日次レビュー分析依頼（ChatGPT用）】",
    "",
    "次のデータを評価してください。",
    "1. 今日の詰まりの根本原因を1つに特定",
    "2. 明日の最重要3タスクを提案（優先順）",
    "3. KPI改善のための具体策を3つ提案",
    "4. 上司報告用の一言を40字以内で作成",
    "",
    "--- 入力データ ---",
    `日付: ${item.entryDate}`,
    "■ 今日の最重要3タスク",
    `1. ${item.task1 || ""}`,
    `2. ${item.task2 || ""}`,
    `3. ${item.task3 || ""}`,
    "",
    "■ 実行結果",
    `- 達成数（/3）: ${formatValue(item.achievedCount)}`,
    `- 進んだ理由: ${item.achievedReason || ""}`,
    `- 詰まった原因: ${item.missedReason || ""}`,
    "",
    "■ 日次KPI",
    `- 業務標準化件数: ${formatValue(item.standardizationCount)}`,
    `- 家族時間: ${formatValue(item.familyMinutes, "分/日")}`,
    `- 睡眠: ${formatValue(item.sleepHours, "h/日")}`,
    `- 体重: ${formatValue(item.weight, "kg")}`,
    `- 資産確認: ${item.assetCheck || "-"}`,
    `- 英語学習: ${item.englishDone || "-"}`,
    "",
    "■ 今日の採点（100点満点）",
    `- 仕事: ${formatValue(item.scoreWork)}`,
    `- 生活: ${formatValue(item.scoreLife)}`,
    `- 継続力: ${formatValue(item.scoreConsistency)}`,
    `- 総合点: ${formatValue(item.scoreTotal)}`,
    "",
    "■ 振り返り",
    `- 良かったこと:\n${goodLines}`,
    `- 改善1つ: ${item.improvement || ""}`,
    `- 明日の布石（5分でできること）: ${item.seedAction || ""}`
  ].join("\n");
}

function getLatestEntry() {
  if (!entries.length) return null;
  return [...entries].sort((a, b) => (a.entryDate > b.entryDate ? -1 : 1))[0];
}

async function copyToClipboard(text) {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_err) {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.focus();
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  }
}

function handleRecordActions(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const action = target.dataset.action;
  const id = target.dataset.id;
  if (!action || !id) return;

  const item = getEntryById(id);
  if (!item) return;

  if (action === "edit") {
    fillForm(item);
    promptPreview.textContent = buildDailyPrompt(item);
    window.scrollTo({ top: 0, behavior: "smooth" });
    showToast("編集モードに切り替えました。");
    return;
  }

  if (action === "delete") {
    const ok = window.confirm("この日次レビューを削除しますか？");
    if (!ok) return;
    entries = entries.filter((entry) => entry.id !== id);
    saveEntries();
    if (editingId === id) resetForm();
    renderAll();
    showToast("削除しました。");
  }
}

function fillSampleData() {
  ensureDefaultDate();
  form.task1.value = "理事会議事録テンプレを更新";
  form.task2.value = "入学式進行表v2を確定";
  form.task3.value = "来賓対応FAQを整備";
  form.achievedCount.value = "2";
  form.achievedReason.value = "朝の優先順位を先に固定できた";
  form.missedReason.value = "緊急対応で1件が後ろ倒し";
  form.standardizationCount.value = "1";
  form.familyMinutes.value = "80";
  form.sleepHours.value = "6.4";
  form.weight.value = "72.4";
  form.assetCheck.value = "実施";
  form.englishDone.value = "実施";
  form.scoreWork.value = "84";
  form.scoreLife.value = "78";
  form.scoreConsistency.value = "81";
  form.scoreTotal.value = "81";
  form.good1.value = "会議準備を前倒しできた";
  form.good2.value = "定型文の再利用が進んだ";
  form.good3.value = "夜の振り返りを継続できた";
  form.improvement.value = "昼に5分の中間レビューを固定";
  form.seedAction.value = "明日のアジェンダ草案を5分で作る";
  showToast("サンプルを入力しました。");
}

function exportAsJson() {
  const payload = {
    exportedAt: new Date().toISOString(),
    storageKey: STORAGE_KEY,
    entries
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const today = toISODate(new Date());
  a.href = url;
  a.download = `life-os-daily-reviews-${today}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("JSONをエクスポートしました。");
}

function renderAll() {
  renderRecords();
  renderSummary();
  renderDashboard();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  const host = window.location.hostname;
  const secureLike =
    window.location.protocol === "https:" ||
    host === "localhost" ||
    host === "127.0.0.1";

  if (!secureLike) {
    console.info("PWA有効化には https または localhost で配信してください。");
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.error("Service Worker登録に失敗しました:", err);
    });
  });
}

function bindEvents() {
  form.addEventListener("submit", handleSubmit);
  recordsBody.addEventListener("click", handleRecordActions);
  summaryMonthInput.addEventListener("change", renderSummary);

  clearButton.addEventListener("click", () => resetForm());
  resetFormButton.addEventListener("click", () => resetForm());
  fillSampleButton.addEventListener("click", fillSampleData);
  exportButton.addEventListener("click", exportAsJson);

  copyDailyPromptButton.addEventListener("click", async () => {
    const target = editingId ? getEntryById(editingId) : getLatestEntry();
    if (!target) {
      showToast("コピー対象の日次レビューがありません。");
      return;
    }
    const prompt = buildDailyPrompt(target);
    promptPreview.textContent = prompt;
    const copied = await copyToClipboard(prompt);
    showToast(copied ? "日次分析プロンプトをコピーしました。" : "コピーに失敗しました。");
  });

  copyMonthlyPromptButton.addEventListener("click", async () => {
    if (!latestSummaryText) {
      showToast("月末サマリーがありません。");
      return;
    }
    promptPreview.textContent = latestSummaryText;
    const copied = await copyToClipboard(latestSummaryText);
    showToast(copied ? "月末分析プロンプトをコピーしました。" : "コピーに失敗しました。");
  });
}

function init() {
  loadEntries();
  sortEntries();
  ensureDefaultDate();
  setDefaultMonthIfEmpty();
  bindEvents();
  registerServiceWorker();
  renderAll();
}

init();
