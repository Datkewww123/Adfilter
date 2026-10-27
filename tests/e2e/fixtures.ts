import { chromium, test as base, type BrowserContext, type Worker } from '@playwright/test';
import path from 'node:path';

export const BASE = 'http://localhost:4173/watch.html';

async function serviceWorker(ctx: BrowserContext): Promise<Worker> {
  const [sw] = ctx.serviceWorkers();
  return sw ?? (await ctx.waitForEvent('serviceworker'));
}

type Rec = Record<string, unknown>;

export const test = base.extend<{
  context: BrowserContext;
  setConfig: (cfg: Rec) => Promise<void>;
  getConfig: () => Promise<Rec>;
  readActions: () => Promise<Rec[]>;
}>({
  context: async ({}, use) => {
    const ext = path.resolve('dist/chromium-dev');
    const ctx = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
    });
    await use(ctx);
    await ctx.close();
  },
  setConfig: async ({ context }, use) => {
    await use(async (cfg) => {
      const sw = await serviceWorker(context);
      await sw.evaluate((c) => chrome.storage.local.set({ config: c }), cfg);
    });
  },
  getConfig: async ({ context }, use) => {
    await use(async () => {
      const sw = await serviceWorker(context);
      return sw.evaluate(async () => (await chrome.storage.local.get('config')).config ?? {});
    });
  },
  readActions: async ({ context }, use) => {
    await use(async () => {
      const sw = await serviceWorker(context);
      return sw.evaluate(async () => (await chrome.storage.local.get('actions')).actions ?? []);
    });
  },
});

export const expect = test.expect;