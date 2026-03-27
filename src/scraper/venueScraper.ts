import { chromium } from "playwright";

export type CourtPageData = {
    courtName: string;
    scheduleText: string;
};

export async function fetchAllCourtsData(url: string, headless: boolean): Promise<CourtPageData[]> {
    const browser = await chromium.launch({ headless });

    try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForLoadState("networkidle", { timeout: 60000 });
        await page.waitForTimeout(1500);

        // Locate all court tab links (e.g. "網球場5(社子岸) Court 5")
        const courtTabs = page.locator("a").filter({ hasText: /網球場\d+/ });
        const tabCount = await courtTabs.count();

        // Fallback: no tabs found, return body text as a single unknown court
        if (tabCount === 0) {
            const scheduleText = await page.locator("body").innerText();
            return [{ courtName: "網球場", scheduleText }];
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

            const scheduleText = await page.locator("body").innerText();
            results.push({ courtName, scheduleText });
        }

        return results;
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

      return await page.locator("body").innerText();
  } finally {
    await browser.close();
  }
}
