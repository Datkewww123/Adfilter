type G = typeof globalThis & { browser?: typeof chrome };
export const ext: typeof chrome = (globalThis as G).browser ?? chrome;