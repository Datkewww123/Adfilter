# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: safety.spec.ts >> thấy cảnh báo của trang thì dừng can thiệp
- Location: tests\e2e\safety.spec.ts:19:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false

Call Log:
- Timeout 10000ms exceeded while waiting on the predicate
```

# Test source

```ts
  1  | import { BASE, expect, test } from './fixtures';
  2  | 
  3  | const videoState = () => {
  4  |   const v = document.querySelector('video');
  5  |   return { muted: v ? v.muted : null, rate: v ? v.playbackRate : null };
  6  | };
  7  | 
  8  | test('tắt tiếng khi có quảng cáo và khôi phục đúng giá trị ban đầu của người dùng', async ({
  9  |   context,
  10 |   setConfig,
  11 | }) => {
  12 |   await setConfig({ enabled: true, dryRun: false, maxSpeed: 2 });
  13 |   const page = await context.newPage();
  14 |   await page.goto(`${BASE}?scenario=nonskip&rate=1.25`);
  15 |   await expect.poll(() => page.evaluate(videoState), { timeout: 8000 }).toEqual({ muted: true, rate: 2 });
  16 |   await expect.poll(() => page.evaluate(videoState), { timeout: 12_000 }).toEqual({ muted: false, rate: 1.25 });
  17 | });
  18 | 
  19 | test('thấy cảnh báo của trang thì dừng can thiệp', async ({ context, setConfig, readActions }) => {
  20 |   await setConfig({ enabled: true, dryRun: false });
  21 |   const page = await context.newPage();
  22 |   await page.goto(`${BASE}?scenario=enforcement`);
  23 |   await expect
  24 |     .poll(async () => (await readActions()).some((a) => a.action === 'ENFORCEMENT_SEEN'), { timeout: 10_000 })
> 25 |     .toBe(true);
     |      ^ Error: expect(received).toBe(expected) // Object.is equality
  26 |   await page.waitForTimeout(3000);
  27 |   expect((await page.evaluate(videoState)).muted).toBe(false);
  28 | });
  29 | 
  30 | test('phím Alt+Shift+K đảo công tắc enabled', async ({ context, setConfig, getConfig }) => {
  31 |   await setConfig({ enabled: true });
  32 |   const page = await context.newPage();
  33 |   await page.goto(`${BASE}?scenario=nonskip`);
  34 |   await page.keyboard.press('Alt+Shift+K');
  35 |   await expect.poll(async () => (await getConfig()).enabled, { timeout: 5000 }).toBe(false);
  36 | });
  37 | 
  38 | test('tắt bằng phím giữa quảng cáo thì trả lại âm lượng và tốc độ', async ({ context, setConfig }) => {
  39 |   await setConfig({ enabled: true, dryRun: false, maxSpeed: 2 });
  40 |   const page = await context.newPage();
  41 |   await page.goto(`${BASE}?scenario=nonskip&rate=1.5`);
  42 |   await expect.poll(() => page.evaluate(videoState), { timeout: 8000 }).toEqual({ muted: true, rate: 2 });
  43 |   await page.keyboard.press('Alt+Shift+K');
  44 |   await expect.poll(() => page.evaluate(videoState), { timeout: 5000 }).toEqual({ muted: false, rate: 1.5 });
  45 | });
```