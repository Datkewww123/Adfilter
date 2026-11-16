import { expect, test } from './fixtures';

test('bảo vệ toàn diện web xem phim: iframe Play popunder, card phim popunder, Pause-Ad BOM88, popup mờ nền X và dãy banner YO88/HITCLUB/VSBET/ZO88', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/movie-streaming.html');
  await page.waitForTimeout(500);

  let unexpectedTabOpened = false;
  context.on('page', () => {
    unexpectedTabOpened = true;
  });

  // 1. Dãy banner YO88, HITCLUB, VSBET, ZO88 & popup làm mờ nền có nút X phải bị ẩn sạch
  await expect(page.locator('#banner-yo88')).not.toBeVisible();
  await expect(page.locator('#banner-hitclub')).not.toBeVisible();
  await expect(page.locator('#banner-vsbet')).not.toBeVisible();
  await expect(page.locator('#banner-zo88')).not.toBeVisible();
  await expect(page.locator('#ah-bottom-row')).not.toBeVisible();
  await expect(page.locator('#blurred-x-popup')).not.toBeVisible();

  // Modal đăng nhập hợp lệ, khung player iframe và thanh điều khiển Tập tiếp / Bình luận vẫn hiển thị đầy đủ
  await expect(page.locator('#login-modal')).toBeVisible();
  await expect(page.locator('#player-iframe')).toBeVisible();
  await expect(page.locator('#player-controls-bar')).toBeVisible();
  await expect(page.locator('#outer-pause-bom88-box')).not.toBeVisible();

  // 2. Link bẫy tĩnh bom88.adqc.net bị ẩn tự động; click card phim, link tráo href sang bom88.adqc.net và iframe about:blank KHÔNG mở tab mới
  await expect(page.locator('#bom88-static-link')).not.toBeVisible();
  await page.click('#movie-card-link');
  await page.click('#swapped-trap-link');
  await page.click('#iframe-bypass-btn');
  await page.waitForTimeout(250);
  expect(unexpectedTabOpened).toBe(false);

  // 3. Click Play bên trong <iframe> trình phát video KHÔNG bị nhảy tab quảng cáo
  const frame = page.frameLocator('#player-iframe');
  await frame.locator('#iframe-play-btn').click();
  await page.waitForTimeout(250);
  expect(unexpectedTabOpened).toBe(false);

  // 4. Khi bấm Pause làm hiện Pause-Ad BOM88 ("Quảng cáo" / "Đóng quảng cáo" / "Đóng và xem tiếp"), overlay tự ẩn ngay
  await frame.locator('#iframe-pause-btn').click();
  await page.waitForTimeout(300);
  await expect(frame.locator('#pause-bom88-overlay')).not.toBeVisible();
});
