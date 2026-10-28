import * as esbuild from 'esbuild';
import fs from 'node:fs/promises';

async function build() {
  const dev = process.argv.includes('--dev');
  const out = dev ? 'dist/chromium-dev' : 'dist/chromium';
  await fs.mkdir(out, { recursive: true });

  // 1. Build TypeScript
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

  // 2. Đồng bộ version từ package.json vào manifest
  const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
  const manifest = JSON.parse(await fs.readFile('src/manifest.json', 'utf8'));
  manifest.version = String(pkg.version).split('-')[0];
  if (String(pkg.version).includes('-')) {
    manifest.version_name = pkg.version;
  }

  if (dev) {
    manifest.host_permissions = manifest.host_permissions || [];
    manifest.host_permissions.push('*://localhost/*', 'http://localhost/*');
    if (manifest.content_scripts && manifest.content_scripts[0]) {
      manifest.content_scripts[0].matches.push('*://localhost/*', 'http://localhost/*');
    }
  }
  await fs.writeFile(`${out}/manifest.json`, JSON.stringify(manifest, null, 2));

  // 3. Copy các file tĩnh
  await fs.copyFile('src/popup/popup.html', `${out}/popup.html`);
  await fs.copyFile('src/options/options.html', `${out}/options.html`);

  console.log(`✅ Build completed -> ${out}/`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});