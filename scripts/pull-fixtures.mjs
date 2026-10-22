import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const downloadsDir = path.join(os.homedir(), 'Downloads');
const targetDir = path.join(process.cwd(), 'tests', 'fixtures', 'frames');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

if (!fs.existsSync(downloadsDir)) {
  console.log('Không tìm thấy thư mục Downloads:', downloadsDir);
  process.exit(0);
}

const files = fs.readdirSync(downloadsDir).filter((f) => f.startsWith('fixture-') && f.endsWith('.json'));

if (files.length === 0) {
  console.log('ℹ️ Không có file fixture-*.json nào trong thư mục Downloads.');
} else {
  for (const f of files) {
    const src = path.join(downloadsDir, f);
    const dest = path.join(targetDir, f);
    fs.copyFileSync(src, dest);
    fs.unlinkSync(src);
    console.log(`✅ Đã chuyển: ${f} ➔ tests/fixtures/frames/`);
  }
  console.log(`\n🎉 Đã tự động chuyển thành công ${files.length} file vào tests/fixtures/frames/!`);
}
