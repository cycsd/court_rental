import type { SlotStatus, TimeSlotSummary } from "../types/schedule.js";

type ParseInput = {
  pageText: string;
  isoDate: string;
  monthDay: string;
  courtName?: string;
};

const STATUS_KEYWORDS = ["停止租借"];
const STATUS_TRAILING_MARKERS = [
  "可租借時段 ( Can be rented )",
  "不可租借時段 ( Can not be rented )",
  "注意事項：",
  "Notice:",
  "Photos 圖片集",
  "Department of Sports, Taipei City Government Venue Booking System"
];

function normalizeWhitespace(value: string): string {
  return value.replace(/[\u00A0\u3000]/g, " ").replace(/\s+/g, " ").trim();
}

function pad2(value: string): string {
  return value.length === 1 ? `0${value}` : value;
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildMonthDayPattern(monthDay: string): string {
  const normalized = monthDay.replace(/\s+/g, "");
  const [monthPart, dayPart] = normalized.split("/");
  const month = Number(monthPart);
  const day = Number(dayPart);

  if (!Number.isFinite(month) || !Number.isFinite(day)) {
    return escapeForRegex(normalized);
  }

  return `0?${month}\\s*\\/\\s*0?${day}`;
}

function isStopRentStatus(rawStatus: string): boolean {
  return STATUS_KEYWORDS.some((keyword) => rawStatus.includes(keyword));
}

function sanitizeRawStatus(rawStatus: string): string {
  let cutAt = rawStatus.length;

  for (const marker of STATUS_TRAILING_MARKERS) {
    const index = rawStatus.indexOf(marker);
    if (index >= 0 && index < cutAt) {
      cutAt = index;
    }
  }

  return normalizeWhitespace(rawStatus.slice(0, cutAt));
}

export function parseSlotsForDate(input: ParseInput): SlotStatus[] {
  const normalized = normalizeWhitespace(input.pageText);
  const mdPattern = buildMonthDayPattern(input.monthDay);

  // Examples matched:
  // - "3/27 08 : 00 | 已過期 停止租借"
  // - "3/27 08:00 已過期 停止租借"
  const slotRegex = new RegExp(
    `${mdPattern}\\s*(\\d{1,2})\\s*[:：]\\s*(\\d{2})\\s*(?:[|｜]\\s*)?([^\\n\\r]+?)\\s*(?=${mdPattern}\\s*\\d{1,2}\\s*[:：]|\\d{1,2}\\s*\/\\s*\\d{1,2}\\s*\\d{1,2}\\s*[:：]|\\d{4}\\s*\/\\s*\\d{1,2}\\s*\/\\s*\\d{1,2}|可租借時段\\s*\\(\\s*Can be rented\\s*\\)|$)`,
    "g"
  );

  const slots: SlotStatus[] = [];
  for (const match of normalized.matchAll(slotRegex)) {
    const hour = pad2(match[1]);
    const minute = pad2(match[2]);
    const status = sanitizeRawStatus(normalizeWhitespace(match[3]));

    if (!status) {
      continue;
    }

    slots.push({
      date: input.isoDate,
      court: input.courtName ?? "Unknown Court",
      time: `${hour}:${minute}`,
      rawStatus: status,
        isRented: !isStopRentStatus(status)
    });
  }

  // Avoid accidental duplicates from malformed text blocks.
  const unique = new Map<string, SlotStatus>();
  for (const slot of slots) {
    unique.set(`${slot.court}-${slot.date}-${slot.time}`, slot);
  }

  return [...unique.values()].sort((a, b) => a.time.localeCompare(b.time));
}

export function parseTodaySlots(input: ParseInput): SlotStatus[] {
  return parseSlotsForDate(input);
}

export function buildTimeSummary(
    allSlots: SlotStatus[],
    allCourtNames: string[]
): TimeSlotSummary[] {
  const dateTimes = [...new Set(allSlots.map((s) => `${s.date} ${s.time}`))].sort();

  return dateTimes.map((dateTime) => {
    const [date, time] = dateTime.split(" ");
    const slotsAtTime = allSlots.filter((s) => s.date === date && s.time === time);
        const availableCourts = slotsAtTime
            .filter((s) => !s.isRented)
            .map((s) => s.court);
        const unavailableCourts = slotsAtTime
            .filter((s) => s.isRented)
            .map((s) => s.court);

        return {
            time,
          date,
            availableCourts,
            unavailableCourts,
            total: allCourtNames.length,
            available: availableCourts.length
        };
    });
}
