import fs from "node:fs/promises";
import path from "node:path";
import type { TodayCheckResult } from "../types/schedule.js";
import type { TimeSlotSummary } from "../types/schedule.js";
import { formatIsoDateWithWeekday } from "../utils/time.js";
import {
    buildWeatherTooltipText,
  formatWetScore,
  getWeatherBadgeClassName,
  getWeatherTelegramIcon
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
  precipitationProbability?: number,
  wetScore?: number
): string {
  const title = buildWeatherTooltipText(weatherText, temperatureC, precipitationProbability, wetScore);
    const classes = getWeatherBadgeClassName(weatherText, precipitationProbability);
    return `<span class="${classes} has-tip" data-tip="${escapeHtml(title)}" tabindex="0" role="button">${getWeatherTelegramIcon(weatherText)}</span>`;
}

function getRowClass(ts: TimeSlotSummary): string {
  const isWetted = ts.isWetted ?? true;
  const hasAvailability = ts.available > 0;
  if (hasAvailability && !isWetted) return "row-playable";
  if (hasAvailability && isWetted) return "row-available-wet";
  if (!hasAvailability && !isWetted) return "row-unavailable-dry";
  return "row-unavailable-wet";
}

function getWetScoreRiskClass(wetScore?: number): string {
  if (wetScore == null) return "wet-score-unknown";
  if (wetScore < 0.35) return "wet-score-low";
  if (wetScore < 0.55) return "wet-score-mid";
  return "wet-score-high";
}

function buildWetScoreBadge(wetScore?: number): string {
  const riskClass = getWetScoreRiskClass(wetScore);
  return `<span class="wet-score-badge ${riskClass}">${escapeHtml(formatWetScore(wetScore))}</span>`;
}

function buildSummaryRows(result: TodayCheckResult, targetDate?: string): string {
  return result.timeSummary
    .filter((ts) => (targetDate ? ts.date === targetDate : true))
    .map((ts) => {
            const weatherBadge = buildWeatherBadge(
                ts.weatherText,
                ts.temperatureC,
              ts.precipitationProbability,
              ts.wetScore
            );
      const wetScore = buildWetScoreBadge(ts.wetScore);
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
      const rowClass = getRowClass(ts);
      return `<tr class="daily-summary-row ${rowClass}" data-date="${escapeHtml(ts.date)}" data-time="${escapeHtml(ts.time)}">
<td>${escapeHtml(formatIsoDateWithWeekday(ts.date, result.timezone))}</td>
<td>${escapeHtml(ts.time)}</td>
          <td>${weatherBadge}</td>
<td>${wetScore}</td>
<td>${available}</td>
<td>${unavailable}</td>
</tr>`;
        })
        .join("\n");
}

