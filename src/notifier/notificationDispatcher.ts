import pino from "pino";
import { env } from "../config/env.js";
import type { TodayCheckResult } from "../types/schedule.js";
import { sendEmail } from "./emailNotifier.js";
import { buildNotificationMessage } from "./messageBuilder.js";
import { sendTelegramMessage } from "./telegramNotifier.js";

const logger = pino({ name: "notification-dispatcher" });

export async function dispatchNotifications(result: TodayCheckResult): Promise<void> {
  const message = buildNotificationMessage(result);
  const tasks: Promise<void>[] = [];

  if (env.TELEGRAM_ENABLED) {
    tasks.push(
      sendTelegramMessage(env.TELEGRAM_BOT_TOKEN!, env.TELEGRAM_CHAT_ID!, message).then(() => {
        logger.info("Telegram notification sent");
      })
    );
  }

  if (env.EMAIL_ENABLED) {
    tasks.push(
      sendEmail({
        host: env.EMAIL_SMTP_HOST!,
        port: env.EMAIL_SMTP_PORT,
        secure: env.EMAIL_SMTP_SECURE,
        user: env.EMAIL_SMTP_USER!,
        pass: env.EMAIL_SMTP_PASS!,
        from: env.EMAIL_FROM!,
        to: env.EMAIL_TO,
        subject: "[Court Rental] 未來 7 天場地檢查結果",
        text: message
      }).then(() => {
        logger.info("Email notification sent");
      })
    );
  }

  if (tasks.length === 0) {
    logger.info("No notifications enabled, skip notify step");
    return;
  }

  await Promise.all(tasks);
}
