import { chromium, type Locator, type Page } from "playwright";

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

const MONTH_LABEL_REGEX = /\d{4}\s*年\s*\d{1,2}\s*月/;
const DATE_PICKER_VALUE_SELECTOR = "#DatePickerValue";
const PREVIOUS_MONTH_BUTTON_SELECTOR = "#DatePickupPrevBtn";
const TODAY_BUTTON_SELECTOR = "#DatePickupTodayBtn";
const NEXT_MONTH_BUTTON_SELECTOR = "#DatePickupNextBtn";
const BUTTON_CLICK_MAX_ATTEMPTS = 3;

type YearMonth = {
    year: number;
    month: number;
};

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

function scoreScheduleText(value: string): number {
    const dateTimeHits = value.match(/\d{1,2}\s*\/\s*\d{1,2}\s*\d{1,2}\s*[:：]\s*\d{2}/g)?.length ?? 0;
    const isoDateHits = value.match(/\d{4}\s*\/\s*\d{1,2}\s*\/\s*\d{1,2}/g)?.length ?? 0;
    return dateTimeHits * 1000 + isoDateHits * 100 + Math.min(value.length, 500);
}

async function extractScheduleText(page: Page): Promise<string> {
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

async function getVisibleMonthLabel(page: Page): Promise<string | null> {
    const label = await page.getByText(MONTH_LABEL_REGEX).first().textContent().catch(() => null);
    return label ? normalizeWhitespace(label) : null;
}

function parseYearMonthFromLabel(label: string | null): YearMonth | null {
    if (!label) {
        return null;
    }

    const match = normalizeWhitespace(label).match(/(\d{4})\s*年\s*(\d{1,2})\s*月/);
    if (!match) {
        return null;
    }

    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
        return null;
    }

    return { year, month };
}

function addOneMonth(value: YearMonth): YearMonth {
    if (value.month === 12) {
        return { year: value.year + 1, month: 1 };
    }
    return { year: value.year, month: value.month + 1 };
}

function isSameYearMonth(a: YearMonth | null, b: YearMonth | null): boolean {
    return !!a && !!b && a.year === b.year && a.month === b.month;
}

function compareYearMonth(a: YearMonth | null, b: YearMonth | null): number {
    if (!a || !b) {
        return 0;
    }
    if (a.year !== b.year) {
        return a.year - b.year;
    }
    return a.month - b.month;
}

function getTaipeiTodayYearMonth(): YearMonth {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "numeric"
    });
    const parts = formatter.formatToParts(new Date());
    const year = Number.parseInt(parts.find((part) => part.type === "year")?.value ?? "0", 10);
    const month = Number.parseInt(parts.find((part) => part.type === "month")?.value ?? "0", 10);
    return { year, month };
}

async function readDatePickerYearMonth(page: Page): Promise<YearMonth | null> {
    const label = await page.locator(DATE_PICKER_VALUE_SELECTOR).first().textContent().catch(() => null);
    return parseYearMonthFromLabel(label);
}

async function waitForDatePickerYearMonth(
    page: Page,
    predicate: (value: YearMonth | null) => boolean,
    timeoutMs = 12000
): Promise<boolean> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        const current = await readDatePickerYearMonth(page);
        if (predicate(current)) {
            return true;
        }
        await page.waitForTimeout(200);
    }
    return false;
}

async function waitForPageSettle(page: Page): Promise<void> {
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => { });
    await page.waitForTimeout(300);
}

async function clickWithRetry(page: Page, locator: Locator, maxAttempts = BUTTON_CLICK_MAX_ATTEMPTS): Promise<boolean> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const clicked = await locator
            .first()
            .click({ timeout: 5000 })
            .then(() => true)
            .catch(() => false);

        if (clicked) {
            return true;
        }

        await waitForPageSettle(page);
    }

    return false;
}

async function moveToPreviousMonth(page: Page): Promise<boolean> {
    const previousButton = page.locator(PREVIOUS_MONTH_BUTTON_SELECTOR);
    if (!(await isActionable(previousButton))) {
        return false;
    }

    return clickWithRetry(page, previousButton, 1);
}

async function recoverMonthStateForNextMonth(page: Page, expectedNextMonth: YearMonth): Promise<void> {
    const currentValue = await readDatePickerYearMonth(page);
    const compareToExpected = compareYearMonth(currentValue, expectedNextMonth);

    // If drifted to a later month (e.g. next-next month), step back once first.
    if (compareToExpected > 0) {
        await moveToPreviousMonth(page);
        const afterPrevious = await readDatePickerYearMonth(page);
        if (isSameYearMonth(afterPrevious, expectedNextMonth)) {
            return;
        }
    }

    // Reset to today if page state is still not what we expect.
    await resetToToday(page);
}

async function isActionable(locator: Locator): Promise<boolean> {
    const target = locator.first();
    const count = await target.count();

    if (count === 0) {
        return false;
    }

    const disabled = await target.isDisabled().catch(() => false);
    return !disabled;
}

