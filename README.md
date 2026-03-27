# Court Rental Checker

TypeScript tool that checks today's timeslots on Taipei VBS venue page and marks whether each slot is "expired / stop-rent".

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
- `output/today-status.html` (visual chart report)

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

## Scripts

- `npm run dev`
- `npm run check:today`
- `npm run schedule`
- `npm run test`
- `npm run lint`
- `npm run format`


## Roadmap

- 可以發佈成 github page （爬蟲用使用者自己瀏覽器的,會被 CROS 擋）
    - 改抓資料使用 github action
    - 顯示這些資料用 github page
- 分成以天或以周顯示
- 可以抓不同場地的資料
- 加入各時段天氣
- 依照天氣及是否有租借判斷場地是否可以使用
