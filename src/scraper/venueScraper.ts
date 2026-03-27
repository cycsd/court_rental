import { chromium } from "playwright";

export async function fetchVenuePageText(url: string, headless: boolean): Promise<string> {
  const browser = await chromium.launch({ headless });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForLoadState("networkidle", { timeout: 60000 });

    // Give dynamic schedule widgets a short buffer to render.
    await page.waitForTimeout(1500);

    const bodyText = await page.locator("body").innerText();
    return bodyText;
  } finally {
    await browser.close();
  }
}
