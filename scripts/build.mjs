import * as esbuild from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';

async function build() {
  await fs.mkdir('dist', { recursive: true });

  // 1. Build background service worker & content script
  await esbuild.build({
    entryPoints: {
      background: 'src/background/index.ts',
      content: 'src/content/index.ts',
      popup: 'src/popup/popup.ts',
    },
    bundle: true,
    outdir: 'dist',
    format: 'esm',
    target: 'es2022',
    sourcemap: true,
  });

  // 2. Copy static files (manifest, popup.html)
  await fs.copyFile('src/manifest.json', 'dist/manifest.json');
  await fs.copyFile('src/popup/popup.html', 'dist/popup.html');

  console.log('✅ Build completed -> dist/');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});