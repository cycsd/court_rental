import { chromium, type Locator, type Page } from "playwright";

// ─── Public types ─────────────────────────────────────────────────────────────

export type CourtPageData = {
    courtName: string;
    scheduleText: string;
};

export type VenueScrapeResult = {
    venueName: string;
    courtsData: CourtPageData[];
};

export type VenueScrapeOptions = {
    includeNextMonth?: boolean;
};

// ─── Selectors ────────────────────────────────────────────────────────────────

// The full-screen venue detail modal opened when a venue card is clicked
const MODAL_SELECTOR = ".el-dialog.app-dialog";

// The calendar grid inside the schedule tab panel
const CALENDAR_SELECTOR = ".calendar";

// Individual court tab items inside the schedule section
const COURT_TAB_SELECTOR = ".el-tabs__item";

// The clickable wrapper of the month <el-select> inside the schedule section
const MONTH_SELECT_WRAPPER_SELECTOR = ".el-select__wrapper";

// Options rendered by ElementPlus into a global dropdown list
const MONTH_OPTION_SELECTOR = ".el-select-dropdown__item";

// Text on the "reset to today's month" button
const TODAY_BUTTON_TEXT = "今日";

// ─── Utility ──────────────────────────────────────────────────────────────────

function normalizeWhitespace(value: string): string {
    return value.replace(/[\u00A0\u3000]/g, " ").replace(/\s+/g, " ").trim();
}

// Kept for backward-compatibility with existing tests.
// On the new site the extracted text has no footer markers, so this is a no-op.
const FOOTER_MARKERS = [
    "可租借時段 ( Can be rented )",
    "Notice:",
    "Department of Sports, Taipei City Government Venue Booking System",
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

export function combineScheduleTexts(values: string[]): string {
    return [...new Set(values.map((value) => normalizeWhitespace(value)).filter(Boolean))].join("\n");
}

// ─── Year/Month helpers ───────────────────────────────────────────────────────

type YearMonth = { year: number; month: number };

function getTaipeiTodayYearMonth(): YearMonth {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "numeric",
    });
    const parts = formatter.formatToParts(new Date());
    const year = parseInt(parts.find((p) => p.type === "year")?.value ?? "0", 10);
    const month = parseInt(parts.find((p) => p.type === "month")?.value ?? "0", 10);
    return { year, month };
}

function addOneMonth(ym: YearMonth): YearMonth {
    return ym.month === 12 ? { year: ym.year + 1, month: 1 } : { year: ym.year, month: ym.month + 1 };
}

// Format a YearMonth as the string shown in the month <el-select> dropdown,
// e.g. { year: 2026, month: 8 } → "2026年08月"
function formatMonthLabel(ym: YearMonth): string {
    return `${ym.year}年${String(ym.month).padStart(2, "0")}月`;
}

// ─── Schedule tabs locator helper ─────────────────────────────────────────────

// The modal contains two sets of <el-tabs>: one for pricing, one for the
// schedule.  The schedule section is the one that contains the .calendar grid.
function getScheduleTabsLocator(page: Page): Locator {
    return page.locator(".el-tabs").filter({ has: page.locator(CALENDAR_SELECTOR) });
}

// ─── Calendar grid extraction ─────────────────────────────────────────────────

// Reads the currently visible month's .calendar grid and returns the schedule
// as a single normalised string in the format:
//   "M/D HH:MM | <status>"  (one slot per entry, space-separated)
//
// <status> is either the renter's name (booked) or text containing "停止租借"
// (not available / expired).  This format is directly compatible with
// scheduleParser.parseSlotsForDate().
async function extractCalendarScheduleText(page: Page): Promise<string> {
    const lines = await page.evaluate((calendarSel: string) => {
        const modal = document.querySelector(".el-dialog.app-dialog");
        const calendar = modal?.querySelector(calendarSel) as HTMLElement | null;
        if (!calendar) return [] as string[];

        const children = [...calendar.children] as HTMLElement[];
        if (children.length < 2) return [] as string[];

        // First child = sticky column with time labels.
        // children[0].children[0] = empty header placeholder.
        // children[0].children[1..N] = "08:00", "09:00", ..., "21:00"
        const timeLabels = [...children[0].children].map((c) => c.textContent?.trim() ?? "");

        const result: string[] = [];

        // Remaining children are date columns (one per day in the month view).
        for (let colIdx = 1; colIdx < children.length; colIdx++) {
            const col = children[colIdx];
            const cells = [...col.children] as HTMLElement[];
            if (!cells.length) continue;

            // cells[0] = date header, e.g. "2026/7/1 (三)"
            const dateHeader = cells[0]?.textContent?.trim() ?? "";
            const mdMatch = dateHeader.match(/\d{4}\/(\d{1,2})\/(\d{1,2})/);
            if (!mdMatch) continue;
            const md = `${mdMatch[1]}/${mdMatch[2]}`; // "7/1"

            // cells[1..N] = time-slot cells (aligned with timeLabels[1..N])
            for (let rowIdx = 1; rowIdx < cells.length; rowIdx++) {
                const time = timeLabels[rowIdx];
                if (!time || !/^\d{1,2}:\d{2}$/.test(time)) continue;

                const raw = cells[rowIdx]?.textContent?.trim() ?? "";
                const status = raw || "停止租借";
                result.push(`${md} ${time} | ${status}`);
            }
        }

        return result;
    }, CALENDAR_SELECTOR);

    // Join with a space so that after normaliseWhitespace() the text is a
    // single long line — exactly the format the existing parser expects.
    return normalizeWhitespace(lines.join(" "));
}

// ─── Month navigation ─────────────────────────────────────────────────────────