async function waitForMonthLabel(
    page: Page,
    predicate: (currentLabel: string | null) => boolean
): Promise<void> {
    await page
        .waitForFunction(
            ({ regexSource }) => {
                const bodyText = document.body?.innerText ?? "";
                const match = bodyText.match(new RegExp(regexSource));
                return match ? match[0].replace(/\s+/g, " ").trim() : null;
            },
            { regexSource: MONTH_LABEL_REGEX.source },
            { timeout: 15000 }
        )
        .catch(() => null);

    const startedAt = Date.now();
    while (Date.now() - startedAt < 15000) {
        const currentLabel = await getVisibleMonthLabel(page);
        if (predicate(currentLabel)) {
            break;
        }
        await page.waitForTimeout(250);
    }

    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => { });
    await page.waitForTimeout(500);
}

async function restoreCurrentMonthView(page: Page, currentMonthLabel: string | null): Promise<void> {
    const todayButton = page.locator(TODAY_BUTTON_SELECTOR);
    if (await isActionable(todayButton)) {
        await todayButton.first().click();
        await waitForMonthLabel(page, (label) => !currentMonthLabel || label === currentMonthLabel);
        return;
    }

    const previousMonthButton = page.locator(PREVIOUS_MONTH_BUTTON_SELECTOR);
    if (await isActionable(previousMonthButton)) {
        await previousMonthButton.first().click();
        await waitForMonthLabel(page, (label) => !currentMonthLabel || label === currentMonthLabel);
    }
}

async function resetToToday(page: Page): Promise<void> {
    const expectedToday = getTaipeiTodayYearMonth();
    const todayButton = page.locator(TODAY_BUTTON_SELECTOR);
    if (!(await isActionable(todayButton))) {
        return;
    }

    for (let attempt = 1; attempt <= BUTTON_CLICK_MAX_ATTEMPTS; attempt++) {
        const clicked = await clickWithRetry(page, todayButton, 1);
        if (!clicked) {
            continue;
        }

        const ok = await waitForDatePickerYearMonth(
            page,
            (value) => isSameYearMonth(value, expectedToday),
            5000
        );
        if (ok) {
            return;
        }

        await waitForPageSettle(page);
    }
}

async function extractScheduleTextAcrossMonthBoundary(page: Page): Promise<string> {
    const currentMonthText = await extractScheduleText(page);
    const nextMonthButton = page.locator(NEXT_MONTH_BUTTON_SELECTOR);

    if (!(await isActionable(nextMonthButton))) {
        return currentMonthText;
    }

    const currentMonthLabel = await getVisibleMonthLabel(page);
    const todayMonth = await readDatePickerYearMonth(page);
    const fallbackToday = getTaipeiTodayYearMonth();
    const baseToday = todayMonth ?? fallbackToday;
    const expectedNextMonth = addOneMonth(baseToday);
    let nextMonthText = "";
    let shouldRestoreMonth = false;

    try {
        let nextMonthReady = false;
        for (let attempt = 1; attempt <= BUTTON_CLICK_MAX_ATTEMPTS; attempt++) {
            const clicked = await clickWithRetry(page, nextMonthButton, 1);
            if (!clicked) {
                await recoverMonthStateForNextMonth(page, expectedNextMonth);
                continue;
            }

            nextMonthReady = await waitForDatePickerYearMonth(
                page,
                (value) => isSameYearMonth(value, expectedNextMonth),
                5000
            );
            if (nextMonthReady) {
                break;
            }

            await recoverMonthStateForNextMonth(page, expectedNextMonth);
            await waitForPageSettle(page);
        }

        if (!nextMonthReady) {
            return currentMonthText;
        }
        await waitForMonthLabel(page, (label) => label !== currentMonthLabel);

        const nextMonthLabel = await getVisibleMonthLabel(page);
        shouldRestoreMonth = nextMonthLabel !== currentMonthLabel;
        nextMonthText = await extractScheduleText(page);
    } finally {
        if (shouldRestoreMonth) {
            await restoreCurrentMonthView(page, currentMonthLabel);
        }
    }

    return combineScheduleTexts([currentMonthText, nextMonthText]);
}

async function extractScheduleTextForWindow(page: Page, includeNextMonth: boolean): Promise<string> {
    if (!includeNextMonth) {
        return extractScheduleText(page);
    }

    return extractScheduleTextAcrossMonthBoundary(page);
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

export async function fetchAllCourtsData(
    url: string,
    headless: boolean,
    options: VenueScrapeOptions = {}
): Promise<VenueScrapeResult> {
    const includeNextMonth = options.includeNextMonth ?? false;
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
            const scheduleText = await extractScheduleTextForWindow(page, includeNextMonth);
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

            // When reading next-month data, reset month first so "next month" is always based on today.
            if (includeNextMonth) {
                await resetToToday(page);
            }

            const scheduleText = await extractScheduleTextForWindow(page, includeNextMonth);
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
export async function fetchVenuePageText(
    url: string,
    headless: boolean,
    options: VenueScrapeOptions = {}
): Promise<string> {
    const includeNextMonth = options.includeNextMonth ?? false;
  const browser = await chromium.launch({ headless });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForLoadState("networkidle", { timeout: 60000 });
    await page.waitForTimeout(1500);

      return await extractScheduleTextForWindow(page, includeNextMonth);
  } finally {
    await browser.close();
  }
}
