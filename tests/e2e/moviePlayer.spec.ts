import { expect, test } from './fixtures';

test('triệt tiêu quảng cáo video VAST và tự động dọn dẹp overlay trên web phim', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/movie-player.html');

  // Đợi phản hồi bẫy VAST và dọn dẹp overlay
  await page.waitForTimeout(500);

  // 1. Xác nhận VAST preroll bị bẫy và phim chính phát ngay lập tức
  const movieStatus = page.locator('#movie-status');
  await expect(movieStatus).toHaveText('Phim chính đang phát mượt mà (VAST bypassed)');

  // 2. Xác nhận overlay quảng cáo đã bị ẩn hoặc đóng tự động
  const adOverlay = page.locator('#ad-overlay');
  await expect(adOverlay).not.toBeVisible();
});