async function navigateToTodayMonth(page: Page): Promise<void> {
    const scheduleTabs = getScheduleTabsLocator(page);
    const todayBtn = scheduleTabs.locator("button").filter({ hasText: TODAY_BUTTON_TEXT }).first();
    const visible = await todayBtn.isVisible().catch(() => false);
    if (visible) {
        await todayBtn.click({ timeout: 5000 }).catch(() => { });
        await page.waitForTimeout(400);
    }
}

// Opens the month <el-select> dropdown and clicks the option whose text equals
// targetLabel (e.g. "2026年08月").  Returns false if the option isn't found.
async function selectMonthFromDropdown(page: Page, targetLabel: string): Promise<boolean> {
    const scheduleTabs = getScheduleTabsLocator(page);
    const wrapper = scheduleTabs.locator(MONTH_SELECT_WRAPPER_SELECTOR).first();

    await wrapper.click({ timeout: 5000 }).catch(() => { });
    await page.waitForTimeout(300);

    // ElementPlus renders the dropdown list as a teleported element outside the
    // modal, so we search the full page for the target option text.
    const targetOption = page.locator(MONTH_OPTION_SELECTOR).filter({ hasText: targetLabel });

    const found = (await targetOption.count().catch(() => 0)) > 0;
    if (!found) {
        await page.keyboard.press("Escape");
        return false;
    }

    await targetOption.first().click({ timeout: 5000 });
    await page.waitForTimeout(500);
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => { });
    return true;
}

// ─── Per-court extraction ─────────────────────────────────────────────────────

// After a court tab is already selected, this resets to today's month, reads
// the schedule, optionally navigates to the next month and reads again, then
// resets back to today.
async function extractScheduleForCourtTab(page: Page, includeNextMonth: boolean): Promise<string> {
    await navigateToTodayMonth(page);
    await page.waitForTimeout(300);

    const currentMonthText = await extractCalendarScheduleText(page);

    if (!includeNextMonth) {
        return currentMonthText;
    }

    const nextMonthLabel = formatMonthLabel(addOneMonth(getTaipeiTodayYearMonth()));
    const navigated = await selectMonthFromDropdown(page, nextMonthLabel);

    if (!navigated) {
        return currentMonthText;
    }

    const nextMonthText = await extractCalendarScheduleText(page);

    // Restore to today's month so the next court tab starts from today.
    await navigateToTodayMonth(page);

    return combineScheduleTexts([currentMonthText, nextMonthText]);
}

// ─── Venue name ───────────────────────────────────────────────────────────────

function extractVenueName(rawText: string): string {
    const normalized = normalizeWhitespace(rawText);
    return normalized || "未知場地";
}

// ─── Main public API ──────────────────────────────────────────────────────────

export async function fetchAllCourtsData(
    url: string,
    headless: boolean,
    options: VenueScrapeOptions = {}
): Promise<VenueScrapeResult> {
    const includeNextMonth = options.includeNextMonth ?? false;
    const browser = await chromium.launch({ headless });

    try {
        const page = await browser.newPage();

        // ── 1. Load venue listing page ────────────────────────────────────────
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForLoadState("networkidle", { timeout: 60000 });
        await page.waitForTimeout(1500);

        // Venue/park name (e.g. "百齡河濱公園(社子岸)")
        const rawHeading = await page.locator("h1").first().innerText().catch(() => "");
        const venueName = extractVenueName(rawHeading);

        // ── 2. Click the tennis court group card to open the detail modal ─────
        // The card header div contains the group name "網球場(社子岸)".
        // We use exact text matching to avoid clicking sub-court items such as
        // "網球場5(社子岸)" or the unrelated "網球場A(社子岸)" group.
        const venueCard = page.locator("div.font-bold").getByText("網球場(社子岸)", { exact: true }).first();
        await venueCard.click();

        // ── 3. Wait for the full-screen detail modal ──────────────────────────
        const modal = page.locator(MODAL_SELECTOR);
        await modal.waitFor({ state: "visible", timeout: 15000 });
        await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => { });
        await page.waitForTimeout(600);

        // ── 4. Locate the schedule tabs section inside the modal ──────────────
        const scheduleTabs = getScheduleTabsLocator(page);
        await scheduleTabs.waitFor({ state: "visible", timeout: 10000 });

        const courtTabItems = scheduleTabs.locator(COURT_TAB_SELECTOR);
        const tabCount = await courtTabItems.count();

        // ── 5. Fallback: no tabs found ────────────────────────────────────────
        if (tabCount === 0) {
            const scheduleText = await extractCalendarScheduleText(page);
            return {
                venueName,
                courtsData: [{ courtName: "網球場", scheduleText }],
            };
        }

        // ── 6. Iterate over court tabs ────────────────────────────────────────
        const results: CourtPageData[] = [];

        for (let i = 0; i < tabCount; i++) {
            // Re-locate each iteration to avoid stale element references.
            const tab = scheduleTabs.locator(COURT_TAB_SELECTOR).nth(i);
            const tabText = normalizeWhitespace(await tab.innerText().catch(() => ""));

            // Use short name "網球場5" extracted from "網球場5(社子岸)"
            const nameMatch = tabText.match(/網球場\d+/);
            const courtName = nameMatch ? nameMatch[0] : tabText;

            await tab.click();
            await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => { });
            await page.waitForTimeout(500);

            const scheduleText = await extractScheduleForCourtTab(page, includeNextMonth);
            results.push({ courtName, scheduleText });
        }

        return { venueName, courtsData: results };
    } finally {
        await browser.close();
    }
}

// Kept for direct single-page text usage if needed.
export async function fetchVenuePageText(
    url: string,
    headless: boolean,
    options: VenueScrapeOptions = {}
): Promise<string> {
    const result = await fetchAllCourtsData(url, headless, options);
    return result.courtsData.map((c) => c.scheduleText).join("\n");
}
