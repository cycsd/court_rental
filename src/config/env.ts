import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const asBoolean = (value: string | undefined, fallback = false): boolean => {
    if (value === undefined) {
        return fallback;
    }
    return value.toLowerCase() === "true";
};

const asOptionalString = (value: string | undefined): string | undefined => {
    if (value === undefined) {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

const asStringArray = (value: string | undefined): string[] => {
    if (!value) {
        return [];
    }
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
};

const envSchema = z.object({
  VENUE_URL: z.string().url(),
  TIMEZONE: z.string().default("Asia/Taipei"),
    WETNESS_PROFILE: z
        .enum(["conservative", "balanced", "aggressive"])
        .default("balanced"),
    WETNESS_LOOKBACK_HOURS: z
        .string()
        .optional()
        .transform((value) => {
            if (!value) {
                return undefined;
            }
            const parsed = Number.parseInt(value, 10);
            if (Number.isNaN(parsed)) {
                return undefined;
            }
            return Math.min(24, Math.max(3, parsed));
        }),
    WETNESS_THRESHOLD: z
        .string()
        .optional()
        .transform((value) => {
            if (!value) {
                return undefined;
            }
            const parsed = Number.parseFloat(value);
            if (Number.isNaN(parsed)) {
                return undefined;
            }
            return Math.min(0.95, Math.max(0.1, parsed));
        }),
    WEATHER_LAT: z
        .string()
        .optional()
        .transform((value) => {
            if (!value) {
                return 25.086;
            }
            const parsed = Number.parseFloat(value);
            return Number.isNaN(parsed) ? 25.086 : parsed;
        }),
    WEATHER_LON: z
        .string()
        .optional()
        .transform((value) => {
            if (!value) {
                return 121.507;
            }
            const parsed = Number.parseFloat(value);
            return Number.isNaN(parsed) ? 121.507 : parsed;
        }),
  OUTPUT_JSON: z.string().default("output/today-status.json"),
    OUTPUT_HTML: z.string().default("output/today-status.html"),
  HEADLESS: z
    .string()
    .optional()
        .transform((value) => (value ?? "true").toLowerCase() !== "false"),
    TELEGRAM_ENABLED: z
        .string()
        .optional()
        .transform((value) => asBoolean(value, false)),
    TELEGRAM_BOT_TOKEN: z.string().optional().transform(asOptionalString),
    TELEGRAM_CHAT_ID: z.string().optional().transform(asOptionalString),
    EMAIL_ENABLED: z
        .string()
        .optional()
        .transform((value) => asBoolean(value, false)),
    EMAIL_SMTP_HOST: z.string().optional().transform(asOptionalString),
    EMAIL_SMTP_PORT: z
        .string()
        .optional()
        .transform((value) => {
            if (!value) {
                return 587;
            }
            const parsedPort = Number.parseInt(value, 10);
            return Number.isNaN(parsedPort) ? 587 : parsedPort;
        }),
    EMAIL_SMTP_SECURE: z
        .string()
        .optional()
        .transform((value) => asBoolean(value, false)),
    EMAIL_SMTP_USER: z.string().optional().transform(asOptionalString),
    EMAIL_SMTP_PASS: z.string().optional().transform(asOptionalString),
    EMAIL_FROM: z.string().optional().transform(asOptionalString),
    EMAIL_TO: z.string().optional().transform(asStringArray)
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}

if (parsed.data.TELEGRAM_ENABLED) {
    if (!parsed.data.TELEGRAM_BOT_TOKEN || !parsed.data.TELEGRAM_CHAT_ID) {
        throw new Error("Telegram is enabled but TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing.");
    }
}

if (parsed.data.EMAIL_ENABLED) {
    const missingEmailFields = [
        ["EMAIL_SMTP_HOST", parsed.data.EMAIL_SMTP_HOST],
        ["EMAIL_SMTP_USER", parsed.data.EMAIL_SMTP_USER],
        ["EMAIL_SMTP_PASS", parsed.data.EMAIL_SMTP_PASS],
        ["EMAIL_FROM", parsed.data.EMAIL_FROM],
        ["EMAIL_TO", parsed.data.EMAIL_TO.length > 0 ? "ok" : undefined]
    ].filter(([, value]) => !value);

    if (missingEmailFields.length > 0) {
        const names = missingEmailFields.map(([name]) => name).join(", ");
        throw new Error(`Email is enabled but required fields are missing: ${names}`);
    }
}

export const env = parsed.data;
