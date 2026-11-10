import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

async function packageExtensions() {
  const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
  const version = pkg.version || '2.0.0';

  console.log(`📦 Đóng gói AdFilter v${version} cho Chrome và Firefox...`);

  // 1. Build release cho cả Chromium và Firefox
  execSync('tsx scripts/build.ts --target=chromium', { stdio: 'inherit' });
  execSync('tsx scripts/build.ts --target=firefox', { stdio: 'inherit' });

  const releaseDir = path.resolve('release');
  await fs.mkdir(releaseDir, { recursive: true });

  const chromeZip = path.join(releaseDir, `adfilter-chromium-v${version}.zip`);
  const firefoxZip = path.join(releaseDir, `adfilter-firefox-v${version}.zip`);

  // Xóa file zip cũ nếu tồn tại
  try {
    await fs.unlink(chromeZip);
  } catch {
    // Không cần xử lý nếu file chưa tồn tại
  }
  try {
    await fs.unlink(firefoxZip);
  } catch {
    // Không cần xử lý nếu file chưa tồn tại
  }

  // Đóng gói zip bằng tar -a (tương thích cả Windows, Linux và macOS)
  try {
    execSync(`tar -a -c -f "${chromeZip}" -C dist/chromium .`);
    console.log(`✅ Đã đóng gói Chrome Web Store: ${chromeZip}`);
  } catch (e) {
    console.warn('Lỗi đóng gói zip Chrome:', e);
  }

  try {
    execSync(`tar -a -c -f "${firefoxZip}" -C dist/firefox .`);
    console.log(`✅ Đã đóng gói Firefox Add-ons: ${firefoxZip}`);
  } catch (e) {
    console.warn('Lỗi đóng gói zip Firefox:', e);
  }

  console.log('🎉 Hoàn tất đóng gói toàn bộ bản phân phối phát hành!');
}

packageExtensions().catch((err) => {
  console.error('Lỗi khi đóng gói:', err);
  process.exit(1);
});
