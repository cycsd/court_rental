import fs from "node:fs/promises";
import path from "node:path";
import type { TodayCheckResult } from "../types/schedule.js";
import { formatIsoDateWithWeekday } from "../utils/time.js";
import {
    buildWeatherTooltipText,
    getWeatherBadgeClassName,
    getWeatherTelegramIcon,
    isCourtUsable
} from "./weatherPresentation.js";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildWeatherBadge(
    weatherText?: string,
    temperatureC?: number,
    precipitationProbability?: number
): string {
    const title = buildWeatherTooltipText(weatherText, temperatureC, precipitationProbability);
    const classes = getWeatherBadgeClassName(weatherText, precipitationProbability);
    return `<span class="${classes} has-tip" data-tip="${escapeHtml(title)}" tabindex="0" role="button">${getWeatherTelegramIcon(weatherText)}</span>`;
}

function buildSummaryRows(result: TodayCheckResult, targetDate?: string): string {
  return result.timeSummary
    .filter((ts) => (targetDate ? ts.date === targetDate : true))
        .map((ts) => {
            const ratio = `${ts.available} / ${ts.total}`;
            const weatherBadge = buildWeatherBadge(
                ts.weatherText,
                ts.temperatureC,
                ts.precipitationProbability
            );
            const statusByCourt = new Map(
                result.slots
                .filter((slot) => slot.date === ts.date && slot.time === ts.time)
                    .map((slot) => [slot.court, slot.rawStatus])
            );
            const available =
                ts.availableCourts.length > 0
                    ? ts.availableCourts
                  .map((c) => {
                            return `<span class="badge ok">${escapeHtml(c)}</span>`;
                        })
                        .join(" ")
                : '<span class="badge na">無可用場地</span>';
            const unavailable =
                ts.unavailableCourts.length > 0
                    ? ts.unavailableCourts
                        .map((c) => {
                            const rawStatus = statusByCourt.get(c) ?? "";
                            return `<span class="badge warn has-tip" data-tip="${escapeHtml(rawStatus)}" tabindex="0" role="button">${escapeHtml(c)}</span>`;
                        })
                        .join(" ")
                    : "—";
            const rowClass = isCourtUsable(ts) ? "row-usable" : "row-not-usable";
          return `<tr class="${rowClass} daily-summary-row" data-date="${escapeHtml(ts.date)}" data-time="${escapeHtml(ts.time)}">
<td>${escapeHtml(formatIsoDateWithWeekday(ts.date, result.timezone))}</td>
<td>${escapeHtml(ts.time)}</td>
<td>${ratio}</td>
          <td>${weatherBadge}</td>
<td>${available}</td>
<td>${unavailable}</td>
</tr>`;
        })
        .join("\n");
}

function buildRangeSummaryRows(result: TodayCheckResult): string {
  return result.timeSummary
    .map((ts) => {
      const ratio = `${ts.available} / ${ts.total}`;
      const weatherBadge = buildWeatherBadge(
        ts.weatherText,
        ts.temperatureC,
        ts.precipitationProbability
      );
      const statusByCourt = new Map(
        result.slots
          .filter((slot) => slot.date === ts.date && slot.time === ts.time)
          .map((slot) => [slot.court, slot.rawStatus])
      );
      const available =
        ts.availableCourts.length > 0
          ? ts.availableCourts.map((c) => `<span class="badge ok">${escapeHtml(c)}</span>`).join(" ")
          : '<span class="badge na">無可用場地</span>';
      const unavailable =
        ts.unavailableCourts.length > 0
          ? ts.unavailableCourts
            .map((c) => {
              const rawStatus = statusByCourt.get(c) ?? "";
              return `<span class="badge warn has-tip" data-tip="${escapeHtml(rawStatus)}" tabindex="0" role="button">${escapeHtml(c)}</span>`;
            })
            .join(" ")
          : "—";
      const rowClass = isCourtUsable(ts) ? "row-usable" : "row-not-usable";
      return `<tr class="${rowClass}" data-date="${escapeHtml(ts.date)}" data-time="${escapeHtml(ts.time)}" data-available="${ts.available}" data-total="${ts.total}">
<td>${escapeHtml(formatIsoDateWithWeekday(ts.date, result.timezone))}</td>
<td>${escapeHtml(ts.time)}</td>
<td>${ratio}</td>
<td>${weatherBadge}</td>
<td>${available}</td>
<td>${unavailable}</td>
</tr>`;
    })
    .join("\n");
}

