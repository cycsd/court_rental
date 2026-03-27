import type { SlotStatus } from "../types/schedule.js";

type ParseInput = {
  pageText: string;
  isoDate: string;
  monthDay: string;
  courtName?: string;
};

const STATUS_KEYWORDS = ["已過期", "停止租借"];

function normalizeWhitespace(value: string): string {
  return value.replace(/[\u00A0\u3000]/g, " ").replace(/\s+/g, " ").trim();
}

function pad2(value: string): string {
  return value.length === 1 ? `0${value}` : value;
}

function isExpiredStopRent(rawStatus: string): boolean {
  return STATUS_KEYWORDS.some((keyword) => rawStatus.includes(keyword));
}

export function parseTodaySlots(input: ParseInput): SlotStatus[] {
  const normalized = normalizeWhitespace(input.pageText);
  const md = input.monthDay.replace(/\s+/g, "");

  // Examples matched:
  // - "3/27 08 : 00 | 已過期 停止租借"
  // - "3/27 08:00 已過期 停止租借"
  const slotRegex = new RegExp(
    `${md}\\s*(\\d{1,2})\\s*[:：]\\s*(\\d{2})\\s*(?:[|｜]\\s*)?([^\\n\\r]+?)\\s*(?=${md}\\s*\\d{1,2}\\s*[:：]|\\d{4}\\s*\/\\s*\\d{1,2}\\s*\/\\s*\\d{1,2}|$)`,
    "g"
  );

  const slots: SlotStatus[] = [];
  for (const match of normalized.matchAll(slotRegex)) {
    const hour = pad2(match[1]);
    const minute = pad2(match[2]);
    const status = normalizeWhitespace(match[3]);

    if (!status) {
      continue;
    }

    slots.push({
      date: input.isoDate,
      court: input.courtName ?? "Unknown Court",
      time: `${hour}:${minute}`,
      rawStatus: status,
      isExpiredStopRent: isExpiredStopRent(status)
    });
  }

  // Avoid accidental duplicates from malformed text blocks.
  const unique = new Map<string, SlotStatus>();
  for (const slot of slots) {
    unique.set(`${slot.court}-${slot.date}-${slot.time}`, slot);
  }

  return [...unique.values()].sort((a, b) => a.time.localeCompare(b.time));
}
