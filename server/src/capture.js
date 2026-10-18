import { chromium } from 'playwright-core';
import { assertPublicUrl } from './urlGuard.js';

const MAX_HEIGHT = 16000; // chromium 텍스처 한계 안쪽으로 제한
const DEFAULT_WIDTH = 390; // iPhone 기준 폭

let browserPromise;
function getBrowser() {
  browserPromise ??= chromium
    .launch({
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    })
    .catch((e) => {
      browserPromise = undefined;
      throw e;
    });
  return browserPromise;
}

async function autoScroll(page) {
  await page.evaluate(async (max) => {
    await new Promise((resolve) => {
      let y = 0;
      const step = window.innerHeight;
      const timer = setInterval(() => {
        window.scrollBy(0, step);
        y += step;
        if (y >= document.documentElement.scrollHeight || y >= max) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 150);
    });
  }, MAX_HEIGHT);
}

/**
 * 페이지 전체를 하나의 PNG로 캡처한다.
 * @returns {Promise<{png: Buffer, height: number, truncated: boolean}>}
 */
export async function capturePage(rawUrl, { width = DEFAULT_WIDTH, mobile = true } = {}) {
  const url = await assertPublicUrl(rawUrl);
  const w = Math.min(Math.max(Math.round(width), 320), 1920);
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: w, height: 844 },
    deviceScaleFactor: 2,
    isMobile: mobile,
    hasTouch: mobile,
    userAgent: mobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : undefined,
  });
  try {
    const page = await context.newPage();
    // 리다이렉트/서브리소스가 내부망으로 향하는 것도 차단
    await page.route('**/*', async (route) => {
      try {
        await assertPublicUrl(route.request().url());
        await route.continue();
      } catch {
        await route.abort();
      }
    });
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await autoScroll(page);
    await page.waitForTimeout(500);
    const full = await page.evaluate(() =>
      Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0),
    );
    const truncated = full > MAX_HEIGHT;
    const height = Math.min(full, MAX_HEIGHT);
    const png = await page.screenshot({
      type: 'png',
      fullPage: true,
      clip: { x: 0, y: 0, width: w, height },
    });
    return { png, height, truncated };
  } finally {
    await context.close();
  }
}
