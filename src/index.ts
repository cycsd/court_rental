import pino from "pino";
import { env } from "./config/env.js";
import { writeHtmlReport } from "./notifier/htmlReportNotifier.js";
import { printConsoleSummary } from "./notifier/consoleNotifier.js";
import { writeJsonOutput } from "./notifier/jsonNotifier.js";
import { dispatchNotifications } from "./notifier/notificationDispatcher.js";
import { checkTodayStatus } from "./service/checkTodayStatus.js";

const logger = pino({ name: "court-rental-checker" });

async function main(): Promise<void> {
  const result = await checkTodayStatus();
  printConsoleSummary(result);
  await writeJsonOutput(result, env.OUTPUT_JSON);
    await writeHtmlReport(result, env.OUTPUT_HTML);
    await dispatchNotifications(result);
    logger.info({ jsonOutput: env.OUTPUT_JSON, htmlOutput: env.OUTPUT_HTML }, "Result written");
}

main().catch((error: unknown) => {
  logger.error({ err: error }, "Failed to check today status");
  process.exitCode = 1;
});
