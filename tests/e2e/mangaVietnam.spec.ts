import { expect, test } from './fixtures';

test('chặn sạch 6 vị trí quảng cáo đặc thù web truyện Việt Nam (TruyenQQ) và bẫy nhảy tab Big88', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/manga-vietnam.html');

  // Đợi universal engine thực thi dọn dẹp DOM
  await page.waitForTimeout(500);

  // 1. Banner đỉnh (RIKVIP) bị ẩn
  await expect(page.locator('#top-banner-info-container')).not.toBeVisible();

  // 2. Banner sườn trái (ZO.WIN) & sườn phải (FIVE88) bị ẩn
  await expect(page.locator('#floating-left-container')).not.toBeVisible();
  await expect(page.locator('#floatRight')).not.toBeVisible();

  // 3. Popup giữa màn hình (DEBET) bị ẩn
  await expect(page.locator('#popup-debet-modal')).not.toBeVisible();

  // 4. Banner chân trang Catfish (SUNWIN / GEMWIN) bị ẩn
  await expect(page.locator('#catfish-banner-info-container')).not.toBeVisible();

  // 4b. Widget Closed Shadow DOM (.w-overlay-popup & host class ngẫu nhiên) bị attachShadow Shield ẩn triệt để
  await expect(page.locator('#shadow-popup-host')).not.toBeVisible();
  await expect(page.locator('#random-shadow-ad-host')).not.toBeVisible();

  // 5. Click vào link đọc chương KHÔNG bị nhảy tab popunder sang Big88 hoặc bit.ly/adudr
  let popunderOpened = false;
  context.on('page', () => {
    popunderOpened = true;
  });

  await page.click('#chapter-link');
  await page.waitForTimeout(500);
  expect(popunderOpened).toBe(false);
});
