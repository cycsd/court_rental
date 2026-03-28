import { chromium } from "playwright";

export type CourtPageData = {
    courtName: string;
    scheduleText: string;
};

export type VenueScrapeResult = {
    venueName: string;
    courtsData: CourtPageData[];
};

function normalizeWhitespace(value: string): string {
    return value.replace(/[\u00A0\u3000]/g, " ").replace(/\s+/g, " ").trim();
}

const SCHEDULE_CONTAINER_SELECTORS = [
    ".tab-pane.active",
    ".tab-content",
    ".BookingDate",
    ".bookingDate",
    ".BookDateTable",
    ".VenueBookDateTable",
    "#tab-content",
    "main"
];

const FOOTER_MARKERS = [
    "可租借時段 ( Can be rented )",
    "Notice:",
    "Department of Sports, Taipei City Government Venue Booking System"
];

export function trimTrailingNonScheduleText(value: string): string {
    const firstScheduleIdx = value.search(/\d{1,2}\s*\/\s*\d{1,2}\s*\d{1,2}\s*[:：]\s*\d{2}/);
    let cutAt = value.length;
    for (const marker of FOOTER_MARKERS) {
        const idx = value.indexOf(marker);
        if (idx >= 0 && idx < cutAt && (firstScheduleIdx < 0 || idx > firstScheduleIdx)) {
            cutAt = idx;
        }
    }
    return normalizeWhitespace(value.slice(0, cutAt));
}

function scoreScheduleText(value: string): number {
    const dateTimeHits = value.match(/\d{1,2}\s*\/\s*\d{1,2}\s*\d{1,2}\s*[:：]\s*\d{2}/g)?.length ?? 0;
    const isoDateHits = value.match(/\d{4}\s*\/\s*\d{1,2}\s*\/\s*\d{1,2}/g)?.length ?? 0;
    return dateTimeHits * 1000 + isoDateHits * 100 + Math.min(value.length, 500);
}

async function extractScheduleText(page: import("playwright").Page): Promise<string> {
    const candidates: string[] = [];

    for (const selector of SCHEDULE_CONTAINER_SELECTORS) {
        const texts = await page.locator(selector).allInnerTexts().catch(() => []);
        for (const text of texts) {
            const normalized = trimTrailingNonScheduleText(normalizeWhitespace(text));
            if (!normalized) continue;
            candidates.push(normalized);
        }
    }

    const best = candidates
        .filter((text) => /\d{1,2}\s*\/\s*\d{1,2}\s*\d{1,2}\s*[:：]\s*\d{2}/.test(text))
        .sort((a, b) => scoreScheduleText(b) - scoreScheduleText(a))[0];

    if (best) {
        return best;
    }

    const bodyText = await page.locator("body").innerText();
    return trimTrailingNonScheduleText(normalizeWhitespace(bodyText));
}

function extractVenueName(rawHeading: string): string {
    const normalized = normalizeWhitespace(rawHeading);
    if (!normalized) {
        return "未知場地";
    }

    // Split mixed title into "中文 / English" by first Latin character.
    const firstLatinIdx = normalized.search(/[A-Za-z]/);
    if (firstLatinIdx <= 0) {
        return normalized;
    }

    const zhName = normalizeWhitespace(normalized.slice(0, firstLatinIdx));
    const enName = normalizeWhitespace(normalized.slice(firstLatinIdx));
    if (!zhName || !enName) {
        return normalized;
    }

    return `${zhName} / (${enName})`;
}

export async function fetchAllCourtsData(url: string, headless: boolean): Promise<VenueScrapeResult> {
    const browser = await chromium.launch({ headless });

    try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForLoadState("networkidle", { timeout: 60000 });
        await page.waitForTimeout(1500);

        const rawHeading = await page.locator("div.MainTitleTxt").first().innerText().catch(() => "");
        const fallbackHeading = await page.locator("h1").first().innerText().catch(() => "");
        const venueName = extractVenueName(rawHeading || fallbackHeading);

        // Locate all court tab links (e.g. "網球場5(社子岸) Court 5")
        const courtTabs = page.locator("a").filter({ hasText: /網球場\d+/ });
        const tabCount = await courtTabs.count();

        // Fallback: no tabs found, return body text as a single unknown court
        if (tabCount === 0) {
            const scheduleText = await extractScheduleText(page);
            return {
                venueName,
                courtsData: [{ courtName: "網球場", scheduleText }]
            };
        }

        const results: CourtPageData[] = [];

        for (let i = 0; i < tabCount; i++) {
            // Re-locate tabs each iteration to avoid stale element handles
            const tab = page.locator("a").filter({ hasText: /網球場\d+/ }).nth(i);
            const tabText = (await tab.innerText()).trim();

            // Extract short name: "網球場5"
            const nameMatch = tabText.match(/網球場\d+/);
            const courtName = nameMatch ? nameMatch[0] : tabText;

            await tab.click();
            await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => { });
            await page.waitForTimeout(800);

            const scheduleText = await extractScheduleText(page);
            results.push({ courtName, scheduleText });
        }

        return {
            venueName,
            courtsData: results
        };
    } finally {
        await browser.close();
    }
}

// Kept for direct single-page text usage if needed
export async function fetchVenuePageText(url: string, headless: boolean): Promise<string> {
  const browser = await chromium.launch({ headless });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForLoadState("networkidle", { timeout: 60000 });
    await page.waitForTimeout(1500);

      return await extractScheduleText(page);
  } finally {
    await browser.close();
  }
}
