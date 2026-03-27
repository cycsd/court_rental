import pino from "pino";
import { env } from "./config/env.js";
import { printConsoleSummary } from "./notifier/consoleNotifier.js";
import { writeJsonOutput } from "./notifier/jsonNotifier.js";
import { dispatchNotifications } from "./notifier/notificationDispatcher.js";
import { checkTodayStatus } from "./service/checkTodayStatus.js";

const logger = pino({ name: "court-rental-checker" });

async function main(): Promise<void> {
  const result = await checkTodayStatus();
  printConsoleSummary(result);
  await writeJsonOutput(result, env.OUTPUT_JSON);
    await dispatchNotifications(result);
  logger.info({ output: env.OUTPUT_JSON }, "Result written");
}

main().catch((error: unknown) => {
  logger.error({ err: error }, "Failed to check today status");
  process.exitCode = 1;
});
