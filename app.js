"use strict";

const STORAGE_KEY = "life_os_weekly_reviews_v1";
const GOALS = {
  standardization: 2,
  familyHours: 8,
  sleepAvg: 6.5,
  englishDays: 5
};

const form = document.getElementById("weeklyForm");
const reviewIdInput = document.getElementById("reviewId");
const recordsBody = document.getElementById("recordsBody");
const summaryMonthInput = document.getElementById("summaryMonth");
const summaryOutput = document.getElementById("summaryOutput");
const dashboardCards = document.getElementById("dashboardCards");
const promptPreview = document.getElementById("promptPreview");
const toast = document.getElementById("toast");

const clearButton = document.getElementById("clearButton");
const fillSampleButton = document.getElementById("fillSampleButton");
const resetFormButton = document.getElementById("resetFormButton");
const copyWeeklyPromptButton = document.getElementById("copyWeeklyPromptButton");
const copyMonthlyPromptButton = document.getElementById("copyMonthlyPromptButton");
const exportButton = document.getElementById("exportButton");

let entries = [];
let editingId = null;
let latestSummaryText = "";

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
  "familyHours",
  "sleepAvg",
  "weight",
  "englishDays",
  "scoreWork",
  "scoreLife",
  "scoreConsistency",
  "scoreTotal"
];

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function formatValue(value, suffix = "") {
  return value === null || value === undefined || Number.isNaN(value) ? "-" : `${value}${suffix}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

function ensureDefaultWeekRange() {
  if (form.weekStart.value && form.weekEnd.value) return;
  const today = new Date();
  const monday = getMonday(today);
  const sunday = addDays(monday, 6);
  form.weekStart.value = toISODate(monday);
  form.weekEnd.value = toISODate(sunday);
}

function setDefaultMonthIfEmpty() {
  if (summaryMonthInput.value) return;
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  summaryMonthInput.value = `${now.getFullYear()}-${month}`;
}

function resetForm(keepDates = true) {
  const savedWeekStart = form.weekStart.value;
  const savedWeekEnd = form.weekEnd.value;
  form.reset();
  reviewIdInput.value = "";
  editingId = null;
  if (keepDates && savedWeekStart && savedWeekEnd) {
    form.weekStart.value = savedWeekStart;
    form.weekEnd.value = savedWeekEnd;
  } else {
    ensureDefaultWeekRange();
  }
}

function collectFormData() {
  const review = {
    id: reviewIdInput.value || String(Date.now()),
    weekStart: form.weekStart.value,
    weekEnd: form.weekEnd.value,
    assetCheck: form.assetCheck.value || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  for (const key of TEXT_FIELDS) {
    review[key] = (form[key].value || "").trim();
  }

  for (const key of NUMBER_FIELDS) {
    review[key] = parseNumber(form[key].value);
  }

  return review;
}

function fillForm(review) {
  editingId = review.id;
  reviewIdInput.value = review.id;
  form.weekStart.value = review.weekStart || "";
  form.weekEnd.value = review.weekEnd || "";
  form.assetCheck.value = review.assetCheck || "";

  for (const key of TEXT_FIELDS) {
    form[key].value = review[key] || "";
  }
  for (const key of NUMBER_FIELDS) {
    form[key].value = review[key] ?? "";
  }
}

function handleSubmit(event) {
  event.preventDefault();
  const review = collectFormData();
  if (!review.weekStart || !review.weekEnd) {
    showToast("週開始日と週終了日を入力してください。");
    return;
  }

  if (review.weekStart > review.weekEnd) {
    showToast("週開始日が週終了日より後になっています。");
    return;
  }

  const existingIdx = entries.findIndex((item) => item.id === review.id);
  if (existingIdx >= 0) {
    review.createdAt = entries[existingIdx].createdAt || review.createdAt;
    entries[existingIdx] = review;
    showToast("レビューを更新しました。");
  } else {
    entries.push(review);
    showToast("レビューを保存しました。");
  }

  entries.sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
  saveEntries();
  resetForm(false);
  renderAll();
}

function renderRecords() {
  if (!entries.length) {
    recordsBody.innerHTML = '<tr><td colspan="7">まだレビューがありません。</td></tr>';
    return;
  }

  const rows = [...entries]
    .sort((a, b) => (a.weekStart > b.weekStart ? -1 : 1))
    .map((item) => {
      const assetClass = item.assetCheck === "実施" ? "ok" : "ng";
      return `
        <tr>
          <td>${escapeHtml(item.weekStart)} 〜 ${escapeHtml(item.weekEnd)}</td>
          <td>${formatValue(item.achievedCount, "/3")}</td>
          <td>${formatValue(item.standardizationCount)}</td>
          <td>${formatValue(item.englishDays, "日")}</td>
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

function getMonthWindow(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { start, end };
}

function entryOverlapsMonth(entry, monthValue) {
  if (!entry.weekStart) return false;
  const { start, end } = getMonthWindow(monthValue);
  const weekStart = fromISODate(entry.weekStart);
  const weekEnd = fromISODate(entry.weekEnd || entry.weekStart);
  if (!weekStart || !weekEnd) return false;
  return weekStart <= end && weekEnd >= start;
}

function getEntriesInMonth(monthValue) {
  return entries
    .filter((entry) => entryOverlapsMonth(entry, monthValue))
    .sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
}

function getWeekKey(date) {
  const monday = getMonday(date);
  return toISODate(monday);
}

function getExpectedWeeklyCount(monthValue) {
  const { start, end } = getMonthWindow(monthValue);
  const cursor = new Date(start);
  const keys = new Set();
  while (cursor <= end) {
    keys.add(getWeekKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys.size;
}

function average(numbers) {
  if (!numbers.length) return null;
  const sum = numbers.reduce((acc, cur) => acc + cur, 0);
  return sum / numbers.length;
}

function summarizeMonth(monthValue) {
  const monthEntries = getEntriesInMonth(monthValue);
  const expected = getExpectedWeeklyCount(monthValue);

  const familyValues = monthEntries.map((e) => e.familyHours).filter((v) => v !== null);
  const sleepValues = monthEntries.map((e) => e.sleepAvg).filter((v) => v !== null);
  const englishValues = monthEntries.map((e) => e.englishDays).filter((v) => v !== null);
  const totalScores = monthEntries.map((e) => e.scoreTotal).filter((v) => v !== null);

  const standardizationSum = monthEntries.reduce((acc, e) => acc + (e.standardizationCount || 0), 0);
  const assetChecked = monthEntries.filter((e) => e.assetCheck === "実施").length;
  const assetRate = monthEntries.length ? Math.round((assetChecked / monthEntries.length) * 100) : null;

  const withWeight = monthEntries.filter((e) => e.weight !== null);
  let weightChange = null;
  if (withWeight.length >= 2) {
    weightChange = Number((withWeight[withWeight.length - 1].weight - withWeight[0].weight).toFixed(1));
  }

  return {
    monthValue,
    expectedWeeklyCount: expected,
    reviewCount: monthEntries.length,
    standardizationSum,
    familyAvg: average(familyValues),
    sleepAvg: average(sleepValues),
    englishAvg: average(englishValues),
    totalScoreAvg: average(totalScores),
    assetRate,
    weightChange
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

  const familyAvg = s.familyAvg !== null ? s.familyAvg.toFixed(1) : "-";
  const sleepAvg = s.sleepAvg !== null ? s.sleepAvg.toFixed(1) : "-";
  const englishAvg = s.englishAvg !== null ? s.englishAvg.toFixed(1) : "-";
  const scoreAvg = s.totalScoreAvg !== null ? s.totalScoreAvg.toFixed(1) : "-";
  const weightDelta = s.weightChange === null ? "-" : `${s.weightChange > 0 ? "+" : ""}${s.weightChange}kg`;

  summaryOutput.innerHTML = [
    `<p><strong>対象レビュー数:</strong> ${s.reviewCount} / ${s.expectedWeeklyCount}週</p>`,
    `<p><strong>業務標準化 合計:</strong> ${s.standardizationSum}件</p>`,
    `<p><strong>家族時間 平均:</strong> ${familyAvg}h/週</p>`,
    `<p><strong>睡眠 平均:</strong> ${sleepAvg}h/日</p>`,
    `<p><strong>英語学習 平均:</strong> ${englishAvg}日/週</p>`,
    `<p><strong>資産確認 実施率:</strong> ${s.assetRate ?? "-"}%</p>`,
    `<p><strong>総合点 平均:</strong> ${scoreAvg}</p>`,
    `<p><strong>体重 月間増減:</strong> ${weightDelta}</p>`
  ].join("");

  latestSummaryText = [
    `【月末サマリー】${monthLabel(monthValue)}`,
    `- 週次レビュー実施回数: ${s.reviewCount}/${s.expectedWeeklyCount}`,
    `- 業務標準化 合計件数: ${s.standardizationSum}`,
    `- 家族時間 平均（h/週）: ${familyAvg}`,
    `- 睡眠 平均（h/日）: ${sleepAvg}`,
    `- 体重の月間増減: ${weightDelta}`,
    `- 資産確認 実施率: ${s.assetRate ?? "-"}%`,
    `- 英語学習 平均（日/週）: ${englishAvg}`,
    "",
    "■ 今月の結論",
    "- 継続できた仕組み:",
    "- 崩れたポイント:",
    "- 来月の重点1つ:"
  ].join("\n");
}

function renderDashboard() {
  const now = new Date();
  const monthValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const s = summarizeMonth(monthValue);
  const stdTarget = s.expectedWeeklyCount * GOALS.standardization;

  const items = [
    {
      label: "週次レビュー",
      value: `${s.reviewCount}/${s.expectedWeeklyCount}週`
    },
    {
      label: "標準化進捗",
      value: `${s.standardizationSum}/${stdTarget}件`
    },
    {
      label: "家族時間平均",
      value: `${s.familyAvg === null ? "-" : s.familyAvg.toFixed(1)}h (目標${GOALS.familyHours})`
    },
    {
      label: "睡眠平均",
      value: `${s.sleepAvg === null ? "-" : s.sleepAvg.toFixed(1)}h (目標${GOALS.sleepAvg})`
    },
    {
      label: "英語平均",
      value: `${s.englishAvg === null ? "-" : s.englishAvg.toFixed(1)}日 (目標${GOALS.englishDays})`
    },
    {
      label: "資産確認率",
      value: `${s.assetRate === null ? "-" : `${s.assetRate}%`}`
    }
  ];

  dashboardCards.innerHTML = items
    .map((item) => {
      return `<div class="metric"><div class="label">${escapeHtml(item.label)}</div><div class="value">${escapeHtml(item.value)}</div></div>`;
    })
    .join("");
}

function buildWeeklyPrompt(entry) {
  const goods = [entry.good1, entry.good2, entry.good3].filter(Boolean);
  const goodLines = goods.length ? goods.map((line, idx) => `${idx + 1}. ${line}`).join("\n") : "1.\n2.\n3.";

  return [
    "【週次レビュー分析依頼（ChatGPT用）】",
    "",
    "次の週次データを評価してください。",
    "1. 未達の根本原因を1つに特定",
    "2. 来週の最重要3タスクを提案（優先順）",
    "3. KPI改善のための具体策を3つ提案",
    "4. 上司報告用の一言を40字以内で作成",
    "",
    "--- 入力データ ---",
    `対象週: ${entry.weekStart}〜${entry.weekEnd}`,
    "■ 今週の最重要3タスク",
    `1. ${entry.task1 || ""}`,
    `2. ${entry.task2 || ""}`,
    `3. ${entry.task3 || ""}`,
    "",
    "■ 実行結果",
    `- タスク達成数（/3）: ${formatValue(entry.achievedCount)}`,
    `- 達成できた理由: ${entry.achievedReason || ""}`,
    `- 未達の原因: ${entry.missedReason || ""}`,
    "",
    "■ KPI入力",
    `- 業務標準化件数: ${formatValue(entry.standardizationCount)}`,
    `- 家族時間: ${formatValue(entry.familyHours, "h/週")}`,
    `- 睡眠平均: ${formatValue(entry.sleepAvg, "h/日")}`,
    `- 体重: ${formatValue(entry.weight, "kg")}`,
    `- 資産確認: ${entry.assetCheck || "-"}`,
    `- 英語学習日数: ${formatValue(entry.englishDays, "日/週")}`,
    "",
    "■ 週の採点（100点満点）",
    `- 仕事: ${formatValue(entry.scoreWork)}`,
    `- 生活: ${formatValue(entry.scoreLife)}`,
    `- 継続力: ${formatValue(entry.scoreConsistency)}`,
    `- 総合点: ${formatValue(entry.scoreTotal)}`,
    "",
    "■ 振り返り",
    `- 良かったこと:\n${goodLines}`,
    `- 改善1つ: ${entry.improvement || ""}`,
    `- 来週の布石（5分でできること）: ${entry.seedAction || ""}`
  ].join("\n");
}

function getLatestEntry() {
  if (!entries.length) return null;
  return [...entries].sort((a, b) => (a.weekStart > b.weekStart ? -1 : 1))[0];
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

  const targetEntry = entries.find((entry) => entry.id === id);
  if (!targetEntry) return;

  if (action === "edit") {
    fillForm(targetEntry);
    promptPreview.textContent = buildWeeklyPrompt(targetEntry);
    window.scrollTo({ top: 0, behavior: "smooth" });
    showToast("編集モードに切り替えました。");
  }

  if (action === "delete") {
    const approved = window.confirm("このレビューを削除しますか？");
    if (!approved) return;
    entries = entries.filter((entry) => entry.id !== id);
    saveEntries();
    if (editingId === id) resetForm();
    renderAll();
    showToast("削除しました。");
  }
}

function fillSampleData() {
  ensureDefaultWeekRange();
  form.task1.value = "理事会議事録テンプレを更新";
  form.task2.value = "入学式進行表v2を確定";
  form.task3.value = "来賓対応FAQを整備";
  form.achievedCount.value = "2";
  form.achievedReason.value = "先に会議資料を固定したため、判断が速かった";
  form.missedReason.value = "緊急対応で1案件が後ろ倒し";
  form.standardizationCount.value = "2";
  form.familyHours.value = "8";
  form.sleepAvg.value = "6.4";
  form.weight.value = "72.4";
  form.assetCheck.value = "実施";
  form.englishDays.value = "5";
  form.scoreWork.value = "84";
  form.scoreLife.value = "78";
  form.scoreConsistency.value = "81";
  form.scoreTotal.value = "81";
  form.good1.value = "定型文の再利用率が上がった";
  form.good2.value = "会議準備の前倒しができた";
  form.good3.value = "夜の振り返りを4日継続できた";
  form.improvement.value = "水曜の中間レビューを固定化する";
  form.seedAction.value = "月曜会議のアジェンダ下書きを5分で作る";
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
  a.download = `life-os-weekly-reviews-${today}.json`;
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

  copyWeeklyPromptButton.addEventListener("click", async () => {
    const target = editingId ? entries.find((entry) => entry.id === editingId) : getLatestEntry();
    if (!target) {
      showToast("コピー対象の週次レビューがありません。");
      return;
    }
    const prompt = buildWeeklyPrompt(target);
    promptPreview.textContent = prompt;
    const copied = await copyToClipboard(prompt);
    showToast(copied ? "週次分析プロンプトをコピーしました。" : "コピーに失敗しました。");
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
  setDefaultMonthIfEmpty();
  ensureDefaultWeekRange();
  bindEvents();
  registerServiceWorker();
  renderAll();
}

init();
