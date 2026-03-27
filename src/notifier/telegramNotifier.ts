import pino from "pino";

const logger = pino({ name: "telegram-notifier" });

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<void> {
  const endpoint = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    })
  });

  if (!response.ok) {
    const body = await response.text();
    logger.error({ status: response.status, body }, "Telegram API request failed");
    throw new Error(`Telegram send failed with HTTP ${response.status}`);
  }
}
