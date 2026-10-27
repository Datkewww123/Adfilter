import { BASE, expect, test } from './fixtures';

const videoState = () => {
  const v = document.querySelector('video');
  return { muted: v ? v.muted : null, rate: v ? v.playbackRate : null };
};

test('tắt tiếng khi có quảng cáo và khôi phục đúng giá trị ban đầu của người dùng', async ({
  context,
  setConfig,
}) => {
  await setConfig({ enabled: true, dryRun: false, maxSpeed: 2 });
  const page = await context.newPage();
  await page.goto(`${BASE}?scenario=nonskip&rate=1.25`);
  await expect.poll(() => page.evaluate(videoState), { timeout: 8000 }).toEqual({ muted: true, rate: 2 });
  await expect.poll(() => page.evaluate(videoState), { timeout: 12_000 }).toEqual({ muted: false, rate: 1.25 });
});

test('thấy cảnh báo của trang thì dừng can thiệp', async ({ context, setConfig, readActions }) => {
  await setConfig({ enabled: true, dryRun: false });
  const page = await context.newPage();
  await page.goto(`${BASE}?scenario=enforcement`);
  await expect
    .poll(async () => (await readActions()).some((a) => a.action === 'ENFORCEMENT_SEEN'), { timeout: 10_000 })
    .toBe(true);
  await page.waitForTimeout(3000);
  expect((await page.evaluate(videoState)).muted).toBe(false);
});

test('phím Alt+Shift+K đảo công tắc enabled', async ({ context, setConfig, getConfig }) => {
  await setConfig({ enabled: true });
  const page = await context.newPage();
  await page.goto(`${BASE}?scenario=nonskip`);
  await page.keyboard.press('Alt+Shift+K');
  await expect.poll(async () => (await getConfig()).enabled, { timeout: 5000 }).toBe(false);
});

test('tắt bằng phím giữa quảng cáo thì trả lại âm lượng và tốc độ', async ({ context, setConfig }) => {
  await setConfig({ enabled: true, dryRun: false, maxSpeed: 2 });
  const page = await context.newPage();
  await page.goto(`${BASE}?scenario=nonskip&rate=1.5`);
  await expect.poll(() => page.evaluate(videoState), { timeout: 8000 }).toEqual({ muted: true, rate: 2 });
  await page.keyboard.press('Alt+Shift+K');
  await expect.poll(() => page.evaluate(videoState), { timeout: 5000 }).toEqual({ muted: false, rate: 1.5 });
});