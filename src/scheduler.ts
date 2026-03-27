import cron from "node-cron";
import pino from "pino";
import { env } from "./config/env.js";
import { writeJsonOutput } from "./notifier/jsonNotifier.js";
import { checkTodayStatus } from "./service/checkTodayStatus.js";

const logger = pino({ name: "court-rental-scheduler" });
const CRON_EXPR = process.env.CRON_EXPR ?? "0 6,12,18 * * *";

async function runOnce(): Promise<void> {
  const result = await checkTodayStatus();
  await writeJsonOutput(result, env.OUTPUT_JSON);
  logger.info(
    {
      checkedAt: result.checkedAt,
      totalSlots: result.totalSlots,
      expiredSlots: result.expiredSlots,
      output: env.OUTPUT_JSON
    },
    "Scheduled check completed"
  );
}

cron.schedule(CRON_EXPR, () => {
  runOnce().catch((error: unknown) => {
    logger.error({ err: error }, "Scheduled check failed");
  });
});

logger.info({ cron: CRON_EXPR }, "Scheduler started");
runOnce().catch((error: unknown) => {
  logger.error({ err: error }, "Initial check failed");
});
