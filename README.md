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

## Scripts

- `npm run dev`
- `npm run check:today`
- `npm run schedule`
- `npm run test`
- `npm run lint`
- `npm run format`
