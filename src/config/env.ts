import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  VENUE_URL: z.string().url(),
  TIMEZONE: z.string().default("Asia/Taipei"),
  OUTPUT_JSON: z.string().default("output/today-status.json"),
  HEADLESS: z
    .string()
    .optional()
    .transform((value) => (value ?? "true").toLowerCase() !== "false")
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}

export const env = parsed.data;