function buildDetailRows(result: TodayCheckResult, targetDate?: string): string {
    return result.slots
      .filter((slot) => (targetDate ? slot.date === targetDate : true))
        .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.court.localeCompare(b.court))
        .map((slot) => {
            const statusClass = slot.isRented ? "expired" : "active";
            const yesNo = slot.isRented ? "是" : "否";
          return `<tr class="daily-detail-row" data-date="${escapeHtml(slot.date)}" data-time="${escapeHtml(slot.time)}">
<td>${escapeHtml(formatIsoDateWithWeekday(slot.date, result.timezone))}</td>
<td>${escapeHtml(slot.time)}</td>
<td>${escapeHtml(slot.court)}</td>
<td class="${statusClass}">${escapeHtml(slot.rawStatus)}</td>
<td>${yesNo}</td>
</tr>`;
        })
        .join("\n");
}

function buildRangeDetailRows(result: TodayCheckResult): string {
  return result.slots
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.court.localeCompare(b.court))
    .map((slot) => {
      const statusClass = slot.isRented ? "expired" : "active";
      const yesNo = slot.isRented ? "是" : "否";
      return `<tr data-date="${escapeHtml(slot.date)}" data-time="${escapeHtml(slot.time)}">
<td>${escapeHtml(formatIsoDateWithWeekday(slot.date, result.timezone))}</td>
<td>${escapeHtml(slot.time)}</td>
<td>${escapeHtml(slot.court)}</td>
<td class="${statusClass}">${escapeHtml(slot.rawStatus)}</td>
<td>${yesNo}</td>
</tr>`;
    })
    .join("\n");
}

function buildDailyTabs(dates: string[], timezone: string): string {
  return dates
    .map((date, index) => {
      const activeClass = index === 0 ? " active" : "";
      return `<button class="day-tab${activeClass}" data-day="${escapeHtml(date)}" type="button">${escapeHtml(formatIsoDateWithWeekday(date, timezone))}</button>`;
    })
    .join("\n");
}

function buildDailyPanels(result: TodayCheckResult, dates: string[]): string {
  return dates
    .map((date, index) => {
      const activeClass = index === 0 ? " active" : "";
      const summaryRows = buildSummaryRows(result, date);
      const detailRows = buildDetailRows(result, date);
      const hasSummary = summaryRows.trim().length > 0;
      const hasDetail = detailRows.trim().length > 0;

      const formattedDate = formatIsoDateWithWeekday(date, result.timezone);

      return `<section class="day-panel${activeClass}" data-day="${escapeHtml(date)}">
  <h3>${escapeHtml(formattedDate)} 每日時段總覽</h3>
  <table>
    <thead>
      <tr><th>時間</th><th>可用數</th><th>天氣</th><th>可用場地(停止租借)</th><th>不可用場地</th></tr>
    </thead>
    <tbody>
      ${hasSummary ? summaryRows.replaceAll(`<td>${escapeHtml(formattedDate)}</td>\n`, "") : '<tr><td colspan="5">此日期目前無資料</td></tr>'}
      <tr class="daily-summary-empty" style="display:none;"><td colspan="5">此日期在目前時間範圍沒有符合資料</td></tr>
    </tbody>
  </table>
  <h3>${escapeHtml(formattedDate)} 各場地明細</h3>
  <table>
    <thead>
      <tr><th>時間</th><th>場地</th><th>狀態</th><th>是否已租借</th></tr>
    </thead>
    <tbody>
      ${hasDetail ? detailRows.replaceAll(`<td>${escapeHtml(formattedDate)}</td>\n`, "") : '<tr><td colspan="4">此日期目前無資料</td></tr>'}
      <tr class="daily-detail-empty" style="display:none;"><td colspan="4">此日期在目前時間範圍沒有符合資料</td></tr>
    </tbody>
  </table>
</section>`;
    })
    .join("\n");
}

