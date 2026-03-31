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

The app supports two hourly weather providers and defaults to MET Norway.

Configure location in `.env`:

```env
WEATHER_PROVIDER=met-norway
MET_USER_AGENT=court-rental-checker/1.0 (contact: local-dev)
WEATHER_LAT=25.086
WEATHER_LON=121.507
```

- `WEATHER_PROVIDER`
    - `met-norway` (default): model baseline used by this project
    - `open-meteo`: compatible fallback provider
- `MET_USER_AGENT`: required by MET Norway API policy. Use a unique identifier for your app.

Provider normalization:

- Unified weather model uses `precipitationMm` as the rain metric.
- MET Norway provides precipitation amount directly.
- Open-Meteo estimates `precipitationMm` from weather type + precipitation probability.

Configure wetness model style in `.env`:

```env
WETNESS_PROFILE=balanced
WETNESS_LOOKBACK_HOURS=
WETNESS_THRESHOLD=
```

- `WETNESS_PROFILE`:
    - `conservative`: wetter for longer (`lookback=10`, `threshold=0.35`)
    - `balanced`: default (`lookback=8`, `threshold=0.45`)
    - `aggressive`: dries faster (`lookback=6`, `threshold=0.55`)
- `WETNESS_LOOKBACK_HOURS` (optional): override profile lookback hours (range `3-24`).
- `WETNESS_THRESHOLD` (optional): override profile threshold (range `0.1-0.95`).

If optional overrides are empty, profile defaults are used.

Recommended quick presets:

- Conservative (rain-sensitive, safer for slippery courts)
    - `WETNESS_PROFILE=conservative`
    - Optional fine-tune: `WETNESS_LOOKBACK_HOURS=10`, `WETNESS_THRESHOLD=0.35`
- Balanced (default)
    - `WETNESS_PROFILE=balanced`
    - Optional fine-tune: `WETNESS_LOOKBACK_HOURS=8`, `WETNESS_THRESHOLD=0.45`
- Aggressive (dries faster, less strict)
    - `WETNESS_PROFILE=aggressive`
    - Optional fine-tune: `WETNESS_LOOKBACK_HOURS=6`, `WETNESS_THRESHOLD=0.55`

Seasonal suggestion for Taipei:

- Spring/Plum-rain or Winter: start with `conservative`
- Stable weather period: start with `balanced`
- Hot Summer with quick surface drying: start with `aggressive` or keep `balanced` and raise threshold to `0.50`

### Court Wetted Decision Logic

The current `isWetted` logic uses a wetness-memory score model instead of a single-hour rule.

- Purpose: capture "rain has stopped but court is still wet" behavior.
- Output: final boolean `isWetted` for each slot.

Model summary:

1. Compute a wetness score over the latest 8 hours (including current hour).
2. For each hour, update score by:

     - Keep part of previous wetness: `previousScore * (1 - dryingFactor)`
     - Add current-hour rain impact: `rainInput`
     - Clamp score to `[0, 1]`

3. Convert score to boolean:

    - `wetScore >= threshold` -> `isWetted = true`
    - `wetScore < threshold` -> `isWetted = false`

Default threshold by profile:

    - `conservative`: `0.35`
    - `balanced`: `0.45`
    - `aggressive`: `0.55`

Definitions:

- `rainInput` combines weather text and precipitation probability.
    - Rain-like text (`雨`, `陣雨`, `雷雨`, `毛毛雨`, `凍雨`) contributes fixed wetness.
    - Precipitation probability contributes additional wetness.
- `dryingFactor` depends on temperature.
    - Higher temperature -> faster drying.
    - Value is constrained to a safe range to avoid extreme jumps.

Fallback behavior:

- If current-hour weather data is fully missing, the model keeps conservative behavior and treats the slot as wetted.
- Time lookup is cross-day, so early-morning slots can still reference previous-night rain.

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
- [ ] 調整可使用場地，可以動態調整自己預約的場地的文字
- [x] 分成以天或以周顯示
- [x] 以使用者開啟頁面的日期及時間作為起始的篩選條件
    - 修正一開始圖表沒有符合當天時間而是整個區間
- [ ] 新增以有沒有空場及場地是否溼或2個一起的篩選條件
- [x] 新增以有沒有空場及場地是否溼滑來顯示不同的顏色
- [x] 修正下個月的資訊沒有抓到問題
- [ ] 修正月底最後一日狀態抓到 comment info 問題
- [x] 手機版面 fit content
- [x] 可以抓不同場地的資料
- [x] 加入各時段天氣
- [x] 依照天氣及是否有租借判斷場地是否可以使用，判斷依據
    - [ ]在做更細微的調整判斷
    - [x]該時段有沒有被租借
    - [x]場地溼滑以 8 小時濕度記憶分數模型判定（含跨日回溯與溫度乾燥係數）
    
