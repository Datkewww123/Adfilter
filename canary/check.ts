import { chromium } from '@playwright/test';
import { SELECTORS_DESKTOP } from '../src/content/selectors';
import { evaluateStructure } from './evaluate';

const url = process.env.CANARY_URL;
const api = process.env.API_URL ?? 'http://localhost:3000';

if (!url) {
  console.error('Thiếu CANARY_URL (một đường dẫn video công khai)');
  process.exit(1);
}

const REQUIRED = ['player', 'video'] as const;

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(5000);

  if (page.url().includes('consent.')) {
    console.log('Trang đồng ý cookie, không kết luận được');
    process.exit(2);
  }

  const presence: Record<string, boolean> = {};
  for (const key of REQUIRED) {
    presence[key] = (await page.locator(SELECTORS_DESKTOP[key]).count()) > 0;
  }

  const result = evaluateStructure(presence, REQUIRED);
  console.log(result);

  const res = await fetch(`${api}/canary`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...result, ts: Date.now() }),
  });

  if (!res.ok) throw new Error(`API trả ${res.status}`);
} finally {
  await browser.close();
}
