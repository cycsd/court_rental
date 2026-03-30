# Court Rental Checker

TypeScript tool that checks today's timeslots on Taipei VBS venue page and marks whether each slot is "expired / stop-rent".

Current behavior: fetches data for today plus the next 6 days (7 days total).

## Quick Start

1. Install dependencies:

```bash
npm install
npx playwright install
```

2. Create env file:

```bash
copy .env.example .env
```

3. Run once:

```bash
npm run check:today
```

Or start local scheduler (default at 06:00, 12:00, 18:00 every day):

```bash
npm run schedule
```

Optional custom cron expression:

```bash
set CRON_EXPR=0 */2 * * *
npm run schedule
```

4. Output JSON is written to:

- `output/today-status.json`
- `output/today-status.html` (7-day visual chart report)

## Notifications

Notifications are optional and can be enabled independently.

### Telegram

Set in `.env`:

```env
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=123456789
```

### Email (SMTP)

Set in `.env`:

```env
EMAIL_ENABLED=true
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_SECURE=false
EMAIL_SMTP_USER=your_account@gmail.com
EMAIL_SMTP_PASS=your_app_password
EMAIL_FROM=your_account@gmail.com
EMAIL_TO=receiver1@example.com,receiver2@example.com
```

If both are enabled, the app sends both notifications after each check.

## Visual Report

The app generates an HTML chart report every run.

- Default path: `output/today-status.html`
- Configure path via `.env`:

```env
OUTPUT_HTML=output/today-status.html
```

## Weather Data

The app fetches hourly weather from Open-Meteo (no API key required) and shows it per time slot in both Console and HTML summary table.

Configure location in `.env`:

```env
WEATHER_LAT=25.086
WEATHER_LON=121.507
```

## Scripts

- `npm run dev`
- `npm run check:today`
- `npm run schedule`
- `npm run test`
- `npm run lint`
- `npm run format`

## GitHub Actions + Pages

This repository can run a daily scrape on GitHub Actions and deploy the generated report to `gh-pages`.

Workflow file:

- `.github/workflows/daily-scrape-gh-pages.yml`

Behavior:

- Runs every day at 11:00 (Asia/Taipei).
- Also supports manual trigger via `workflow_dispatch`.
- Executes `npm run check:today` to generate:
    - `output/today-status.html`
    - `output/today-status.json`
- Deploys to `gh-pages` branch:
    - `index.html` (same content as `today-status.html`)
    - `today-status.html`
    - `today-status.json`

Setup steps:

1. Push this repository to GitHub.
2. In GitHub repository settings, go to `Pages` and set source branch to `gh-pages`.
3. (Optional) Configure repository variables in `Settings -> Secrets and variables -> Actions -> Variables`:
     - `VENUE_URL`
     - `TIMEZONE`
     - `WEATHER_LAT`
     - `WEATHER_LON`
4. Run workflow once manually from `Actions` tab to initialize first deployment.

Notes:

- If variables are not set, defaults are used (`VENUE_URL=https://vbs.sports.taipei/venues/?K=1042#Schedule`, `TIMEZONE=Asia/Taipei`).
- Notifications are disabled in CI by default (`TELEGRAM_ENABLED=false`, `EMAIL_ENABLED=false`).


## Roadmap

- 可以發佈成 github page （爬蟲用使用者自己瀏覽器的,會被 CROS 擋）
    - 改抓資料使用 github action
    - 顯示這些資料用 github page
- [ ] 調整可使用場地，可以動態調整自己預約的文字
- [x] 分成以天或以周顯示
- [x] 以使用者開啟頁面的日期及時間作為起始的篩選條件
    - 修正一開始圖表沒有符合當天時間而是整個區間
- [ ] 新增以有沒有空場及場地是否溼或2個一起的篩選條件
- [ ]修正下個月的資訊沒有抓到問題
- [ ] 修正月底最後一日狀態抓到 comment info 問題
- [ ] 手機版面 fit content
- [x] 可以抓不同場地的資料
- [x] 加入各時段天氣
- [ ] 依照天氣及是否有租借判斷場地是否可以使用，判斷依據
    - [ ]在做更細微的調整判斷
    - [x]該時段有沒有被租借
    - [x]該時段沒有下雨且前5個小時都不能下雨且溫度需要超過23度
    
