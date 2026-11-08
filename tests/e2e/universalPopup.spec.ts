import { test, expect } from '@playwright/test';
import path from 'node:path';

test('không bị bật popup hay mở tab mới khi click vào web truyện có mã độc clickjacking', async ({ page, context }) => {
  const filePath = 'file://' + path.resolve(__dirname, 'fixtures/manga-with-ads.html');
  await page.goto(filePath);

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