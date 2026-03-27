import fs from "node:fs/promises";
import path from "node:path";
import type { TodayCheckResult } from "../types/schedule.js";

export async function writeJsonOutput(
  result: TodayCheckResult,
  outputPath: string
): Promise<void> {
  const dir = path.dirname(outputPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2), "utf8");
}
