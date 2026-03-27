# Court Rental 自動查詢專案規劃（TypeScript）

## 1. 目標

建立一個 TypeScript 專案，自動查詢下列頁面今天各時段狀態，判斷是否為「已過期 停止租借」。

- 目標頁面：https://vbs.sports.taipei/venues/?K=1042#Schedule
- 查詢範圍：今天（Asia/Taipei）
- 判斷條件：狀態文字包含「已過期」或「停止租借」

---

## 2. 功能範圍（MVP）

1. 自動開啟場地頁面，載入「場地時段 Schedule」資料。
2. 解析今天日期下的每筆時段。
3. 對每個時段輸出：場地名稱、時間、原始狀態文字、是否已過期停止租借。
4. 提供 CLI 輸出與 JSON 檔輸出。
5. 支援每日定時執行（本機排程或 GitHub Actions）。

---

## 3. 技術選型

- Runtime：Node.js 20+
- Language：TypeScript 5+
- Browser Automation：Playwright（處理動態渲染）
- Date/Timezone：dayjs + dayjs-timezone
- Scheduler：node-cron（本機）
- Logging：pino（可選）
- Testing：Vitest
- Lint/Format：ESLint + Prettier

---

## 4. 相依套件

### 4.1 正式相依（dependencies）

- playwright
- dayjs
- dotenv
- node-cron
- zod
- pino

### 4.2 開發相依（devDependencies）

- typescript
- tsx
- @types/node
- vitest
- eslint
- @typescript-eslint/parser
- @typescript-eslint/eslint-plugin
- prettier
- eslint-config-prettier

### 4.3 安裝指令（參考）

```bash
npm install playwright dayjs dotenv node-cron zod pino
npm install -D typescript tsx @types/node vitest eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier eslint-config-prettier
npx playwright install
```

---

## 5. 專案架構

```text
court_rental/
  ├─ src/
  │  ├─ config/
  │  │  └─ env.ts                    # 讀取與驗證 .env
  │  ├─ scraper/
  │  │  └─ venueScraper.ts           # 啟動瀏覽器、抓取頁面
  │  ├─ parser/
  │  │  └─ scheduleParser.ts         # 解析今天的時段與狀態
  │  ├─ service/
  │  │  └─ checkTodayStatus.ts       # 核心流程整合（抓取+判斷）
  │  ├─ notifier/
  │  │  ├─ consoleNotifier.ts        # CLI 輸出
  │  │  └─ jsonNotifier.ts           # 寫入 JSON 檔
  │  ├─ types/
  │  │  └─ schedule.ts               # 型別定義
  │  ├─ utils/
  │  │  └─ time.ts                   # 時區與日期工具
  │  └─ index.ts                     # 程式入口
  ├─ tests/
  │  └─ scheduleParser.test.ts       # 解析邏輯測試
  ├─ output/
  │  └─ today-status.json            # 執行結果輸出（runtime）
  ├─ .env.example
  ├─ package.json
  ├─ tsconfig.json
  ├─ eslint.config.js
  ├─ .prettierrc
  ├─ .gitignore
  └─ README.md
```

---

## 6. 資料模型設計

```ts
export type SlotStatus = {
  date: string;                    // YYYY-MM-DD
  court: string;                   // 例如：網球場5(社子岸)
  time: string;                    // HH:mm
  rawStatus: string;               // 例如：已過期 停止租借
  isExpiredStopRent: boolean;      // true/false
};

export type TodayCheckResult = {
  venueUrl: string;
  checkedAt: string;               // ISO datetime
  timezone: string;                // Asia/Taipei
  totalSlots: number;
  expiredSlots: number;
  slots: SlotStatus[];
};
```

---

## 7. 核心流程

1. 讀取 `.env`（網址、時區、輸出路徑）。
2. 使用 Playwright 開啟頁面，等待「場地時段」資料載入。
3. 定位今天日期區塊（依 `Asia/Taipei` 計算）。
4. 逐筆擷取時段與狀態文字。
5. 套用規則：
   - `rawStatus` 包含「已過期」或「停止租借」 => `isExpiredStopRent = true`
   - 否則 `false`
6. 輸出終端摘要 + JSON。

---

## 8. 排程方式

### 8.1 本機（node-cron）

- 每日固定時段執行，例如：`0 6,12,18 * * *`

### 8.2 GitHub Actions（建議）

- 使用 `schedule` cron 觸發。
- 執行 `npm ci && npm run check:today`。
- 可將結果上傳 artifact 或發送通知。

---

## 9. package.json 腳本建議

```json
{
  "scripts": {
    "dev": "tsx src/index.ts",
    "check:today": "tsx src/index.ts",
    "test": "vitest run",
    "lint": "eslint .",
    "format": "prettier --write ."
  }
}
```

---

## 10. .env 設定建議

```env
VENUE_URL=https://vbs.sports.taipei/venues/?K=1042#Schedule
TIMEZONE=Asia/Taipei
OUTPUT_JSON=output/today-status.json
HEADLESS=true
```

---

## 11. 輸出範例（JSON）

```json
{
  "venueUrl": "https://vbs.sports.taipei/venues/?K=1042#Schedule",
  "checkedAt": "2026-03-27T10:00:00+08:00",
  "timezone": "Asia/Taipei",
  "totalSlots": 14,
  "expiredSlots": 8,
  "slots": [
    {
      "date": "2026-03-27",
      "court": "網球場5(社子岸)",
      "time": "08:00",
      "rawStatus": "已過期 停止租借",
      "isExpiredStopRent": true
    }
  ]
}
```

---

## 12. 風險與因應

1. 頁面結構改版：
   - 因應：選擇器集中管理、加上回歸測試與錯誤告警。
2. 動態資料載入延遲：
   - 因應：明確等待條件 + 重試機制。
3. 日期判斷錯誤（跨時區）：
   - 因應：統一使用 `Asia/Taipei`。
4. 法規與網站使用限制：
   - 因應：控制請求頻率、僅作查詢用途、避免高頻爬取。

---

## 13. 實作里程碑

1. 建立專案骨架與 TypeScript 設定。
2. 完成 Playwright 抓取 + 今天資料解析。
3. 完成判斷規則與 JSON/Console 輸出。
4. 補測試與錯誤處理。
5. 加入排程與 CI（可選）。

---

## 14. 驗收標準

1. 能在單次執行中列出今天所有時段。
2. 每個時段都具備 `isExpiredStopRent` 判斷結果。
3. 產出可讀摘要與 JSON 檔。
4. 排程可每日穩定執行。
