import fs from "node:fs/promises";
import path from "node:path";
import type { TodayCheckResult } from "../types/schedule.js";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildRows(result: TodayCheckResult): string {
  return result.slots
    .map((slot) => {
      const statusClass = slot.isExpiredStopRent ? "expired" : "active";
      const yesNo = slot.isExpiredStopRent ? "是" : "否";
      return `<tr>
<td>${escapeHtml(slot.time)}</td>
<td class="${statusClass}">${escapeHtml(slot.rawStatus)}</td>
<td>${yesNo}</td>
</tr>`;
    })
    .join("\n");
}
function buildSummaryRows(result: TodayCheckResult): string {
    return result.timeSummary
        .map((ts) => {
            const ratio = `${ts.available} / ${ts.total}`;
            const available =
                ts.availableCourts.length > 0
                    ? ts.availableCourts.map((c) => `<span class="badge ok">${escapeHtml(c)}</span>`).join(" ")
                    : '<span class="badge na">無可用</span>';
            const unavailable =
                ts.unavailableCourts.length > 0
                    ? ts.unavailableCourts.map((c) => `<span class="badge warn">${escapeHtml(c)}</span>`).join(" ")
                    : "—";
            const rowClass = ts.available === 0 ? "row-expired" : ts.available === ts.total ? "row-full" : "row-partial";
            return `<tr class="${rowClass}">
<td>${escapeHtml(ts.time)}</td>
<td>${ratio}</td>
<td>${available}</td>
<td>${unavailable}</td>
</tr>`;
        })
        .join("\n");
}

function buildDetailRows(result: TodayCheckResult): string {
    return result.slots
        .slice()
        .sort((a, b) => a.time.localeCompare(b.time) || a.court.localeCompare(b.court))
        .map((slot) => {
            const statusClass = slot.isExpiredStopRent ? "expired" : "active";
            const yesNo = slot.isExpiredStopRent ? "是" : "否";
            return `<tr>
<td>${escapeHtml(slot.time)}</td>
<td>${escapeHtml(slot.court)}</td>
<td class="${statusClass}">${escapeHtml(slot.rawStatus)}</td>
<td>${yesNo}</td>
</tr>`;
        })
        .join("\n");
}

function buildHtml(result: TodayCheckResult): string {
    const timeLabels = result.timeSummary.map((ts) => ts.time);
    const availableData = result.timeSummary.map((ts) => ts.available);
    const unavailableData = result.timeSummary.map((ts) => ts.total - ts.available);
    const courtColors = ["#6366f1", "#22c55e", "#f59e0b", "#3b82f6", "#ec4899"];
    const courtNames = result.courts;
    // Per-court dataset for grouped bar (1 = expired, 0 = available within a court)
    const courtDatasets = courtNames.map((court, idx) => {
        const data = result.timeSummary.map((ts) =>
            ts.unavailableCourts.includes(court) ? 1 : 0
        );
        return {
            label: court,
            data,
            backgroundColor: courtColors[idx % courtColors.length]
        };
    });

  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Court Rental 報表</title>
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
.row-expired { background: #fff5f5; }
.row-full { background: #f0fdf4; }
.row-partial { background: #fffbeb; }
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
</style>
</head>
<body>
<div class="container">
  <div class="card">
    <h1>Court Rental 今日時段報表</h1>
    <div class="meta">
      <div>檢查時間: ${escapeHtml(result.checkedAt)}</div>
      <div>時區: ${escapeHtml(result.timezone)}</div>
      <div>來源: <a href="${escapeHtml(result.venueUrl)}" target="_blank" rel="noreferrer">${escapeHtml(result.venueUrl)}</a></div>
    </div>
  </div>

  <div class="card stats">
    <div class="stat"><div class="label">總時段</div><div class="value">${result.totalSlots}</div></div>
    <div class="stat"><div class="label">已過期/停止租借</div><div class="value">${result.expiredSlots}</div></div>
    <div class="stat"><div class="label">其他狀態</div><div class="value">${result.totalSlots - result.expiredSlots}</div></div>
  </div>

  <div class="grid2">
    <div class="card">
      <h2>各時段可用場地數（堆疊長條圖）</h2>
      <canvas id="stackedChart" height="120"></canvas>
    </div>
    <div class="card">
      <h2>比例（圓餅圖）</h2>
      <canvas id="ratioChart" height="120"></canvas>
    </div>
  </div>

  <div class="card">
    <h2>各時段場地可用彙總</h2>
    <table>
      <thead>
        <tr><th>時間</th><th>可用數</th><th>可用場地</th><th>停止租借場地</th></tr>
      </thead>
      <tbody>
        ${buildSummaryRows(result)}
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2>各場地時段明細</h2>
    <table>
      <thead>
        <tr><th>時間</th><th>場地</th><th>狀態</th><th>已過期/停止租借</th></tr>
      </thead>
      <tbody>
        ${buildDetailRows(result)}
      </tbody>
    </table>
  </div>
</div>

<script>
const timeLabels = ${JSON.stringify(timeLabels)};
const availableData = ${JSON.stringify(availableData)};
const unavailableData = ${JSON.stringify(unavailableData)};
const courtDatasets = ${JSON.stringify(courtDatasets)};

new Chart(document.getElementById("stackedChart"), {
  type: "bar",
  data: {
    labels: timeLabels,
    datasets: [
      { label: "可用場地數", data: availableData, backgroundColor: "#22c55e" },
      { label: "停止租借場地數", data: unavailableData, backgroundColor: "#ef4444" }
    ]
  },
  options: {
    responsive: true,
    scales: {
      x: { stacked: true },
      y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } }
    },
    plugins: { legend: { position: "bottom" } }
  }
});

new Chart(document.getElementById("ratioChart"), {
  type: "doughnut",
  data: {
    labels: ["已過期/停止租借", "其他狀態"],
    datasets: [{
      data: [${result.expiredSlots}, ${result.totalSlots - result.expiredSlots}],
      backgroundColor: ["#ef4444", "#22c55e"]
    }]
  },
  options: {
    responsive: true,
    plugins: { legend: { position: "bottom" } }
  }
});
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