function buildHtml(result: TodayCheckResult): string {
  const dateLabelMap = Object.fromEntries(
    result.dateRange.days.map((date) => [date, formatIsoDateWithWeekday(date, result.timezone)])
  );
  const timeLabels = result.timeSummary.map((ts) => `${dateLabelMap[ts.date] ?? ts.date} ${ts.time}`);
    const availableData = result.timeSummary.map((ts) => ts.available);
    const unavailableData = result.timeSummary.map((ts) => ts.total - ts.available);
    const timeStatusDetails = result.timeSummary.map((ts) => {
        const availableLines = ts.availableCourts.map(
            (court) => `✅ ${court}: 可用(停止租借)`
        );
        const unavailableLines = ts.unavailableCourts.map(
            (court) => `❌ ${court}: 不可用(已租借)`
        );
        return [...availableLines, ...unavailableLines];
    });
  const dayTabs = buildDailyTabs(result.dateRange.days, result.timezone);
  const dayPanels = buildDailyPanels(result, result.dateRange.days);
  const rangeSummaryRows = buildRangeSummaryRows(result);
  const rangeDetailRows = buildRangeDetailRows(result);
  const uniqueTimes = [...new Set(result.timeSummary.map((ts) => ts.time))].sort();
  const minTime = uniqueTimes[0] ?? "00:00";
  const maxTime = uniqueTimes[uniqueTimes.length - 1] ?? "23:59";

  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(result.venueName)} 未來 7 天時段報表</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