function buildRangeSummaryRows(result: TodayCheckResult): string {
  return result.timeSummary
    .map((ts) => {
      const weatherBadge = buildWeatherBadge(
        ts.weatherText,
        ts.temperatureC,
        ts.precipitationProbability,
        ts.wetScore
      );
      const wetScore = buildWetScoreBadge(ts.wetScore);
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
      const rowClass = getRowClass(ts);
      return `<tr class="${rowClass}" data-date="${escapeHtml(ts.date)}" data-time="${escapeHtml(ts.time)}" data-available="${ts.available}" data-total="${ts.total}">
      <td data-label="日期">${buildRangeDateCell(ts.date, result.timezone)}</td>
    <td data-label="時間">${escapeHtml(ts.time)}</td>
    <td data-label="天氣">${weatherBadge}</td>
    <td data-label="場地溼度">${wetScore}</td>
    <td data-label="可用場地(停止租借)">${available}</td>
    <td data-label="不可用場地">${unavailable}</td>
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
    <td data-label="日期">${buildRangeDateCell(slot.date, result.timezone)}</td>
    <td data-label="時間">${escapeHtml(slot.time)}</td>
    <td data-label="場地">${escapeHtml(slot.court)}</td>
    <td data-label="狀態" class="${statusClass}">${escapeHtml(slot.rawStatus)}</td>
    <td data-label="是否已租借">${yesNo}</td>
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

function buildRangeDateCell(isoDate: string, timezone: string): string {
  const label = formatIsoDateWithWeekday(isoDate, timezone);
  const matched = label.match(/^(\d{4}-\d{2}-\d{2})\s+(\(.+\))$/);
  if (!matched) {
    return escapeHtml(label);
  }

  return `<span class="range-date-wrap"><span class="range-date-main">${escapeHtml(matched[1])}</span><span class="range-date-week">${escapeHtml(matched[2])}</span></span>`;
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
      <tr><th>時間</th><th>天氣</th><th>場地溼度</th><th>可用場地(停止租借)</th><th>不可用場地</th></tr>
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
.wet-score-badge {
  display: inline-block;
  min-width: 52px;
  text-align: center;
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid transparent;
}
.wet-score-low {
  background: #dcfce7;
  color: #166534;
  border-color: #86efac;
}
.wet-score-mid {
  background: #ffedd5;
  color: #9a3412;
  border-color: #fdba74;
}
.wet-score-high {
  background: #fee2e2;
  color: #991b1b;
  border-color: #fca5a5;
}
.wet-score-unknown {
  background: #f1f5f9;
  color: #475569;
  border-color: #cbd5e1;
}
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
/* 列背景色：溼滑 × 空場 × 適打 四態 */
.row-playable       { background: #f0fdf4; } /* 不溼 + 有空場 → 適合打球 */
.row-available-wet  { background: #e6eef5; } /* 溼滑 + 有空場 → 有場但場地溼 */
.row-unavailable-dry{ background: #fff1f2; } /* 不溼 + 無空場 → 場乾但全租 */
.row-unavailable-wet{ background: #fff1f2; } /* 溼滑 + 無空場 → 不適合 */
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

.range-date-wrap {
  display: inline;
}

.range-date-main,
.range-date-week {
  display: inline;
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

.table-wrap {
  width: 100%;
  overflow-x: auto;
}

.table-wrap table {
  min-width: 760px;
}

.range-table td {
  vertical-align: top;
}
.range-overview-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;
  padding: 10px;
  margin-bottom: 14px;
}
.range-overview-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: baseline;
  margin-bottom: 8px;
}
.range-overview-title {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}
.range-overview-meta {
  font-size: 12px;
  color: var(--muted);
}
.range-overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 8px;
}
.range-overview-slot {
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: #fff;
  padding: 8px;
}
.range-overview-slot-none {
  background: #f8fafc;
  border-color: #cbd5e1;
}
.range-overview-slot-partial {
  background: #fff7ed;
  border-color: #fdba74;
}
.range-overview-slot-full {
  background: #ecfdf3;
  border-color: #86efac;
}
.range-overview-slot-time {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}
.range-overview-slot-ratio {
  margin-top: 2px;
  font-size: 12px;
  color: #334155;
}
.range-overview-dates {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.range-overview-date {
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #1e293b;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 12px;
  line-height: 1.5;
  cursor: pointer;
}
.range-overview-date:hover {
  border-color: #2563eb;
  color: #1d4ed8;
}
.range-overview-date:focus-visible {
  outline: 2px solid #93c5fd;
  outline-offset: 1px;
}
.range-overview-date.is-collapsed {
  display: none;
}
.range-overview-slot.is-expanded .range-overview-date.is-collapsed {
  display: inline-flex;
}
.range-overview-toggle {
  margin-top: 8px;
  border: 0;
  background: transparent;
  color: #2563eb;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
}
.range-overview-toggle:hover {
  text-decoration: underline;
}
.range-overview-slot-empty-text {
  color: var(--muted);
  font-size: 12px;
}
.range-focus {
  animation: rangeFocusFlash 1.2s ease;
}
@keyframes rangeFocusFlash {
  0% { box-shadow: inset 0 0 0 0 rgba(37, 99, 235, 0.0); }
  30% { box-shadow: inset 0 0 0 999px rgba(37, 99, 235, 0.14); }
  100% { box-shadow: inset 0 0 0 0 rgba(37, 99, 235, 0.0); }
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

  .range-date-wrap {
    display: inline-flex;
    flex-direction: column;
    gap: 2px;
    line-height: 1.2;
  }

  .range-date-week {
    color: var(--muted);
  }
}

.chart-desktop {
  display: block;
}

.chart-mobile-list {
  display: none;
  gap: 10px;
}

.mini-slot-card {
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 12px;
  padding: 10px 12px;
}

.mini-slot-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  margin-bottom: 8px;
}

.mini-slot-time {
  font-size: 13px;
  color: #334155;
  font-weight: 600;
}

.mini-slot-ratio {
  font-size: 12px;
  color: #0f172a;
  font-weight: 700;
}

.mini-slot-bar {
  width: 100%;
  height: 10px;
  border-radius: 999px;
  background: #e2e8f0;
  overflow: hidden;
}

.mini-slot-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%);
}

.mini-slot-meta {
  margin-top: 8px;
  color: #64748b;
  font-size: 12px;
}

@media (max-width: 768px) {
  .chart-desktop {
    display: none;
  }

  .chart-mobile-list {
    display: grid;
  }

  .table-wrap {
    overflow: visible;
  }

  .table-wrap table {
    min-width: 0;
  }

  .range-table thead {
    display: none;
  }

  .range-table tbody {
    display: grid;
    gap: 10px;
  }

  .range-table tr[data-date] {
    display: grid;
    gap: 6px;
    padding: 10px;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: #ffffff;
  }

  .range-table td {
    display: grid;
    grid-template-columns: 108px 1fr;
    gap: 8px;
    border-bottom: 0;
    padding: 2px 0;
    align-items: start;
  }

  .range-table td::before {
    content: attr(data-label);
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
    line-height: 1.4;
  }

  .range-table td[data-label="天氣"] {
    align-items: center;
  }

  .range-table tr#rangeSummaryEmpty,
  .range-table tr#rangeDetailEmpty {
    display: table-row;
    border: 0;
    padding: 0;
    background: transparent;
  }

  .range-table tr#rangeSummaryEmpty td,
  .range-table tr#rangeDetailEmpty td {
    display: table-cell;
    padding: 10px 8px;
  }

  .range-table tr#rangeSummaryEmpty td::before,
  .range-table tr#rangeDetailEmpty td::before {
    content: none;
  }

  .range-overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
      <div class="chart-desktop">
        <canvas id="stackedChart" height="120"></canvas>
      </div>
      <div id="mobileChartList" class="chart-mobile-list" aria-label="各時段可用場地數卡片"></div>
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

      <div class="range-overview-card">
        <div class="range-overview-head">
          <div class="range-overview-title">空場時段速覽</div>
          <div id="rangeOverviewMeta" class="range-overview-meta"></div>
        </div>
        <div id="rangeAvailabilityOverview" class="range-overview-grid"></div>
      </div>

      <h3>區間總覽：各日期時段場地可用彙總</h3>
      <div class="table-wrap">
        <table class="range-table">
          <thead>
            <tr><th class="date-col">日期</th><th>時間</th><th>天氣</th><th>場地溼度</th><th>可用場地(停止租借)</th><th>不可用場地</th></tr>
          </thead>
          <tbody id="rangeSummaryBody">
            ${rangeSummaryRows}
            <tr id="rangeSummaryEmpty" style="display:none;"><td colspan="6">此區間沒有符合資料</td></tr>
          </tbody>
        </table>
      </div>

      <h3>區間總覽：各場地明細</h3>
      <div class="table-wrap">
        <table class="range-table">
          <thead>
            <tr><th class="date-col">日期</th><th>時間</th><th>場地</th><th>狀態</th><th>是否已租借</th></tr>
          </thead>
          <tbody id="rangeDetailBody">
            ${rangeDetailRows}
            <tr id="rangeDetailEmpty" style="display:none;"><td colspan="5">此區間沒有符合資料</td></tr>
          </tbody>
        </table>
      </div>
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
const formatDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
};
const formatTimeInputValue = (date) => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return hours + ":" + minutes;
};
const clampRangeValue = (value, min, max) => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const toCompactDateChipLabel = (date) => {
  const fullLabel = dateLabelMap[date] ?? date;
  const matched = fullLabel.match(/^(\d{4}-)?(\d{2}-\d{2})\s*\((週.)\)$/);
  if (matched) {
    return matched[2] + " " + matched[3];
  }

  const weekdayMatched = fullLabel.match(/^\d{4}-\d{2}-\d{2}\s*\((週.)\)$/);
  if (weekdayMatched) {
    return date.slice(5) + " " + weekdayMatched[1];
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date.slice(5);
  }

  return fullLabel;
};

const initializeDefaultFiltersFromNow = () => {
  const now = new Date();
  const nowDateValue = formatDateInputValue(now);
  const nowTimeValue = formatTimeInputValue(now);

  const startDateInput = document.getElementById("filterStartDate");
  const endDateInput = document.getElementById("filterEndDate");
  const startTimeInput = document.getElementById("filterStartTime");
  const endTimeInput = document.getElementById("filterEndTime");
  const dailyStartTimeInput = document.getElementById("dailyFilterStartTime");
  const dailyEndTimeInput = document.getElementById("dailyFilterEndTime");

  const minDate = startDateInput.min;
  const maxDate = endDateInput.max;
  const maxTime = endTimeInput.value;

  const clampedDate = clampRangeValue(nowDateValue, minDate, maxDate);
  const clampedTime = clampRangeValue(nowTimeValue, startTimeInput.value, maxTime);

  startDateInput.value = clampedDate;
  startTimeInput.value = clampedTime;
  dailyStartTimeInput.value = clampRangeValue(nowTimeValue, dailyStartTimeInput.value, dailyEndTimeInput.value);

  if (startDateInput.value > endDateInput.value) {
    endDateInput.value = startDateInput.value;
  }
  if (startTimeInput.value > endTimeInput.value) {
    endTimeInput.value = startTimeInput.value;
  }
  if (dailyStartTimeInput.value > dailyEndTimeInput.value) {
    dailyEndTimeInput.value = dailyStartTimeInput.value;
  }
};

const renderMobileChartCards = (filteredSummary) => {
  const container = document.getElementById("mobileChartList");
  if (!container) return;

  if (!filteredSummary || filteredSummary.length === 0) {
    container.innerHTML = '<div class="mini-slot-card"><div class="mini-slot-meta">目前條件下無資料</div></div>';
    return;
  }

  const cards = filteredSummary.map((ts) => {
    const total = Number(ts.total) || 0;
    const available = Number(ts.available) || 0;
    const percent = total > 0 ? Math.round((available / total) * 100) : 0;
    const label = (dateLabelMap[ts.date] ?? ts.date) + " " + ts.time;

    return '<article class="mini-slot-card">'
      + '<div class="mini-slot-head">'
      + '<div class="mini-slot-time">' + label + '</div>'
      + '<div class="mini-slot-ratio">' + available + ' / ' + total + '</div>'
      + '</div>'
      + '<div class="mini-slot-bar"><div class="mini-slot-fill" style="width:' + percent + '%"></div></div>'
      + '<div class="mini-slot-meta">可用率 ' + percent + '%</div>'
      + '</article>';
  });

  container.innerHTML = cards.join("");
};

const renderRangeAvailabilityOverview = (filteredSummary) => {
  const container = document.getElementById("rangeAvailabilityOverview");
  const meta = document.getElementById("rangeOverviewMeta");
  if (!container || !meta) return;

  if (!filteredSummary || filteredSummary.length === 0) {
    meta.textContent = "目前篩選：0 個時段";
    container.innerHTML = '<div class="range-overview-slot range-overview-slot-none"><div class="range-overview-slot-empty-text">目前條件下無資料</div></div>';
    return;
  }

  const totalsByTime = new Map();
  const availableByTime = new Map();
  const availableDatesByTime = new Map();

  for (const ts of filteredSummary) {
    totalsByTime.set(ts.time, (totalsByTime.get(ts.time) ?? 0) + 1);
    if (Number(ts.available) > 0) {
      availableByTime.set(ts.time, (availableByTime.get(ts.time) ?? 0) + 1);
      const dates = availableDatesByTime.get(ts.time) ?? new Set();
      dates.add(ts.date);
      availableDatesByTime.set(ts.time, dates);
    }
  }

  const allTimes = Array.from(totalsByTime.keys()).sort();
  const availableTimeCount = allTimes.filter((time) => (availableByTime.get(time) ?? 0) > 0).length;
  meta.textContent = "目前篩選：" + availableTimeCount + " / " + allTimes.length + " 個時段有空場";

  const cards = allTimes.map((time) => {
    const availableHits = availableByTime.get(time) ?? 0;
    const totalHits = totalsByTime.get(time) ?? 0;
    const availableDates = Array.from(availableDatesByTime.get(time) ?? []).sort();
    const collapseThreshold = 3;
    let slotClass = "range-overview-slot range-overview-slot-none";
    if (availableHits > 0 && availableHits < totalHits) {
      slotClass = "range-overview-slot range-overview-slot-partial";
    } else if (availableHits > 0 && availableHits === totalHits) {
      slotClass = "range-overview-slot range-overview-slot-full";
    }

    let datesMarkup = '<div class="range-overview-slot-empty-text">無空場日期</div>';
    if (availableDates.length > 0) {
      const dateButtons = availableDates
        .map((date, index) => {
          const collapsedClass = index >= collapseThreshold ? " is-collapsed" : "";
          const label = toCompactDateChipLabel(date);
          return '<button type="button" class="range-overview-date' + collapsedClass + '" data-time="' + time + '" data-date="' + date + '">' + label + '</button>';
        })
        .join("");

      const toggleMarkup = availableDates.length > collapseThreshold
        ? '<button type="button" class="range-overview-toggle" data-expand-label="顯示更多" data-collapse-label="收合">顯示更多</button>'
        : "";

      datesMarkup = '<div class="range-overview-dates">' + dateButtons + '</div>' + toggleMarkup;
    }

    return '<div class="' + slotClass + '">' +
      '<div class="range-overview-slot-time">' + time + '</div>' +
      '<div class="range-overview-slot-ratio">有空場天數：' + availableHits + ' / ' + totalHits + '</div>' +
      datesMarkup +
      '</div>';
  });

  container.innerHTML = cards.join("");
};

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

  renderMobileChartCards(filteredSummary);

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
  renderRangeAvailabilityOverview(filteredSummary);
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

const focusRangeSummaryRow = (date, time) => {
  const selector = '#rangeSummaryBody tr[data-date="' + date + '"][data-time="' + time + '"]';
  const target = document.querySelector(selector);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.classList.add("range-focus");
  window.setTimeout(() => target.classList.remove("range-focus"), 1400);
};

const rangeAvailabilityOverview = document.getElementById("rangeAvailabilityOverview");
if (rangeAvailabilityOverview) {
  rangeAvailabilityOverview.addEventListener("click", (event) => {
    const toggleButton = event.target.closest(".range-overview-toggle");
    if (toggleButton) {
      const card = toggleButton.closest(".range-overview-slot");
      if (!card) return;

      const expanded = card.classList.toggle("is-expanded");
      const expandLabel = toggleButton.getAttribute("data-expand-label") ?? "顯示更多";
      const collapseLabel = toggleButton.getAttribute("data-collapse-label") ?? "收合";
      toggleButton.textContent = expanded ? collapseLabel : expandLabel;
      return;
    }

    const dateButton = event.target.closest(".range-overview-date");
    if (!dateButton) return;

    const date = dateButton.getAttribute("data-date");
    const time = dateButton.getAttribute("data-time");
    if (!date || !time) return;

    focusRangeSummaryRow(date, time);
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

initializeDefaultFiltersFromNow();

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

const syncDailyViewToStartDate = () => {
  const startDateInput = document.getElementById("filterStartDate");
  const selectedDate = startDateInput.value;
  if (!selectedDate) return;

  const targetTab = Array.from(dayTabs).find((tab) => tab.dataset.day === selectedDate);
  if (targetTab) {
    setActiveDay(selectedDate);
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

syncDailyViewToStartDate();
applyRangeFilter();
if (modeDaily.classList.contains("active")) {
  applyDailyFilter();
}
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
