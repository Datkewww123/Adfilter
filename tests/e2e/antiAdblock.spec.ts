import { expect, test } from './fixtures';

test('vượt qua thư viện phát hiện adblock FuckAdBlock và hiển thị nội dung truyện', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/manga-fuckadblock.html');

  // Đợi script phát hiện adblock trên trang chạy xong
  await page.waitForTimeout(400);

  // Xác nhận nội dung truyện hiển thị thành công
  const passedMsg = page.locator('#adblock-passed');
  await expect(passedMsg).toBeVisible();

  // Xác nhận modal cảnh báo chặn adblock không bị kích hoạt
  const detectedModal = page.locator('#adblock-detected');
  await expect(detectedModal).not.toBeVisible();
});
