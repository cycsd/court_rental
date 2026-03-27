// import cron from "node-cron";
import pino from "pino";
import { env } from "./config/env.js";
import { writeHtmlReport } from "./notifier/htmlReportNotifier.js";
import { writeJsonOutput } from "./notifier/jsonNotifier.js";
import { dispatchNotifications } from "./notifier/notificationDispatcher.js";
import { checkTodayStatus } from "./service/checkTodayStatus.js";

const logger = pino({ name: "court-rental-scheduler" });
const CRON_EXPR = process.env.CRON_EXPR ?? "0 6,12,18 * * *";

async function runOnce(): Promise<void> {
  const result = await checkTodayStatus();
  await writeJsonOutput(result, env.OUTPUT_JSON);
    await writeHtmlReport(result, env.OUTPUT_HTML);
    await dispatchNotifications(result);
  logger.info(
    {
      checkedAt: result.checkedAt,
      totalSlots: result.totalSlots,
      expiredSlots: result.expiredSlots,
          jsonOutput: env.OUTPUT_JSON,
          htmlOutput: env.OUTPUT_HTML
    },
    "Scheduled check completed"
  );
}

// cron.schedule(CRON_EXPR, () => {
//   runOnce().catch((error: unknown) => {
//     logger.error({ err: error }, "Scheduled check failed");
//   });
// });

logger.info({ cron: CRON_EXPR }, "Scheduler started");
runOnce().catch((error: unknown) => {
  logger.error({ err: error }, "Initial check failed");
});
