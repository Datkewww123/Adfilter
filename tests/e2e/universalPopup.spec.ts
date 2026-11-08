import { expect, test } from './fixtures';

test('không bị bật popup hay mở tab mới khi click vào web truyện có mã độc clickjacking', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/manga-with-ads.html');

  let popupOpened = false;
  context.on('page', () => {
    popupOpened = true;
  });

  // Click vào giữa màn hình (nơi có lớp phủ tàng hình)
  await page.mouse.click(300, 300);

  // Đợi 500ms xác nhận không có tab nào bị mở
  await page.waitForTimeout(500);
  expect(popupOpened).toBe(false);
});