:root {
  --bg: #f5f7fb;
  --card: #ffffff;
  --text: #1f2937;
  --muted: #64748b;
  --ok: #2e7d32;
  --warn: #c62828;
  --line: #e5e7eb;
}
body {
  margin: 0;
  font-family: "Noto Sans TC", "Microsoft JhengHei", sans-serif;
  background: linear-gradient(180deg, #eef2ff 0%, var(--bg) 240px);
  color: var(--text);
}
.container {
  max-width: 1080px;
  margin: 24px auto;
  padding: 0 16px 24px;
}
.card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 8px 24px rgba(2, 6, 23, 0.05);
}
.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(120px, 1fr));
  gap: 12px;
}
.stat {
  background: #f8fafc;
  border-radius: 12px;
  padding: 12px;
}
.stat .label {
  color: var(--muted);
  font-size: 12px;
}
.stat .value {
  font-size: 24px;
  font-weight: 700;
}
.grid2 { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; }
.grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
@media (max-width: 900px) {
  .grid2, .grid3 { grid-template-columns: 1fr; }
  .stats { grid-template-columns: 1fr; }
}
.badge {
  position: relative;
  display: inline-block;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 600;
  margin: 1px;
}
.badge.ok { background: #dcfce7; color: #166534; }
.badge.warn { background: #fee2e2; color: #991b1b; }
.badge.na { background: #f1f5f9; color: var(--muted); }
.weather-badge {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  line-height: 1;
  cursor: help;
  border: 1px solid transparent;
  box-sizing: border-box;
}
.weather-unknown {
  background: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%);
  border-color: #cbd5e1;
}
.weather-sunny {
  background: linear-gradient(180deg, #fef9c3 0%, #fde68a 100%);
  border-color: #f59e0b;
}
.weather-partly-sunny {
  background: linear-gradient(180deg, #fef3c7 0%, #fde68a 100%);
  border-color: #f59e0b;
}
.weather-partly-cloudy {
  background: linear-gradient(180deg, #ecfeff 0%, #cffafe 100%);
  border-color: #06b6d4;
}
.weather-cloudy {
  background: linear-gradient(180deg, #e2e8f0 0%, #cbd5e1 100%);
  border-color: #94a3b8;
}
.weather-fog {
  background: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%);
  border-color: #94a3b8;
}
.weather-rain {
  background: linear-gradient(180deg, #dbeafe 0%, #bfdbfe 100%);
  border-color: #60a5fa;
}
.weather-thunder {
  background: linear-gradient(180deg, #ede9fe 0%, #ddd6fe 100%);
  border-color: #8b5cf6;
}
.weather-snow {
  background: linear-gradient(180deg, #f8fafc 0%, #dbeafe 100%);
  border-color: #93c5fd;
}
.weather-alert {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.18);
}
.weather-badge span, .weather-badge {
  font-size: 20px;
  line-height: 1;
}
.has-tip::after {
  content: attr(data-tip);
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.96);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.45;
  padding: 6px 8px;
  border-radius: 8px;
  white-space: nowrap;
  max-width: min(360px, 92vw);
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: keep-all;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.25);
  opacity: 0;
  pointer-events: none;
  visibility: hidden;
  transition: opacity 0.15s ease;
  z-index: 20;
}
.has-tip::before {
  content: "";
  position: absolute;
  left: 50%;
  bottom: calc(100% + 2px);
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: rgba(15, 23, 42, 0.96);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.15s ease;
  z-index: 20;
}
.has-tip:hover::after,
.has-tip:hover::before,
.has-tip:focus-visible::after,
.has-tip:focus-visible::before,
.has-tip.show-tip::after,
.has-tip.show-tip::before {
  opacity: 1;
  visibility: visible;
}
.has-tip {
  cursor: pointer;
}
.row-usable { background: #f0fdf4; }
.row-not-usable { background: #fff5f5; }
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
th, td {
  border-bottom: 1px solid var(--line);
  padding: 10px 8px;
  text-align: left;
}
.expired { color: var(--warn); font-weight: 700; }
.active { color: var(--ok); }
.meta {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.8;
}
.date-col {
  min-width: 110px;
}
.day-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.day-tab {
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #334155;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
}
.day-tab.active {
  border-color: #2563eb;
  background: #2563eb;
  color: #ffffff;
}
.day-panel {
  display: none;
}
.day-panel.active {
  display: block;
}
.mode-switch {
  display: inline-flex;
  gap: 8px;
  margin-bottom: 12px;
}
.mode-btn {
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #334155;
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
}
.mode-btn.active {
  border-color: #0f766e;
  background: #0f766e;
  color: #ffffff;
}
.mode-panel {
  display: none;
}
.mode-panel.active {
  display: block;
}
.range-filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(150px, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}
.filter-item {
  display: grid;
  gap: 6px;
  font-size: 13px;
  color: var(--muted);
}
.filter-item input {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 6px 8px;
  font: inherit;
  color: var(--text);
  background: #fff;
}
@media (max-width: 900px) {
  .range-filters {
    grid-template-columns: repeat(2, minmax(150px, 1fr));
  }
}
</style>
</head>
<body>
<div class="container">
  <div class="card">
    <h1>${escapeHtml(result.venueName)} 未來 7 天時段報表</h1>
    <div class="meta">
      <div>檢查時間: ${escapeHtml(result.checkedAt)}</div>
      <div>時區: ${escapeHtml(result.timezone)}</div>
      <div>查詢日期: ${escapeHtml(formatIsoDateWithWeekday(result.dateRange.startDate, result.timezone))} ~ ${escapeHtml(formatIsoDateWithWeekday(result.dateRange.endDate, result.timezone))}</div>
      <div>來源: <a href="${escapeHtml(result.venueUrl)}" target="_blank" rel="noreferrer">${escapeHtml(result.venueUrl)}</a></div>
    </div>
  </div>

  <div class="card stats">
    <div class="stat"><div class="label">總時段</div><div class="value">${result.totalSlots}</div></div>
    <div class="stat"><div class="label">可用（停止租借）</div><div class="value">${result.totalSlots - result.rentedSlots}</div></div>
    <div class="stat"><div class="label">不可用（已租借）</div><div class="value">${result.rentedSlots}</div></div>
  </div>

  <div class="grid2">
    <div class="card">
      <h2>各時段可用場地數（停止租借）</h2>
      <canvas id="stackedChart" height="120"></canvas>
    </div>
    <div class="card">
      <h2>比例（圓餅圖）</h2>
      <canvas id="ratioChart" height="120"></canvas>
    </div>
  </div>

  <div class="card">
    <h2>檢視模式</h2>
    <div class="mode-switch">
    <button type="button" class="mode-btn active" data-mode="daily">每日分頁</button>
      <button type="button" class="mode-btn" data-mode="range">區間總覽</button>
    </div>

    <section id="mode-daily" class="mode-panel active">
      <h3>每日分頁檢視</h3>
      <div class="range-filters">
        <label class="filter-item">起始時間
          <input id="dailyFilterStartTime" type="time" value="${escapeHtml(minTime)}" step="3600" />
        </label>
        <label class="filter-item">結束時間
          <input id="dailyFilterEndTime" type="time" value="${escapeHtml(maxTime)}" step="3600" />
        </label>
      </div>
      <div class="day-tabs">
        ${dayTabs}
      </div>
      ${dayPanels}
    </section>

    <section id="mode-range" class="mode-panel">
      <div class="range-filters">
        <label class="filter-item">起始日期
          <input id="filterStartDate" type="date" min="${escapeHtml(result.dateRange.startDate)}" max="${escapeHtml(result.dateRange.endDate)}" value="${escapeHtml(result.dateRange.startDate)}" />
        </label>
        <label class="filter-item">結束日期
          <input id="filterEndDate" type="date" min="${escapeHtml(result.dateRange.startDate)}" max="${escapeHtml(result.dateRange.endDate)}" value="${escapeHtml(result.dateRange.endDate)}" />
        </label>
        <label class="filter-item">起始時間
          <input id="filterStartTime" type="time" value="${escapeHtml(minTime)}" step="3600" />
        </label>
        <label class="filter-item">結束時間
          <input id="filterEndTime" type="time" value="${escapeHtml(maxTime)}" step="3600" />
        </label>
      </div>

      <h3>區間總覽：各日期時段場地可用彙總</h3>
      <table>
        <thead>
          <tr><th class="date-col">日期</th><th>時間</th><th>可用數</th><th>天氣</th><th>可用場地(停止租借)</th><th>不可用場地</th></tr>
        </thead>
        <tbody id="rangeSummaryBody">
          ${rangeSummaryRows}
          <tr id="rangeSummaryEmpty" style="display:none;"><td colspan="6">此區間沒有符合資料</td></tr>
        </tbody>
      </table>

      <h3>區間總覽：各場地明細</h3>
      <table>
        <thead>
          <tr><th class="date-col">日期</th><th>時間</th><th>場地</th><th>狀態</th><th>是否已租借</th></tr>
        </thead>
        <tbody id="rangeDetailBody">
          ${rangeDetailRows}
          <tr id="rangeDetailEmpty" style="display:none;"><td colspan="5">此區間沒有符合資料</td></tr>
        </tbody>
      </table>
    </section>
  </div>
</div>

<script>
const allSummary = ${JSON.stringify(result.timeSummary)};
const allSlots = ${JSON.stringify(result.slots)};
const dateLabelMap = ${JSON.stringify(dateLabelMap)};

const timeLabels = ${JSON.stringify(timeLabels)};
const availableData = ${JSON.stringify(availableData)};
const unavailableData = ${JSON.stringify(unavailableData)};
const timeStatusDetails = ${JSON.stringify(timeStatusDetails)};

const toDateNumber = (dateStr) => Number(dateStr.replaceAll("-", ""));
const toTimeNumber = (timeStr) => Number(timeStr.replaceAll(":", ""));

const isInSelectedTimeRange = (time, startTime, endTime) => {
  if (!startTime || !endTime) return true;
  const t = toTimeNumber(time);
  return t >= toTimeNumber(startTime) && t <= toTimeNumber(endTime);
};

const isInSelectedRange = (date, time) => {
  const startDate = document.getElementById("filterStartDate").value;
  const endDate = document.getElementById("filterEndDate").value;
  const startTime = document.getElementById("filterStartTime").value;
  const endTime = document.getElementById("filterEndTime").value;

  if (!startDate || !endDate || !startTime || !endTime) return true;

  const d = toDateNumber(date);
  const t = toTimeNumber(time);
  return d >= toDateNumber(startDate) && d <= toDateNumber(endDate) && t >= toTimeNumber(startTime) && t <= toTimeNumber(endTime);
};

const stackedChart = new Chart(document.getElementById("stackedChart"), {
  type: "bar",
  data: {
    labels: timeLabels,
    datasets: [
      { label: "可用場地數(停止租借)", data: availableData, backgroundColor: "#22c55e" },
      { label: "不可用場地數", data: unavailableData, backgroundColor: "#ef4444" }
    ]
  },
  options: {
    responsive: true,
    scales: {
      x: { stacked: true },
      y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } }
    },
    plugins: {
      legend: { position: "bottom" },
      tooltip: {
        callbacks: {
          afterBody: (items) => {
            const dataIndex = items[0]?.dataIndex ?? 0;
            const lines = timeStatusDetails[dataIndex] ?? [];
            return ["---", ...lines];
          }
        }
      }
    }
  }
});

const ratioChart = new Chart(document.getElementById("ratioChart"), {
  type: "doughnut",
  data: {
    labels: ["可用(停止租借)", "不可用(已租借)"],
    datasets: [{
      data: [${result.totalSlots - result.rentedSlots}, ${result.rentedSlots}],
      backgroundColor: ["#22c55e", "#ef4444"]
    }]
  },
  options: {
    responsive: true,
    plugins: { legend: { position: "bottom" } }
  }
});

const updateCharts = (filteredSummary) => {
  const labels = filteredSummary.map((ts) => (dateLabelMap[ts.date] ?? ts.date) + " " + ts.time);
  const available = filteredSummary.map((ts) => ts.available);
  const unavailable = filteredSummary.map((ts) => ts.total - ts.available);

  stackedChart.data.labels = labels;
  stackedChart.data.datasets[0].data = available;
  stackedChart.data.datasets[1].data = unavailable;
  stackedChart.options.plugins.tooltip.callbacks.afterBody = (items) => {
    const dataIndex = items[0]?.dataIndex ?? 0;
    const summary = filteredSummary[dataIndex];
    if (!summary) return ["---", "無資料"];
    const lines = [
      ...summary.availableCourts.map((court) => "✅ " + court + ": 可用(停止租借)"),
      ...summary.unavailableCourts.map((court) => "❌ " + court + ": 不可用(已租借)")
    ];
    return ["---", ...lines];
  };
  stackedChart.update();

  const totalAvailable = available.reduce((sum, value) => sum + value, 0);
  const totalUnavailable = unavailable.reduce((sum, value) => sum + value, 0);
  ratioChart.data.datasets[0].data = [totalAvailable, totalUnavailable];
  ratioChart.update();
};

const applyRangeFilter = () => {
  const summaryRows = document.querySelectorAll("#rangeSummaryBody tr[data-date]");
  const detailRows = document.querySelectorAll("#rangeDetailBody tr[data-date]");

  let summaryVisible = 0;
  let detailVisible = 0;

  for (const row of summaryRows) {
    const match = isInSelectedRange(row.dataset.date ?? "", row.dataset.time ?? "");
    row.style.display = match ? "" : "none";
    if (match) summaryVisible += 1;
  }

  for (const row of detailRows) {
    const match = isInSelectedRange(row.dataset.date ?? "", row.dataset.time ?? "");
    row.style.display = match ? "" : "none";
    if (match) detailVisible += 1;
  }

  document.getElementById("rangeSummaryEmpty").style.display = summaryVisible === 0 ? "" : "none";
  document.getElementById("rangeDetailEmpty").style.display = detailVisible === 0 ? "" : "none";

  const filteredSummary = allSummary.filter((ts) => isInSelectedRange(ts.date, ts.time));
  updateCharts(filteredSummary);
};

const applyDailyFilter = () => {
  const activeDayTab = document.querySelector(".day-tab.active");
  const activeDay = activeDayTab?.dataset.day;
  if (!activeDay) {
    updateCharts([]);
    return;
  }

  const startTimeInput = document.getElementById("dailyFilterStartTime");
  const endTimeInput = document.getElementById("dailyFilterEndTime");

  if (startTimeInput.value > endTimeInput.value) {
    endTimeInput.value = startTimeInput.value;
  }

  const startTime = startTimeInput.value;
  const endTime = endTimeInput.value;

  const panel = document.querySelector('.day-panel.active[data-day="' + activeDay + '"]');
  if (!panel) {
    updateCharts([]);
    return;
  }

  const summaryRows = panel.querySelectorAll(".daily-summary-row");
  const detailRows = panel.querySelectorAll(".daily-detail-row");
  const summaryEmptyRow = panel.querySelector(".daily-summary-empty");
  const detailEmptyRow = panel.querySelector(".daily-detail-empty");

  let summaryVisible = 0;
  let detailVisible = 0;

  for (const row of summaryRows) {
    const time = row.dataset.time ?? "";
    const match = isInSelectedTimeRange(time, startTime, endTime);
    row.style.display = match ? "" : "none";
    if (match) summaryVisible += 1;
  }

  for (const row of detailRows) {
    const time = row.dataset.time ?? "";
    const match = isInSelectedTimeRange(time, startTime, endTime);
    row.style.display = match ? "" : "none";
    if (match) detailVisible += 1;
  }

  if (summaryEmptyRow) {
    summaryEmptyRow.style.display = summaryVisible === 0 ? "" : "none";
  }
  if (detailEmptyRow) {
    detailEmptyRow.style.display = detailVisible === 0 ? "" : "none";
  }

  const filteredSummary = allSummary.filter(
    (ts) => ts.date === activeDay && isInSelectedTimeRange(ts.time, startTime, endTime)
  );
  updateCharts(filteredSummary);
};

const filterInputs = [
  document.getElementById("filterStartDate"),
  document.getElementById("filterEndDate"),
  document.getElementById("filterStartTime"),
  document.getElementById("filterEndTime")
];

for (const input of filterInputs) {
  input.addEventListener("change", () => {
    const startDateInput = document.getElementById("filterStartDate");
    const endDateInput = document.getElementById("filterEndDate");
    const startTimeInput = document.getElementById("filterStartTime");
    const endTimeInput = document.getElementById("filterEndTime");

    if (startDateInput.value > endDateInput.value) {
      endDateInput.value = startDateInput.value;
    }
    if (startTimeInput.value > endTimeInput.value) {
      endTimeInput.value = startTimeInput.value;
    }

    applyRangeFilter();
  });
}

// Mobile-friendly tooltip behavior: tap to toggle, tap elsewhere to close.
const tipTargets = document.querySelectorAll(".has-tip");
const clearTips = () => {
  for (const el of tipTargets) el.classList.remove("show-tip");
};

for (const el of tipTargets) {
  el.addEventListener("click", (event) => {
    event.stopPropagation();
    const shown = el.classList.contains("show-tip");
    clearTips();
    if (!shown) el.classList.add("show-tip");
  });
  el.addEventListener("blur", () => {
    el.classList.remove("show-tip");
  });
}

document.addEventListener("click", () => {
  clearTips();
});

const dayTabs = document.querySelectorAll(".day-tab");
const dayPanels = document.querySelectorAll(".day-panel");
const modeButtons = document.querySelectorAll(".mode-btn");
const modeRange = document.getElementById("mode-range");
const modeDaily = document.getElementById("mode-daily");
const dailyFilterStartTime = document.getElementById("dailyFilterStartTime");
const dailyFilterEndTime = document.getElementById("dailyFilterEndTime");

const setMode = (mode) => {
  for (const button of modeButtons) {
    button.classList.toggle("active", button.dataset.mode === mode);
  }
  modeRange.classList.toggle("active", mode === "range");
  modeDaily.classList.toggle("active", mode === "daily");

  if (mode === "daily") {
    applyDailyFilter();
  } else {
    applyRangeFilter();
  }
};

for (const button of modeButtons) {
  button.addEventListener("click", () => {
    setMode(button.dataset.mode);
  });
}

const setActiveDay = (date) => {
  for (const tab of dayTabs) {
    tab.classList.toggle("active", tab.dataset.day === date);
  }
  for (const panel of dayPanels) {
    panel.classList.toggle("active", panel.dataset.day === date);
  }
};

for (const tab of dayTabs) {
  tab.addEventListener("click", () => {
    const date = tab.dataset.day;
    if (!date) return;
    setActiveDay(date);
    if (modeDaily.classList.contains("active")) {
      applyDailyFilter();
    }
  });
}

dailyFilterStartTime.addEventListener("change", applyDailyFilter);
dailyFilterEndTime.addEventListener("change", applyDailyFilter);

applyRangeFilter();
</script>
</body>
</html>`;
}

export async function writeHtmlReport(
  result: TodayCheckResult,
  outputPath: string
): Promise<void> {
  const dir = path.dirname(outputPath);
  await fs.mkdir(dir, { recursive: true });
  const html = buildHtml(result);
  await fs.writeFile(outputPath, html, "utf8");
}
