import { chromium } from 'playwright-core';
import { allowPrivate, assertPublicUrl, isPrivateAddress } from './urlGuard.js';

const SCALE = 1.5;
const MAX_HEIGHT = 10000; // CSS px. x SCALE = 15000px 로 chromium 이미지 한계(16384) 안쪽
const DEFAULT_WIDTH = 390; // iPhone 기준 폭
const MAX_BYTES = 4_000_000; // Vercel 함수 응답 한도(4.5MB) 안쪽

let browserPromise;
async function launchOptions() {
  if (process.env.VERCEL) {
    // Vercel 서버리스: 번들된 경량 Chromium 사용
    const { default: sparticuz } = await import('@sparticuz/chromium');
    return { executablePath: await sparticuz.executablePath(), args: sparticuz.args, headless: true };
  }
  return {
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  };
}
function getBrowser() {
  browserPromise ??= launchOptions()
    .then((o) => chromium.launch(o))
    .then((browser) => {
      // Chromium 이 죽으면 다음 요청에서 새로 띄운다
      browser.on('disconnected', () => { browserPromise = undefined; });
      return browser;
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

// 스크롤로 시작된 지연 로딩 요청과 이미지 디코딩이 끝날 때까지 (최대 몇 초) 기다린다
async function settleAfterScroll(page) {
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await page
    .evaluate(() =>
      Promise.race([
        Promise.all(
          [...document.images].map((img) =>
            img.complete ? img.decode().catch(() => {}) : new Promise((r) => { img.onload = img.onerror = r; }),
          ),
        ),
        new Promise((r) => setTimeout(r, 5000)),
      ]),
    )
    .catch(() => {});
  await page.waitForTimeout(300);
}

/**
 * 페이지 전체를 하나의 JPEG 이미지로 캡처한다.
 * @returns {Promise<{image: Buffer, height: number, truncated: boolean}>}
 */
export async function capturePage(rawUrl, { width = DEFAULT_WIDTH, mobile = true } = {}) {
  const url = await assertPublicUrl(rawUrl);
  const w = Math.min(Math.max(Math.round(width), 320), 1920);
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: w, height: 844 },
    deviceScaleFactor: SCALE,
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
    // DNS 리바인딩 대비: 사전 검증 이후 브라우저가 실제 접속한 서버 주소도 확인한다
    let blocked = false;
    page.on('response', async (res) => {
      const addr = await res.serverAddr().catch(() => null);
      if (!allowPrivate() && addr && isPrivateAddress(addr.ipAddress)) blocked = true;
    });
    const assertNotBlocked = () => {
      if (blocked) throw new Error('내부 네트워크 주소는 캡처할 수 없습니다');
    };
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await autoScroll(page);
    await settleAfterScroll(page);
    assertNotBlocked();
    const full = await page.evaluate(() =>
      Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0),
    );
    const truncated = full > MAX_HEIGHT;
    const height = Math.min(full, MAX_HEIGHT);
    const shot = (quality) =>
      page.screenshot({ type: 'jpeg', quality, fullPage: true, clip: { x: 0, y: 0, width: w, height } });
    let image = await shot(82);
    if (image.length > MAX_BYTES) image = await shot(55);
    assertNotBlocked();
    return { image, height, truncated };
  } finally {
    await context.close();
  }
}
