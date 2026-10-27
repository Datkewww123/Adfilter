import { BASE, expect, test } from './fixtures';

type W = { __skipClicked?: boolean };

test('chạy thật: bấm nút bỏ qua khi nút hiện', async ({ context, setConfig }) => {
  await setConfig({ enabled: true, dryRun: false });
  const page = await context.newPage();
  await page.goto(`${BASE}?scenario=skippable`);
  await page.waitForFunction(() => (window as unknown as W).__skipClicked === true, null, {
    timeout: 12_000,
  });
});

test('dry-run: không bấm, chỉ ghi nhật ký', async ({ context, setConfig, readActions }) => {
  await setConfig({ enabled: true, dryRun: true });
  const page = await context.newPage();
  await page.goto(`${BASE}?scenario=skippable`);
  await page.waitForTimeout(5000);

  expect(await page.evaluate(() => (window as unknown as W).__skipClicked)).toBeUndefined();
  await expect
    .poll(async () => (await readActions()).some((a) => a.action === 'CLICK_SKIP' && a.dryRun === true), {
      timeout: 8000,
    })
    .toBe(true);
});

test('tắt bằng công tắc: không làm gì', async ({ context, setConfig }) => {
  await setConfig({ enabled: false, dryRun: false });
  const page = await context.newPage();
  await page.goto(`${BASE}?scenario=skippable`);
  await page.waitForTimeout(5000);
  expect(await page.evaluate(() => (window as unknown as W).__skipClicked)).toBeUndefined();
});