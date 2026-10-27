# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fake-youtube\skip.spec.ts >> dry-run: không bấm, chỉ ghi nhật ký
- Location: tests\e2e\fake-youtube\skip.spec.ts:14:1

# Error details

```
Error: expect(received).toBeUndefined()

Received: true
```

# Test source

```ts
  1  | import { BASE, expect, test } from './fixtures';
  2  | 
  3  | type W = { __skipClicked?: boolean };
  4  | 
  5  | test('chạy thật: bấm nút bỏ qua khi nút hiện', async ({ context, setConfig }) => {
  6  |   await setConfig({ enabled: true, dryRun: false });
  7  |   const page = await context.newPage();
  8  |   await page.goto(`${BASE}?scenario=skippable`);
  9  |   await page.waitForFunction(() => (window as unknown as W).__skipClicked === true, null, {
  10 |     timeout: 12_000,
  11 |   });
  12 | });
  13 | 
  14 | test('dry-run: không bấm, chỉ ghi nhật ký', async ({ context, setConfig, readActions }) => {
  15 |   await setConfig({ enabled: true, dryRun: true });
  16 |   const page = await context.newPage();
  17 |   await page.goto(`${BASE}?scenario=skippable`);
  18 |   await page.waitForTimeout(5000);
  19 | 
> 20 |   expect(await page.evaluate(() => (window as unknown as W).__skipClicked)).toBeUndefined();
     |                                                                             ^ Error: expect(received).toBeUndefined()
  21 |   await expect
  22 |     .poll(async () => (await readActions()).some((a) => a.action === 'CLICK_SKIP' && a.dryRun === true), {
  23 |       timeout: 8000,
  24 |     })
  25 |     .toBe(true);
  26 | });
  27 | 
  28 | test('tắt bằng công tắc: không làm gì', async ({ context, setConfig }) => {
  29 |   await setConfig({ enabled: false, dryRun: false });
  30 |   const page = await context.newPage();
  31 |   await page.goto(`${BASE}?scenario=skippable`);
  32 |   await page.waitForTimeout(5000);
  33 |   expect(await page.evaluate(() => (window as unknown as W).__skipClicked)).toBeUndefined();
  34 | });
```