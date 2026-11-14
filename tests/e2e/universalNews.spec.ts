import { expect, test } from './fixtures';

test('chặn quảng cáo tổng quát trên trang tin tức (AdSense, sticky footer, native Sponsored/Tài trợ) và giữ nguyên nội dung + modal đăng nhập', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/news-sponsored.html');

  await page.waitForTimeout(500);

  // 1. Quảng cáo chuẩn & sticky footer bị ẩn
  await expect(page.locator('.adsbygoogle')).not.toBeVisible();
  await expect(page.locator('#sticky-footer-ad')).not.toBeVisible();

  // 2. Card quảng cáo bản địa bị Procedural Engine (:has-text + :upward) ẩn sạch
  await expect(page.locator('#sponsored-native-card')).not.toBeVisible();
  await expect(page.locator('#vn-tai-tro-card')).not.toBeVisible();

  // 3. Nội dung bài viết thật và modal đăng nhập hợp lệ vẫn hiển thị nguyên vẹn
  await expect(page.locator('#real-article')).toBeVisible();
  await expect(page.locator('#login-modal')).toBeVisible();
});
