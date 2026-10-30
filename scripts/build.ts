import * as esbuild from 'esbuild';
import fs from 'node:fs/promises';
import { transformManifest, type Target } from './transformManifest';

async function build() {
  const args = process.argv.slice(2);
  const dev = args.includes('--dev');
  const targetArg = args.find((a) => a.startsWith('--target='));
  const target: Target = (targetArg ? targetArg.split('=')[1] : 'chromium') as Target;

  const out = dev ? `dist/${target}-dev` : `dist/${target}`;
  await fs.mkdir(out, { recursive: true });

  // 1. Biên dịch TypeScript
  await esbuild.build({
    entryPoints: {
      background: 'src/background/index.ts',
      content: 'src/content/index.ts',
      popup: 'src/popup/popup.ts',
      options: 'src/options/options.ts',
      defuser: 'src/stealth/defuser.ts',
    },
    bundle: true,
    outdir: out,
    format: 'esm',
    target: 'es2022',
    sourcemap: true,
    define: { __E2E__: String(dev) },
  });

  // 2. Chuyển đổi và ghi Manifest theo target
  const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
  const baseManifest = JSON.parse(await fs.readFile('src/manifest.json', 'utf8'));

  const finalManifest = transformManifest(baseManifest, {
    target,
    dev,
    version: pkg.version ?? '0.1.0',
  });

  await fs.writeFile(`${out}/manifest.json`, JSON.stringify(finalManifest, null, 2));

  // 3. Sao chép tài nguyên tĩnh
  await fs.copyFile('src/stealth/cosmetic.css', `${out}/cosmetic.css`);
  await fs.copyFile('src/popup/popup.html', `${out}/popup.html`);
  await fs.copyFile('src/options/options.html', `${out}/options.html`);

  // Nếu là Chromium bản chính thức, đồng bộ ra dist/ gốc
  if (!dev && target === 'chromium') {
    await fs.cp(out, 'dist', { recursive: true });
    console.log('✅ Mirrored build to dist/');
  }

  console.log(`✅ Build completed -> ${out}/`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});